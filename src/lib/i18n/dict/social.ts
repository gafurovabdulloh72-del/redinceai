/**
 * Ijtimoiy bo'limlar lug'ati: oylik TOP (/top), mentorlik katalogi va mentor kanali sahifalari.
 */
import type { Tr } from "../index";

export const TOP = {
  badge: { uz: "Oy reytingi", ru: "Рейтинг месяца" } satisfies Tr,
  title: { uz: "Oyning TOP ijodkorlari", ru: "ТОП креаторов месяца" } satisfies Tr,
  lead: { uz: "Reyting har oyning oxirgi kunida e'lon qilinadi. G'oliblarga keyingi oy davomida premium imtiyoz beriladi.", ru: "Рейтинг публикуется в последний день каждого месяца. Победители получают премиум на следующий месяц." } satisfies Tr,
  published: { uz: "e'lon qilindi", ru: "опубликовано" } satisfies Tr,
  premiumGiven: { uz: "G'oliblarga premium berildi", ru: "Победителям выдан премиум" } satisfies Tr,
  until: { uz: "gacha", ru: "до" } satisfies Tr,
  soonTitle: { uz: "Birinchi reyting tez orada", ru: "Первый рейтинг скоро" } satisfies Tr,
  soonText: { uz: "Post va story joylab, ko'proq reaksiya yig'ing — oyning oxirgi kuni TOP ijodkorlar e'lon qilinadi.", ru: "Публикуйте посты и сторис и собирайте реакции — в последний день месяца будут объявлены ТОП-креаторы." } satisfies Tr,
  nextLabel: { uz: "Keyingi e'lon", ru: "Следующая публикация" } satisfies Tr,
  today: { uz: "bugun", ru: "сегодня" } satisfies Tr,
  daysLeft: { uz: (n: number) => `${n} kun qoldi`, ru: (n: number) => `осталось дней: ${n}` },
  howTitle: { uz: "Ball qanday hisoblanadi?", ru: "Как считаются баллы?" } satisfies Tr,
  howText: { uz: "Postlaringizga kelgan reaksiya ×3, izoh ×4, saqlash ×5, ko'rish ×0.3 va yangi obunachi ×6 — oy davomida yig'iladi.", ru: "Реакции ×3, комментарии ×4, сохранения ×5, просмотры ×0.3 и новые подписчики ×6 — накапливаются в течение месяца." } satisfies Tr,
  topPostsTitle: { uz: "Top postlarni ko'ring", ru: "Смотреть топ-посты" } satisfies Tr,
  topPostsText: { uz: "Reels'da eng zo'r ishlar", ru: "Лучшие работы в Reels" } satisfies Tr,
  older: { uz: "Oldingi oylar", ru: "Прошлые месяцы" } satisfies Tr,
  points: { uz: "ball", ru: "баллов" } satisfies Tr,
};

export const MENTOR = {
  title: { uz: "Mentorlik", ru: "Менторство" } satisfies Tr,
  lead: { uz: "Tajribali ustozlardan amaliy bilim: kanallarini kuzating, darslarga yoziling, jonli efirlarda qatnashing.", ru: "Практические знания от опытных наставников: подписывайтесь на каналы, записывайтесь на уроки, участвуйте в прямых эфирах." } satisfies Tr,
  searchPh: { uz: "Kurs qidirish…", ru: "Поиск курса…" } satisfies Tr,
  mine: { uz: "Mening sahifam", ru: "Моя страница" } satisfies Tr,
  become: { uz: "Ustoz bo'lish", ru: "Стать наставником" } satisfies Tr,
  all: { uz: "Barchasi", ru: "Все" } satisfies Tr,
  courses: { uz: "Kurslar", ru: "Курсы" } satisfies Tr,
  noCourses: { uz: "Hozircha kurs yo'q", ru: "Пока нет курсов" } satisfies Tr,
  // Mentor sahifasi
  tabFeed: { uz: "Lenta", ru: "Лента" } satisfies Tr,
  tabSections: { uz: "Bo'limlar", ru: "Разделы" } satisfies Tr,
  tabLive: { uz: "Efirlar", ru: "Эфиры" } satisfies Tr,
  tabChat: { uz: "Muhokama", ru: "Обсуждение" } satisfies Tr,
  followers: { uz: "obunachi", ru: "подписчиков" } satisfies Tr,
  sections: { uz: "bo'lim", ru: "разделов" } satisfies Tr,
  students: { uz: "talaba", ru: "студентов" } satisfies Tr,
  rating: { uz: "reyting", ru: "рейтинг" } satisfies Tr,
  settings: { uz: "Sozlash", ru: "Настроить" } satisfies Tr,
  role: { uz: "Ustoz", ru: "Наставник" } satisfies Tr,
  channelNotReady: { uz: "Kanal hali tayyor emas.", ru: "Канал ещё не готов." } satisfies Tr,
  noSections: { uz: "Hozircha ochiq bo'lim yo'q.", ru: "Пока нет открытых разделов." } satisfies Tr,
  joinToChat: { uz: "Muhokamada qatnashish uchun ustoz kanaliga obuna bo'ling.", ru: "Чтобы участвовать в обсуждении, подпишитесь на канал наставника." } satisfies Tr,
  lessons: { uz: "dars", ru: "уроков" } satisfies Tr,
  free: { uz: "Bepul", ru: "Бесплатно" } satisfies Tr,
};
