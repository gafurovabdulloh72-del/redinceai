import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { checkSpamText, getSpamFilter, saveSpamFilter, SPAM_LIMITS } from "@/lib/security/spam-filter";

const schema = z.object({
  words: z.array(z.string().trim().max(SPAM_LIMITS.maxWordLen)).max(SPAM_LIMITS.maxWords),
  blockLinks: z.boolean(),
  allowDomains: z.array(z.string().trim().max(SPAM_LIMITS.maxDomainLen)).max(SPAM_LIMITS.maxDomains),
  /** Ixtiyoriy: saqlamasdan sinab ko'rish uchun matn — natija javobda qaytadi */
  sample: z.string().max(2000).optional(),
});

/** Admin: spam filtri sozlamalari (taqiqlangan so'zlar, havola siyosati) */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  return ok(await getSpamFilter());
});

export const PUT = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const input = await parseBody(req, schema);
  const before = await getSpamFilter();
  const saved = await saveSpamFilter(input);
  await audit(session.sub, "admin_spam_filter", { targetType: "platform_settings", meta: { before: { words: before.words.length, blockLinks: before.blockLinks, domains: before.allowDomains.length }, after: { words: saved.words.length, blockLinks: saved.blockLinks, domains: saved.allowDomains.length } } }, req);
  return ok({ ...saved, sampleResult: input.sample ? checkSpamText(input.sample, saved) : undefined });
});

/** Sinov: matnni joriy (yoki yuborilgan) sozlama bilan tekshirish — hech narsa saqlanmaydi */
export const POST = handler(async (req) => {
  await requireSession(["admin"]);
  const input = await parseBody(req, schema.partial({ words: true, blockLinks: true, allowDomains: true }).extend({ sample: z.string().max(2000) }));
  const current = await getSpamFilter();
  const settings = { words: input.words ?? current.words, blockLinks: input.blockLinks ?? current.blockLinks, allowDomains: input.allowDomains ?? current.allowDomains };
  return ok({ result: checkSpamText(input.sample, settings) });
});
