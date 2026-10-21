# Dizayn v5 «Jonli» — tamoyillar va naqshlar

Maqsad: foydalanuvchi sayt ochgach qolsin, qaytib kelsin — **halol usullar bilan** (aldamchi «dark pattern»larsiz: soxta shoshilinch,
aybdor qilish, yashirin chiqish yo'q). Dizayn kontentni (ijodkorlar videosi/rasmi) ko'rsatadi, qobiq esa sokin turadi.

## 1. Tamoyillar
1. **Kontent — qahramon.** Qobiq neytral (iliq oq / chuqur qora), rangni ijodkorlar ishi beradi. Qorong'u rejim video uchun birlamchi.
2. **Bitta urg'u rangi.** Coral (#ff5a36) = «sizga yangi narsa bor / bosing»: asosiy tugma, o'qilmagan belgi, hikoya halqasi, faol tab chizig'i. Boshqa joyda ishlatilmaydi (Fon Restorff).
3. **Bosh barmoq zonasi (Fitts).** Telefonda asosiy amallar pastda: tab-bar, yaratish, yozish maydoni. Tugma ≥ 44px.
4. **Kam tanlov (Hick).** Telefon pastki tab 5 ta; qolgani «Menyu»da. Desktopda yon panel 8 ta bo'lim, qolgani «Yana».
5. **Darhol javob.** Har bosish 100 ms ichida ko'rinadigan javob beradi (press, optimistik yangilanish, skelet). Kutish hech qachon bo'sh ekran emas.
6. **Ritm.** 4/8 oraliq shkalasi; tip shkalasi 12/13/15/17/20/24/32; satr balandligi 1.5 (matn) / 1.15 (sarlavha).

## 2. Odat sikli (Nir Eyal: trigger → amal → o'zgaruvchan mukofot → investitsiya)
| Bosqich | Qanday ko'rinadi |
|---|---|
| Trigger | Qo'ng'iroqcha/Xabarlar belgisi (coral nuqta/son), Telegram bot, lentada «Yangi postlar» pill |
| Amal | Bir bosish: yoqtirish (qo'sh bosish), obuna, saqlash; composer doim ko'rinadi; tezkor reaksiyalar |
| O'zgaruvchan mukofot | Aralash lenta: post, video, tavsiya etilgan ijodkor, vakansiya; hikoya halqalari; kim ko'rdi/yoqtirdi |
| Investitsiya | Profil to'ldirilganlik meteri, portfolio, obunachilar, saqlanganlar, faol kunlar seriyasi |

Qo'shimcha psixologiya: **maqsad gradienti** (profil 60% → 100% — progress halqasi), **Zeigarnik** (tugallanmagan vazifalar tepada),
**ijtimoiy isbot** (sonlar, «onlayn», tasdiqlangan/Top badge), **peak-end** (tugatishda kichik bayram animatsiyasi), **estetik-foydalanish effekti**
(chiroyli = ishonchli), **o'zaro munosabat** (obuna → qaytarma obuna taklifi).

## 3. Raqobatchilardan o'rganilgan
- **Instagram**: gradient hikoya halqasi (ko'rilmagan = rangli, ko'rilgan = kulrang), qo'sh bosish yurak, «Siz uchun» tavsiyalari.
- **TikTok/Reels**: to'liq ekran vertikal video, o'ng tomonda amal ustuni, avto-ijro, ovoz belgisi.
- **Telegram**: sezgir chat ro'yxati, o'qilmagan sonli nishon, qadalgan suhbatlar, ✓✓ belgisi, tezlik hissi.
- **LinkedIn**: profil to'ldirilganlik meteri, «profilingizni kim ko'rdi».
- **Behance/Dribbble**: katta rasm to'ri, hover'da ma'lumot qatlami, «Ishga olish» CTA, mavjudlik nishoni.
- **Upwork/Fiverr**: ishonch signallari — reyting, tasdiqlangan, «Top Rated», javob tezligi, «dan» narx.
- **Duolingo**: seriya, progress, bayram — mukofot hissi (biz: faqat foydali amal uchun, jazolamasdan).

## 4. Vizual til
- **Shrift**: Manrope (UI va sarlavha; sarlavha 700/800, qattiq tracking −0.02em). Unbounded FAQAT logotip uchun (`font-brand`).
- **Radius**: 12 (input/plitka) · 16 (karta) · 24 (katta blok) · to'liq (tugma/chip/avatar).
- **Chuqurlik**: yorug'da yumshoq diffuz soya + hairline; qorong'uda yorug'lik bilan qatlam (bg → surface → surface-2 → surface-3).
- **Fon**: juda xira «aurora» (coral + binafsha, 4–8%) — iliqlik beradi, o'qishga halaqit bermaydi.
- **Harakat**: pružina (--ease-spring) mikro-harakatlar; reduced-motion hurmat qilinadi.

## 5. Komponent sinflari (globals.css)
`.card` `.card-hover` `.card-elevated` `.card-floating` · `.btn-accent` (gradient CTA) `.btn-ink` · `.field` · `.tabs/.tab` (chiziqli tab) ·
`.segment` (kapsula tab) · `.chip` (filtr) · `.story-ring` `.story-ring-seen` · `.glass` (yopishqoq panel) · `.dot-new` (o'qilmagan nuqta) ·
`.meter` (progress) · `.skeleton`.

## 6. Tekshiruv ro'yxati (har ekran)
390 va 1440 px · yorug' va qorong'u · kontrast AA · gorizontal scroll yo'q · konsol xatosiz · bo'sh/yuklanish/xato holatlari ·
klaviatura fokusi · reduced-motion.
