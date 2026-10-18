# Kasb Egalari — 500 talik reja: funksiyalar, UI, harakat, dizayn, keyingi qadamlar

> Bu hujjat "100 ta funksiya + 100 ta UI tuzatish + 100 ta animatsiya + 500 ta dizayn qo'shimchasi + 100 ta keyingi qadam"
> so'roviga javob. Har bir band holati bilan: **✅ bajarildi** (kodda bor, `claude/quirky-volta-tzlqwh` branchida), **🔶 qisman**, **⬜ reja**.
> Yangilangan: 2026-10-17. Oldingi ro'yxatlar: `docs/BACKLOG.md` (100 ta kamchilik, 2026-10-10), `docs/IJTIMOIY-TARMOQ.md` (hamjamiyat bosqichlari).

**Qisqa hisob (halol):**

| Ro'yxat | ✅ bajarildi | 🔶 qisman | ⬜ reja |
|---|---|---|---|
| 1. 100 ta funksiya / detal | 61 | 4 | 35 |
| 2. 100 ta UI tuzatish | 64 | 3 | 33 |
| 3. 100 ta animatsiya | 87 | 0 | 13 |
| 4. 500 ta dizayn qo'shimchasi | 196 | 21 | 283 |
| 5. 100 ta keyingi qadam | — | — | 100 (tavsiya ro'yxati) |

---

## 1. 100 ta qo'shimcha funksiya va detal

### Hamjamiyat (jamoalar, kanallar, efirlar)
1. ✅ Kanal turi (`kind=channel`): faqat egasi/adminlar yozadi, a'zolar o'qiydi, yoqtiradi, izoh qoldiradi
2. ✅ Rasmiy kanal: hamma avtomatik a'zo (register + backfill), ro'yxat tepasida qadalgan, chiqib bo'lmaydi
3. ✅ Sayt adminlari har yangi jamoa/kanalga avtomatik admin a'zo (moderatsiya)
4. ✅ Efir / yig'ilish e'loni (`eventAt`, `eventUrl`): kutilmoqda → hozir jonli → o'tkazildi holatlari
5. ✅ Efirni kalendarga qo'shish (.ics yuklab olish + Google Calendar havolasi)
6. ✅ "Yaqin efirlar" kartasi va rasmiy bannerda keyingi efir
7. ✅ Postni qadash / qadashdan olish (pinned-first lenta)
8. ✅ Postni tahrirlash ("tahrirlangan" belgisi)
9. ✅ Post va chatda havolalar bosiladigan, @username va #teg ajratiladi (RichText)
10. ✅ Taklif havolasi (`inviteCode`): yopiq jamoaga havola orqali darhol a'zolik, havolani yangilash (eskisi bekor)
11. ✅ Jamoa bildirishnomalarini o'chirish (mute) — a'zolik saqlanadi
12. ✅ Chatda "N kishi ko'rdi" (seen count)
13. ✅ A'zolar ro'yxatida onlayn nuqta (5 daqiqa ichida faol)
14. ✅ Jamoa kartasida o'qilmagan faollik nuqtasi (`hasUnread`)
15. ✅ Navbar "Jamoalar" havolasida o'qilmagan nuqta + menyuda son
16. ✅ Katalog tartibi: faol / yangi / ko'p a'zoli (`?sort=`)
17. ✅ Kanallar va guruhlar alohida bo'limlarda; tur filtri
18. ✅ A'zolar ro'yxatida ism bo'yicha qidiruv (8+ a'zoda)
19. ✅ Jamoa sozlamalarida taklif havolasi kartasi
20. ✅ Telegram orqali ulashish tugmasi (t.me/share/url) — jamoa va vakansiya sahifalarida
21. ✅ Sahifa havolasini nusxalash / tizim "share" (ShareButton)
22. ⬜ Post ichida so'rovnoma (poll) — variantlar, ovoz, natija foizi
23. ⬜ Reaksiyalar (❤️ 🔥 👏 😂) — like o'rniga 6 ta emoji
24. ⬜ Xabarga javob (reply) va iqtibos chatda
25. ⬜ Postni boshqa jamoaga / DM'ga yo'naltirish (forward)

### Vakansiyalar va rezyumelar
26. ✅ Vakansiya e'loni: 11 soha, format, bandlik, tajriba, maosh, hudud, ko'nikmalar — to'lovsiz
27. ✅ Rezyume (bitta/foydalanuvchi), ommaviy katalog kontaktsiz
28. ✅ Ariza: rezyume yoki xat, holatlar (yangi → ko'rildi → tanlovda / rad / ishga olindi), bekor qilish
29. ✅ Nomzod kontakti faqat ariza kelgan vakansiya egasiga
30. ✅ Vakansiyani saqlash (bookmark) va kabinetda "Saqlanganlar"
31. ✅ "Shunga o'xshash vakansiyalar" (kasb → format bo'yicha)
32. ✅ "Shu ish beruvchining boshqa vakansiyalari"
33. ✅ Yopish / qayta ochish / muddatni uzaytirish (30 kun)
34. ✅ Muddat tugashiga 3 kun qolganda egasiga eslatma (cron, bir marta; uzaytirilganda qayta)
35. ✅ 48 soatdan yangi e'lonlarga "Yangi" belgisi
36. ✅ Rezyume to'liqlik o'lchagichi (foiz + maslahat)
37. ✅ Ko'nikmalar kiritgichi (chip + Enter)
38. ✅ Kasb bo'yicha sonli chiplar katalogda
39. ✅ schema.org JobPosting JSON-LD (Google ish o'rinlari bloki)
40. ✅ Vakansiya ko'rishlar sanagichi (egasidan tashqari)
41. ✅ Yangi ariza / holat o'zgarishi bildirishnomalari (sayt + Telegram + email)
42. 🔶 Tashqi ariza havolasi (hh.uz, Google Form) — ko'rsatiladi, lekin bosishlar sanalmaydi
43. ⬜ Ish beruvchi kompaniya sahifasi (/kompaniya/[slug]) — logo, tavsif, barcha vakansiyalar
44. ⬜ Vakansiya bo'yicha saqlangan qidiruv (yangi mos e'lon → bildirishnoma)
45. ⬜ Nomzodga "ko'rildi" vaqtini ko'rsatish, ish beruvchiga javob berish SLA eslatmasi

### Qidiruv va SEO
46. ✅ Global qidiruv ⌘K / Ctrl+K: sahifalar, mutaxassislar, vakansiyalar, jamoalar, e'lonlar, yordam
47. ✅ Qidiruv tugmasi navbar va foydalanuvchi menyusida
48. ✅ Sitemap: /lenta, /jamoalar, /vakansiyalar, /rezyumelar + ochiq jamoalar, vakansiyalar, ommaviy rezyumelar
49. ✅ Yopiq jamoa / yopiq vakansiya / yashirin rezyume — noindex
50. ✅ Yordam markazida "Jamoalar va kanallar", "Vakansiyalar" bo'limlari (4 ta maqola)
51. ✅ OG rasm va sayt tavsiflari yangi ko'lamga moslandi (jamoalar, kanallar, efirlar, vakansiyalar)
52. ⬜ Qidiruvda yaqinda qidirilganlar va mashhur so'rovlar
53. ⬜ Qidiruv natijalarida klaviatura bilan yurish + "Enter" birinchi natija (hozir: havolalar)
54. ⬜ Vakansiya kataloglari uchun SEO landing (/vakansiyalar/frontend-toshkent)
55. ⬜ Jamoa va vakansiya uchun alohida OG rasm (dinamik)

### Bildirishnoma, Telegram, email
56. ✅ Yangi turlar: group_request, group_joined, post_comment, follow, channel_post, live_event, application_new, application_status, vacancy_expiring
57. ✅ Kanal posti va efir e'loni a'zolarga fan-out (mute'ni hurmat qiladi, 25 talik bo'laklar)
58. ✅ Sayt ichi toast HUD (muvaffaqiyat / xato / ma'lumot, 3 s, reduced-motion)
59. ✅ Qo'ng'iroq ikonkasi o'qilmagan bo'lsa tebranadi; sanagich pop
60. ⬜ Web Push (VAPID) — brauzer bildirishnomalari, kabinetda yoqish
61. ⬜ Bildirishnoma sozlamalari turlar bo'yicha (kanal posti / efir / ariza alohida)
62. ⬜ Telegram botda inline tugmalar: "Efirga qo'shilish", "Arizani ko'rish"
63. ⬜ Haftalik dayjest emaili (yangi vakansiyalar, efirlar, jamoa faolligi)
64. ⬜ Bildirishnomalarni guruhlash ("3 kishi postingizni yoqtirdi")
65. ⬜ "Barchasini o'qilgan deb belgilash" — jamoalar uchun ham

### Kabinet va profil
66. ✅ Ro'yxatdan o'tishda maqsad tanlovi (xizmat / buyurtma / ish / xodim) → mos sahifa
67. ✅ Kabinet: Vakansiyalarim (nomzodlar bilan), Arizalarim (+ saqlanganlar), Rezyume
68. ✅ PWA o'rnatish taklifi (kabinetda, bir marta, yopish eslab qolinadi)
69. ✅ Marshrut yuklanish chizig'i (NavigationProgress) — sahifalar orasida "jonli" his
70. ✅ Mutaxassisga obuna bo'lish (follow) va obunachilar soni
71. ⬜ Profilda "Mening jamoalarim" bo'limi (ommaviy)
72. ⬜ Faollik lentasi kabinetda (kim yoqtirdi, kim izoh qoldirdi, kim qo'shildi)
73. ⬜ Kabinet bosh sahifasida "Bugun" bloki: efir, muddati yaqin buyurtma, yangi ariza
74. ⬜ Profil ko'rishlar statistikasi (haftalik grafik)
75. ⬜ Ikki tilli profil tavsifi (uz/ru) — tarjima maydonlari
76. ⬜ Hisobni vaqtincha to'xtatish (pause) — ta'tildan farqli, profil yashirinadi
77. ⬜ Eksport: mening ma'lumotlarim (JSON) — maxfiylik talabi
78. ⬜ Kirish tarixi sahifasi (sessiyalar bor — joylashuv/qurilma ko'rinishi qo'shilsin)

### Buyurtma va to'lov
79. ✅ (oldingi bosqichlar) Escrow, Payme/Click, qo'lda o'tkazma, nizo, SLA, muddat eslatmalari
80. ⬜ Buyurtmada bosqichli to'lov (milestone) — 30/70
81. ⬜ Shablon javoblar mutaxassis uchun (tez javob)
82. ⬜ Buyurtma shartnomasi PDF (avtomatik, ikkala tomon ma'lumoti bilan)
83. ⬜ Chegirma kodlari (promo) obunaga
84. ⬜ Mijoz uchun "qayta buyurtma" bir bosishda
85. ⬜ Buyurtma vaqt jadvali (timeline) vizual
86. ⬜ Avtomatik hisob-faktura (invoice) yuridik shaxslar uchun

### Admin
87. ✅ Rasmiy kanalni belgilash (admin PATCH `isOfficial`) + backfill
88. ✅ Admin har qanday jamoada moderator (pin, o'chirish, chiqarish)
89. ✅ Cron hisobotida vakansiya eslatmalari soni (`vacanciesReminded`)
90. ⬜ Admin: jamoalar va vakansiyalar bo'limi (shikoyatlar, yashirish, egasini almashtirish)
91. ⬜ Admin: spam filtri (havola/so'z ro'yxati) post va chat uchun
92. ⬜ Admin: efirlar taqvimi (barcha kanallar)
93. ⬜ Admin: vakansiya moderatsiyasi (oldindan to'lov so'ragan e'lonlarni avtomatik bayroqlash)

### PWA va texnik
94. ✅ Skeleton yuklanish sahifalari (jamoalar, vakansiyalar, rezyumelar)
95. ✅ Hydration xavfsizligi: scroll-reveal CSS `animation-timeline: view()` — JS'siz
96. ✅ `role="alert"` xatolar bir CSS qoidasi bilan silkinadi (50+ forma)
97. 🔶 Chat 4 soniyalik polling — real-time (Ably) 2-bosqichda
98. 🔶 Offline sahifa PWA'da bor; keshlash strategiyasi minimal
99. 🔶 Rasm optimallashtirish: Blob'dan to'g'ridan-to'g'ri; o'lcham variantlari yo'q
100. ⬜ E2E testlar (Playwright) CI'da: ro'yxat → vakansiya → ariza → holat oqimi

---

## 2. 100 ta UI kamchilik tuzatish

### Tipografika va o'qilish
1. ✅ Barcha `text-[10px]` / `text-[10.5px]` → 11px (a11y minimal)
2. ✅ Sarlavhalarga `text-wrap: balance`, abzatslarga `text-wrap: pretty`
3. ✅ Displey shrift (Unbounded) faqat sarlavhalarda; tana matni 14–15px, qator balandligi 1.5–1.6
4. ✅ Raqamlar `tabular-nums` (sanagichlar, narxlar, vaqtlar)
5. ✅ Har sahifada aynan bitta `h1` (audit: 177 sahifa-ko'rinish)
6. ✅ Uzun nomlar `truncate` / `line-clamp` (karta sarlavhalari, navbar ism)
7. ✅ Navbar profil kapsulasi: ism faqat xl+, max-w, kapsula kengliklari — toshib ketish yo'q
8. ✅ Apostrof va tirnoqlar O'zbek tiliga mos («», ')
9. ⬜ Rus tilida uzun so'zlar mobil tab-barda (ru lug'atlarida qisqa variantlar)
10. ⬜ `font-display: swap` tekshiruvi — Unbounded yuklanguncha layout sakrashi

### Teginish maydonlari va fokus
11. ✅ Kontakt havolalari `min-h-7` → `min-h-9` (admin jadval, buyurtmalar)
12. ✅ VisibilityChip balandligi 24 → 28px
13. ✅ Admin/obunalar ism havolalariga `-my-1.5 py-1.5` (44px maydon)
14. ✅ Xarita sana maydoni `h-8` (tor edi)
15. ✅ Barcha tugmalarda fokus halqasi (`focus-visible:ring`) va `active:scale-[0.97]`
16. ✅ Mobil tab-bar elementlari 52px, yorliq 12px
17. ✅ Ikonka tugmalari 44×44 (ulashish, mute, taklif, Telegram)
18. ✅ Menyu bandlari `min-h-11`
19. ⬜ Swipe bilan yopiladigan pastki menyu (hozir faqat bosish)
20. ⬜ Klaviatura bilan rasm galereyasida chapga/o'ngga (qisman bor)

### Maketlar va responsiv
21. ✅ 390px'da gorizontal scroll yo'q (177 ko'rinishda tekshirildi)
22. ✅ Admin mutaxassislar jadvalida amallar guruhi `flex-wrap`
23. ✅ Mobil menyu pastki varaq (bottom sheet) sifatida, safe-area bilan
24. ✅ Vakansiya kartasi `h-full` + `mt-auto` — ustunlar tekis
25. ✅ Jamoa kartasi muqova 3:1, OfficialCover brend fon
26. ✅ `min-w-0` ro'yxat elementlarida (kesilgan matn)
27. ✅ Lenta/post rasmlari aspect saqlanadi, 4 tagacha grid
28. ✅ Kabinet yon navigatsiya scroll + faol holat
29. 🔶 Admin jadvallar container query (`@[66rem]`) — barcha jadvallarda emas
30. ⬜ Katta ekranlarda (≥1920) kontent kengligi cheklovi va sidebar

### Formalar
31. ✅ To'ldirilgan (filled) maydon uslubi, fokusda chegara + halqa
32. ✅ Xato matni maydon ostida, `aria-describedby` bilan bog'langan
33. ✅ Xato paydo bo'lganda yengil silkinish
34. ✅ Yuborish tugmasida spinner + disabled
35. ✅ Maydon uzunligi sanagichlari (tavsif, xat)
36. ✅ Kasb/format/bandlik tanlovlari segment ko'rinishida
37. ✅ iOS uslubidagi switch (51×31, yashil yoqilgan)
38. ✅ Enter bilan chip qo'shish (ko'nikmalar), Backspace bilan o'chirish
39. ⬜ Avtosaqlash qoralama (vakansiya/post) localStorage'da
40. ⬜ Telefon raqami maskasi (+998 __ ___ __ __)

### Ranglar va kontrast
41. ✅ Coral urg'u matn uchun to'qroq `--accent-serif` (3:1+)
42. ✅ Dark rejimda kartalar/yuzalar qatlamlari (surface / surface-2 / surface-3)
43. ✅ Tasdiqlangan email belgisi yashil, xato qizil, ma'lumot ko'k — tonlar tizimli
44. ✅ 0.5px retina chiziqlar (hairline) kartalar va ro'yxatlar orasida
45. ✅ Soyalar yassiroq (Apple uslubi), hover'da 2-daraja
46. ⬜ Kontrast auditi avtomatik (axe) CI'da
47. ⬜ Yuqori kontrast rejimi (`prefers-contrast: more`)

### Bo'sh holatlar va xatolar
48. ✅ Jamoalar / vakansiyalar / rezyumelar bo'sh holatlari — sabab + harakat tugmasi
49. ✅ "Topilmadi" qidiruvda, "Bunday a'zo topilmadi" a'zolar filtrida
50. ✅ Yopiq/muddati o'tgan vakansiya banneri + "o'xshashlarni ko'ring" havolasi
51. ✅ 404 va xato sahifalari brendga mos
52. ⬜ Tarmoq uzilganda global banner ("Internet yo'q")
53. ⬜ Yuklanmagan rasm uchun placeholder barcha joyda (qisman: SafeImage)

### Navigatsiya
54. ✅ Navbar bandlari darajalar bilan (lg/2xl) — kapsulaga sig'adi
55. ✅ Faol band ostida urg'u chizig'i
56. ✅ Breadcrumb (yo'l) jamoa, vakansiya, sozlash sahifalarida
57. ✅ Jamoalar / vakansiyalar footer va menyuda
58. ✅ Sahifalar orasida progress chizig'i
59. ⬜ Orqaga qaytish tugmasi mobil sahifa sarlavhalarida
60. ⬜ Tab holatini URL'da saqlash barcha tabli sahifalarda (jamoa: bor)

### Kartalar va ro'yxatlar
61. ✅ Butun karta havola (`card-link`, `after:absolute`) — ichki tugmalar alohida
62. ✅ Hover'da ko'tarilish + soya, bosilganda kichrayish
63. ✅ Ro'yxatlar ketma-ket kiradi (stagger)
64. ✅ Chiplar (kasb, format, bandlik) bir xil balandlik va radius
65. ✅ Jamoa kartasida tur/rasmiy chiplar, a'zolar soni, o'qilmagan nuqta
66. ✅ Vakansiya kartasida "Yangi", maosh urg'u, arizalar soni, vaqt
67. ⬜ Ro'yxat/jadval ko'rinishi almashtirgich mutaxassislar katalogida (qisman)
68. ⬜ Cheksiz scroll yoki "Yana yuklash" (hozir: sahifalash)

### Modal, varaq, toast
69. ✅ ⌘K palitra: fon xiralashadi, Esc yopadi, fokus ichida
70. ✅ Toast pastda markazda, bir vaqtda 3 tagacha, `aria-live`
71. ✅ Mobil menyu: pastdan chiqadi, tashqarini bosganda yopiladi, Esc
72. ✅ Yopish tugmalari 44px, `aria-label`
73. ⬜ Umumiy `Sheet` komponenti (drag handle, snap) — hozir har joyda alohida
74. ⬜ Modal ochilganda fon scroll qulfi barcha modallarda

### Ikonkalar va rasmlar
75. ✅ lucide ikonkalar 14–18px, matn bilan tekislangan
76. ✅ Avatar fallback: ism bosh harflari + rang
77. ✅ Muqova fallback: kategoriya naqshi / brend gradient
78. ✅ Rasm hover zoom jamoa kartalarida
79. ⬜ Ikonka to'plamini bir xil chiziq qalinligida auditlash
80. ⬜ Avatar kesish (crop) jamoa muqovasi uchun ham

### A11y
81. ✅ `aria-current="page"` navbar va tablarda
82. ✅ `role="switch"` + `aria-checked` kalitlarda
83. ✅ `aria-busy` yuklanish holatlarida
84. ✅ Skip-link ("Asosiy kontentga o'tish")
85. ✅ Harakatni kamaytirish (`prefers-reduced-motion`) barcha animatsiyalarda
86. ✅ Dekorativ ikonkalar `aria-hidden`
87. ⬜ Ekran o'quvchi bilan to'liq sinov (NVDA/VoiceOver)
88. ⬜ Jonli hududlar (`aria-live`) chat va lenta yangilanishida

### Mayda-chuyda (polish)
89. ✅ Sana/vaqt formatlari bir xil (`formatDate`, `formatDateTime`, `timeAgo`)
90. ✅ "so'm / oy" qo'shimchasi maoshda
91. ✅ Nusxalangandan keyin "Nusxalandi" 2 s
92. ✅ Hover pill navbar havolalarida
93. ✅ Jamoalar sahifasida tartib segmenti o'ngda, chiplar chapda
94. ✅ Hydration ogohlantirishlari yo'q (SegmentThumb olib tashlandi, Suspense qo'shildi)
95. ✅ Konsol xatolari 0 (audit: 4 persona × 2 ekran)
96. 🔶 Rus tili: yangi bo'limlar (jamoalar, vakansiyalar) hali faqat o'zbekcha
97. ⬜ Sahifa sarlavhalari (document.title) barcha kabinet sahifalarida tekshirish
98. ⬜ Favicon/manifest ikonkalari maskable variantlari
99. ⬜ Print uslublari (buyurtma, chek)
100. ⬜ Dark rejimda OG rasm varianti

---

## 3. 100 ta animatsiya (motion katalogi)

Barchasi `src/app/globals.css`da: `--animate-*` tokenlari (Tailwind `animate-*` utilitlari), tarkibiy klasslar va reduced-motion bloklari.

### Kirish / chiqish (enter / exit)
1. ✅ `animate-page-in` — har sahifa (`app/template.tsx`)
2. ✅ `animate-fade-in` — tab kontenti, sanagichlar
3. ✅ `animate-fade-up` — bo'limlar, bildirishnoma paneli
4. ✅ `animate-slide-up` — mobil pastki menyu
5. ✅ `animate-scale-in` — foydalanuvchi menyusi
6. ✅ `animate-pop` — navbar nuqta, kichik belgilar
7. ✅ `animate-modal-in` / `animate-modal-out` — ⌘K palitra
8. ✅ `animate-sheet-up` / `animate-sheet-down` — pastki varaqlar
9. ✅ `animate-msg-in` — chat xabari kirishi
10. ✅ `animate-swap` — almashgan kontent (akkordeon tanasi)
11. ✅ `animate-slide-left` / `animate-slide-right` — karusel/yon panellar
12. ✅ `animate-rotate-in` — ikonka almashinuvi
13. ✅ `animate-flip-in` — kartani ochish
14. ✅ `animate-toast-in` / `animate-toast-out`
15. ✅ `.stagger` — ro'yxatlar ketma-ket (12 bosqich + qolganlari)
16. ✅ `[data-reveal]` — scroll'da ko'tarilib paydo bo'lish (CSS scroll-driven)
17. ✅ `[data-reveal="fade"]`, 18. ✅ `"scale"`, 19. ✅ `"left"`, 20. ✅ `"right"`

### Mikro-feedback (hover / press / holat)
21. ✅ `.press` — bosilganda 0.97
22. ✅ Tugma asosi: `active:scale-[0.97]` + fokus halqa o'tishi
23. ✅ `.card-hover` — ko'tarilish + soya, bosilganda kichrayish
24. ✅ `.hover-lift` — umumiy ko'tarilish utiliti
25. ✅ `.img-zoom` — rasm 1.045 zoom (jamoa kartalari)
26. ✅ `.icon-nudge` — strelka 2px siljiydi
27. ✅ `.icon-spin-hover` — "+" 90° buriladi
28. ✅ `.link-underline` — chapdan chiziq
29. ✅ Navbar hover pill (fon o'tishi)
30. ✅ Faol band urg'u chizig'i
31. ✅ Segment tanlovi fon o'tishi
32. ✅ Switch thumb siljishi (iOS)
33. ✅ `animate-heartbeat` — like (lenta + sevimlilar)
34. ✅ `animate-wiggle` — qo'ng'iroq o'qilmagan bo'lsa
35. ✅ `animate-badge-pop` — sanagichlar
36. ✅ `animate-shake` — `role="alert"` xatolar
37. ✅ Nusxalandi ✓ holati (2 s rang o'tishi)
38. ✅ Saqlash (bookmark) to'ldirilish o'tishi
39. ✅ Follow tugmasi holat almashinuvi
40. ✅ Chip (filtr) tanlov fon o'tishi

### Yuklanish va kutish
41. ✅ `.skeleton` + `animate-shimmer`
42. ✅ Spinner tugmalarda
43. ✅ `.nav-progress-loading` / `-done` — marshrut chizig'i
44. ✅ `animate-spin-slow` — dekorativ
45. ✅ `animate-pulse-ring` — onlayn halqa
46. ✅ `animate-ping-soft` + `.live-dot` — jonli efir nuqtasi
47. ✅ `animate-blink` — kursor/indikator
48. ✅ `animate-typing` + `.typing-dots` — "yozmoqda…" (chatga ulash 2-bosqich)
49. ✅ `animate-bounce-soft` — pastga aylantirish ishorasi
50. ✅ `scroll-nudge` — xaritada aylantirish ishorasi
51. ✅ `cover-fade-in` — muqova yuklanishi
52. ✅ `animate-check-draw` — ✓ chizilishi (SVG)
53. ✅ `animate-glow` — urg'u tugma nuri (ixtiyoriy)
54. ✅ `.delay-1..5` — kechikish yordamchilari

### Fon va atmosfera
55. ✅ `animate-float` / `animate-float-slow` — hero shakllari
56. ✅ `animate-drift` — fon gradient siljishi
57. ✅ `animate-marquee` — tasma
58. ✅ Backdrop blur (liquid glass) o'tishlari
59. ✅ Tema almashinuvi rang o'tishi
60. ✅ Scroll'da navbar soyasi (scrolled holati)

### Xarita (NeonMap / UzbekistanMap)
61. ✅ `map-enter`, 62. ✅ `map-float`, 63. ✅ `map-bob`, 64. ✅ `map-late`, 65. ✅ `map-tip-in`
66. ✅ `map-draw` (chiziq chizilishi), 67. ✅ `map-arc-flow`, 68. ✅ `map-pulse`, 69. ✅ `node-twinkle`
70. ✅ `pin-drop`, 71. ✅ `pin-radar`, 72. ✅ `pin-ping`, 73. ✅ `region` hover/aktiv o'tishlari, 74. ✅ zoom/pan o'tishlari

### Komponentlar
75. ✅ Akkordeon (`details[open] > .accordion-body`) — FAQ
76. ✅ Rasm galereyasi ochilishi/yopilishi
77. ✅ Taqqoslash tarnovi (tray) chiqishi
78. ✅ Chat scroll pastga silliq
79. ✅ Bildirishnoma paneli `fade-up`
80. ✅ Jamoa tab almashinuvi fade
81. ✅ Tab-bar faol holat `transition-all 300ms`
82. ✅ `prefers-reduced-motion` — barcha yuqoridagilar o'chadi/0.01ms

### Ochilish / yopilish tizimi (v3.1 — hamma ochiladigan joy bir xil kiradi va chiqadi)
- ✅ Rol asosida avtomatik: `[role="menu"]`, `[role="listbox"]` — pop; `[role="dialog"]`, `[role="status"]` — fade; `<details>` tanasi — swap; `.field-error` — swap
- ✅ `usePresence(open)` — yopilishda chiqish animatsiyasi (foydalanuvchi menyusi, qo'ng'iroq paneli, ⌘K palitra, mobil filtr varag'i, xarita hudud varag'i, to'lov varag'i)
- ✅ `.expand-in` inline panellar: buyurtma chati, post izohlari, efir maydonlari, sana tanlagich, admin amallar, yopilgan shikoyatlar, nomzodlar ro'yxati, filtr guruhlari
- ✅ `.pop-in` dropdownlar (qidiruv takliflari), `animate-fade-in + animate-modal-in` modallar (rasm kesish, galereya, demo tozalash), taqqoslash tarnovi `slide-up`
- ✅ `.chev` (aria-expanded bo'yicha 180°), `.collapse[data-open]` (balandlik animatsiyasi JS'siz) — yangi komponentlar uchun tayyor

### Reja (⬜)
83. ⬜ View Transitions API — sahifalar orasida umumiy element (karta → sahifa)
84. ⬜ Raqam sanash (count-up) statistikalarda
85. ⬜ Confetti birinchi buyurtma / birinchi ariza
86. ⬜ Toast swipe bilan yopish
87. ⬜ Pull-to-refresh lenta (PWA)
88. ⬜ Skeleton → kontent crossfade
89. ⬜ Portfolio drag-and-drop tartiblash animatsiyasi
90. ⬜ Like "yurak uchishi" (floating hearts) jonli efirda
91. ⬜ Parallaks hero (sichqoncha/gyro)
92. ⬜ Lottie ikonkalar bo'sh holatlarda
93. ⬜ Sahifa chiqish animatsiyasi (exit) App Router'da
94. ⬜ Xabar yuborilganda "uchib ketish" (send fly)
95. ⬜ Reaksiya tanlov paneli (long-press) animatsiyasi
96. ⬜ Progress halqa (rezyume to'liqligi) chizilishi
97. ⬜ Stories uslubidagi efir e'lonlari halqasi
98. ⬜ Haptic feedback (vibrate) mobil PWA'da like/yuborishda
99. ⬜ Scroll'ga bog'liq sarlavha kichrayishi (iOS large title)
100. ⬜ Shared layout animatsiyasi tab indikatorida (hozir CSS fon)

---

## 4. 500 ta UI dizayn qo'shimchasi (Apple uslubi)

25 bo'lim × 20 band. ✅ — `globals.css` tokenlari va komponentlarda bor; ⬜ — reja.

### A. Tokenlar va asos (1–20)
1. ✅ Radius shkalasi 12 / 18 / 26 (`--r-sm/md/lg`) 2. ✅ Soyalar 3 daraja, yassi 3. ✅ Davomiylik 150/260/450 ms 4. ✅ `--ease-out`, `--ease-spring` 5. ✅ Brend ranglar ink/cream/coral 6. ✅ Semantik tonlar success/warning/danger/info + soft variantlar 7. ✅ `fg-1..4` matn ierarxiyasi 8. ✅ `surface / surface-2 / surface-3` qatlamlar 9. ✅ `line / line-2` chiziqlar 10. ✅ 0.5px retina hairline 11. ✅ Dark rejim tokenlari 12. ✅ Liquid glass fallback (backdrop yo'q) 13. ✅ Z-index shkalasi (nav 50, modal 130) 14. ✅ Safe-area (`env(safe-area-inset-*)`) 15. ✅ Container `container-x` 16. ✅ Tipografik shkala 11–38px 17. ✅ `tabular-nums` 18. ✅ `text-wrap` qoidalari 19. ⬜ Spacing shkalasi hujjati (4/8/12/16/24/32/48) 20. ⬜ Design tokens JSON eksporti (Figma uchun)

### B. Tugmalar (21–40)
21. ✅ Variantlar: primary / accent / outline / ghost / glass / tint-soft / danger 22. ✅ O'lchamlar sm/md/lg/icon 23. ✅ `active:scale-[0.97]` 24. ✅ Fokus halqa 25. ✅ Disabled 40% 26. ✅ Spinner holati 27. ✅ Ikonka + matn oralig'i 28. ✅ Pill shakl (rounded-full) 29. ✅ `btn-ink` to'q tugma 30. ✅ Icon-only 44px 31. ✅ `min-w` matnli tugmalarda 32. ✅ ButtonLink (Link bilan bir xil) 33. ✅ Press utiliti 34. ✅ Hover rang o'tishi 35. ⬜ Loading matn almashinuvi ("Yuborilmoqda…") hamma joyda 36. ⬜ Split button (asosiy + menyu) 37. ⬜ Floating action button mobil lentada 38. ⬜ Tugma guruhi (segment) ikonkali 39. ⬜ Destruktiv tasdiq ikki bosqichli (qisman: inline "Ha/Yo'q") 40. ⬜ Klaviatura qisqartmasi ko'rsatkichi (kbd) tugmalarda

### C. Maydonlar va formalar (41–60)
41. ✅ Filled field 42. ✅ Fokus chegara + halqa 43. ✅ Xato holati qizil chegara 44. ✅ Label ustida, 13px 45. ✅ Yordamchi matn ostida 46. ✅ Sanagich (uzunlik) 47. ✅ Textarea avto-balandlik (qisman) 48. ✅ Select bir xil uslub 49. ✅ Qidiruv maydoni ikonka bilan 50. ✅ Chip kiritgich 51. ✅ Switch iOS 52. ✅ Segment tanlov 53. ✅ Sana maydoni h-11 54. ✅ Fayl yuklash zonasi 55. ✅ Rasm kesish (crop) 56. ⬜ Telefon maskasi 57. ⬜ Parol kuchi indikatori 58. ⬜ Avtosaqlash belgisi ("Saqlandi · 2 daqiqa oldin") 59. ⬜ Inline validatsiya (blur'da) hamma formada 60. ⬜ Form bosqichlari (stepper) uzun formalarda

### D. Kartalar (61–80)
61. ✅ `card` asosi 62. ✅ `card-hover` 63. ✅ `card-link` (butun karta havola) 64. ✅ `card-floating` (menyular) 65. ✅ `card-outline` 66. ✅ Muqova 3:1 / 4:1 67. ✅ Chiplar qatori tepada 68. ✅ Sarlavha + meta + footer tuzilmasi 69. ✅ `h-full` + `mt-auto` tekislash 70. ✅ Ring urg'u (rasmiy kanal) 71. ✅ O'qilmagan nuqta 72. ✅ Onlayn nuqta avatar ustida 73. ✅ "Yangi" belgisi 74. ✅ Rasm zoom 75. ✅ Stagger kirish 76. ⬜ Karta kontekst menyusi (⋯) 77. ⬜ Karta tanlash rejimi (checkbox) adminda 78. ⬜ Karta skeleton barcha ro'yxatlarda 79. ⬜ Karta "yopish" (dismiss) tavsiyalarda 80. ⬜ Karta hover'da tez amallar (quick actions)

### E. Navigatsiya (81–100)
81. ✅ Shisha kapsula navbar 82. ✅ Band darajalari (lg/2xl) 83. ✅ Hover pill 84. ✅ Faol chiziq 85. ✅ Logo so'z belgisi tor ekranda yashirin 86. ✅ Qidiruv tugmasi 87. ✅ Til almashtirgich 88. ✅ Tema tugmasi 89. ✅ Qo'ng'iroq + badge 90. ✅ Profil kapsulasi 91. ✅ Menyu bandlari ikonkali 92. ✅ Mobil tab-bar 5–6 ustun 93. ✅ Tab-bar faol `btn-ink` 94. ✅ Pastki varaq menyu 95. ✅ Jamoalar nuqtasi 96. ✅ Breadcrumb 97. ⬜ Mega-menyu "Ijodkorlar" (yo'nalishlar) 98. ⬜ Orqaga tugmasi mobil sarlavhada 99. ⬜ Scroll'da navbar yashirinishi (pastga) 100. ⬜ Kabinet yon panel yig'iladigan (collapse)

### F. Sarlavhalar va sahifa boshi (101–120)
101. ✅ `PageHeader` (eyebrow, title, description, action) 102. ✅ Displey sarlavha 28–38px 103. ✅ Urg'u so'z accent-serif 104. ✅ Eyebrow kichik harf 105. ✅ Harakat tugmasi o'ngda 106. ✅ Breadcrumb ustida 107. ✅ `balance` 108. ✅ Skeleton varianti 109. ⬜ Fon naqshi (pattern) hero'da variantlar 110. ⬜ Sahifa sarlavhasi scroll'da kichrayadi 111. ⬜ Sarlavha ostida tez filtr chiplari hamma katalogda 112. ⬜ Statistika qatori (N ta jamoa · N ta a'zo) sarlavhada 113. ⬜ Ulashish tugmasi barcha ommaviy sahifalarda 114. ⬜ "Oxirgi yangilanish" sanasi 115. ⬜ Sahifa ichi navigatsiya (TOC) uzun sahifalarda 116. ⬜ Sticky sarlavha jadval sahifalarida 117. ⬜ Progress (qadam 2/4) ko'p bosqichli oqimlarda 118. ⬜ Ko'rish rejimi almashtirgich (grid/list) 119. ⬜ Saralash dropdown sarlavhada 120. ⬜ Natijalar soni jumlasi hamma ro'yxatda

### G. Ro'yxatlar va jadvallar (121–140)
121. ✅ `list-inset` (iOS guruhlangan ro'yxat) 122. ✅ InsetGroup / InsetRow 123. ✅ Hairline ajratgichlar 124. ✅ Avatar + ism + meta qator 125. ✅ O'ng tomonda amal tugmalari 126. ✅ Admin jadvallar container query 127. ✅ Sahifalash 128. ✅ Bo'sh holat 129. ✅ Kutish (pending) bo'limi alohida 130. ✅ Rol chiplari (Egasi/Admin) 131. ⬜ Ustun saralash jadvallarda 132. ⬜ Qator kengaytirish (expand) 133. ⬜ Ommaviy tanlash + amallar 134. ⬜ Sticky jadval sarlavhasi 135. ⬜ Virtual scroll uzun ro'yxatlarda 136. ⬜ Swipe amallar mobil ro'yxatda 137. ⬜ Qayta tartiblash (drag) 138. ⬜ Guruhlash sana bo'yicha (Bugun / Kecha) bildirishnomalarda 139. ⬜ Zich/keng rejim 140. ⬜ CSV eksport adminda

### H. Chiplar, belgilar, teglar (141–160)
141. ✅ Kasb chipi 142. ✅ Format chipi (masofaviy ko'k) 143. ✅ Bandlik/tajriba chiplari 144. ✅ Rasmiy kanal chipi 145. ✅ "Siz a'zosiz" chipi 146. ✅ Yopiq jamoa qulf belgisi 147. ✅ Holat chiplari (ariza) 148. ✅ Tasdiqlangan email belgisi 149. ✅ Ko'nikma teglari 150. ✅ "+N" qisqartma 151. ✅ "Yangi" 152. ✅ Sanagich badge 153. ✅ Onlayn/offline 154. ✅ Jonli efir chipi 155. ⬜ Teg rang palitrasi (10 ta) 156. ⬜ Chipni olib tashlash (×) filtrlarda hamma joyda 157. ⬜ Darajali belgilar (Top, Pro) dizayn tizimi 158. ⬜ Tooltip chip ma'nosi 159. ⬜ Teg bulut (mashhur ko'nikmalar) 160. ⬜ Chip overflow "yana N ta" ochiladigan

### I. Modal, varaq, popover (161–180)
161. ✅ ⌘K palitra 162. ✅ Foydalanuvchi menyusi popover 163. ✅ Bildirishnoma paneli 164. ✅ Mobil pastki varaq 165. ✅ Rasm galereyasi modal 166. ✅ Crop modal 167. ✅ Esc / tashqari bosish yopadi 168. ✅ Fokus tuzoq (galereya) 169. ✅ Fon xiralashuvi 170. ✅ Yopish tugmasi 44px 171. ⬜ Umumiy Sheet komponenti 172. ⬜ Drag handle + snap nuqtalar 173. ⬜ Confirm dialog umumiy komponent 174. ⬜ Popover joylashuvi avtomatik (flip) 175. ⬜ Tooltip komponenti 176. ⬜ Modal ichida scroll shadow 177. ⬜ Ko'p bosqichli modal (wizard) 178. ⬜ Modal URL bilan (deep link) 179. ⬜ Varaqda klaviatura ochilganda moslashish 180. ⬜ Modal stack (bir nechta)

### J. Bildirishnoma va toast (181–200)
181. ✅ Toast HUD 182. ✅ 3 tur (success/error/info) 183. ✅ Avto-yopilish 3 s 184. ✅ `aria-live` 185. ✅ Reduced-motion 186. ✅ Qo'ng'iroq badge 187. ✅ Bildirishnoma turi ikonkasi + ohangi (META) 188. ✅ O'qilgan/o'qilmagan fon 189. ✅ "Barchasini o'qish" 190. ✅ Vaqt (timeAgo) 191. ⬜ Toast amal tugmasi ("Bekor qilish") 192. ⬜ Toast swipe 193. ⬜ Toast to'plami (stack) animatsiyasi 194. ⬜ Bildirishnoma guruhlash 195. ⬜ Sozlamalar turlar bo'yicha 196. ⬜ In-app banner (tepada) muhim xabarlar 197. ⬜ Push ruxsat so'rash UI 198. ⬜ Bildirishnoma preview Telegram uslubida 199. ⬜ Ovozli signal (ixtiyoriy) 200. ⬜ "Jim rejim" vaqt oralig'i

### K. Avatar va rasmlar (201–220)
201. ✅ Avatar fallback harflar 202. ✅ Avatar o'lchamlari 20–96 203. ✅ Onlayn nuqta 204. ✅ Muqova fallback naqsh 205. ✅ OfficialCover brend 206. ✅ SafeImage (xato → fallback) 207. ✅ Crop 1:1 va 4:1 208. ✅ Lazy loading 209. ✅ Galereya 4 tagacha grid 210. ✅ Video pleyer poster 211. ⬜ Avatar guruhi (stack, +N) 212. ⬜ Blur-up placeholder 213. ⬜ Rasm o'lcham variantlari (srcset) 214. ⬜ Avatar chegarasi rol bo'yicha (rasmiy) 215. ⬜ Rasm lightbox hamma joyda 216. ⬜ GIF/WebP qo'llab-quvvatlash tekshiruvi 217. ⬜ Rasm alt matnlari tahrirlanadigan 218. ⬜ Muqova pozitsiyasi (focal point) 219. ⬜ Avatar stiker/ramka (bayram) 220. ⬜ Dark rejimda rasm yorqinligi pasaytirish

### L. Bo'sh holatlar va onboarding (221–240)
221. ✅ EmptyState komponenti (ikonka, sarlavha, tavsif, amal) 222. ✅ Jamoalar bo'sh 223. ✅ Vakansiyalar bo'sh 224. ✅ Arizalar bo'sh 225. ✅ Saqlanganlar bo'sh 226. ✅ Qidiruv topilmadi 227. ✅ Rezyume yo'q → yaratish 228. ✅ Maqsad tanlovi ro'yxatda 229. ✅ PWA o'rnatish kartasi 230. ✅ Yordam maqolalari 231. ⬜ Birinchi kirish sayohati (tour) 232. ⬜ Profil to'ldirish checklist 233. ⬜ Illyustratsiyalar bo'sh holatlarda 234. ⬜ "Nima qilish kerak" kabinet boshida 235. ⬜ Demo kontent yangi jamoada 236. ⬜ Video qo'llanma havolalari 237. ⬜ Kontekstli maslahatlar (tooltips) 238. ⬜ Progress "profil 60% tayyor" 239. ⬜ Taklif qilish (referral) kartasi 240. ⬜ Yangi funksiya e'loni ("Yangi!") belgisi

### M. Hamjamiyat UI (241–260)
241. ✅ Rasmiy banner 242. ✅ Kanal/guruh bo'limlari 243. ✅ Post kompozer (matn, media, efir) 244. ✅ PostCard (pin, tahrir, o'chirish) 245. ✅ EventBlock + kalendar 246. ✅ Izohlar 247. ✅ Chat pufakchalari 248. ✅ Seen count 249. ✅ A'zolar + rollar 250. ✅ Join/leave/so'rov tugmasi 251. ✅ Mute 252. ✅ Taklif havolasi 253. ✅ Ulashish + Telegram 254. ✅ Tartib segmenti 255. ✅ A'zo qidiruvi 256. ⬜ Reaksiyalar paneli 257. ⬜ Reply/iqtibos 258. ⬜ Post ichida so'rovnoma 259. ⬜ Qadalgan xabar chatda 260. ⬜ Media galereyasi jamoada

### N. Vakansiya UI (261–280)
261. ✅ VacancyCard 262. ✅ Filtrlar (kasb, format, bandlik, tajriba, hudud, maosh) 263. ✅ Saralash (yangi / maosh) 264. ✅ Kasb chiplari sonli 265. ✅ Vakansiya sahifasi (tavsif, talablar, ko'nikmalar) 266. ✅ Yon panel (ariza / egasi paneli / statistika) 267. ✅ ApplyForm 268. ✅ Saqlash + ulashish 269. ✅ O'xshash + shu ish beruvchi 270. ✅ ResumeCard 271. ✅ ResumeForm + to'liqlik 272. ✅ Nomzodlar ro'yxati + holat 273. ✅ Arizalarim 274. ✅ "Yangi" belgisi 275. ✅ Yopiq banner 276. ⬜ Kompaniya sahifasi 277. ⬜ Maosh histogrammasi 278. ⬜ Vakansiya taqqoslash 279. ⬜ Ariza xati shablonlari 280. ⬜ Nomzod kanban (ish beruvchi)

### O. Kabinet (281–300)
281. ✅ Yon navigatsiya + badge 282. ✅ Holat nuqtasi (profil) 283. ✅ Bannerlar (obuna, shartlar) 284. ✅ Umumiy ko'rinish kartalari 285. ✅ Hisobot sahifasi 286. ✅ Xavfsizlik paneli (2FA, sessiyalar) 287. ✅ Telegram ulash kartasi 288. ✅ Chat 289. ✅ Saqlangan qidiruvlar 290. ✅ Vakansiyalar/Arizalar/Rezyume 291. ⬜ "Bugun" bloki 292. ⬜ Faollik lentasi 293. ⬜ Statistika grafiklari 294. ⬜ Kabinet qidiruvi 295. ⬜ Tez amallar paneli 296. ⬜ Moslashtiriladigan tartib 297. ⬜ Qorong'u/yorug' avtomatik vaqt bo'yicha 298. ⬜ Kabinet mobil pastki varaq navigatsiya 299. ⬜ Eslatmalar (todo) 300. ⬜ Yutuqlar (badges)

### P. Buyurtma va to'lov UI (301–320)
301. ✅ Buyurtma ustasi (wizard) 302. ✅ Holat chiplari 303. ✅ Chat buyurtmada 304. ✅ To'lov paneli (Payme/Click/qo'lda) 305. ✅ Chek sahifasi 306. ✅ Nizo oqimi 307. ✅ Muddat/SLA eslatma UI 308. ✅ Payout formasi (karta brendi) 309. ✅ Kalkulyator (loyiha/dona) 310. ✅ Paketlar 311. ⬜ Timeline vizual 312. ⬜ Milestone UI 313. ⬜ Shartnoma PDF ko'rish 314. ⬜ Promo kod maydoni 315. ⬜ Qayta buyurtma tugmasi 316. ⬜ To'lov usuli saqlash 317. ⬜ Hisob-faktura 318. ⬜ Baholash so'rovi modal 319. ⬜ Buyurtma eksporti 320. ⬜ Mijoz uchun taqqoslash takliflar

### Q. Admin UI (321–340)
321. ✅ Scrollspy yon navigatsiya 322. ✅ Statistika grafiklari 323. ✅ Foydalanuvchilar qidiruv/bloklash 324. ✅ To'lov sozlamalari 325. ✅ Ommaviy xabar 326. ✅ Fayl saqlash diagnostikasi 327. ✅ Obunalar jadvali 328. ✅ Buyurtmalar jadvali 329. ✅ Tap target tuzatishlari 330. ✅ Container query jadvallar 331. ⬜ Jamoalar bo'limi 332. ⬜ Vakansiyalar bo'limi 333. ⬜ Shikoyatlar navbati 334. ⬜ Audit jurnali ko'rish 335. ⬜ Cron natijalari paneli 336. ⬜ Feature flag'lar 337. ⬜ Kontent moderatsiya navbati 338. ⬜ Admin qidiruv ⌘K kengaytmasi 339. ⬜ Rollar (moderator) 340. ⬜ Admin mobil rejim

### R. Yordam va matn (341–360)
341. ✅ Yordam markazi kategoriyalar 342. ✅ Maqolalar 343. ✅ FAQ akkordeon 344. ✅ Haqida sahifasi 345. ✅ Oferta/maxfiylik 346. ✅ Footer havolalari 347. ✅ 404 matni 348. ✅ Xato sahifasi 349. ✅ Bo'sh holat matnlari 350. ✅ Toast matnlari 351. ⬜ Yordam qidiruvi 352. ⬜ "Foydali bo'ldimi?" ovoz 353. ⬜ Video qo'llanmalar 354. ⬜ Kontekstli yordam (?) tugmalari 355. ⬜ Glossariy 356. ⬜ Changelog sahifasi 357. ⬜ Holat sahifasi (status) 358. ⬜ Aloqa formasi 359. ⬜ Rus tilida yordam 360. ⬜ Matn uslubi qo'llanmasi (tone of voice)

### S. Dark rejim (361–380)
361. ✅ Tokenlar 362. ✅ Kartalar qatlamlari 363. ✅ Shisha fallback 364. ✅ Rasm fallbacklar 365. ✅ Grafiklar ranglari 366. ✅ Toast 367. ✅ Modal fon 368. ✅ Chiplar 369. ✅ Skeleton 370. ✅ Navbar 371. ⬜ OG rasm dark 372. ⬜ Rasm yorqinligi 373. ⬜ Kod bloklari 374. ⬜ Xarita dark variantlari tekshiruvi 375. ⬜ Email dark 376. ⬜ Avtomatik vaqt bo'yicha 377. ⬜ Kontrast audit dark 378. ⬜ Chegaralar dark'da ko'rinishi audit 379. ⬜ Dark skrinshotlar yordamda 380. ⬜ Tema o'tish animatsiyasi (View Transitions)

### T. Mobil (381–400)
381. ✅ 390px gorizontal scroll yo'q 382. ✅ Tab-bar 383. ✅ Pastki varaq menyu 384. ✅ Safe-area 385. ✅ 44px maydonlar 386. ✅ Filtrlar yig'iladigan 387. ✅ Kartalar bir ustun 388. ✅ Chat klaviatura moslashuvi 389. ✅ Rasm kesish touch 390. ✅ Lenta vertikal (Reels) 391. ⬜ Swipe navigatsiya tablar 392. ⬜ Pull-to-refresh 393. ⬜ Haptics 394. ⬜ Mobil sarlavha orqaga 395. ⬜ Kamera orqali yuklash tez tugma 396. ⬜ Offline xabarlar navbati 397. ⬜ Mobil qidiruv to'liq ekran 398. ⬜ Bottom sheet filtrlar 399. ⬜ Sticky CTA pastda (ariza/buyurtma) 400. ⬜ Mobil landshaft rejim tekshiruvi

### U. Qulaylik — a11y (401–420)
401. ✅ Fokus halqalar 402. ✅ aria-current 403. ✅ role=switch 404. ✅ aria-busy 405. ✅ Skip-link 406. ✅ Reduced motion 407. ✅ aria-hidden dekorativ 408. ✅ Label/sr-only 409. ✅ Kontrast tokenlari 410. ✅ Klaviatura menyu (strelkalar, Home/End) 411. ⬜ Ekran o'quvchi sinovi 412. ⬜ aria-live chat 413. ⬜ Fokus tartibi audit 414. ⬜ Landmarklar (main/nav/aside) audit 415. ⬜ Forma xatolari fokusga o'tish 416. ⬜ Katta shrift rejimi (200%) tekshiruvi 417. ⬜ Rang-ko'rlik rejimi 418. ⬜ Alt matn majburiy yuklashda 419. ⬜ Klaviatura qisqartmalari sahifasi 420. ⬜ axe CI

### V. Ishlash — performance (421–440)
421. ✅ Server komponentlar 422. ✅ Skeleton 423. ✅ Lazy rasm 424. ✅ CSS animatsiya (JS'siz reveal) 425. ✅ Parallel so'rovlar (Promise.all) 426. ✅ Keshsiz dinamik sahifalar aniq 427. ✅ Blob CDN 428. ✅ Font preload 429. ⬜ Rasm variantlari 430. ⬜ Route segment keshlash 431. ⬜ Bundle tahlili 432. ⬜ Lighthouse CI 433. ⬜ Prefetch hover'da 434. ⬜ Virtual ro'yxatlar 435. ⬜ Service worker kesh strategiyasi 436. ⬜ DB indekslar auditi (vakansiya qidiruv) 437. ⬜ Edge runtime yengil route'lar 438. ⬜ Streaming (Suspense) og'ir sahifalarda 439. ⬜ Web Vitals monitoring 440. ⬜ CSS hajmini kamaytirish (xarita bo'limi alohida)

### W. Brend va vizual til (441–460)
441. ✅ Ink/cream/coral palitra 442. ✅ Unbounded displey 443. ✅ Accent-serif urg'u 444. ✅ Liquid glass 445. ✅ OfficialCover gradient 446. ✅ Kategoriya ikonkalari 447. ✅ Naqshli muqovalar 448. ✅ OG rasm 449. ✅ Favicon/manifest 450. ✅ Xarita neon uslubi 451. ⬜ Illyustratsiya to'plami 452. ⬜ Logo variantlari (mono) 453. ⬜ Brend qo'llanmasi sahifasi 454. ⬜ Ijtimoiy tarmoq shablonlari 455. ⬜ Email shablon brend 456. ⬜ Telegram bot avatar/matn uslubi 457. ⬜ Yuklanish logotip animatsiyasi 458. ⬜ Mavsumiy tema 459. ⬜ Sertifikat/badge dizayni 460. ⬜ Prezentatsiya shabloni

### X. Kontent va mikro-matn (461–480)
461. ✅ O'zbek tilida barcha UI 462. ✅ Xato matnlari tushunarli 463. ✅ Bo'sh holat matnlari harakatga undovchi 464. ✅ Tooltip/title tugmalarda 465. ✅ Bildirishnoma matnlari kontekstli 466. ✅ Maqsad tanlovi matnlari 467. ✅ Shubhali e'lon ogohlantirishi 468. ✅ Kontakt siyosati tushuntirishi 469. ✅ Yordam intro 470. ✅ Footer tagline 471. ⬜ Rus tili yangi bo'limlar 472. ⬜ Ingliz tili 473. ⬜ Matn uzunligi auditi (truncation) 474. ⬜ Raqamlar formati (1 200 000) hamma joyda 475. ⬜ Sana formati ru 476. ⬜ Jinsga neytral matnlar auditi 477. ⬜ Emoji siyosati 478. ⬜ Terminlar lug'ati (bir xil so'zlar) 479. ⬜ Mikro-matn A/B 480. ⬜ Push matn shablonlari

### Y. Tizim va hujjat (481–500)
481. ✅ globals.css tokenlar hujjatlashtirilgan izohlar 482. ✅ UI primitivlar (`components/ui`) 483. ✅ ROADMAP-500 (shu hujjat) 484. ✅ IJTIMOIY-TARMOQ reja 485. ✅ BACKLOG 486. ✅ CLAUDE.md konvensiyalar 487. ✅ Audit skripti (Playwright, 4 persona) 488. ✅ Skrinshot skriptlari 489. ✅ Smoke testlar 490. ✅ tsc + build QA rituali 491. ⬜ Storybook / UI katalog sahifasi (/dizayn) 492. ⬜ Vizual regressiya (screenshot diff) 493. ⬜ Komponent API hujjatlari 494. ⬜ Token → Figma sinxron 495. ⬜ Dizayn tekshiruv ro'yxati PR uchun 496. ⬜ Ikonka to'plami hujjati 497. ⬜ Harakat qo'llanmasi (qachon qaysi animatsiya) 498. ⬜ Matn uslubi hujjati 499. ⬜ A11y tekshiruv ro'yxati 500. ⬜ Dizayn tizimi versiyalash (v2.1, v3)

---

## 5. 100 ta keyingi qadam — nima qilish kerak

Ustuvorlik: **P1** — keyingi 2–4 hafta, **P2** — 1–3 oy, **P3** — keyin. Kim: 👨‍💻 dasturchi, 🧑‍💼 asoschi/jamoa, 💳 to'lov/yuridik.

### Texnik poydevor (P1)
1. P1 👨‍💻 Real-time qatlam (Ably yoki Pusher): chat, lenta, bildirishnoma, "yozmoqda", onlayn presence
2. P1 👨‍💻 Web Push (VAPID) + Service Worker bildirishnomalari
3. P1 👨‍💻 E2E testlar (Playwright) CI'da: ro'yxat → vakansiya → ariza; jamoa → post → izoh
4. P1 👨‍💻 Vizual regressiya skrinshotlari CI'da (asosiy 12 sahifa × 2 tema)
5. P1 👨‍💻 Rasm o'lcham variantlari (Blob + `next/image` loader) — mobil trafik
6. P1 👨‍💻 Rus tili: jamoalar, vakansiyalar, rezyumelar lug'atlari
7. P1 👨‍💻 Admin: jamoalar va vakansiyalar bo'limi (shikoyat, yashirish, ega almashtirish)
8. P1 👨‍💻 Spam/havola filtri post, chat, vakansiya uchun + rate limit sozlash
9. P1 👨‍💻 Monitoring: Sentry (xatolar) + Vercel Analytics/Web Vitals
10. P1 👨‍💻 Backup tekshiruvi: Turso point-in-time + oylik tiklash mashqi

### Hamjamiyat (P1–P2)
11. P1 🧑‍💼 Rasmiy kanalda haftalik 2–4 efir jadvali (Google Meet/YouTube Live) — birinchi oy taqvimi
12. P1 🧑‍💼 Dastlabki 10 ta yo'nalish/hudud kanalini ochish va moderatorlar tayinlash
13. P2 👨‍💻 Reaksiyalar (6 emoji) va reply chatda
14. P2 👨‍💻 So'rovnomalar (poll) postlarda
15. P2 👨‍💻 Jonli efir ichida (embed) chat + savollar (Q&A) navbati
16. P2 👨‍💻 Efir yozuvlari arxivi (YouTube havolasi + vaqt belgilari)
17. P2 👨‍💻 Jamoa media galereyasi va fayllar bo'limi
18. P2 👨‍💻 Qadalgan xabar chatda, xabarni o'chirish/tahrirlash
19. P3 👨‍💻 Ovozli/video qo'ng'iroq (LiveKit/Daily) — 1:1 va guruh
20. P3 👨‍💻 Stories uslubidagi qisqa e'lonlar (24 soat)

### Vakansiyalar (P1–P2)
21. P1 🧑‍💼 Birinchi 50 ta vakansiya: hamkor studiyalar/agentliklarni jalb qilish
22. P1 👨‍💻 Vakansiya saqlangan qidiruv + "yangi mos vakansiya" bildirishnomasi
23. P2 👨‍💻 Kompaniya sahifasi va logotip
24. P2 👨‍💻 Nomzod kanban (ish beruvchi), javob SLA eslatmasi
25. P2 👨‍💻 Rezyume PDF eksport (brend shablon)
26. P2 👨‍💻 Ariza xati AI yordamchisi (ixtiyoriy, mahalliy shablonlar)
27. P2 🧑‍💼 Telegram kanalga avtomatik vakansiya posti (cross-post)
28. P3 👨‍💻 Test topshiriqlari (vakansiyaga biriktirilgan)
29. P3 👨‍💻 Intervyu jadvali (kalendar slotlari)
30. P3 💳 Premium vakansiya (ko'tarish) — faqat talab bo'lsa, asosiysi to'lovsiz qoladi

### Marketpleys va to'lov (P1–P2)
31. P1 💳 Payme/Click prod kalitlari va test to'lovlar (hali sinovda bo'lsa)
32. P1 💳 Oferta/maxfiylik yuridik ko'rib chiqish (escrow, vakansiya ma'lumotlari)
33. P2 👨‍💻 Milestone to'lovlar
34. P2 👨‍💻 Shartnoma PDF
35. P2 👨‍💻 Promo kodlar
36. P2 👨‍💻 Hisob-faktura yuridik shaxslar uchun
37. P2 🧑‍💼 Mutaxassis obunasi narx testi (3 oy bepul → ?)
38. P3 👨‍💻 Ko'p valyuta (USD ko'rsatish bor; to'lov so'mda)
39. P3 💳 Soliq hisobotlari (o'zini o'zi band qilganlar) integratsiyasi
40. P3 👨‍💻 Reyting formulasi 2.0 (javob tezligi, bajarish foizi)

### Mahsulot va UX (P1–P2)
41. P1 👨‍💻 Kabinet "Bugun" bloki (efir, muddat, yangi ariza, yangi buyurtma)
42. P1 👨‍💻 Onboarding checklist (profil 60% → 100%)
43. P2 👨‍💻 Umumiy Sheet/Confirm/Tooltip komponentlari
44. P2 👨‍💻 View Transitions (karta → sahifa)
45. P2 👨‍💻 Qidiruvda yaqinda/mashhur so'rovlar, klaviatura navigatsiyasi
46. P2 👨‍💻 Faollik lentasi (kim nima qildi)
47. P2 👨‍💻 Profil ko'rishlar statistikasi
48. P2 👨‍💻 Mobil: swipe tablar, pull-to-refresh, sticky CTA
49. P3 👨‍💻 Shaxsiylashtirilgan bosh sahifa (maqsadga ko'ra)
50. P3 👨‍💻 Tavsiya tizimi (o'xshash mutaxassis/vakansiya) — oddiy signallar

### SEO va o'sish (P1–P2)
51. P1 🧑‍💼 Google Search Console + Yandex Webmaster ulash, sitemap yuborish
52. P1 👨‍💻 Vakansiya/jamoa uchun dinamik OG rasmlar
53. P2 👨‍💻 Vakansiya SEO landinglari (kasb × hudud)
54. P2 🧑‍💼 Blog/maqolalar (yordam markazi kengaytmasi) — haftada 1
55. P2 🧑‍💼 Telegram kanal + Instagram kontent rejasi (efir anonslari, muvaffaqiyat hikoyalari)
56. P2 👨‍💻 Referral (taklif) havolalari va hisob
57. P2 🧑‍💼 Universitetlar/o'quv markazlari bilan hamkorlik (rezyume oqimi)
58. P3 👨‍💻 Ingliz tili (xalqaro mijozlar)
59. P3 🧑‍💼 PR: mahalliy media, podkastlar
60. P3 🧑‍💼 Hamkorlik dasturi (agentliklar uchun jamoa hisoblari)

### Xavfsizlik va ishonch (P1)
61. P1 👨‍💻 Pentest takrori (yangi API: groups, posts, vacancies, search)
62. P1 👨‍💻 Shikoyat oqimi: post/izoh/vakansiya/foydalanuvchi — admin navbati
63. P1 👨‍💻 Kontakt-gating auditi yangi bo'limlarda (rezyume, ariza)
64. P2 👨‍💻 Hisob tasdiqlash darajalari (telefon, pasport — ixtiyoriy "Tasdiqlangan")
65. P2 👨‍💻 Fraud signallar vakansiyalarda (oldindan to'lov so'zlari)
66. P2 👨‍💻 Ma'lumot eksporti va hisobni o'chirish oqimi tekshiruvi (GDPR-uslub)
67. P3 👨‍💻 Bug bounty (kichik)
68. P3 👨‍💻 2FA majburiy adminlar uchun
69. P3 👨‍💻 Audit jurnali UI
70. P3 👨‍💻 IP/geoblok sozlamalari

### Operatsiya (P1–P2)
71. P1 🧑‍💼 Moderatsiya qoidalari matni (jamoa qoidalari sahifasi)
72. P1 🧑‍💼 Qo'llab-quvvatlash: @montajor_man javob SLA (24 soat) va shablonlar
73. P2 👨‍💻 Admin cron paneli (so'nggi ishga tushishlar, xatolar)
74. P2 👨‍💻 Feature flag'lar (yangi funksiyani bosqichma-bosqich ochish)
75. P2 👨‍💻 Staging muhit (alohida Turso + Vercel preview)
76. P2 👨‍💻 Changelog sahifasi va "Yangi!" belgilari
77. P3 👨‍💻 Holat sahifasi (status)
78. P3 🧑‍💼 Jamoa: moderator(lar), kontent menejer
79. P3 🧑‍💼 Hamjamiyat elchilari (hudud bo'yicha)
80. P3 👨‍💻 Ichki metrikalar dashboardi (DAU, postlar, arizalar, buyurtmalar)

### Dizayn tizimi (P2)
81. P2 👨‍💻 /dizayn sahifasi (UI katalog, tokenlar, komponentlar, harakatlar)
82. P2 👨‍💻 Token → Figma eksport
83. P2 👨‍💻 Harakat qo'llanmasi (qachon qaysi animatsiya, davomiylik)
84. P2 👨‍💻 Ikonka va illyustratsiya to'plami
85. P2 👨‍💻 Email shablonlari brendga moslash
86. P3 👨‍💻 Mavsumiy tema / bayram
87. P3 👨‍💻 Yuqori kontrast rejimi
88. P3 👨‍💻 Matn uslubi (tone of voice) hujjati
89. P3 👨‍💻 Komponent API hujjatlari
90. P3 👨‍💻 Dizayn tekshiruv ro'yxati PR uchun

### Mobil ilova (P3)
91. P3 👨‍💻 PWA mukammallash (offline, push, o'rnatish) — do'konlarsiz birinchi
92. P3 👨‍💻 Capacitor/Expo wrapper (App Store / Play Market)
93. P3 👨‍💻 Haptics, kamera, kontaktlar integratsiyasi
94. P3 👨‍💻 Push kategoriyalari va "jim rejim"
95. P3 🧑‍💼 Do'kon sahifalari, skrinshotlar, tavsif

### O'lchash (P1)
96. P1 👨‍💻 Voronka hodisalari: ro'yxat → maqsad → birinchi amal (post/ariza/buyurtma)
97. P1 🧑‍💼 Haftalik KPI: yangi foydalanuvchi, faol jamoa, efir ishtirokchi, ariza, buyurtma
98. P2 👨‍💻 Qoniqish so'rovi (NPS) kabinetda chorakda bir
99. P2 👨‍💻 A/B test infratuzilmasi (oddiy flag asosida)
100. P2 🧑‍💼 Foydalanuvchi intervyulari (oyiga 5 ta) — ro'yxat va xulosalar hujjati
