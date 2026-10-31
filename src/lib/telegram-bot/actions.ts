import "server-only";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, specialists, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { escapeTelegramHtml, sendTelegram, telegramApi } from "@/lib/telegram";
import { decideLoginRequest, findLoginRequest } from "@/lib/auth/telegram-login";
import { siteUrl } from "@/lib/security/site";
import { formatPrice } from "@/lib/utils";
import { REGION_BY_SLUG } from "@/lib/constants";
import { NOTIFY_GROUP_KEYS, type NotifyGroupKey } from "@/lib/notifications";
import { SETTINGS_TEXT, appUrl, sendNotLinked, settingsKeyboard } from "@/lib/telegram-bot/ui";

/**
 * Botdagi tezkor amallar (Telegram tarafi):
 *  - «Telegram bilan kirish» tasdiqlash: `/start l_<kod>` → `lg:ok|no:<kod>`
 *  - Buyurtmani bir bosishda qabul qilish / rad etish: `ord:ok|no:<id>`
 *  - `/buyurtmalarim` — ochiq buyurtmalar ro'yxati (tugmalar bilan)
 *
 * QOIDA: har bir amal chatga ulangan hisob huquqi bilan tekshiriladi — tugma havolasi
 * boshqa odamga tushsa ham ish bajarilmaydi.
 */

type Answer = (text: string) => Promise<unknown>;

/** Chatga ulangan hisob (yo'q bo'lsa null) */
export async function accountOf(chatId: string) {
  return db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, name: true, role: true, isBanned: true, email: true, username: true, createdAt: true, notifyPrefs: true } });
}

const ROLE_LABEL: Record<string, string> = { client: "Mijoz", specialist: "Mutaxassis", admin: "Administrator" };

/* ------------------------------------------------------------------ */
/* «Telegram bilan kirish»                                             */
/* ------------------------------------------------------------------ */

/** `/start l_<kod>` — tasdiqlash tugmalarini ko'rsatadi */
export async function handleLoginStart(chatId: string, arg: string, who: { name?: string; username?: string }): Promise<boolean> {
  const m = /^l_(\d{6})$/.exec(arg);
  if (!m) return false;
  const req = await findLoginRequest(m[1]);
  if (!req) {
    await sendTelegram(chatId, "Kirish so'rovi topilmadi yoki eskirgan (5 daqiqa amal qiladi). Saytda «Telegram bilan kirish»ni qayta bosing.");
    return true;
  }
  const linked = await accountOf(chatId);
  const note = linked ? `Hisob: <b>${escapeTelegramHtml(linked.name)}</b>` : "Bu Telegram hali hisobga ulanmagan — tasdiqlasangiz yangi hisob yaratiladi.";
  await sendTelegram(chatId, `<b>Saytga kirish so'rovi</b>\nKod: <code>${m[1]}</code>\n${note}\n\nAgar bu siz bo'lmasangiz «Yo'q» ni bosing.`, {
    keyboard: [
      [
        { text: "✅ Ha, kirish", data: `lg:ok:${m[1]}` },
        { text: "✖️ Yo'q", data: `lg:no:${m[1]}` },
      ],
    ],
  });
  void who;
  return true;
}

/** `lg:ok|no:<kod>` tugmasi */
export async function handleLoginCallback(chatId: string, data: string, answer: Answer, who: { name?: string; username?: string }): Promise<boolean> {
  const m = /^lg:(ok|no):(\d{6})$/.exec(data);
  if (!m) return false;
  const okNow = await decideLoginRequest(m[2], chatId, m[1] === "ok", who);
  if (!okNow) {
    await answer("So'rov eskirgan — saytda qayta bosing");
    return true;
  }
  await answer(m[1] === "ok" ? "Tasdiqlandi — saytga qaytasiz" : "Rad etildi");
  await sendTelegram(chatId, m[1] === "ok" ? "✅ Kirish tasdiqlandi. Saytdagi oynaga qaytib qarang." : "Kirish rad etildi. Agar bu siz bo'lmasangiz, hech narsa qilish shart emas.");
  return true;
}

/* ------------------------------------------------------------------ */
/* Buyurtma: qabul qilish / rad etish                                  */
/* ------------------------------------------------------------------ */

/** Buyurtma tugmalari: xabar ostida «Qabul qilish» va «Rad etish» */
export function orderButtons(orderId: string, href: string): { text: string; url?: string; data?: string; webApp?: string }[][] {
  const app = appUrl(`/buyurtma/${orderId}`);
  return [
    [
      { text: "✅ Qabul qilish", data: `ord:ok:${orderId}` },
      { text: "✖️ Rad etish", data: `ord:no:${orderId}` },
    ],
    [app ? { text: "Buyurtmani ochish", webApp: app } : { text: "Buyurtmani ochish", url: href }],
  ];
}

/** `ord:ok|no:<id>` — mutaxassis buyurtmani botda hal qiladi */
export async function handleOrderCallback(chatId: string, data: string, answer: Answer): Promise<boolean> {
  const m = /^ord:(ok|no):([\w-]{1,64})$/.exec(data);
  if (!m) return false;
  const me = await accountOf(chatId);
  if (!me || me.isBanned) {
    await answer("Avval hisobni ulang: saytda Kabinet → Profil");
    return true;
  }
  try {
    const { setOrderStatus } = await import("@/lib/telegram-bot/orders");
    const res = await setOrderStatus(m[2], me.id, m[1] === "ok");
    await answer(res);
    await sendTelegram(chatId, escapeTelegramHtml(res), { button: { text: "Buyurtmani ochish", url: `${siteUrl()}/buyurtma/${m[2]}` } });
  } catch (e) {
    await answer(e instanceof ApiError ? e.message : "Xatolik — saytdan bajaring");
  }
  return true;
}

/** `/buyurtmalarim` — ochiq buyurtmalar (mutaxassis uchun yangi buyurtmalar tugmalar bilan) */
export async function handleMyOrders(chatId: string): Promise<void> {
  const me = await accountOf(chatId);
  if (!me) {
    await sendNotLinked(chatId);
    return;
  }
  // Buyurtmada `specialistId` — specialists qatori; mutaxassis userId'si join bilan olinadi
  const rows = await db
    .select({ id: orders.id, title: orders.title, status: orders.status, amount: orders.amount, spUserId: specialists.userId })
    .from(orders)
    .innerJoin(specialists, eq(specialists.id, orders.specialistId))
    .where(and(or(eq(specialists.userId, me.id), eq(orders.clientId, me.id)), inArray(orders.status, ["new", "accepted", "in_progress"])))
    .orderBy(desc(orders.createdAt))
    .limit(8);
  if (!rows.length) {
    await sendTelegram(chatId, "Ochiq buyurtma yo'q.", { button: { text: "Buyurtmalarim", url: `${siteUrl()}/kabinet/buyurtmalar` } });
    return;
  }
  const { STATUS_LABEL } = await import("@/lib/telegram-bot/orders");
  for (const o of rows) {
    const mine = o.spUserId === me.id;
    const text = `<b>${escapeTelegramHtml(o.title)}</b>\n${escapeTelegramHtml(STATUS_LABEL[o.status] ?? o.status)}${o.amount ? ` · ${escapeTelegramHtml(formatPrice(o.amount))}` : ""}`;
    const href = `${siteUrl()}/buyurtma/${o.id}`;
    await sendTelegram(chatId, text, mine && o.status === "new" ? { keyboard: orderButtons(o.id, href) } : { button: { text: "Ochish", url: href } });
  }
}

/* ------------------------------------------------------------------ */
/* Profil, xabarlar, vakansiyalar, sozlamalar                           */
/* ------------------------------------------------------------------ */

/** `/profil` — hisob kartasi */
export async function handleProfile(chatId: string): Promise<void> {
  const me = await accountOf(chatId);
  if (!me) {
    await sendNotLinked(chatId);
    return;
  }
  const since = new Date(me.createdAt).toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });
  const text =
    `<b>${escapeTelegramHtml(me.name)}</b>\n` +
    `${escapeTelegramHtml(ROLE_LABEL[me.role] ?? me.role)}${me.username ? ` · @${escapeTelegramHtml(me.username)}` : ""}\n` +
    `${escapeTelegramHtml(me.email)}\n` +
    `Ro'yxatdan: ${escapeTelegramHtml(since)}\n\n` +
    "Telegram ulangan ✅ — buyurtma, xabar va kurs bildirishnomalari shu yerga keladi.";
  const s = siteUrl() ?? "";
  const sp = me.role === "specialist" ? await db.query.specialists.findFirst({ where: eq(specialists.userId, me.id), columns: { slug: true } }) : null;
  await sendTelegram(chatId, text, {
    keyboard: [
      [
        { text: "Kabinet", url: `${s}/kabinet` },
        { text: "Profilni tahrirlash", url: `${s}/kabinet/profil` },
      ],
      ...(sp ? [[{ text: "Ommaviy sahifam", url: `${s}/mutaxassislar/${sp.slug}` }]] : []),
    ],
  });
}

/** `/xabarlar` — o'qilmagan DM soni */
export async function handleMessages(chatId: string): Promise<void> {
  const me = await accountOf(chatId);
  if (!me) {
    await sendNotLinked(chatId);
    return;
  }
  const { unreadDmCount } = await import("@/lib/chat/dm");
  const n = await unreadDmCount(me.id).catch(() => 0);
  const text = n > 0 ? `💬 <b>${n} ta o'qilmagan xabar</b> bor.` : "💬 O'qilmagan xabar yo'q.";
  await sendTelegram(chatId, text, { button: { text: n > 0 ? "Xabarlarni o'qish" : "Chatni ochish", url: `${siteUrl() ?? ""}/kabinet/chat` } });
}

/** `/vakansiyalar` — so'nggi 5 ta ochiq vakansiya (hamma uchun, ulash shart emas) */
export async function handleVacancies(chatId: string): Promise<void> {
  const { listVacancies } = await import("@/lib/vacancies/service");
  const { professionLabel, salaryLabel } = await import("@/lib/vacancies/format");
  const { vacancyFilterSchema } = await import("@/lib/vacancies/validators");
  const { items, total } = await listVacancies(vacancyFilterSchema.parse({ limit: 5 }));
  const s = siteUrl() ?? "";
  if (!items.length) {
    await sendTelegram(chatId, "Hozircha ochiq vakansiya yo'q.", { button: { text: "Vakansiyalar", url: `${s}/vakansiyalar` } });
    return;
  }
  const lines = items.map((v, i) => {
    const where = v.regionSlug ? (REGION_BY_SLUG[v.regionSlug]?.name ?? v.regionSlug) : "Masofaviy";
    return `${i + 1}. <a href="${s}/vakansiyalar/${v.id}"><b>${escapeTelegramHtml(v.title)}</b></a>\n   ${escapeTelegramHtml(v.company)} · ${escapeTelegramHtml(professionLabel(v.profession, true))} · ${escapeTelegramHtml(where)}\n   ${escapeTelegramHtml(salaryLabel(v.salaryMin, v.salaryMax))}`;
  });
  await sendTelegram(chatId, `💼 <b>So'nggi vakansiyalar</b> (${total} ta ochiq)\n\n${lines.join("\n\n")}`, { button: { text: "Barcha vakansiyalar", url: `${s}/vakansiyalar` } });
}

/** `/sozlamalar` — bildirishnoma guruhlari switch'lari */
export async function handleSettings(chatId: string): Promise<void> {
  const me = await accountOf(chatId);
  if (!me) {
    await sendNotLinked(chatId);
    return;
  }
  await sendTelegram(chatId, SETTINGS_TEXT, { keyboard: settingsKeyboard(me.notifyPrefs ?? {}) });
}

/** `st:<guruh>` — switch'ni almashtirib, klaviaturani joyida yangilaydi */
export async function handleSettingsCallback(chatId: string, data: string, answer: Answer, messageId: number | null): Promise<boolean> {
  const m = /^st:([a-z]+)$/.exec(data);
  if (!m) return false;
  const key = m[1] as NotifyGroupKey;
  if (!NOTIFY_GROUP_KEYS.includes(key)) return false;
  const me = await accountOf(chatId);
  if (!me) {
    await answer("Avval hisobni ulang");
    return true;
  }
  const next = { ...(me.notifyPrefs ?? {}) };
  next[key] = next[key] === false; // o'chirilgan → yoqiladi, aks holda o'chadi
  await db.update(users).set({ notifyPrefs: next }).where(eq(users.id, me.id));
  await answer(next[key] ? "Yoqildi" : "O'chirildi");
  if (messageId) {
    const { replyMarkup } = await import("@/lib/telegram");
    await telegramApi("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: replyMarkup({ keyboard: settingsKeyboard(next) }) });
  }
  return true;
}

/** `menu:*` — xush kelibsiz ekranidagi inline tugmalar */
export async function handleMenuCallback(chatId: string, data: string, answer: Answer): Promise<boolean> {
  if (data === "menu:help") {
    await answer("");
    const { sendHelp } = await import("@/lib/telegram-bot/ui");
    await sendHelp(chatId, Boolean(await accountOf(chatId)));
    return true;
  }
  if (data === "menu:mycourses") {
    await answer("");
    const { handleMyPurchases } = await import("@/lib/mentorship/telegram-pay");
    await handleMyPurchases(chatId);
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Qidiruv, kurslar, efirlar, TOP — ulash shart emas                   */
/* ------------------------------------------------------------------ */

const stars = (r: number) => (r > 0 ? `⭐ ${r.toFixed(1)}` : "yangi");

/** Matn yoki `/qidiruv <so'z>` — ijodkorlar (5 tagacha) */
export async function handleSearch(chatId: string, qRaw: string): Promise<void> {
  const q = qRaw.trim().slice(0, 80);
  const s = siteUrl() ?? "";
  if (q.length < 2) {
    await sendTelegram(chatId, "Kimni qidiramiz? Masalan: <i>montajchi</i>, <i>videograf Samarqand</i>, <i>logo dizayner</i>.");
    return;
  }
  const { exploreSearch } = await import("@/lib/search/service");
  const { CATEGORIES, CATEGORY_BY_SLUG, REGIONS } = await import("@/lib/constants");
  const res = await exploreSearch(q, "people");
  let people: { slug: string; name: string; title: string; category: string; rating: number; reviewCount: number; isVerified: boolean }[] = res.people.slice(0, 5);
  if (!people.length) {
    // Ism/sarlavha topilmadi — kasb va hudud nomi bo'yicha katalog («montajchi Samarqand»)
    const ql = q.toLowerCase();
    // Kasb: so'rovdagi so'z kasb nomi/ko'pligi/slug'ining boshi bilan mos kelsa («montaj» → Montajchi)
    const words = ql.split(/\s+/).filter((w) => w.length >= 4);
    const cat = CATEGORIES.find((c) => {
      const names = [c.name, c.plural, c.slug].map((x) => x.toLowerCase());
      return words.some((w) => names.some((n) => n.startsWith(w.slice(0, 5)) || n.includes(w)));
    });
    const reg = REGIONS.find((r) => ql.includes(r.short.toLowerCase().replace(/\s*(sh\.|vil\.)$/, "")) || ql.includes(r.slug));
    if (cat || reg) {
      const { listSpecialists } = await import("@/lib/queries");
      const { specialistFilterSchema } = await import("@/lib/validators");
      const r = await listSpecialists(specialistFilterSchema.parse({ category: cat?.slug, region: reg?.slug, limit: 5 }));
      people = r.items.slice(0, 5).map((it) => ({ slug: it.slug, name: it.user.name, title: it.title ?? "", category: it.category, rating: it.rating, reviewCount: it.reviewCount, isVerified: Boolean(it.isVerified) }));
    }
  }
  if (!people.length) {
    await sendTelegram(chatId, `🔎 «${escapeTelegramHtml(q)}» bo'yicha ijodkor topilmadi.`, { button: { text: "Katalogda qidirish", url: `${s}/qidiruv?q=${encodeURIComponent(q)}` } });
    return;
  }
  const lines = people.map((p, i) => {
    const cat = CATEGORY_BY_SLUG[p.category]?.name ?? p.category;
    return `${i + 1}. <a href="${s}/mutaxassislar/${p.slug}"><b>${escapeTelegramHtml(p.name)}</b></a>${p.isVerified ? " ✅" : ""}\n   ${escapeTelegramHtml(p.title || cat)} · ${stars(p.rating)}${p.reviewCount ? ` (${p.reviewCount})` : ""}`;
  });
  const app = appUrl(`/qidiruv?q=${encodeURIComponent(q)}`);
  await sendTelegram(chatId, `🔎 <b>«${escapeTelegramHtml(q)}»</b> bo'yicha ijodkorlar\n\n${lines.join("\n\n")}`, {
    keyboard: [[app ? { text: "Hammasini ilovada ko'rish", webApp: app } : { text: "Hammasini ko'rish", url: `${s}/qidiruv?q=${encodeURIComponent(q)}` }]],
  });
}

/** `/kurslar` — mashhur 5 kurs */
export async function handleCourses(chatId: string): Promise<void> {
  const { listCourses } = await import("@/lib/mentorship/service");
  const s = siteUrl() ?? "";
  const { items } = await listCourses({ sort: "popular", limit: 5 });
  if (!items.length) {
    await sendTelegram(chatId, "Hozircha kurslar yo'q.", { button: { text: "Mentorlik", url: `${s}/mentorlik` } });
    return;
  }
  const lines = items.map((c, i) => {
    const price = c.priceFrom > 0 ? formatPrice(c.priceFrom) : "Bepul";
    return `${i + 1}. <a href="${s}/mentorlik/${c.slug}"><b>${escapeTelegramHtml(c.title)}</b></a>\n   ${c.lessonsCount} dars · ${c.studentsCount} talaba · ${stars(c.rating)} · ${escapeTelegramHtml(price)}`;
  });
  await sendTelegram(chatId, `🎓 <b>Mashhur kurslar</b>\n\n${lines.join("\n\n")}`, {
    keyboard: [
      [{ text: "Barcha kurslar", url: `${s}/mentorlik` }],
      [{ text: "📚 Mening kurslarim", data: "menu:mycourses" }],
    ],
  });
}

/** `/efirlar` — jonli va bu haftadagi ustoz efirlari */
export async function handleLives(chatId: string): Promise<void> {
  const { liveAndUpcoming } = await import("@/lib/mentorship/growth");
  const s = siteUrl() ?? "";
  const items = await liveAndUpcoming(6);
  if (!items.length) {
    await sendTelegram(chatId, "Hozir jonli efir yo'q va bu haftaga rejalashtirilgani ham yo'q.", { button: { text: "Mentorlik", url: `${s}/mentorlik` } });
    return;
  }
  const fmt = (ms: number) => new Date(ms).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const lines = items.map((it) => {
    const href = it.mentorSlug ? `${s}/mentorlik/ustoz/${it.mentorSlug}?tab=efirlar` : `${s}/mentorlik`;
    return `${it.live ? "🔴 <b>JONLI</b>" : `🗓 ${escapeTelegramHtml(fmt(it.startsAt))}`} — <a href="${href}"><b>${escapeTelegramHtml(it.title)}</b></a>\n   ${escapeTelegramHtml(it.mentorName)}${it.price > 0 ? ` · ${escapeTelegramHtml(formatPrice(it.price))}` : ""}`;
  });
  await sendTelegram(chatId, `🎥 <b>Efirlar</b>\n\n${lines.join("\n\n")}`, { button: { text: "Mentorlik", url: `${s}/mentorlik` } });
}

/** `/top` — joriy oy TOP-5 */
export async function handleTop(chatId: string): Promise<void> {
  const { currentMonthTop } = await import("@/lib/top");
  const s = siteUrl() ?? "";
  const rows = await currentMonthTop(5);
  if (!rows.length) {
    await sendTelegram(chatId, "Bu oy reytingi hali shakllanmadi.", { button: { text: "TOP reyting", url: `${s}/top` } });
    return;
  }
  const medal = ["🥇", "🥈", "🥉", "4.", "5."];
  const lines = rows.map((r, i) => `${medal[i] ?? `${i + 1}.`} <a href="${s}/mutaxassislar/${r.author.slug ?? ""}"><b>${escapeTelegramHtml(r.author.name)}</b></a> — ${r.score} ball\n   ❤️ ${r.likes} · 💬 ${r.comments} · 👁 ${r.views}`);
  await sendTelegram(chatId, `🏆 <b>Oyning TOP ijodkorlari</b> (jonli hisob)\n\n${lines.join("\n\n")}`, { button: { text: "To'liq reyting", url: `${s}/top` } });
}

/* ------------------------------------------------------------------ */
/* Admin: ommaviy e'lon botdan (`/elon`)                               */
/* ------------------------------------------------------------------ */

const DRAFT_TTL_MS = 60 * 60 * 1000;

/**
 * `/elon Sarlavha | Matn` yoki ko'p qatorli (`/elon` + Enter, 1-qator sarlavha, qolgani matn) — faqat ADMIN chat.
 * Qoralama `bot_drafts`ga yoziladi va auditoriya tugmalari chiqadi (`bc:<all|specialists|clients|no>`).
 */
export async function handleBroadcastStart(chatId: string, text: string): Promise<void> {
  const me = await accountOf(chatId);
  if (!me || me.role !== "admin" || me.isBanned) {
    await sendTelegram(chatId, "Bu buyruq faqat administrator uchun.");
    return;
  }
  const raw = text.replace(/^\/elon(@\w+)?\s*/i, "").trim();
  let title = "";
  let body = "";
  if (raw.includes("|")) {
    const i = raw.indexOf("|");
    title = raw.slice(0, i).trim();
    body = raw.slice(i + 1).trim();
  } else if (raw.includes("\n")) {
    const i = raw.indexOf("\n");
    title = raw.slice(0, i).trim();
    body = raw.slice(i + 1).trim();
  }
  if (!raw || title.length < 4 || body.length < 10) {
    await sendTelegram(
      chatId,
      "📣 <b>Ommaviy e'lon</b>\nBarcha foydalanuvchilarga (sayt + Telegram) bir vaqtda yuboriladi.\n\nFormat:\n<code>/elon Sarlavha | Matn</code>\nyoki\n<code>/elon</code> dan keyin yangi qatorda sarlavha, keyingi qatorlarda matn.\n\nSarlavha 4–120 belgi, matn 10–600 belgi. Yuborishdan oldin auditoriya so'raladi.",
    );
    return;
  }
  title = title.slice(0, 120);
  body = body.slice(0, 600);
  const { botDrafts } = await import("@/lib/db/schema");
  await db.insert(botDrafts).values({ chatId, title, body, createdAt: new Date() }).onConflictDoUpdate({ target: botDrafts.chatId, set: { title, body, createdAt: new Date() } });
  const { audienceRows, channelStat } = await import("@/lib/broadcast");
  const all = await audienceRows("all");
  const st = channelStat(all);
  const sp = all.filter((r) => r.role === "specialist").length;
  const cl = all.filter((r) => r.role === "client").length;
  await sendTelegram(chatId, `<b>${escapeTelegramHtml(title)}</b>\n${escapeTelegramHtml(body)}\n\n— Shunday ketadi. Kimga yuboramiz? (saytda ${all.length} kishi, Telegramda ${st.telegram} kishi)`, {
    keyboard: [
      [{ text: `👥 Hammaga (${all.length})`, data: "bc:all" }],
      [
        { text: `🎨 Mutaxassislar (${sp})`, data: "bc:specialists" },
        { text: `🧑‍💼 Mijozlar (${cl})`, data: "bc:clients" },
      ],
      [{ text: "✖️ Bekor qilish", data: "bc:no" }],
    ],
  });
}

/** `bc:<auditoriya|no>` — admin tasdiqlaydi; natija asl xabar ostiga yoziladi, tugmalar yo'qoladi */
export async function handleBroadcastCallback(chatId: string, data: string, answer: Answer, messageId: number | null): Promise<boolean> {
  const m = /^bc:(all|specialists|clients|no)$/.exec(data);
  if (!m) return false;
  const me = await accountOf(chatId);
  if (!me || me.role !== "admin" || me.isBanned) {
    await answer("Faqat administrator uchun");
    return true;
  }
  const { botDrafts } = await import("@/lib/db/schema");
  const draft = await db.query.botDrafts.findFirst({ where: eq(botDrafts.chatId, chatId) });
  const finish = async (result: string) => {
    await answer(result.slice(0, 190));
    if (messageId) {
      await telegramApi("editMessageText", { chat_id: chatId, message_id: messageId, text: `${draft ? `<b>${escapeTelegramHtml(draft.title)}</b>\n${escapeTelegramHtml(draft.body)}\n\n` : ""}<b>${escapeTelegramHtml(result)}</b>`, parse_mode: "HTML" });
    }
  };
  if (m[1] === "no") {
    await db.delete(botDrafts).where(eq(botDrafts.chatId, chatId));
    await finish("Bekor qilindi");
    return true;
  }
  if (!draft || Date.now() - draft.createdAt.getTime() > DRAFT_TTL_MS) {
    await finish("Qoralama topilmadi yoki eskirgan — /elon bilan qaytadan yozing");
    return true;
  }
  // CAS: qoralama o'chirilgach yuboriladi — ikki marta bosilsa ikkinchi marta ketmaydi
  const del = await db.delete(botDrafts).where(eq(botDrafts.chatId, chatId)).returning({ chatId: botDrafts.chatId });
  if (!del.length) {
    await answer("Allaqachon yuborilmoqda");
    return true;
  }
  const { AUDIENCE_LABEL, sendBroadcast } = await import("@/lib/broadcast");
  const aud = m[1] as "all" | "specialists" | "clients";
  try {
    const r = await sendBroadcast({ title: draft.title, body: draft.body, audience: aud }, me.id, "telegram");
    await finish(`✅ Yuborildi — ${AUDIENCE_LABEL[aud].toLowerCase()}: ${r.sent} kishi (Telegram ${r.channels.telegram})`);
  } catch (e) {
    await finish(`Xatolik: ${e instanceof Error ? e.message : "yuborilmadi"}`);
  }
  return true;
}
