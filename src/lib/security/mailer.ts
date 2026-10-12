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

export function passwordResetMail(to: string, name: string, link: string): MailMessage {
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link);
  const text = [
    `Salom, ${name}!`,
    "",
    "Redince hisobingiz uchun parolni tiklash so'rovi keldi. Yangi parol o'rnatish uchun havolani oching (1 soat amal qiladi):",
    link,
    "",
    "Agar bu siz bo'lmasangiz, xatni e'tiborsiz qoldiring — parol o'zgarmaydi.",
  ].join("\n");
  const html = `<!doctype html><html lang="uz"><body style="margin:0;background:#f6f4ee;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#121213">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <p style="font-size:18px;font-weight:700;margin:0 0 20px">Redince<span style="color:#ff5a36">.</span></p>
  <div style="background:#fff;border:1px solid rgba(18,18,19,.08);border-radius:20px;padding:28px">
    <p style="font-size:20px;font-weight:700;margin:0 0 12px">Parolni tiklash</p>
    <p style="margin:0 0 18px;line-height:1.55;color:#4b4a47">Salom, ${safeName}! Hisobingiz uchun parolni tiklash so'rovi keldi. Yangi parol o'rnatish uchun tugmani bosing — havola <b>1 soat</b> amal qiladi.</p>
    <p style="margin:0 0 20px"><a href="${safeLink}" style="display:inline-block;background:#121213;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">Yangi parol o'rnatish</a></p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:#7d7b75">Tugma ishlamasa, havolani nusxalang: <a href="${safeLink}" style="color:#ff5a36;word-break:break-all">${safeLink}</a><br>Agar bu siz bo'lmasangiz, xatni e'tiborsiz qoldiring — parol o'zgarmaydi.</p>
  </div>
</div></body></html>`;
  return { to, subject: "Redince — parolni tiklash", html, text };
}

/** Email tasdiqlash kodi (6 xonali, 15 daqiqa) */
export function emailVerifyMail(to: string, name: string, code: string): MailMessage {
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(code);
  const text = [
    `Salom, ${name}!`,
    "",
    "Redince'da emailingizni tasdiqlash kodi (15 daqiqa amal qiladi):",
    code,
    "",
    "Kodni Kabinet → Xavfsizlik sahifasiga kiriting. Agar bu siz bo'lmasangiz, xatni e'tiborsiz qoldiring.",
  ].join("\n");
  const html = `<!doctype html><html lang="uz"><body style="margin:0;background:#f6f4ee;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#121213">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <p style="font-size:18px;font-weight:700;margin:0 0 20px">Redince<span style="color:#ff5a36">.</span></p>
  <div style="background:#fff;border:1px solid rgba(18,18,19,.08);border-radius:20px;padding:28px">
    <p style="font-size:20px;font-weight:700;margin:0 0 12px">Emailni tasdiqlash</p>
    <p style="margin:0 0 18px;line-height:1.55;color:#4b4a47">Salom, ${safeName}! Emailingizni tasdiqlash uchun quyidagi kodni Kabinet → Xavfsizlik sahifasiga kiriting. Kod <b>15 daqiqa</b> amal qiladi.</p>
    <p style="margin:0 0 20px;font-size:32px;font-weight:700;letter-spacing:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${safeCode}</p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:#7d7b75">Agar bu siz bo'lmasangiz, xatni e'tiborsiz qoldiring — hisobingiz o'zgarmaydi.</p>
  </div>
</div></body></html>`;
  return { to, subject: `Redince — tasdiqlash kodi: ${code}`, html, text };
}
