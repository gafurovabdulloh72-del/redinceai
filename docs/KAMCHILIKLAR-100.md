# 100 ta kamchilik — mavzular bo'yicha audit (2026-11-01)

Platformaning hozirgi holatini halol baholash. Har band — aniq, tekshirilgan yoki kod/UX tahlilidan kelib chiqqan kamchilik. «Kamchilik» = foydalanuvchi sezadigan muammo, yetishmayotgan funksiya yoki texnik qarz. ✱ belgisi — eng muhim 20 tasi.

## 1. Chat (yangi Telegram inbox) — 1–10
1. ✱ Guruh/kanal qatori bosilganda sahifaga o'tiladi — Telegram'dagidek o'ng panelda ochilmaydi (desktopda chat panel ichida GroupChat embed qilinsa to'liq messenjer bo'ladi).
2. Kanal qatori kanal sahifasiga olib boradi, lekin «oxirgi postni o'qish» holatiga avtomatik tushmaydi.
3. Guruh qatorlarida «yozmoqda…» ko'rsatkichi yo'q (DM'da bor, guruh typing API mavjud — ulash qoldi).
4. Guruh qatorini telefonda surib (swipe) pin/mute qilib bo'lmaydi — faqat DM'da ishlaydi.
5. Guruh uchun mute tugmasi chat ro'yxatidagi «⋯» menyusida yo'q (faqat guruh sahifasida).
6. Papkani qayta nomlash yo'q — faqat yaratish/o'chirish (dm_folders PATCH kerak).
7. Papkalar tartibini surib o'zgartirib bo'lmaydi (position ustuni bor, UI yo'q).
8. Arxiv guruh/kanallarga ishlamaydi — faqat DM arxivlanadi.
9. Chat ro'yxatida qidiruv faqat nom/oxirgi xabar bo'yicha — xabarlar ichidan global qidiruv yo'q (Telegram'da bor).
10. Rasmiy kanal o'qilmagani katta songa to'planadi (90 a'zoga har post) — «hammasi o'qildi» tugmasi yo'q.

## 2. Jamoalar va guruh chati — 11–20
11. ✱ Guruh chatida ovozli xabar yo'q (DM'da bor — VoiceRecorder'ni ulash qoldi).
12. Guruh chatida xabarni yo'naltirish (forward) yo'q.
13. Guruh a'zosini «admin qilish» UI bor-u, admin huquqlari ro'yxati (kim nimani qila oladi) hech qayerda tushuntirilmagan.
14. Taklif havolasini QR ko'rinishda ulashib bo'lmaydi.
15. Guruh qoidalarini buzgan xabarni admin o'chirsa — muallifga sabab yuborilmaydi.
16. Yopiq guruhga so'rov yuborganlar kutish holatini ko'rmaydi («so'rov yuborilgan» belgisi bor, «navbatda nechanchisiz» yo'q).
17. Guruh statistikasi faqat 7 kunlik — oy/grafik yo'q.
18. Kanal postlariga reaksiya bor, lekin kanal egasi «kim ko'rdi» sonini post kesimida tahlil qila olmaydi (post-stats bor, kanal kesimida jamlama yo'q).
19. Guruhda so'rovnoma (poll) faqat efirda bor — oddiy chatda yo'q.
20. Guruh eventlari (efir e'loni) kalendarga qo'shish .ics faqat ba'zi joylarda — guruh sahifasida tugma yo'q.

## 3. Mentorlik — 21–30
21. ✱ Video pleyerda sifat tanlash yo'q (bitta oqim; HLS/transcoding yo'q — katta videolar sekin ochiladi).
22. ✱ Dars videosini yuklab olishdan himoya yo'q (to'g'ridan URL; imzolangan vaqtli havola kerak).
23. Kurs sertifikatida QR tekshiruv havolasi bor-u, sertifikat dizayni bitta — mentor logosi qo'shilmaydi.
24. Kursni ulushlab to'lash (bo'lib to'lash) yo'q.
25. Dars izohlari (savol-javob) mentor javob berganda talabaga push boradi, lekin dars sahifasida «yangi javob» belgisi yo'q.
26. Kurs qoralama/chop etish oqimida oldindan ko'rish («talaba ko'zi bilan») tugmasi yo'q.
27. Mentor daromad grafigi yo'q — faqat ro'yxat (oylik diagramma kerak).
28. 1:1 konsultatsiya slotlari vaqt zonasi haqida ogohlantirmaydi (hammasi Toshkent deb olinadi).
29. Kurs tugatganlarga «keyingi kurs» tavsiyasi avtomatik chiqmaydi (yo'l xaritasi bor, bitirganda taklif yo'q).
30. Bepul namuna darsni ulashish uchun alohida havola yo'q (marketing uchun kerak).

## 4. Profil va ijodkorlar katalogi — 31–40
31. ✱ Portfolio video muqovasini tanlamasa — qora plitka; avtomatik kadr olish yo'q.
32. Profil ko'rishlar statistikasi egasiga kunlik grafik bilan ko'rsatilmaydi (bitta son xolos).
33. Ijodkor o'z profilini PDF/portfolio fayl sifatida eksport qila olmaydi.
34. Katalogda «onlayn» filtri bor-u, «bugun javob bergan» kabi ishonch signali yo'q.
35. Sharhlarga ijodkor javobi bor, lekin sharhni foydali deb belgilash yo'q.
36. Profil highlights (saralangan storylar) muqovasini o'zgartirib bo'lmaydi — birinchi kadr olinadi.
37. Ish (portfolio) sahifasida «buyurtma berish» yo'li kontakt sotuvi rejimida tushunarsiz — CTA «kontaktni ochish»ga olib bormaydi.
38. Taqqoslash (/taqqoslash) PROFILE_HIRING=false rejimida ham narxsiz ustunlar bilan chiqadi — chalkash.
39. Username o'zgartirilganda eski @username havolalari 404 (redirect tarixi saqlanmaydi).
40. Profil QR-kartochka (vizitka) generatori yo'q — oflayn tadbirlar uchun foydali.

## 5. Qidiruv va SEO — 41–50
41. ✱ Qidiruvda xato yozilgan so'zlar tuzatilmaydi («montaj» ↔ «mantaj») — fuzzy yo'q.
42. ⌘K global qidiruv telefonda yo'q (faqat /qidiruv sahifasi).
43. Qidiruv tarixi/so'nggi so'rovlar saqlanmaydi.
44. Savol-javob (/savollar) sahifalari uchun JSON-LD (QAPage) yo'q — Google rich natija chiqmaydi.
45. Konkurs sahifalarida OG rasm generatsiyasi yo'q (ulashganda oddiy logo chiqadi).
46. Sitemap'da /savollar va /konkurs yo'q.
47. Kurs video darslariga VideoObject JSON-LD yo'q.
48. Blog/maqolalar bo'limi umuman yo'q — SEO uchun eng katta o'sish nuqtasi.
49. Ichki 404 sahifasida qidiruv maydoni yo'q — boshi berk.
50. RU sahifalar uchun hreflang teglari yo'q.

## 6. To'lovlar va pul — 51–60
51. ✱ Payme/Click prod kalitlari hali ulanmagan — real to'lov faqat qo'lda o'tkazma orqali.
52. To'lov chekini PDF yuklab olish yo'q (sahifa bor, print xolos).
53. Promokod faqat mentorlik uchun — obuna va kontakt ochishga ishlamaydi.
54. Hisob-faktura muddati tugashi haqida eslatma bor, lekin «to'lov kutilmoqda» banneri kabinet bosh sahifasida chiqmaydi.
55. Qaytarish (refund) so'rovini foydalanuvchi o'zi ocholmaydi — faqat admin orqali.
56. Mentor balansida kutilayotgan (7 kun hold) summalar taqvimda qachon ochilishi ko'rsatilmaydi.
57. Valyuta faqat so'm/$ — kurs sahifasida $ ko'rsatish rejimi yo'q.
58. To'lov usullari sahifasida komissiya/foizlar jadvali yo'q (ishonch uchun kerak).
59. Kontakt ochish narxi profilda ko'rinadi, lekin «nega pullik» tushuntiruv sahifasiga havola yo'q.
60. Hisobot (kabinet → hisobot) CSV eksporti faqat adminda — mutaxassisga ham kerak.

## 7. Telefon UX va ilova hissi — 61–70
61. ✱ PWA push bor, lekin o'rnatish taklifi (A2HS) faqat bannerda — onboarding qadamida yo'q.
62. Pastki tab'da uzun bosish (long-press) tezkor amallar menyusi yo'q (masalan Yaratish → Post/Story).
63. Reels'da «ulashish» Instagram'dagidek pastki varaq emas — ba'zi joylarda eski dialog.
64. Rasmlar lightbox'ida «saqlash» tugmasi yo'q.
65. Shakllarda klaviatura «Enter → keyingi maydon» xatti-harakati hamma joyda emas.
66. Offline holat sahifasi yo'q — internet uzilsa oq ekran/xato.
67. Skelet yuklagichlar hamma ro'yxatlarda emas (savollar, konkurs — spinner ham yo'q, kontent sakraydi).
68. Haptik faqat ba'zi amallarda — like/pin/yuborishda bir xil emas.
69. Telefonda «tepaga qaytish» tugmasi uzun ro'yxatlarda yo'q (faol tabni qayta bosish ishlaydi, lekin buni hech kim bilmaydi — hint yo'q).
70. Katta rasmlarga blur-up placeholder yo'q — sekin internetda oq bo'shliqlar.

## 8. Til (RU) va matnlar — 71–80
71. ✱ Konkurs, Savol-javob, Konkurs bot buyruqlari — faqat o'zbekcha (RU lug'at yozilmagan).
72. Mentorlik ichki sahifalari (kurs tavsifi interfeysi, pleyer yorliqlari) ruschasiz.
73. Kabinet ichki matnlari (formalar, tooltiplar) hali ruschasiz (faqat nav/titles tarjima qilingan).
74. Email xabarnomalar faqat o'zbekcha.
75. Sana formatlari ba'zi joylarda uz lokalda ruscha interfeysda ham chiqadi.
76. Xatolik matnlari (zod) global uz — RU foydalanuvchiga ham o'zbekcha 422 keladi.
77. «18-oktabr» kabi qisqa sanalar RU rejimida tarjima qilinmaydi (chat ro'yxati).
78. Telegram bot RU qamrovi yaxshi, lekin /konkurs va /savollar bot javoblari faqat uz.
79. Oferta/maxfiylik sahifalari faqat o'zbekcha.
80. Ba'zi tugmalarda matn uslubi aralash («Bekor» vs «Bekor qilish») — matn qo'llanmasi (glossary) yo'q.

## 9. Tezlik va texnik qarz — 81–90
81. ✱ Rasm optimizatsiyasi o'chirilgan oqimlar bor (xom <img> ko'p joyda) — next/image yoki CDN resize kerak.
82. ✱ Guruh inbox so'rovi har ro'yxat yangilanishida 4-5 so'rov — keshlash (60s) yo'q.
83. Lenta cheksiz scroll o'rniga «Yana ko'rsatish» ba'zi ro'yxatlarda — bir xillik yo'q.
84. Bundle: lucide ikonkalar sahifa-sahifa import qilinadi, lekin DmChat 1800+ qator — bo'laklash (code-split) kerak.
85. SSE chat oqimi serverless'da 60s cheklovda — Redis pub/sub'siz miqyoslanmaydi (100+ faol foydalanuvchida DB tick qimmat).
86. E2E testlar /tmp'da — repoga scripts/ ichiga ko'chirilmagani uchun CI'da yurmaydi (konkurs/qa/inbox).
87. Lighthouse o'lchovi muntazam emas — perf regressiyani hech narsa ushlamaydi.
88. Dev/prod .next almashinuvi qo'lda — bitta buyruqli skript (restart-dev.sh) repoda emas, scratchpad'da.
89. Xatolar kuzatuvi (Sentry kabi) yo'q — prod xatolar faqat Vercel logida.
90. DB indekslar bor, lekin sekin so'rovlar jurnali/tahlili yo'q (Turso analytics ulanmagan).

## 10. Xavfsizlik, admin va bot — 91–100
91. ✱ Session'larni qurilma bo'yicha yakka tugatish bor, «hammasidan chiqish» tugmasi yo'q.
92. Admin amallari auditi bor, lekin admin panelda audit jurnalini ko'rish UI yo'q.
93. Spam-filtr faqat matnga — rasm-spam (bir xil rasmni ko'p joylash) ushlanmaydi.
94. Foydalanuvchi ma'lumot eksporti JSON — o'qiladigan HTML/PDF varianti yo'q.
95. 2FA zaxira kodlari yo'q — telefon yo'qolsa hisob qulflanadi.
96. Rate-limit javoblarida Retry-After bor, lekin UI «qachon qayta urinish» taymerini hamma joyda ko'rsatmaydi.
97. Bot: guruh ichida ishlamaydi (faqat private) — jamoa guruhiga ulab e'lon qilish imkoni yo'q.
98. Bot to'lov cheki rasmini admin rad etsa — foydalanuvchiga sabab yozish maydoni yo'q (standart matn).
99. Admin panelda «foydalanuvchi sifatida ko'rish» (impersonate, faqat o'qish) yo'q — supportda qiyin.
100. Ikki admin bir vaqtda bitta shikoyatni ko'rsa — qulf/band belgisi yo'q (ikki marta ishlov xavfi).
