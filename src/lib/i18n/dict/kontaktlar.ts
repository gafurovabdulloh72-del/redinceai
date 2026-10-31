import type { Tr } from "@/lib/i18n";

/** Kabinet → Kontaktlar (kontakt sotuvi, 2026-10-31): mijoz — ochgan kontaktlari; mutaxassis — rejim + kim olgani */
export const KONTAKTLAR = {
  title: { uz: "Kontaktlar", ru: "Контакты" } satisfies Tr,
  modeTitle: { uz: "Kontaktim qanday ochiladi", ru: "Как открывается мой контакт" } satisfies Tr,
  modeHint: { uz: "Platforma qoidasi: aloqa ma'lumotlaringiz hech kimga bepul ko'rinmaydi. Narxni administrator belgilaydi (tajriba darajasi bo'yicha yoki sizga maxsus).", ru: "Правило платформы: ваши контакты никому не показываются бесплатно. Цену назначает администратор (по уровню опыта или индивидуально)." } satisfies Tr,
  paidTitle: { uz: "Kontaktim sotilsin", ru: "Продавать мой контакт" } satisfies Tr,
  paidDesc: { uz: (price: string) => `Mijoz ishlaringizni ko'radi, telefon/Telegram/Instagram/email'ni platformaga to'lab ochadi (hozirgi narx: ${price}). Sotib olganlar shu sahifada ko'rinadi.`, ru: (price: string) => `Клиент видит ваши работы и открывает телефон/Telegram/Instagram/email, заплатив платформе (текущая цена: ${price}). Купившие показываются на этой странице.` },
  hiddenTitle: { uz: "Faqat portfolio", ru: "Только портфолио" } satisfies Tr,
  hiddenDesc: { uz: "Kontakt umuman ko'rsatilmaydi va sotilmaydi — mijoz faqat ishlaringizni ko'radi va sayt chati orqali yozadi.", ru: "Контакт не показывается и не продаётся — клиент видит только работы и пишет через чат сайта." } satisfies Tr,
  modeAria: { uz: "Kontakt rejimi", ru: "Режим контакта" } satisfies Tr,
  savedPaid: { uz: "Kontaktingiz endi to'lov bilan ochiladi", ru: "Ваш контакт теперь открывается за плату" } satisfies Tr,
  savedHidden: { uz: "Profil «faqat portfolio» rejimida — kontakt sotilmaydi", ru: "Профиль в режиме «только портфолио» — контакт не продаётся" } satisfies Tr,
  buyersTitle: { uz: "Kontaktimni olganlar", ru: "Купили мой контакт" } satisfies Tr,
  buyersEmptyTitle: { uz: "Hali hech kim olmagan", ru: "Пока никто не купил" } satisfies Tr,
  buyersEmptyText: { uz: "Mijoz kontaktingizni ochganda shu yerda ko'rinadi va sizga bildirishnoma keladi.", ru: "Когда клиент откроет ваш контакт, он появится здесь, а вам придёт уведомление." } satisfies Tr,
  write: { uz: "Yozish", ru: "Написать" } satisfies Tr,
  mineTitle: { uz: "Ochgan kontaktlarim", ru: "Открытые мной контакты" } satisfies Tr,
  mineEmptyTitle: { uz: "Hali kontakt ochmagansiz", ru: "Вы ещё не открывали контакты" } satisfies Tr,
  mineEmptyText: { uz: "Mutaxassis profilida «Kontaktni ochish» tugmasini bosing — to'lovdan so'ng telefon, Telegram va boshqa aloqa vositalari shu yerda saqlanadi.", ru: "Нажмите «Открыть контакт» в профиле специалиста — после оплаты телефон, Telegram и другие контакты сохранятся здесь." } satisfies Tr,
  specialists: { uz: "Mutaxassislar", ru: "Специалисты" } satisfies Tr,
  noContacts: { uz: "Mutaxassis hali aloqa ma'lumotlarini to'ldirmagan — sayt chati orqali yozing.", ru: "Специалист ещё не заполнил контакты — напишите через чат сайта." } satisfies Tr,
  phone: { uz: "Telefon", ru: "Телефон" } satisfies Tr,
  err: { uz: "Xatolik", ru: "Ошибка" } satisfies Tr,
};
