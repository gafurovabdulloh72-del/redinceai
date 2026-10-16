/**
 * E'lonlar lug'ati (/ishlar): ro'yxat sahifasi, filtrlar, e'lon kartasi va detal sahifasi.
 */
import type { Locale, Tr } from "../index";
import { localizePrice, ruPlural } from "./catalog";

/** Byudjet yorlig'i (lib/jobs/format.budgetLabel natijasi) — ruschaga moslash */
export function budgetLabelTr(til: Locale, uzLabel: string): string {
  if (til !== "ru") return uzLabel;
  if (uzLabel === "Kelishiladi") return "Договорная";
  let s = uzLabel;
  const hourly = s.endsWith(" / soat");
  if (hourly) s = s.slice(0, -" / soat".length);
  if (s.endsWith(" dan")) s = `от ${s.slice(0, -" dan".length)}`;
  else if (s.endsWith(" gacha")) s = `до ${s.slice(0, -" gacha".length)}`;
  s = localizePrice(til, s).replace(/(\d)\s*mln\b/g, "$1 млн").replace(/(\d)\s*ming\b/g, "$1 тыс.");
  return hourly ? `${s} / час` : s;
}

/** Takliflar soni: "5 ta taklif" / "Hali taklif yo'q" */
export function proposalsCountTr(til: Locale, n: number): string {
  if (til !== "ru") return n > 0 ? `${n} ta taklif` : "Hali taklif yo'q";
  return n > 0 ? `${n} ${ruPlural(n, ["предложение", "предложения", "предложений"])}` : "Пока нет предложений";
}

/** E'lon holati (JOB_STATUS_LABEL kalitlari bo'yicha) */
export const ISH_HOLATI: Record<string, Tr> = {
  open: { uz: "Ochiq", ru: "Открыт" },
  hired: { uz: "Mutaxassis tanlandi", ru: "Специалист выбран" },
  closed: { uz: "Yopilgan", ru: "Закрыт" },
};

export const ISHLAR = {
  /* --------- Ro'yxat sahifasi --------- */
  eyebrow: { uz: (n: number) => `E'lonlar · ${n} ta ochiq loyiha`, ru: (n: number) => `Заказы · открытых проектов: ${n}` },
  titleStart: { uz: "Ochiq", ru: "Открытые" } satisfies Tr,
  titleAccent: { uz: "ishlar", ru: "заказы" } satisfies Tr,
  description: {
    uz: "Mijozlar loyihasini joylaydi, mutaxassislar narx va muddat bilan taklif yuboradi. Mosini tanlang — to'lov eskrou orqali xavfsiz.",
    ru: "Клиенты размещают проекты, специалисты присылают предложения с ценой и сроком. Выбирайте подходящий — оплата безопасна через эскроу.",
  } satisfies Tr,
  postJob: { uz: "E'lon joylash", ru: "Разместить заказ" } satisfies Tr,
  myProposals: { uz: "Takliflarim", ru: "Мои предложения" } satisfies Tr,
  subInactiveBanner: {
    uz: "Obunangiz faol emas — e'lonlarni ko'rishingiz mumkin, lekin taklif yuborish uchun obunani yangilang.",
    ru: "Подписка неактивна — заказы можно просматривать, но для отправки предложений продлите подписку.",
  } satisfies Tr,
  renewSub: { uz: "Obunani yangilash", ru: "Продлить подписку" } satisfies Tr,
  categoriesAria: { uz: "Yo'nalishlar", ru: "Направления" } satisfies Tr,
  all: { uz: "Barchasi", ru: "Все" } satisfies Tr,
  /** "24 ta e'lon" — raqam alohida span'da */
  resultSuffix: { uz: (_n: number) => " ta e'lon", ru: (n: number) => ` ${ruPlural(n, ["заказ", "заказа", "заказов"])}` },
  proposalsLeft: {
    uz: (rem: number, limit: number) => ({ pre: "Bugun ", strong: `${rem}/${limit}`, post: " taklif qoldi" }),
    ru: (rem: number, limit: number) => ({ pre: "Сегодня осталось ", strong: `${rem}/${limit}`, post: " предложений" }),
  },
  emptyFilteredTitle: { uz: "Bu shartlarga mos e'lon yo'q", ru: "Нет заказов по этим условиям" } satisfies Tr,
  emptyNoneTitle: { uz: "Hozircha ochiq e'lonlar yo'q", ru: "Открытых заказов пока нет" } satisfies Tr,
  emptyFilteredDesc: {
    uz: "Filtrlarni yumshating yoki boshqa yo'nalishni tanlang. Loyihangiz bo'lsa — e'lon joylang, mutaxassislar o'zlari taklif yuborishadi.",
    ru: "Смягчите фильтры или выберите другое направление. Есть проект? Разместите заказ — специалисты сами пришлют предложения.",
  } satisfies Tr,
  emptyNoneDesc: {
    uz: "Loyihangiz bormi? E'lon joylang — mos mutaxassislar narx va muddat bilan taklif yuborishadi.",
    ru: "Есть проект? Разместите заказ — подходящие специалисты пришлют предложения с ценой и сроком.",
  } satisfies Tr,
  clearFilters: { uz: "Filtrlarni tozalash", ru: "Сбросить фильтры" } satisfies Tr,

  /* --------- Filtrlar formasi --------- */
  f: {
    formAria: { uz: "E'lonlarni qidirish", ru: "Поиск заказов" } satisfies Tr,
    search: { uz: "Qidiruv", ru: "Поиск" } satisfies Tr,
    searchPlaceholder: { uz: "Masalan: to'y, logo, reels", ru: "Например: свадьба, лого, reels" } satisfies Tr,
    region: { uz: "Hudud", ru: "Регион" } satisfies Tr,
    allRegions: { uz: "Barcha hududlar", ru: "Все регионы" } satisfies Tr,
    remote: { uz: "Masofaviy", ru: "Удалённо" } satisfies Tr,
    sort: { uz: "Saralash", ru: "Сортировка" } satisfies Tr,
    sorts: {
      newest: { uz: "Eng yangilari", ru: "Сначала новые" },
      budget_high: { uz: "Byudjet: kattadan", ru: "Бюджет: по убыванию" },
      budget_low: { uz: "Byudjet: kichikdan", ru: "Бюджет: по возрастанию" },
    } as Record<string, Tr>,
    minLabel: { uz: "Byudjet, dan (so'm)", ru: "Бюджет, от (сум)" } satisfies Tr,
    maxLabel: { uz: "Byudjet, gacha (so'm)", ru: "Бюджет, до (сум)" } satisfies Tr,
    minPlaceholder: { uz: "Byudjet, dan", ru: "Бюджет, от" } satisfies Tr,
    maxPlaceholder: { uz: "gacha", ru: "до" } satisfies Tr,
    submit: { uz: "Qidirish", ru: "Найти" } satisfies Tr,
  },

  /* --------- E'lon kartasi --------- */
  card: {
    skillsAria: { uz: "Ko'nikmalar", ru: "Навыки" } satisfies Tr,
    emailVerified: { uz: "Email tasdiqlangan", ru: "Email подтверждён" } satisfies Tr,
  },

  /* --------- Detal sahifasi --------- */
  d: {
    backToAll: { uz: "Barcha e'lonlar", ru: "Все заказы" } satisfies Tr,
    postedTitle: { uz: "E'loningiz joylandi", ru: "Ваш заказ размещён" } satisfies Tr,
    postedDesc: {
      uz: "Mos mutaxassislar taklif yuborganda bildirishnoma keladi. Takliflar shu sahifada va «E'lonlarim» bo'limida.",
      ru: "Когда подходящие специалисты пришлют предложения, придёт уведомление. Предложения — на этой странице и в разделе «Мои заказы».",
    } satisfies Tr,
    expired: { uz: "Muddati tugagan", ru: "Срок истёк" } satisfies Tr,
    viewedTimes: { uz: (v: string) => `${v} marta ko'rildi`, ru: (v: string) => `Просмотров: ${v}` },
    daysOpen: { uz: (d: number) => `${d} kun ochiq turadi`, ru: (d: number) => `Открыт ещё ${d} ${ruPlural(d, ["день", "дня", "дней"])}` },
    closesToday: { uz: "Bugun yopiladi", ru: "Закроется сегодня" } satisfies Tr,
    requiredSkills: { uz: "Kerakli ko'nikmalar", ru: "Требуемые навыки" } satisfies Tr,
    budget: { uz: "Byudjet", ru: "Бюджет" } satisfies Tr,
    paymentType: { uz: "To'lov turi", ru: "Тип оплаты" } satisfies Tr,
    fixed: { uz: "Belgilangan narx", ru: "Фиксированная цена" } satisfies Tr,
    hourly: { uz: "Soatbay", ru: "Почасовая" } satisfies Tr,
    deadline: { uz: "Muddat", ru: "Срок" } satisfies Tr,
    negotiable: { uz: "Kelishiladi", ru: "По договорённости" } satisfies Tr,
    posted: { uz: "Joylandi", ru: "Размещён" } satisfies Tr,
    /* Mutaxassis / mehmon kartalari */
    closedTitle: { uz: "E'lon yopilgan", ru: "Заказ закрыт" } satisfies Tr,
    closedText: { uz: "Bu e'longa endi taklif qabul qilinmaydi. Boshqa ochiq e'lonlarni ko'rib chiqing.", ru: "Предложения по этому заказу больше не принимаются. Посмотрите другие открытые заказы." } satisfies Tr,
    openJobs: { uz: "Ochiq e'lonlar", ru: "Открытые заказы" } satisfies Tr,
    subInactiveTitle: { uz: "Obunangiz faol emas", ru: "Подписка неактивна" } satisfies Tr,
    subInactiveText: {
      uz: "Taklif yuborish va yangi buyurtma olish uchun oylik obunani yangilang. Mavjud buyurtmalaringiz odatdagidek davom etadi.",
      ru: "Чтобы отправлять предложения и получать новые заказы, продлите месячную подписку. Текущие заказы продолжаются как обычно.",
    } satisfies Tr,
    fillProfileTitle: { uz: "Profilingizni to'ldiring", ru: "Заполните профиль" } satisfies Tr,
    fillProfileText: { uz: "Taklif yuborish uchun avval mutaxassis profilingizni yarating.", ru: "Чтобы отправить предложение, сначала создайте профиль специалиста." } satisfies Tr,
    toProfile: { uz: "Profilga o'tish", ru: "Перейти в профиль" } satisfies Tr,
    guestTitle: { uz: "Taklif yuborish uchun kiring", ru: "Войдите, чтобы отправить предложение" } satisfies Tr,
    guestText: {
      uz: "Mutaxassis sifatida kirib, narx va muddatingizni yuboring. Mijoz taklifni qabul qilsa — buyurtma va xavfsiz to'lov avtomatik.",
      ru: "Войдите как специалист и отправьте свою цену и срок. Если клиент примет предложение — заказ и безопасная оплата оформятся автоматически.",
    } satisfies Tr,
    login: { uz: "Kirish", ru: "Войти" } satisfies Tr,
    joinAsSpecialist: { uz: "Mutaxassis sifatida qo'shilish", ru: "Присоединиться как специалист" } satisfies Tr,
    otherClientTitle: { uz: "Takliflarni mutaxassislar yuboradi", ru: "Предложения отправляют специалисты" } satisfies Tr,
    otherClientText: {
      uz: "Sizga ham mutaxassis kerakmi? O'z loyihangizni joylang — mos ijrochilar o'zlari taklif yuborishadi.",
      ru: "Вам тоже нужен специалист? Разместите свой проект — подходящие исполнители сами пришлют предложения.",
    } satisfies Tr,
    postJob: { uz: "E'lon joylash", ru: "Разместить заказ" } satisfies Tr,
    /* Yon panel */
    sendProposal: { uz: "Taklif yuborish", ru: "Отправить предложение" } satisfies Tr,
    proposalsLeft: { uz: (rem: number, limit: number) => `Bugun ${rem}/${limit} taklif qoldi`, ru: (rem: number, limit: number) => `Сегодня осталось предложений: ${rem}/${limit}` },
    toOrder: { uz: "Buyurtmaga o'tish", ru: "Перейти к заказу" } satisfies Tr,
    client: { uz: "Mijoz", ru: "Клиент" } satisfies Tr,
    emailVerified: { uz: "Email tasdiqlangan", ru: "Email подтверждён" } satisfies Tr,
    emailNotVerified: { uz: "Email hali tasdiqlanmagan", ru: "Email ещё не подтверждён" } satisfies Tr,
    memberSince: { uz: (d: string) => `Kasb Egalari platformasida ${d} dan`, ru: (d: string) => `На платформе Kasb Egalari с ${d}` },
    postedStats: {
      uz: (posted: number, hired: number) => `${posted} ta e'lon joylagan${hired > 0 ? ` · ${hired} tasida mutaxassis yollagan` : ""}`,
      ru: (posted: number, hired: number) =>
        `Разместил ${posted} ${ruPlural(posted, ["заказ", "заказа", "заказов"])}${hired > 0 ? ` · нанял специалиста в ${hired} из них` : ""}`,
    },
    escrowNote: {
      uz: "To'lovni faqat Kasb Egalari eskrou orqali qiling: pul ish qabul qilinguncha platformada saqlanadi, nizo bo'lsa — admin hal qiladi.",
      ru: "Оплачивайте только через эскроу Kasb Egalari: деньги хранятся на платформе до приёмки работы, а споры решает администратор.",
    } satisfies Tr,
  },
} as const;
