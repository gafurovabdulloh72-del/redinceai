import { z } from "zod";
import { ApiError, handler, ok } from "@/lib/api";
import { captureError } from "@/lib/observability/errors";
import { isClientNoise } from "@/lib/observability/sanitize";
import { clientIp, enforceLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/** Tana chegarasi: xabar ≤1000 + stek ≤6000 belgi sig'adi, undan kattasi — hisobot emas */
const MAX_BYTES = 12 * 1024;

const schema = z.strictObject({
  name: z.string().trim().max(80).optional(),
  message: z.string().trim().min(1, { error: "Xabar bo'sh" }).max(1000, { error: "Xabar juda uzun" }),
  stack: z.string().max(6000, { error: "Stek juda uzun" }).optional(),
  /** Xato chiqqan sahifa yo'li (query'siz) */
  path: z.string().trim().max(400).optional(),
  /** window.onerror bergan fayl manzili */
  source: z.string().trim().max(400).optional(),
  line: z.number().int().min(0).max(100_000_000).optional(),
  col: z.number().int().min(0).max(100_000_000).optional(),
  /** error — window.onerror; rejection — ushlanmagan promise; boundary/global — xatolik ekranlari */
  type: z.enum(["error", "rejection", "boundary", "global"]).default("error"),
});

/** Tanani chegara bilan o'qish: content-length yolg'on yoki yo'q bo'lsa ham xotiraga MAX_BYTES'dan ortiq olinmaydi */
async function readCapped(req: Request, max: number): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > max) throw new ApiError(413, "Hisobot juda katta");
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      throw new ApiError(413, "Hisobot juda katta");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Brauzer xatolari (2026-11-10, «Xatolar jurnali»): `ClientErrorReporter` va xatolik ekranlari shu yerga yuboradi.
 * Mehmon ham yuboradi (xato kirishdan oldin ham chiqadi) — shuning uchun himoya qatlamlari:
 *  · IP bo'yicha qattiq limit (`clientError`: 30 / soat) — umumiy mutatsiya limiti ISHLATILMAYDI (`limit: false`), aks holda
 *    xato to'foni foydalanuvchining oddiy amallar kvotasini yeb qo'yardi;
 *  · tana ≤12 KB (oqim bo'yicha kesiladi), sxema qat'iy — ortiqcha/noto'g'ri maydon 422;
 *  · brauzer kengaytmalari va zararsiz shovqin («Script error.», ResizeObserver…) jim tashlanadi;
 *  · matn/stek/yo'l `captureError` ichida tozalanadi (email, telefon, token, query yozilmaydi);
 *  · foydalanuvchi id — faqat imzosi tekshirilgan sessiya cookie'sidan (tanadan EMAS).
 * Javob har doim bir xil — nima saqlangani/tashlangani oshkor qilinmaydi.
 */
export const POST = handler(
  async (req) => {
    await enforceLimit("clientError", clientIp(req));
    const text = await readCapped(req, MAX_BYTES);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ApiError(400, "JSON noto'g'ri");
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new ApiError(422, "Hisobot shakli noto'g'ri");
    const r = parsed.data;

    if (!isClientNoise(r.message, r.stack ?? "", r.source)) {
      await captureError(
        { name: r.name, message: r.message, stack: r.stack },
        {
          req,
          kind: "client",
          // Sahifa yo'li: hisobotdagi qiymat, bo'lmasa Referer (ikkalasi ham tozalanadi — query/token yozilmaydi)
          path: r.path || req.headers.get("referer") || "",
          method: "",
          extra: { type: r.type, source: r.source, line: r.line, col: r.col },
        },
      );
    }
    return ok({ received: true });
  },
  { limit: false },
);
