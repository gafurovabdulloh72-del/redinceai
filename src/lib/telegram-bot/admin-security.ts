import "server-only";
import { isIP } from "node:net";
import { audit } from "@/lib/security/audit";
import { blockIp, honeypotStats, unblockIp, type HoneypotStats } from "@/lib/security/honeypot";
import { cutPlain, escapeTelegramHtml, sendTelegram, type TelegramButton } from "@/lib/telegram";
import { L, type BotLang } from "@/lib/telegram-bot/lang";
import { pageButton } from "@/lib/telegram-bot/ui";

/**
 * ADMIN BOTI — XAVFSIZLIK (2026-11-10): tuzoq (honeypot) holati va IP bloklash Telegramdan.
 *  /tuzoq            — 24 soatlik urinishlar, eng faol IP'lar, so'nggi urinishlar, bloklanganlar; tugmalar: bloklash / blokdan chiqarish
 *  /blok <ip> [sabab] — IP'ni qo'lda (doimiy) bloklash
 *  /blokdan <ip>      — blokdan chiqarish
 *  tugmalar: `adm:trap` (holatni yangilash), `adm:ipb:<ip>` (bloklash), `adm:ipu:<ip>` (blokdan chiqarish)
 * Hammasi admin panel bilan BIR XIL servis (`lib/security/honeypot.ts`) va audit yozuvi (`admin_ip_block|unblock`, via=telegram).
 * QOIDA: bu ma'lumot FAQAT admin chatida ko'rinadi — chaqiruvchi `adminByChat` bilan tekshiradi (webhook va `handleAdminCallback`);
 * oddiy foydalanuvchiga himoya qanday ishlashi (chegara, nima yozib olinishi) hech qayerda aytilmaydi.
 */
type Answer = (text: string) => Promise<unknown>;
type Admin = { id: string; name: string };

const KIND_ICON: Record<string, string> = { scan: "🔎", fakeLogin: "🔑", canary: "🚨", probe: "🧪" };

/** IP manzilni tekshirish va bir xil ko'rinishga keltirish (kichik harf; IPv4 ko'rinishidagi IPv6 — IPv4) */
export function normalizeIp(raw: string): string | null {
  const ip = raw.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, "$1");
  return isIP(ip) ? ip : null;
}

/** Lokal manzil — bloklab bo'lmaydi (server o'ziga murojaat qiladi; dev'da hamma so'rov shu manzildan) */
const isLoopback = (ip: string): boolean => ip === "::1" || ip === "::" || ip === "0.0.0.0" || ip.startsWith("127.");

const fmtTime = (ms: number, lang?: BotLang): string => new Date(ms).toLocaleString(lang === "ru" ? "ru-RU" : "uz-UZ", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function untilLabel(b: HoneypotStats["blocked"][number], lang?: BotLang): string {
  if (b.manual || b.until == null) return L(lang, "doimiy (qo'lda)", "бессрочно (вручную)");
  return L(lang, `${fmtTime(b.until, lang)} gacha`, `до ${fmtTime(b.until, lang)}`);
}

/** `/tuzoq` — tuzoq holati (faqat admin chati) */
export async function sendAdminTrap(chatId: string, lang?: BotLang): Promise<void> {
  const s = await honeypotStats();
  const now = Date.now();
  const active = s.blocked.filter((b) => b.manual || b.until == null || b.until > now);
  const blockedSet = new Set(active.map((b) => b.ip));
  const lines: string[] = [
    `🪤 <b>${L(lang, "Tuzoq (honeypot)", "Ловушка (honeypot)")}</b>`,
    L(lang, `So'nggi 24 soat: <b>${s.total24h}</b> ta urinish · bloklangan IP: <b>${active.length}</b> ta`, `За 24 часа: <b>${s.total24h}</b> попыток · заблокировано IP: <b>${active.length}</b>`),
  ];
  if (s.topIps.length) {
    lines.push("", `<b>${L(lang, "Eng faol manzillar", "Самые активные адреса")}</b>`);
    for (const t of s.topIps.slice(0, 5)) lines.push(`• <code>${escapeTelegramHtml(t.ip)}</code> — ${t.n}${blockedSet.has(t.ip) ? " ⛔" : ""}`);
  }
  if (s.recent.length) {
    lines.push("", `<b>${L(lang, "So'nggi urinishlar", "Последние попытки")}</b>`);
    for (const r of s.recent.slice(0, 6)) {
      lines.push(`${KIND_ICON[r.kind] ?? "•"} ${escapeTelegramHtml(fmtTime(r.createdAt, lang))} · <code>${escapeTelegramHtml(r.ip)}</code>${r.soft ? L(lang, " (yumshoq)", " (мягкая)") : ""}\n   ${escapeTelegramHtml(r.method)} ${escapeTelegramHtml(cutPlain(r.path, 70))}`);
    }
  }
  if (active.length) {
    lines.push("", `<b>${L(lang, "Bloklanganlar", "Заблокированные")}</b>`);
    for (const b of active.slice(0, 6)) lines.push(`⛔ <code>${escapeTelegramHtml(b.ip)}</code> — ${escapeTelegramHtml(untilLabel(b, lang))}\n   ${escapeTelegramHtml(cutPlain(b.reason, 90))}`);
    if (active.length > 6) lines.push(L(lang, `… va yana ${active.length - 6} ta — admin panelda.`, `… и ещё ${active.length - 6} — в админ-панели.`));
  }
  if (!s.topIps.length && !s.recent.length && !active.length) lines.push("", L(lang, "Hozircha urinish ham, blok ham yo'q ✅", "Пока нет ни попыток, ни блокировок ✅"));
  lines.push("", L(lang, "Qo'lda: <code>/blok 1.2.3.4 sabab</code> · <code>/blokdan 1.2.3.4</code>", "Вручную: <code>/blok 1.2.3.4 причина</code> · <code>/blokdan 1.2.3.4</code>"));

  // Tugmalar: bloklanmagan manzillar (so'nggi qattiq urinishlar, keyin eng faollar) — bloklash; bloklanganlar — blokdan
  // chiqarish. Faqat haqiqiy IP («unknown-…» emas) va lokal bo'lmagan manzil.
  const keyboard: TelegramButton[][] = [];
  const candidates = [...new Set([...s.recent.filter((r) => !r.soft).map((r) => r.ip), ...s.topIps.map((t) => t.ip)])].filter((ip) => !blockedSet.has(ip) && normalizeIp(ip) && !isLoopback(ip));
  for (const ip of candidates.slice(0, 3)) keyboard.push([{ text: `⛔ ${L(lang, "Bloklash", "Заблокировать")} ${ip}`, data: `adm:ipb:${ip}` }]);
  for (const b of active.filter((x) => normalizeIp(x.ip)).slice(0, 3)) keyboard.push([{ text: `✅ ${L(lang, "Blokdan chiqarish", "Разблокировать")} ${b.ip}`, data: `adm:ipu:${b.ip}` }]);
  keyboard.push([{ text: L(lang, "🔄 Yangilash", "🔄 Обновить"), data: "adm:trap" }, pageButton(L(lang, "🛠 Admin panelda", "🛠 В админ-панели"), "/admin#tuzoq")]);
  await sendTelegram(chatId, lines.join("\n"), { keyboard: keyboard.filter((row) => row.every((b) => !b.data || Buffer.byteLength(b.data) <= 64)) });
}

/** Bloklash (umumiy: buyruq va tugma). Natija matni qaytadi */
async function doBlock(admin: Admin, rawIp: string, reason: string, lang?: BotLang): Promise<{ ok: boolean; text: string }> {
  const ip = normalizeIp(rawIp);
  if (!ip) return { ok: false, text: L(lang, "IP manzil noto'g'ri. Masalan: <code>/blok 203.0.113.7 skaner</code>", "Неверный IP-адрес. Например: <code>/blok 203.0.113.7 сканер</code>") };
  if (isLoopback(ip)) return { ok: false, text: L(lang, "Lokal manzilni bloklab bo'lmaydi.", "Локальный адрес заблокировать нельзя.") };
  const why = cutPlain(reason.replace(/\s+/g, " ").trim(), 160) || `Admin Telegram orqali blokladi (${admin.name})`;
  await blockIp(ip, why, { manual: true });
  await audit(admin.id, "admin_ip_block", { targetType: "ip", targetId: ip, meta: { reason: why, via: "telegram" } });
  return { ok: true, text: L(lang, `⛔ <code>${escapeTelegramHtml(ip)}</code> bloklandi (doimiy).\nSabab: ${escapeTelegramHtml(why)}`, `⛔ <code>${escapeTelegramHtml(ip)}</code> заблокирован (бессрочно).\nПричина: ${escapeTelegramHtml(why)}`) };
}

/** Blokdan chiqarish (umumiy: buyruq va tugma) */
async function doUnblock(admin: Admin, rawIp: string, lang?: BotLang): Promise<{ ok: boolean; text: string }> {
  const ip = normalizeIp(rawIp);
  if (!ip) return { ok: false, text: L(lang, "IP manzil noto'g'ri. Masalan: <code>/blokdan 203.0.113.7</code>", "Неверный IP-адрес. Например: <code>/blokdan 203.0.113.7</code>") };
  const was = (await honeypotStats()).blocked.some((b) => b.ip === ip);
  if (!was) return { ok: false, text: L(lang, `<code>${escapeTelegramHtml(ip)}</code> bloklanganlar ro'yxatida yo'q.`, `<code>${escapeTelegramHtml(ip)}</code> нет в списке заблокированных.`) };
  await unblockIp(ip);
  await audit(admin.id, "admin_ip_unblock", { targetType: "ip", targetId: ip, meta: { via: "telegram" } });
  return { ok: true, text: L(lang, `✅ <code>${escapeTelegramHtml(ip)}</code> blokdan chiqarildi.`, `✅ <code>${escapeTelegramHtml(ip)}</code> разблокирован.`) };
}

const trapButton = (lang?: BotLang): TelegramButton[][] => [[{ text: L(lang, "🪤 Tuzoq holati", "🪤 Состояние ловушки"), data: "adm:trap" }]];

/** `/blok <ip> [sabab]` */
export async function handleAdminBlock(chatId: string, admin: Admin, args: string, lang?: BotLang): Promise<void> {
  const [ip = "", ...rest] = args.trim().split(/\s+/);
  if (!ip) {
    await sendTelegram(chatId, L(lang, "⛔ IP'ni bloklash: <code>/blok 203.0.113.7 sabab</code>\nBloklanganlar ro'yxati — /tuzoq", "⛔ Заблокировать IP: <code>/blok 203.0.113.7 причина</code>\nСписок заблокированных — /tuzoq"));
    return;
  }
  const r = await doBlock(admin, ip, rest.join(" "), lang);
  await sendTelegram(chatId, r.text, r.ok ? { keyboard: trapButton(lang) } : {});
}

/** `/blokdan <ip>` */
export async function handleAdminUnblock(chatId: string, admin: Admin, args: string, lang?: BotLang): Promise<void> {
  const ip = args.trim().split(/\s+/)[0] ?? "";
  if (!ip) {
    await sendTelegram(chatId, L(lang, "✅ Blokdan chiqarish: <code>/blokdan 203.0.113.7</code>\nBloklanganlar ro'yxati — /tuzoq", "✅ Разблокировать IP: <code>/blokdan 203.0.113.7</code>\nСписок заблокированных — /tuzoq"));
    return;
  }
  const r = await doUnblock(admin, ip, lang);
  await sendTelegram(chatId, r.text, r.ok ? { keyboard: trapButton(lang) } : {});
}

/** `adm:trap` · `adm:ipb:<ip>` · `adm:ipu:<ip>` — `handleAdminCallback` (admin tekshiruvidan KEYIN) chaqiradi. false — bizniki emas */
export async function handleAdminSecurityCallback(chatId: string, admin: Admin, data: string, answer: Answer, lang?: BotLang): Promise<boolean> {
  if (data === "adm:trap") {
    await answer("");
    await sendAdminTrap(chatId, lang);
    return true;
  }
  const m = /^adm:ip([bu]):(.{2,50})$/.exec(data);
  if (!m) return false;
  const r = m[1] === "b" ? await doBlock(admin, m[2], "", lang) : await doUnblock(admin, m[2], lang);
  await answer(r.ok ? (m[1] === "b" ? L(lang, "Bloklandi ⛔", "Заблокирован ⛔") : L(lang, "Blokdan chiqarildi ✅", "Разблокирован ✅")) : L(lang, "Bajarilmadi", "Не выполнено"));
  await sendTelegram(chatId, r.text, r.ok ? { keyboard: trapButton(lang) } : {});
  return true;
}
