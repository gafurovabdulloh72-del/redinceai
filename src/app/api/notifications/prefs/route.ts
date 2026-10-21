import { eq } from "drizzle-orm";
import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { DigestFreq } from "@/lib/digest";
import { NOTIFY_GROUP_KEYS, NOTIFY_GROUP_META, type NotifyGroupKey } from "@/lib/notifications";
import { enforceLimit } from "@/lib/security/rate-limit";

/** Javob: har guruh uchun yoqilgan/o'chirilgan (yo'q kalit = yoqilgan) + email kaliti + jamlama davriyligi */
function shape(prefs: Record<string, boolean>, notifyEmail: boolean, digestFreq: DigestFreq) {
  const groups = Object.fromEntries(NOTIFY_GROUP_KEYS.map((k) => [k, prefs[k] !== false])) as Record<NotifyGroupKey, boolean>;
  return { groups, notifyEmail, digestFreq, meta: NOTIFY_GROUP_META };
}

/** GET: bildirishnoma guruhlari sozlamalarim */
export const GET = handler(async () => {
  const session = await requireSession();
  const u = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { notifyPrefs: true, notifyEmail: true, digestFreq: true } });
  return ok(shape(u?.notifyPrefs ?? {}, u?.notifyEmail ?? true, u?.digestFreq ?? "off"));
});

const schema = z.object({
  groups: z.object(Object.fromEntries(NOTIFY_GROUP_KEYS.map((k) => [k, z.boolean().optional()])) as Record<NotifyGroupKey, z.ZodOptional<z.ZodBoolean>>).partial().optional(),
  notifyEmail: z.boolean().optional(),
  digestFreq: z.enum(["off", "daily", "weekly"]).optional(),
});

/** PUT: qisman yangilash — berilgan guruhlar ustiga yoziladi; faqat `false` saqlanadi (standart = yoqilgan) */
export const PUT = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, schema);
  await enforceLimit("privacy", session.sub);
  const u = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { notifyPrefs: true, notifyEmail: true, digestFreq: true } });
  const next: Record<string, boolean> = { ...(u?.notifyPrefs ?? {}) };
  for (const k of NOTIFY_GROUP_KEYS) {
    const v = input.groups?.[k];
    if (v === undefined) continue;
    if (v) delete next[k];
    else next[k] = false;
  }
  const notifyEmail = input.notifyEmail ?? u?.notifyEmail ?? true;
  const digestFreq: DigestFreq = input.digestFreq ?? u?.digestFreq ?? "off";
  await db
    .update(users)
    .set({
      notifyPrefs: next,
      ...(input.notifyEmail !== undefined ? { notifyEmail } : {}),
      // Davriylik o'zgarsa oyna «hozirdan» boshlanadi: kunlikka o'tgan zahoti eski haftalik oyna bilan xabar kelmasin
      ...(input.digestFreq !== undefined && input.digestFreq !== u?.digestFreq ? { digestFreq, digestLastAt: new Date() } : {}),
    })
    .where(eq(users.id, session.sub));
  return ok(shape(next, notifyEmail, digestFreq));
});
