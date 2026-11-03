/**
 * Kabinet ICHKI FORMALARI lug'ati: Akkaunt, Mutaxassis profili, Portfolio, Ish vaqti, Maxfiylik (ikkala panel),
 * Xavfsizlik (parol/2FA/sessiyalar/xavfli zona), Bloklanganlar, rasm kesgich, profil sahifasi bo'limlari.
 * uz matnlar komponentlardagi asl matn bilan AYNAN bir xil (manba o'zgarmaydi), ru — tarjima.
 * Umumiy yorliqlar (`constants.ts`: VISIBILITY_*, WEEKDAYS, GENDERS, PACKAGE_TIERS…) o'zgartirilmaydi —
 * ularga `*Tr(til, …)` xaritalari shu yerda.
 */
import type { Locale, Tr } from "../index";
import { WEEKDAYS } from "@/lib/constants";
import type { Schedule } from "@/lib/db/schema";
import type { ScheduleStatus } from "@/lib/privacy";
import { ruPlural } from "./catalog";
import { HAFTA_KUNI, HAFTA_KUNI_RU_QACHON } from "./profile";

/* ------------------------------------------------------------------ */
/* Umumiy xaritalar (constants.ts yorliqlari uchun)                     */
/* ------------------------------------------------------------------ */

/** Ko'rinish darajasi — qisqa nom (VisibilityChip.LEVEL_SHORT) */
export const KORINISH_QISQA: Record<string, Tr> = {
  public: { uz: "Hammaga", ru: "Всем" },
  clients: { uz: "Ro'yxatdan o'tganlarga", ru: "Зарегистрированным" },
  orders: { uz: "Buyurtmachilarga", ru: "Заказчикам" },
  hidden: { uz: "Yashirin", ru: "Скрыто" },
};
/** Ko'rinish darajasi — maydon ostidagi izoh (VisibilityChip.LEVEL_HINT) */
export const KORINISH_IZOH: Record<string, Tr> = {
  public: { uz: "Profilda hammaga ko'rinadi.", ru: "В профиле видно всем." },
  clients: { uz: "Profilda faqat ro'yxatdan o'tganlarga ko'rinadi.", ru: "В профиле видно только зарегистрированным." },
  orders: { uz: "Profilda faqat buyurtmasi qabul qilingan mijozlarga ko'rinadi.", ru: "В профиле видно только клиентам с принятым заказом." },
  hidden: { uz: "Profilda ko'rinmaydi.", ru: "В профиле не отображается." },
};
/** PrivacySettings segmentidagi qisqa nom (LEVEL_SHORT u yerda boshqacha) */
export const KORINISH_SEGMENT: Record<string, Tr> = {
  public: { uz: "Hammaga", ru: "Всем" },
  clients: { uz: "Ro'yxatdan o'tganlar", ru: "Зарегистрированные" },
  orders: { uz: "Buyurtmachilar", ru: "Заказчики" },
  hidden: { uz: "Yashirin", ru: "Скрыто" },
};
/** VISIBILITY_LEVELS.description — ruscha varianti */
const KORINISH_TAVSIF_RU: Record<string, string> = {
  public: "Видят все посетители сайта",
  clients: "Видят вошедшие пользователи",
  orders: "Видят клиенты с принятым заказом",
  hidden: "Не видно никому",
};
export function visibilityLevelDesc(til: Locale, value: string, uz: string): string {
  return til === "ru" ? (KORINISH_TAVSIF_RU[value] ?? uz) : uz;
}
/** VISIBILITY_FIELDS.label — ruscha varianti */
const KORINISH_MAYDON_RU: Record<string, string> = {
  phone: "Номер телефона",
  telegram: "Telegram",
  instagram: "Instagram",
  youtube: "YouTube",
  website: "Веб-сайт",
  email: "Email",
  schedule: "График работы",
  gender: "Пол",
  city: "Город",
};
export function visibilityFieldLabel(til: Locale, key: string, uz: string): string {
  return til === "ru" ? (KORINISH_MAYDON_RU[key] ?? uz) : uz;
}

/** GENDERS.label — ruscha (akkaunt formasidagi jins tanlovi) */
const JINS_RU: Record<string, string> = { male: "Мужской", female: "Женский" };
export function genderOptionLabel(til: Locale, value: string | null, uz: string): string {
  if (til !== "ru") return uz;
  return value ? (JINS_RU[value] ?? uz) : "Не указан";
}

/** PACKAGE_TIERS.label — ruscha */
const PAKET_RU: Record<string, string> = { basic: "Базовый", standard: "Стандарт", premium: "Премиум" };
export function packageTierLabel(til: Locale, key: string, uz: string): string {
  return til === "ru" ? (PAKET_RU[key] ?? uz) : uz;
}

/** Kirish tarixi harakatlari (SecurityPanel.LOGIN_EVENT_META) */
const KIRISH_HODISA_RU: Record<string, string> = {
  login_success: "Вход",
  login_failed: "Попытка с неверным паролем",
  login_2fa_failed: "Неверный код 2FA",
  login_2fa_required: "Запрошен код 2FA",
  logout: "Выход",
  logout_all: "Выход со всех устройств",
  password_changed: "Пароль изменён",
  session_revoked: "Сессия закрыта",
};
export function loginEventLabel(til: Locale, action: string, uz: string): string {
  return til === "ru" ? (KIRISH_HODISA_RU[action] ?? uz) : uz;
}

/** Oy nomlari (ScheduleEditor kalendari) */
export const OY_NOMI: Record<Locale, string[]> = {
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
};
/** Kalendar kuni aria-label uchun kelishik: ru "5 марта", uz "5-mart" */
const OY_RU_KELISHIK = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export function calendarDayLabel(til: Locale, day: number, monthIdx: number): string {
  return til === "ru" ? `${day} ${OY_RU_KELISHIK[monthIdx]}` : `${day}-${OY_NOMI.uz[monthIdx].toLowerCase()}`;
}

/** Hafta kuni nomi (WEEKDAYS kaliti bo'yicha), uz — constants'dagi yorliq */
export function weekdayLabel(til: Locale, key: string, uz: string): string {
  return til === "ru" && HAFTA_KUNI[key] ? HAFTA_KUNI[key].full.ru : uz;
}
export function weekdayShort(til: Locale, key: string, uz: string): string {
  return til === "ru" && HAFTA_KUNI[key] ? HAFTA_KUNI[key].short.ru : uz;
}

/** privacy.scheduleStatusLabel'ning til-mos varianti (SchedulePanel bilan bir xil matnlar) */
export function scheduleStatusLabelTr(til: Locale, status: ScheduleStatus): string {
  if (status.state === "none") return til === "ru" ? "График работы не указан" : "Ish vaqti ko'rsatilmagan";
  if (status.state === "open") return til === "ru" ? `Сейчас открыто · до ${status.closesAt}` : `Hozir ochiq · ${status.closesAt} gacha`;
  if (!status.opensAt || !status.opensDay) return til === "ru" ? "Закрыто" : "Yopiq";
  const when =
    status.opensDay === "today"
      ? til === "ru"
        ? "сегодня"
        : "bugun"
      : status.opensDay === "tomorrow"
        ? til === "ru"
          ? "завтра"
          : "ertaga"
        : til === "ru"
          ? (HAFTA_KUNI_RU_QACHON[status.opensDay] ?? "")
          : (WEEKDAYS.find((w) => w.key === status.opensDay)?.label.toLowerCase() ?? "");
  return til === "ru" ? `Закрыто · откроется ${when} в ${status.opensAt}` : `Yopiq · ${when} ${status.opensAt} da ochiladi`;
}

/** privacy.scheduleSummary'ning til-mos varianti: "Du–Ju 09:00–18:00 · Sh 10:00–15:00" / "Пн–Пт 09:00–18:00 · Сб 10:00–15:00" */
export function scheduleSummaryTr(til: Locale, schedule: Schedule | null | undefined): string {
  if (!schedule?.days) return "";
  const parts: string[] = [];
  let runStart: number | null = null;
  let runRange = "";
  const short = (idx: number) => weekdayShort(til, WEEKDAYS[idx].key, WEEKDAYS[idx].short);
  const flush = (endIdx: number) => {
    if (runStart == null) return;
    const a = short(runStart);
    const b = short(endIdx);
    parts.push(`${runStart === endIdx ? a : `${a}–${b}`} ${runRange}`);
    runStart = null;
    runRange = "";
  };
  WEEKDAYS.forEach((w, idx) => {
    const d = schedule.days[w.key];
    const range = d?.enabled ? `${d.from}–${d.to}` : "";
    if (!range) {
      flush(idx - 1);
      return;
    }
    if (runStart == null) {
      runStart = idx;
      runRange = range;
    } else if (range !== runRange) {
      flush(idx - 1);
      runStart = idx;
      runRange = range;
    }
  });
  flush(WEEKDAYS.length - 1);
  return parts.join(" · ");
}

/* ------------------------------------------------------------------ */
/* Umumiy forma holatlari (bir nechta formada takrorlanadi)             */
/* ------------------------------------------------------------------ */
export const FORMA = {
  saved: { uz: "Saqlandi", ru: "Сохранено" } satisfies Tr,
  unsaved: { uz: "O'zgarishlar hali saqlanmagan", ru: "Изменения ещё не сохранены" } satisfies Tr,
  allSaved: { uz: "Hammasi saqlangan", ru: "Всё сохранено" } satisfies Tr,
  save: { uz: "Saqlash", ru: "Сохранить" } satisfies Tr,
  cancel: { uz: "Bekor qilish", ru: "Отмена" } satisfies Tr,
  cancelShort: { uz: "Bekor", ru: "Отмена" } satisfies Tr,
  close: { uz: "Yopish", ru: "Закрыть" } satisfies Tr,
  delete: { uz: "O'chirish", ru: "Удалить" } satisfies Tr,
  undo: { uz: "Qaytarish", ru: "Вернуть" } satisfies Tr,
  optional: { uz: "(ixtiyoriy)", ru: "(необязательно)" } satisfies Tr,
  networkError: { uz: "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.", ru: "Ошибка сети. Проверьте интернет и попробуйте снова." } satisfies Tr,
  networkRetry: { uz: "Tarmoq xatosi. Qayta urinib ko'ring.", ru: "Ошибка сети. Попробуйте снова." } satisfies Tr,
  checkFields: { uz: "Ba'zi maydonlarni tekshiring", ru: "Проверьте некоторые поля" } satisfies Tr,
  imageUploadFailed: { uz: "Rasmni yuklab bo'lmadi. Qayta urinib ko'ring.", ru: "Не удалось загрузить изображение. Попробуйте снова." } satisfies Tr,
  copied: { uz: "Nusxalandi", ru: "Скопировано" } satisfies Tr,
  copy: { uz: "Nusxalash", ru: "Скопировать" } satisfies Tr,
  upload: { uz: "Yuklash", ru: "Загрузить" } satisfies Tr,
  yes: { uz: "Ha, o'chirish", ru: "Да, удалить" } satisfies Tr,
  no: { uz: "Yo'q", ru: "Нет" } satisfies Tr,
  more: { uz: "Yana…", ru: "Ещё…" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* Akkaunt formasi (AccountForm)                                        */
/* ------------------------------------------------------------------ */
export const AKKAUNT = {
  title: { uz: "Akkaunt", ru: "Аккаунт" } satisfies Tr,
  subtitle: { uz: "Ism, email, telefon, jins va avatar.", ru: "Имя, email, телефон, пол и аватар." } satisfies Tr,
  replacePhoto: { uz: "Rasmni almashtirish", ru: "Заменить фото" } satisfies Tr,
  uploadPhoto: { uz: "Rasm yuklash", ru: "Загрузить фото" } satisfies Tr,
  photoRemovedHint: { uz: "Rasm «Saqlash» bosilgach o'chiriladi.", ru: "Фото удалится после нажатия «Сохранить»." } satisfies Tr,
  photoHint: { uz: "JPG, PNG, WEBP yoki GIF · 5 MB gacha. Yuklashdan oldin surish va kattalashtirish mumkin.", ru: "JPG, PNG, WEBP или GIF · до 5 МБ. Перед загрузкой можно сдвинуть и увеличить." } satisfies Tr,
  uploadAvatarAria: { uz: "Avatar rasmini yuklash", ru: "Загрузить аватар" } satisfies Tr,
  cropAvatar: { uz: "Avatarni moslang", ru: "Настройте аватар" } satisfies Tr,
  name: { uz: "Ism-familiya", ru: "Имя и фамилия" } satisfies Tr,
  namePh: { uz: "Masalan: Jasur Karimov", ru: "Например: Жасур Каримов" } satisfies Tr,
  phone: { uz: "Telefon", ru: "Телефон" } satisfies Tr,
  phoneDefaultHint: { uz: "Standart: faqat ro'yxatdan o'tganlarga ko'rinadi.", ru: "По умолчанию: видно только зарегистрированным." } satisfies Tr,
  username: { uz: "Chat taxallusi", ru: "Никнейм в чате" } satisfies Tr,
  usernamePh: { uz: "masalan: jasur-karimov", ru: "например: jasur-karimov" } satisfies Tr,
  usernameChecking: { uz: "Tekshirilmoqda…", ru: "Проверяем…" } satisfies Tr,
  usernameFree: { uz: "Bo'sh — olishingiz mumkin", ru: "Свободен — можно занять" } satisfies Tr,
  usernameHint: { uz: "3–20 belgi: kichik lotin harflari, raqam va chiziqcha. Bu — chat havolangiz manzili.", ru: "3–20 символов: строчные латинские буквы, цифры и дефис. Это адрес вашей ссылки на чат." } satisfies Tr,
  usernameCheck: { uz: "Taxallusni tekshiring", ru: "Проверьте никнейм" } satisfies Tr,
  copiedCheck: { uz: "Nusxalandi ✓", ru: "Скопировано ✓" } satisfies Tr,
  gender: { uz: "Jins", ru: "Пол" } satisfies Tr,
  genderHint: { uz: "Mijozlar ro'yxatda jins bo'yicha saralashi mumkin.", ru: "Клиенты могут фильтровать список по полу." } satisfies Tr,
  email: { uz: "Email", ru: "Email" } satisfies Tr,
  verifyInSecurity: { uz: "Xavfsizlik bo'limida tasdiqlang", ru: "Подтвердите в разделе «Безопасность»" } satisfies Tr,
  unverified: { uz: "Tasdiqlanmagan", ru: "Не подтверждён" } satisfies Tr,
  verified: { uz: "Tasdiqlangan", ru: "Подтверждён" } satisfies Tr,
  emailChangedHint: { uz: "Yangi email qayta tasdiqlanadi, eski manzilga ogohlantirish yuboriladi.", ru: "Новый email нужно будет подтвердить, на старый адрес придёт уведомление." } satisfies Tr,
  emailHint: { uz: "Email kirish uchun ishlatiladi.", ru: "Email используется для входа." } satisfies Tr,
  currentPassword: { uz: "Joriy parol", ru: "Текущий пароль" } satisfies Tr,
  currentPasswordHint: { uz: "Emailni o'zgartirish uchun parolingizni kiriting.", ru: "Введите пароль, чтобы изменить email." } satisfies Tr,
  currentPasswordRequired: { uz: "Emailni o'zgartirish uchun joriy parolni kiriting", ru: "Введите текущий пароль, чтобы изменить email" } satisfies Tr,
  emailUpdated: { uz: "Email yangilandi. Yangi manzilni tasdiqlang —", ru: "Email обновлён. Подтвердите новый адрес —" } satisfies Tr,
  getCodeInSecurity: { uz: "Xavfsizlik bo'limida kod oling", ru: "получите код в разделе «Безопасность»" } satisfies Tr,
  notifyEmail: { uz: "Email bildirishnomalar", ru: "Email-уведомления" } satisfies Tr,
  notifyOn: { uz: "Muhim hodisalar emailga ham keladi.", ru: "Важные события приходят и на email." } satisfies Tr,
  notifyOff: { uz: "Faqat saytdagi qo'ng'iroqda. Xavfsizlik xatlari baribir yuboriladi.", ru: "Только в колокольчике на сайте. Письма о безопасности отправляются в любом случае." } satisfies Tr,
  notifyByType: { uz: "Turlar bo'yicha sozlash", ru: "Настроить по типам" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* Ko'rinish belgisi (VisibilityChip)                                   */
/* ------------------------------------------------------------------ */
export const KORINISH_CHIP = {
  title: { uz: "Kimga ko'rinishini «Maxfiylik» bo'limida o'zgartirasiz", ru: "Кому видно — меняется в разделе «Приватность»" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* Rasm kesgich (ImageCropper)                                          */
/* ------------------------------------------------------------------ */
export const KESGICH = {
  zoom: { uz: "Kattalashtirish", ru: "Масштаб" } satisfies Tr,
  hint: { uz: "Surib joylashtiring; slayder, g'ildirak yoki ikki barmoq bilan kattalashtiring.", ru: "Перетащите для позиционирования; масштаб — слайдером, колёсиком или двумя пальцами." } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* Sevimlilar kartasi (FavoriteSlot)                                    */
/* ------------------------------------------------------------------ */
export const SEVIMLI_SLOT = {
  removed: { uz: "sevimlilardan olib tashlandi", ru: "удалён из избранного" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* Profil sahifasi bo'limlari (ProfilePanels + /kabinet/profil)         */
/* ------------------------------------------------------------------ */
export const PROFIL_SAHIFA = {
  sectionsAria: { uz: "Bo'limlar", ru: "Разделы" } satisfies Tr,
  welcome: { uz: (name: string) => `Xush kelibsiz, ${name}!`, ru: (name: string) => `Добро пожаловать, ${name}!` },
  welcomeSpecialist: { uz: "Quyida mutaxassis profilingizni to'ldiring — shunda mijozlar sizni xaritadan topadi.", ru: "Заполните профиль специалиста ниже — и клиенты найдут вас на карте." } satisfies Tr,
  welcomeClient: { uz: "Akkaunt ma'lumotlarini tekshiring. Mutaxassis topish uchun xaritaga o'ting yoki o'zingiz profil oching.", ru: "Проверьте данные аккаунта. Чтобы найти специалиста, перейдите на карту или откройте свой профиль." } satisfies Tr,
  welcomeOther: { uz: "Akkaunt ma'lumotlaringizni tekshirib chiqing.", ru: "Проверьте данные вашего аккаунта." } satisfies Tr,
  eyebrow: { uz: "Kabinet", ru: "Кабинет" } satisfies Tr,
  titleStart: { uz: "Profil va", ru: "Профиль и" } satisfies Tr,
  titleAccent: { uz: "maxfiylik", ru: "приватность" } satisfies Tr,
  descEdit: { uz: "Akkaunt, mutaxassis profili, ko'rinish va ish vaqti.", ru: "Аккаунт, профиль специалиста, видимость и график работы." } satisfies Tr,
  descSpecialist: { uz: "Avval akkaunt, keyin mutaxassis profilini to'ldiring.", ru: "Сначала аккаунт, затем заполните профиль специалиста." } satisfies Tr,
  descClient: { uz: "Akkaunt ma'lumotlari. Xohlasangiz, mutaxassis profilini ham ochasiz.", ru: "Данные аккаунта. При желании можно открыть и профиль специалиста." } satisfies Tr,
  tabAccount: { uz: "Akkaunt", ru: "Аккаунт" } satisfies Tr,
  tabTelegram: { uz: "Telegram", ru: "Telegram" } satisfies Tr,
  tabSpecialist: { uz: "Mutaxassis profili", ru: "Профиль специалиста" } satisfies Tr,
  tabBecome: { uz: "Mutaxassis bo'lish", ru: "Стать специалистом" } satisfies Tr,
  tabPrivacy: { uz: "Maxfiylik", ru: "Приватность" } satisfies Tr,
  tabSchedule: { uz: "Ish vaqti", ru: "График работы" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* Portfolio sahifasi (/kabinet/portfolio)                              */
/* ------------------------------------------------------------------ */
export const PORTFOLIO_SAHIFA = {
  eyebrow: { uz: "Kabinet", ru: "Кабинет" } satisfies Tr,
  titleStart: { uz: "Portfolio", ru: "Работы" } satisfies Tr,
  titleAccent: { uz: "ishlari", ru: "портфолио" } satisfies Tr,
  desc: { uz: (max: number) => `${max} tagacha rasm, video yoki havola — mijozlar shunga qarab tanlaydi.`, ru: (max: number) => `До ${max} изображений, видео или ссылок — по ним клиенты и выбирают.` },
  descNoProfile: { uz: "Avval mutaxassis profilini yarating.", ru: "Сначала создайте профиль специалиста." } satisfies Tr,
  emptyTitle: { uz: "Avval mutaxassis profilini to'ldiring", ru: "Сначала заполните профиль специалиста" } satisfies Tr,
  emptyDesc: { uz: "Yo'nalish, hudud va narxlarni kiriting — shundan so'ng portfolio bo'limi ochiladi.", ru: "Укажите направление, регион и цены — после этого откроется раздел портфолио." } satisfies Tr,
  fillProfile: { uz: "Profilni to'ldirish", ru: "Заполнить профиль" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* Xavfsizlik sahifasi (/kabinet/xavfsizlik)                            */
/* ------------------------------------------------------------------ */
export const XAVFSIZLIK_SAHIFA = {
  eyebrow: { uz: "Kabinet", ru: "Кабинет" } satisfies Tr,
  titleStart: { uz: "Hisob", ru: "Безопасность" } satisfies Tr,
  titleAccent: { uz: "xavfsizligi", ru: "аккаунта" } satisfies Tr,
  desc: { uz: "Maxfiylik, bloklanganlar, parol, ikki bosqichli himoya va faol qurilmalar.", ru: "Приватность, заблокированные, пароль, двухэтапная защита и активные устройства." } satisfies Tr,
  admin2faTitle: { uz: "Admin panel uchun ikki bosqichli himoya majburiy.", ru: "Для админ-панели двухэтапная защита обязательна." } satisfies Tr,
  admin2faText: { uz: "Pastdagi «Ikki bosqichli himoya» bo'limida autentifikator ilovasini ulang — shundan keyin admin panel va Telegram admin boti ochiladi.", ru: "Подключите приложение-аутентификатор в разделе «Двухэтапная защита» ниже — после этого откроются админ-панель и Telegram-бот администратора." } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* Bloklanganlar (BlockedList)                                          */
/* ------------------------------------------------------------------ */
export const BLOK = {
  failed: { uz: "Bo'lmadi", ru: "Не получилось" } satisfies Tr,
  unblocked: { uz: (name: string) => `${name} blokdan chiqarildi`, ru: (name: string) => `${name} разблокирован(а)` },
  title: { uz: "Bloklanganlar", ru: "Заблокированные" } satisfies Tr,
  desc: { uz: "Bloklangan odam sizga yoza olmaydi, obuna bo'lmaydi, izoh va reaksiya qo'ya olmaydi.", ru: "Заблокированный не сможет писать вам, подписываться, комментировать и ставить реакции." } satisfies Tr,
  emptyStart: { uz: "Hali hech kim bloklanmagan. Bloklash — profil yoki chat sarlavhasidagi", ru: "Пока никто не заблокирован. Блокировка — кнопка" } satisfies Tr,
  emptyEnd: { uz: "tugmasi.", ru: "в профиле или в шапке чата." } satisfies Tr,
  blockAria: { uz: "blok", ru: "блок" } satisfies Tr,
  searchPh: { uz: "Ism yoki @taxallus bo'yicha qidirish", ru: "Поиск по имени или @никнейму" } satisfies Tr,
  searchAria: { uz: "Bloklanganlar orasida qidirish", ru: "Поиск среди заблокированных" } satisfies Tr,
  notFound: { uz: (q: string) => `«${q}» bo'yicha hech kim topilmadi.`, ru: (q: string) => `По запросу «${q}» никого не найдено.` },
  unblock: { uz: "Blokdan chiqarish", ru: "Разблокировать" } satisfies Tr,
  unblockAria: { uz: (name: string) => `${name} — blokdan chiqarish`, ru: (name: string) => `${name} — разблокировать` },
};

/* ------------------------------------------------------------------ */
/* Maxfiylik paneli (PrivacyPanel — kim yozadi / izoh / onlayn / pauza) */
/* ------------------------------------------------------------------ */
export const MAXFIYLIK = {
  dmAll: { uz: "Hamma", ru: "Все" } satisfies Tr,
  dmAllHint: { uz: "Istalgan foydalanuvchi sizga yoza oladi", ru: "Написать вам может любой пользователь" } satisfies Tr,
  dmFollowing: { uz: "Obunalarim", ru: "Мои подписки" } satisfies Tr,
  dmFollowingHint: { uz: "Faqat siz obuna bo'lgan odamlar yangi suhbat ocha oladi", ru: "Новый диалог могут начать только те, на кого вы подписаны" } satisfies Tr,
  dmNone: { uz: "Hech kim", ru: "Никто" } satisfies Tr,
  dmNoneHint: { uz: "Yangi suhbatlar yopiq — mavjud suhbatlar davom etadi", ru: "Новые диалоги закрыты — текущие продолжаются" } satisfies Tr,
  cAll: { uz: "Hamma", ru: "Все" } satisfies Tr,
  cAllHint: { uz: "Kirgan har bir foydalanuvchi postlaringizga izoh yoza oladi", ru: "Комментировать ваши посты может любой вошедший пользователь" } satisfies Tr,
  cFollowers: { uz: "Obunachilarim", ru: "Мои подписчики" } satisfies Tr,
  cFollowersHint: { uz: "Faqat sizga obuna bo'lganlar", ru: "Только ваши подписчики" } satisfies Tr,
  cNone: { uz: "Hech kim", ru: "Никто" } satisfies Tr,
  cNoneHint: { uz: "Izohlar yopiq (reaksiyalar qoladi)", ru: "Комментарии закрыты (реакции остаются)" } satisfies Tr,
  notSaved: { uz: "Saqlanmadi", ru: "Не сохранено" } satisfies Tr,
  saved: { uz: "Maxfiylik saqlandi", ru: "Приватность сохранена" } satisfies Tr,
  pausedOn: { uz: "Hisob pauzaga qo'yildi — profil katalogda ko'rinmaydi", ru: "Аккаунт на паузе — профиль не отображается в каталоге" } satisfies Tr,
  pausedOff: { uz: "Hisob qayta faollashtirildi", ru: "Аккаунт снова активен" } satisfies Tr,
  title: { uz: "Maxfiylik", ru: "Приватность" } satisfies Tr,
  desc: { uz: "Kim yozadi, kim izoh qoldiradi, onlayn holat.", ru: "Кто пишет, кто комментирует, статус онлайн." } satisfies Tr,
  saving: { uz: "Saqlanmoqda…", ru: "Сохранение…" } satisfies Tr,
  savedState: { uz: "Saqlangan", ru: "Сохранено" } satisfies Tr,
  dmTitle: { uz: "Kim menga yozishi mumkin", ru: "Кто может мне писать" } satisfies Tr,
  commentTitle: { uz: "Kim postlarimga izoh yozadi", ru: "Кто может комментировать мои посты" } satisfies Tr,
  online: { uz: "Onlayn holatimni ko'rsatish", ru: "Показывать мой статус онлайн" } satisfies Tr,
  onlineOn: { uz: "Yashil nuqta va «oxirgi faollik» suhbatdoshlarga ko'rinadi", ru: "Собеседники видят зелёную точку и «последнюю активность»" } satisfies Tr,
  onlineOff: { uz: "Hech kim onlaynligingizni va oxirgi faolligingizni ko'rmaydi", ru: "Никто не видит, что вы онлайн, и вашу последнюю активность" } satisfies Tr,
  pause: { uz: "Hisobni pauza qilish", ru: "Поставить аккаунт на паузу" } satisfies Tr,
  pauseOn: { uz: "Profil katalog, xarita va qidiruvda ko'rinmaydi. Havola, mavjud buyurtmalar va chat ishlaydi", ru: "Профиль скрыт из каталога, карты и поиска. Ссылка, текущие заказы и чат работают" } satisfies Tr,
  pauseOff: { uz: "Ta'til yoki bandlikda profilni vaqtincha katalogdan yashiring — hech narsa o'chmaydi", ru: "В отпуске или при занятости временно скройте профиль из каталога — ничего не удалится" } satisfies Tr,
  footer: { uz: "Kontaktlaringiz (telefon, Telegram, email) bu sozlamalardan qat'i nazar faqat buyurtma qabul qilingach ko'rinadi. Bloklanganlar hech qachon yoza olmaydi.", ru: "Ваши контакты (телефон, Telegram, email) независимо от этих настроек видны только после принятия заказа. Заблокированные никогда не смогут написать." } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* Ko'rinish sozlamalari (PrivacySettings — maydonlar kimga ko'rinadi)  */
/* ------------------------------------------------------------------ */
export const KORINISH_SOZLAMA = {
  contactRule: { uz: "Platforma qoidasi: aloqa ma'lumotlari faqat buyurtma qabul qilingach ochiladi", ru: "Правило платформы: контакты открываются только после принятия заказа" } satisfies Tr,
  previewGuest: { uz: "Mehmon", ru: "Гость" } satisfies Tr,
  previewClient: { uz: "Ro'yxatdan o'tgan", ru: "Зарегистрированный" } satisfies Tr,
  previewClientShort: { uz: "Mijoz", ru: "Клиент" } satisfies Tr,
  previewOrder: { uz: "Buyurtmachi", ru: "Заказчик" } satisfies Tr,
  title: { uz: "Maxfiylik", ru: "Приватность" } satisfies Tr,
  desc: { uz: "Har bir maydon kimga ko'rinishini tanlang. Aloqa ma'lumotlari qoida bo'yicha faqat buyurtma qabul qilingach ochiladi.", ru: "Выберите, кому видно каждое поле. Контакты по правилам открываются только после принятия заказа." } satisfies Tr,
  viewOnPage: { uz: "Sahifada ko'rish", ru: "Посмотреть на странице" } satisfies Tr,
  notFilled: { uz: "to'ldirilmagan", ru: "не заполнено" } satisfies Tr,
  whoSeesAria: { uz: (label: string) => `${label} — kimga ko'rinadi`, ru: (label: string) => `${label} — кому видно` },
  previewTitle: { uz: "Profilingiz boshqalarga shunday ko'rinadi", ru: "Так ваш профиль видят другие" } satisfies Tr,
  previewAll: { uz: "Tanlangan ko'ruvchi hamma maydonni ko'radi.", ru: "Выбранный зритель видит все поля." } satisfies Tr,
  previewHidden: { uz: (n: number) => `${n} ta maydon bu ko'ruvchidan yashirin.`, ru: (n: number) => `${n} ${ruPlural(n, ["поле скрыто", "поля скрыты", "полей скрыто"])} от этого зрителя.` },
  previewDirty: { uz: " Saqlanmagan o'zgarishlar hisobga olingan.", ru: " Несохранённые изменения учтены." } satisfies Tr,
  previewAsAria: { uz: "Kim sifatida ko'rish", ru: "Смотреть как" } satisfies Tr,
  visible: { uz: "ko'rinadi", ru: "видно" } satisfies Tr,
  locked: { uz: "yopiq", ru: "скрыто" } satisfies Tr,
  resetDefault: { uz: "Tavsiya etilganga qaytarish", ru: "Вернуть рекомендуемые" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* Ish vaqti (ScheduleEditor)                                           */
/* ------------------------------------------------------------------ */
export const JADVAL = {
  presetWeekdays: { uz: "Hafta ichi 9–18", ru: "Будни 9–18" } satisfies Tr,
  presetEveryday: { uz: "Har kuni 10–20", ru: "Ежедневно 10–20" } satisfies Tr,
  presetWeekend: { uz: "Faqat dam olish kunlari", ru: "Только выходные" } satisfies Tr,
  prevMonth: { uz: "Oldingi oy", ru: "Предыдущий месяц" } satisfies Tr,
  nextMonth: { uz: "Keyingi oy", ru: "Следующий месяц" } satisfies Tr,
  busyDaysAria: { uz: (month: string) => `${month} — band kunlar`, ru: (month: string) => `${month} — занятые дни` },
  busySuffix: { uz: " — band", ru: " — занят" } satisfies Tr,
  errEnd: { uz: "Tugash vaqti boshlanishdan keyin bo'lsin", ru: "Время окончания должно быть позже начала" } satisfies Tr,
  errDays: { uz: "Kamida bitta ish kunini yoqing yoki jadvalni o'chiring", ru: "Включите хотя бы один рабочий день или отключите график" } satisfies Tr,
  errPast: { uz: "Sana o'tib ketgan", ru: "Дата уже прошла" } satisfies Tr,
  title: { uz: "Ish vaqti", ru: "График работы" } satisfies Tr,
  desc: { uz: "Mijozlar sizga qachon bog'lanish mumkinligini ko'radi. Toshkent vaqti (UTC+5).", ru: "Клиенты видят, когда с вами можно связаться. Время Ташкента (UTC+5)." } satisfies Tr,
  onVacation: { uz: "Ta'tilda", ru: "В отпуске" } satisfies Tr,
  showSchedule: { uz: "Ish vaqtini ko'rsatish", ru: "Показывать график работы" } satisfies Tr,
  markDays: { uz: "Kunlarni belgilang", ru: "Отметьте дни" } satisfies Tr,
  hiddenHint: { uz: "Profilda ish vaqti bo'limi ko'rinmaydi", ru: "Раздел графика в профиле не отображается" } satisfies Tr,
  quickFill: { uz: "Tez to'ldirish:", ru: "Быстро заполнить:" } satisfies Tr,
  clear: { uz: "Tozalash", ru: "Очистить" } satisfies Tr,
  workdayAria: { uz: (day: string) => `${day} — ish kuni`, ru: (day: string) => `${day} — рабочий день` },
  today: { uz: "bugun", ru: "сегодня" } satisfies Tr,
  startAria: { uz: (day: string) => `${day} boshlanishi`, ru: (day: string) => `${day} — начало` },
  endAria: { uz: (day: string) => `${day} tugashi`, ru: (day: string) => `${day} — конец` },
  copyTitle: { uz: "Shu soatlarni barcha ish kunlariga nusxalash", ru: "Скопировать эти часы на все рабочие дни" } satisfies Tr,
  copyAria: { uz: (day: string) => `${day} soatlarini barcha ish kunlariga nusxalash`, ru: (day: string) => `Скопировать часы (${day}) на все рабочие дни` },
  dayOff: { uz: "Dam olish kuni", ru: "Выходной" } satisfies Tr,
  note: { uz: "Izoh", ru: "Примечание" } satisfies Tr,
  notePh: { uz: "Masalan: To'y mavsumida dam olish kunlari ham ishlayman", ru: "Например: в свадебный сезон работаю и по выходным" } satisfies Tr,
  vacationUntil: { uz: "Ta'tilda shu sanagacha", ru: "В отпуске до этой даты" } satisfies Tr,
  vacationBanner: { uz: (d: string) => `Profilda «Ta'tilda — ${d} gacha» banneri ko'rinadi.`, ru: (d: string) => `В профиле показан баннер «В отпуске — до ${d}».` },
  vacationHint: { uz: "Belgilansa, profilda ta'til banneri chiqadi; buyurtmalar navbatga qo'yiladi.", ru: "Если указать, в профиле появится баннер отпуска; заказы встанут в очередь." } satisfies Tr,
  cancelVacationAria: { uz: "Ta'tilni bekor qilish", ru: "Отменить отпуск" } satisfies Tr,
  cancelShort: { uz: "Bekor", ru: "Отмена" } satisfies Tr,
  busyDays: { uz: "Band kunlar", ru: "Занятые дни" } satisfies Tr,
  busyDesc: { uz: (n: number) => `Kelgusi ${n} kun ichida band bo'lgan kunlarni bosing — profilda «Band kunlar» ro'yxatida ko'rinadi (ish vaqti ko'rinishiga bog'liq).`, ru: (n: number) => `Отметьте занятые дни в ближайшие ${n} дней — они появятся в профиле в списке «Занятые дни» (зависит от видимости графика).` },
  clearCount: { uz: (n: number) => `Tozalash (${n})`, ru: (n: number) => `Очистить (${n})` },
};

/* ------------------------------------------------------------------ */
/* Portfolio boshqaruvchisi (PortfolioManager)                          */
/* ------------------------------------------------------------------ */
export const PORTF = {
  typeImage: { uz: "Rasm", ru: "Фото" } satisfies Tr,
  typeImageHint: { uz: "Rasmni yuklang yoki tayyor havolani qo'ying.", ru: "Загрузите изображение или вставьте готовую ссылку." } satisfies Tr,
  typeVideo: { uz: "Video", ru: "Видео" } satisfies Tr,
  typeVideoHint: { uz: "YouTube yoki Vimeo havolasi — profilda shu yerning o'zida o'ynaydi (YouTube muqovasi avtomatik).", ru: "Ссылка на YouTube или Vimeo — воспроизводится прямо в профиле (обложка YouTube подставляется автоматически)." } satisfies Tr,
  typeVideoPh: { uz: "https://youtube.com/watch?v=… yoki https://vimeo.com/…", ru: "https://youtube.com/watch?v=… или https://vimeo.com/…" } satisfies Tr,
  typeLink: { uz: "Havola", ru: "Ссылка" } satisfies Tr,
  typeLinkHint: { uz: "Behance, Dribbble, Instagram yoki sayt havolasi.", ru: "Ссылка на Behance, Dribbble, Instagram или сайт." } satisfies Tr,
  uploadedImage: { uz: "Yuklangan rasm", ru: "Загруженное изображение" } satisfies Tr,
  orderSaved: { uz: "Tartib saqlandi", ru: "Порядок сохранён" } satisfies Tr,
  orderNotSaved: { uz: "Tarmoq xatosi. Tartib saqlanmadi.", ru: "Ошибка сети. Порядок не сохранён." } satisfies Tr,
  deletedN: { uz: (n: number) => `${n} ta ish o'chirildi`, ru: (n: number) => `${n} ${ruPlural(n, ["работа удалена", "работы удалены", "работ удалено"])}` },
  deletedOne: { uz: "Ish o'chirildi", ru: "Работа удалена" } satisfies Tr,
  count: { uz: (n: number, max: number) => `${n} / ${max} ta ish`, ru: (n: number, max: number) => `${n} / ${max} работ` },
  full: { uz: "Limit to'ldi — yangi ish uchun eskisini o'chiring.", ru: "Лимит исчерпан — удалите старую работу, чтобы добавить новую." } satisfies Tr,
  reorderHint: { uz: "Sudrab yoki strelkalar bilan tartiblang. Birinchi ish — muqova.", ru: "Упорядочьте перетаскиванием или стрелками. Первая работа — обложка." } satisfies Tr,
  addHint: { uz: "Rasm, YouTube video yoki havola. Birinchi ish — muqova.", ru: "Фото, видео с YouTube или ссылка. Первая работа — обложка." } satisfies Tr,
  select: { uz: "Tanlash", ru: "Выбрать" } satisfies Tr,
  public: { uz: "Ommaviy", ru: "Публичный" } satisfies Tr,
  addWork: { uz: "Ish qo'shish", ru: "Добавить работу" } satisfies Tr,
  selectedRegion: { uz: "Tanlangan ishlar", ru: "Выбранные работы" } satisfies Tr,
  selectedCount: { uz: (n: number) => `${n} ta tanlandi`, ru: (n: number) => `Выбрано: ${n}` },
  all: { uz: "Hammasi", ru: "Все" } satisfies Tr,
  clear: { uz: "Tozalash", ru: "Снять" } satisfies Tr,
  confirmDeleteAria: { uz: "O'chirishni tasdiqlash", ru: "Подтвердить удаление" } satisfies Tr,
  deleteNQ: { uz: (n: number) => `${n} ta ish o'chirilsinmi?`, ru: (n: number) => `Удалить ${n} ${ruPlural(n, ["работу", "работы", "работ"])}?` },
  deleteSelected: { uz: "Tanlanganlarni o'chirish", ru: "Удалить выбранные" } satisfies Tr,
  added: { uz: "Ish qo'shildi", ru: "Работа добавлена" } satisfies Tr,
  emptyTitle: { uz: "Portfolio hali bo'sh", ru: "Портфолио пока пусто" } satisfies Tr,
  emptyDesc: { uz: "Birinchi ishingizni qo'shing — mijozlar portfolioga qarab tanlaydi.", ru: "Добавьте первую работу — клиенты выбирают по портфолио." } satisfies Tr,
  selectAria: { uz: (t: string) => `${t} — tanlash`, ru: (t: string) => `${t} — выбрать` },
  coverTitle: { uz: "Birinchi ish muqovada ko'rinadi", ru: "Первая работа показывается на обложке" } satisfies Tr,
  cover: { uz: "Muqova", ru: "Обложка" } satisfies Tr,
  beforeAfter: { uz: "Oldin / keyin", ru: "До / после" } satisfies Tr,
  orderAria: { uz: (t: string) => `${t} — tartib`, ru: (t: string) => `${t} — порядок` },
  dragAria: { uz: (t: string) => `${t} — sudrab tartiblash (klaviatura: ↑ ↓ Home End)`, ru: (t: string) => `${t} — перетащить (клавиатура: ↑ ↓ Home End)` },
  dragTitle: { uz: "Sudrab tartiblang · ↑/↓", ru: "Перетащите · ↑/↓" } satisfies Tr,
  makeCoverAria: { uz: (t: string) => `${t} — muqova qilish (birinchi o'ringa)`, ru: (t: string) => `${t} — сделать обложкой (на первое место)` },
  makeCover: { uz: "Muqova qilish", ru: "Сделать обложкой" } satisfies Tr,
  moveUpAria: { uz: (t: string) => `${t} — oldinga ko'chirish`, ru: (t: string) => `${t} — переместить вперёд` },
  moveUp: { uz: "Oldinga", ru: "Вперёд" } satisfies Tr,
  moveDownAria: { uz: (t: string) => `${t} — orqaga ko'chirish`, ru: (t: string) => `${t} — переместить назад` },
  moveDown: { uz: "Orqaga", ru: "Назад" } satisfies Tr,
  changesSaved: { uz: "O'zgarishlar saqlandi", ru: "Изменения сохранены" } satisfies Tr,
  tagsAria: { uz: "Teglar", ru: "Теги" } satisfies Tr,
  deleteQ: { uz: "O'chirilsinmi?", ru: "Удалить?" } satisfies Tr,
  open: { uz: "Ochish", ru: "Открыть" } satisfies Tr,
  newWindow: { uz: "(yangi oynada)", ru: "(в новом окне)" } satisfies Tr,
  editAria: { uz: (t: string) => `${t} — tahrirlash`, ru: (t: string) => `${t} — редактировать` },
  edit: { uz: "Tahrirlash", ru: "Редактировать" } satisfies Tr,
  deleteAria: { uz: (t: string) => `${t} — o'chirish`, ru: (t: string) => `${t} — удалить` },
  tags: { uz: "Teglar", ru: "Теги" } satisfies Tr,
  tagsCount: { uz: (n: number, max: number) => `(${n}/${max}, ixtiyoriy)`, ru: (n: number, max: number) => `(${n}/${max}, необязательно)` },
  removeTagAria: { uz: (t: string) => `${t} tegini olib tashlash`, ru: (t: string) => `Удалить тег ${t}` },
  tagPh: { uz: "Masalan: to'y — Enter", ru: "Например: свадьба — Enter" } satisfies Tr,
  tagHint: { uz: "Profil galereyasida teglar bo'yicha filtr chiqadi.", ru: "В галерее профиля появится фильтр по тегам." } satisfies Tr,
  beforeLabel: { uz: "«Oldin» rasmi", ru: "Фото «до»" } satisfies Tr,
  beforeLabelHint: { uz: "(asosiy rasm — «keyin»)", ru: "(основное фото — «после»)" } satisfies Tr,
  beforeUploadAria: { uz: "«Oldin» rasmini yuklash", ru: "Загрузить фото «до»" } satisfies Tr,
  beforeHint: { uz: "Profilda sudraladigan «oldin / keyin» slayderi chiqadi (rang korreksiya, retush, render).", ru: "В профиле появится слайдер «до / после» (цветокоррекция, ретушь, рендер)." } satisfies Tr,
  title: { uz: "Sarlavha", ru: "Название" } satisfies Tr,
  description: { uz: "Tavsif", ru: "Описание" } satisfies Tr,
  thumb: { uz: "Muqova rasmi", ru: "Обложка" } satisfies Tr,
  thumbAutoHint: { uz: "Bo'sh qoldirilsa — YouTube muqovasi.", ru: "Если пусто — обложка YouTube." } satisfies Tr,
  newWork: { uz: "Yangi ish", ru: "Новая работа" } satisfies Tr,
  type: { uz: "Tur", ru: "Тип" } satisfies Tr,
  typeAria: { uz: "Ish turi", ru: "Тип работы" } satisfies Tr,
  titlePh: { uz: "Masalan: To'y filmi — Samarqand", ru: "Например: Свадебный фильм — Самарканд" } satisfies Tr,
  videoLink: { uz: "Video havolasi", ru: "Ссылка на видео" } satisfies Tr,
  uploadImageAria: { uz: "Portfolio rasmini yuklash", ru: "Загрузить изображение в портфолио" } satisfies Tr,
  uploadingAria: { uz: "Yuklanmoqda", ru: "Загрузка" } satisfies Tr,
  uploadingPct: { uz: (p: number) => `Yuklanmoqda… ${p}%`, ru: (p: number) => `Загрузка… ${p}%` },
  processing: { uz: "Qayta ishlanmoqda…", ru: "Обработка…" } satisfies Tr,
  imageHint: { uz: "JPG, PNG, WEBP · 5 MB gacha.", ru: "JPG, PNG, WEBP · до 5 МБ." } satisfies Tr,
  thumbYoutubeHint: { uz: "YouTube uchun bo'sh qoldiring — avtomatik olinadi.", ru: "Для YouTube оставьте пустым — подставится автоматически." } satisfies Tr,
  pair: { uz: "Oldin / keyin juftligi", ru: "Пара «до / после»" } satisfies Tr,
  pairHint: { uz: "Asosiy rasm — «keyin», qo'shimcha — «oldin»", ru: "Основное фото — «после», дополнительное — «до»" } satisfies Tr,
  descPh: { uz: "Loyiha haqida qisqacha: mijoz, vazifa, natija", ru: "Кратко о проекте: клиент, задача, результат" } satisfies Tr,
  preview: { uz: "Ko'rinish", ru: "Превью" } satisfies Tr,
  linkCard: { uz: "Havola kartasi", ru: "Карточка ссылки" } satisfies Tr,
  imageShown: { uz: "Rasm ko'rinadi", ru: "Здесь будет изображение" } satisfies Tr,
  add: { uz: "Qo'shish", ru: "Добавить" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* Xavfsizlik paneli (SecurityPanel)                                    */
/* ------------------------------------------------------------------ */
export const XAVF = {
  tips: [
    { title: { uz: "Parolni boshqa saytlarda takrorlamang", ru: "Не используйте пароль на других сайтах" }, text: { uz: "Bitta sayt sizsa, hammasi xavf ostida qoladi. Parol menejeridan foydalaning.", ru: "Если утечёт один сайт — под угрозой окажутся все. Используйте менеджер паролей." } },
    { title: { uz: "Shubhali havolalarga parol kiritmang", ru: "Не вводите пароль по подозрительным ссылкам" }, text: { uz: "Kasb Egalari parolni faqat rasmiy sayt manzilida so'raydi. Telegram/SMS orqali hech qachon so'ramaymiz.", ru: "Kasb Egalari запрашивает пароль только на официальном адресе сайта. Через Telegram/SMS мы его никогда не просим." } },
    { title: { uz: "Umumiy qurilmada «Meni eslab qolish»ni o'chiring", ru: "На общем устройстве отключайте «Запомнить меня»" }, text: { uz: "Shunda brauzer yopilishi bilan sessiya tugaydi.", ru: "Тогда сессия завершится, как только закроется браузер." } },
    { title: { uz: "Begona faollik sezsangiz", ru: "Заметили чужую активность?" }, text: { uz: "Parolni darhol o'zgartiring — barcha boshqa qurilmalar avtomatik chiqib ketadi.", ru: "Сразу смените пароль — все остальные устройства выйдут автоматически." } },
    { title: { uz: "Ikki bosqichli himoyani yoqing", ru: "Включите двухэтапную защиту" }, text: { uz: "Parol sizib chiqsa ham, telefoningizdagi kodsiz hisobga kirib bo'lmaydi.", ru: "Даже если пароль утечёт, без кода с вашего телефона в аккаунт не войти." } },
    { title: { uz: "Zaxira kodlarini oflayn saqlang", ru: "Храните резервные коды офлайн" }, text: { uz: "Telefon yo'qolsa, faqat ular orqali kirasiz. Ularni hech kimga yubormang.", ru: "Если потеряете телефон, войти получится только по ним. Никому их не отправляйте." } },
  ] as Array<{ title: Tr; text: Tr }>,
  tgSendFailed: { uz: "Yuborib bo'lmadi — keyinroq urinib ko'ring", ru: "Не удалось отправить — попробуйте позже" } satisfies Tr,
  networkDash: { uz: "Tarmoq xatosi — qayta urinib ko'ring", ru: "Ошибка сети — попробуйте снова" } satisfies Tr,
  currentRequired: { uz: "Joriy parolni kiriting", ru: "Введите текущий пароль" } satisfies Tr,
  pwMin: { uz: "Parol kamida 8 ta belgi", ru: "Пароль — минимум 8 символов" } satisfies Tr,
  pwMix: { uz: "Parolda harf ham, raqam ham bo'lsin", ru: "В пароле должны быть и буквы, и цифры" } satisfies Tr,
  pwSame: { uz: "Yangi parol eskisidan farq qilsin", ru: "Новый пароль должен отличаться от старого" } satisfies Tr,
  pwMismatch: { uz: "Parollar mos kelmadi", ru: "Пароли не совпадают" } satisfies Tr,
  tooMany: { uz: (m: number) => `Juda ko'p urinish. ${m} daqiqadan keyin qayta urinib ko'ring.`, ru: (m: number) => `Слишком много попыток. Повторите через ${m} ${ruPlural(m, ["минуту", "минуты", "минут"])}.` },
  tooManyShort: { uz: "Juda ko'p urinish", ru: "Слишком много попыток" } satisfies Tr,
  serverError: { uz: "Serverda kutilmagan xatolik", ru: "Непредвиденная ошибка сервера" } satisfies Tr,
  code6: { uz: "6 xonali kodni kiriting", ru: "Введите 6-значный код" } satisfies Tr,
  exportPwRequired: { uz: "Tasdiqlash uchun joriy parolni kiriting", ru: "Для подтверждения введите текущий пароль" } satisfies Tr,
  exportFailed: { uz: "Eksport qilib bo'lmadi", ru: "Не удалось экспортировать" } satisfies Tr,
  deletePwRequired: { uz: "Tasdiqlash uchun parolni kiriting", ru: "Для подтверждения введите пароль" } satisfies Tr,
  deleteFailed: { uz: "O'chirib bo'lmadi", ru: "Не удалось удалить" } satisfies Tr,
  appCode6: { uz: "Ilovadagi 6 xonali kodni kiriting", ru: "Введите 6-значный код из приложения" } satisfies Tr,
  pwRequired: { uz: "Parolni kiriting", ru: "Введите пароль" } satisfies Tr,
  codeOrRecovery: { uz: "Ilovadagi kod yoki zaxira kodini kiriting", ru: "Введите код из приложения или резервный код" } satisfies Tr,
  tfaDisabled: { uz: "Ikki bosqichli himoya o'chirildi.", ru: "Двухэтапная защита отключена." } satisfies Tr,
  copyFailed: { uz: "Nusxalab bo'lmadi — qo'lda belgilab nusxalang.", ru: "Не удалось скопировать — выделите и скопируйте вручную." } satisfies Tr,
  codesFileTitle: { uz: "Kasb Egalari — ikki bosqichli himoya zaxira kodlari", ru: "Kasb Egalari — резервные коды двухэтапной защиты" } satisfies Tr,
  codesFileAccount: { uz: (e: string) => `Hisob: ${e}`, ru: (e: string) => `Аккаунт: ${e}` },
  codesFileCreated: { uz: (d: string) => `Yaratilgan: ${d}`, ru: (d: string) => `Создано: ${d}` },
  codesFileNote1: { uz: "Har bir kod faqat bir marta ishlaydi. Telefoningiz yo'qolsa, kirishda «Tiklash kodi bilan kirish» ni tanlang.", ru: "Каждый код работает только один раз. Если потеряете телефон, при входе выберите «Войти по коду восстановления»." } satisfies Tr,
  codesFileNote2: { uz: "Kodlarni hech kimga yubormang va xavfsiz joyda saqlang.", ru: "Никому не отправляйте коды и храните их в надёжном месте." } satisfies Tr,
  adminAlertTitle: { uz: "Admin hisobida ikki bosqichli himoya o'chiq", ru: "В админ-аккаунте отключена двухэтапная защита" } satisfies Tr,
  adminAlertText: { uz: "Admin to'lovlar, pul chiqarish va foydalanuvchilarni boshqaradi. Parol sizib chiqsa — butun platforma xavf ostida. Himoyani hozir yoqing.", ru: "Администратор управляет платежами, выводом средств и пользователями. Если пароль утечёт — под угрозой вся платформа. Включите защиту сейчас." } satisfies Tr,
  enableProtection: { uz: "Himoyani yoqish", ru: "Включить защиту" } satisfies Tr,
  statusAria: { uz: "Hisob holati", ru: "Состояние аккаунта" } satisfies Tr,
  lastLogin: { uz: "Oxirgi kirish", ru: "Последний вход" } satisfies Tr,
  now: { uz: "Hozir", ru: "Сейчас" } satisfies Tr,
  firstSession: { uz: "Birinchi sessiya", ru: "Первая сессия" } satisfies Tr,
  password: { uz: "Parol", ru: "Пароль" } satisfies Tr,
  updatedSuffix: { uz: "yangilangan", ru: "обновлён" } satisfies Tr,
  neverChanged: { uz: "Hech o'zgarmagan", ru: "Не менялся" } satisfies Tr,
  pwOld: { uz: "6 oydan oshdi — yangilash tavsiya etiladi", ru: "Старше 6 месяцев — рекомендуем обновить" } satisfies Tr,
  pwRecent: { uz: "Yaqinda o'rnatilgan", ru: "Установлен недавно" } satisfies Tr,
  email: { uz: "Email", ru: "Email" } satisfies Tr,
  verified: { uz: "Tasdiqlangan", ru: "Подтверждён" } satisfies Tr,
  unverified: { uz: "Tasdiqlanmagan", ru: "Не подтверждён" } satisfies Tr,
  phone: { uz: "Telefon", ru: "Телефон" } satisfies Tr,
  notEntered: { uz: "Kiritilmagan", ru: "Не указан" } satisfies Tr,
  entered: { uz: "Kiritilgan", ru: "Указан" } satisfies Tr,
  addInProfile: { uz: "Profilda qo'shing", ru: "Добавьте в профиле" } satisfies Tr,
  verifyTitle: { uz: "Emailni tasdiqlash", ru: "Подтверждение email" } satisfies Tr,
  verifyDescStart: { uz: "Tasdiqlangan email — parolni tiklash va muhim bildirishnomalar uchun. 6 xonali kod", ru: "Подтверждённый email нужен для восстановления пароля и важных уведомлений. 6-значный код будет отправлен на" } satisfies Tr,
  verifyDescEnd: { uz: "manziliga yuboriladi.", ru: "." } satisfies Tr,
  verifiedThanks: { uz: "Email tasdiqlandi. Rahmat!", ru: "Email подтверждён. Спасибо!" } satisfies Tr,
  codeSent: { uz: "Kod yuborildi — pochtangizni tekshiring (spam papkasini ham).", ru: "Код отправлен — проверьте почту (и папку «Спам»)." } satisfies Tr,
  codeDev: { uz: "Pochta xizmati sozlanmagan: kod server konsolida (dev rejimi).", ru: "Почтовый сервис не настроен: код в консоли сервера (dev-режим)." } satisfies Tr,
  codeValidStart: { uz: "Kod", ru: "Код действует до" } satisfies Tr,
  codeValidEnd: { uz: "gacha amal qiladi.", ru: "." } satisfies Tr,
  verifyCode: { uz: "Tasdiqlash kodi", ru: "Код подтверждения" } satisfies Tr,
  confirm: { uz: "Tasdiqlash", ru: "Подтвердить" } satisfies Tr,
  resend: { uz: "Qayta yuborish", ru: "Отправить снова" } satisfies Tr,
  codeTtl: { uz: "Kod 15 daqiqa amal qiladi, bir marta ishlatiladi.", ru: "Код действует 15 минут и используется один раз." } satisfies Tr,
  sendCode: { uz: "Kod yuborish", ru: "Отправить код" } satisfies Tr,
  changePw: { uz: "Parolni o'zgartirish", ru: "Смена пароля" } satisfies Tr,
  changePwDesc: { uz: "Yangi parol saqlangach, boshqa barcha qurilmalardagi sessiyalar yopiladi. Siz shu qurilmada qolasiz.", ru: "После сохранения нового пароля сессии на всех остальных устройствах закроются. Вы останетесь на этом устройстве." } satisfies Tr,
  currentPw: { uz: "Joriy parol", ru: "Текущий пароль" } satisfies Tr,
  currentPwPh: { uz: "Hozirgi parolingiz", ru: "Ваш текущий пароль" } satisfies Tr,
  newPw: { uz: "Yangi parol", ru: "Новый пароль" } satisfies Tr,
  newPwPh: { uz: "Kamida 8 ta belgi, harf va raqam", ru: "Минимум 8 символов, буквы и цифры" } satisfies Tr,
  repeatPw: { uz: "Yangi parolni takrorlang", ru: "Повторите новый пароль" } satisfies Tr,
  repeatPwPh: { uz: "Yana bir marta", ru: "Ещё раз" } satisfies Tr,
  pwUpdated: { uz: "Parol yangilandi — boshqa qurilmalar chiqib ketdi", ru: "Пароль обновлён — другие устройства вышли" } satisfies Tr,
  pwStored: { uz: "Parol hech qachon ochiq saqlanmaydi (bcrypt, 12 raund)", ru: "Пароль никогда не хранится в открытом виде (bcrypt, 12 раундов)" } satisfies Tr,
  updatePw: { uz: "Parolni yangilash", ru: "Обновить пароль" } satisfies Tr,
  tgPwStart: { uz: "Joriy parolni bilmaysizmi? Telegram orqali ochilgan hisobda parol avtomatik yaratilgan —", ru: "Не знаете текущий пароль? В аккаунте, созданном через Telegram, пароль был сгенерирован автоматически —" } satisfies Tr,
  tgSending: { uz: "Yuborilmoqda…", ru: "Отправляем…" } satisfies Tr,
  tgSent: { uz: "Yuborildi — Telegramingizni tekshiring ✓", ru: "Отправлено — проверьте Telegram ✓" } satisfies Tr,
  tgSendLink: { uz: "yangi parol havolasini Telegramga yuborish", ru: "отправить ссылку для нового пароля в Telegram" } satisfies Tr,
  tgPwEnd: { uz: ". Havola 1 soat amal qiladi; parol o'rnatilgach email o'zgartirish va hisobni o'chirish ham ochiladi.", ru: ". Ссылка действует 1 час; после установки пароля откроются смена email и удаление аккаунта." } satisfies Tr,
  tfaTitle: { uz: "Ikki bosqichli himoya", ru: "Двухэтапная защита" } satisfies Tr,
  enabled: { uz: "Yoqilgan", ru: "Включена" } satisfies Tr,
  disabled: { uz: "O'chirilgan", ru: "Отключена" } satisfies Tr,
  tfaDesc: { uz: "Kirishda paroldan tashqari telefoningizdagi autentifikator ilovasi (Google Authenticator, Microsoft Authenticator, 1Password…) ko'rsatgan 6 xonali kod so'raladi.", ru: "При входе, кроме пароля, запрашивается 6-значный код из приложения-аутентификатора на телефоне (Google Authenticator, Microsoft Authenticator, 1Password…)." } satisfies Tr,
  lowRecovery: { uz: (n: number) => `Siz zaxira kodi bilan kirdingiz — ${n} ta kod qoldi. Yangi kodlar oling va xavfsiz saqlang.`, ru: (n: number) => `Вы вошли по резервному коду — осталось ${n} ${ruPlural(n, ["код", "кода", "кодов"])}. Получите новые коды и храните их надёжно.` },
  codesReady: { uz: "Zaxira kodlari tayyor. Ular faqat hozir ko'rsatiladi — nusxalang yoki yuklab oling.", ru: "Резервные коды готовы. Они показываются только сейчас — скопируйте или скачайте." } satisfies Tr,
  codesAria: { uz: "Zaxira kodlari", ru: "Резервные коды" } satisfies Tr,
  codesNote: { uz: "Har bir kod bir marta ishlaydi. Telefoningiz yo'qolsa, kirishda «Tiklash kodi bilan kirish»ni tanlang.", ru: "Каждый код работает один раз. Если потеряете телефон, при входе выберите «Войти по коду восстановления»." } satisfies Tr,
  downloadTxt: { uz: ".txt yuklab olish", ru: "Скачать .txt" } satisfies Tr,
  savedCodes: { uz: "Saqladim", ru: "Я сохранил(а)" } satisfies Tr,
  step1: { uz: "Autentifikator ilovasini oching", ru: "Откройте приложение-аутентификатор" } satisfies Tr,
  step1Hint: { uz: "Telefoningizda bo'lmasa — Google Authenticator yoki Microsoft Authenticator'ni o'rnating.", ru: "Если его нет на телефоне — установите Google Authenticator или Microsoft Authenticator." } satisfies Tr,
  step2: { uz: "Kasb Egalari hisobini qo'shing", ru: "Добавьте аккаунт Kasb Egalari" } satisfies Tr,
  step2Hint: { uz: "Shu telefonda bo'lsangiz — pastdagi havolani bosing. Aks holda ilovada «Kalitni kiritish»ni tanlab, quyidagi sirni yozing (turi: vaqtga asoslangan).", ru: "Если вы на этом телефоне — нажмите ссылку ниже. Иначе выберите в приложении «Ввести ключ» и введите секрет ниже (тип: по времени)." } satisfies Tr,
  secretAria: { uz: "Sir kalit", ru: "Секретный ключ" } satisfies Tr,
  openInApp: { uz: "Autentifikator ilovasida ochish", ru: "Открыть в приложении-аутентификаторе" } satisfies Tr,
  step3: { uz: "Ilova ko'rsatgan kodni kiriting", ru: "Введите код из приложения" } satisfies Tr,
  confirmEnable: { uz: "Tasdiqlash va yoqish", ru: "Подтвердить и включить" } satisfies Tr,
  disableHint: { uz: "Himoyani o'chirish uchun parol va ilovadagi kodni (yoki zaxira kodini) kiriting.", ru: "Чтобы отключить защиту, введите пароль и код из приложения (или резервный код)." } satisfies Tr,
  code: { uz: "Kod", ru: "Код" } satisfies Tr,
  codePh: { uz: "123456 yoki abcd-efgh", ru: "123456 или abcd-efgh" } satisfies Tr,
  disableProtection: { uz: "Himoyani o'chirish", ru: "Отключить защиту" } satisfies Tr,
  regenTitle: { uz: "Yangi zaxira kodlari — eskilari bekor bo'ladi", ru: "Новые резервные коды — старые перестанут действовать" } satisfies Tr,
  regenHint: { uz: "Tasdiqlash uchun ilovadagi joriy kodni kiriting.", ru: "Для подтверждения введите текущий код из приложения." } satisfies Tr,
  getNewCodes: { uz: "Yangi kodlar olish", ru: "Получить новые коды" } satisfies Tr,
  codesLeft: { uz: (n: number) => `Zaxira kodlari: ${n} ta qoldi`, ru: (n: number) => `Резервные коды: осталось ${n}` },
  setupHint: { uz: "Sozlash 1 daqiqa oladi. QR kod shart emas — sirni ilovaga kiritasiz.", ru: "Настройка занимает 1 минуту. QR-код не нужен — секрет вводится в приложение." } satisfies Tr,
  refreshCodes: { uz: "Zaxira kodlarini yangilash", ru: "Обновить резервные коды" } satisfies Tr,
  turnOff: { uz: "O'chirish", ru: "Отключить" } satisfies Tr,
  sessionsTitle: { uz: "Faol sessiyalar", ru: "Активные сессии" } satisfies Tr,
  sessionsDescStart: { uz: "Joriy sessiya:", ru: "Текущая сессия:" } satisfies Tr,
  remember30: { uz: "«Meni eslab qolish» yoqilgan — 30 kun", ru: "включено «Запомнить меня» — 30 дней" } satisfies Tr,
  untilClose: { uz: "brauzer yopilguncha", ru: "до закрытия браузера" } satisfies Tr,
  sessionsDescEnd: { uz: ". Tanimagan qurilmani ko'rsangiz — «Chiqish»ni bosing va parolni o'zgartiring.", ru: ". Увидели незнакомое устройство — нажмите «Выйти» и смените пароль." } satisfies Tr,
  sessionsListAria: { uz: "Faol sessiyalar ro'yxati", ru: "Список активных сессий" } satisfies Tr,
  noSessions: { uz: "Faol sessiyalar topilmadi.", ru: "Активных сессий не найдено." } satisfies Tr,
  thisDevice: { uz: "Shu qurilma", ru: "Это устройство" } satisfies Tr,
  activeNow: { uz: "Hozir faol", ru: "Активна сейчас" } satisfies Tr,
  lastActivity: { uz: "Oxirgi faollik:", ru: "Последняя активность:" } satisfies Tr,
  signedIn: { uz: "· Kirgan:", ru: "· Вход:" } satisfies Tr,
  logoutSessionAria: { uz: (l: string) => `${l} sessiyasidan chiqish`, ru: (l: string) => `Выйти из сессии ${l}` },
  logout: { uz: "Chiqish", ru: "Выйти" } satisfies Tr,
  showLess: { uz: "Kamroq ko'rsatish", ru: "Показать меньше" } satisfies Tr,
  moreSessions: { uz: (n: number) => `Yana ${n} ta sessiya`, ru: (n: number) => `Ещё ${n} ${ruPlural(n, ["сессия", "сессии", "сессий"])}` },
  othersRevoked: { uz: "Boshqa qurilmalar chiqarildi. Siz shu yerda qolasiz.", ru: "Другие устройства вышли. Вы остаётесь здесь." } satisfies Tr,
  confirmAll: { uz: "Ishonchingiz komilmi? Boshqa qurilmalarda qayta kirish kerak bo'ladi.", ru: "Вы уверены? На других устройствах придётся войти заново." } satisfies Tr,
  currentUnaffected: { uz: "Joriy qurilma ta'sirlanmaydi.", ru: "Текущее устройство не затрагивается." } satisfies Tr,
  yesLogoutAll: { uz: "Ha, hammasidan chiqish", ru: "Да, выйти отовсюду" } satisfies Tr,
  logoutAll: { uz: "Barcha qurilmalardan chiqish", ru: "Выйти со всех устройств" } satisfies Tr,
  historyTitle: { uz: "Kirish tarixi", ru: "История входов" } satisfies Tr,
  historyDesc: { uz: (n: number) => `Oxirgi ${n} ta hodisa · IP qisman yashirilgan`, ru: (n: number) => `Последние ${n} ${ruPlural(n, ["событие", "события", "событий"])} · IP частично скрыт` },
  tfaRecovery: { uz: "zaxira kodi", ru: "резервный код" } satisfies Tr,
  tfaApp: { uz: "ilova", ru: "приложение" } satisfies Tr,
  dangerTitle: { uz: "Xavfli zona", ru: "Опасная зона" } satisfies Tr,
  dangerDesc: { uz: "Ma'lumotlaringiz sizniki: istalgan payt nusxasini yuklab oling yoki hisobni butunlay o'chiring.", ru: "Ваши данные принадлежат вам: в любой момент скачайте копию или полностью удалите аккаунт." } satisfies Tr,
  exportTitle: { uz: "Ma'lumotlarimni yuklab olish", ru: "Скачать мои данные" } satisfies Tr,
  exported: { uz: "Fayl yuklab olindi", ru: "Файл скачан" } satisfies Tr,
  exportDesc: { uz: "Hisob, profil, buyurtmalar, to'lovlar, sharhlar va bildirishnomalar — bitta fayl (JSON yoki o'qiladigan HTML).", ru: "Аккаунт, профиль, заказы, платежи, отзывы и уведомления — одним файлом (JSON или читаемый HTML)." } satisfies Tr,
  download: { uz: "Yuklab olish", ru: "Скачать" } satisfies Tr,
  exportConfirm: { uz: "Eksportda barcha shaxsiy ma'lumotlaringiz bor — tasdiqlash uchun joriy parolni kiriting.", ru: "В экспорте все ваши личные данные — для подтверждения введите текущий пароль." } satisfies Tr,
  formatAria: { uz: "Fayl formati", ru: "Формат файла" } satisfies Tr,
  formatJson: { uz: "JSON (texnik)", ru: "JSON (технический)" } satisfies Tr,
  formatHtml: { uz: "HTML (o'qiladigan)", ru: "HTML (читаемый)" } satisfies Tr,
  deleteTitle: { uz: "Akkauntni o'chirish", ru: "Удаление аккаунта" } satisfies Tr,
  deleteDesc: { uz: "Ism, email, telefon va profil o'chiriladi (qaytarib bo'lmaydi). Buyurtma va to'lov tarixi anonim holda saqlanadi. Eskroudagi to'lov yoki kutilayotgan pul chiqarish bo'lsa — avval yakunlang.", ru: "Имя, email, телефон и профиль будут удалены (без возможности восстановления). История заказов и платежей сохранится анонимно. Если есть платёж в эскроу или ожидающий вывод средств — сначала завершите их." } satisfies Tr,
  deleteBtn: { uz: "Akkauntni o'chirish", ru: "Удалить аккаунт" } satisfies Tr,
  deleted: { uz: "Akkaunt o'chirildi. Bosh sahifaga qaytmoqdamiz…", ru: "Аккаунт удалён. Возвращаемся на главную…" } satisfies Tr,
  deleteConfirm: { uz: "Ishonchingiz komilmi? Tasdiqlash uchun joriy parolingizni kiriting.", ru: "Вы уверены? Для подтверждения введите текущий пароль." } satisfies Tr,
  tipsTitle: { uz: "Maslahatlar", ru: "Советы" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* Mutaxassis profili formasi (ProfileForm)                             */
/* ------------------------------------------------------------------ */
export const PROF = {
  langs: { uz: { uz: "O'zbek", ru: "Узбекский" }, ru: { uz: "Rus", ru: "Русский" }, en: { uz: "Ingliz", ru: "Английский" }, kaa: { uz: "Qoraqalpoq", ru: "Каракалпакский" }, tg: { uz: "Tojik", ru: "Таджикский" } } as Record<string, Tr>,
  sections: {
    "pf-asosiy": { uz: "Asosiy", ru: "Основное" },
    "pf-hudud": { uz: "Hudud", ru: "Регион" },
    "pf-haqida": { uz: "Haqida", ru: "О себе" },
    "pf-narx": { uz: "Narx", ru: "Цена" },
    "pf-paketlar": { uz: "Paketlar", ru: "Пакеты" },
    "pf-sertifikat": { uz: "Sertifikatlar", ru: "Сертификаты" },
    "pf-tajriba": { uz: "Tajriba", ru: "Опыт" },
    "pf-aloqa": { uz: "Aloqa", ru: "Контакты" },
    "pf-muqova": { uz: "Muqova", ru: "Обложка" },
    "pf-holat": { uz: "Holat", ru: "Статус" },
  } as Record<string, Tr>,
  nextSection: { uz: (l: string) => `Keyingi bo'lim: ${l}`, ru: (l: string) => `Следующий раздел: ${l}` },
  removeAria: { uz: (v: string) => `${v} — olib tashlash`, ru: (v: string) => `${v} — убрать` },
  bioPrompts: [
    { key: "exp", label: { uz: "Tajriba", ru: "Опыт" }, text: { uz: "Tajriba: __ yildan beri __ yo'nalishida ishlayman. Eng ko'p __ loyihalar bilan ishlaganman.", ru: "Опыт: работаю в направлении __ с __ года. Больше всего работал(а) с проектами __." } },
    { key: "style", label: { uz: "Uslub", ru: "Стиль" }, text: { uz: "Uslub: __ (masalan, kinematik, minimal, yorqin). Har loyihaga mijoz brendi va maqsadidan kelib chiqib yondashaman.", ru: "Стиль: __ (например, кинематографичный, минималистичный, яркий). К каждому проекту подхожу исходя из бренда и целей клиента." } },
    { key: "gear", label: { uz: "Jihozlar", ru: "Оборудование" }, text: { uz: "Jihozlar va dasturlar: __ (kamera/obyektivlar, dron, yorug'lik; Premiere Pro, DaVinci, After Effects).", ru: "Оборудование и программы: __ (камера/объективы, дрон, свет; Premiere Pro, DaVinci, After Effects)." } },
    { key: "flow", label: { uz: "Ish jarayoni", ru: "Процесс работы" }, text: { uz: "Ish jarayoni: brif → ssenariy/moodboard → suratga olish → montaj → 2 marta tuzatish → topshirish. Muddat: odatda __ kun.", ru: "Процесс работы: бриф → сценарий/мудборд → съёмка → монтаж → 2 правки → сдача. Срок: обычно __ дней." } },
  ] as Array<{ key: string; label: Tr; text: Tr }>,
  /* validatsiya */
  errTitle: { uz: "Sarlavha kamida 5 ta belgi", ru: "Заголовок — минимум 5 символов" } satisfies Tr,
  errCity: { uz: "Shaharni kiriting", ru: "Укажите город" } satisfies Tr,
  errLang: { uz: "Kamida bitta tilni tanlang", ru: "Выберите хотя бы один язык" } satisfies Tr,
  errMinPrice: { uz: (p: string) => `Minimal narx — ${p}`, ru: (p: string) => `Минимальная цена — ${p}` },
  errMaxPrice: { uz: "Maksimal narx minimaldan kam bo'lmasin", ru: "Максимальная цена не может быть меньше минимальной" } satisfies Tr,
  errPkgTitle: { uz: "Paket nomini yozing", ru: "Введите название пакета" } satisfies Tr,
  errPkgPrice: { uz: "Narx kamida 1 000 so'm", ru: "Цена — минимум 1 000 сум" } satisfies Tr,
  errPkgDays: { uz: "1–365 kun", ru: "1–365 дней" } satisfies Tr,
  errCertTitle: { uz: "Nomini yozing", ru: "Введите название" } satisfies Tr,
  errCertIssuer: { uz: "Kim berganini yozing", ru: "Укажите, кем выдан" } satisfies Tr,
  errHttps: { uz: "https:// bilan boshlansin", ru: "Должна начинаться с https://" } satisfies Tr,
  errRole: { uz: "Lavozimni yozing", ru: "Введите должность" } satisfies Tr,
  errCompany: { uz: "Kompaniya yoki loyihani yozing", ru: "Введите компанию или проект" } satisfies Tr,
  errToYear: { uz: "Boshlanishdan keyin, kelajakda emas", ru: "После начала и не в будущем" } satisfies Tr,
  errSchool: { uz: "Muassasani yozing", ru: "Введите учебное заведение" } satisfies Tr,
  errDegree: { uz: "Yo'nalish/darajani yozing", ru: "Введите направление/степень" } satisfies Tr,
  /* CTA */
  ctaEyebrow: { uz: "Ijodkorlar uchun", ru: "Для креаторов" } satisfies Tr,
  ctaTitleStart: { uz: "Mutaxassis", ru: "Стать" } satisfies Tr,
  ctaTitleAccent: { uz: "bo'lish", ru: "специалистом" } satisfies Tr,
  ctaDesc: { uz: "Videograf, montajor, dizaynermisiz? Profil oching — mijozlar sizni xaritadan topadi, buyurtmalar to'g'ridan-to'g'ri kabinetingizga keladi. Bepul.", ru: "Вы видеограф, монтажёр, дизайнер? Откройте профиль — клиенты найдут вас на карте, а заказы придут прямо в кабинет. Бесплатно." } satisfies Tr,
  ctaPerks: [
    { uz: "Portfolio", ru: "Портфолио" },
    { uz: "Narxlar", ru: "Цены" },
    { uz: "Sharhlar", ru: "Отзывы" },
    { uz: "Xaritada ko'rinish", ru: "Видимость на карте" },
  ] as Tr[],
  createProfile: { uz: "Profil yaratish", ru: "Создать профиль" } satisfies Tr,
  /* sarlavha */
  titleEdit: { uz: "Mutaxassis profili", ru: "Профиль специалиста" } satisfies Tr,
  titleCreate: { uz: "Mutaxassis profilini yaratish", ru: "Создание профиля специалиста" } satisfies Tr,
  descEdit: { uz: "Bu ma'lumotlar ommaviy profilingizda va xaritada ko'rinadi.", ru: "Эти данные видны в вашем публичном профиле и на карте." } satisfies Tr,
  descCreate: { uz: "Yo'nalish, hudud va narxlarni kiriting — profilingiz xaritada paydo bo'ladi.", ru: "Укажите направление, регион и цены — профиль появится на карте." } satisfies Tr,
  publicProfile: { uz: "Ommaviy profil", ru: "Публичный профиль" } satisfies Tr,
  savedEdit: { uz: "Profil saqlandi", ru: "Профиль сохранён" } satisfies Tr,
  savedCreate: { uz: "Profil yaratildi! Endi portfolio qo'shing.", ru: "Профиль создан! Теперь добавьте портфолио." } satisfies Tr,
  viewPublic: { uz: "Ommaviy profilni ko'rish", ru: "Открыть публичный профиль" } satisfies Tr,
  portfolio: { uz: "Portfolio", ru: "Портфолио" } satisfies Tr,
  draftRestored: { uz: "Qoralama tiklandi", ru: "Черновик восстановлен" } satisfies Tr,
  draftRestoredHint: { uz: "— oxirgi marta saqlanmagan o'zgarishlaringiz.", ru: "— ваши несохранённые изменения." } satisfies Tr,
  completeness: { uz: "Profil to'liqligi", ru: "Заполненность профиля" } satisfies Tr,
  sectionsNavAria: { uz: "Profil bo'limlari", ru: "Разделы профиля" } satisfies Tr,
  filled: { uz: " (to'ldirilgan)", ru: " (заполнено)" } satisfies Tr,
  /* Asosiy */
  basicTitle: { uz: "Asosiy ma'lumotlar", ru: "Основная информация" } satisfies Tr,
  basicHint: { uz: "Sarlavha va yo'nalish — mijoz birinchi ko'radigan narsa", ru: "Заголовок и направление — первое, что видит клиент" } satisfies Tr,
  title: { uz: "Sarlavha", ru: "Заголовок" } satisfies Tr,
  titlePh: { uz: "Masalan: To'y va event videografi | Sony FX3", ru: "Например: Свадебный и event-видеограф | Sony FX3" } satisfies Tr,
  titleHint: { uz: "5–90 belgi. Qisqa va aniq.", ru: "5–90 символов. Коротко и ясно." } satisfies Tr,
  category: { uz: "Yo'nalish", ru: "Направление" } satisfies Tr,
  pickCategory: { uz: "Kasbingizni tanlang", ru: "Выберите профессию" } satisfies Tr,
  experience: { uz: "Tajriba", ru: "Опыт" } satisfies Tr,
  experienceAria: { uz: "Tajriba darajasi", ru: "Уровень опыта" } satisfies Tr,
  /* Hudud */
  regionTitle: { uz: "Hudud", ru: "Регион" } satisfies Tr,
  regionHint: { uz: "Xaritada shu hududda ko'rinasiz", ru: "На карте вы будете в этом регионе" } satisfies Tr,
  region: { uz: "Viloyat", ru: "Область" } satisfies Tr,
  city: { uz: "Shahar / tuman", ru: "Город / район" } satisfies Tr,
  otherCity: { uz: "Boshqa…", ru: "Другой…" } satisfies Tr,
  cityPh: { uz: "Shahar yoki tuman nomi", ru: "Название города или района" } satisfies Tr,
  cityAria: { uz: "Shahar nomi", ru: "Название города" } satisfies Tr,
  /* Haqida */
  aboutTitle: { uz: "O'zingiz haqingizda", ru: "О себе" } satisfies Tr,
  aboutHint: { uz: "Tajriba, uslub, jihozlar va ish jarayoni — mijoz ishonchini oshiradigan narsalar", ru: "Опыт, стиль, оборудование и процесс работы — то, что повышает доверие клиента" } satisfies Tr,
  bio: { uz: "Bio", ru: "Био" } satisfies Tr,
  bioLines: { uz: "Yangi qatorlar profilda saqlanadi", ru: "Переносы строк сохраняются в профиле" } satisfies Tr,
  bioPh: {
    uz: "Masalan:\n9 yildan beri to'y va reklama videolarini suratga olaman. Uslubim — kinematik, tabiiy yorug'lik va jonli hissiyotlar.\n\nJihozlar: Sony FX3, 24–70 f/2.8, DJI Mavic 3. Montaj — DaVinci Resolve.\n\nIsh jarayoni: brif → suratga olish → 7 kun ichida montaj → 2 marta tuzatish.",
    ru: "Например:\n9 лет снимаю свадебные и рекламные видео. Мой стиль — кинематографичный, естественный свет и живые эмоции.\n\nОборудование: Sony FX3, 24–70 f/2.8, DJI Mavic 3. Монтаж — DaVinci Resolve.\n\nПроцесс: бриф → съёмка → монтаж за 7 дней → 2 правки.",
  } satisfies Tr,
  bioShort: { uz: "Kamida 2–3 jumla yozing — to'liq bio ishonchni oshiradi.", ru: "Напишите хотя бы 2–3 предложения — полное био повышает доверие." } satisfies Tr,
  bioGood: { uz: "Zo'r! Qisqa abzatslar o'qishni osonlashtiradi.", ru: "Отлично! Короткие абзацы легче читать." } satisfies Tr,
  whatToWrite: { uz: "Nima yozsam bo'ladi?", ru: "Что написать?" } satisfies Tr,
  skills: { uz: "Ko'nikmalar", ru: "Навыки" } satisfies Tr,
  skillPh: { uz: "Masalan: Premiere Pro — Enter bilan qo'shing", ru: "Например: Premiere Pro — добавьте через Enter" } satisfies Tr,
  skillHint: { uz: "Enter yoki vergul bilan qo'shing, chipni bosib olib tashlang.", ru: "Добавляйте через Enter или запятую, нажмите на чип, чтобы убрать." } satisfies Tr,
  workTypes: { uz: "Ish turlari", ru: "Типы работ" } satisfies Tr,
  workTypesHint: { uz: "(qaysi loyihalar bilan ishlaysiz)", ru: "(с какими проектами вы работаете)" } satisfies Tr,
  workTypesNote: { uz: "Mijozlar ro'yxatda «Ish turi» bo'yicha filtrlaydi.", ru: "Клиенты фильтруют список по «Типу работы»." } satisfies Tr,
  equipment: { uz: "Jihozlar", ru: "Оборудование" } satisfies Tr,
  equipmentPh: { uz: "Masalan: Sony A7IV — Enter bilan qo'shing", ru: "Например: Sony A7IV — добавьте через Enter" } satisfies Tr,
  equipmentHint: { uz: "Kamera, dron, stabilizator, yorug'lik yoki dasturiy-texnik jihozlar. Mijozlar jihoz bo'yicha qidira oladi.", ru: "Камера, дрон, стабилизатор, свет или программно-техническое оснащение. Клиенты могут искать по оборудованию." } satisfies Tr,
  languages: { uz: "Muloqot tillari", ru: "Языки общения" } satisfies Tr,
  languagesAria: { uz: "Tillar", ru: "Языки" } satisfies Tr,
  /* Narx */
  priceTitle: { uz: "Narxlar", ru: "Цены" } satisfies Tr,
  priceHintSection: { uz: (min: string, usd: number) => `Minimal narx — ${min} (yoki $${usd}). Diapazon ko'rsatsangiz, mijozga tushunarli bo'ladi`, ru: (min: string, usd: number) => `Минимальная цена — ${min} (или $${usd}). Укажите диапазон — клиенту будет понятнее` },
  currency: { uz: "Valyuta", ru: "Валюта" } satisfies Tr,
  currencyAria: { uz: "Narx valyutasi", ru: "Валюта цены" } satisfies Tr,
  uzs: { uz: "So'm", ru: "Сум" } satisfies Tr,
  usd: { uz: "Dollar ($)", ru: "Доллар ($)" } satisfies Tr,
  rate: { uz: (r: string) => `Kurs: 1 $ ≈ ${r} — katalogda so'mdagi ekvivalenti bilan saralanadi`, ru: (r: string) => `Курс: 1 $ ≈ ${r} — в каталоге сортируется по эквиваленту в сумах` },
  minPrice: { uz: "Minimal narx", ru: "Минимальная цена" } satisfies Tr,
  maxPrice: { uz: "Maksimal narx", ru: "Максимальная цена" } satisfies Tr,
  som: { uz: "so'm", ru: "сум" } satisfies Tr,
  inProfile: { uz: "Profilda:", ru: "В профиле:" } satisfies Tr,
  fromPrice: { uz: (p: string) => `${p} dan`, ru: (p: string) => `от ${p}` },
  noPrice: { uz: "Narx ko'rsatilmasa «Kelishiladi» deb chiqadi", ru: "Без цены будет показано «Договорная»" } satisfies Tr,
  marketSuggestion: { uz: "Bozor tavsiyasi:", ru: "Рекомендация рынка:" } satisfies Tr,
  rates: { uz: "Tariflar", ru: "Тарифы" } satisfies Tr,
  ratesHint: { uz: "Profilda «Narx kalkulyatori» chiqadi: mijoz soat, kun yoki dona sonini kiritib taxminiy narxni ko'radi.", ru: "В профиле появится «Калькулятор цены»: клиент укажет часы, дни или количество и увидит примерную стоимость." } satisfies Tr,
  rateHourly: { uz: "Soatbay", ru: "Почасово" } satisfies Tr,
  rateDaily: { uz: "Kunbay", ru: "Посуточно" } satisfies Tr,
  rateProject: { uz: "Loyihabay (dan)", ru: "За проект (от)" } satisfies Tr,
  rateUnit: { uz: "Donabay (1 dona ish)", ru: "Поштучно (1 работа)" } satisfies Tr,
  /* Paketlar */
  packagesTitle: { uz: "Xizmat paketlari", ru: "Пакеты услуг" } satisfies Tr,
  packagesHint: { uz: "3 tagacha tayyor paket — mijoz narx va muddatni darhol ko'radi, «Tanlash» bilan buyurtma beradi", ru: "До 3 готовых пакетов — клиент сразу видит цену и срок и заказывает кнопкой «Выбрать»" } satisfies Tr,
  pkgVisible: { uz: "Profilda ko'rinadi", ru: "Видно в профиле" } satisfies Tr,
  pkgOff: { uz: "O'chirilgan", ru: "Отключён" } satisfies Tr,
  pkgSwitchAria: { uz: (t: string) => `${t} paketi`, ru: (t: string) => `Пакет «${t}»` },
  pkgName: { uz: "Paket nomi", ru: "Название пакета" } satisfies Tr,
  pkgNamePh: { uz: "Masalan: 30 soniyalik reklama roligi", ru: "Например: 30-секундный рекламный ролик" } satisfies Tr,
  pkgPrice: { uz: "Narx", ru: "Цена" } satisfies Tr,
  pkgDays: { uz: "Muddat (kun)", ru: "Срок (дней)" } satisfies Tr,
  pkgRevisions: { uz: "Tuzatishlar", ru: "Правки" } satisfies Tr,
  pkgIncludes: { uz: "Nimalar kiradi", ru: "Что входит" } satisfies Tr,
  pkgFeaturePh: { uz: "Masalan: Musiqa va ovoz effektlari", ru: "Например: Музыка и звуковые эффекты" } satisfies Tr,
  pkgFeatureAria: { uz: (t: string, i: number) => `${t}: imkoniyat ${i}`, ru: (t: string, i: number) => `${t}: пункт ${i}` },
  pkgRemoveFeatureAria: { uz: (i: number) => `${i}-imkoniyatni olib tashlash`, ru: (i: number) => `Убрать пункт ${i}` },
  pkgAddFeature: { uz: "Imkoniyat qo'shish", ru: "Добавить пункт" } satisfies Tr,
  pkgNote: { uz: "Minimal narx bo'sh bo'lsa, profilda eng arzon paket narxi «… dan» bo'lib ko'rinadi.", ru: "Если минимальная цена не указана, в профиле будет показана цена самого дешёвого пакета «от …»." } satisfies Tr,
  /* Sertifikatlar */
  certTitle: { uz: "Sertifikatlar va litsenziyalar", ru: "Сертификаты и лицензии" } satisfies Tr,
  certHint: { uz: "Kurslar, diplomlar, dron uchish ruxsatnomasi — ishonchni oshiradi", ru: "Курсы, дипломы, разрешение на полёты дрона — повышают доверие" } satisfies Tr,
  certN: { uz: (i: number) => `Sertifikat ${i}`, ru: (i: number) => `Сертификат ${i}` },
  certName: { uz: "Nomi", ru: "Название" } satisfies Tr,
  certNamePh: { uz: "Masalan: Dron uchish ruxsatnomasi", ru: "Например: Разрешение на полёты дрона" } satisfies Tr,
  certIssuer: { uz: "Kim bergan", ru: "Кем выдан" } satisfies Tr,
  certIssuerPh: { uz: "Masalan: Aviatsiya agentligi", ru: "Например: Агентство авиации" } satisfies Tr,
  certYear: { uz: "Yil", ru: "Год" } satisfies Tr,
  certUrl: { uz: "Havola", ru: "Ссылка" } satisfies Tr,
  certUrlHint: { uz: "(ixtiyoriy, https://)", ru: "(необязательно, https://)" } satisfies Tr,
  addCert: { uz: "Sertifikat qo'shish", ru: "Добавить сертификат" } satisfies Tr,
  /* Tajriba */
  expTitle: { uz: "Tajriba va ta'lim", ru: "Опыт и образование" } satisfies Tr,
  expHint: { uz: "Qayerda ishlagansiz, nimani o'qigansiz — profil «Haqida» bo'limi ostida chiqadi", ru: "Где работали, что изучали — показывается под разделом «О себе» в профиле" } satisfies Tr,
  workHistory: { uz: "Ish tajribasi", ru: "Опыт работы" } satisfies Tr,
  expN: { uz: (i: number) => `Tajriba ${i}`, ru: (i: number) => `Опыт ${i}` },
  role: { uz: "Lavozim", ru: "Должность" } satisfies Tr,
  rolePh: { uz: "Masalan: Montajor", ru: "Например: Монтажёр" } satisfies Tr,
  company: { uz: "Kompaniya / loyiha", ru: "Компания / проект" } satisfies Tr,
  companyPh: { uz: "Masalan: Sevimli TV", ru: "Например: Sevimli TV" } satisfies Tr,
  fromYear: { uz: "Boshlanish yili", ru: "Год начала" } satisfies Tr,
  toYear: { uz: "Tugash yili", ru: "Год окончания" } satisfies Tr,
  toYearWorkHint: { uz: "(bo'sh — hozirgacha)", ru: "(пусто — по настоящее время)" } satisfies Tr,
  toYearWorkPh: { uz: "hozirgacha", ru: "по настоящее время" } satisfies Tr,
  shortDesc: { uz: "Qisqa tavsif", ru: "Краткое описание" } satisfies Tr,
  shortDescPh: { uz: "Nima qildingiz, qanday natija?", ru: "Что делали, какой результат?" } satisfies Tr,
  addExp: { uz: "Tajriba qo'shish", ru: "Добавить опыт" } satisfies Tr,
  education: { uz: "Ta'lim", ru: "Образование" } satisfies Tr,
  eduN: { uz: (i: number) => `Ta'lim ${i}`, ru: (i: number) => `Образование ${i}` },
  school: { uz: "Muassasa", ru: "Учебное заведение" } satisfies Tr,
  schoolPh: { uz: "Masalan: O'zDSMI", ru: "Например: ГИИКУз" } satisfies Tr,
  degree: { uz: "Yo'nalish / daraja", ru: "Направление / степень" } satisfies Tr,
  degreePh: { uz: "Masalan: Kino va TV rejissyorligi, bakalavr", ru: "Например: Режиссура кино и ТВ, бакалавр" } satisfies Tr,
  toYearEduHint: { uz: "(bo'sh — o'qimoqda)", ru: "(пусто — учится)" } satisfies Tr,
  toYearEduPh: { uz: "o'qimoqda", ru: "учится" } satisfies Tr,
  addEdu: { uz: "Ta'lim qo'shish", ru: "Добавить образование" } satisfies Tr,
  /* Aloqa */
  contactTitle: { uz: "Aloqa va havolalar", ru: "Контакты и ссылки" } satisfies Tr,
  contactHint: { uz: "Mijozlar siz bilan qanday bog'lanadi", ru: "Как клиенты свяжутся с вами" } satisfies Tr,
  youtube: { uz: "YouTube kanal", ru: "YouTube-канал" } satisfies Tr,
  website: { uz: "Veb-sayt", ru: "Веб-сайт" } satisfies Tr,
  /* Muqova */
  coverTitle: { uz: "Muqova rasmi", ru: "Обложка" } satisfies Tr,
  coverHint: { uz: "Profil sarlavhasida keng rasm — yuklashda kesish oynasi 4:1 nisbatga o'zi moslaydi", ru: "Широкое изображение в шапке профиля — при загрузке окно обрезки само подгонит под 4:1" } satisfies Tr,
  coverUrl: { uz: "Rasm havolasi", ru: "Ссылка на изображение" } satisfies Tr,
  coverUrlPh: { uz: "https://… yoki quyidan yuklang", ru: "https://… или загрузите ниже" } satisfies Tr,
  uploadImage: { uz: "Rasm yuklash", ru: "Загрузить фото" } satisfies Tr,
  removeImage: { uz: "Olib tashlash", ru: "Убрать" } satisfies Tr,
  uploadCoverAria: { uz: "Muqova rasmini yuklash", ru: "Загрузить обложку" } satisfies Tr,
  coverFileHint: { uz: "JPG, PNG, WEBP · 5 MB gacha. Yuklashdan oldin rasmni surish va kattalashtirish mumkin.", ru: "JPG, PNG, WEBP · до 5 МБ. Перед загрузкой можно сдвинуть и увеличить." } satisfies Tr,
  cropCover: { uz: "Muqovani moslang", ru: "Настройте обложку" } satisfies Tr,
  coverPreviewAlt: { uz: "Muqova ko'rinishi", ru: "Превью обложки" } satisfies Tr,
  imageFailed: { uz: "Rasm yuklanmadi", ru: "Изображение не загрузилось" } satisfies Tr,
  preview: { uz: "Ko'rinish", ru: "Превью" } satisfies Tr,
  /* Holat */
  statusTitle: { uz: "Holat", ru: "Статус" } satisfies Tr,
  accepting: { uz: "Buyurtma qabul qilaman", ru: "Принимаю заказы" } satisfies Tr,
  acceptingOn: { uz: "Profilda «Bo'sh» belgisi ko'rinadi.", ru: "В профиле показан статус «Свободен»." } satisfies Tr,
  acceptingOff: { uz: "Profilda «Band» belgisi ko'rinadi, buyurtmalar navbatga tushadi.", ru: "В профиле показан статус «Занят», заказы встают в очередь." } satisfies Tr,
  acceptingAria: { uz: "Buyurtma qabul qilish holati", ru: "Статус приёма заказов" } satisfies Tr,
  /* Pastki panel */
  registerAs: { uz: (c: string) => `${c} sifatida ro'yxatdan o'tasiz`, ru: (c: string) => `Вы регистрируетесь как «${c}»` },
  createBtn: { uz: "Profilni yaratish", ru: "Создать профиль" } satisfies Tr,
};
