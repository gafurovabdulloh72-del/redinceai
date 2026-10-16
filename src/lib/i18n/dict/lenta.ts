/**
 * Lenta lug'ati (/lenta): sahifa sarlavhasi, bo'sh holat va Reels-lenta yorliqlari.
 */
import type { Tr } from "../index";

export const LENTA = {
  /* --------- Sahifa / bo'sh holat --------- */
  eyebrow: { uz: "Ishlar lentasi", ru: "Лента работ" } satisfies Tr,
  titleStart: { uz: "Ishlar", ru: "Работы" } satisfies Tr,
  titleAccent: { uz: "videoda", ru: "в видео" } satisfies Tr,
  description: { uz: "Mutaxassislarning video ishlari shu yerda Reels uslubida ko'rsatiladi.", ru: "Видеоработы специалистов показываются здесь в стиле Reels." } satisfies Tr,
  emptyTitle: { uz: "Lentada hali video ishlar yo'q", ru: "В ленте пока нет видеоработ" } satisfies Tr,
  emptyDesc: {
    uz: "Mutaxassislar portfoliosiga video qo'shishi bilan lenta jonlanadi. Hozircha katalogdan ijodkorlarni ko'rib chiqing.",
    ru: "Лента оживёт, как только специалисты добавят видео в портфолио. А пока посмотрите специалистов в каталоге.",
  } satisfies Tr,
  openCatalog: { uz: "Katalogni ochish", ru: "Открыть каталог" } satisfies Tr,
  srTitle: { uz: "Ishlar lentasi — mutaxassislarning video ishlari", ru: "Лента работ — видеоработы специалистов" } satisfies Tr,

  /* --------- Lenta (feed) --------- */
  feedAria: { uz: "Ishlar lentasi", ru: "Лента работ" } satisfies Tr,
  loadMore: { uz: "Yana yuklash", ru: "Загрузить ещё" } satisfies Tr,
  loading: { uz: "Yuklanmoqda…", ru: "Загрузка…" } satisfies Tr,
  endTitle: { uz: "Lenta shu yerda tugadi", ru: "Лента на этом закончилась" } satisfies Tr,
  endDesc: { uz: "Yangi ishlar qo'shilganda shu yerda paydo bo'ladi.", ru: "Новые работы появятся здесь, как только их добавят." } satisfies Tr,

  /* --------- Slayd --------- */
  soundOff: { uz: "Ovozni o'chirish", ru: "Выключить звук" } satisfies Tr,
  soundOn: { uz: "Ovozni yoqish", ru: "Включить звук" } satisfies Tr,
  play: { uz: "Videoni ijro etish", ru: "Воспроизвести видео" } satisfies Tr,
  workOf: { uz: (name: string) => `${name} ishi`, ru: (name: string) => `Работа: ${name}` },
  profileOf: { uz: (name: string) => `${name} profili`, ru: (name: string) => `Профиль: ${name}` },
  priceNegotiable: { uz: "Narx kelishiladi", ru: "Цена договорная" } satisfies Tr,
  profile: { uz: "Profil", ru: "Профиль" } satisfies Tr,
  order: { uz: "Buyurtma berish", ru: "Заказать" } satisfies Tr,
} as const;
