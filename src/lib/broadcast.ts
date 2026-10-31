import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";

/**
 * Ommaviy e'lon (admin): barcha / mutaxassislar / mijozlarga bir vaqtda — sayt bildirishnomasi + Telegram
 * (ulaganlarga) + email (ixtiyoriy). Adminlarga va bloklanganlarga yuborilmaydi.
 * Umumiy modul: admin panel (`/api/admin/broadcast`) va Telegram bot (`/elon`) ikkalasi shu orqali yuboradi.
 */
export const AUDIENCES = ["all", "specialists", "clients"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const AUDIENCE_LABEL: Record<Audience, string> = { all: "Hammaga", specialists: "Mutaxassislarga", clients: "Mijozlarga" };

export function audienceWhere(a: Audience) {
  const base = and(eq(users.isBanned, false), ne(users.role, "admin"))!;
  if (a === "specialists") return and(base, eq(users.role, "specialist"))!;
  if (a === "clients") return and(base, eq(users.role, "client"))!;
  return base;
}

/** O'chirilgan (anonimlashtirilgan) hisob — email kanalida sanalmaydi (notifications.ts bilan bir xil qoida) */
const DELETED_EMAIL_RE = /^deleted-.*@redince\.invalid$/i;

export interface AudienceRow {
  id: string;
  role: string;
  banned: boolean;
  tg: string | null;
  mail: boolean;
  email: string | null;
}

export async function audienceRows(a: Audience): Promise<AudienceRow[]> {
  return db.select({ id: users.id, role: users.role, banned: users.isBanned, tg: users.telegramChatId, mail: users.notifyEmail, email: users.email }).from(users).where(audienceWhere(a));
}

/** Auditoriyaning kanal kesimi: sayt (hammaga), Telegram (botni ulaganlar), email (yoqilganlar) */
export function channelStat(list: AudienceRow[]) {
  return {
    total: list.length,
    telegram: process.env.TELEGRAM_BOT_TOKEN ? list.filter((r) => r.tg).length : 0,
    email: list.filter((r) => r.mail && r.email && !DELETED_EMAIL_RE.test(r.email)).length,
  };
}

export interface BroadcastInput {
  title: string;
  body: string;
  href?: string | null;
  audience: Audience;
  email?: boolean;
}

/** Yuborish: 20 talik guruhlar bilan ketma-ket (hozirgi masshtab uchun yetarli; minglab bo'lsa navbatga o'tkaziladi) */
export async function sendBroadcast(input: BroadcastInput, actorId: string, via: "admin" | "telegram", req?: Request): Promise<{ sent: number; channels: { site: number; telegram: number; email: number } }> {
  const targets = await audienceRows(input.audience);
  const href = input.href || null;
  let sent = 0;
  for (let i = 0; i < targets.length; i += 20) {
    const chunk = targets.slice(i, i + 20);
    await Promise.all(chunk.map((u) => notify(u.id, "broadcast", input.title, input.body, href, { forceMail: Boolean(input.email) })));
    sent += chunk.length;
  }
  const st = channelStat(targets);
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
  const channels = { site: sent, telegram: st.telegram, email: input.email && emailConfigured ? st.email : 0 };
  await audit(actorId, "admin_broadcast", { meta: { audience: input.audience, sent, email: Boolean(input.email), title: input.title, channels, via } }, req).catch(() => undefined);
  return { sent, channels };
}
