import "server-only";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { cutPlain, escapeTelegramHtml, replyMarkup, sendTelegram, telegramApi, type TelegramButton } from "@/lib/telegram";
import { applicationStatusTr, experienceTr, professionLabelTr } from "@/lib/i18n/dict/vacancies";
import { assertVacancyOwner, listApplicants, loadApplication, loadVacancy, myApplications, myVacancies, setApplicationStatus, type ApplicantView } from "@/lib/vacancies/service";
import { activeAccount } from "@/lib/telegram-bot/actions";
import { firstSeen } from "@/lib/telegram-bot/guard";
import { errorText } from "@/lib/telegram-bot/i18n";
import { L, type BotLang } from "@/lib/telegram-bot/lang";
import { pageButton } from "@/lib/telegram-bot/ui";

/**
 * VAKANSIYA ARIZALARI BOTDA (2026-11-10).
 *  - Ish beruvchi: yangi ariza kelganda Telegramga NOMZOD KARTASI (moslik balli, rezyume, xat parchasi) va
 *    «⭐ Tanlovga olish / ✖️ Rad etish» tugmalari keladi (`ap:<sl|rj>:<arizaId>`); `/arizalar` — hal qilinmagan arizalar.
 *  - Nomzod: `/arizalarim` — yuborgan arizalari va holati.
 * QOIDALAR: moslik balli FAQAT vakansiya egasiga (nomzodga hech qachon); karta nomzodning kontaktlarini (telefon, email)
 * ko'rsatmaydi — ular saytdagi ariza sahifasida, faqat egasiga; har tugma vakansiya egaligini qayta tekshiradi
 * (`assertVacancyOwner` — saytdagi PATCH /api/arizalar/[id] bilan bir xil).
 */
type Answer = (text: string) => Promise<unknown>;
const DAY_MS = 24 * 60 * 60 * 1000;

const verdictLabel = (v: ApplicantView["match"]["verdict"], lang?: BotLang): string => (v === "strong" ? L(lang, "kuchli mos", "сильное совпадение") : v === "good" ? L(lang, "mos", "подходит") : L(lang, "qisman mos", "частичное совпадение"));
const verdictIcon = (v: ApplicantView["match"]["verdict"]): string => (v === "strong" ? "🟢" : v === "good" ? "🟡" : "⚪️");

/** Nomzod kartasi: ism, moslik, rezyume, xat parchasi. Kontakt YO'Q */
function cardText(a: ApplicantView, vacancyTitle: string, lang: BotLang, head: string): string {
  const til = lang ?? "uz";
  const lines = [`${head} — «${escapeTelegramHtml(vacancyTitle)}»`, `<b>${escapeTelegramHtml(a.user.name)}</b> · ${verdictIcon(a.match.verdict)} ${L(lang, "moslik", "совпадение")} <b>${a.match.score}%</b> (${verdictLabel(a.match.verdict, lang)})`];
  if (a.resume) lines.push(`📄 ${escapeTelegramHtml(a.resume.title || professionLabelTr(til, a.resume.profession, true))} · ${escapeTelegramHtml(experienceTr(til, a.resume.experience))}`);
  else lines.push(L(lang, "📄 Rezyumesiz ariza", "📄 Отклик без резюме"));
  if (a.quiz) lines.push(`🧪 ${L(lang, "Test", "Тест")}: ${a.quiz.correct}/${a.quiz.total}`);
  const letter = a.coverLetter.replace(/\s+/g, " ").trim();
  if (letter) lines.push(`<i>${escapeTelegramHtml(cutPlain(letter, 220))}${letter.length > 220 ? "…" : ""}</i>`);
  return lines.join("\n");
}

function cardKeyboard(a: Pick<ApplicantView, "id" | "status">, vacancyId: string, lang: BotLang): TelegramButton[][] {
  const open = pageButton(L(lang, "Arizani ochish", "Открыть отклик"), `/kabinet/vakansiyalar?v=${vacancyId}`);
  const actions: TelegramButton[] = [];
  if (a.status === "new" || a.status === "viewed" || a.status === "rejected") actions.push({ text: L(lang, "⭐ Tanlovga olish", "⭐ В шорт-лист"), data: `ap:sl:${a.id}` });
  if (a.status === "new" || a.status === "viewed" || a.status === "shortlisted") actions.push({ text: L(lang, "✖️ Rad etish", "✖️ Отклонить"), data: `ap:rj:${a.id}` });
  return [...(actions.length ? [actions] : []), [open]];
}

/**
 * Yangi ariza bildirishnomasi o'rniga yuboriladigan karta (lib/notifications.ts chaqiradi): vakansiyaning shu egasi uchun
 * hali karta yuborilmagan ENG YANGI «yangi» ariza. Karta matni aynan shu arizadan tuziladi — tugmalar va matn bir-biriga
 * mos kelishi kafolatlanadi (ikki ariza bir vaqtda kelsa ham har biri o'z kartasini oladi). Mos ariza yo'q — null
 * (chaqiruvchi oddiy bildirishnoma yuboradi).
 */
export async function applicationCardFor(vacancyId: string, ownerId: string, lang: BotLang): Promise<{ text: string; keyboard: TelegramButton[][] } | null> {
  const v = await loadVacancy(vacancyId);
  if (!v || v.authorId !== ownerId) return null;
  const fresh = (await listApplicants(vacancyId)).filter((a) => a.status === "new" && Date.now() - a.createdAt < DAY_MS);
  for (const a of fresh) {
    // Har ariza uchun bitta karta (bildirishnoma takrorlansa ham)
    if (!(await firstSeen(`tgAppCard:${a.id}`, 30 * DAY_MS))) continue;
    return { text: cardText(a, v.title, lang, L(lang, "📨 <b>Yangi ariza</b>", "📨 <b>Новый отклик</b>")), keyboard: cardKeyboard(a, v.id, lang) };
  }
  return null;
}

/** `ap:<sl|rj>:<arizaId>` — ish beruvchi arizani tanlovga oladi yoki rad etadi (nomzodga bildirishnoma ketadi) */
export async function handleApplicationCallback(chatId: string, data: string, answer: Answer, msgId: number | null, lang?: BotLang): Promise<boolean> {
  const m = /^ap:(sl|rj):([\w-]{1,64})$/.exec(data);
  if (!m) return false;
  const me = await activeAccount(chatId, lang);
  if (!me) {
    await answer(L(lang, "Avval hisobni ulang", "Сначала привяжите аккаунт"));
    return true;
  }
  try {
    const app = await loadApplication(m[2]);
    const v = app ? await loadVacancy(app.vacancyId) : null;
    if (!app || !v) throw new ApiError(404, "Ariza topilmadi");
    // Faqat vakansiya egasi (yoki admin) — tugma boshqa odamga tushsa ishlamaydi
    assertVacancyOwner(v, { id: me.id, role: me.role });
    const target = m[1] === "sl" ? "shortlisted" : "rejected";
    if (app.status === "hired") {
      await answer(L(lang, "Ishga olingan arizani botdan o'zgartirib bo'lmaydi — saytdan foydalaning", "Статус принятого кандидата меняется только на сайте"));
      return true;
    }
    if (app.status === target) {
      await answer(target === "shortlisted" ? L(lang, "Allaqachon tanlovda", "Уже в шорт-листе") : L(lang, "Allaqachon rad etilgan", "Уже отклонён"));
      return true;
    }
    // Ikki tez bosish (ikkalasi ham eski holatni o'qib ulgurgan): nomzodga bildirishnoma ikki marta ketmasin
    if (!(await firstSeen(`tgApDo:${app.id}:${target}`, 5000))) {
      await answer(L(lang, "Bajarilmoqda…", "Выполняется…"));
      return true;
    }
    const row = await setApplicationStatus(app, v, target);
    await audit(me.id, "application_status", { targetType: "application", targetId: app.id, meta: { status: target, via: "telegram" } }).catch(() => undefined);
    const done = target === "shortlisted" ? L(lang, "⭐ Tanlovga olindi — nomzodga xabar ketdi", "⭐ Добавлен в шорт-лист — кандидат уведомлён") : L(lang, "✖️ Rad etildi — nomzodga xabar ketdi", "✖️ Отклонён — кандидат уведомлён");
    await answer(done);
    // Kartadagi tugmalar yangi holatga moslanadi (qarorni o'zgartirish mumkin — saytdagi kabi)
    if (msgId) await telegramApi("editMessageReplyMarkup", { chat_id: chatId, message_id: msgId, reply_markup: replyMarkup({ keyboard: cardKeyboard({ id: row.id, status: row.status }, v.id, lang ?? "uz") }) });
    await sendTelegram(chatId, `${done}\n«${escapeTelegramHtml(v.title)}»`);
  } catch (e) {
    await answer((await errorText(e, lang, "Xatolik — saytdan bajaring", "Ошибка — выполните на сайте")).slice(0, 180));
  }
  return true;
}

/** `/arizalar` — ish beruvchi: vakansiyalariga kelgan hal qilinmagan arizalar (eng yangilari, kartalar bilan) */
export async function handleEmployerApplications(chatId: string, lang?: BotLang): Promise<void> {
  const me = await activeAccount(chatId, lang);
  if (!me) return;
  const l: BotLang = lang ?? "uz";
  const mine = await myVacancies(me.id);
  if (!mine.length) {
    await sendTelegram(chatId, L(lang, "💼 Sizda hali vakansiya yo'q. Vakansiya joylang — arizalar shu yerga ham keladi.", "💼 У вас пока нет вакансий. Разместите вакансию — отклики будут приходить и сюда."), { keyboard: [[pageButton(L(lang, "Vakansiya joylash", "Разместить вакансию"), "/vakansiyalar/yangi")]] });
    return;
  }
  // Arizasi bor vakansiyalar (yangi arizalari ko'plari birinchi) — har biridan hal qilinmaganlar
  const withApps = mine.filter((v) => v.applicationsCount > 0).sort((a, b) => b.newApplications - a.newApplications);
  const cards: { a: ApplicantView; title: string; vacancyId: string }[] = [];
  let pending = 0;
  for (const v of withApps.slice(0, 6)) {
    const list = (await listApplicants(v.id)).filter((a) => a.status === "new" || a.status === "viewed");
    pending += list.length;
    for (const a of list) cards.push({ a, title: v.title, vacancyId: v.id });
  }
  if (!cards.length) {
    await sendTelegram(chatId, L(lang, `💼 Hal qilinmagan ariza yo'q (vakansiyalar: ${mine.length} ta).`, `💼 Нерассмотренных откликов нет (вакансий: ${mine.length}).`), { keyboard: [[pageButton(L(lang, "Vakansiyalarim", "Мои вакансии"), "/kabinet/vakansiyalar")]] });
    return;
  }
  cards.sort((x, y) => y.a.createdAt - x.a.createdAt);
  const shown = cards.slice(0, 5);
  await sendTelegram(chatId, L(lang, `💼 <b>Hal qilinmagan arizalar:</b> ${pending} ta. Eng yangilari quyida — tanlovga oling yoki rad eting.`, `💼 <b>Нерассмотренные отклики:</b> ${pending}. Ниже самые свежие — добавьте в шорт-лист или отклоните.`));
  for (const c of shown) {
    const st = applicationStatusTr(l, c.a.status);
    await sendTelegram(chatId, cardText(c.a, c.title, l, `📨 <b>${escapeTelegramHtml(st)}</b>`), { keyboard: cardKeyboard(c.a, c.vacancyId, l) });
  }
  if (pending > shown.length) await sendTelegram(chatId, L(lang, `… va yana ${pending - shown.length} ta — kabinetda.`, `… и ещё ${pending - shown.length} — в кабинете.`), { keyboard: [[pageButton(L(lang, "Barcha arizalar", "Все отклики"), "/kabinet/vakansiyalar")]] });
}

/** `/arizalarim` — nomzod: yuborgan arizalari va holati (moslik balli KO'RSATILMAYDI) */
export async function handleMyApplications(chatId: string, lang?: BotLang): Promise<void> {
  const me = await activeAccount(chatId, lang);
  if (!me) return;
  const l: BotLang = lang ?? "uz";
  const list = await myApplications(me.id);
  if (!list.length) {
    await sendTelegram(chatId, L(lang, "📮 Hali ariza yubormagansiz. Ochiq vakansiyalar — /vakansiyalar", "📮 Вы ещё не откликались. Открытые вакансии — /vakansiyalar"), { keyboard: [[pageButton(L(lang, "Vakansiyalar", "Вакансии"), "/vakansiyalar")]] });
    return;
  }
  const icon: Record<string, string> = { new: "🕓", viewed: "👁", shortlisted: "⭐", rejected: "✖️", hired: "✅" };
  const lines = list.slice(0, 8).map((a) => {
    const closed = a.vacancy.status !== "open" || a.vacancy.expired ? L(lang, " · vakansiya yopilgan", " · вакансия закрыта") : "";
    return `${icon[a.status] ?? "•"} <b>${escapeTelegramHtml(a.vacancy.title)}</b>${a.vacancy.company ? ` — ${escapeTelegramHtml(a.vacancy.company)}` : ""}\n   ${escapeTelegramHtml(applicationStatusTr(l, a.status))}${closed}`;
  });
  await sendTelegram(chatId, `📮 <b>${L(lang, "Arizalarim", "Мои отклики")}</b> (${list.length})\n\n${lines.join("\n\n")}`, { keyboard: [[pageButton(L(lang, "Kabinetda ko'rish", "Открыть в кабинете"), "/kabinet/arizalarim")]] });
}
