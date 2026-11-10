import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { invalidateSiteNotice } from "@/lib/admin/site-notice";
import { BANNER_LIMITS, BANNER_TONES, readSiteNotice, safeBannerHref, saveSiteBanner } from "@/lib/payments/settings";
import { audit } from "@/lib/security/audit";

const YEAR_MS = 366 * 24 * 60 * 60 * 1000;

const schema = z.object({
  textUz: z.string().trim().min(3, { error: "Matn juda qisqa (kamida 3 belgi)" }).max(BANNER_LIMITS.text, { error: `Ko'pi bilan ${BANNER_LIMITS.text} belgi` }),
  textRu: z.string().trim().max(BANNER_LIMITS.text, { error: `Ko'pi bilan ${BANNER_LIMITS.text} belgi` }).default(""),
  tone: z.enum(BANNER_TONES, { error: "Ohang noto'g'ri" }).default("info"),
  /** Ichki yo'l (/narxlar) yoki https havola; bo'sh — havolasiz */
  href: z.string().trim().max(BANNER_LIMITS.href, { error: "Havola juda uzun" }).default(""),
  /** Muddat (ms); null — o'chirilguncha ko'rsatiladi */
  until: z.number({ error: "Muddat noto'g'ri" }).int().positive().nullable().default(null),
});

/** Admin: sayt e'loni va texnik ishlar holati (keshsiz — bazadagi joriy qiymat) */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  const { banner, maintenance } = await readSiteNotice();
  return ok({ banner, maintenance, active: Boolean(banner && (banner.until == null || banner.until > Date.now())) });
});

/** Admin: e'lonni saqlash (to'liq almashtirish; versiya yangilanadi — yopgan tashrifchilarga ham qayta ko'rinadi) */
export const PUT = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const input = await parseBody(req, schema);
  const href = input.href ? safeBannerHref(input.href) : null;
  if (input.href && !href) throw new ApiError(422, "Ma'lumotlarni tekshiring", { href: "Havola ichki yo'l (/narxlar) yoki https:// manzil bo'lsin" });
  const now = Date.now();
  if (input.until != null && input.until <= now + 60_000) throw new ApiError(422, "Ma'lumotlarni tekshiring", { until: "Muddat kelajakdagi vaqt bo'lsin" });
  if (input.until != null && input.until > now + YEAR_MS) throw new ApiError(422, "Ma'lumotlarni tekshiring", { until: "Muddat bir yildan oshmasin" });

  const saved = await saveSiteBanner({ textUz: input.textUz, textRu: input.textRu, tone: input.tone, href, until: input.until });
  invalidateSiteNotice({ banner: saved });
  await audit(session.sub, "admin_site_banner", { targetType: "platform_settings", targetId: "siteBanner", meta: { tone: input.tone, textUz: input.textUz.slice(0, 120), hasRu: Boolean(input.textRu), href: href ?? undefined, until: input.until ?? undefined } }, req);
  return ok({ banner: saved, active: true });
});

/** Admin: e'lonni olib tashlash */
export const DELETE = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { banner } = await readSiteNotice();
  await saveSiteBanner(null);
  invalidateSiteNotice({ banner: null });
  await audit(session.sub, "admin_site_banner_removed", { targetType: "platform_settings", targetId: "siteBanner", meta: { textUz: banner?.textUz.slice(0, 120) } }, req);
  return ok({ banner: null, active: false });
});
