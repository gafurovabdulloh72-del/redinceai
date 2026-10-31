/**
 * Vakansiyalar bo'limi FORMALARI lug'ati: vakansiya/rezyume formasi, ariza yuborish, nomzodlar ro'yxati,
 * ko'nikma kiritgichi, arizani qaytarib olish tugmasi.
 * Umumiy yorliqlar (kasb, format, bandlik, holat, maosh…) `vacancies.ts`dagi `*Tr` funksiyalardan olinadi.
 */
import type { Tr } from "../index";
import { ruPlural } from "./catalog";

/* --------- Vakansiya formasi (VacancyForm) --------- */
export const VAK_FORM = {
  saveFailed: { uz: "Saqlab bo'lmadi", ru: "Не удалось сохранить" } satisfies Tr,
  position: { uz: "Lavozim", ru: "Должность" } satisfies Tr,
  positionPh: { uz: "Masalan: Video montajchi (Premiere Pro), masofaviy", ru: "Например: Видеомонтажёр (Premiere Pro), удалённо" } satisfies Tr,
  company: { uz: "Kompaniya / jamoa (ixtiyoriy)", ru: "Компания / команда (необязательно)" } satisfies Tr,
  companyPh: { uz: "Masalan: Brand Studio", ru: "Например: Brand Studio" } satisfies Tr,
  profession: { uz: "Kasb / soha", ru: "Профессия / сфера" } satisfies Tr,
  choose: { uz: "Tanlang…", ru: "Выберите…" } satisfies Tr,
  format: { uz: "Ish formati", ru: "Формат работы" } satisfies Tr,
  employment: { uz: "Bandlik", ru: "Занятость" } satisfies Tr,
  experience: { uz: "Tajriba", ru: "Опыт" } satisfies Tr,
  region: { uz: "Hudud", ru: "Регион" } satisfies Tr,
  anyRegion: { uz: "Istalgan hudud", ru: "Любой регион" } satisfies Tr,
  salary: { uz: "Maosh (so'm / oy) — ixtiyoriy", ru: "Зарплата (сум / мес.) — необязательно" } satisfies Tr,
  salaryFromPh: { uz: "dan: 3 000 000", ru: "от: 3 000 000" } satisfies Tr,
  salaryToPh: { uz: "gacha: 6 000 000", ru: "до: 6 000 000" } satisfies Tr,
  salaryFromAria: { uz: "Maosh dan", ru: "Зарплата от" } satisfies Tr,
  salaryToAria: { uz: "Maosh gacha", ru: "Зарплата до" } satisfies Tr,
  salaryHint: {
    uz: "Bo'sh — «Kelishiladi». Maosh ko'rsatilgan e'lonlarga ko'proq ariza keladi.",
    ru: "Пусто — «Договорная». На вакансии с указанной зарплатой откликаются чаще.",
  } satisfies Tr,
  description: { uz: "Tavsif — vazifalar, shartlar, jamoa", ru: "Описание — задачи, условия, команда" } satisfies Tr,
  descriptionPh: { uz: "Nima qilinadi, qanday loyihalar, ish vaqti, qanday jamoa…", ru: "Что нужно делать, какие проекты, график, какая команда…" } satisfies Tr,
  requirements: { uz: "Talablar (ixtiyoriy)", ru: "Требования (необязательно)" } satisfies Tr,
  requirementsPh: { uz: "Har qatorga bitta talab: 2 yil tajriba, Premiere Pro, portfolio…", ru: "По одному требованию в строке: 2 года опыта, Premiere Pro, портфолио…" } satisfies Tr,
  skills: { uz: "Ko'nikmalar (teglar)", ru: "Навыки (теги)" } satisfies Tr,
  applyUrl: { uz: "Tashqi ariza havolasi (ixtiyoriy)", ru: "Внешняя ссылка для отклика (необязательно)" } satisfies Tr,
  applyUrlPh: { uz: "https://… (Google Form, hh.uz) — asosiy yo'l sayt ichidagi ariza", ru: "https://… (Google Form, hh.uz) — основной способ — отклик на сайте" } satisfies Tr,
  saving: { uz: "Saqlanmoqda…", ru: "Сохранение…" } satisfies Tr,
  postCopy: { uz: "Nusxani joylash", ru: "Разместить копию" } satisfies Tr,
  post: { uz: "Vakansiyani joylash", ru: "Разместить вакансию" } satisfies Tr,
  save: { uz: "Saqlash", ru: "Сохранить" } satisfies Tr,
  cancel: { uz: "Bekor", ru: "Отмена" } satisfies Tr,
  close: { uz: "Yopish (to'ldi)", ru: "Закрыть (позиция занята)" } satisfies Tr,
  reopen: { uz: "Qayta ochish — yana 30 kun", ru: "Открыть снова — ещё 30 дней" } satisfies Tr,
  confirmDeleteAria: { uz: "O'chirishni tasdiqlang", ru: "Подтвердите удаление" } satisfies Tr,
  deleteWarn: { uz: "Vakansiya va arizalar o'chadi. Aniqmi?", ru: "Вакансия и отклики будут удалены. Точно?" } satisfies Tr,
  yesDelete: { uz: "Ha, o'chirish", ru: "Да, удалить" } satisfies Tr,
  delete: { uz: "O'chirish", ru: "Удалить" } satisfies Tr,
  createNote: {
    uz: "30 kun ro'yxatda turadi, bir bosishda uzaytiriladi. Arizalar «Vakansiyalarim» bo'limiga keladi.",
    ru: "Вакансия висит 30 дней, продлевается в один клик. Отклики приходят в раздел «Мои вакансии».",
  } satisfies Tr,
};

/* --------- Ariza yuborish (ApplyForm) --------- */
export const VAK_APPLY = {
  sendFailed: { uz: "Yuborilmadi", ru: "Не отправлено" } satisfies Tr,
  withdrawFailed: { uz: "Qaytarib bo'lmadi", ru: "Не удалось отозвать" } satisfies Tr,
  loginTitle: { uz: "Ariza yuborish uchun kiring", ru: "Войдите, чтобы откликнуться" } satisfies Tr,
  loginDesc: { uz: "Bepul hisob oching — rezyume to'ldiring va bir bosishda ariza yuboring.", ru: "Создайте бесплатный аккаунт — заполните резюме и откликайтесь в один клик." } satisfies Tr,
  login: { uz: "Kirish", ru: "Войти" } satisfies Tr,
  register: { uz: "Ro'yxatdan o'tish", ru: "Регистрация" } satisfies Tr,
  sent: { uz: "Arizangiz yuborilgan", ru: "Ваш отклик отправлен" } satisfies Tr,
  statusPre: { uz: "Holati: ", ru: "Статус: " } satisfies Tr,
  statusPost: { uz: ". Ish beruvchi javobi bildirishnomaga va «Arizalarim» bo'limiga keladi.", ru: ". Ответ работодателя придёт в уведомления и раздел «Мои отклики»." } satisfies Tr,
  myApplications: { uz: "Arizalarim", ru: "Мои отклики" } satisfies Tr,
  withdraw: { uz: "Arizani qaytarib olish", ru: "Отозвать отклик" } satisfies Tr,
  title: { uz: "Ariza yuborish", ru: "Отклик на вакансию" } satisfies Tr,
  resumeAttachedPre: { uz: "Rezyumeingiz biriktiriladi: ", ru: "Будет приложено ваше резюме: " } satisfies Tr,
  update: { uz: "Yangilash", ru: "Обновить" } satisfies Tr,
  noResumePre: { uz: "Rezyumeingiz yo'q — ", ru: "У вас нет резюме — " } satisfies Tr,
  noResumeLink: { uz: "2 daqiqada to'ldiring", ru: "заполните за 2 минуты" } satisfies Tr,
  noResumePost: {
    uz: (min: number) => ` yoki quyida qisqacha o'zingiz haqingizda yozing (kamida ${min} belgi).`,
    ru: (min: number) => ` или кратко расскажите о себе ниже (минимум ${min} ${ruPlural(min, ["символ", "символа", "символов"])}).`,
  },
  letterPhResume: { uz: "Qisqa xat (ixtiyoriy): nega aynan siz, qachondan boshlay olasiz…", ru: "Короткое письмо (необязательно): почему именно вы, когда можете начать…" } satisfies Tr,
  letterPhNoResume: { uz: "Tajribangiz, ko'nikmalaringiz, portfolio havolasi…", ru: "Ваш опыт, навыки, ссылка на портфолио…" } satisfies Tr,
  moreChars: {
    uz: (n: number) => `Yana ${n} ta belgi`,
    ru: (n: number) => `Ещё ${n} ${ruPlural(n, ["символ", "символа", "символов"])}`,
  },
  contactNote: { uz: "Ism, email va telefoningiz faqat shu ish beruvchiga ko'rinadi.", ru: "Имя, email и телефон увидит только этот работодатель." } satisfies Tr,
  sending: { uz: "Yuborilmoqda…", ru: "Отправка…" } satisfies Tr,
  send: { uz: "Ariza yuborish", ru: "Отправить отклик" } satisfies Tr,
  externalForm: { uz: "Tashqi forma", ru: "Внешняя форма" } satisfies Tr,
};

/* --------- Ko'nikma kiritgichi (SkillsInput) --------- */
export const VAK_SKILLS = {
  placeholder: { uz: "Masalan: Figma, After Effects, Python…", ru: "Например: Figma, After Effects, Python…" } satisfies Tr,
  remove: { uz: (s: string) => `${s} ni olib tashlash`, ru: (s: string) => `Убрать ${s}` },
};

/* --------- Arizani qaytarib olish (WithdrawButton) --------- */
export const VAK_WITHDRAW = {
  failed: { uz: "Bajarilmadi", ru: "Не выполнено" } satisfies Tr,
  confirmAria: { uz: "Arizani qaytarib olishni tasdiqlang", ru: "Подтвердите отзыв отклика" } satisfies Tr,
  question: { uz: "Qaytarib olinsinmi?", ru: "Отозвать отклик?" } satisfies Tr,
  yes: { uz: "Ha", ru: "Да" } satisfies Tr,
  no: { uz: "Yo'q", ru: "Нет" } satisfies Tr,
  withdraw: { uz: "Qaytarib olish", ru: "Отозвать" } satisfies Tr,
};

/* --------- Rezyume formasi (ResumeForm) --------- */
export const VAK_RESUME = {
  saveFailed: { uz: "Saqlab bo'lmadi", ru: "Не удалось сохранить" } satisfies Tr,
  deleteFailed: { uz: "O'chirib bo'lmadi", ru: "Не удалось удалить" } satisfies Tr,
  failed: { uz: "Bajarilmadi", ru: "Не выполнено" } satisfies Tr,
  savedPublic: { uz: "Saqlandi — rezyume katalogda ko'rinadi", ru: "Сохранено — резюме видно в каталоге" } satisfies Tr,
  savedPrivate: { uz: "Saqlandi — rezyume faqat arizalaringizga biriktiriladi", ru: "Сохранено — резюме прилагается только к вашим откликам" } satisfies Tr,
  bumped: { uz: "Rezyume katalogda yuqoriga ko'tarildi", ru: "Резюме поднято в каталоге" } satisfies Tr,
  /* To'liqlik o'lchagichi bandlari */
  checkPosition: { uz: "Lavozim", ru: "Должность" } satisfies Tr,
  checkProfession: { uz: "Kasb", ru: "Профессия" } satisfies Tr,
  checkAbout: { uz: "O'zingiz haqingizda (80+ belgi)", ru: "О себе (80+ символов)" } satisfies Tr,
  checkSkills: { uz: "Kamida 3 ta ko'nikma", ru: "Минимум 3 навыка" } satisfies Tr,
  checkLink: { uz: "Portfolio yoki profil havolasi", ru: "Ссылка на портфолио или профиль" } satisfies Tr,
  checkSalary: { uz: "Kutilayotgan maosh", ru: "Ожидаемая зарплата" } satisfies Tr,
  checkLevel: { uz: "Tajriba darajasi", ru: "Уровень опыта" } satisfies Tr,
  completeness: { uz: "Rezyume to'liqligi", ru: "Заполненность резюме" } satisfies Tr,
  addPre: { uz: "Qo'shing: ", ru: "Добавьте: " } satisfies Tr,
  perfect: { uz: "A'lo — bunday rezyumelar 2–3 barobar ko'p javob oladi.", ru: "Отлично — такие резюме получают в 2–3 раза больше ответов." } satisfies Tr,
  titleLabel: { uz: "Izlayotgan lavozim", ru: "Желаемая должность" } satisfies Tr,
  titlePh: { uz: "Masalan: Motion dizayner / SMM menejer / Frontend dasturchi", ru: "Например: Моушн-дизайнер / SMM-менеджер / Frontend-разработчик" } satisfies Tr,
  profession: { uz: "Kasb / soha", ru: "Профессия / сфера" } satisfies Tr,
  choose: { uz: "Tanlang…", ru: "Выберите…" } satisfies Tr,
  experience: { uz: "Tajriba", ru: "Опыт" } satisfies Tr,
  format: { uz: "Ish formati", ru: "Формат работы" } satisfies Tr,
  region: { uz: "Hudud", ru: "Регион" } satisfies Tr,
  anyRegion: { uz: "Istalgan hudud", ru: "Любой регион" } satisfies Tr,
  expectedSalary: { uz: "Kutilayotgan maosh (so'm / oy) — ixtiyoriy", ru: "Ожидаемая зарплата (сум / мес.) — необязательно" } satisfies Tr,
  expectedSalaryPh: { uz: "Masalan: 5 000 000", ru: "Например: 5 000 000" } satisfies Tr,
  about: { uz: "O'zingiz haqingizda", ru: "О себе" } satisfies Tr,
  aboutPh: {
    uz: "Tajriba, loyihalar, natijalar, qaysi vositalarda ishlaysiz, qachondan boshlay olasiz…",
    ru: "Опыт, проекты, результаты, какими инструментами владеете, когда можете начать…",
  } satisfies Tr,
  skills: { uz: "Ko'nikmalar", ru: "Навыки" } satisfies Tr,
  links: { uz: "Havolalar — portfolio, LinkedIn, GitHub…", ru: "Ссылки — портфолио, LinkedIn, GitHub…" } satisfies Tr,
  linkNamePh: { uz: "Nomi", ru: "Название" } satisfies Tr,
  removeLink: { uz: "Havolani olib tashlash", ru: "Убрать ссылку" } satisfies Tr,
  addLink: { uz: "Havola qo'shish", ru: "Добавить ссылку" } satisfies Tr,
  /* Havola nomi uchun tayyor variantlar (datalist) — brend nomlari o'zgarmaydi */
  presetPortfolio: { uz: "Portfolio", ru: "Портфолио" } satisfies Tr,
  presetTelegram: { uz: "Telegram kanal", ru: "Telegram-канал" } satisfies Tr,
  publicTitle: { uz: "Katalogda ko'rinsin", ru: "Показывать в каталоге" } satisfies Tr,
  publicDesc: {
    uz: "Ish beruvchilar katalogda topib, chat orqali yozadi. Kontakt hech qayerda ochiq ko'rsatilmaydi.",
    ru: "Работодатели найдут вас в каталоге и напишут в чат. Контакты нигде не показываются открыто.",
  } satisfies Tr,
  saving: { uz: "Saqlanmoqda…", ru: "Сохранение…" } satisfies Tr,
  save: { uz: "Saqlash", ru: "Сохранить" } satisfies Tr,
  create: { uz: "Rezyumeni yaratish", ru: "Создать резюме" } satisfies Tr,
  bumpTitle: { uz: "Katalogda yuqoriga ko'tarish (24 soatda 1 marta)", ru: "Поднять в каталоге (1 раз в 24 часа)" } satisfies Tr,
  bump: { uz: "Yuqoriga", ru: "Поднять" } satisfies Tr,
  confirmDeleteAria: { uz: "O'chirishni tasdiqlang", ru: "Подтвердите удаление" } satisfies Tr,
  deleteWarn: { uz: "Rezyume o'chadi. Aniqmi?", ru: "Резюме будет удалено. Точно?" } satisfies Tr,
  yes: { uz: "Ha", ru: "Да" } satisfies Tr,
  no: { uz: "Yo'q", ru: "Нет" } satisfies Tr,
  delete: { uz: "O'chirish", ru: "Удалить" } satisfies Tr,
};

/* --------- Nomzodlar ro'yxati (ApplicantsList) --------- */
export const VAK_APPLICANTS = {
  failed: { uz: "Bajarilmadi", ru: "Не выполнено" } satisfies Tr,
  noteNotSaved: { uz: "Eslatma saqlanmadi", ru: "Заметка не сохранена" } satisfies Tr,
  closed: { uz: "Vakansiya yopildi", ru: "Вакансия закрыта" } satisfies Tr,
  closeFailed: { uz: "Yopib bo'lmadi", ru: "Не удалось закрыть" } satisfies Tr,
  copyFailed: { uz: "Nusxalab bo'lmadi", ru: "Не удалось скопировать" } satisfies Tr,
  empty: { uz: "Hali ariza yo'q. Vakansiya havolasini jamoalarda va Telegramda ulashing.", ru: "Откликов пока нет. Поделитесь ссылкой на вакансию в сообществах и Telegram." } satisfies Tr,
  copied: { uz: "Nusxalandi", ru: "Скопировано" } satisfies Tr,
  copyLink: { uz: "Havolani nusxalash", ru: "Скопировать ссылку" } satisfies Tr,
  tabsAria: { uz: "Arizalar holati", ru: "Статус откликов" } satisfies Tr,
  /* Holat bo'limlari (qisqa) */
  tabAll: { uz: "Barchasi", ru: "Все" } satisfies Tr,
  tabNew: { uz: "Yangi", ru: "Новые" } satisfies Tr,
  tabViewed: { uz: "Ko'rildi", ru: "Просмотрены" } satisfies Tr,
  tabShortlisted: { uz: "Tanlovda", ru: "Шорт-лист" } satisfies Tr,
  tabHired: { uz: "Qabul", ru: "Приняты" } satisfies Tr,
  tabRejected: { uz: "Rad", ru: "Отказ" } satisfies Tr,
  /* Amallar */
  actShortlist: { uz: "Tanlovga", ru: "В шорт-лист" } satisfies Tr,
  actHire: { uz: "Ishga olindi", ru: "Принят на работу" } satisfies Tr,
  actReject: { uz: "Rad etish", ru: "Отклонить" } satisfies Tr,
  askClose: { uz: "Nomzod tanlandi — vakansiyani yopasizmi?", ru: "Кандидат выбран — закрыть вакансию?" } satisfies Tr,
  yesClose: { uz: "Ha, yopish", ru: "Да, закрыть" } satisfies Tr,
  keepOpen: { uz: "Hozircha ochiq qolsin", ru: "Пока оставить открытой" } satisfies Tr,
  emptyTab: { uz: "Bu bo'limda ariza yo'q.", ru: "В этом разделе откликов нет." } satisfies Tr,
  noResume: { uz: "Rezyumesiz — faqat xat", ru: "Без резюме — только письмо" } satisfies Tr,
  chat: { uz: "Chatda yozish", ru: "Написать в чат" } satisfies Tr,
  resume: { uz: "Rezyume", ru: "Резюме" } satisfies Tr,
  profile: { uz: "Profil", ru: "Профиль" } satisfies Tr,
  skillsAria: { uz: "Ko'nikmalar", ru: "Навыки" } satisfies Tr,
  note: { uz: "Eslatma", ru: "Заметка" } satisfies Tr,
  addNote: { uz: "+ Eslatma", ru: "+ Заметка" } satisfies Tr,
  privateNote: { uz: "Shaxsiy eslatma", ru: "Личная заметка" } satisfies Tr,
  notePh: { uz: "Faqat sizga ko'rinadi: suhbat vaqti, taassurot…", ru: "Видно только вам: время собеседования, впечатление…" } satisfies Tr,
};
