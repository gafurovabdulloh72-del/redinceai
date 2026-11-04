import "server-only";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/**
 * Email yuborish: RESEND_API_KEY + MAIL_FROM bo'lsa Resend REST API orqali (kutubxonasiz),
 * aks holda dev rejimida xat matni server konsoliga chiqadi (productionda jim o'tkaziladi).
 */
export async function sendMail(msg: MailMessage): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[mail] (RESEND_API_KEY/MAIL_FROM yo'q — konsolga)\n  To: ${msg.to}\n  Subject: ${msg.subject}\n${msg.text.split("\n").map((l) => `  ${l}`).join("\n")}\n`);
    }
    return { sent: false, reason: "not_configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) {
      console.error("[mail] Resend xatosi", res.status, await res.text().catch(() => ""));
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("[mail]", e);
    return { sent: false, reason: "network" };
  }
}

export interface BrandedMailInput {
  to: string;
  /** Xat mavzusi va sarlavhasi */
  title: string;
  /** Salomlashish uchun ism */
  name: string;
  body?: string | null;
  /** Mutlaq havola (https://…) — "Batafsil" tugmasi */
  link?: string | null;
  ctaLabel?: string;
  /** Pastki izoh (masalan, bildirishnomalarni qanday o'chirish) */
  footer?: string;
  /** Xat tili (users.lang): salomlashish, tugma, pastki yozuv — aniq {uz, ru} juftliklari (MAIL_CHROME) */
  lang?: MailLang;
}

export type MailLang = "uz" | "ru";
/** Xat «qobig'i» matnlari — ikki tilda aniq yozilgan (avto-tarjima EMAS) */
export const MAIL_CHROME = {
  hello: { uz: (name: string) => `Salom, ${name}!`, ru: (name: string) => `Здравствуйте, ${name}!` },
  cta: { uz: "Batafsil", ru: "Подробнее" },
  tagline: { uz: "Kasb Egalari — O'zbekistonning ijodiy mutaxassislar platformasi", ru: "Kasb Egalari — платформа творческих специалистов Узбекистана" },
  sign: { uz: "— Kasb Egalari", ru: "— Kasb Egalari" },
} as const;

/** Brendlangan oddiy xat (bildirishnomalar uchun): sarlavha, matn, tugma, izoh — HTML + matn ko'rinishi */
export function brandedMail({ to, title, name, body, link, ctaLabel, footer, lang = "uz" }: BrandedMailInput): MailMessage {
  const cta = ctaLabel ?? MAIL_CHROME.cta[lang];
  const hello = MAIL_CHROME.hello[lang](name);
  const text = [hello, "", title, body ?? "", link ? `\n${cta}: ${link}` : "", "", footer ? `— ${footer}` : MAIL_CHROME.sign[lang]].join("\n");
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f6f4ee;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#121213">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <p style="font-size:18px;font-weight:700;margin:0 0 20px">Kasb Egalari<span style="color:#ff5a36">.</span></p>
  <div style="background:#fff;border:1px solid rgba(18,18,19,.08);border-radius:20px;padding:28px">
    <p style="font-size:20px;font-weight:700;margin:0 0 12px;line-height:1.3">${escapeHtml(title)}</p>
    <p style="margin:0 0 18px;line-height:1.55;color:#4b4a47">${escapeHtml(hello)}${body ? ` ${escapeHtml(body)}` : ""}</p>
    ${link ? `<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#121213;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${escapeHtml(cta)}</a></p>` : ""}
    ${footer ? `<p style="margin:0;font-size:12px;line-height:1.5;color:#7d7b75">${escapeHtml(footer)}</p>` : ""}
  </div>
  <p style="margin:16px 0 0;font-size:11px;color:#9a978f;text-align:center">${escapeHtml(MAIL_CHROME.tagline[lang])}</p>
</div></body></html>`;
  return { to, subject: `Kasb Egalari — ${title}`, html, text };
}

/** Parolni tiklash xati — matnlar ikki tilda aniq (users.lang bo'yicha) */
const RESET_T = {
  uz: { subject: "Kasb Egalari — parolni tiklash", title: "Parolni tiklash", intro: "Kasb Egalari hisobingiz uchun parolni tiklash so'rovi keldi. Yangi parol o'rnatish uchun havolani oching (1 soat amal qiladi):", lead: "Hisobingiz uchun parolni tiklash so'rovi keldi. Yangi parol o'rnatish uchun tugmani bosing — havola <b>1 soat</b> amal qiladi.", button: "Yangi parol o'rnatish", copy: "Tugma ishlamasa, havolani nusxalang:", notYou: "Agar bu siz bo'lmasangiz, xatni e'tiborsiz qoldiring — parol o'zgarmaydi." },
  ru: { subject: "Kasb Egalari — восстановление пароля", title: "Восстановление пароля", intro: "Поступил запрос на восстановление пароля для вашего аккаунта Kasb Egalari. Чтобы задать новый пароль, откройте ссылку (действует 1 час):", lead: "Поступил запрос на восстановление пароля для вашего аккаунта. Нажмите кнопку, чтобы задать новый пароль — ссылка действует <b>1 час</b>.", button: "Задать новый пароль", copy: "Если кнопка не работает, скопируйте ссылку:", notYou: "Если это не вы, просто проигнорируйте письмо — пароль не изменится." },
} as const;

export function passwordResetMail(to: string, name: string, link: string, lang: MailLang = "uz"): MailMessage {
  const t = RESET_T[lang];
  const hello = MAIL_CHROME.hello[lang](name);
  const safeLink = escapeHtml(link);
  const text = [hello, "", t.intro, link, "", t.notYou].join("\n");
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f6f4ee;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#121213">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <p style="font-size:18px;font-weight:700;margin:0 0 20px">Kasb Egalari<span style="color:#ff5a36">.</span></p>
  <div style="background:#fff;border:1px solid rgba(18,18,19,.08);border-radius:20px;padding:28px">
    <p style="font-size:20px;font-weight:700;margin:0 0 12px">${t.title}</p>
    <p style="margin:0 0 18px;line-height:1.55;color:#4b4a47">${escapeHtml(hello)} ${t.lead}</p>
    <p style="margin:0 0 20px"><a href="${safeLink}" style="display:inline-block;background:#121213;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${t.button}</a></p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:#7d7b75">${t.copy} <a href="${safeLink}" style="color:#ff5a36;word-break:break-all">${safeLink}</a><br>${t.notYou}</p>
  </div>
</div></body></html>`;
  return { to, subject: t.subject, html, text };
}

/** Email tasdiqlash kodi (6 xonali, 15 daqiqa) */
const VERIFY_T = {
  uz: { subject: (code: string) => `Kasb Egalari — tasdiqlash kodi: ${code}`, title: "Emailni tasdiqlash", intro: "Kasb Egalari saytida emailingizni tasdiqlash kodi (15 daqiqa amal qiladi):", outro: "Kodni Kabinet → Xavfsizlik sahifasiga kiriting. Agar bu siz bo'lmasangiz, xatni e'tiborsiz qoldiring.", lead: "Emailingizni tasdiqlash uchun quyidagi kodni Kabinet → Xavfsizlik sahifasiga kiriting. Kod <b>15 daqiqa</b> amal qiladi.", notYou: "Agar bu siz bo'lmasangiz, xatni e'tiborsiz qoldiring — hisobingiz o'zgarmaydi." },
  ru: { subject: (code: string) => `Kasb Egalari — код подтверждения: ${code}`, title: "Подтверждение email", intro: "Код подтверждения вашего email на Kasb Egalari (действует 15 минут):", outro: "Введите код на странице Кабинет → Безопасность. Если это не вы, проигнорируйте письмо.", lead: "Чтобы подтвердить email, введите код ниже на странице Кабинет → Безопасность. Код действует <b>15 минут</b>.", notYou: "Если это не вы, просто проигнорируйте письмо — аккаунт не изменится." },
} as const;

export function emailVerifyMail(to: string, name: string, code: string, lang: MailLang = "uz"): MailMessage {
  const t = VERIFY_T[lang];
  const hello = MAIL_CHROME.hello[lang](name);
  const safeCode = escapeHtml(code);
  const text = [hello, "", t.intro, code, "", t.outro].join("\n");
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f6f4ee;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#121213">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <p style="font-size:18px;font-weight:700;margin:0 0 20px">Kasb Egalari<span style="color:#ff5a36">.</span></p>
  <div style="background:#fff;border:1px solid rgba(18,18,19,.08);border-radius:20px;padding:28px">
    <p style="font-size:20px;font-weight:700;margin:0 0 12px">${t.title}</p>
    <p style="margin:0 0 18px;line-height:1.55;color:#4b4a47">${escapeHtml(hello)} ${t.lead}</p>
    <p style="margin:0 0 20px;font-size:32px;font-weight:700;letter-spacing:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${safeCode}</p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:#7d7b75">${t.notYou}</p>
  </div>
</div></body></html>`;
  return { to, subject: t.subject(code), html, text };
}
