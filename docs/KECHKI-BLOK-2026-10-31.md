# Kechki blok — 2026-10-31 (kontakt sotuvi, bot, admin boti, rus tili)

Maqsad: platforma mutaxassislarni «sotadi» — kontakt faqat to'lovdan so'ng; Telegram boti va Mini App to'liq ishchi
holatga keltiriladi; admin uchun bot orqali statistika va navbat boshqaruvi; rus tilida bot va Mini App.
Hammasi `claude/quirky-volta-tzlqwh` (prod) ga ketdi, CI har commit'da yashil (build + smoke + xavfsizlik + bot testlari).

## 1. Kontakt sotuvi (`lib/contacts/unlock.ts`)
- Kontakt (telefon/Telegram/Instagram/email) hech kimga bepul ko'rinmaydi; mijoz (yoki boshqa mutaxassis) platformaga to'laydi.
- Narx: daraja bo'yicha umumiy (`platform_settings contactPrice{Junior,Middle,Senior,Expert}` — standart 30/50/80/120 ming)
  yoki mutaxassisga maxsus (`specialists.contactPrice`); `contactMode = paid | hidden` («faqat portfolio»).
- Hisob mavjud `subscription_invoices` tizimida (`meta.kind="contact"`): Payme / Click / karta o'tkazmasi (admin tasdiqlaydi),
  narx 0 → darhol ochiladi. `contact_unlocks` (mijoz+mutaxassis noyob, paid|refunded). Qaytarish → kontakt yopiladi.
- UI: profil (`ContactUnlockCard` → Sheet: narx + usul, «Telegramda to'lash»), ochilgach `ContactPanel`; kabinet `/kabinet/kontaktlar`
  (mijoz: ochgan kontaktlari; mutaxassis: rejim + kim olgani); admin `/admin/kontaktlar` (rejim, maxsus narx, o'tkazmalar,
  umumiy narxlar); katalog kartasida narx belgisi. Eski buyurtma/eskrou tizimi o'chirilmagan.
- Bot: `/start b_x_<id>` → narx + usul tugmalari → Payme/Click havolasi yoki karta rekviziti + chek rasmi / «To'ladim»;
  `/kontaktlarim`; qidiruv va inline natijalarida kontakt narxi; admin `/narx`, `/user` → «Sotilsin / Faqat portfolio / Maxsus narx».

## 2. Telegram bot — foydalanuvchi
- Hisobsiz chatga avtomatik «mijoz» hisobi OCHILMAYDI: `/start` → «Kasb Egalari'da akkauntingiz bormi?» → «Yo'q» — botda
  savol-javob (rol → ism → yo'nalish → kasb → tajriba → hudud → telefon → tasdiq), «Ha» — ulash (Mini App'da Google/email).
- Mini App: xuddi shu savol; ro'yxat savollari ilovaning o'zida ketma-ket (`TgRegister`); «Akkauntni ulash» → Google yoki email bilan
  saytga kirish → chat ulanadi (`?link=1`).
- Bot orqali post va story: rasm/video → «Post qilish / Story qilish / Izohni o'zgartirish / Bekor» (20 MB, R2/Blob/disk).
- Inline rejim: `@bot so'z` — istalgan chatda ijodkor kartasi.
- Telegram bilan kirish, ulash kodi, buyurtmani botda qabul/rad etish, bildirishnoma sozlamalari — avvaldan; endi hammasi tilga bog'liq.

## 3. Rus tili (bot + Mini App), `lib/telegram-bot/lang.ts`
- `language_code` ruscha bo'lsa: /start savoli, ro'yxat savol-javobi, yordam, «hisob kerak» savoli, doimiy menyu (`MENU_RU`),
  kontent buyruqlari (/profil /buyurtmalarim /xabarlar /vakansiyalar /kurslar /efirlar /top /sozlamalar /kurslarim /kontaktlarim),
  qidiruv, post/story oqimi, inline natijalar, to'lov oqimlari (kontakt, kurs, chek) — ruscha.
- Qidiruv ruscha kasb/hudud so'zlarini tushunadi («монтажёр Ташкент»).
- Mini App: darvoza va ro'yxat ustasi ruscha (`LocaleProvider` bilan), `/api/tg/auth` saytni `til=ru` qiladi (foydalanuvchi tanlovi ustun).

## 4. Admin boti (`lib/telegram-bot/admin.ts`) — faqat admin hisobiga ulangan chat
- `/admin` menyu; `/stat` bugun/7/30 kun + oldingi davr bilan taqqoslash (▲/▼ %) + kunlik trend mini-grafigi
  (foydalanuvchi · buyurtma · post · tushum); kunlik hisobot har tong (dushanba — haftalik ham), admin paneldan «Kunlik hisobot» tugmasi.
- `/navbat` — tasdiq kutayotgan mutaxassislar (bir bosishda tasdiqlash), o'tkazmalar, shikoyatlar, nizolar, payoutlar, mentor arizalari.
- `/tolovlar` — qo'lda o'tkazmalar (tasdiqlash/rad etish, chek havolasi).
- `/shikoyatlar` — har shikoyat alohida: yopish, post/izoh/sharhni o'chirib yopish, muallifni bloklash, ko'rish.
- `/mentorlar` — mentor arizalari: tasdiqlash / rad etish. `/nizolar` — ochiq nizolar (qaror panelda). `/payoutlar` — «To'landi / Rad etish».
- `/user <ism|email>` — bloklash/blokdan chiqarish, kontakt rejimi, maxsus narx; `/narx` — umumiy kontakt narxlari; `/elon` — ommaviy e'lon.
- Jonli ogohlantirishlar: yangi mutaxassis (tasdiqlash tugmasi), yangi shikoyat (tugmalar bilan), mentor arizasi (tasdiqlash/rad),
  kontakt sotuvi, qo'lda o'tkazma (chek).
- Admin panel → Telegram bot kartasi: ulangan foydalanuvchilar/admin chatlari, inline holati, «Sinov xabari», «Kunlik hisobot»,
  «Bot profilini sozlash» (buyruqlar menyusi), «Webhookni yangilash».

## 5. Testlar
- `scripts/fake-telegram-api.mjs` — soxta Bot API (jurnal), `scripts/bot.mjs` — 8 ta regressiya testi (webhook siri, /start uz/ru,
  ro'yxat, admin ulash → /stat/navbat/shikoyatlar, inline, post taklifi). CI'da soxta token bilan ishlaydi. Lokal: test hisobini
  o'chiradi, admin chatini qaytaradi.
- Xavfsizlik testlariga qo'shildi: kontakt API (401/403/404), rejim (403/404), tg/auth (401/503), admin Telegram PATCH 403.

## Deploydan keyin (qo'lda, bir marta)
1. Admin panel → Telegram bot → «Bot profilini sozlash» (yangi buyruqlar menyusi) va «Webhookni yangilash» (inline_query).
2. BotFather → `/setinline` (inline rejim), Bot Settings → Configure Mini App → Enable (`https://<sayt>/tg`).
3. Admin → Foydalanuvchilar: avvalgi sinovda avtomatik ochilgan «Editor» hisobini o'chirish.
4. Google OAuth Telegram webview'ida ba'zan `disallowed_useragent` beradi — email/parol yo'li doim bor.
