# 100 ta kamchilik — mavzular bo'yicha audit (2026-11-01)

Platformaning hozirgi holatini halol baholash. Har band — aniq, tekshirilgan yoki kod/UX tahlilidan kelib chiqqan kamchilik. «Kamchilik» = foydalanuvchi sezadigan muammo, yetishmayotgan funksiya yoki texnik qarz. ✱ belgisi — eng muhim 20 tasi.

## 1. Chat (yangi Telegram inbox) — 1–10
1. ✱ ✅ YOPILDI (2026-11-01): desktopda (lg+) guruh/kanal qatori bosilganda GroupChat o'ng panelda ochiladi (`DmChat` `activeGroup` + `GroupChat embedded` prop); telefonda avvalgidek sahifaga o'tadi.
2. ✅ YOPILDI (2026-11-01): kanal qatori telefon/planshetda `?post=<oxirgi post>` bilan ochiladi (desktopda panel ichida).
3. Guruh qatorlarida «yozmoqda…» ko'rsatkichi yo'q (DM'da bor, guruh typing API mavjud — ulash qoldi).
4. ✅ YOPILDI (2026-11-01): guruh/kanal qatorida ham svayp amallar — qadash · ovozsiz · arxiv (DM mexanizmi umumlashtirildi).
5. ✅ YOPILDI (2026-11-01): guruh qatori «⋯» menyusida «Ovozsiz» (PATCH /api/chat/guruh muted).
6. ✅ YOPILDI (2026-11-01): papka boshqaruvida qalam tugmasi — nomni joyida tahrirlash (PATCH /api/chat/papkalar/[id] allaqachon bor edi, UI qo'shildi).
7. Papkalar tartibini surib o'zgartirib bo'lmaydi (position ustuni bor, UI yo'q).
8. ✅ YOPILDI (2026-11-01): `group_members.archived_at` — «⋯» menyu va svaypdan arxivga olinadi, Arxiv ko'rinishida chiqadi (a'zolik saqlanadi).
9. Chat ro'yxatida qidiruv faqat nom/oxirgi xabar bo'yicha — xabarlar ichidan global qidiruv yo'q (Telegram'da bor).
10. ✅ YOPILDI (2026-11-01): guruh/kanal qatori «⋯» menyusida «O'qildi deb belgilash» (lastReadAt = hozir).

## 2. Jamoalar va guruh chati — 11–20
11. ✱ ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): GroupChat composer'ida VoiceRecorder ulangan (`sendVoice`).
12. Guruh chatida xabarni yo'naltirish (forward) yo'q.
13. ✅ YOPILDI (2026-11-01): A'zolar bo'limida boshqaruvchiga «Admin nimalarni qila oladi?» yig'ilgan tushuntirma kartasi.
14. ✅ YOPILDI (2026-11-01): InviteLink'da QR tugmasi — mavjud kutubxonasiz QR generatori (lib/profile/qr) bilan ko'rsatiladi.
15. ✅ YOPILDI (2026-11-01): moderator o'chirsa muallifga bildirishnoma («xabaringiz qoidalarga mos kelmagani uchun olib tashlandi»).
16. ✅ YOPILDI (2026-11-01): GroupView.pendingPosition — «So'rov yuborildi · navbatda N-chisiz».
17. Guruh statistikasi faqat 7 kunlik — oy/grafik yo'q.
18. Kanal postlariga reaksiya bor, lekin kanal egasi «kim ko'rdi» sonini post kesimida tahlil qila olmaydi (post-stats bor, kanal kesimida jamlama yo'q).
19. Guruhda so'rovnoma (poll) faqat efirda bor — oddiy chatda yo'q.
20. ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): guruh sahifasida EventsCard/EventsList ichida CalendarLinks (.ics) mavjud.

## 3. Mentorlik — 21–30
21. ✱ Video pleyerda sifat tanlash yo'q (bitta oqim; HLS/transcoding yo'q — katta videolar sekin ochiladi).
22. ✱ ✅ YOPILDI (2026-11-01): xom saqlash URL mijozga chiqmaydi — `/api/mentorlik/video/[lessonId]` proxy (sessiya + yozilganlik tekshiruvi, keshsiz 302; bepul namuna mehmonga ochiq).
23. Kurs sertifikatida QR tekshiruv havolasi bor-u, sertifikat dizayni bitta — mentor logosi qo'shilmaydi.
24. Kursni ulushlab to'lash (bo'lib to'lash) yo'q.
25. Dars izohlari (savol-javob) mentor javob berganda talabaga push boradi, lekin dars sahifasida «yangi javob» belgisi yo'q.
26. ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): CourseEditor'da ommaviy kurs sahifasiga «ko'rish» havolasi (yangi oynada) mavjud.
27. Mentor daromad grafigi yo'q — faqat ro'yxat (oylik diagramma kerak).
28. ✅ YOPILDI (2026-11-01): slot formasi ostida «Toshkent vaqti (UTC+5)» izohi; talaba kirish matnida ham «Toshkent vaqti».
29. Kurs tugatganlarga «keyingi kurs» tavsiyasi avtomatik chiqmaydi (yo'l xaritasi bor, bitirganda taklif yo'q).
30. ✅ YOPILDI (2026-11-01): kurs namunasi ostida «Ulashish» tugmasi — /mentorlik/dars/<id> havolasi nusxalanadi (namuna hammaga ochiq).

## 4. Profil va ijodkorlar katalogi — 31–40
31. ✱ ✅ YOPILDI (2026-11-01): `uploadAttachment` har qanday video yuklashda muqova kadrini avtomatik oladi va yuklaydi (`captureVideoPoster` — avval faqat GroupFeed'da edi); qidiruv plitkalari video posterini ishlatadi (profil to'ri va reels allaqachon ishlatardi).
32. Profil ko'rishlar statistikasi egasiga kunlik grafik bilan ko'rsatilmaydi (bitta son xolos).
33. Ijodkor o'z profilini PDF/portfolio fayl sifatida eksport qila olmaydi.
34. Katalogda «onlayn» filtri bor-u, «bugun javob bergan» kabi ishonch signali yo'q.
35. Sharhlarga ijodkor javobi bor, lekin sharhni foydali deb belgilash yo'q.
36. Profil highlights (saralangan storylar) muqovasini o'zgartirib bo'lmaydi — birinchi kadr olinadi.
37. ✅ YOPILDI (2026-11-01): ish oynasida «Ish yoqdimi? Kontaktni ochish» CTA — modalni yopib profil'dagi #kontakt kartasiga olib boradi.
38. ✅ YOPILDI (2026-11-01): PROFILE_HIRING=false'da Narx/Paketlar qatorlari va kurs izohi yashiriladi.
39. ✅ YOPILDI (2026-11-01): `users.prev_username` — setUsername eski taxallusni saqlaydi, /yozish/<eski> yangi profilga olib boradi.
40. ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): ShareButton'da QR ko'rinishi + SVG yuklab olish (/u/[code]/qr) mavjud.

## 5. Qidiruv va SEO — 41–50
41. ✱ ✅ YOPILDI (2026-11-01): `lib/search/fuzzy.ts` — platforma lug'ati (kasblar/hududlar) bo'yicha Levenshtein tuzatish; natija bo'sh bo'lsa exploreSearch avtomatik tuzatib qayta qidiradi va «Natijalar ... bo'yicha ko'rsatildi» deb aytadi.
42. ✅ QAMRAB OLINGAN (2026-11-01): telefonda pastki tabdagi «Qidiruv» aynan shu vazifani bajaradi (⌘K — klaviaturali desktop vositasi).
43. ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): /qidiruv sahifasida `RecentSearches` komponenti mavjud.
44. ✅ YOPILDI (2026-11-01): savol sahifasida `QAPage` JSON-LD (acceptedAnswer + suggestedAnswer, `\u003c` ekranlash).
45. ✅ YOPILDI (2026-11-01): /konkurs/[id]/opengraph-image — brend palitrasida nom/holat/ishlar soni/muddat (sinovda 200, PNG).
46. ✅ YOPILDI (2026-11-01): sitemap'ga /savollar(+har savol) va /konkurs(+har konkurs) qo'shildi (`getSitemapQuestions`/`getSitemapChallenges`).
47. ✅ YOPILDI (2026-11-01): kurs sahifasida bepul namuna video uchun VideoObject JSON-LD (@graph ichida).
48. Blog/maqolalar bo'limi umuman yo'q — SEO uchun eng katta o'sish nuqtasi.
49. ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): not-found.tsx'da GET qidiruv formasi (/mutaxassislar?q=) mavjud.
50. RU sahifalar uchun hreflang teglari yo'q.

## 6. To'lovlar va pul — 51–60
51. ✱ Payme/Click prod kalitlari hali ulanmagan — real to'lov faqat qo'lda o'tkazma orqali.
52. ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): PrintButton «Chop etish / PDF» — fayl nomi bilan PDF saqlashga ochadi.
53. Promokod faqat mentorlik uchun — obuna va kontakt ochishga ishlamaydi.
54. ✅ YOPILDI (2026-11-01): kabinet bosh sahifasida «To'lov kutilmoqda» banneri (oxirgi 7 kundagi ochiq hisob, turiga qarab to'lov sahifasiga olib boradi).
55. Qaytarish (refund) so'rovini foydalanuvchi o'zi ocholmaydi — faqat admin orqali.
56. ✅ YOPILDI (2026-11-01): daromad qatorlarida «... da ochiladi» sanasi (mentor_earnings.availableAt).
57. ✅ YOPILDI (2026-11-01): kurs narxi ostida taxminiy $ ekvivalenti (settings.usdRate).
58. ✅ YOPILDI (2026-11-01): /narxlar'da «Boshqa komissiya va narxlar» jadvali (mentorlik 15% + 7 kun hold, kontakt narx oralig'i, bepul bo'limlar) — eskrou jadvali avvaldan bor edi.
59. ✅ YOPILDI (2026-11-01): kontakt to'lov Sheet'ida «Nega kontakt pullik?» havolasi (/narxlar).
60. ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): /kabinet/hisobot'da har oy uchun CSV tugmasi (/kabinet/hisobot/csv) mavjud.

## 7. Telefon UX va ilova hissi — 61–70
61. ✱ ✅ YOPILDI (2026-11-01): `InstallPrompt` /xush-kelibsiz onboarding sahifasiga ham qo'shildi (kabinetdagi banner saqlangan).
62. Pastki tab'da uzun bosish (long-press) tezkor amallar menyusi yo'q (masalan Yaratish → Post/Story).
63. ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): ReelsFeed ShareSheet (pastki varaq) ishlatadi.
64. ✅ YOPILDI (2026-11-01): Lightbox'da yuklab olish tugmasi (Download, yopish yonida).
65. Shakllarda klaviatura «Enter → keyingi maydon» xatti-harakati hamma joyda emas.
66. ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): /offline sahifasi + sw.js network-first fallback (PRECACHE'da).
67. ✅ YOPILDI (2026-11-01): /savollar va /konkurs ro'yxatlari (katalog) guruhiga ko'chirilib skelet loading.tsx qo'shildi (tafsilot sahifalari yumshoq 404 qoidasiga tegilmadi).
68. Haptik faqat ba'zi amallarda — like/pin/yuborishda bir xil emas.
69. ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): components/layout/BackToTop.tsx layout.tsx'da global ulangan.
70. Katta rasmlarga blur-up placeholder yo'q — sekin internetda oq bo'shliqlar.

## 8. Til (RU) va matnlar — 71–80
71. ✱ ✅ YOPILDI (2026-11-01): `i18n/dict/community.ts` (KONKURS/SAVOL) — /konkurs(+[id]), ChallengeView, /savollar(+yangi, [id]), AskForm, QuestionThread to'liq uz/ru. Bot /konkurs — faqat admin buyrug'i, uz qoldi.
72. Mentorlik ichki sahifalari (kurs tavsifi interfeysi, pleyer yorliqlari) ruschasiz.
73. Kabinet ichki matnlari (formalar, tooltiplar) hali ruschasiz (faqat nav/titles tarjima qilingan).
74. Email xabarnomalar faqat o'zbekcha.
75. Sana formatlari ba'zi joylarda uz lokalda ruscha interfeysda ham chiqadi.
76. Xatolik matnlari (zod) global uz — RU foydalanuvchiga ham o'zbekcha 422 keladi.
77. ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): lib/chat/time.ts MONTHS.ru bilan lokallashtiradi — skrinshotda UZ rejim ko'ringan.
78. Telegram bot RU qamrovi yaxshi, lekin /konkurs va /savollar bot javoblari faqat uz.
79. Oferta/maxfiylik sahifalari faqat o'zbekcha.
80. ✅ YOPILDI (2026-11-01): docs/MATN-QOLLANMA.md — tugma/atama/uslub jadvali; yangi matnlar shu bo'yicha yoziladi.

## 9. Tezlik va texnik qarz — 81–90
81. ✱ ✅ YOPILDI (2026-11-02): `lib/img.ts optimizedImg()` — xom <img> saqlangan holda Next optimizatori (/_next/image: resize + WebP, 1x/2x srcSet). AvatarImage va SafeImage(`optimize` prop) orqali: avatarlar, katalog/kurs/guruh kartalari, lenta rasmlari, chat muqovalari. Optimizator xatosida asl manzilga avto-qaytish. Sinov: 139KB JPEG → 3.8KB(128w)/10.8KB(384w) WebP; sahifalarda buzilgan rasm 0.
82. ✱ ✅ YOPILDI (2026-11-01): `listGroupInbox` 60s kesh + bitta arzon faollik tekshiruvi (yangi xabar kelganda o'z-o'zidan eskiradi); `bustGroupInbox` markGroupRead/pref o'zgarishida.
83. Lenta cheksiz scroll o'rniga «Yana ko'rsatish» ba'zi ro'yxatlarda — bir xillik yo'q.
84. Bundle: lucide ikonkalar sahifa-sahifa import qilinadi, lekin DmChat 1800+ qator — bo'laklash (code-split) kerak.
85. SSE chat oqimi serverless'da 60s cheklovda — Redis pub/sub'siz miqyoslanmaydi (100+ faol foydalanuvchida DB tick qimmat).
86. ✅ YOPILDI (2026-11-01): scripts/e2e/{_lib,konkurs,savollar,inbox}.mjs — demo-login bilan (jar'siz ham), CI'da «E2E oqim testlari» qadami (CRON_SECRET ham qo'shildi).
87. Lighthouse o'lchovi muntazam emas — perf regressiyani hech narsa ushlamaydi.
88. ✅ YOPILDI (2026-11-01): scripts/restart-dev.sh repoda (yetim jarayonlarni to'xtatadi, .next tozalaydi, dev'ni fonda ishga tushiradi).
89. Xatolar kuzatuvi (Sentry kabi) yo'q — prod xatolar faqat Vercel logida.
90. DB indekslar bor, lekin sekin so'rovlar jurnali/tahlili yo'q (Turso analytics ulanmagan).

## 10. Xavfsizlik, admin va bot — 91–100
91. ✱ ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): `DELETE /api/auth/sessions` + SecurityPanel «Barcha qurilmalardan chiqish» tugmasi mavjud (sessionVersion bump + joriy qurilmaga yangi cookie).
92. ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): /admin/audit sahifasi (filtr, sahifalash, CSV) mavjud.
93. Spam-filtr faqat matnga — rasm-spam (bir xil rasmni ko'p joylash) ushlanmaydi.
94. Foydalanuvchi ma'lumot eksporti JSON — o'qiladigan HTML/PDF varianti yo'q.
95. ✅ ALLAQACHON BOR (tekshirildi 2026-11-01): 2FA zaxira kodlari mavjud (`/api/auth/2fa/recovery`, `users.recoveryCodes` xeshlangan, login'da qabul qilinadi, SecurityPanel'da qolgan soni + yangilash).
96. ✅ YOPILDI (2026-11-01): 429 xabarining o'zida kutish vaqti («N soniyadan/daqiqadan keyin…») — barcha UI'larda avtomatik ko'rinadi.
97. Bot: guruh ichida ishlamaydi (faqat private) — jamoa guruhiga ulab e'lon qilish imkoni yo'q.
98. Bot to'lov cheki rasmini admin rad etsa — foydalanuvchiga sabab yozish maydoni yo'q (standart matn).
99. Admin panelda «foydalanuvchi sifatida ko'rish» (impersonate, faqat o'qish) yo'q — supportda qiyin.
100. Ikki admin bir vaqtda bitta shikoyatni ko'rsa — qulf/band belgisi yo'q (ikki marta ishlov xavfi).
