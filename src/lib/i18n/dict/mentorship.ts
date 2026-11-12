/**
 * Mentorlik ichki sahifalari lug'ati: katalog, kurs sahifasi, dars pleyeri, ustoz sahifasi, sertifikat
 * va `components/mentorship/*` komponentlari. uz matnlar sahifalardagi asl matn bilan AYNAN bir xil.
 * Qoida: `lib/mentorship/format.ts` yorliqlari (kategoriya/daraja/til/narx) o'zgartirilmaydi —
 * ularning ruscha varianti shu yerda `xxxTr(til, …)` xaritalari bilan beriladi.
 */
import type { Locale, Tr } from "../index";
import { ruPlural } from "./catalog";
import { COURSE_LEVELS, MENTOR_CATEGORIES, PURCHASE_LABEL, categoryLabel, formatDuration, formatSom, languageLabel, levelLabel, type PurchaseType } from "@/lib/mentorship/format";

/* ------------------------------------------------------------------ */
/* format.ts yorliqlarining tilga mos variantlari                       */
/* ------------------------------------------------------------------ */

const CATEGORY_RU: Record<string, string> = {
  montaj: "Видеомонтаж",
  videografiya: "Видеосъёмка",
  dizayn: "Графический дизайн",
  motion: "Моушн / анимация",
  foto: "Фотография",
  smm: "SMM / маркетинг",
  boshqa: "Другое",
};
/** Yo'nalish nomi: uz — categoryLabel; ru — xarita (topilmasa «Другое») */
export function categoryLabelTr(til: Locale, key: string): string {
  if (til !== "ru") return categoryLabel(key);
  return CATEGORY_RU[key] ?? (MENTOR_CATEGORIES.some((c) => c.key === key) ? key : CATEGORY_RU.boshqa);
}

const LEVEL_RU: Record<string, string> = { boshlangich: "Начальный", orta: "Средний", pro: "Профессиональный" };
export function levelLabelTr(til: Locale, key: string): string {
  if (til !== "ru") return levelLabel(key);
  return LEVEL_RU[key] ?? (COURSE_LEVELS.some((l) => l.key === key) ? key : key);
}

const LANGUAGE_RU: Record<string, string> = { uz: "Узбекский", ru: "Русский", en: "Английский" };
export function languageLabelTr(til: Locale, key: string): string {
  return til === "ru" ? (LANGUAGE_RU[key] ?? key) : languageLabel(key);
}

/** Narx: 0 → «Bepul»/«Бесплатно», aks holda «250 000 so'm»/«250 000 сум» */
export function formatSomTr(til: Locale, price: number): string {
  const uz = formatSom(price);
  if (til !== "ru") return uz;
  return uz === "Bepul" ? "Бесплатно" : uz.replace(/so'm$/, "сум");
}

/** Davomiylik: «1 soat 20 daq» → «1 ч 20 мин» */
export function formatDurationTr(til: Locale, min: number): string {
  if (til !== "ru") return formatDuration(min);
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

/** «N dars» / «N урок(а/ов)» */
export function lessonsTr(til: Locale, n: number): string {
  return til === "ru" ? `${n} ${ruPlural(n, ["урок", "урока", "уроков"])}` : `${n} dars`;
}
/** «N ta dars» / «N урок(ов)» (kurs sahifasi «ta» varianti) */
export function lessonsTaTr(til: Locale, n: number): string {
  return til === "ru" ? lessonsTr(til, n) : `${n} ta dars`;
}
/** «N talaba» / «N студент(ов)» */
export function studentsTr(til: Locale, n: number): string {
  return til === "ru" ? `${n} ${ruPlural(n, ["студент", "студента", "студентов"])}` : `${n} talaba`;
}
/** «N daq» / «N мин» */
export function minutesTr(til: Locale, n: number): string {
  return til === "ru" ? `${n} мин` : `${n} daq`;
}
/** «N sharh» / «N отзыв(ов)» */
export function reviewsTr(til: Locale, n: number): string {
  return til === "ru" ? `${n} ${ruPlural(n, ["отзыв", "отзыва", "отзывов"])}` : `${n} sharh`;
}
/** «N kurs» / «N курс(ов)» */
export function coursesTr(til: Locale, n: number): string {
  return til === "ru" ? `${n} ${ruPlural(n, ["курс", "курса", "курсов"])}` : `${n} kurs`;
}
/** «N bo'lim» / «N раздел(ов)» */
export function sectionsTr(til: Locale, n: number): string {
  return til === "ru" ? `${n} ${ruPlural(n, ["раздел", "раздела", "разделов"])}` : `${n} bo'lim`;
}
/** «N soniya» / «N секунд(ы)» */
export function secondsTr(til: Locale, n: number): string {
  return til === "ru" ? `${n} ${ruPlural(n, ["секунда", "секунды", "секунд"])}` : `${n} soniya`;
}

const PURCHASE_RU: Record<PurchaseType, string> = { course: "Курс", ticket: "Билет на эфир", sub: "Месячная подписка", consult: "Консультация", review: "Разбор работы" };
export function purchaseLabelTr(til: Locale, t: PurchaseType): string {
  return til === "ru" ? PURCHASE_RU[t] : PURCHASE_LABEL[t];
}

/** Kurs saralash yorliqlari (CourseFilters COURSE_SORTS kalitlari bo'yicha) */
const SORT_RU: Record<string, string> = { new: "Новые", popular: "Популярные", rating: "С высокой оценкой", cheap: "Дешевле", expensive: "Дороже" };
export function sortLabelTr(til: Locale, key: string, uz: string): string {
  return til === "ru" ? (SORT_RU[key] ?? uz) : uz;
}

/** Kurs kartasi belgisi: «Mashhur»/«Yangi» */
const BADGE_RU: Record<string, string> = { Mashhur: "Хит", Yangi: "Новый" };
export function badgeLabelTr(til: Locale, uz: string): string {
  return til === "ru" ? (BADGE_RU[uz] ?? uz) : uz;
}

/** Ustoz belgilari (growth.ts mentorBadges — uz manba o'zgarmaydi) */
const MENTOR_BADGE_RU: Record<string, string> = { "Ko'p o'rgatgan": "Опытный наставник", "Yuqori baho": "Высокая оценка", "Tez javob beradi": "Быстро отвечает", "Faol efirchi": "Активно ведёт эфиры" };
export function mentorBadgeLabelTr(til: Locale, uz: string): string {
  return til === "ru" ? (MENTOR_BADGE_RU[uz] ?? uz) : uz;
}

/** Hafta kunlari qisqartmasi (LearningStreak) */
export const WEEK_DAYS: Record<Locale, string[]> = {
  uz: ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
};

/* ------------------------------------------------------------------ */
/* Lug'at                                                              */
/* ------------------------------------------------------------------ */

export const MS = {
  /* Katalog */
  catalogTitle: { uz: "Mentorlik — ustozlardan o'rganing", ru: "Менторство — учитесь у наставников" } satisfies Tr,
  catalogDesc: { uz: "Tajribali videograf, montajchi va dizaynerlardan onlayn kurslar. Haqiqiy ustozlar dars beradi.", ru: "Онлайн-курсы от опытных видеографов, монтажёров и дизайнеров. Преподают настоящие наставники." } satisfies Tr,
  catalogH1: { uz: "Mentorlik", ru: "Менторство" } satisfies Tr,
  catalogLead: { uz: "Tajribali ustozlardan amaliy bilim — kurslar, jonli efirlar va 1:1 darslar.", ru: "Практические знания от опытных наставников — курсы, прямые эфиры и занятия 1:1." } satisfies Tr,
  searchPh: { uz: "Kurs qidirish…", ru: "Поиск курса…" } satisfies Tr,
  searchAria: { uz: "Kurs qidirish", ru: "Поиск курса" } satisfies Tr,
  myPage: { uz: "Mening sahifam", ru: "Моя страница" } satisfies Tr,
  becomeMentor: { uz: "Ustoz bo'lish", ru: "Стать наставником" } satisfies Tr,
  lives: { uz: "Efirlar", ru: "Эфиры" } satisfies Tr,
  liveChip: { uz: "Jonli", ru: "В эфире" } satisfies Tr,
  liveNow: { uz: "Hozir efirda", ru: "Сейчас в эфире" } satisfies Tr,
  directions: { uz: "Yo'nalishlar", ru: "Направления" } satisfies Tr,
  byQuery: { uz: (q: string) => `«${q}» bo'yicha`, ru: (q: string) => `По запросу «${q}»` },
  courses: { uz: "Kurslar", ru: "Курсы" } satisfies Tr,
  noMatch: { uz: "Bu shartlarga mos kurs yo'q", ru: "Курсов по этим условиям нет" } satisfies Tr,
  noCourses: { uz: "Hozircha kurs yo'q", ru: "Пока нет курсов" } satisfies Tr,
  clearFilters: { uz: "Filtrlarni tozalab ko'ring.", ru: "Попробуйте сбросить фильтры." } satisfies Tr,
  beFirst: { uz: "Birinchi bo'lib kurs oching — «Ustoz bo'lish».", ru: "Откройте первый курс — «Стать наставником»." } satisfies Tr,
  mentors: { uz: "Ustozlar", ru: "Наставники" } satisfies Tr,
  mentor: { uz: "Ustoz", ru: "Наставник" } satisfies Tr,

  /* CourseFilters */
  direction: { uz: "Yo'nalish", ru: "Направление" } satisfies Tr,
  all: { uz: "Barchasi", ru: "Все" } satisfies Tr,
  free: { uz: "Bepul", ru: "Бесплатно" } satisfies Tr,
  clear: { uz: "Tozalash", ru: "Сбросить" } satisfies Tr,

  /* Kurs sahifasi */
  courseNotFound: { uz: "Kurs topilmadi", ru: "Курс не найден" } satisfies Tr,
  metaSuffix: { uz: "Mentorlik", ru: "Менторство" } satisfies Tr,
  courseOf: { uz: (name: string) => `${name} kursi`, ru: (name: string) => `Курс от ${name}` },
  videoLessons: { uz: (d: string) => `${d} video dars`, ru: (d: string) => `${d} видеоуроков` },
  materialsN: { uz: (n: number) => `${n} ta yuklab olinadigan material`, ru: (n: number) => `${n} ${ruPlural(n, ["материал", "материала", "материалов"])} для скачивания` },
  quizN: { uz: (n: number) => `${n} ta bilim testi`, ru: (n: number) => `${n} ${ruPlural(n, ["тест", "теста", "тестов"])} на знания` },
  assignmentN: { uz: (n: number) => `${n} ta amaliy vazifa (ustoz tekshiradi)`, ru: (n: number) => `${n} ${ruPlural(n, ["практическое задание", "практических задания", "практических заданий"])} (проверяет наставник)` },
  onDevices: { uz: "Telefon va kompyuterda", ru: "На телефоне и компьютере" } satisfies Tr,
  unlimited: { uz: "Cheksiz kirish, o'z sur'atingizda", ru: "Бессрочный доступ, в своём темпе" } satisfies Tr,
  certOnFinish: { uz: "Tugatganingizda sertifikat", ru: "Сертификат по окончании" } satisfies Tr,
  freePreview: { uz: "Bepul namuna", ru: "Бесплатный урок" } satisfies Tr,
  opensAfterEnroll: { uz: (t: string) => `${t} — kursga yozilgach ochiladi`, ru: (t: string) => `${t} — откроется после записи на курс` },
  video: { uz: "video", ru: "видео" } satisfies Tr,
  inLanguage: { uz: (l: string) => `${l} tilida`, ru: (l: string) => `${l} язык` },
  updated: { uz: "Yangilangan", ru: "Обновлено" } satisfies Tr,
  certGiven: { uz: "Sertifikat beriladi", ru: "Выдаётся сертификат" } satisfies Tr,
  includes: { uz: "Bu kursga kiradi", ru: "Что входит в курс" } satisfies Tr,
  tgJoin: { uz: "Kurs guruhiga qo'shilish", ru: "Вступить в группу курса" } satisfies Tr,
  tgJoinHint: { uz: "Savollar, e'lonlar va boshqa o'quvchilar — Telegramda", ru: "Вопросы, объявления и другие ученики — в Telegram" } satisfies Tr,
  refundGuarantee: { uz: (d: number) => `${d} kun ichida pulni qaytarish kafolati`, ru: (d: number) => `Гарантия возврата денег в течение ${d} дн.` },
  lessonsHead: { uz: "Darslar", ru: "Уроки" } satisfies Tr,
  sectionN: { uz: (n: number) => `${n}-modul`, ru: (n: number) => `Модуль ${n}` },
  doneOf: { uz: (a: number, b: number) => `${a}/${b} bajarildi`, ru: (a: number, b: number) => `${a}/${b} пройдено` },
  lessonsSoon: { uz: "Darslar tez orada qo'shiladi.", ru: "Уроки скоро появятся." } satisfies Tr,
  outcomes: { uz: "Nimalarni o'rganasiz", ru: "Чему вы научитесь" } satisfies Tr,
  requirements: { uz: "Talablar", ru: "Требования" } satisfies Tr,
  audience: { uz: "Kimlar uchun", ru: "Для кого" } satisfies Tr,
  reviews: { uz: "Sharhlar", ru: "Отзывы" } satisfies Tr,
  ratingDist: { uz: "Reyting taqsimoti", ru: "Распределение оценок" } satisfies Tr,
  noReviews: { uz: "Hali sharh yo'q.", ru: "Отзывов пока нет." } satisfies Tr,
  progress: { uz: "Progress", ru: "Прогресс" } satisfies Tr,
  editCourse: { uz: "Kursni tahrirlash", ru: "Редактировать курс" } satisfies Tr,
  similar: { uz: "O'xshash kurslar", ru: "Похожие курсы" } satisfies Tr,
  enroll: { uz: "Kursga yozilish", ru: "Записаться на курс" } satisfies Tr,
  startFree: { uz: "Bepul boshlash", ru: "Начать бесплатно" } satisfies Tr,

  /* CoursePreview */
  freeSample: { uz: "Bepul namuna:", ru: "Бесплатный урок:" } satisfies Tr,
  sampleCopied: { uz: "Namuna havolasi nusxalandi — kursga yozilmaganlarga ham ochiladi", ru: "Ссылка на урок скопирована — откроется даже без записи на курс" } satisfies Tr,
  copySample: { uz: "Namuna havolasini nusxalash", ru: "Скопировать ссылку на урок" } satisfies Tr,
  share: { uz: "Ulashish", ru: "Поделиться" } satisfies Tr,
  goToLesson: { uz: "Darsga o'tish", ru: "Перейти к уроку" } satisfies Tr,
  previewCourse: { uz: "Kursni ko'rib chiqish", ru: "Посмотреть курс" } satisfies Tr,

  /* CourseReviewForm */
  notSent: { uz: "Yuborilmadi", ru: "Не отправлено" } satisfies Tr,
  reviewUpdated: { uz: "Sharh yangilandi", ru: "Отзыв обновлён" } satisfies Tr,
  reviewThanks: { uz: "Sharhingiz uchun rahmat 🙌", ru: "Спасибо за отзыв 🙌" } satisfies Tr,
  error: { uz: "Xatolik", ru: "Ошибка" } satisfies Tr,
  yourReview: { uz: "Sharhingiz", ru: "Ваш отзыв" } satisfies Tr,
  rateCourse: { uz: "Kursni baholang", ru: "Оцените курс" } satisfies Tr,
  stars: { uz: (n: number) => `${n} yulduz`, ru: (n: number) => `${n} ${ruPlural(n, ["звезда", "звезды", "звёзд"])}` },
  reviewPh: { uz: "Kurs haqida fikringiz (ixtiyoriy)…", ru: "Ваше мнение о курсе (необязательно)…" } satisfies Tr,
  update: { uz: "Yangilash", ru: "Обновить" } satisfies Tr,
  send: { uz: "Yuborish", ru: "Отправить" } satisfies Tr,

  /* CourseSaveButton */
  notSaved: { uz: "Saqlanmadi", ru: "Не сохранено" } satisfies Tr,
  savedToast: { uz: "Saqlandi — Kabinet → Saqlanganlar → Kurslar", ru: "Сохранено — Кабинет → Сохранённое → Курсы" } satisfies Tr,
  unsave: { uz: "Saqlanganlardan olish", ru: "Убрать из сохранённого" } satisfies Tr,
  saveCourse: { uz: "Kursni saqlash", ru: "Сохранить курс" } satisfies Tr,
  saved: { uz: "Saqlangan", ru: "Сохранено" } satisfies Tr,
  save: { uz: "Saqlash", ru: "Сохранить" } satisfies Tr,

  /* EnrollButton */
  continue: { uz: "Davom etish", ru: "Продолжить" } satisfies Tr,
  enrolled: { uz: "Siz yozilgansiz", ru: "Вы записаны" } satisfies Tr,
  buy: { uz: "Sotib olish", ru: "Купить" } satisfies Tr,
  enrollFailed: { uz: "Yozilib bo'lmadi", ru: "Не удалось записаться" } satisfies Tr,
  enrolledToast: { uz: "Kursga yozildingiz 🎓", ru: "Вы записаны на курс 🎓" } satisfies Tr,

  /* LearningStreak */
  streakAria: { uz: "O'quv seriyasi", ru: "Учебная серия" } satisfies Tr,
  streakGreat: { uz: "Ajoyib! Bir haftadan oshdi — shu zaylda davom eting.", ru: "Отлично! Больше недели подряд — продолжайте в том же духе." } satisfies Tr,
  streakDone: { uz: "Bugungi dars bajarildi. Ertaga ham qaytib seriyani saqlang.", ru: "Сегодняшний урок пройден. Возвращайтесь завтра, чтобы сохранить серию." } satisfies Tr,
  streakKeep: { uz: "Bugun hali dars tugatilmadi — seriya uzilmasin!", ru: "Сегодня урок ещё не пройден — не прерывайте серию!" } satisfies Tr,
  streakStart: { uz: "Har kuni bitta dars — bir oyda butun kurs. Bugun boshlang.", ru: "Один урок в день — весь курс за месяц. Начните сегодня." } satisfies Tr,
  streakDays: { uz: (n: number) => `${n} kunlik seriya`, ru: (n: number) => `Серия: ${n} ${ruPlural(n, ["день", "дня", "дней"])}` },
  streakNone: { uz: "Seriya boshlanmagan", ru: "Серия не начата" } satisfies Tr,
  record: { uz: "rekord", ru: "рекорд" } satisfies Tr,
  weekDays: { uz: "Hafta kunlari", ru: "Дни недели" } satisfies Tr,
  dayDone: { uz: " — bajarilgan", ru: " — пройдено" } satisfies Tr,

  /* LessonComplete */
  certReady: { uz: "Tabriklaymiz! Kurs tugadi — sertifikat tayyor 🎓", ru: "Поздравляем! Курс завершён — сертификат готов 🎓" } satisfies Tr,
  streakToast: { uz: (n: number) => `🔥 ${n} kunlik seriya — shu zaylda davom eting!`, ru: (n: number) => `🔥 Серия ${n} ${ruPlural(n, ["день", "дня", "дней"])} — так держать!` },
  markedNext: { uz: "Dars belgilandi — keyingisiga o'ting", ru: "Урок отмечен — переходите к следующему" } satisfies Tr,
  completed: { uz: "Tugatildi", ru: "Пройдено" } satisfies Tr,
  markDone: { uz: "Tugatdim", ru: "Пройдено" } satisfies Tr,

  /* Dars sahifasi */
  lesson: { uz: "Dars", ru: "Урок" } satisfies Tr,
  materials: { uz: "Materiallar", ru: "Материалы" } satisfies Tr,
  test: { uz: "Test", ru: "Тест" } satisfies Tr,
  assignment: { uz: "Vazifa", ru: "Задание" } satisfies Tr,
  qa: { uz: "Savol-javob", ru: "Вопросы и ответы" } satisfies Tr,
  notes: { uz: "Eslatmalar", ru: "Заметки" } satisfies Tr,
  lessonOf: { uz: (pos: number, total: number) => `${pos}-dars · ${total} tadan`, ru: (pos: number, total: number) => `Урок ${pos} из ${total}` },
  passQuizFirst: { uz: "Avval dars testidan o'ting", ru: "Сначала пройдите тест урока" } satisfies Tr,
  nextLesson: { uz: "Keyingi dars", ru: "Следующий урок" } satisfies Tr,
  previewNote: { uz: "Bu — bepul namuna. To'liq kursga", ru: "Это бесплатный урок. Чтобы открыть весь курс," } satisfies Tr,
  previewLink: { uz: "yoziling", ru: "запишитесь" } satisfies Tr,
  courseDoneCert: { uz: "Kurs tugatildi — sertifikatni oching", ru: "Курс завершён — откройте сертификат" } satisfies Tr,
  rateCourseBtn: { uz: "Kursga baho bering", ru: "Оцените курс" } satisfies Tr,

  /* LessonExtras */
  quizTitle: { uz: "Dars testi", ru: "Тест урока" } satisfies Tr,
  passPct: { uz: "o'tish:", ru: "проходной балл:" } satisfies Tr,
  passed: { uz: "O'tilgan", ru: "Пройден" } satisfies Tr,
  quizPassed: { uz: (pct: number) => `Test topshirildi: ${pct}% 🎉`, ru: (pct: number) => `Тест сдан: ${pct}% 🎉` },
  quizFail: { uz: (s: number, p: number) => `${s}% — yetarli emas (${p}% kerak). Qizil savollarni qayta ko'rib chiqing.`, ru: (s: number, p: number) => `${s}% — недостаточно (нужно ${p}%). Пересмотрите вопросы, выделенные красным.` },
  check: { uz: "Tekshirish", ru: "Проверить" } satisfies Tr,
  attachedFile: { uz: "Biriktirilgan fayl", ru: "Прикреплённый файл" } satisfies Tr,
  uploadFailed: { uz: "Yuklanmadi", ru: "Не загружено" } satisfies Tr,
  assignmentSent: { uz: "Vazifa topshirildi", ru: "Задание отправлено" } satisfies Tr,
  homework: { uz: "Uy vazifasi", ru: "Домашнее задание" } satisfies Tr,
  graded: { uz: "Baholandi", ru: "Оценено" } satisfies Tr,
  needsWork: { uz: "Qayta ishlash kerak", ru: "Нужно доработать" } satisfies Tr,
  reviewing: { uz: "Ustoz ko'rib chiqmoqda…", ru: "Наставник проверяет…" } satisfies Tr,
  answerPh: { uz: "Javobingiz, havola yoki izoh…", ru: "Ваш ответ, ссылка или комментарий…" } satisfies Tr,
  attachFile: { uz: "Fayl biriktirish", ru: "Прикрепить файл" } satisfies Tr,
  resend: { uz: "Qayta yuborish", ru: "Отправить заново" } satisfies Tr,
  submit: { uz: "Topshirish", ru: "Отправить" } satisfies Tr,

  /* LessonNotes */
  noteTimeHint: { uz: "Yozish boshlanganda videodagi vaqt saqlanadi", ru: "Время видео сохраняется в момент начала записи" } satisfies Tr,
  notePrivate: { uz: "Shaxsiy qayd — faqat sizga ko'rinadi", ru: "Личная заметка — видна только вам" } satisfies Tr,
  notePh: { uz: "Eslatma yozing…", ru: "Напишите заметку…" } satisfies Tr,
  note: { uz: "Eslatma", ru: "Заметка" } satisfies Tr,
  noNotes: { uz: "Hali eslatma yo'q. Videoni ko'rayotib muhim joylarni yozib boring — vaqt belgisi bilan saqlanadi.", ru: "Заметок пока нет. Записывайте важные моменты во время просмотра — они сохранятся с отметкой времени." } satisfies Tr,
  seekTo: { uz: (t: string) => `${t} ga o'tish`, ru: (t: string) => `Перейти к ${t}` },
  deleteNote: { uz: "Eslatmani o'chirish", ru: "Удалить заметку" } satisfies Tr,

  /* LessonPlayer */
  nextIn: { uz: (s: string) => `Keyingi darsga o'tish — ${s}`, ru: (s: string) => `Перейти к следующему уроку — ${s}` },
  afterSeconds: { uz: (s: string) => `${s}dan keyin`, ru: (s: string) => `через ${s}` },
  cancel: { uz: "Bekor qilish", ru: "Отмена" } satisfies Tr,
  autoNextOff: { uz: "Avto-o'tishni o'chirish", ru: "Отключить автопереход" } satisfies Tr,
  speed: { uz: "Tezlik:", ru: "Скорость:" } satisfies Tr,

  /* LessonQA */
  mentorTag: { uz: "USTOZ", ru: "НАСТАВНИК" } satisfies Tr,
  helpful: { uz: "foydali", ru: "полезно" } satisfies Tr,
  reply: { uz: "Javob yozish", ru: "Ответить" } satisfies Tr,
  unmarkHelpful: { uz: "Belgini olib tashlash", ru: "Снять отметку" } satisfies Tr,
  markHelpful: { uz: "Foydali deb belgilash", ru: "Отметить как полезный" } satisfies Tr,
  delete: { uz: "O'chirish", ru: "Удалить" } satisfies Tr,
  qaTitle: { uz: "Savol va javoblar", ru: "Вопросы и ответы" } satisfies Tr,
  questionPh: { uz: "Savolingizni yozing…", ru: "Напишите ваш вопрос…" } satisfies Tr,
  question: { uz: "Savol", ru: "Вопрос" } satisfies Tr,
  noQuestions: { uz: "Hali savol yo'q — birinchi bo'ling.", ru: "Вопросов пока нет — будьте первым." } satisfies Tr,
  replyPh: { uz: "Javobingiz…", ru: "Ваш ответ…" } satisfies Tr,
  answer: { uz: "Javob", ru: "Ответ" } satisfies Tr,

  /* LessonSidebar / LessonTabs */
  courseLessons: { uz: "Kurs darslari", ru: "Уроки курса" } satisfies Tr,
  courseProgress: { uz: "Kurs progressi", ru: "Прогресс курса" } satisfies Tr,
  noSection: { uz: "Modulsiz", ru: "Без модуля" } satisfies Tr,
  lockedHint: { uz: "Kursga yozilgach ochiladi", ru: "Откроется после записи на курс" } satisfies Tr,
  lessonTabs: { uz: "Dars bo'limlari", ru: "Разделы урока" } satisfies Tr,
  newReply: { uz: "yangi javob", ru: "новый ответ" } satisfies Tr,
  attention: { uz: "diqqat", ru: "внимание" } satisfies Tr,

  /* PurchaseDialog */
  cardTransfer: { uz: "Karta o'tkazmasi", ru: "Перевод на карту" } satisfies Tr,
  quoteFailed: { uz: "Narxni hisoblab bo'lmadi", ru: "Не удалось рассчитать цену" } satisfies Tr,
  tgFailed: { uz: "Telegram ochilmadi", ru: "Не удалось открыть Telegram" } satisfies Tr,
  tgLinkFirst: { uz: "Avval botga ulaning — «Start» bosing, so'ng bu tugmani qayta bosing", ru: "Сначала подключите бота — нажмите «Start», затем нажмите эту кнопку снова" } satisfies Tr,
  payFailed: { uz: "To'lov boshlanmadi", ru: "Оплата не началась" } satisfies Tr,
  accessOpened: { uz: "Tayyor — kirish ochildi 🎉", ru: "Готово — доступ открыт 🎉" } satisfies Tr,
  confirmPurchase: { uz: "Xaridni tasdiqlash", ru: "Подтверждение покупки" } satisfies Tr,
  price: { uz: "Narx", ru: "Цена" } satisfies Tr,
  promoRow: { uz: (code: string, pct: number) => `Promokod ${code} (−${pct}%)`, ru: (code: string, pct: number) => `Промокод ${code} (−${pct}%)` },
  refRow: { uz: (pct: number) => `Do'st chegirmasi (−${pct}%)`, ru: (pct: number) => `Скидка по приглашению (−${pct}%)` },
  credit: { uz: "Kredit", ru: "Кредит" } satisfies Tr,
  total: { uz: "Jami", ru: "Итого" } satisfies Tr,
  promo: { uz: "Promokod", ru: "Промокод" } satisfies Tr,
  apply: { uz: "Qo'llash", ru: "Применить" } satisfies Tr,
  useCredit: { uz: (b: string) => `Kreditdan foydalanish (balans: ${b})`, ru: (b: string) => `Использовать кредит (баланс: ${b})` },
  payMethod: { uz: "To'lov usuli", ru: "Способ оплаты" } satisfies Tr,
  noProviders: { uz: "To'lov usullari hali ulanmagan — administrator bilan bog'laning.", ru: "Способы оплаты ещё не подключены — свяжитесь с администратором." } satisfies Tr,
  pay: { uz: (sum: string) => `To'lash — ${sum}`, ru: (sum: string) => `Оплатить — ${sum}` },
  payTelegram: { uz: "Telegramda to'lash", ru: "Оплатить в Telegram" } satisfies Tr,

  /* PurchaseStatus */
  thanksAdmin: { uz: "Rahmat! Administrator o'tkazmani tasdiqlaydi", ru: "Спасибо! Администратор подтвердит перевод" } satisfies Tr,
  paymentAccepted: { uz: "To'lov qabul qilindi", ru: "Оплата принята" } satisfies Tr,
  nowOpen: { uz: (t: string) => `${t} — endi sizga ochiq.`, ru: (t: string) => `${t} — теперь доступно вам.` },
  refunded: { uz: "To'lov qaytarilgan", ru: "Оплата возвращена" } satisfies Tr,
  cancelled: { uz: "To'lov bekor qilingan", ru: "Оплата отменена" } satisfies Tr,
  back: { uz: "Orqaga", ru: "Назад" } satisfies Tr,
  awaitingConfirm: { uz: "O'tkazma tasdiqlashni kutmoqda — administrator ko'rib chiqadi, odatda bir necha soat ichida.", ru: "Перевод ожидает подтверждения — администратор проверит, обычно в течение нескольких часов." } satisfies Tr,
  transferTo: { uz: "Kartaga o'tkazing:", ru: "Переведите на карту:" } satisfies Tr,
  iPaid: { uz: "To'ladim", ru: "Я оплатил(а)" } satisfies Tr,
  awaitingPayment: { uz: "To'lov kutilmoqda…", ru: "Ожидание оплаты…" } satisfies Tr,
  goToPay: { uz: "To'lashga o'tish", ru: "Перейти к оплате" } satisfies Tr,

  /* ConsultJoin */
  joinConsult: { uz: "Konsultatsiyaga kirish", ru: "Войти в консультацию" } satisfies Tr,
  consultOver: { uz: "Konsultatsiya vaqti tugagan.", ru: "Время консультации истекло." } satisfies Tr,
  consultEarly: { uz: (t: string) => `Tugma ${t} dan ochiladi (boshlanishiga 10 daqiqa qolganda, Toshkent vaqti).`, ru: (t: string) => `Кнопка откроется в ${t} (за 10 минут до начала, время Ташкента).` },

  /* Ustoz sahifasi */
  mentorNotFound: { uz: "Ustoz topilmadi", ru: "Наставник не найден" } satisfies Tr,
  mentorMeta: { uz: (n: string) => `${n} — ustoz`, ru: (n: string) => `${n} — наставник` },
  tabPosts: { uz: "Postlar", ru: "Посты" } satisfies Tr,
  tabCourses: { uz: "Kurslar", ru: "Курсы" } satisfies Tr,
  tabLives: { uz: "Efirlar", ru: "Эфиры" } satisfies Tr,
  tabChat: { uz: "Muhokama", ru: "Обсуждение" } satisfies Tr,
  breadcrumb: { uz: "Yo'l", ru: "Навигация" } satisfies Tr,
  mentorship: { uz: "Mentorlik", ru: "Менторство" } satisfies Tr,
  followersL: { uz: "obunachi", ru: "подписчиков" } satisfies Tr,
  coursesL: { uz: "kurs", ru: "курсов" } satisfies Tr,
  studentsL: { uz: "talaba", ru: "студентов" } satisfies Tr,
  ratingL: { uz: "reyting", ru: "рейтинг" } satisfies Tr,
  liveJoin: { uz: "Hozir jonli efirda — qo'shilish", ru: "Сейчас в прямом эфире — присоединиться" } satisfies Tr,
  subscribedUntil: { uz: (d: string) => `✓ Obunachisiz · ${d} gacha`, ru: (d: string) => `✓ Вы подписаны · до ${d}` },
  subscribe: { uz: (p: string) => `Obuna — ${p}/oy`, ru: (p: string) => `Подписка — ${p}/мес` },
  startLive: { uz: "Efir boshlash", ru: "Начать эфир" } satisfies Tr,
  settings: { uz: "Sozlash", ru: "Настроить" } satisfies Tr,
  mentorTabsAria: { uz: "Ustoz bo'limlari", ru: "Разделы наставника" } satisfies Tr,
  channelNotReady: { uz: "Kanal hali tayyor emas.", ru: "Канал ещё не готов." } satisfies Tr,
  pctDone: { uz: (p: number) => `${p}% tugatilgan`, ru: (p: number) => `${p}% пройдено` },
  noOpenCourses: { uz: "Hozircha ochiq kurs yo'q.", ru: "Пока нет открытых курсов." } satisfies Tr,
  studentsWork: { uz: "Talabalar ishi", ru: "Работы студентов" } satisfies Tr,
  myConsults: { uz: "Mening konsultatsiyalarim", ru: "Мои консультации" } satisfies Tr,
  open: { uz: "Ochish", ru: "Открыть" } satisfies Tr,
  consultTitle: { uz: "1:1 konsultatsiya", ru: "Консультация 1:1" } satisfies Tr,
  consultLead: { uz: "Vaqtni tanlang, to'lang — belgilangan soatda video qo'ng'iroq shu yerda ochiladi.", ru: "Выберите время, оплатите — в назначенный час видеозвонок откроется здесь." } satisfies Tr,
  noSlots: { uz: "Hozircha bo'sh vaqt yo'q.", ru: "Свободного времени пока нет." } satisfies Tr,
  addSlotsHint: { uz: " Vaqtlarni «Daromad va sozlamalar» sahifasida qo'shing.", ru: " Добавьте время на странице «Доход и настройки»." } satisfies Tr,
  book: { uz: "Band qilish", ru: "Забронировать" } satisfies Tr,
  pastLives: { uz: "O'tgan jonli efirlar", ru: "Прошедшие эфиры" } satisfies Tr,
  viewers: { uz: (n: number) => `${n} tomoshabin`, ru: (n: number) => `${n} ${ruPlural(n, ["зритель", "зрителя", "зрителей"])}` },
  joinToChat: { uz: "Muhokamada qatnashish uchun ustoz kanaliga obuna bo'ling.", ru: "Чтобы участвовать в обсуждении, подпишитесь на канал наставника." } satisfies Tr,

  /* Sertifikat */
  certNotFound: { uz: "Sertifikat topilmadi", ru: "Сертификат не найден" } satisfies Tr,
  certTitle: { uz: (s: string, c: string) => `${s} — ${c} sertifikati`, ru: (s: string, c: string) => `${s} — сертификат по курсу «${c}»` },
  certDesc: { uz: (s: string, c: string, code: string) => `${s} «${c}» kursini muvaffaqiyatli tugatdi. Sertifikat raqami ${code}.`, ru: (s: string, c: string, code: string) => `${s} успешно завершил(а) курс «${c}». Номер сертификата ${code}.` },
  certValid: { uz: "✓ Sertifikat haqiqiy — Kasb Egalari platformasi tomonidan berilgan", ru: "✓ Сертификат подлинный — выдан платформой Kasb Egalari" } satisfies Tr,
  certificate: { uz: "Sertifikat", ru: "Сертификат" } satisfies Tr,
  certHolder: { uz: "Ushbu sertifikat egasi", ru: "Настоящим подтверждается, что" } satisfies Tr,
  certConfirms: { uz: "quyidagi kursni muvaffaqiyatli tugatganini tasdiqlaydi", ru: "успешно завершил(а) курс" } satisfies Tr,
  certLessons: { uz: (n: number) => `${n} ta dars · barcha testlar muvaffaqiyatli topshirilgan`, ru: (n: number) => `${lessonsTr("ru", n)} · все тесты успешно сданы` },
  issuedAt: { uz: "Berilgan sana", ru: "Дата выдачи" } satisfies Tr,
  certNo: { uz: "Sertifikat raqami", ru: "Номер сертификата" } satisfies Tr,
  coursePage: { uz: "Kurs sahifasi", ru: "Страница курса" } satisfies Tr,
  mentorPage: { uz: "Ustoz sahifasi", ru: "Страница наставника" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* MENTOR KABINETI (ustoz tomonidagi boshqaruv): /kabinet/mentorlik/*  */
/* va MentorDashboard/MentorMoney/MentorNav/MentorStudio/CourseEditor/ */
/* LessonForm/RoadmapManager/SubmissionsReview/ReferralCard/PrintButton */
/* ------------------------------------------------------------------ */

const MONEY_STATUS_RU: Record<string, string> = { pending: "Удерживается", available: "Готово к выводу", paid_out: "Выведено", refunded: "Возвращено", requested: "В ожидании", paid: "Выплачено", rejected: "Отклонено" };
const MONEY_STATUS_UZ: Record<string, string> = { pending: "Ushlab turilmoqda", available: "Yechishga tayyor", paid_out: "Yechilgan", refunded: "Qaytarilgan", requested: "Kutilmoqda", paid: "To'langan", rejected: "Rad etilgan" };
/** Daromad/yechish holati (MentorMoney STATUS xaritasi) */
export function moneyStatusTr(til: Locale, status: string): string {
  return (til === "ru" ? MONEY_STATUS_RU : MONEY_STATUS_UZ)[status] ?? status;
}

/** «N ta» → ru: faqat son (so'z keyin keladi) — «12 ta» / «12» */
export function countTa(til: Locale, n: number): string {
  return til === "ru" ? String(n) : `${n} ta`;
}

export const MK = {
  /* MentorNav */
  navAria: { uz: "Mentorlik bo'limlari", ru: "Разделы наставника" } satisfies Tr,
  navOverview: { uz: "Kurslarim", ru: "Мои курсы" } satisfies Tr,
  navPage: { uz: "Sahifam", ru: "Моя страница" } satisfies Tr,
  navMoney: { uz: "Daromad", ru: "Доход" } satisfies Tr,
  tgGroup: { uz: "Kurs guruhi (Telegram)", ru: "Группа курса (Telegram)" } satisfies Tr,
  tgGroupHint: { uz: "— faqat o'quvchilarga ko'rinadi", ru: "— видна только ученикам" } satisfies Tr,
  wizOpen: { uz: "Yangi kurs", ru: "Новый курс" } satisfies Tr,
  wizTitle: { uz: "Yangi kurs — 3 qadam", ru: "Новый курс — 3 шага" } satisfies Tr,
  wizStepName: { uz: "Nom", ru: "Название" } satisfies Tr,
  wizStepPrice: { uz: "Narx", ru: "Цена" } satisfies Tr,
  wizStepLesson: { uz: "Birinchi dars", ru: "Первый урок" } satisfies Tr,
  wizNameLabel: { uz: "Kurs nomi", ru: "Название курса" } satisfies Tr,
  wizSummaryLabel: { uz: "Bir jumlada: nimani o'rgatasiz?", ru: "Одним предложением: чему научите?" } satisfies Tr,
  wizSummaryPh: { uz: "Masalan: telefonda to'y videosini 0 dan montaj qilishni o'rgataman", ru: "Например: научу монтировать свадебное видео на телефоне с нуля" } satisfies Tr,
  wizOptional: { uz: "(ixtiyoriy)", ru: "(необязательно)" } satisfies Tr,
  wizFree: { uz: "Bepul", ru: "Бесплатно" } satisfies Tr,
  wizFreeHint: { uz: "Ko'proq o'quvchi va obunachi yig'ish uchun", ru: "Чтобы собрать больше учеников и подписчиков" } satisfies Tr,
  wizPaid: { uz: "Pullik", ru: "Платно" } satisfies Tr,
  wizPaidHint: { uz: "Payme, Click yoki karta orqali sotiladi", ru: "Продаётся через Payme, Click или карту" } satisfies Tr,
  wizPriceHint: { uz: "Narxni keyin ham o'zgartirsa bo'ladi. Platforma komissiyasi sotuvdan ushlanadi.", ru: "Цену можно изменить позже. Комиссия платформы удерживается с продажи." } satisfies Tr,
  wizLessonLead: { uz: "Birinchi dars hammaga BEPUL namuna bo'lib ko'rinadi — odamlar kursni shu orqali tanlaydi.", ru: "Первый урок будет БЕСПЛАТНЫМ превью для всех — по нему люди выбирают курс." } satisfies Tr,
  wizPickVideo: { uz: "Dars videosini tanlang", ru: "Выберите видео урока" } satisfies Tr,
  wizVideoHint: { uz: "MP4, MOV yoki WEBM", ru: "MP4, MOV или WEBM" } satisfies Tr,
  wizVideoOnly: { uz: "Faqat video fayl", ru: "Только видеофайл" } satisfies Tr,
  wizLessonName: { uz: "Dars nomi", ru: "Название урока" } satisfies Tr,
  wizFirstLessonDefault: { uz: "Kirish: kurs haqida", ru: "Введение: о курсе" } satisfies Tr,
  wizLater: { uz: "Videoni hozir yuklamasangiz ham bo'ladi — kurs qoralama bo'lib saqlanadi, keyin tahrirlagichda qo'shasiz.", ru: "Видео можно добавить позже — курс сохранится как черновик." } satisfies Tr,
  wizBack: { uz: "Orqaga", ru: "Назад" } satisfies Tr,
  wizNext: { uz: "Davom etish", ru: "Далее" } satisfies Tr,
  wizCreate: { uz: "Kursni yaratish", ru: "Создать курс" } satisfies Tr,
  wizPublish: { uz: "Kursni joylash", ru: "Опубликовать курс" } satisfies Tr,
  wizDonePublished: { uz: "Kurs joylandi! Endi qolgan darslarni qo'shing.", ru: "Курс опубликован! Добавьте остальные уроки." } satisfies Tr,
  wizDoneDraft: { uz: "Kurs qoralama sifatida saqlandi. Dars qo'shib, chop eting.", ru: "Курс сохранён как черновик. Добавьте урок и опубликуйте." } satisfies Tr,
  navTasks: { uz: "O'quvchilar", ru: "Ученики" } satisfies Tr,

  /* Umumiy sahifa */
  mentorshipTitle: { uz: "Mentorlik", ru: "Менторство" } satisfies Tr,
  mentorshipLead: { uz: "Kurslaringiz, talabalar va daromad — hammasi shu yerda", ru: "Ваши курсы, студенты и доход — всё здесь" } satisfies Tr,
  postAndLive: { uz: "Post va efir qo'yish", ru: "Пост и эфир" } satisfies Tr,
  viewPage: { uz: "Sahifani ko'rish", ru: "Открыть страницу" } satisfies Tr,
  roadmaps: { uz: "Yo'l xaritalari", ru: "Дорожные карты" } satisfies Tr,
  roadmapsHint: { uz: "Kurslarni ketma-ketlikka yig'ing — talaba keyingi qadamni ko'radi", ru: "Выстройте курсы в последовательность — студент увидит следующий шаг" } satisfies Tr,
  myCourses: { uz: "Mening kurslarim", ru: "Мои курсы" } satisfies Tr,
  myCoursesLead: { uz: "Yozilgan kurslaringiz va o'qish jarayoni", ru: "Курсы, на которые вы записаны, и ход обучения" } satisfies Tr,
  notEnrolled: { uz: "Hali kursga yozilmagansiz", ru: "Вы ещё не записались ни на один курс" } satisfies Tr,
  notEnrolledHint: { uz: "Tajribali ustozlardan amaliy kurslar — bepul namunalar bilan. Birini tanlab ko'ring.", ru: "Практические курсы от опытных наставников — с бесплатными уроками. Выберите один и попробуйте." } satisfies Tr,
  browseCourses: { uz: "Kurslarni ko'rish", ru: "Смотреть курсы" } satisfies Tr,
  wantMentor: { uz: "Ustoz bo'lmoqchimisiz?", ru: "Хотите стать наставником?" } satisfies Tr,
  applyPending: { uz: "Arizangiz ko'rib chiqilmoqda", ru: "Ваша заявка рассматривается" } satisfies Tr,
  applyInvite: { uz: "Bilimingizni ulashing va kurs ochib daromad qiling", ru: "Делитесь знаниями, откройте курс и зарабатывайте" } satisfies Tr,

  /* MentorDashboard */
  enrolledCourses: { uz: "O'qiyotgan kurslarim", ru: "Курсы, которые я прохожу" } satisfies Tr,
  applyNeed: { uz: "Unvon (8+), bio (40+) va kamida 1 yo'nalish kerak", ru: "Нужны звание (8+), описание (40+) и хотя бы 1 направление" } satisfies Tr,
  notSent: { uz: "Yuborilmadi", ru: "Не отправлено" } satisfies Tr,
  applySent: { uz: "Arizangiz yuborildi — admin ko'rib chiqadi", ru: "Заявка отправлена — администратор её рассмотрит" } satisfies Tr,
  error: { uz: "Xatolik", ru: "Ошибка" } satisfies Tr,
  applyReviewing: { uz: "Arizangiz ko'rib chiqilmoqda. Tasdiqlangach kurs ocha olasiz.", ru: "Ваша заявка рассматривается. После одобрения вы сможете открыть курс." } satisfies Tr,
  beMentor: { uz: "O'z sohangizda ustoz bo'ling", ru: "Станьте наставником в своей сфере" } satisfies Tr,
  beMentorLead: { uz: "Bilimingizni ulashing, kurs oching va obunachilar yig'ing. Ariza yuboring — admin tasdiqlaydi.", ru: "Делитесь знаниями, откройте курс и собирайте подписчиков. Отправьте заявку — администратор её одобрит." } satisfies Tr,
  headline: { uz: "Qisqa unvon", ru: "Короткое звание" } satisfies Tr,
  headlinePh: { uz: "10 yillik montajchi · Premiere Pro ustasi", ru: "Монтажёр с 10-летним стажем · мастер Premiere Pro" } satisfies Tr,
  aboutYou: { uz: "O'zingiz haqingizda", ru: "О себе" } satisfies Tr,
  aboutYouPh: { uz: "Tajribangiz, ishlaringiz, nima o'rgatasiz…", ru: "Ваш опыт, работы, чему учите…" } satisfies Tr,
  directionsUpTo: { uz: "Yo'nalishlar (6 tagacha)", ru: "Направления (до 6)" } satisfies Tr,
  updateApply: { uz: "Arizani yangilash", ru: "Обновить заявку" } satisfies Tr,
  sendApply: { uz: "Ariza yuborish", ru: "Отправить заявку" } satisfies Tr,

  /* MentorStudio: stats, page form, sections */
  statSections: { uz: "Kurslar", ru: "Курсы" } satisfies Tr,
  statOpen: { uz: "Ochiq", ru: "Открытые" } satisfies Tr,
  statStudents: { uz: "Talabalar", ru: "Студенты" } satisfies Tr,
  statRating: { uz: "Reyting", ru: "Рейтинг" } satisfies Tr,
  notUploaded: { uz: "Yuklanmadi", ru: "Не загружено" } satisfies Tr,
  remove: { uz: "Olib tashlash", ru: "Убрать" } satisfies Tr,
  replace: { uz: "Almashtirish", ru: "Заменить" } satisfies Tr,
  uploading: { uz: "Yuklanmoqda…", ru: "Загрузка…" } satisfies Tr,
  uploadImage: { uz: "Rasm yuklash", ru: "Загрузить фото" } satisfies Tr,
  cropTitle: { uz: (label: string) => `${label} — moslang`, ru: (label: string) => `${label} — кадрируйте` },
  headlineMin4: { uz: "Sarlavha kamida 4 belgi", ru: "Заголовок — не менее 4 символов" } satisfies Tr,
  notSaved: { uz: "Saqlanmadi", ru: "Не сохранено" } satisfies Tr,
  saved: { uz: "Saqlandi", ru: "Сохранено" } satisfies Tr,
  portrait: { uz: "Portret rasm (4:5)", ru: "Портрет (4:5)" } satisfies Tr,
  portraitHint: { uz: "Tik, yuz ko'rinadigan", ru: "Вертикальное, с лицом" } satisfies Tr,
  cover: { uz: "Muqova (3:1)", ru: "Обложка (3:1)" } satisfies Tr,
  coverHint: { uz: "Keng rasm", ru: "Широкое изображение" } satisfies Tr,
  roleLabel: { uz: "Rol yorlig'i", ru: "Роль" } satisfies Tr,
  roleLabelPh: { uz: "Modul ustozi", ru: "Преподаватель модуля" } satisfies Tr,
  mainHeadline: { uz: "Asosiy sarlavha", ru: "Основной заголовок" } satisfies Tr,
  mainHeadlinePh: { uz: "Dunyodagi eng yirik frilans platformasida ishlash", ru: "Работа на крупнейшей фриланс-платформе мира" } satisfies Tr,
  description: { uz: "Tavsif", ru: "Описание" } satisfies Tr,
  descriptionPh: { uz: "Ustoz haqida: tajriba, nima o'rgatadi, natijalar…", ru: "О наставнике: опыт, чему учит, результаты…" } satisfies Tr,
  direction: { uz: "Yo'nalish", ru: "Направление" } satisfies Tr,
  infoCards: { uz: "Ma'lumot kartalari", ru: "Карточки с фактами" } satisfies Tr,
  infoCardsHint: { uz: "(masalan: «Nima o'rganasiz», raqamlar)", ru: "(например: «Чему научитесь», цифры)" } satisfies Tr,
  add: { uz: "Qo'shish", ru: "Добавить" } satisfies Tr,
  cardTitle: { uz: "Sarlavha", ru: "Заголовок" } satisfies Tr,
  cardTitleAria: { uz: "Karta sarlavhasi", ru: "Заголовок карточки" } satisfies Tr,
  cardText: { uz: "Qisqa matn", ru: "Короткий текст" } satisfies Tr,
  cardTextAria: { uz: "Karta matni", ru: "Текст карточки" } satisfies Tr,
  deleteCard: { uz: "Kartani o'chirish", ru: "Удалить карточку" } satisfies Tr,
  save: { uz: "Saqlash", ru: "Сохранить" } satisfies Tr,
  sectionMin5: { uz: "Kurs nomi kamida 5 belgi", ru: "Название курса — не менее 5 символов" } satisfies Tr,
  notAdded: { uz: "Qo'shilmadi", ru: "Не добавлено" } satisfies Tr,
  sections: { uz: "Kurslar", ru: "Курсы" } satisfies Tr,
  newSectionPh: { uz: "Yangi kurs nomi — masalan «Fiverr'da ishlash»", ru: "Название нового курса — например «Работа на Fiverr»" } satisfies Tr,
  sectionName: { uz: "Kurs nomi", ru: "Название курса" } satisfies Tr,
  sectionMeta: { uz: (cat: string, lessons: number, students: number) => `${cat} · ${lessons} dars · ${students} talaba`, ru: (cat: string, lessons: number, students: number) => `${cat} · ${lessons} ${ruPlural(lessons, ["урок", "урока", "уроков"])} · ${students} ${ruPlural(students, ["студент", "студента", "студентов"])}` },
  published: { uz: "Ochiq", ru: "Открыт" } satisfies Tr,
  draft: { uz: "Qoralama", ru: "Черновик" } satisfies Tr,
  noSections: { uz: "Hali kurs yo'q — yuqoridagi maydonga nom yozib qo'shing.", ru: "Курсов пока нет — введите название в поле выше и добавьте." } satisfies Tr,
  myMentorPage: { uz: "Mentorlik sahifam", ru: "Моя страница наставника" } satisfies Tr,
  adminStudioLead: { uz: "Mentor sahifasini siz nomidan sozlaysiz", ru: "Вы настраиваете страницу наставника от его имени" } satisfies Tr,
  studioLead: { uz: "Sahifa, postlar, efirlar va kurslar — hammasi shu yerda", ru: "Страница, посты, эфиры и курсы — всё здесь" } satisfies Tr,
  pageLead: { uz: "Talabalar ko'radigan sahifa: rasm, sarlavha, tavsif va ma'lumot kartalari", ru: "Страница, которую видят студенты: фото, заголовок, описание и карточки с фактами" } satisfies Tr,

  /* Daromad sahifasi + MentorMoney */
  moneyTitle: { uz: "Daromad va sozlamalar", ru: "Доход и настройки" } satisfies Tr,
  moneyLead: { uz: "Balans va yechish, promokod, obuna narxi va 1:1 vaqtlar", ru: "Баланс и вывод, промокоды, цена подписки и слоты 1:1" } satisfies Tr,
  detailedAnalytics: { uz: "Batafsil tahlil", ru: "Подробная аналитика" } satisfies Tr,
  monthlyIncome: { uz: "Oylik daromad", ru: "Доход по месяцам" } satisfies Tr,
  monthlyIncome6: { uz: "Oylik daromad — so'nggi 6 oy", ru: "Доход по месяцам — последние 6 месяцев" } satisfies Tr,
  monthlyIncomeHint: { uz: "Sof (komissiyadan keyin), qaytarilganlarsiz", ru: "Чистый (после комиссии), без возвратов" } satisfies Tr,
  zeroSom: { uz: "0 so'm", ru: "0 сум" } satisfies Tr,
  readyToWithdraw: { uz: "Yechishga tayyor", ru: "Готово к выводу" } satisfies Tr,
  onHold: { uz: "Ushlab turilmoqda", ru: "Удерживается" } satisfies Tr,
  opensAfterDays: { uz: (d: number) => `${d} kundan keyin ochiladi`, ru: (d: number) => `откроется через ${d} ${ruPlural(d, ["день", "дня", "дней"])}` },
  withdrawn: { uz: "Yechib olingan", ru: "Выведено" } satisfies Tr,
  totalSales: { uz: "Jami sotuv", ru: "Всего продаж" } satisfies Tr,
  grossFee: { uz: (gross: string, fee: number) => `${gross} · komissiya ${fee}%`, ru: (gross: string, fee: number) => `${gross} · комиссия ${fee}%` },
  withdrawTitle: { uz: "Pulni kartaga yechish", ru: "Вывод денег на карту" } satisfies Tr,
  withdrawHint: { uz: (min: string) => `Kamida ${min}. Administrator kartaga o'tkazadi.`, ru: (min: string) => `Минимум ${min}. Администратор переведёт на карту.` },
  cardNumber: { uz: "Karta raqami", ru: "Номер карты" } satisfies Tr,
  requestSent: { uz: "So'rov yuborildi", ru: "Запрос отправлен" } satisfies Tr,
  withdrawBtn: { uz: (sum: string) => `Yechish — ${sum}`, ru: (sum: string) => `Вывести — ${sum}` },
  subRefTitle: { uz: "Obuna va tavsiya", ru: "Подписка и рекомендации" } satisfies Tr,
  subRefHint: { uz: "Obunachilar yopiq postlarni va narxli efirlarni ko'radi. Tavsiya: do'sti chegirma oladi, tavsiya qilgan — kredit.", ru: "Подписчики видят закрытые посты и платные эфиры. Рекомендация: друг получает скидку, пригласивший — кредит." } satisfies Tr,
  subPrice: { uz: "Oylik obuna narxi (so'm, bo'sh = o'chiq)", ru: "Цена месячной подписки (сум, пусто = выключено)" } satisfies Tr,
  refPercent: { uz: "Tavsiya chegirmasi (%, 0–50)", ru: "Скидка по рекомендации (%, 0–50)" } satisfies Tr,
  promos: { uz: "Promokodlar", ru: "Промокоды" } satisfies Tr,
  promoCodePh: { uz: "KOD (masalan YOZ20)", ru: "КОД (например LETO20)" } satisfies Tr,
  code: { uz: "Kod", ru: "Код" } satisfies Tr,
  discountPct: { uz: "Chegirma foizi", ru: "Процент скидки" } satisfies Tr,
  course: { uz: "Kurs", ru: "Курс" } satisfies Tr,
  allProducts: { uz: "Barcha mahsulotlar", ru: "Все продукты" } satisfies Tr,
  limitUses: { uz: "Limit (nechta marta)", ru: "Лимит (сколько раз)" } satisfies Tr,
  validDays: { uz: "Necha kun amal qiladi", ru: "Сколько дней действует" } satisfies Tr,
  promoCreated: { uz: "Promokod yaratildi", ru: "Промокод создан" } satisfies Tr,
  create: { uz: "Yaratish", ru: "Создать" } satisfies Tr,
  allItems: { uz: "hammasi", ru: "все" } satisfies Tr,
  usesN: { uz: (s: string) => `${s} marta`, ru: (s: string) => `${s} раз` },
  until: { uz: (d: string) => `${d} gacha`, ru: (d: string) => `до ${d}` },
  disabled: { uz: "O'chirildi", ru: "Отключено" } satisfies Tr,
  enabled: { uz: "Yoqildi", ru: "Включено" } satisfies Tr,
  disable: { uz: "O'chirish", ru: "Отключить" } satisfies Tr,
  enable: { uz: "Yoqish", ru: "Включить" } satisfies Tr,
  slotsTitle: { uz: "1:1 konsultatsiya vaqtlari", ru: "Слоты консультаций 1:1" } satisfies Tr,
  slotsHint: { uz: "Talaba vaqtni tanlab to'laydi, belgilangan soatda video qo'ng'iroq ochiladi.", ru: "Студент выбирает время и оплачивает, в назначенный час откроется видеозвонок." } satisfies Tr,
  startTime: { uz: "Boshlanish vaqti", ru: "Время начала" } satisfies Tr,
  tashkentTime: { uz: "Toshkent vaqti (UTC+5) — talabaga ham shu vaqt ko'rsatiladi", ru: "Время Ташкента (UTC+5) — студенту показывается то же время" } satisfies Tr,
  duration: { uz: "Davomiylik", ru: "Длительность" } satisfies Tr,
  minShort: { uz: (m: number) => `${m} daq`, ru: (m: number) => `${m} мин` },
  priceSom: { uz: "Narx, so'm", ru: "Цена, сум" } satisfies Tr,
  slotAdded: { uz: "Vaqt qo'shildi", ru: "Слот добавлен" } satisfies Tr,
  booked: { uz: "Band qilingan", ru: "Забронирован" } satisfies Tr,
  awaitingPayment: { uz: "To'lov kutilmoqda", ru: "Ожидает оплаты" } satisfies Tr,
  freeSlot: { uz: "Bo'sh", ru: "Свободен" } satisfies Tr,
  deleted: { uz: "O'chirildi", ru: "Удалено" } satisfies Tr,
  del: { uz: "O'chirish", ru: "Удалить" } satisfies Tr,
  recentSales: { uz: "So'nggi sotuvlar", ru: "Последние продажи" } satisfies Tr,
  noSales: { uz: "Hozircha sotuv yo'q. Kurs narxini belgilang, promokod yarating va efirlarda ulashing.", ru: "Продаж пока нет. Укажите цену курса, создайте промокод и делитесь в эфирах." } satisfies Tr,
  opensAt: { uz: (d: string) => `${d} da ochiladi`, ru: (d: string) => `откроется ${d}` },

  /* Vazifalar */
  tasksTitle: { uz: "O'quvchilar ishi", ru: "Работы учеников" } satisfies Tr,
  tasksLead: { uz: "Yuborilgan ishlarni baholang va izoh qoldiring", ru: "Оцените присланные работы и оставьте комментарий" } satisfies Tr,
  ungraded: { uz: "Baholanmagan", ru: "Без оценки" } satisfies Tr,
  all: { uz: "Hammasi", ru: "Все" } satisfies Tr,
  noSubmissions: { uz: "Baholanmagan vazifa yo'q. Darsga «Uy vazifasi» qo'shsangiz, talabalar ishi shu yerga tushadi.", ru: "Неоценённых заданий нет. Добавьте к уроку «Домашнее задание» — работы студентов появятся здесь." } satisfies Tr,
  graded: { uz: "Baholandi", ru: "Оценено" } satisfies Tr,
  returned: { uz: "Qayta ishlashga qaytarildi", ru: "Возвращено на доработку" } satisfies Tr,
  task: { uz: "Topshiriq", ru: "Задание" } satisfies Tr,
  openFile: { uz: "Biriktirilgan faylni ochish", ru: "Открыть прикреплённый файл" } satisfies Tr,
  gradePh: { uz: "Baho /100", ru: "Оценка /100" } satisfies Tr,
  grade: { uz: "Baho", ru: "Оценка" } satisfies Tr,
  feedbackPh: { uz: "Izoh (ixtiyoriy)", ru: "Комментарий (необязательно)" } satisfies Tr,
  feedback: { uz: "Izoh", ru: "Комментарий" } satisfies Tr,
  showcase: { uz: "«Talabalar ishi»da ko'rsatish", ru: "Показать в «Работах студентов»" } satisfies Tr,
  rework: { uz: "Qayta ishlash", ru: "На доработку" } satisfies Tr,
  gradeBtn: { uz: "Baholash", ru: "Оценить" } satisfies Tr,

  /* Tahlil */
  analyticsTitle: { uz: "Tahlil", ru: "Аналитика" } satisfies Tr,
  analyticsLead: { uz: "Kurs ko'rilishi, yozilish, progress, efirlar va daromad manbalari", ru: "Просмотры курсов, записи, прогресс, эфиры и источники дохода" } satisfies Tr,
  lives: { uz: "Efirlar", ru: "Эфиры" } satisfies Tr,
  livesHint: { uz: (avg: number, max: number) => `o'rtacha ${avg} tomoshabin · eng ko'pi ${max}`, ru: (avg: number, max: number) => `в среднем ${avg} ${ruPlural(avg, ["зритель", "зрителя", "зрителей"])} · максимум ${max}` },
  noLivesYet: { uz: "hali efir yo'q", ru: "эфиров ещё не было" } satisfies Tr,
  ticketSales: { uz: "Chipta sotuvi", ru: "Продажи билетов" } satisfies Tr,
  activeSubs: { uz: "Faol obunachilar", ru: "Активные подписчики" } satisfies Tr,
  incomeOf: { uz: (s: string) => `daromad ${s}`, ru: (s: string) => `доход ${s}` },
  consultIncome: { uz: "Konsultatsiya daromadi", ru: "Доход от консультаций" } satisfies Tr,
  noCoursesYet: { uz: "Hali kurs yo'q.", ru: "Курсов пока нет." } satisfies Tr,
  unpublished: { uz: "chop etilmagan", ru: "не опубликован" } satisfies Tr,
  kpiViews: { uz: "Ko'rilgan", ru: "Просмотры" } satisfies Tr,
  kpiEnrolled: { uz: "Yozilgan", ru: "Записались" } satisfies Tr,
  kpiAvgProgress: { uz: "O'rtacha progress", ru: "Средний прогресс" } satisfies Tr,
  kpiCompleted: { uz: "Tugatgan / sertifikat", ru: "Завершили / сертификат" } satisfies Tr,
  kpiIncome: { uz: "Daromad", ru: "Доход" } satisfies Tr,
  lessonCompletion: { uz: "Darslarni tugatganlar (talabalarning %)", ru: "Завершили урок (% студентов)" } satisfies Tr,
  dropHint: { uz: "Qizil — oldingi darsga nisbatan keskin tushish: shu darsni qisqartiring yoki soddalashtiring.", ru: "Красным — резкое падение по сравнению с предыдущим уроком: сократите или упростите этот урок." } satisfies Tr,
  students: { uz: "Talabalar", ru: "Студенты" } satisfies Tr,
  lastLesson: { uz: (t: string) => `Oxirgi: ${t}`, ru: (t: string) => `Последний: ${t}` },
  notStarted: { uz: "Hali boshlamagan", ru: "Ещё не начал(а)" } satisfies Tr,
  enrolledAgo: { uz: (ago: string) => `yozilgan ${ago}`, ru: (ago: string) => `записался(ась) ${ago}` },
  writeTo: { uz: (name: string) => `${name}ga yozish`, ru: (name: string) => `Написать: ${name}` },

  /* Yo'l xaritasi */
  roadmapsLead: { uz: "Kurslaringizni ketma-ketlikka yig'ing — talaba qayerdaligini va keyingi qadamni ko'radi.", ru: "Выстройте курсы в последовательность — студент увидит, где он находится и каков следующий шаг." } satisfies Tr,
  stagesN: { uz: (n: number) => `${n} bosqich`, ru: (n: number) => `${n} ${ruPlural(n, ["этап", "этапа", "этапов"])}` },
  edit: { uz: "Tahrirlash", ru: "Редактировать" } satisfies Tr,
  noRoadmaps: { uz: "Hali yo'l xaritasi yo'q.", ru: "Дорожных карт пока нет." } satisfies Tr,
  newRoadmap: { uz: "Yangi yo'l xaritasi", ru: "Новая дорожная карта" } satisfies Tr,
  needCourseFirst: { uz: "Avval kamida bitta kurs yarating.", ru: "Сначала создайте хотя бы один курс." } satisfies Tr,
  roadmapNamePh: { uz: "Nomi: Boshlovchidan professionalgacha", ru: "Название: От новичка до профессионала" } satisfies Tr,
  shortDescPh: { uz: "Qisqa tavsif (ixtiyoriy)", ru: "Краткое описание (необязательно)" } satisfies Tr,
  coursesOrdered: { uz: "Kurslar (tartib bilan)", ru: "Курсы (по порядку)" } satisfies Tr,
  up: { uz: "Yuqoriga", ru: "Вверх" } satisfies Tr,
  down: { uz: "Pastga", ru: "Вниз" } satisfies Tr,
  cancel: { uz: "Bekor", ru: "Отмена" } satisfies Tr,

  /* CourseEditor */
  titleMin5: { uz: "Sarlavha kamida 5 belgi", ru: "Заголовок — не менее 5 символов" } satisfies Tr,
  coverUploaded: { uz: "Muqova yuklandi — Saqlashni unutmang", ru: "Обложка загружена — не забудьте сохранить" } satisfies Tr,
  coursePublished: { uz: "Kurs chop etildi 🎉", ru: "Курс опубликован 🎉" } satisfies Tr,
  courseHidden: { uz: "Kurs yashirildi", ru: "Курс скрыт" } satisfies Tr,
  orderNotSaved: { uz: "Tartibni saqlab bo'lmadi", ru: "Не удалось сохранить порядок" } satisfies Tr,
  deleteLessonQ: { uz: "Darsni o'chirish?", ru: "Удалить урок?" } satisfies Tr,
  irreversible: { uz: "Bu amalni qaytarib bo'lmaydi.", ru: "Это действие нельзя отменить." } satisfies Tr,
  lessonDeleted: { uz: "Dars o'chirildi", ru: "Урок удалён" } satisfies Tr,
  view: { uz: "Ko'rish", ru: "Просмотр" } satisfies Tr,
  isPublished: { uz: "Chop etilgan", ru: "Опубликован" } satisfies Tr,
  publish: { uz: "Chop etish", ru: "Опубликовать" } satisfies Tr,
  courseInfo: { uz: "Kurs ma'lumotlari", ru: "Данные курса" } satisfies Tr,
  coverAlt: { uz: "Muqova", ru: "Обложка" } satisfies Tr,
  cropCover: { uz: "Muqovani moslang (16:9)", ru: "Кадрируйте обложку (16:9)" } satisfies Tr,
  courseTitlePh: { uz: "Kurs sarlavhasi", ru: "Название курса" } satisfies Tr,
  courseSummaryPh: { uz: "Kurs haqida qisqacha — kim uchun, nima o'rganadi…", ru: "Кратко о курсе — для кого, чему научит…" } satisfies Tr,
  pricePh: { uz: "Narx so'm (0=bepul)", ru: "Цена, сум (0 = бесплатно)" } satisfies Tr,
  outcomes: { uz: "Nimalarni o'rganasiz", ru: "Чему научитесь" } satisfies Tr,
  outcomesHint: { uz: (max: number) => `· har qator bitta band, ${max} tagacha`, ru: (max: number) => `· по одному пункту в строке, до ${max}` },
  outcomesPh: { uz: "Premiere Pro interfeysi va tezkor tugmalar\nRang korreksiyasi va LUT\nOvoz tozalash va mikslash", ru: "Интерфейс Premiere Pro и горячие клавиши\nЦветокоррекция и LUT\nОчистка звука и сведение" } satisfies Tr,
  requirements: { uz: "Talablar", ru: "Требования" } satisfies Tr,
  onePerLine: { uz: "· har qator bitta band", ru: "· по одному пункту в строке" } satisfies Tr,
  requirementsPh: { uz: "Kompyuter (8 GB RAM)\nPremiere Pro o'rnatilgan", ru: "Компьютер (8 ГБ ОЗУ)\nУстановлен Premiere Pro" } satisfies Tr,
  audience: { uz: "Kimlar uchun", ru: "Для кого" } satisfies Tr,
  audiencePh: { uz: "Montajni noldan boshlamoqchi bo'lganlar, SMM mutaxassislari…", ru: "Те, кто хочет начать монтаж с нуля, SMM-специалисты…" } satisfies Tr,
  lessonLang: { uz: "Dars tili", ru: "Язык уроков" } satisfies Tr,
  lessons: { uz: "Darslar", ru: "Уроки" } satisfies Tr,
  moveUp: { uz: "Yuqoriga surish", ru: "Переместить вверх" } satisfies Tr,
  moveDown: { uz: "Pastga surish", ru: "Переместить вниз" } satisfies Tr,
  tagVideo: { uz: "video", ru: "видео" } satisfies Tr,
  tagText: { uz: "matn", ru: "текст" } satisfies Tr,
  tagPreview: { uz: "namuna", ru: "превью" } satisfies Tr,
  tagQuiz: { uz: "test", ru: "тест" } satisfies Tr,
  tagAssignment: { uz: "vazifa", ru: "задание" } satisfies Tr,
  filesN: { uz: (n: number) => `${n} fayl`, ru: (n: number) => `${n} ${ruPlural(n, ["файл", "файла", "файлов"])}` },
  noLessons: { uz: "Hali dars yo'q — pastdan qo'shing.", ru: "Уроков пока нет — добавьте ниже." } satisfies Tr,
  addLesson: { uz: "Dars qo'shish", ru: "Добавить урок" } satisfies Tr,

  /* LessonForm */
  lessonMin3: { uz: "Dars nomi kamida 3 belgi", ru: "Название урока — не менее 3 символов" } satisfies Tr,
  chaptersFormat: { uz: "Vaqt belgilari: har qatorda «mm:ss Sarlavha» (masalan 03:20 Kesish)", ru: "Таймкоды: в каждой строке «мм:сс Заголовок» (например 03:20 Монтаж)" } satisfies Tr,
  quizRule: { uz: "Har savolda kamida 2 variant va bitta to'g'ri javob bo'lsin", ru: "В каждом вопросе — не менее 2 вариантов и один правильный ответ" } satisfies Tr,
  lessonSaved: { uz: "Dars saqlandi", ru: "Урок сохранён" } satisfies Tr,
  lessonAdded: { uz: "Dars qo'shildi", ru: "Урок добавлен" } satisfies Tr,
  editLesson: { uz: "Darsni tahrirlash", ru: "Редактировать урок" } satisfies Tr,
  newLesson: { uz: "Yangi dars", ru: "Новый урок" } satisfies Tr,
  close: { uz: "Yopish", ru: "Закрыть" } satisfies Tr,
  lessonTitlePh: { uz: "Dars nomi", ru: "Название урока" } satisfies Tr,
  lessonSectionPh: { uz: "Modul nomi (ixtiyoriy, masalan: 1-modul · Asoslar)", ru: "Название модуля (необязательно, например: Модуль 1 · Основы)" } satisfies Tr,
  lessonSectionAria: { uz: "Kurs moduli", ru: "Модуль курса" } satisfies Tr,
  lessonBodyPh: { uz: "Dars matni / izoh (ixtiyoriy)…", ru: "Текст урока / описание (необязательно)…" } satisfies Tr,
  videoReady: { uz: "Video tayyor", ru: "Видео готово" } satisfies Tr,
  uploadVideo: { uz: "Video yuklash", ru: "Загрузить видео" } satisfies Tr,
  removeLower: { uz: "olib tashlash", ru: "убрать" } satisfies Tr,
  durationMinPh: { uz: "Davomiyligi (daq)", ru: "Длительность (мин)" } satisfies Tr,
  freePreview: { uz: "Bepul namuna", ru: "Бесплатный урок" } satisfies Tr,
  materials: { uz: "Materiallar", ru: "Материалы" } satisfies Tr,
  addFile: { uz: "Fayl qo'shish (PDF, DOCX, ZIP, rasm)", ru: "Добавить файл (PDF, DOCX, ZIP, изображение)" } satisfies Tr,
  zipHint: { uz: "Preset yoki loyiha fayllarini ZIP qilib yuklang.", ru: "Пресеты или файлы проекта загружайте в ZIP." } satisfies Tr,
  chapters: { uz: "Video vaqt belgilari", ru: "Таймкоды видео" } satisfies Tr,
  chaptersPh: { uz: "00:00 Kirish\n03:20 Kesish va timeline\n12:45 Rang korreksiyasi", ru: "00:00 Введение\n03:20 Нарезка и таймлайн\n12:45 Цветокоррекция" } satisfies Tr,
  chaptersHint: { uz: "Har qatorda: «mm:ss Sarlavha». Talaba bosib shu joyga o'tadi.", ru: "В каждой строке: «мм:сс Заголовок». Студент нажимает и переходит к этому месту." } satisfies Tr,
  lessonQuiz: { uz: "Dars testi", ru: "Тест к уроку" } satisfies Tr,
  questionsN: { uz: (n: number) => `${n} savol`, ru: (n: number) => `${n} ${ruPlural(n, ["вопрос", "вопроса", "вопросов"])}` },
  addQuiz: { uz: "Test qo'shish", ru: "Добавить тест" } satisfies Tr,
  passPct: { uz: "O'tish foizi", ru: "Проходной процент" } satisfies Tr,
  questionN: { uz: (n: number) => `${n}-savol`, ru: (n: number) => `Вопрос ${n}` },
  deleteQuestion: { uz: "Savolni o'chirish", ru: "Удалить вопрос" } satisfies Tr,
  correctAnswer: { uz: "To'g'ri javob", ru: "Правильный ответ" } satisfies Tr,
  optionN: { uz: (n: number) => `Variant ${n}`, ru: (n: number) => `Вариант ${n}` },
  deleteOption: { uz: "Variantni o'chirish", ru: "Удалить вариант" } satisfies Tr,
  plusOption: { uz: "+ variant", ru: "+ вариант" } satisfies Tr,
  plusQuestion: { uz: "+ savol", ru: "+ вопрос" } satisfies Tr,
  removeQuiz: { uz: "Testni olib tashlash", ru: "Убрать тест" } satisfies Tr,
  homework: { uz: "Uy vazifasi", ru: "Домашнее задание" } satisfies Tr,
  homeworkPh: { uz: "Talaba nima qilishi kerak? Masalan: 30 soniyalik reel montaj qiling va havolasini yuboring.", ru: "Что должен сделать студент? Например: смонтируйте 30-секундный reel и пришлите ссылку." } satisfies Tr,
  homeworkHint: { uz: "Talabalar ishi «Vazifalar» sahifangizda ko'rinadi; yaxshilarini ommaga chiqarishingiz mumkin.", ru: "Работы студентов появятся на странице «Задания»; лучшие можно показать публично." } satisfies Tr,

  /* ReferralCard, PrintButton */
  inviteFriend: { uz: "Do'stingizni taklif qiling", ru: "Пригласите друга" } satisfies Tr,
  inviteLead: { uz: (p: number) => `Havolangiz orqali xarid qilgan do'stingiz ${p}% chegirma oladi, siz esa shuncha kredit — keyingi xaridingizga.`, ru: (p: number) => `Друг, купивший по вашей ссылке, получит скидку ${p}%, а вы — столько же кредита на следующую покупку.` },
  inviteStats: { uz: (n: number, bal: string) => `Taklif qilinganlar: ${n} · Kredit balansi: ${bal}`, ru: (n: number, bal: string) => `Приглашено: ${n} · Баланс кредита: ${bal}` },
  printPdf: { uz: "Chop etish / PDF", ru: "Печать / PDF" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* «Ishimni baholang» — pullik asinxron ish sharhi (2026-11-12)         */
/* ------------------------------------------------------------------ */
const daysUz = (n: number) => `${n} kun`;
const daysRu = (n: number) => `${n} ${ruPlural(n, ["день", "дня", "дней"])}`;
export const WR = {
  /* Ustoz sahifasidagi karta va so'rov varag'i */
  title: { uz: "Ishimni baholang", ru: "Оцените мою работу" } satisfies Tr,
  offer: { uz: (price: string, d: number) => `${price} · ${daysUz(d)} ichida`, ru: (price: string, d: number) => `${price} · за ${daysRu(d)}` },
  cardLead: { uz: "Ishingizni yuboring — ustoz uni ko'rib, yozma sharh va aniq maslahatlar qaytaradi.", ru: "Отправьте работу — наставник посмотрит её и вернёт письменный разбор с конкретными советами." } satisfies Tr,
  send: { uz: "Ishimni yuborish", ru: "Отправить работу" } satisfies Tr,
  ownerNote: { uz: "Bu sizning xizmatingiz — talabalar shu kartani ko'radi.", ru: "Это ваша услуга — студенты видят эту карточку." } satisfies Tr,
  configure: { uz: "Sozlash", ru: "Настроить" } satisfies Tr,
  workLink: { uz: "Ish havolasi", ru: "Ссылка на работу" } satisfies Tr,
  workLinkPh: { uz: "https://… (YouTube, Behance, Google Drive)", ru: "https://… (YouTube, Behance, Google Drive)" } satisfies Tr,
  or: { uz: "yoki", ru: "или" } satisfies Tr,
  uploadFile: { uz: "Fayl yuklash", ru: "Загрузить файл" } satisfies Tr,
  fileHint: { uz: "Video, rasm, PDF yoki ZIP", ru: "Видео, изображение, PDF или ZIP" } satisfies Tr,
  uploading: { uz: "Yuklanmoqda…", ru: "Загрузка…" } satisfies Tr,
  removeFile: { uz: "Faylni olib tashlash", ru: "Удалить файл" } satisfies Tr,
  note: { uz: "Nimaga e'tibor qaratsin?", ru: "На что обратить внимание?" } satisfies Tr,
  notePh: { uz: "Masalan: montaj ritmi, rang, ovoz, kompozitsiya…", ru: "Например: ритм монтажа, цвет, звук, композиция…" } satisfies Tr,
  needWork: { uz: "Havola kiriting yoki fayl yuklang", ru: "Укажите ссылку или загрузите файл" } satisfies Tr,
  httpsOnly: { uz: "Havola https:// bilan boshlanishi kerak", ru: "Ссылка должна начинаться с https://" } satisfies Tr,
  next: { uz: "Davom etish — to'lov", ru: "Продолжить — оплата" } satisfies Tr,
  sendFree: { uz: "Bepul yuborish", ru: "Отправить бесплатно" } satisfies Tr,
  sent: { uz: "So'rov ustozga yuborildi", ru: "Запрос отправлен наставнику" } satisfies Tr,
  failed: { uz: "Yuborib bo'lmadi", ru: "Не удалось отправить" } satisfies Tr,

  /* Ustoz sozlamasi */
  settingsTitle: { uz: "«Ishimni baholang» xizmati", ru: "Услуга «Оцените мою работу»" } satisfies Tr,
  settingsLead: { uz: "Talaba ishini yuboradi, siz yozma (xohlasangiz video) sharh qaytarasiz. To'lov platforma orqali, daromad «Daromad» bo'limiga tushadi.", ru: "Студент отправляет работу, вы возвращаете письменный (по желанию видео) разбор. Оплата через платформу, доход — в разделе «Доход»." } satisfies Tr,
  enable: { uz: "Xizmatni yoqish", ru: "Включить услугу" } satisfies Tr,
  price: { uz: "Narx (so'm)", ru: "Цена (сум)" } satisfies Tr,
  priceHint: { uz: "0 — bepul, aks holda 5 000 – 5 000 000", ru: "0 — бесплатно, иначе 5 000 – 5 000 000" } satisfies Tr,
  days: { uz: "Javob muddati (kun)", ru: "Срок ответа (дней)" } satisfies Tr,
  about: { uz: "Nimani baholaysiz", ru: "Что вы оцениваете" } satisfies Tr,
  aboutPh: { uz: "Masalan: reels montaji, rang korreksiyasi, logotip va brending…", ru: "Например: монтаж reels, цветокоррекция, логотип и брендинг…" } satisfies Tr,
  save: { uz: "Saqlash", ru: "Сохранить" } satisfies Tr,
  saved: { uz: "Saqlandi", ru: "Сохранено" } satisfies Tr,
  notSaved: { uz: "Saqlab bo'lmadi", ru: "Не удалось сохранить" } satisfies Tr,

  /* Ustoz kutish ro'yxati */
  inboxTitle: { uz: "Ish sharhlari", ru: "Разборы работ" } satisfies Tr,
  inboxLead: { uz: "Talabalar yuborgan ishlar — muddatigacha sharh yozing.", ru: "Работы студентов — напишите разбор до срока." } satisfies Tr,
  waitingN: { uz: (n: number) => `${n} ta javob kutmoqda`, ru: (n: number) => `${n} ${ruPlural(n, ["ждёт", "ждут", "ждут"])} ответа` },
  noWaiting: { uz: "Hozircha javob kutayotgan ish yo'q.", ru: "Пока нет работ, ожидающих ответа." } satisfies Tr,
  due: { uz: (d: string) => `Muddat: ${d}`, ru: (d: string) => `Срок: ${d}` },
  overdue: { uz: "Muddati o'tgan", ru: "Срок истёк" } satisfies Tr,
  openWork: { uz: "Faylni ochish", ru: "Открыть файл" } satisfies Tr,
  openLink: { uz: "Havolani ochish", ru: "Открыть ссылку" } satisfies Tr,
  studentNote: { uz: "Talaba izohi", ru: "Комментарий студента" } satisfies Tr,
  answerPh: { uz: "Sharhingiz: nima yaxshi chiqqan, nimani yaxshilash kerak, aniq maslahatlar…", ru: "Ваш разбор: что получилось, что улучшить, конкретные советы…" } satisfies Tr,
  addVideo: { uz: "Video javob (ixtiyoriy)", ru: "Видеоответ (необязательно)" } satisfies Tr,
  videoOnly: { uz: "Faqat video fayl (MP4, WebM, MOV)", ru: "Только видеофайл (MP4, WebM, MOV)" } satisfies Tr,
  sendAnswer: { uz: "Sharhni yuborish", ru: "Отправить разбор" } satisfies Tr,
  answered: { uz: "Sharh yuborildi", ru: "Разбор отправлен" } satisfies Tr,
  minChars: { uz: (n: number) => `Sharh kamida ${n} belgi bo'lsin`, ru: (n: number) => `Разбор — минимум ${n} символов` },
  recentDone: { uz: "Javob berilganlar", ru: "С ответом" } satisfies Tr,
  waitingCard: { uz: (n: number) => `${n} ta ish sharhi javob kutmoqda`, ru: (n: number) => `${n} ${ruPlural(n, ["разбор ждёт", "разбора ждут", "разборов ждут"])} ответа` },
  waitingCardHint: { uz: "Vazifalar bo'limida ko'rib, sharh yozing", ru: "Посмотрите и ответьте в разделе «Задания»" } satisfies Tr,

  /* Talaba ro'yxati */
  myTitle: { uz: "Ish sharhlarim", ru: "Мои разборы работ" } satisfies Tr,
  status: {
    pending_payment: { uz: "To'lov kutilmoqda", ru: "Ожидает оплаты" },
    waiting: { uz: "Ustoz ko'rib chiqmoqda", ru: "Наставник смотрит" },
    done: { uz: "Sharh tayyor", ru: "Разбор готов" },
    refunded: { uz: "Qaytarilgan", ru: "Возвращено" },
    cancelled: { uz: "Bekor qilingan", ru: "Отменено" },
  } satisfies Record<string, Tr>,
  pay: { uz: "To'lash", ru: "Оплатить" } satisfies Tr,
  cancel: { uz: "Bekor qilish", ru: "Отменить" } satisfies Tr,
  cancelQ: { uz: "So'rovni bekor qilasizmi?", ru: "Отменить запрос?" } satisfies Tr,
  overdueNote: { uz: "Muddat o'tdi — ustoz hali javob bermadi", ru: "Срок прошёл — наставник ещё не ответил" } satisfies Tr,
  askRefund: { uz: "Pulni qaytarishni so'rash", ru: "Запросить возврат" } satisfies Tr,
  askRefundQ: { uz: "Pulni qaytarishni so'raysizmi? Administrator ko'rib chiqadi va pulni kartangizga qaytaradi.", ru: "Запросить возврат? Администратор рассмотрит и вернёт деньги на карту." } satisfies Tr,
  refundAsked: { uz: "So'rov yuborildi — administrator ko'rib chiqadi", ru: "Запрос отправлен — администратор рассмотрит" } satisfies Tr,
  cancelOverdue: { uz: "So'rovni bekor qilish", ru: "Отменить запрос" } satisfies Tr,
  overdueBadge: { uz: "Kechikmoqda", ru: "Просрочено" } satisfies Tr,
  cancelled: { uz: "So'rov bekor qilindi", ru: "Запрос отменён" } satisfies Tr,
  mentorResponse: { uz: "Ustoz sharhi", ru: "Разбор наставника" } satisfies Tr,
  expectedBy: { uz: (d: string) => `${d} gacha javob beriladi`, ru: (d: string) => `Ответ до ${d}` },
  yourWork: { uz: "Sizning ishingiz", ru: "Ваша работа" } satisfies Tr,
  error: { uz: "Xatolik", ru: "Ошибка" } satisfies Tr,
};
