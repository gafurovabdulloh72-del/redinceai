# Redince — kamchiliklar va g'oyalar ro'yxati

> Bu fayl loyihaning "xotirasi": topilgan kamchiliklar, tuzatilganlari (✅) va kelgusi g'oyalar.
> Yangilangan: 2026-10-10

## A. 100 ta kamchilik (texnik / mahsulot)

### Xavfsizlik
1. Portfolio URL'ida `javascript:`/`data:` sxemalari — ✅ validatorda tuzatildi (rel="noopener" tekshiruvi ochiq)
2. `?next=` orqali ochiq redirect (`/\evil.com`) — ✅ tuzatildi
3. Upload'da MIME mijozdan — ✅ magic-bytes tekshiruvi qo'shildi
4. Upload'da foydalanuvchi boshiga kvota yo'q
5. `/uploads/[name]` javobida `X-Content-Type-Options: nosniff` yo'q
6. Rate limiting yo'q (login/registratsiya brute-force)
7. CSRF token yo'q (faqat SameSite=Lax)
8. JWT 30 kun, bekor qilish (revocation) yo'q
9. Parolni o'zgartirish/tiklash yo'q
10. Email tasdiqlash yo'q
11. Demo hisoblar (admin paroli) login sahifasida ochiq, o'chirish bayrog'i yo'q
12. `avatarUrl` sxema tekshiruvisiz
13. Health endpoint xom xato matnini chiqaradi
14. Admin audit log yo'q
15. Security headerlar (CSP, HSTS, Referrer-Policy) yo'q

### Auth va sessiya
16. Bazada yo'q foydalanuvchi cookie'si → cheksiz redirect — ✅ tuzatildi
17. Kirgan foydalanuvchi `?next=`ni yo'qotardi — ✅ tuzatildi
18. Rol JWT ichida — admin rolni olsa ham 30 kun eski rol ishlaydi
19. "Meni eslab qolish" tanlovi yo'q
20. Google/Telegram login yo'q
21. Telefon normalizatsiyasi (+998) zaif
22. "Barcha qurilmalardan chiqish" yo'q
23. Login sahifasida "nega keldingiz" konteksti yo'q
24. Parol kuchi ko'rsatkichi yo'q, min 6 belgi kam

### Baza va API
25. Qidiruvda `%`/`_` wildcard ekranlanmagan
26. Profil sahifasida og'ir so'rov 2 marta (generateMetadata + page)
27. `getCurrentUser` 3 marta — ✅ cache() bilan tuzatildi
28. Ko'rishlar hisoblagichi egasi/botlar uchun ham oshadi
29. Ommaviy API ichki ID'larni sizdirardi — ✅ tuzatildi
30. Migratsiya tizimi yo'q (`push --force` xavfli)
31. Offset pagination (cursor yo'q)
32. Full-text qidiruv va kirill↔lotin transliteratsiya yo'q
33. Buyurtma holati tarixi saqlanmaydi
34. Sharh o'chirish yo'q, reyting qayta hisoblanmaydi
35. API versiya/OpenAPI yo'q
36. Xatolar monitoringi (Sentry) yo'q
37. Seed ma'lumotlari uydirma (picsum/pravatar)
38. Backup strategiyasi yo'q

### Xarita
39. Panel rejimida yorliqlar ustma-ust (kollziya yo'q)
40. Mobilda kichik hududlar bosish uchun juda kichik
41. SVG `role="img"` — ichidagi tugmalar AT uchun yashirin
42. Qorong'u rejimda kam sonli hududlar loyqa jigarrang
43. Ikki xarita bir bosishga turlicha javob beradi
44. Zoom/pan yo'q
45. Tuman darajasi yo'q
46. Geolokatsiya yo'q
47. Touch'da tooltip chiqmaydi
48. Bosh sahifada tanlov URL'ga yozilmaydi
49. Xarita path'lari keshlanmaydi
50. "Jonli" deyilgan, real vaqt yo'q

### Dizayn va UI
51. Kartada rasm yuklanmasa buzilgan-rasm belgisi — ✅ SafeImage
52. "Kim kerak?" bento katta plitka 70% bo'sh
53. `/xarita` desktop chap ustun ~800px bo'sh
54. Kabinet "So'nggi buyurtmalar" bo'sh cho'ziladi
55. Auth chap paneli improvizatsiya
56. Sarlavhalar bosh sahifa uslubiga mos emas (qisman ✅)
57. Accent CTA faqat bosh sahifada
58. Eski "glass" sinflari qolgan joylar
59. Kartadagi narx 2 qatorga bo'linadi
60. Hero'dagi bosh harfli avatarlar o'qilmaydi
61. Gorizontal qatorlar keskin kesiladi (qisman ✅ scroll-fade)
62. Unbounded'da "0" glifi g'alati
63. Profil muqova/avatar z-index — ✅
64. Hover touch'da yopishib qoladi
65. Skeletonlar hamma joyda emas (qisman ✅)
66. OG rasm yo'q

### Mobil
67. Kabinet 390px'da gorizontal overflow — ✅
68. Mobilda tema almashtirgich yo'q — ✅ (agent qo'shdi)
69. Bosish maydonlari kichik (17–28px)
70. Profil sarlavhasida tasdiq belgisi alohida qatorga tushadi
71. iOS safe-area tekshirilmagan
72. Mobil filtr sheet'ida fokus ichkariga o'tmaydi (qisman ✅)
73. Rasmlar srcset'siz
74. "Xaritani ochish" mobilda sirpanish muammosi

### Accessibility
75. Global :focus-visible yo'q — ✅
76. Yulduz reytinglarida aria nomi yo'q
77. Lightbox/menyu fokus tutilmaydi — qisman ✅ useFocusTrap
78. Parolni ko'rsatish tugmasi tabIndex=-1
79. Kategoriya pill'lari noto'g'ri role="tab"
80. Avatarlar ismni 2 marta e'lon qiladi
81. `tel:` havolalar target=_blank
82. Nisbiy vaqt `<time dateTime>`siz

### UX oqimlari
83. Mijoz "Mutaxassis bo'lish" → 403 — ✅
84. Yangi mutaxassis darhol ommaviy — ✅
85. Ism o'zgarsa slug o'zgarardi — ✅
86. Buyurtma haqida bildirishnoma yo'q (email/Telegram)
87. Ichki chat yo'q
88. Buyurtmaga deep-link yo'q
89. Server xatosidan keyin fokus noto'g'ri maydonga o'tmaydi
90. Sharh uchun "haqiqiy buyurtma" sharti yo'q
91. Rad etish sababi yo'q
92. Salomlashuv UTC bo'yicha edi — ✅ Toshkent vaqti

### Kontent
93. Ko'nikmalarda inglizcha so'zlar
94. Bir sahifa turli nomlar bilan (Sozlamalar/Profil …)
95. Kabinetda uydirma statistika
96. Kirill/rus tili yo'q

### Infratuzilma
97. Avtotestlar yo'q
98. CI yo'q
99. Universal fayl saqlash (S3/R2) yo'q — Vercel Blob/Volume'ga bog'liq
100. Analitika/uptime/xato kuzatuvi yo'q

## B. 50 ta qo'shimcha g'oya (mahsulot)

### Pul va buyurtma
1. Click/Payme/Uzum to'lov + escrow
2. Shartnoma/invoys PDF
3. Xizmat paketlari (Basic/Standard/Premium)
4. Narx kalkulyatori
5. Band kunlar kalendari va bron
6. Buyurtma bosqichlari + progress bar
7. Avans/qoldiq sxemasi
8. Bekor qilish siyosati, sabab bilan rad etish
9. "Yana buyurtma berish"
10. Tender rejimi

### Aloqa
11. Ichki chat
12. Telegram bot bildirishnomalari
13. Email bildirishnomalar
14. SMS OTP (Eskiz/Playmobile)
15. Push (PWA)
16. Javob tezligi ko'rsatkichi
17. WhatsApp/Telegram deep-link'lar

### Ishonch
18. Shaxs tasdiqlash (pasport/selfi)
19. Verified review (faqat bajarilgan buyurtmadan keyin)
20. Sharhga media + mutaxassis javobi
21. Badge tizimi
22. Shikoyat/moderatsiya
23. Nizo/arbitraj
24. Reyting formulasi (Bayes)
25. Oldin/Keyin slayder

### Qidiruv
26. Avtoto'ldirish + transliteratsiya
27. "Yaqinimdagilar" (geolokatsiya)
28. Tuman darajasi + klasterlar
29. Sevimlilar + taqqoslash
30. SEO landing sahifalar (hudud × kasb)
31. Saqlangan filtrlar + obuna
32. Mavjudlik filtri
33. AI tavsiya

### Mutaxassis vositalari
34. Analitika paneli
35. Boost / pullik joylashuv
36. Obuna rejalari (Free/Pro)
37. Video yuklash (Mux/Bunny)
38. QR-vizitka / link-in-bio
39. Jamoa/studiya profillari
40. AI bio yozish
41. Google Calendar sinxron

### Platforma
42. 3 til (lotin/kirill/rus)
43. Referal dastur
44. Blog/yo'riqnomalar
45. Vakansiyalar
46. Kurslar/master-klasslar
47. Mobil ilova (Expo)
48. Ochiq API hamkorlar uchun
49. Kengaytirilgan admin panel
50. A/B test + PostHog
