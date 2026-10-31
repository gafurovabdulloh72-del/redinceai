import "server-only";
import { escapeTelegramHtml, sendTelegram, telegramApi, type TelegramButton } from "@/lib/telegram";
import { createTelegramAccount, decideLoginRequest, findTelegramUser } from "@/lib/auth/telegram-login";
import { CATEGORIES_BY_GROUP, CATEGORY_BY_SLUG, CATEGORY_GROUPS } from "@/lib/categories";
import { EXPERIENCE_LEVELS, REGIONS, REGION_BY_SLUG } from "@/lib/constants";
import { normalizeUzPhone, formatUzPhone } from "@/lib/utils";
import { audit } from "@/lib/security/audit";
import { clearBotSession, getBotSession, setBotSession } from "@/lib/telegram-bot/session";
import { appUrl, menuRows, sendLinkOptions, sendWelcome } from "@/lib/telegram-bot/ui";
import { L, type BotLang } from "@/lib/telegram-bot/lang";

/**
 * BOTDA RO'YXATDAN O'TISH (2026-10-31): hisobsiz Telegram foydalanuvchisi savol-javob bilan hisob ochadi —
 * rol → ism → (mutaxassis: yo'nalish → kasb → tajriba → hudud) → telefon (ixtiyoriy) → tasdiqlash.
 * Holat `bot_sessions`da (flow="register"), tugmalar `rg:*`, matn javoblari webhook'dan `handleRegisterText`ga keladi.
 * Avtomatik «mijoz» hisobi endi OCHILMAYDI: Mini App (/api/tg/auth) va «Telegram bilan kirish» (l_<kod>) ham shu oqimga yuboradi;
 * `loginCode` bo'lsa, hisob yaratilgach kirish so'rovi tasdiqlanadi (sayt oynasi davom etadi).
 */
type Who = { name?: string; username?: string; lang?: BotLang };
type Answer = (text: string) => Promise<unknown>;
interface RegData extends Record<string, unknown> {
  lang?: BotLang;
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

const CANCEL = (lang?: BotLang): TelegramButton => ({ text: L(lang, "✖️ Bekor qilish", "✖️ Отмена"), data: "rg:cancel" });
const SKIP_PHONE = "⏭ O'tkazib yuborish";
const SKIP_PHONE_RU = "⏭ Пропустить";
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
  const lang = who.lang;
  const found = await findTelegramUser(chatId).catch(() => null);
  if (found) {
    if (opts.loginCode) await decideLoginRequest(opts.loginCode, chatId, true, who);
    await sendTelegram(
      chatId,
      L(lang, `Siz allaqachon <b>${escapeTelegramHtml(found.name)}</b> hisobi bilan ulangansiz ✅${opts.loginCode ? "\nSaytga kirish tasdiqlandi — brauzerdagi oynaga qayting." : ""}`, `Вы уже привязаны к аккаунту <b>${escapeTelegramHtml(found.name)}</b> ✅${opts.loginCode ? "\nВход на сайт подтверждён — вернитесь в окно браузера." : ""}`),
      { replyKeyboard: menuRows(false, lang) },
    );
    return;
  }
  const data: RegData = { lang, tgName: who.name?.slice(0, 80), tgUsername: who.username, loginCode: opts.loginCode };
  await save(chatId, "role", data);
  await sendTelegram(
    chatId,
    L(
      lang,
      `📝 <b>Ro'yxatdan o'tish</b> — bir daqiqa, bir nechta savol.${opts.loginCode ? "\nSaytga kirish uchun avval hisob ochamiz, keyin kirish o'zi tasdiqlanadi." : ""}\n\n<b>Siz kimsiz?</b>`,
      `📝 <b>Регистрация</b> — одна минута, несколько вопросов.${opts.loginCode ? "\nСначала создадим аккаунт, затем вход на сайт подтвердится автоматически." : ""}\n\n<b>Кто вы?</b>`,
    ),
    {
      keyboard: [[{ text: L(lang, "🧑‍💼 Mijoz — ijodkor izlayman", "🧑‍💼 Клиент — ищу специалиста"), data: "rg:role:client" }], [{ text: L(lang, "🎨 Mutaxassis — xizmat ko'rsataman", "🎨 Специалист — оказываю услуги"), data: "rg:role:specialist" }], [CANCEL(lang)]],
    },
  );
}

const EXP_RU: Record<string, string> = { junior: "Начинающий (до 1 года)", middle: "Средний (1–3 года)", senior: "Опытный (3–6 лет)", expert: "Эксперт (6+ лет)" };
const expLabel = (lang: BotLang | undefined, v: string) => (lang === "ru" ? (EXP_RU[v] ?? v) : (EXPERIENCE_LEVELS.find((l) => l.value === v)?.label ?? v));

async function askName(chatId: string, d: RegData): Promise<void> {
  await save(chatId, "name", d);
  await sendTelegram(chatId, L(d.lang, "👤 <b>Ism-familiyangizni yozing</b>\nMasalan: <i>Dilnoza Karimova</i>", "👤 <b>Напишите имя и фамилию</b>\nНапример: <i>Дилноза Каримова</i>"), {
    keyboard: [...(d.tgName ? [[{ text: L(d.lang, `✅ ${d.tgName.slice(0, 40)} — shu qolsin`, `✅ ${d.tgName.slice(0, 40)} — оставить`), data: "rg:name:tg" }]] : []), [CANCEL(d.lang)]],
  });
}
async function askGroups(chatId: string, d: RegData): Promise<void> {
  await save(chatId, "group", d);
  await sendTelegram(chatId, L(d.lang, "🎨 <b>Kasbingiz qaysi yo'nalishda?</b>", "🎨 <b>В каком направлении ваша профессия?</b>"), {
    keyboard: [...rows(CATEGORY_GROUPS.map((g) => ({ text: g.name, data: `rg:grp:${g.slug}` })), 2), [CANCEL(d.lang)]],
  });
}
async function askCategories(chatId: string, d: RegData, group: string): Promise<void> {
  const items = CATEGORIES_BY_GROUP.find((g) => g.group.slug === group)?.items ?? [];
  if (!items.length) return askGroups(chatId, d);
  await save(chatId, "category", { ...d, group });
  await sendTelegram(chatId, `${L(d.lang, "🎯 <b>Kasbingizni tanlang</b>", "🎯 <b>Выберите профессию</b>")} — ${escapeTelegramHtml(CATEGORY_GROUPS.find((g) => g.slug === group)?.name ?? "")}`, {
    keyboard: [...rows(items.map((c) => ({ text: c.name, data: `rg:cat:${c.slug}` })), 2), [{ text: L(d.lang, "⬅️ Yo'nalishlar", "⬅️ Направления"), data: "rg:groups" }, CANCEL(d.lang)]],
  });
}
async function askExperience(chatId: string, d: RegData): Promise<void> {
  await save(chatId, "experience", d);
  await sendTelegram(chatId, L(d.lang, "📈 <b>Tajribangiz qancha?</b>", "📈 <b>Какой у вас опыт?</b>"), { keyboard: [...EXPERIENCE_LEVELS.map((l) => [{ text: expLabel(d.lang, l.value), data: `rg:exp:${l.value}` }]), [CANCEL(d.lang)]] });
}
async function askRegion(chatId: string, d: RegData): Promise<void> {
  await save(chatId, "region", d);
  await sendTelegram(chatId, L(d.lang, "📍 <b>Qaysi hududdasiz?</b>", "📍 <b>В каком регионе вы находитесь?</b>"), { keyboard: [...rows(REGIONS.map((r) => ({ text: r.short, data: `rg:reg:${r.slug}` })), 2), [CANCEL(d.lang)]] });
}
async function askPhone(chatId: string, d: RegData): Promise<void> {
  await save(chatId, "phone", d);
  await sendTelegram(
    chatId,
    L(d.lang, "📱 <b>Telefon raqamingiz</b> (ixtiyoriy)\nPastdagi tugma bilan ulashing yoki yozing: <i>+998 90 123 45 67</i>. Raqam hech kimga ko'rsatilmaydi — faqat platforma uchun.", "📱 <b>Ваш номер телефона</b> (необязательно)\nПоделитесь кнопкой ниже или напишите: <i>+998 90 123 45 67</i>. Номер никому не показывается — только для платформы."),
    {
      replyKeyboard: [[{ text: L(d.lang, "📱 Raqamni ulashish", "📱 Поделиться номером"), requestContact: true }], [d.lang === "ru" ? SKIP_PHONE_RU : SKIP_PHONE]],
      oneTime: true,
    },
  );
}
function summary(d: RegData): string {
  const ru = d.lang === "ru";
  const lines = [`👤 ${ru ? "Имя" : "Ism"}: <b>${escapeTelegramHtml(d.name ?? "")}</b>`, `🎭 ${ru ? "Роль" : "Rol"}: <b>${d.role === "specialist" ? (ru ? "Специалист" : "Mutaxassis") : ru ? "Клиент" : "Mijoz"}</b>`];
  if (d.role === "specialist") {
    lines.push(`🎯 ${ru ? "Профессия" : "Kasb"}: <b>${escapeTelegramHtml(CATEGORY_BY_SLUG[d.category ?? ""]?.name ?? d.category ?? "")}</b>`);
    lines.push(`📈 ${ru ? "Опыт" : "Tajriba"}: <b>${escapeTelegramHtml(expLabel(d.lang, d.experience ?? ""))}</b>`);
    lines.push(`📍 ${ru ? "Регион" : "Hudud"}: <b>${escapeTelegramHtml(REGION_BY_SLUG[d.region ?? ""]?.name ?? "")}</b>`);
  }
  lines.push(`📱 ${ru ? "Телефон" : "Telefon"}: <b>${d.phone ? escapeTelegramHtml(formatUzPhone(d.phone)) : "—"}</b>`);
  return lines.join("\n");
}
async function askConfirm(chatId: string, d: RegData): Promise<void> {
  await save(chatId, "confirm", d);
  await sendTelegram(
    chatId,
    L(d.lang, `✅ <b>Tekshiring</b>\n${summary(d)}\n\nHammasi to'g'rimi? Tasdiqlasangiz hisob ochiladi (oferta va maxfiylik siyosatiga rozilik bildirgan hisoblanasiz).`, `✅ <b>Проверьте</b>\n${summary(d)}\n\nВсё верно? После подтверждения аккаунт будет создан (вы соглашаетесь с офертой и политикой конфиденциальности).`),
    {
      keyboard: [[{ text: L(d.lang, "✅ Tasdiqlash — hisob ochish", "✅ Подтвердить — создать аккаунт"), data: "rg:ok" }], [{ text: L(d.lang, "✏️ Qaytadan", "✏️ Заново"), data: "rg:restart" }, CANCEL(d.lang)]],
    },
  );
}
/** Ismdan keyingi qadam: mutaxassis — kasb; mijoz — telefon */
async function afterName(chatId: string, d: RegData): Promise<void> {
  if (d.role === "specialist") await askGroups(chatId, d);
  else await askPhone(chatId, d);
}

async function finish(chatId: string, d: RegData, who: Who): Promise<void> {
  if (!d.name || !d.role) {
    await clearBotSession(chatId);
    await sendTelegram(chatId, L(d.lang, "Ma'lumot yetarli emas — /royxat bilan qaytadan boshlang.", "Недостаточно данных — начните заново: /royxat."));
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
  await sendTelegram(chatId, L(d.lang, `🎉 <b>Hisob ochildi!</b> Xush kelibsiz, ${escapeTelegramHtml(d.name)}.${d.loginCode ? "\n\nSaytga kirish tasdiqlandi — brauzerdagi oynaga qayting." : ""}`, `🎉 <b>Аккаунт создан!</b> Добро пожаловать, ${escapeTelegramHtml(d.name)}.${d.loginCode ? "\n\nВход на сайт подтверждён — вернитесь в окно браузера." : ""}`), { removeKeyboard: true });
  await sendWelcome(chatId, { id: r.userId, name: r.name, role: r.role as "client" | "specialist" | "admin" }, d.name.split(" ")[0], d.lang);
  if (d.role === "specialist") {
    const app = appUrl("/kabinet/profil");
    const t = L(d.lang, "Profilni to'ldirish", "Заполнить профиль");
    await sendTelegram(chatId, L(d.lang, "🧰 Keyingi qadam — <b>profilni to'ldiring</b>: rasm, qisqa tavsif, ishlaringiz (portfolio) va narx. To'liq profil katalogda yuqoriroq chiqadi va mijozlar ko'proq yozadi.", "🧰 Следующий шаг — <b>заполните профиль</b>: фото, короткое описание, работы (портфолио) и цену. Полный профиль выше в каталоге, и клиенты пишут чаще."), {
      keyboard: [[app ? { text: t, webApp: app } : { text: t, data: "menu:help" }]],
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
    if (found) await sendTelegram(chatId, L(who.lang, `Siz allaqachon <b>${escapeTelegramHtml(found.name)}</b> hisobi bilan ulangansiz ✅`, `Вы уже привязаны к аккаунту <b>${escapeTelegramHtml(found.name)}</b> ✅`), { replyKeyboard: menuRows(false, who.lang) });
    else await sendLinkOptions(chatId, who.lang);
    return true;
  }
  const d = await load(chatId);
  const lang = d?.lang ?? who.lang;
  if (data === "rg:cancel") {
    await clearBotSession(chatId);
    await answer(L(lang, "Bekor qilindi", "Отменено"));
    await edit(chatId, msgId, L(lang, "Ro'yxatdan o'tish bekor qilindi. Istalgan vaqt /royxat bilan qaytadan boshlashingiz mumkin.", "Регистрация отменена. В любой момент можно начать заново: /royxat."));
    return true;
  }
  if (!d) {
    await answer(L(lang, "Oqim eskirgan — /royxat bilan qaytadan boshlang", "Сессия устарела — начните заново: /royxat"));
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
    await edit(chatId, msgId, `${L(lang, "Siz kimsiz?", "Кто вы?")} — <b>${role === "specialist" ? L(lang, "Mutaxassis", "Специалист") : L(lang, "Mijoz", "Клиент")}</b> ✓`);
    await askName(chatId, { ...d, role });
    return true;
  }
  if (data === "rg:name:tg" && d.tgName) {
    await edit(chatId, msgId, `${L(lang, "Ism", "Имя")}: <b>${escapeTelegramHtml(d.tgName)}</b> ✓`);
    await afterName(chatId, { ...d, name: d.tgName });
    return true;
  }
  if (data === "rg:groups") {
    await askGroups(chatId, d);
    return true;
  }
  if ((m = /^rg:grp:([a-z0-9-]{1,40})$/.exec(data))) {
    await edit(chatId, msgId, `${L(lang, "Yo'nalish", "Направление")}: <b>${escapeTelegramHtml(CATEGORY_GROUPS.find((g) => g.slug === m![1])?.name ?? m[1])}</b> ✓`);
    await askCategories(chatId, d, m[1]);
    return true;
  }
  if ((m = /^rg:cat:([a-z0-9-]{1,60})$/.exec(data)) && CATEGORY_BY_SLUG[m[1]]) {
    await edit(chatId, msgId, `${L(lang, "Kasb", "Профессия")}: <b>${escapeTelegramHtml(CATEGORY_BY_SLUG[m[1]].name)}</b> ✓`);
    await askExperience(chatId, { ...d, category: m[1] });
    return true;
  }
  if ((m = /^rg:exp:(junior|middle|senior|expert)$/.exec(data))) {
    await edit(chatId, msgId, `${L(lang, "Tajriba", "Опыт")}: <b>${escapeTelegramHtml(expLabel(lang, m[1]))}</b> ✓`);
    await askRegion(chatId, { ...d, experience: m[1] as RegData["experience"] });
    return true;
  }
  if ((m = /^rg:reg:([a-z0-9-]{1,40})$/.exec(data)) && REGION_BY_SLUG[m[1]]) {
    await edit(chatId, msgId, `${L(lang, "Hudud", "Регион")}: <b>${escapeTelegramHtml(REGION_BY_SLUG[m[1]].name)}</b> ✓`);
    await askPhone(chatId, { ...d, region: m[1] });
    return true;
  }
  if (data === "rg:ok") {
    await edit(chatId, msgId, `${summary(d)}\n\n<b>${L(lang, "Tasdiqlandi ✓", "Подтверждено ✓")}</b>`);
    try {
      await finish(chatId, d, who);
    } catch (e) {
      console.error("[telegram:register]", e);
      await sendTelegram(chatId, L(lang, "⚠️ Hisob ochilmadi — birozdan keyin /royxat bilan qayta urinib ko'ring yoki saytdan ro'yxatdan o'ting.", "⚠️ Не удалось создать аккаунт — попробуйте позже (/royxat) или зарегистрируйтесь на сайте."));
    }
    return true;
  }
  await sendTelegram(chatId, L(lang, "Tugmalardan birini tanlang 👆", "Выберите один из вариантов 👆"));
  return true;
}

/** Matnli javob (ism, telefon) — faqat faol ro'yxat oqimida; `true` — qabul qilindi */
export async function handleRegisterText(chatId: string, text: string): Promise<boolean> {
  const s = await getBotSession<RegData>(chatId);
  if (!s || s.flow !== "register") return false;
  const d = s.data;
  const lang = d.lang;
  if (s.step === "name") {
    const name = text.replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 60 || /https?:\/\/|@|\d{5,}/.test(name)) {
      await sendTelegram(chatId, L(lang, "Ism 2–60 belgi bo'lsin, havola va raqamlarsiz. Qaytadan yozing:", "Имя — от 2 до 60 символов, без ссылок и цифр. Напишите ещё раз:"));
      return true;
    }
    await afterName(chatId, { ...d, name });
    return true;
  }
  if (s.step === "phone") {
    if (text === SKIP_PHONE || text === SKIP_PHONE_RU || /^o'?tkazib|^пропус/i.test(text)) {
      await askConfirm(chatId, { ...d, phone: null });
      return true;
    }
    const phone = normalizeUzPhone(text);
    if (!phone) {
      await sendTelegram(chatId, L(lang, "Raqam tushunarsiz. Ko'rinishi: <i>+998 90 123 45 67</i> — yoki pastdagi «Raqamni ulashish» tugmasini bosing, yoki «O'tkazib yuborish».", "Номер не распознан. Формат: <i>+998 90 123 45 67</i> — или нажмите «Поделиться номером», или «Пропустить»."));
      return true;
    }
    await askConfirm(chatId, { ...d, phone });
    return true;
  }
  if (s.step === "confirm") {
    await sendTelegram(chatId, L(lang, "Yuqoridagi xabarda «Tasdiqlash» yoki «Qaytadan» tugmasini bosing 👆", "Нажмите «Подтвердить» или «Заново» в сообщении выше 👆"));
    return true;
  }
  await sendTelegram(chatId, L(lang, "Tugmalardan birini tanlang 👆 (bekor qilish — /start)", "Выберите вариант кнопкой 👆 (отмена — /start)"));
  return true;
}

/** Telegram «kontakt ulashish» (request_contact) — faqat o'z raqami qabul qilinadi */
export async function handleRegisterContact(chatId: string, contact: { phone_number?: unknown; user_id?: unknown }, fromId: string): Promise<boolean> {
  const s = await getBotSession<RegData>(chatId);
  if (!s || s.flow !== "register" || s.step !== "phone") return false;
  const ownerId = contact.user_id != null ? String(contact.user_id) : "";
  const raw = typeof contact.phone_number === "string" ? contact.phone_number : "";
  if (ownerId !== fromId || !raw) {
    await sendTelegram(chatId, L(s.data.lang, "Faqat o'z raqamingizni ulashing (pastdagi tugma orqali) yoki qo'lda yozing.", "Поделитесь только своим номером (кнопкой ниже) или напишите вручную."));
    return true;
  }
  const phone = normalizeUzPhone(raw) ?? (raw.startsWith("+") ? raw : `+${raw}`).replace(/[^\d+]/g, "");
  await askConfirm(chatId, { ...s.data, phone });
  return true;
}
