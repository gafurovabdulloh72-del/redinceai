import "server-only";
import { escapeTelegramHtml, sendTelegram, telegramApi, type TelegramButton } from "@/lib/telegram";
import { createTelegramAccount, decideLoginRequest, findTelegramUser } from "@/lib/auth/telegram-login";
import { CATEGORIES_BY_GROUP, CATEGORY_BY_SLUG, CATEGORY_GROUPS } from "@/lib/categories";
import { EXPERIENCE_LEVELS, REGIONS, REGION_BY_SLUG } from "@/lib/constants";
import { normalizeUzPhone, formatUzPhone } from "@/lib/utils";
import { audit } from "@/lib/security/audit";
import { clearBotSession, getBotSession, setBotSession } from "@/lib/telegram-bot/session";
import { appUrl, menuRows, sendLinkOptions, sendWelcome } from "@/lib/telegram-bot/ui";

/**
 * BOTDA RO'YXATDAN O'TISH (2026-10-31): hisobsiz Telegram foydalanuvchisi savol-javob bilan hisob ochadi —
 * rol → ism → (mutaxassis: yo'nalish → kasb → tajriba → hudud) → telefon (ixtiyoriy) → tasdiqlash.
 * Holat `bot_sessions`da (flow="register"), tugmalar `rg:*`, matn javoblari webhook'dan `handleRegisterText`ga keladi.
 * Avtomatik «mijoz» hisobi endi OCHILMAYDI: Mini App (/api/tg/auth) va «Telegram bilan kirish» (l_<kod>) ham shu oqimga yuboradi;
 * `loginCode` bo'lsa, hisob yaratilgach kirish so'rovi tasdiqlanadi (sayt oynasi davom etadi).
 */
type Who = { name?: string; username?: string };
type Answer = (text: string) => Promise<unknown>;
interface RegData extends Record<string, unknown> {
  tgName?: string;
  tgUsername?: string;
  loginCode?: string;
  role?: "client" | "specialist";
  name?: string;
  group?: string;
  category?: string;
  experience?: "junior" | "middle" | "senior" | "expert";
  region?: string;
  phone?: string | null;
}

const CANCEL: TelegramButton = { text: "✖️ Bekor qilish", data: "rg:cancel" };
const SKIP_PHONE = "⏭ O'tkazib yuborish";
const rows = <T,>(items: T[], per: number): T[][] => items.reduce<T[][]>((acc, it, i) => ((i % per === 0 ? acc.push([it]) : acc[acc.length - 1].push(it)), acc), []);

async function edit(chatId: string, msgId: number | null, text: string): Promise<void> {
  if (!msgId) return;
  await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text, parse_mode: "HTML" }).catch(() => undefined);
}
async function load(chatId: string): Promise<RegData | null> {
  const s = await getBotSession<RegData>(chatId);
  return s?.flow === "register" ? s.data : null;
}
async function save(chatId: string, step: string, data: RegData): Promise<void> {
  await setBotSession(chatId, "register", step, data);
}

/** Boshlash: hisob bo'lsa — menyu; bo'lmasa — 1-savol (rol) */
export async function startRegistration(chatId: string, who: Who, opts: { loginCode?: string } = {}): Promise<void> {
  const found = await findTelegramUser(chatId).catch(() => null);
  if (found) {
    if (opts.loginCode) await decideLoginRequest(opts.loginCode, chatId, true, who);
    await sendTelegram(chatId, `Siz allaqachon <b>${escapeTelegramHtml(found.name)}</b> hisobi bilan ulangansiz ✅${opts.loginCode ? "\nSaytga kirish tasdiqlandi — brauzerdagi oynaga qayting." : ""}`, { replyKeyboard: menuRows() });
    return;
  }
  const data: RegData = { tgName: who.name?.slice(0, 80), tgUsername: who.username, loginCode: opts.loginCode };
  await save(chatId, "role", data);
  await sendTelegram(
    chatId,
    `📝 <b>Ro'yxatdan o'tish</b> — bir daqiqa, bir nechta savol.${opts.loginCode ? "\nSaytga kirish uchun avval hisob ochamiz, keyin kirish o'zi tasdiqlanadi." : ""}\n\n<b>Siz kimsiz?</b>`,
    {
      keyboard: [[{ text: "🧑‍💼 Mijoz — ijodkor izlayman", data: "rg:role:client" }], [{ text: "🎨 Mutaxassis — xizmat ko'rsataman", data: "rg:role:specialist" }], [CANCEL]],
    },
  );
}

async function askName(chatId: string, d: RegData): Promise<void> {
  await save(chatId, "name", d);
  await sendTelegram(chatId, "👤 <b>Ism-familiyangizni yozing</b>\nMasalan: <i>Dilnoza Karimova</i>", {
    keyboard: [...(d.tgName ? [[{ text: `✅ ${d.tgName.slice(0, 40)} — shu qolsin`, data: "rg:name:tg" }]] : []), [CANCEL]],
  });
}
async function askGroups(chatId: string, d: RegData): Promise<void> {
  await save(chatId, "group", d);
  await sendTelegram(chatId, "🎨 <b>Kasbingiz qaysi yo'nalishda?</b>", {
    keyboard: [...rows(CATEGORY_GROUPS.map((g) => ({ text: g.name, data: `rg:grp:${g.slug}` })), 2), [CANCEL]],
  });
}
async function askCategories(chatId: string, d: RegData, group: string): Promise<void> {
  const items = CATEGORIES_BY_GROUP.find((g) => g.group.slug === group)?.items ?? [];
  if (!items.length) return askGroups(chatId, d);
  await save(chatId, "category", { ...d, group });
  await sendTelegram(chatId, `🎯 <b>Kasbingizni tanlang</b> — ${escapeTelegramHtml(CATEGORY_GROUPS.find((g) => g.slug === group)?.name ?? "")}`, {
    keyboard: [...rows(items.map((c) => ({ text: c.name, data: `rg:cat:${c.slug}` })), 2), [{ text: "⬅️ Yo'nalishlar", data: "rg:groups" }, CANCEL]],
  });
}
async function askExperience(chatId: string, d: RegData): Promise<void> {
  await save(chatId, "experience", d);
  await sendTelegram(chatId, "📈 <b>Tajribangiz qancha?</b>", { keyboard: [...EXPERIENCE_LEVELS.map((l) => [{ text: l.label, data: `rg:exp:${l.value}` }]), [CANCEL]] });
}
async function askRegion(chatId: string, d: RegData): Promise<void> {
  await save(chatId, "region", d);
  await sendTelegram(chatId, "📍 <b>Qaysi hududdasiz?</b>", { keyboard: [...rows(REGIONS.map((r) => ({ text: r.short, data: `rg:reg:${r.slug}` })), 2), [CANCEL]] });
}
async function askPhone(chatId: string, d: RegData): Promise<void> {
  await save(chatId, "phone", d);
  await sendTelegram(chatId, "📱 <b>Telefon raqamingiz</b> (ixtiyoriy)\nPastdagi tugma bilan ulashing yoki yozing: <i>+998 90 123 45 67</i>. Raqam hech kimga ko'rsatilmaydi — faqat platforma uchun.", {
    replyKeyboard: [[{ text: "📱 Raqamni ulashish", requestContact: true }], [SKIP_PHONE]],
    oneTime: true,
  });
}
function summary(d: RegData): string {
  const lines = [`👤 Ism: <b>${escapeTelegramHtml(d.name ?? "")}</b>`, `🎭 Rol: <b>${d.role === "specialist" ? "Mutaxassis" : "Mijoz"}</b>`];
  if (d.role === "specialist") {
    lines.push(`🎯 Kasb: <b>${escapeTelegramHtml(CATEGORY_BY_SLUG[d.category ?? ""]?.name ?? d.category ?? "")}</b>`);
    lines.push(`📈 Tajriba: <b>${escapeTelegramHtml(EXPERIENCE_LEVELS.find((l) => l.value === d.experience)?.label ?? "")}</b>`);
    lines.push(`📍 Hudud: <b>${escapeTelegramHtml(REGION_BY_SLUG[d.region ?? ""]?.name ?? "")}</b>`);
  }
  lines.push(`📱 Telefon: <b>${d.phone ? escapeTelegramHtml(formatUzPhone(d.phone)) : "—"}</b>`);
  return lines.join("\n");
}
async function askConfirm(chatId: string, d: RegData): Promise<void> {
  await save(chatId, "confirm", d);
  await sendTelegram(chatId, `✅ <b>Tekshiring</b>\n${summary(d)}\n\nHammasi to'g'rimi? Tasdiqlasangiz hisob ochiladi (oferta va maxfiylik siyosatiga rozilik bildirgan hisoblanasiz).`, {
    keyboard: [[{ text: "✅ Tasdiqlash — hisob ochish", data: "rg:ok" }], [{ text: "✏️ Qaytadan", data: "rg:restart" }, CANCEL]],
  });
}
/** Ismdan keyingi qadam: mutaxassis — kasb; mijoz — telefon */
async function afterName(chatId: string, d: RegData): Promise<void> {
  if (d.role === "specialist") await askGroups(chatId, d);
  else await askPhone(chatId, d);
}

async function finish(chatId: string, d: RegData, who: Who): Promise<void> {
  if (!d.name || !d.role) {
    await clearBotSession(chatId);
    await sendTelegram(chatId, "Ma'lumot yetarli emas — /royxat bilan qaytadan boshlang.");
    return;
  }
  const r = await createTelegramAccount(chatId, {
    name: d.name,
    username: d.tgUsername ?? null,
    role: d.role,
    phone: d.phone ?? null,
    specialist: d.role === "specialist" && d.category && d.experience && d.region ? { category: d.category, experience: d.experience, regionSlug: d.region } : null,
  });
  await clearBotSession(chatId);
  await audit(r.userId, "register", { targetType: "user", targetId: r.userId, meta: { role: d.role, provider: "telegram_bot", isNew: r.isNew } }).catch(() => undefined);
  if (d.loginCode) await decideLoginRequest(d.loginCode, chatId, true, who).catch(() => false);
  await sendTelegram(chatId, `🎉 <b>Hisob ochildi!</b> Xush kelibsiz, ${escapeTelegramHtml(d.name)}.${d.loginCode ? "\n\nSaytga kirish tasdiqlandi — brauzerdagi oynaga qayting." : ""}`, { removeKeyboard: true });
  await sendWelcome(chatId, { id: r.userId, name: r.name, role: r.role as "client" | "specialist" | "admin" }, d.name.split(" ")[0]);
  if (d.role === "specialist") {
    const app = appUrl("/kabinet/profil");
    await sendTelegram(chatId, "🧰 Keyingi qadam — <b>profilni to'ldiring</b>: rasm, qisqa tavsif, ishlaringiz (portfolio) va narx. To'liq profil katalogda yuqoriroq chiqadi va mijozlar ko'proq yozadi.", {
      keyboard: [[app ? { text: "Profilni to'ldirish", webApp: app } : { text: "Profilni to'ldirish", data: "menu:help" }]],
    });
  }
}

/** `rg:*` tugmalari */
export async function handleRegisterCallback(chatId: string, data: string, answer: Answer, msgId: number | null, who: Who): Promise<boolean> {
  if (!data.startsWith("rg:")) return false;
  if (data === "rg:start") {
    await answer("");
    await startRegistration(chatId, who);
    return true;
  }
  if (data === "rg:have") {
    await answer("");
    const found = await findTelegramUser(chatId).catch(() => null);
    if (found) await sendTelegram(chatId, `Siz allaqachon <b>${escapeTelegramHtml(found.name)}</b> hisobi bilan ulangansiz ✅`, { replyKeyboard: menuRows() });
    else await sendLinkOptions(chatId);
    return true;
  }
  const d = await load(chatId);
  if (data === "rg:cancel") {
    await clearBotSession(chatId);
    await answer("Bekor qilindi");
    await edit(chatId, msgId, "Ro'yxatdan o'tish bekor qilindi. Istalgan vaqt /royxat bilan qaytadan boshlashingiz mumkin.");
    return true;
  }
  if (!d) {
    await answer("Oqim eskirgan — /royxat bilan qaytadan boshlang");
    return true;
  }
  await answer("");
  if (data === "rg:restart") {
    await startRegistration(chatId, who, { loginCode: d.loginCode });
    return true;
  }
  let m: RegExpExecArray | null;
  if ((m = /^rg:role:(client|specialist)$/.exec(data))) {
    const role = m[1] as "client" | "specialist";
    await edit(chatId, msgId, `Siz kimsiz? — <b>${role === "specialist" ? "Mutaxassis" : "Mijoz"}</b> ✓`);
    await askName(chatId, { ...d, role });
    return true;
  }
  if (data === "rg:name:tg" && d.tgName) {
    await edit(chatId, msgId, `Ism: <b>${escapeTelegramHtml(d.tgName)}</b> ✓`);
    await afterName(chatId, { ...d, name: d.tgName });
    return true;
  }
  if (data === "rg:groups") {
    await askGroups(chatId, d);
    return true;
  }
  if ((m = /^rg:grp:([a-z0-9-]{1,40})$/.exec(data))) {
    await edit(chatId, msgId, `Yo'nalish: <b>${escapeTelegramHtml(CATEGORY_GROUPS.find((g) => g.slug === m![1])?.name ?? m[1])}</b> ✓`);
    await askCategories(chatId, d, m[1]);
    return true;
  }
  if ((m = /^rg:cat:([a-z0-9-]{1,60})$/.exec(data)) && CATEGORY_BY_SLUG[m[1]]) {
    await edit(chatId, msgId, `Kasb: <b>${escapeTelegramHtml(CATEGORY_BY_SLUG[m[1]].name)}</b> ✓`);
    await askExperience(chatId, { ...d, category: m[1] });
    return true;
  }
  if ((m = /^rg:exp:(junior|middle|senior|expert)$/.exec(data))) {
    await edit(chatId, msgId, `Tajriba: <b>${escapeTelegramHtml(EXPERIENCE_LEVELS.find((l) => l.value === m![1])?.label ?? m[1])}</b> ✓`);
    await askRegion(chatId, { ...d, experience: m[1] as RegData["experience"] });
    return true;
  }
  if ((m = /^rg:reg:([a-z0-9-]{1,40})$/.exec(data)) && REGION_BY_SLUG[m[1]]) {
    await edit(chatId, msgId, `Hudud: <b>${escapeTelegramHtml(REGION_BY_SLUG[m[1]].name)}</b> ✓`);
    await askPhone(chatId, { ...d, region: m[1] });
    return true;
  }
  if (data === "rg:ok") {
    await edit(chatId, msgId, `${summary(d)}\n\n<b>Tasdiqlandi ✓</b>`);
    try {
      await finish(chatId, d, who);
    } catch (e) {
      console.error("[telegram:register]", e);
      await sendTelegram(chatId, "⚠️ Hisob ochilmadi — birozdan keyin /royxat bilan qayta urinib ko'ring yoki saytdan ro'yxatdan o'ting.");
    }
    return true;
  }
  await sendTelegram(chatId, "Tugmalardan birini tanlang 👆");
  return true;
}

/** Matnli javob (ism, telefon) — faqat faol ro'yxat oqimida; `true` — qabul qilindi */
export async function handleRegisterText(chatId: string, text: string): Promise<boolean> {
  const s = await getBotSession<RegData>(chatId);
  if (!s || s.flow !== "register") return false;
  const d = s.data;
  if (s.step === "name") {
    const name = text.replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 60 || /https?:\/\/|@|\d{5,}/.test(name)) {
      await sendTelegram(chatId, "Ism 2–60 belgi bo'lsin, havola va raqamlarsiz. Qaytadan yozing:");
      return true;
    }
    await afterName(chatId, { ...d, name });
    return true;
  }
  if (s.step === "phone") {
    if (text === SKIP_PHONE || /^o'?tkazib/i.test(text)) {
      await askConfirm(chatId, { ...d, phone: null });
      return true;
    }
    const phone = normalizeUzPhone(text);
    if (!phone) {
      await sendTelegram(chatId, "Raqam tushunarsiz. Ko'rinishi: <i>+998 90 123 45 67</i> — yoki pastdagi «Raqamni ulashish» tugmasini bosing, yoki «O'tkazib yuborish».");
      return true;
    }
    await askConfirm(chatId, { ...d, phone });
    return true;
  }
  if (s.step === "confirm") {
    await sendTelegram(chatId, "Yuqoridagi xabarda «Tasdiqlash» yoki «Qaytadan» tugmasini bosing 👆");
    return true;
  }
  await sendTelegram(chatId, "Tugmalardan birini tanlang 👆 (bekor qilish — /start)");
  return true;
}

/** Telegram «kontakt ulashish» (request_contact) — faqat o'z raqami qabul qilinadi */
export async function handleRegisterContact(chatId: string, contact: { phone_number?: unknown; user_id?: unknown }, fromId: string): Promise<boolean> {
  const s = await getBotSession<RegData>(chatId);
  if (!s || s.flow !== "register" || s.step !== "phone") return false;
  const ownerId = contact.user_id != null ? String(contact.user_id) : "";
  const raw = typeof contact.phone_number === "string" ? contact.phone_number : "";
  if (ownerId !== fromId || !raw) {
    await sendTelegram(chatId, "Faqat o'z raqamingizni ulashing (pastdagi tugma orqali) yoki qo'lda yozing.");
    return true;
  }
  const phone = normalizeUzPhone(raw) ?? (raw.startsWith("+") ? raw : `+${raw}`).replace(/[^\d+]/g, "");
  await askConfirm(chatId, { ...s.data, phone });
  return true;
}
