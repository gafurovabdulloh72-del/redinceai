import "server-only";
import { after } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { deliverTelegramNotification, notify, type TelegramDelivery } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";

/**
 * Ommaviy e'lon (admin): barcha / mutaxassislar / mijozlarga bir vaqtda — sayt bildirishnomasi + Telegram
 * (ulaganlarga) + email (ixtiyoriy). Adminlarga va bloklanganlarga yuborilmaydi.
 * Umumiy modul: admin panel (`/api/admin/broadcast`) va Telegram bot (`/elon`) ikkalasi shu orqali yuboradi.
 *
 * TELEGRAM (2026-11-10): xabarlar `notify()` fan-out'i orqali EMAS, shu yerdan yetkaziladi — har yuborish natijasi
 * sanaladi (yetkazildi / bloklagan / xato). Yuborish umumiy navbatdan o'tadi (lib/telegram.ts: ~25 xabar/s, 429'da
 * `retry_after` kutiladi), shuning uchun katta auditoriyada bir necha daqiqa davom etishi mumkin: javob `waitMs` gacha
 * kutadi, qolgani fon rejimida davom etadi (`telegram.pending`) va tugagach `onTelegramDone` chaqiriladi.
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
  /** Bildirishnoma sozlamalari (`system: false` — ma'muriyat e'lonlari o'chirilgan). Eski chaqiruvchilar bermasligi mumkin */
  prefs?: Record<string, boolean> | null;
}

export async function audienceRows(a: Audience): Promise<AudienceRow[]> {
  return db.select({ id: users.id, role: users.role, banned: users.isBanned, tg: users.telegramChatId, mail: users.notifyEmail, email: users.email, prefs: users.notifyPrefs }).from(users).where(audienceWhere(a));
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

/** Telegram yetkazish hisobi: `linked` — chat ulanganlar; `pending` — javob qaytganda hali navbatda turganlar */
export interface TelegramTally {
  linked: number;
  delivered: number;
  blocked: number;
  failed: number;
  /** Yuborilmadi: foydalanuvchi e'lonlarni o'chirgan yoki chat shu orada uzilgan */
  skipped: number;
  pending: number;
}

export interface BroadcastResult {
  sent: number;
  /** `telegram` — HAQIQATDA yetkazilgan xabarlar soni (javob qaytgan paytgacha; qolgani `telegram.pending`) */
  channels: { site: number; telegram: number; email: number };
  telegram: TelegramTally;
}

export interface BroadcastHooks {
  /** Telegram navbati to'liq tugagach (fon rejimida ham) — yakuniy sonlar va saytga yozilganlar soni bilan */
  onTelegramDone?: (tally: TelegramTally, sent: number) => Promise<void> | void;
  /** Javobni Telegram yetkazilishini shuncha kutib qaytarish (ms). Standart 20 s */
  waitMs?: number;
}

const SITE_CHUNK = 20;
/** Bir vaqtda nechta Telegram yetkazish jarayoni (har biri bazadan o'qiydi; yuborish tezligini navbat cheklaydi) */
const TG_WORKERS = 8;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Yuborish: sayt bildirishnomalari 20 talik guruhlar bilan; Telegram — navbat orqali, natijasi sanaladi */
export async function sendBroadcast(input: BroadcastInput, actorId: string, via: "admin" | "telegram", req?: Request, hooks: BroadcastHooks = {}): Promise<BroadcastResult> {
  const targets = await audienceRows(input.audience);
  const href = input.href || null;
  let sent = 0;
  for (let i = 0; i < targets.length; i += SITE_CHUNK) {
    const chunk = targets.slice(i, i + SITE_CHUNK);
    // skipTelegram: Telegram quyida alohida yetkaziladi (natijani sanash uchun) — sayt, push va (ixtiyoriy) email shu yerda
    await Promise.all(chunk.map((u) => notify(u.id, "broadcast", input.title, input.body, href, { forceMail: Boolean(input.email), skipTelegram: true })));
    sent += chunk.length;
  }

  const tgEnabled = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const linked = tgEnabled ? targets.filter((r) => r.tg) : [];
  const tally: TelegramTally = { linked: linked.length, delivered: 0, blocked: 0, failed: 0, skipped: 0, pending: linked.length };
  const count = (r: TelegramDelivery) => {
    tally.pending -= 1;
    if (r === "sent") tally.delivered += 1;
    else if (r === "blocked") tally.blocked += 1;
    else if (r === "failed") tally.failed += 1;
    else tally.skipped += 1;
  };
  let cursor = 0;
  const worker = async () => {
    while (cursor < linked.length) {
      const u = linked[cursor++];
      // «Tizim» guruhini o'chirgan foydalanuvchiga e'lon bormaydi (notify() ham shu qoidani qo'llaydi)
      if ((u.prefs ?? {}).system === false) {
        count("none");
        continue;
      }
      count(await deliverTelegramNotification(u.id, "broadcast", input.title, input.body, href).catch(() => "failed" as const));
    }
  };
  const all = (async () => {
    await Promise.all(Array.from({ length: Math.min(TG_WORKERS, linked.length) }, worker));
    const final = { ...tally };
    await audit(actorId, "admin_broadcast", { meta: { audience: input.audience, title: input.title, via, delivery: "telegram", ...final } }).catch(() => undefined);
    await Promise.resolve(hooks.onTelegramDone?.(final, sent)).catch((e) => console.error("[broadcast] onTelegramDone", e));
  })().catch((e) => console.error("[broadcast] telegram", e));
  // Fon rejimida davom etishi uchun (serverless'da javobdan keyin jarayon to'xtab qolmasin)
  try {
    after(() => all);
  } catch {
    /* so'rov kontekstidan tashqarida (cron/skript) — promise o'zi davom etadi */
  }
  await Promise.race([all, sleep(Math.max(0, hooks.waitMs ?? 20_000))]);

  const st = channelStat(targets);
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
  const snapshot = { ...tally };
  const channels = { site: sent, telegram: snapshot.delivered, email: input.email && emailConfigured ? st.email : 0 };
  await audit(actorId, "admin_broadcast", { meta: { audience: input.audience, sent, email: Boolean(input.email), title: input.title, channels, telegram: snapshot, via } }, req).catch(() => undefined);
  return { sent, channels, telegram: snapshot };
}
