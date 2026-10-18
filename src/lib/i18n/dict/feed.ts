import type { Tr } from "@/lib/i18n";

/** Bosh sahifa lentasi (ijtimoiy tarmoq qobig'i): hikoyalar qatori, lenta, o'ng panel, mehmon kartasi */
export const FEED = {
  all: { uz: "Hammasi", ru: "Все" } satisfies Tr,
  following: { uz: "Obunalarim", ru: "Подписки" } satisfies Tr,
  stories: { uz: "Faol ijodkorlar", ru: "Активные авторы" } satisfies Tr,
  live: { uz: "Efir", ru: "Эфир" } satisfies Tr,
  liveNow: { uz: "Hozir jonli", ru: "Сейчас в эфире" } satisfies Tr,
  composerPlaceholder: { uz: "Nima yangilik? Ish jarayoni, natija, fikr…", ru: "Что нового? Процесс, результат, мысль…" } satisfies Tr,
  emptyAll: { uz: "Lenta hali bo'sh. Birinchi postni siz joylang yoki jamoaga qo'shiling.", ru: "Лента пока пуста. Опубликуйте первый пост или вступите в сообщество." } satisfies Tr,
  emptyFollowing: {
    uz: "Obunalaringizdan hali post yo'q. Ijodkorlarga obuna bo'ling va jamoalarga qo'shiling — ularning yangiliklari shu yerda chiqadi.",
    ru: "От ваших подписок пока нет постов. Подпишитесь на авторов и вступите в сообщества — их новости появятся здесь.",
  } satisfies Tr,
  findCreators: { uz: "Ijodkorlarni topish", ru: "Найти авторов" } satisfies Tr,
  more: { uz: "Yana yuklash", ru: "Показать ещё" } satisfies Tr,
  loading: { uz: "Yuklanmoqda…", ru: "Загрузка…" } satisfies Tr,
  inGroup: { uz: "jamoasida", ru: "в сообществе" } satisfies Tr,
  inChannel: { uz: "kanalida", ru: "в канале" } satisfies Tr,

  welcomeEyebrow: { uz: "Ijodkorlar ijtimoiy tarmog'i", ru: "Соцсеть для творческих" } satisfies Tr,
  welcomeTitle: { uz: "Ishlaringizni ko'rsating, hamkasblar bilan bog'laning", ru: "Показывайте работы, общайтесь с коллегами" } satisfies Tr,
  welcomeText: {
    uz: "Postlar, videolar, jamoalar va kanallar, jonli efirlar, vakansiyalar — videograf, montajor, dizayner va barcha onlayn kasb egalari bir joyda.",
    ru: "Посты, видео, сообщества и каналы, прямые эфиры, вакансии — видеографы, монтажёры, дизайнеры и все онлайн-профессии в одном месте.",
  } satisfies Tr,
  start: { uz: "Qo'shilish", ru: "Присоединиться" } satisfies Tr,
  login: { uz: "Kirish", ru: "Войти" } satisfies Tr,
  about: { uz: "Platforma haqida", ru: "О платформе" } satisfies Tr,

  suggested: { uz: "Siz uchun ijodkorlar", ru: "Авторы для вас" } satisfies Tr,
  seeAll: { uz: "Barchasi", ru: "Все" } satisfies Tr,
  activeGroups: { uz: "Faol jamoalar", ru: "Активные сообщества" } satisfies Tr,
  members: { uz: (n: number) => `${n} a'zo`, ru: (n: number) => `${n} участников` },
  newVacancies: { uz: "Yangi vakansiyalar", ru: "Новые вакансии" } satisfies Tr,
  nextLive: { uz: "Keyingi efir", ru: "Ближайший эфир" } satisfies Tr,
  openChannel: { uz: "Kanalni ochish", ru: "Открыть канал" } satisfies Tr,
  mapCard: { uz: "Ijodkorlar xaritasi", ru: "Карта авторов" } satisfies Tr,
  mapCardText: { uz: "14 ta hudud bo'yicha videograf, montajor va dizaynerlar — xaritada toping.", ru: "Видеографы, монтажёры и дизайнеры по 14 регионам — найдите на карте." } satisfies Tr,
  openMap: { uz: "Xaritani ochish", ru: "Открыть карту" } satisfies Tr,
  myProfile: { uz: "Mening profilim", ru: "Мой профиль" } satisfies Tr,
  cabinet: { uz: "Kabinet", ru: "Кабинет" } satisfies Tr,
};
