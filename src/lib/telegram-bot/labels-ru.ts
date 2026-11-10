import { CATEGORY_BY_SLUG, CATEGORY_GROUPS } from "@/lib/categories";
import { REGION_BY_SLUG } from "@/lib/constants";
import type { BotLang } from "@/lib/telegram-bot/lang";

/**
 * Kasb yo'nalishlari, kasblar va hududlarning RUSCHA nomlari — bot uchun (ro'yxatdan o'tish tugmalari, xulosa, qidiruv
 * natijalari). O'zbekcha nom — yagona manba (`lib/categories.ts`, `lib/constants.ts` REGIONS); bu yerda faqat tarjima.
 * Yangi kasb qo'shilsa va bu yerga yozilmasa — o'zbekcha nomi ko'rsatiladi (xato bo'lmaydi).
 * Slug'lar bazada saqlanadi va o'zgarmaydi — kalit sifatida ishonchli.
 */
const GROUP_RU: Record<string, string> = {
  video: "Видео и анимация",
  dizayn: "Дизайн и брендинг",
  foto: "Фото и ретушь",
  "uch-d": "3D, архитектура и игры",
  audio: "Аудио и музыка",
  dasturlash: "Программирование и IT",
  marketing: "Маркетинг и SMM",
  yozuv: "Тексты и перевод",
  biznes: "Бизнес и управление",
  data: "Данные и AI",
  talim: "Обучение и наставничество",
};

const CATEGORY_RU: Record<string, string> = {
  // Video va animatsiya
  videograf: "Видеограф",
  montajor: "Монтажёр",
  "motion-dizayner": "Моушн-дизайнер",
  "reels-maker": "Создатель Reels / Shorts",
  dronograf: "Дронограф",
  animator: "2D-аниматор",
  kolorist: "Колорист",
  "vfx-artist": "VFX / композитор",
  "video-prodyuser": "Видеопродюсер",
  "jonli-efir": "Режиссёр прямых эфиров",
  // Dizayn va brending
  dizayner: "Графический дизайнер",
  "ui-ux": "UI/UX-дизайнер",
  "logo-brending": "Дизайнер логотипов и брендинга",
  illyustrator: "Иллюстратор",
  "veb-dizayner": "Веб-дизайнер",
  "smm-dizayner": "SMM-дизайнер",
  prezentatsiya: "Дизайнер презентаций",
  infografika: "Дизайнер инфографики",
  poligrafiya: "Дизайнер полиграфии",
  "qadoq-dizayner": "Дизайнер упаковки",
  "kiyim-dizayner": "Дизайнер одежды и мерча",
  "shrift-dizayner": "Типографика / шрифтовой дизайнер",
  // Foto va retush
  fotograf: "Фотограф",
  "toy-fotograf": "Свадебный и event-фотограф",
  "mahsulot-fotograf": "Предметный фотограф",
  "portret-fotograf": "Портретный / lifestyle-фотограф",
  retusher: "Ретушёр",
  "ugc-kreator": "UGC-креатор",
  // 3D, arxitektura va o'yin
  "3d-artist": "3D-художник",
  "3d-modeler": "3D-моделлер",
  "arxitektura-vizual": "Архитектурный визуализатор",
  "interyer-dizayner": "Дизайнер интерьеров",
  "cad-chizmachi": "CAD / чертёжник",
  "ar-vr": "AR / VR-разработчик",
  "game-artist": "Игровой художник",
  "3d-animator": "3D-аниматор",
  // Audio va musiqa
  ovoz: "Звукорежиссёр",
  diktor: "Диктор / актёр озвучки",
  dublyaj: "Актёр дубляжа",
  "musiqa-prodyuser": "Музыкальный продюсер",
  bastakor: "Композитор",
  "saund-dizayner": "Саунд-дизайнер",
  "podkast-muharrir": "Редактор подкастов",
  // Dasturlash va IT
  frontend: "Frontend-разработчик",
  backend: "Backend-разработчик",
  fullstack: "Full-stack разработчик",
  "mobil-dasturchi": "Разработчик мобильных приложений",
  wordpress: "Специалист по WordPress / Tilda",
  "telegram-bot": "Разработчик Telegram-ботов",
  "game-dev": "Разработчик игр",
  "1c-dasturchi": "Программист 1С",
  "qa-tester": "QA-тестировщик",
  devops: "DevOps-инженер",
  "kiber-xavfsizlik": "Специалист по кибербезопасности",
  "no-code": "No-code разработчик",
  // Marketing va SMM
  "smm-menejer": "SMM-менеджер",
  targetolog: "Таргетолог",
  "kontekst-reklama": "Специалист по Google Ads",
  seo: "SEO-специалист",
  marketolog: "Маркетолог",
  "kontent-menejer": "Контент-менеджер",
  "email-marketing": "Специалист по email-маркетингу",
  "brend-strateg": "Бренд-стратег",
  "influencer-menejer": "Менеджер по работе с блогерами",
  "pr-menejer": "PR-менеджер",
  // Yozuv va tarjima
  kopirayter: "Копирайтер",
  "kontent-yozuvchi": "Автор контента",
  ssenarist: "Сценарист",
  tarjimon: "Переводчик",
  "sinxron-tarjimon": "Устный / синхронный переводчик",
  muharrir: "Редактор / корректор",
  "texnik-yozuvchi": "Технический писатель",
  subtitr: "Субтитры и транскрибация",
  // Biznes va boshqaruv
  "virtual-assistent": "Виртуальный ассистент",
  "loyiha-menejer": "Менеджер проектов",
  "mahsulot-menejer": "Продакт-менеджер",
  "sotuv-menejer": "Менеджер по продажам",
  "mijozlar-xizmati": "Клиентский сервис / поддержка",
  buxgalter: "Бухгалтер",
  "moliya-tahlilchi": "Финансовый аналитик",
  "hr-mutaxassis": "HR-специалист",
  "biznes-konsultant": "Бизнес-консультант",
  huquqshunos: "Юрист",
  // Ma'lumotlar va AI
  "data-analitik": "Аналитик данных",
  "bi-dashboard": "Специалист по BI / дашбордам",
  "ai-muhandis": "AI / ML-инженер",
  "prompt-muhandis": "Промпт-инженер / AI-автоматизация",
  "malumot-kiritish": "Оператор ввода данных",
  "excel-mutaxassis": "Специалист по Excel / Google Sheets",
  // Ta'lim va murabbiylik
  repetitor: "Репетитор",
  "til-oqituvchi": "Преподаватель языка",
  "kurs-muallifi": "Автор онлайн-курсов",
  "mentor-trener": "Ментор / тренер",
  "kasbiy-ustoz": "Наставник по профессии (дизайн/видео/IT)",
};

/** Hudud: [to'liq nom, tugma uchun qisqa nom] */
const REGION_RU: Record<string, readonly [string, string]> = {
  "toshkent-shahri": ["город Ташкент", "г. Ташкент"],
  "toshkent-viloyati": ["Ташкентская область", "Ташкентская обл."],
  andijon: ["Андижанская область", "Андижан"],
  fargona: ["Ферганская область", "Фергана"],
  namangan: ["Наманганская область", "Наманган"],
  samarqand: ["Самаркандская область", "Самарканд"],
  buxoro: ["Бухарская область", "Бухара"],
  navoiy: ["Навоийская область", "Навои"],
  qashqadaryo: ["Кашкадарьинская область", "Кашкадарья"],
  surxondaryo: ["Сурхандарьинская область", "Сурхандарья"],
  jizzax: ["Джизакская область", "Джизак"],
  sirdaryo: ["Сырдарьинская область", "Сырдарья"],
  xorazm: ["Хорезмская область", "Хорезм"],
  qoraqalpogiston: ["Республика Каракалпакстан", "Каракалпакстан"],
};

/** Kasb yo'nalishi nomi (uz yoki ru) */
export function groupLabel(slug: string, lang?: BotLang): string {
  const uz = CATEGORY_GROUPS.find((g) => g.slug === slug)?.name ?? slug;
  return lang === "ru" ? (GROUP_RU[slug] ?? uz) : uz;
}

/** Kasb nomi (uz yoki ru); noma'lum slug — o'zi qaytadi */
export function categoryLabel(slug: string, lang?: BotLang): string {
  const uz = CATEGORY_BY_SLUG[slug]?.name ?? slug;
  return lang === "ru" ? (CATEGORY_RU[slug] ?? uz) : uz;
}

/** Hudud nomi: `short` — tugma uchun qisqa ko'rinish */
export function regionLabel(slug: string, lang?: BotLang, short = false): string {
  const r = REGION_BY_SLUG[slug];
  const uz = r ? (short ? r.short : r.name) : slug;
  if (lang !== "ru") return uz;
  const ru = REGION_RU[slug];
  return ru ? ru[short ? 1 : 0] : uz;
}
