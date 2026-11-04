import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { enforceLimit, clientIp } from "@/lib/security/rate-limit";
import { translateUiBatch } from "@/lib/i18n/translate-service";

export const runtime = "nodejs";

const schema = z.object({ texts: z.array(z.string().min(2).max(160)).min(1).max(60) });

/**
 * POST { texts: string[] } → { map: { "<uz>": "<ru>" } } — avtomatik RU qatlam uchun (mehmonga ham ochiq, IP limiti).
 * Faqat UI matnlari: foydalanuvchi kontenti klientda `data-no-auto` bilan chetlab o'tiladi.
 */
export const POST = handler(async (req) => {
  await enforceLimit("i18nAuto", clientIp(req));
  const { texts } = await parseBody(req, schema);
  const map = await translateUiBatch(texts);
  return ok({ map });
});
