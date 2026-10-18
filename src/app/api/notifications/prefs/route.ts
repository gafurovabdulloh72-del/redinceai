import { eq } from "drizzle-orm";
import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { NOTIFY_GROUP_KEYS, NOTIFY_GROUP_META, type NotifyGroupKey } from "@/lib/notifications";
import { enforceLimit } from "@/lib/security/rate-limit";

/** Javob: har guruh uchun yoqilgan/o'chirilgan (yo'q kalit = yoqilgan) + email kaliti */
function shape(prefs: Record<string, boolean>, notifyEmail: boolean) {
  const groups = Object.fromEntries(NOTIFY_GROUP_KEYS.map((k) => [k, prefs[k] !== false])) as Record<NotifyGroupKey, boolean>;
  return { groups, notifyEmail, meta: NOTIFY_GROUP_META };
}

/** GET: bildirishnoma guruhlari sozlamalarim */
export const GET = handler(async () => {
  const session = await requireSession();
  const u = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { notifyPrefs: true, notifyEmail: true } });
  return ok(shape(u?.notifyPrefs ?? {}, u?.notifyEmail ?? true));
});

const schema = z.object({
  groups: z.object(Object.fromEntries(NOTIFY_GROUP_KEYS.map((k) => [k, z.boolean().optional()])) as Record<NotifyGroupKey, z.ZodOptional<z.ZodBoolean>>).partial().optional(),
  notifyEmail: z.boolean().optional(),
});

/** PUT: qisman yangilash — berilgan guruhlar ustiga yoziladi; faqat `false` saqlanadi (standart = yoqilgan) */
export const PUT = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, schema);
  await enforceLimit("privacy", session.sub);
  const u = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { notifyPrefs: true, notifyEmail: true } });
  const next: Record<string, boolean> = { ...(u?.notifyPrefs ?? {}) };
  for (const k of NOTIFY_GROUP_KEYS) {
    const v = input.groups?.[k];
    if (v === undefined) continue;
    if (v) delete next[k];
    else next[k] = false;
  }
  const notifyEmail = input.notifyEmail ?? u?.notifyEmail ?? true;
  await db.update(users).set({ notifyPrefs: next, ...(input.notifyEmail !== undefined ? { notifyEmail } : {}) }).where(eq(users.id, session.sub));
  return ok(shape(next, notifyEmail));
});
