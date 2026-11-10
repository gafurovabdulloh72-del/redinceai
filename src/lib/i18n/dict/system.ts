/**
 * Tizim xabarlari lug'ati (2026-11-10) — tashrifchi ko'radigan «tizim» matnlari:
 * sayt e'loni chizig'i, texnik ishlar (faqat o'qish) rejimi, xatolik ekranlari (bo'lim va ildiz darajasi).
 * Admin panel matnlari bu yerda EMAS (admin faqat o'zbekcha).
 */
import type { Tr } from "../index";

/** Sayt tepasidagi e'lon chizig'i */
export const BANNER = {
  label: { uz: "Sayt e'loni", ru: "Объявление сайта" } satisfies Tr,
  dismiss: { uz: "E'lonni yopish", ru: "Закрыть объявление" } satisfies Tr,
  more: { uz: "Batafsil", ru: "Подробнее" } satisfies Tr,
};

/** Texnik ishlar («faqat o'qish») rejimi */
export const MAINTENANCE = {
  title: { uz: "Texnik ishlar", ru: "Технические работы" } satisfies Tr,
  /** Sayt tepasidagi chiziq — admin o'z matnini yozmagan bo'lsa */
  notice: {
    uz: "Saytda texnik ishlar ketmoqda — hozircha faqat ko'rish mumkin. Yozish, to'lov va boshqa amallar tez orada yana ishlaydi.",
    ru: "На сайте идут технические работы — пока доступен только просмотр. Публикации, оплата и другие действия скоро снова заработают.",
  } satisfies Tr,
  /** API javobi (503) — amal bajarilmaganda foydalanuvchi ko'radigan qisqa xabar */
  api: {
    uz: "Texnik ishlar ketmoqda — hozircha o'zgartirish kiritib bo'lmaydi. Birozdan so'ng qayta urinib ko'ring",
    ru: "Идут технические работы — изменения пока недоступны. Попробуйте чуть позже",
  } satisfies Tr,
};

/** Bo'lim darajasidagi xatolik kartasi (SectionError) */
export const SECTION_ERROR = {
  text: {
    uz: "Bu bo'limni yuklashda xatolik bo'ldi. Qayta urinib ko'ring — saytning qolgan qismi ishlayapti.",
    ru: "Не удалось загрузить этот раздел. Попробуйте ещё раз — остальная часть сайта работает.",
  } satisfies Tr,
  code: { uz: "Kod", ru: "Код" } satisfies Tr,
  retry: { uz: "Qayta urinish", ru: "Повторить" } satisfies Tr,
};

/** Ildiz darajasidagi xatolik (global-error) — layout ham ishlamay qolgan holat */
export const GLOBAL_ERROR = {
  eyebrow: { uz: "Xatolik", ru: "Ошибка" } satisfies Tr,
  title: { uz: "Xatolik yuz berdi", ru: "Произошла ошибка" } satisfies Tr,
  text: {
    uz: "Ilovani yuklab bo'lmadi. Qayta urinib ko'ring — bo'lmasa, biroz kutib sahifani yangilang.",
    ru: "Не удалось загрузить приложение. Попробуйте ещё раз — если не поможет, подождите немного и обновите страницу.",
  } satisfies Tr,
  code: { uz: "Kod", ru: "Код" } satisfies Tr,
  retry: { uz: "Qayta urinish", ru: "Повторить" } satisfies Tr,
  home: { uz: "Bosh sahifaga", ru: "На главную" } satisfies Tr,
};
