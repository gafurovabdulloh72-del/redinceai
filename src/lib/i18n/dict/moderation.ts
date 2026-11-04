/**
 * Moderatsiya, tasdiqlangan profil va yopiq profil lug'ati (2026-11-04):
 * avto-yashirilgan post belgisi, «Tasdiqlangan profil» kartasi (kabinet), obuna so'rovlari, yopiq profil holati.
 */
import type { Tr } from "../index";

/** Shikoyatlar sababli yashirilgan post/izoh belgisi (faqat muallif va admin ko'radi) */
export const AVTO_YASHIRIN = {
  badge: { uz: "Shikoyatlar sababli vaqtincha yashirildi, admin ko'rib chiqadi", ru: "Временно скрыто из-за жалоб, администратор проверит" } satisfies Tr,
  short: { uz: "Vaqtincha yashirilgan", ru: "Временно скрыто" } satisfies Tr,
};

/** Kabinet → Profil → «Tasdiqlangan profil» kartasi */
export const TASDIQ = {
  title: { uz: "Tasdiqlangan profil", ru: "Подтверждённый профиль" } satisfies Tr,
  verified: { uz: "Profilingiz tasdiqlangan — ismingiz yonida ko'k belgi ko'rinadi.", ru: "Ваш профиль подтверждён — рядом с именем показывается синяя галочка." } satisfies Tr,
  lead: { uz: "Ko'k belgi mijozlarga profil haqiqiy va faol ekanini ko'rsatadi. Mezonlar bajarilgach so'rov yuboring — admin 1–3 kun ichida ko'rib chiqadi.", ru: "Синяя галочка показывает клиентам, что профиль настоящий и активный. Выполните критерии и отправьте запрос — администратор рассмотрит за 1–3 дня." } satisfies Tr,
  critProfile: { uz: "To'liq profil (rasm, tavsif, kasb, hudud)", ru: "Заполненный профиль (фото, описание, профессия, регион)" } satisfies Tr,
  critPortfolio: { uz: (n: number) => `Kamida 3 ta portfolio ishi (hozir ${n})`, ru: (n: number) => `Не менее 3 работ в портфолио (сейчас ${n})` },
  critActivity: { uz: "Kamida 1 ta tugallangan buyurtma yoki 1 ta post", ru: "Хотя бы 1 завершённый заказ или 1 пост" } satisfies Tr,
  critAge: { uz: (d: number) => `Ro'yxatdan o'tganiga kamida 7 kun (hozir ${d})`, ru: (d: number) => `Не менее 7 дней с регистрации (сейчас ${d})` },
  request: { uz: "Tasdiqlash so'rovi", ru: "Запросить подтверждение" } satisfies Tr,
  pending: { uz: "So'rov yuborildi — admin ko'rib chiqmoqda", ru: "Запрос отправлен — администратор рассматривает" } satisfies Tr,
  pendingAt: { uz: (d: string) => `Yuborilgan: ${d}`, ru: (d: string) => `Отправлен: ${d}` },
  rejected: { uz: "Oldingi so'rov rad etilgan", ru: "Предыдущий запрос отклонён" } satisfies Tr,
  reason: { uz: "Sabab", ru: "Причина" } satisfies Tr,
  notMet: { uz: "Avval barcha mezonlarni bajaring", ru: "Сначала выполните все критерии" } satisfies Tr,
  sent: { uz: "So'rov yuborildi", ru: "Запрос отправлен" } satisfies Tr,
  error: { uz: "Yuborib bo'lmadi", ru: "Не удалось отправить" } satisfies Tr,
};

/** Obuna so'rovlari (yopiq profil) */
export const SOROVLAR = {
  tab: { uz: "So'rovlar", ru: "Запросы" } satisfies Tr,
  empty: { uz: "Obuna so'rovlari yo'q", ru: "Запросов на подписку нет" } satisfies Tr,
  approve: { uz: "Tasdiqlash", ru: "Принять" } satisfies Tr,
  reject: { uz: "Rad etish", ru: "Отклонить" } satisfies Tr,
  approved: { uz: "Tasdiqlandi", ru: "Принято" } satisfies Tr,
  rejectedT: { uz: "Rad etildi", ru: "Отклонено" } satisfies Tr,
  requested: { uz: "So'rov yuborildi", ru: "Запрос отправлен" } satisfies Tr,
  cancel: { uz: "Bekor qilish", ru: "Отменить" } satisfies Tr,
  hint: { uz: "Yopiq profil — egasi tasdiqlagach postlari ko'rinadi", ru: "Закрытый профиль — посты станут видны после одобрения" } satisfies Tr,
};

/** Yopiq profil holati (ommaviy profil sahifasi) va sozlama */
export const YOPIQ_PROFIL = {
  title: { uz: "Yopiq profil", ru: "Закрытый профиль" } satisfies Tr,
  text: { uz: "Postlar, story va ishlarni ko'rish uchun obuna so'rovi yuboring — egasi tasdiqlagach ochiladi.", ru: "Отправьте запрос на подписку, чтобы видеть посты, сторис и работы — после одобрения они откроются." } satisfies Tr,
  settingTitle: { uz: "Yopiq profil", ru: "Закрытый профиль" } satisfies Tr,
  settingOn: { uz: "Postlar, story va portfolio faqat siz tasdiqlagan obunachilarga ko'rinadi; yangi obunalar so'rov bilan keladi", ru: "Посты, сторис и портфолио видны только одобренным подписчикам; новые подписки приходят как запросы" } satisfies Tr,
  settingOff: { uz: "Profil ochiq — postlar va ishlar hammaga ko'rinadi", ru: "Профиль открыт — посты и работы видны всем" } satisfies Tr,
};
