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

const PURCHASE_RU: Record<PurchaseType, string> = { course: "Курс", ticket: "Билет на эфир", sub: "Месячная подписка", consult: "Консультация" };
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
  lessonsHead: { uz: "Darslar", ru: "Уроки" } satisfies Tr,
  sectionN: { uz: (n: number) => `${n}-bo'lim`, ru: (n: number) => `Раздел ${n}` },
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
  noSection: { uz: "Bo'limsiz", ru: "Без раздела" } satisfies Tr,
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
