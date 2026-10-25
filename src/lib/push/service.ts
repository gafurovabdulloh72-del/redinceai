import "server-only";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { uid } from "@/lib/utils";
import { isPushEnabled, sendPush } from "./web-push";

/** Bir foydalanuvchida ko'pi bilan shuncha qurilma (eskisi o'chiriladi) */
const MAX_PER_USER = 10;
/** Ketma-ket shuncha xato bo'lsa obuna o'chiriladi */
const MAX_FAILURES = 5;

const ENDPOINT_RE = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\/[\w./@%:+-]*$/i;

/**
 * Push xizmatlari OQ RO'YXATI (2026-10-25 auditi, 2-band). Ilgari istalgan `https://host/...`
 * qabul qilinardi — kirgan foydalanuvchi o'z hisobiga ixtiyoriy manzil yozib, server har
 * bildirishnomada o'sha manzilga POST qilishiga erishardi (ko'r SSRF + tashqi xostni «urish»).
 * Endi faqat brauzerlarning haqiqiy push xizmatlari.
 */
const ALLOWED_HOSTS = [
  "android.googleapis.com", // eski FCM
  "fcm.googleapis.com", // Chrome / Android
  "updates.push.services.mozilla.com", // Firefox
  "push.services.mozilla.com",
  "web.push.apple.com", // Safari / iOS
  "notify.windows.com", // Edge (WNS)
  "wns2-by3p.notify.windows.com",
] as const;

/** Xost oq ro'yxatdami: aniq moslik yoki shu domenning subdomeni */
function hostAllowed(endpoint: string): boolean {
  let host: string;
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:") return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export type PushInput = { endpoint: string; p256dh: string; auth: string; userAgent?: string | null };

/** Obunani saqlash (bir endpoint — bir qator; boshqa hisobda bo'lsa egasi o'zgaradi) */
export async function savePushSubscription(userId: string, input: PushInput): Promise<void> {
  if (!isPushEnabled()) throw new ApiError(503, "Push bildirishnomalar sozlanmagan");
  if (!ENDPOINT_RE.test(input.endpoint) || input.endpoint.length > 500) throw new ApiError(422, "Obuna manzili noto'g'ri");
  if (!hostAllowed(input.endpoint)) throw new ApiError(422, "Bu push xizmati qo'llab-quvvatlanmaydi");
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(input.p256dh) || !/^[A-Za-z0-9_-]{10,80}$/.test(input.auth)) throw new ApiError(422, "Obuna kalitlari noto'g'ri");
  await db
    .insert(pushSubscriptions)
    .values({ id: uid(), userId, endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth, userAgent: (input.userAgent ?? "").slice(0, 200) || null })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: input.p256dh, auth: input.auth, failures: 0, userAgent: (input.userAgent ?? "").slice(0, 200) || null },
    });
  // Eng eski qurilmalarni kesib tashlaymiz
  const mine = await db.query.pushSubscriptions.findMany({ where: eq(pushSubscriptions.userId, userId), columns: { id: true, createdAt: true } });
  if (mine.length > MAX_PER_USER) {
    const extra = mine
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, mine.length - MAX_PER_USER)
      .map((r) => r.id);
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, extra));
  }
}

/** Obunani o'chirish (brauzerda «o'chirish» bosilganda yoki endpoint o'lganda) */
export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function pushDeviceCount(userId: string): Promise<number> {
  return db.$count(pushSubscriptions, eq(pushSubscriptions.userId, userId));
}

export type PushMessage = { title: string; body?: string | null; href?: string | null; tag?: string; urgency?: "normal" | "high" };

/**
 * Foydalanuvchining barcha qurilmalariga push. Hech qachon xato tashlamaydi
 * (bildirishnoma xatosi asosiy oqimni buzmasin). O'lgan obunalar o'chiriladi.
 */
export async function pushToUser(userId: string, msg: PushMessage): Promise<{ sent: number; removed: number }> {
  if (!isPushEnabled()) return { sent: 0, removed: 0 };
  const subs = await db.query.pushSubscriptions.findMany({ where: eq(pushSubscriptions.userId, userId) });
  if (!subs.length) return { sent: 0, removed: 0 };
  const payload = JSON.stringify({
    title: msg.title.slice(0, 120),
    body: (msg.body ?? "").slice(0, 300) || undefined,
    href: msg.href ?? "/kabinet/bildirishnomalar",
    tag: msg.tag,
  });
  let sent = 0;
  const dead: string[] = [];
  const bad: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        const r = await sendPush(s, payload, msg.urgency ?? "normal");
        if (r.ok) {
          sent++;
          return;
        }
        if (r.gone) dead.push(s.id);
        else bad.push(s.id);
      } catch (e) {
        console.error("[push:send]", e);
        bad.push(s.id);
      }
    }),
  );
  if (sent) await db.update(pushSubscriptions).set({ lastSentAt: new Date(), failures: 0 }).where(inArray(pushSubscriptions.id, subs.filter((s) => !dead.includes(s.id) && !bad.includes(s.id)).map((s) => s.id)));
  if (bad.length) {
    // Ketma-ket xatolarni sanab boramiz; MAX_FAILURES ga yetganini o'chiramiz
    const burnt = await db
      .update(pushSubscriptions)
      .set({ failures: sql`${pushSubscriptions.failures} + 1` })
      .where(inArray(pushSubscriptions.id, bad))
      .returning({ id: pushSubscriptions.id, failures: pushSubscriptions.failures });
    dead.push(...burnt.filter((b) => b.failures >= MAX_FAILURES).map((b) => b.id));
  }
  if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
  return { sent, removed: dead.length };
}

/** 6 oydan beri hech narsa yetib bormagan obunalarni tozalash (cron) */
export async function purgeStalePush(): Promise<number> {
  const cutoff = new Date(Date.now() - 180 * 86_400_000);
  const r = await db
    .delete(pushSubscriptions)
    .where(and(lt(pushSubscriptions.createdAt, cutoff), or(isNull(pushSubscriptions.lastSentAt), lt(pushSubscriptions.lastSentAt, cutoff))))
    .returning({ id: pushSubscriptions.id });
  return r.length;
}
