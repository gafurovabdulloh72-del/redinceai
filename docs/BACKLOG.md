# Redince — kamchiliklar va g'oyalar ro'yxati

> Bu fayl loyihaning "xotirasi": topilgan kamchiliklar, tuzatilganlari (✅) va kelgusi g'oyalar.
> Yangilangan: 2026-10-10

## A. 100 ta kamchilik (texnik / mahsulot)

### Xavfsizlik
1. Portfolio URL'ida `javascript:`/`data:` sxemalari — ✅ validatorda tuzatildi (rel="noopener" tekshiruvi ochiq)
2. `?next=` orqali ochiq redirect (`/\evil.com`) — ✅ tuzatildi
3. Upload'da MIME mijozdan — ✅ magic-bytes tekshiruvi qo'shildi
4. Upload'da foydalanuvchi boshiga kvota yo'q — ✅ kunlik kvota (enforceLimit upload)
5. `/uploads/[name]` javobida `X-Content-Type-Options: nosniff` yo'q — ✅
6. Rate limiting yo'q (login/registratsiya brute-force) — ✅ rate_limits jadvali
7. CSRF token yo'q (faqat SameSite=Lax) — ✅ Origin/Sec-Fetch-Site tekshiruvi
8. JWT 30 kun, bekor qilish (revocation) yo'q — ✅ sessionVersion
9. Parolni o'zgartirish/tiklash yo'q — ✅
10. Email tasdiqlash yo'q
11. Demo hisoblar (admin paroli) login sahifasida ochiq, o'chirish bayrog'i yo'q — ✅ NEXT_PUBLIC_DEMO_ACCOUNTS
12. `avatarUrl` sxema tekshiruvisiz
13. Health endpoint xom xato matnini chiqaradi — ✅
14. Admin audit log yo'q — ✅ /admin/audit
15. Security headerlar (CSP, HSTS, Referrer-Policy) yo'q — ✅

### Auth va sessiya
16. Bazada yo'q foydalanuvchi cookie'si → cheksiz redirect — ✅ tuzatildi
17. Kirgan foydalanuvchi `?next=`ni yo'qotardi — ✅ tuzatildi
18. Rol JWT ichida — admin rolni olsa ham 30 kun eski rol ishlaydi — ✅
19. "Meni eslab qolish" tanlovi yo'q — ✅
20. Google/Telegram login yo'q
21. Telefon normalizatsiyasi (+998) zaif
22. "Barcha qurilmalardan chiqish" yo'q — ✅
23. Login sahifasida "nega keldingiz" konteksti yo'q — ✅
24. Parol kuchi ko'rsatkichi yo'q, min 6 belgi kam — ✅

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
55. Auth chap paneli improvizatsiya — ✅
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
78. Parolni ko'rsatish tugmasi tabIndex=-1 — ✅
79. Kategoriya pill'lari noto'g'ri role="tab"
80. Avatarlar ismni 2 marta e'lon qiladi
81. `tel:` havolalar target=_blank
82. Nisbiy vaqt `<time dateTime>`siz

### UX oqimlari
83. Mijoz "Mutaxassis bo'lish" → 403 — ✅
84. Yangi mutaxassis darhol ommaviy — ✅
85. Ism o'zgarsa slug o'zgarardi — ✅
86. Buyurtma haqida bildirishnoma yo'q (email/Telegram) — ✅ ichki bildirishnomalar API (email/Telegram ochiq)
87. Ichki chat yo'q
88. Buyurtmaga deep-link yo'q — ✅
89. Server xatosidan keyin fokus noto'g'ri maydonga o'tmaydi — ✅
90. Sharh uchun "haqiqiy buyurtma" sharti yo'q
91. Rad etish sababi yo'q — ✅
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
1. Click/Payme/Uzum to'lov + escrow — ✅ Click/Payme + escrow
2. Shartnoma/invoys PDF
3. Xizmat paketlari (Basic/Standard/Premium)
4. Narx kalkulyatori
5. Band kunlar kalendari va bron
6. Buyurtma bosqichlari + progress bar
7. Avans/qoldiq sxemasi
8. Bekor qilish siyosati, sabab bilan rad etish — ✅
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

## C. 100 ta vizual kamchilik (skrinshotlar asosida, 2026-10-10)

### Dizayn tizimi
1. Ikki accent tili aralash: coral (Studio) va iOS-ko'k (tasdiq belgisi, kabinet ikonkalari)
2. Kabinet stat ikonkalari 4 xil yorqin rang (ko'k/sariq/binafsha/yashil) — palitraga yot
3. Kategoriya ranglari (8 ta) umumiy palitra bilan kelishilmagan — "rang bayrami"
4. Rasm yo'q muqovalarda sun'iy gradientlar — sayt "demo" ko'rinadi
5. Gradient tugma (coral→pushti→binafsha) logotip coral'iga 100% mos emas
6. Soyalar yorug'da juda yumshoq, qorong'uda ko'rinmaydi — ierarxiya yo'qoladi
7. Fon to'ri (grid) faqat yuqorida, pastda to'satdan yo'qoladi
8. Fon nur dog'lari ba'zi sahifalarda kontent orqasida chalg'itadi
9. Radiuslar aralash: 14/18/22/24/32px
10. Ikonka o'lchamlari nomuvofiq (12–22px)
11. Chiziqli (lucide) va to'ldirilgan ikonkalar aralash
12. fg-4 rangi yorug'da AA kontrastdan o'tmaydi
13. Unbounded juda keng — uzun so'zlar chekkaga yopishadi
14. Italik serif urg'u tizimli emas (ba'zi sarlavhalarda bor, ba'zilarida yo'q)
15. Vertikal ritm sahifalar orasida har xil (mt-20/28, p-5/6/7/8)

### Navbar / Footer
16. Navbar kapsulasi 1440px'da bo'sh markaz bilan osilib turadi
17. Navbar blur foni yorug'da fon bilan qo'shilib ketadi, chegara yo'q
18. Kirganda avatar kapsulasi "Boshlash" tugmasidan boshqa balandlikda
19. Faol havola ostidagi coral chiziq juda ingichka
20. Pastki tab-bar iOS safe-area bilan tekshirilmagan
21. Tab-bar elementlari kengligi teng emas, faol pill og'ir
22. Footer ustunlari balandligi har xil, "Platforma" ustuni yetim
23. "geoBoundaries" matni foydalanuvchiga ma'nosiz
24. Footer kartasi fondan deyarli farq qilmaydi
25. Logo orqasidagi coral blur kichik o'lchamda dog'ga o'xshaydi

### Bosh sahifa
26. Hero sarlavha 4 qator — CTA birinchi ekrandan tushadi
27. Hero xaritasi matn bilan vertikal markazlashmagan
28. Perspektivali xaritada kichik hududlar va raqam pill'lari o'qilmaydi
29. "kam→ko'p" legenda xaritadan uzilgan, yolg'iz
30. Avatar stack bosh harflari ustma-ust — o'qilmaydi
31. Ishonch qatori tartibsiz 2 qatorga sinadi
32. Marquee chetlari so'nmaydi, keskin kesiladi
33. Marquee sarlavhasiz — nima ekani tushunarsiz
34. Kasb pill'lari o'ngda kesiladi (scroll ishorasi yo'q)
35. Xarita yorliqlari (Samarqand/Jizzax/Sirdaryo/Toshkent sh.) ustma-ust
36. Yon panel "Eng faol hududlar" ostida bo'sh joy
37. "Kim kerak?" katta plitka 70% bo'sh
38. Bento ikonkalari 8 xil rang — ko'z charchaydi
39. Tavsiya kartalari gradientlari bir-biridan ajralmaydi
40. "Uch qadam" kartalari tekis va zaif
41. 14 ta hudud chipi tartibsiz sinadi
42. CTA bloki qorong'uda yorug'ga inversiya — kutilmagan
43. CTA'dagi kontur tugma deyarli ko'rinmaydi
44. Sahifa 6200px — takrorlanuvchi ro'yxatlar
45. "Jonli xarita" pill'i yolg'iz, "jonli"lik ko'rinmaydi

### Ro'yxat
46. Sticky filtr paneli 1440px'da ham kesiladi
47. Narx slayderi bitta tutqich, "Cheklanmagan" osilgan
48. "Tasdiqlanganlar" switch boshqa filtrlardan uslubi farq qiladi
49. 16:10 muqova juda baland — ekranga 1.5 qator sig'adi
50. Ism qisqartiriladi ("Nargiza Jo'ra…")
51. Narx 2 qatorga bo'linib yulduzlarni siqadi
52. "Band" va kategoriya chiplari muqova yuqorisini band qiladi
53. "+2" ko'nikma chipi bosilmaydi, ma'lumot bermaydi
54. Pagination raqamlari kichik
55. Saralash select'i va natija soni bog'lanmagan

### Profil
56. Gradient muqova "demo" hissi beradi
57. Tasdiq belgisi ism oxirida yolg'iz; avatar muqova chetidan chiqadi
58. Meta chiplar bir xil kulrang — ahamiyat farqlanmaydi
59. "Ulashish" tugmasi kontekstsiz
60. Narx kartasi/CTA sticky emas — pastda yo'qoladi
61. Portfolio masonry notekis, bo'sh joylar
62. Portfolio plita nomlari kichik, ikonka zaif
63. 1 ta sharh bilan bo'lim bo'sh; reyting ikki marta takrorlanadi
64. "Kirish" qora pill asosiy CTA bilan raqobatlashadi
65. "O'xshash" kartalar asosiy ro'yxatdan farq qilmaydi
66. Breadcrumb juda kichik va och

### Xarita sahifasi
67. Chap ustun ostida ~800px bo'shliq
68. Hudud chiplari o'ngda kesiladi
69. Tanlangan hudud binafsha, qolganlari coral — ikki rang tili
70. Ro'yxatda narx 2 qator, "NARX" yorlig'i ortiqcha
71. Kasb pill'lari 3 qatorga sinadi — og'ir
72. "Reyting bo'yicha saralangan" va CTA hizalanmagan

### Auth
73. Chap panelda chiplar tasodifiy "suzadi", katta bo'shliq — ✅
74. "bir xaritada" gradient matn — eski uslub — ✅
75. Pastel pushti→binafsha fon palitraga mos emas — ✅
76. Rol kartalari ikonkalari turli uslubda — ✅
77. Demo havolasi coral — CTA bilan raqobat — ✅
78. Forma va panel balandligi teng emas — ✅

### Kabinet
79. MOBILDA 629px'ga cho'ziladi — gorizontal siljish, kontent kesiladi (tasdiqlangan) — ✅
80. Sidebar sticky emas
81. "So'nggi buyurtmalar" bo'sh oq quti (~350px)
82. Stat ikonkalari "o'yinchoq" ranglar
83. "Reyting —" chiziqcha g'alati
84. "Tezkor amallar" 6 ta bir xil pill — ustuvorlik yo'q
85. Holat kartasi ranglari aniq emas
86. Buyurtmalar toq bo'lsa o'ngda bo'shliq — ✅
87. Telefon chipi coral — CTA bilan chalkashadi — ✅
88. "Rad etish" matn vs "Qabul qilish" pill — uslub farqi — ✅
89. Portfolio "Ochish" 17px; o'chirish doirasi og'ir
90. Profil formasi 3700px bitta ustun, progress yo'q

### Admin
91. 20 qator × 3 tugma — shovqin — ✅
92. "20 ta tekshiruvda" coral — xato kabi ko'rinadi — ✅
93. "Boshqaruv markazi" italik — admin uchun ortiqcha — ✅
94. Rol yorliqlari ma'nosi noaniq — ✅
95. Mobil kartalarda ustun sarlavhalari yo'qoladi — ✅

### Qorong'u rejim
96. Xarita loyqa jigarrang
97. Kartalar fon bilan qo'shiladi — chegara ingichka
98. CTA bloki katta oq to'rtburchak
99. Gradient muqovalar juda yorqin
100. Soyalar yo'q — chuqurlik hissi yo'q

## D. 100 ta vizual qo'shimcha g'oya

### Dizayn tizimi
1. Figma/Storybook dizayn-tokenlar hujjati
2. Bitta accent + neytral palitra, kategoriya ranglari pastel/monoxrom
3. 8px spacing grid
4. 3 darajali radius tizimi (12/20/28)
5. 3 darajali soya tizimi (ikkala rejim uchun)
6. Ikonka 2 o'lcham (16/20) qoidasi
7. Tipografika shkalasi (8 daraja) va qat'iy ishlatish qoidasi
8. Motion tokenlari (davomiylik/easing)
9. Yagona focus-ring uslubi
10. Maxsus illyustratsiya to'plami (bo'sh holatlar, 404, onboarding)
11. Brendga xos ikonka to'plami (kategoriyalar uchun)
12. Skeleton tizimi har bir komponent uchun
13. Toast/snackbar tizimi
14. Badge/chip tizimi (holat ranglari semantik)
15. Grafik/diagramma uslubi (kabinet, admin)

### Navbar / Footer
16. Navbar max-w bilan ixcham, scroll'da kichrayadi
17. Mobilda "Buyurtma berish" suzuvchi FAB (profil sahifasida)
18. Footer ixchamlashtirish, 2 qatorli
19. Til almashtirgich (UZ/ЎЗ/RU)
20. Footer'da Telegram/Instagram ikonkalari
21. "Yuqoriga" tugmasi uzun sahifalarda
22. Breadcrumb barcha ichki sahifalarda, kattaroq

### Bosh sahifa
23. Real foto/video hero (ijodkorlar ish jarayoni)
24. Hero'da qidiruv maydoni + hudud dropdown
25. Animatsiyali hisoblagich raqamlar (58 → count-up)
26. Xaritada hover'da hudud nomi va soni kattaroq
27. "Qanday ishlaydi" interaktiv (scroll'da bosqich yonadi)
28. Mijozlar fikri karuseli (foto + iqtibos)
29. Hamkor brendlar logolari qatori
30. FAQ accordion
31. "Yangi qo'shilganlar" jonli lenta
32. Kategoriya kartalarida foto fon
33. "Hafta mutaxassisi" bloki
34. Video showreel (portfolio montaji)
35. Mobilda sticky "Xaritani ochish" CTA
36. Scroll progress indikatori
37. Hero'dagi marquee'ga sarlavha va so'nuvchi chetlar
38. Bento'da katta plitkaga foto/stat
39. Hududlar chiplari o'rniga mini-xarita + ro'yxat
40. Dark CTA blokini ikkala rejimda ham qorong'u qilish

### Ro'yxat
41. Ro'yxat/grid ko'rinish almashtirgich
42. Karta hover'da portfolio mini-preview (3 rasm)
43. "Tez ko'rish" modal (quick view)
44. Saralash chip'lar sifatida
45. Ikki tutqichli narx slayderi
46. Filtr soni badge ("3 ta filtr")
47. Saqlangan filtrlar
48. Ro'yxat yonida kichik xarita (split view)
49. "Yangi" badge (7 kun ichida qo'shilgan)
50. Taqqoslash checkbox + panel
51. Cheksiz scroll + "Yana yuklash"
52. Karta muqovasini 4:3 qilib, ismni to'liq ko'rsatish

### Profil
53. Sticky narx/CTA karta (desktop) va pastki bar (mobil)
54. Lightbox'da YouTube/Instagram video
55. Tab'lar: Portfolio / Sharhlar / Haqida
56. Tasdiq belgisi tooltip ("Shaxsi tasdiqlangan")
57. Band kunlar kalendari
58. Xizmat paketlari kartalari (3 ta)
59. "Javob vaqti: ~1 soat" indikatori
60. Ijtimoiy isbot qatori (buyurtmalar soni, takroriy mijozlar)
61. Ulashish sheet (Telegram, nusxa, QR)
62. Muqova parallaks
63. "Ish jarayoni" timeline (brif → montaj → topshirish)
64. Portfolio uchun bir xil nisbatli grid + "Oldin/Keyin"
65. Sharhlar uchun reyting taqsimoti (5★ 60%, 4★ 30%…)
66. "Ushbu mutaxassisni ko'rganlar yana ko'rdi" bloki

### Xarita
67. Zoom/pan + "Farg'ona vodiysi" lupa
68. Mini-xarita navigatori
69. Tuman darajasi (drill-down)
70. Klaster markerlar (son bilan)
71. Hudud hover'da yon karta (top-3 mutaxassis)
72. Hududlar orasida animatsiyali o'tish
73. Interaktiv legenda (bosib filtrlash)
74. Heatmap rejimi
75. "Mening joylashuvim" tugmasi
76. Hudud bosilganda zoom-in animatsiya

### Kabinet
77. Onboarding checklist + progress ring (profil 60% to'ldirilgan)
78. Statistika sparkline'lari (ko'rishlar 7 kun)
79. Bildirishnomalar qo'ng'irog'i + dropdown — ✅
80. Buyurtmalar kanban ko'rinishi
81. Buyurtma tafsilot drawer'i (sahifadan chiqmasdan)
82. Chat paneli
83. Faollik timeline
84. Avatar kesish (cropper)
85. Muqova muharriri (joylashuv/zoom)
86. Portfolio drag&drop tartiblash
87. Mobil kabinet uchun alohida ixcham layout
88. Bo'sh holatlar uchun illyustratsiya + CTA

### Auth
89. Telegram/Google tugmalari
90. Ro'yxatdan o'tish stepper (3 qadam)
91. Chap panelda real illyustratsiya/foto
92. Parol kuchi indikatori

### Admin
93. Filtr/qidiruvli data-table
94. Ommaviy amallar (bulk)
95. Diagrammalar (ro'yxatdan o'tish, buyurtmalar dinamikasi)
96. Moderatsiya navbati kartalari (oldindan ko'rish bilan)

### Qorong'u rejim va harakat
97. Qorong'u xarita palitrasi (ko'k-kulrang asos, coral urg'u)
98. Sahifalar orasida yumshoq o'tish animatsiyasi
99. "Harakatni kamaytirish" sozlamasi
100. Vaqtga qarab avtomatik rejim (kechqurun Noir)

## E. 100 ta kamchilik (3-raund tekshiruvi, 2026-10-11)

Manba: 6 mustaqil tekshiruvchi (auth, IDOR, to'lov, maxfiylik, to'g'rilik, backlog) + qo'lda tahlil. ✅ — tuzatilgan.

### Xavfsizlik (auth/sessiya)
1. ✅ Parol tiklash havolasi X-Forwarded-Host sarlavhasidan quriladi — havolani zaharlash mumkin
2. ✅ CSRF Origin tekshiruvi ham shu soxta sarlavhaga ishonadi
3. ✅ Production'da birinchi deploy demo va admin akkauntlarni standart parollar bilan seed qiladi
4. ✅ Demo kirish ma'lumotlari client bundle'ga kiradi (AuthForm)
5. ✅ .env.example dagi AUTH_SECRET placeholder production'da qabul qilinadi
6. ✅ 16 belgidan qisqa AUTH_SECRET indamay e'tiborsiz qoladi, Turso token fallback'iga tushadi
7. ✅ JWT algoritmi (HS256) jwtVerify'da pin qilinmagan
8. ✅ Login lockout X-Forwarded-For birinchi qiymatiga bog'liq — spoof/rotatsiya bilan chetlab o'tiladi
9. ✅ Proksi sarlavhasi bo'lmasa hamma foydalanuvchi bitta "local" limit bucket'ida
10. ✅ CSP script-src 'unsafe-inline' — XSS himoyasi amalda yo'q
11. ✅ connect-src/img-src uchun blanket https: — ma'lumot chiqarib yuborish kanali ochiq
12. ✅ Logout JWT'ni bekor qilmaydi — nusxalangan cookie 30 kun ishlaydi
13. ✅ GET /api/auth/logout — boshqa saytdan majburiy chiqish vektori
14. ✅ Reset so'rovi vaqti mavjud/mavjud bo'lmagan email uchun farq qiladi (timing oracle)
15. Register 409 bilan email mavjudligini oshkor qiladi
16. ✅ Reset tokenni iste'mol qilish atomik emas (check-then-update)
17. ✅ Parol o'zgarganda eski reset tokenlar bekor qilinmaydi
18. ✅ Upload butun body'ni xotiraga o'qib, keyin 5 MB tekshiradi
19. ✅ JWT fallback kaliti xom Turso token (kalitni qayta ishlatish)
20. ✅ Email tasdiqlash yo'q — "ro'yxatdan o'tganlarga" darajasi tashlanma akkauntga ham ochiq
21. ✅ PUT /api/profile va /api/privacy uchun per-user rate limit yo'q
22. ✅ 2FA (TOTP) yo'q — admin akkaunt faqat parol bilan
23. ✅ Faol sessiyalar ro'yxati yo'q — faqat "hammasidan chiqish"

### Ruxsat va maxfiylik
24. ✅ GET /api/orders mutaxassisning to'liq qatorini qaytaradi (yashirin Instagram, jadval, sozlamalar, userId)
25. ✅ GET /api/orders mijozning akkaunt telefonini mutaxassisga beradi (mijoz tanlagan raqamdan tashqari)
26. ✅ Jins filtri oracle: gender=hidden bo'lsa ham ?gender= bo'yicha topiladi
27. ✅ Matnli qidiruv yashirin shaharni fosh qiladi (LIKE city)
28. ✅ /buyurtma/[id] aniq shaharni ko'rsatadi, city visibility e'tiborsiz
29. ✅ O'xshash mutaxassislar ro'yxati viewer isOwner/hasOrder kontekstini boshqalarga ham qo'llaydi
30. ✅ Viewer'ga bog'liq JSON javoblarda Cache-Control: private / Vary: Cookie yo'q
31. ✅ Sharhni buyurtmasiz istalgan akkaunt yoza oladi — reyting manipulyatsiyasi
32. Admin mutaxassisni o'chirsa eskrou to'lovlari va payoutlar kaskad bilan yo'qoladi
33. ✅ Sharhni o'chirish yo'q; reyting qayta hisoblanmaydi
34. ✅ Akkauntni o'chirish va ma'lumotlarni eksport qilish (GDPR) yo'q
35. ✅ Email o'zgartirish tasdiqsiz

### To'lov va eskrou
36. ✅ Buyurtma bekor qilinganda Payme/Click jarayondagi tranzaksiya bir tomonlama bekor qilinadi (protokol buzilishi)
37. ✅ Ichki bekor qilish provider_state=1 qoldiradi — CheckTransaction/GetStatement bekor tranzaksiyani faol deb ko'rsatadi
38. ✅ Payme CreateTransaction va Click Prepare boshqa provayderning jarayondagi tranzaksiyasini tekshirmaydi
39. ✅ To'lov mijoz ishni qabul qilgandan keyin tushsa eskrou tiqilib qoladi (release tugmasi yo'q)
40. ✅ Narx o'zgarishi mijoz "To'ladim" degan o'tkazmani bekor qiladi — admin tasdiqlay olmaydi
41. ✅ Payme CancelTransaction ish topshirilgan (done) buyurtmada ham pulni qaytaradi
42. ✅ Bekor qilingan to'lovda "Qayta urinish" redirect loop
43. ✅ Admin payout tasdiqlashdagi balans tekshiruvi tavtologiya (hech qachon ishlamaydi)
44. ✅ markPaid/releaseOrder holatga shartlanmagan — parallel Perform ikki marta audit/bildirishnoma yozadi
45. ✅ Payme noto'lanadigan buyurtma uchun -31001 qaytaradi, -31050 bo'lishi kerak
46. ✅ Bekor qilingan buyurtmada narx qoladi va "Eskrou orqali xavfsiz to'lov" izohi chiqadi
47. ✅ Admin "Platforma daromadi" eskroudagi (qaytarilishi mumkin) komissiyani ham daromad deb sanaydi
48. ✅ Mijoz qabul qilgan buyurtmani to'lashi mumkin, keyin pul chiqarish tugmasi yo'q
49. ✅ Mutaxassis narxsiz buyurtmani "done" qilsa narx hech qachon qo'yilmaydi (eskrou yopiq)
50. ✅ Refund qilingan buyurtmada "Ishni qabul qilish" ko'rinadi va noto'g'ri bildirishnoma ketadi
51. ✅ "To'ladim" (manual pending) holati buyurtma kartasida ko'rinmaydi
52. ✅ To'lov tarixidan /tolov/[id] sahifasiga havola yo'q
53. ✅ Admin refund/cancel sababi UI'dan yuborilmaydi
54. ✅ Payme pending tranzaksiya faqat Payme so'raganda eskiradi — fon tozalash vazifasi yo'q
55. ✅ Payout rekvizitlari faqat maskalangan holda saqlanadi — admin to'liq karta raqamini ko'rmaydi
56. ✅ Nizo (dispute) jarayoni yo'q — faqat adminga bildirishnoma
57. ✅ Avtomatik release (mijoz N kun javob bermasa) yo'q
58. Qisman/milestone to'lovlar yo'q
59. ✅ Hisob-faktura/chek PDF yo'q
60. Real Payme/Click kassasi ulanmagan (test rejimi)

### To'g'rilik va ma'lumotlar
61. ✅ Portfolio sortOrder o'chirishdan keyin kolliziya qiladi; kabinet va profil tartibi farq qiladi
62. ✅ API'da noto'g'ri region/category/experience 0 natija, boshqa enum'lar 422
63. ✅ Ro'yxat sahifasi priceMin'ni ikki marta parse qiladi
64. ✅ Yuklangan rasm URL'lari window.location.origin bilan saqlanadi (domen o'zgarsa buziladi)
65. ✅ formatPrice 999 500–999 999 uchun "1000 ming so'm" deydi
66. ✅ vacationUntil o'tgan sana server tomonda qabul qilinadi
67. ✅ Sharh rate limiti validatsiyadan oldin sarflanadi
68. ✅ Bekor qilish sababi faqat bildirishnoma matnida saqlanadi — UI yo'q
69. ✅ Telefon +998 formatiga normalizatsiya qilinmaydi
70. ✅ Kirill qidiruv ishlamaydi (transliteratsiya jadvali bor, ishlatilmaydi)
71. ✅ notify() email yubormaydi (Resend ulangan, faqat parol tiklashda)
72. Bosh sahifa xarita tanlovi URL'ga yozilmaydi — ✅ ?region=&category=&gender=#xarita (history.replaceState, Suspense ichida)
73. ✅ Bir nechta joyda nisbiy vaqt <time dateTime>siz
74. ✅ Buyurtma holati tarixi saqlanmaydi
75. ✅ rate_limits va audit_logs jadvallari tozalanmaydi (cheksiz o'sadi)
76. ✅ Migratsiya tizimi yo'q (drizzle push --force) — ✅ siyosat: docs/DEPLOY.md §7 (faqat additive push, destruktiv — expand/migrate/contract, staging'da `push --strict`)
77. ✅ Avtotestlar va CI — .github/workflows/ci.yml (tsc, lint, db-prepare, next build, smoke) + scripts/smoke.mjs (`npm run test:smoke`)
78. Xatolar monitoringi (Sentry) va analitika yo'q
79. ✅ Backup strategiyasi — docs/DEPLOY.md §6 (Turso PITR + kunlik `turso db shell .dump`, off-site, oylik tiklash sinovi)
80. Fayl saqlash Vercel Blob'ga bog'liq, S3/R2 yo'q

### Vizual / UX
81. Qorong'u rejimda kam sonli hududlar loyqa jigarrang (map-fill-0 issiq jigarrang) — ✅ --map-fill-0 sovuq neytral #2b2b34; rampa tokenlarda (--map-tint-lo/--map-mix-floor/--map-mix-range), ≥1 ta — kamida 28% pushti-coral tus (jigarrang emas); legenda bir xil rampa
82. /xarita yorliqlari Toshkent sh. / Toshkent vil. / Jizzax / Sirdaryo ustma-ust — ✅ yorliqlar ekranda ≥10px, joylash: avval gorizontal siljish, keyin vertikal; markerlar ham to'siq; uzoqlashgan yorliqqa qisqa chiziq; zich markaz bo'sh joyga (LABEL_OFFSET); tor ekranda yashirin, zoom'da qaytadi
83. Hero avatar stack rasm yuklanmasa bo'sh doiralar (bosh harf fallback yo'q) — ✅ <Avatar> bosh harf fallback bilan (rasm shart emas)
84. ✅ 0 sharhli profilda bo'sh 5 yulduz va "— (0)"
85. ✅ Yangi qo'shilgan mutaxassis uchun "Yangi" belgisi yo'q
86. ✅ Profilda ijtimoiy isbot (N bajarilgan buyurtma) ko'rsatilmaydi
87. Mobilda kichik hududlarni bosish qiyin, zoom/pan yo'q — ✅ /xarita: +/−/qaytarish, Ctrl/⌘+g'ildirak, ikki barmoq pinch, surish (1–3x, chegarada); sensorda 40px tugmalar; kichik hududlarga bosish diski zoom'ni hisobga oladi
88. Kasb pill'lari o'ngda kesiladi, scroll ishorasi yo'q — ✅ ScrollRow: ikki tomonlama so'nish + ko'rinadigan strelka-ishora (mobilda ham), snap
89. 14 hudud chipi tartibsiz sinadi — ✅ 2 qatorli gorizontal lenta (snap), 'Menga yaqin' va 'Barcha hududlar' birinchi ustunda
90. Tavsiya kartalari gradientlari bir-biridan ajralmaydi — ✅ yo'nalish kartalari: o'z naqshi (CoverPattern) + ikonka plitkasi + son/hududlar; mutaxassis kartalari uchun CoverPattern G3'ga topshirildi
91. "Uch qadam" kartalari tekis va zaif — ✅ raqamli ikonka plitkalari, bog'lovchi punktir chiziq (mobilda vertikal), 'N-qadam' + kattaroq sarlavha, eskrou izohi
92. CTA bloki qorong'uda yorug'ga inversiya qiladi — ✅ ikkala rejimda qorong'u (cta-dark), Noir'da inversiya yo'q — nozik white/10 chegara
93. Bosh sahifa juda uzun (takrorlanuvchi ro'yxatlar) — ✅ 1440 da 6092 → ~4480px: yo'nalishlar lentasi va 'Hududlar' chiplari olib tashlandi, yo'nalishlar 4×2 ixcham, tavsiya — 1 qator, yagona mt-section
94. ✅ Rasmsiz muqovalarda sun'iy gradient — "demo" hissi; seed rasmlari tashqi (bloklanadi) — qisman: <CoverPattern category seed/> (components/ui) tayyor — yo'nalishga xos naqsh + ikonka plitkasi, ikkala rejim; bosh sahifa yo'nalishlarida ishlatilgan. SpecialistCard/CoverImage fallback'iga ulash — G3
95. ✅ Profil formasi bitta ustunda juda uzun, bo'limlararo progress yo'q
96. ✅ Portfolio masonry notekis, bo'sh joylar
97. ✅ "+N ko'nikma" chipi bosilmaydi
98. ✅ Saralash select'i va natija soni bog'lanmagan
99. Ikonka o'lchamlari va radiuslar nomuvofiq (12–22px, 14–32px) — ✅ radius 12/16/24 tokenlar (--r-sm/md/lg, icon-tile-sm/lg ham), ikonka 16/20 (IconTile sm=16), bo'limlar oralig'i mt-section (64/80)
100. fg-4 rangi yorug'da AA kontrastdan o'tmaydi — ✅ --fg-4 #74726c / #85837c (11px matn ham AA); kichik coral matn uchun --accent-text

## F. 100 ta qo'shimcha (3-raund takliflari)

### Tezkor (ma'lumot qatlami tayyor)
1. Bildirishnoma qo'ng'irog'i (bell) + o'qilmaganlar soni + ro'yxat — ✅ NotificationsBell (yuqori panel, barcha rollar)
2. ✅ Sevimlilar: yurak tugmasi, API, /kabinet/sevimlilar sahifasi
3. ✅ Portfolio tartiblash (yuqoriga/pastga) va tahrirlash
4. ✅ Sharh faqat buyurtma qabul qilingan mijozdan + "Buyurtma tasdiqlangan" belgisi
5. Xarita panellarida (bosh sahifa va /xarita) jins filtri — ✅ segment (ro'yxatni filtrlaydi, xarita ranglari umumiy)
6. ✅ Buyurtma kartasida "O'tkazma yuborildi — tasdiq kutilmoqda" holati va /tolov havolasi
7. ✅ Email bildirishnomalar (Resend) muhim hodisalar uchun
8. ✅ Kirill→lotin transliteratsiya bilan qidiruv
9. ✅ Telefon normalizatsiya (+998) va chiroyli format
10. ✅ Profil uchun dinamik OG rasm (ism, kasb, hudud, reyting)
11. ✅ "Yangi" belgisi (7 kun) kartalarda
12. ✅ Ijtimoiy isbot chip: "N ta bajarilgan buyurtma", "N ta doimiy mijoz"
13. Bosh sahifa xarita tanlovini URL'ga yozish — ✅ ?region=&category=&gender=#xarita (history.replaceState)
14. ✅ Admin refund/cancel uchun sabab maydoni
15. ✅ Bekor qilish sababini buyurtma kartasida ko'rsatish

### To'lov va moliya
16. ✅ Narx taklifi / qarshi taklif (mijoz narxni rad etib o'z taklifini yuboradi)
17. Milestone (bosqichli) to'lovlar
18. ✅ Avto-release: mijoz 7 kun ichida javob bermasa pul mutaxassisga
19. ✅ Nizo markazi: mijoz/mutaxassis nizo ochadi, admin arbitraj qiladi
20. ✅ Hisob-faktura va chek PDF
21. ✅ Komissiya darajalari (yangi 15%, tajribali 10%, top 7%)
22. Promo-kod va chegirmalar
23. Referral dasturi (taklif qilgan → bonus)
24. Payme/Click saqlangan karta bilan tez to'lov
25. Uzum Nasiya / bo'lib to'lash
26. Mijoz depoziti (balans) va qaytarish
27. Avtomatik payout (bank/merchant API)
28. ✅ Narx qo'yishda "Siz olasiz: X so'm" oldindan ko'rsatkich
29. ✅ Oylik daromad hisoboti — /kabinet/hisobot?oy=YYYY-MM (bajarilgan, yalpi, komissiya, sof, payoutlar, obuna; chop etish / PDF)
30. ✅ Shoshilinch buyurtma (ustama bilan)
31. ✅ Xizmat paketlari (Basic / Standard / Premium) Fiverr uslubida
32. Mutaxassis Pro obunasi (ko'proq ko'rinish, statistika)
33. Profilni ko'tarish (boost) to'lovli

### Buyurtma va muloqot
34. ✅ Ichki chat (matn + fayl)
35. ✅ Buyurtmaga fayl biriktirish (brief, TZ, referens) — rasm va hujjat (PDF/DOC/DOCX)
36. ✅ Buyurtma holati timeline (tarix bilan)
37. ✅ Muddat yaqinlashganda eslatmalar
38. ✅ SLA: 24 soatda javob bo'lmasa avtomatik eslatma/bekor
39. ✅ Tez javob shablonlari
40. ✅ Video qo'ng'iroq havolasi (Meet/Zoom) buyurtma ichida
41. ✅ Bandlik kalendari va sana bron qilish
42. ✅ "Hozir ochiq" filtri (ish vaqti asosida)
43. ✅ Mutaxassis javobi sharhga
44. ✅ Ko'p mezonli reyting (sifat, muddat, muloqot)
45. ✅ Sharhga rasm/video biriktirish
46. ✅ NPS / "Tavsiya qilaman" so'rovi
47. ✅ Takroriy buyurtma (bir bosishda qayta buyurtma)
48. ✅ Mijozning "Mening mutaxassislarim" ro'yxati

### Qidiruv va xarita
49. ✅ Qidiruv autocompletion (ism, ko'nikma, shahar)
50. ✅ Ko'nikma (skills) bo'yicha filtr
51. ✅ Jihozlar filtri (dron, kamera turi, studiya)
52. ✅ Ish turi filtri (to'y, reklama, korporativ, kontent)
53. ✅ Saqlangan qidiruv va "yangi mutaxassis chiqsa xabar ber"
54. ✅ Taqqoslash (2–3 mutaxassis yonma-yon)
55. Xaritada zoom/pan va tumanlar darajasi — ✅ /xarita: zoom/pan (tugmalar, Ctrl/⌘+g'ildirak, pinch, surish, 1–3x); tumanlar darajasi — yo'q
56. Xaritada klasterlar / issiqlik xaritasi
57. "Menga yaqin" geolokatsiya — ✅ /xarita: navigator.geolocation → nuqta hudud ichidami (poligon) yoki eng yaqin markaz → tanlanadi; rad etilsa/aniqlanmasa tushunarli xabar
58. Xarita uchun klaviatura navigatsiyasi (strelkalar) — ✅ roving tabindex (1 Tab to'xtash joyi), strelkalar — qo'shni hudud (chegaradoshlik + yo'nalish), Enter/Probel tanlash, Esc bekor, Home/End, +/−/0 zoom; aniq fokus konturi
59. ✅ Kategoriya/hudud SEO landing sahifalar (/toshkent/videograf)
60. ✅ Sitemap'da kategoriya/hudud sahifalari va lastmod

### Profil va kontent
61. ✅ Portfolio video inline o'ynatish (YouTube/Vimeo), Instagram reels
62. ✅ "Oldin/keyin" slayder (montaj, retush, dizayn)
63. ✅ Portfolio teglari va kategoriyalari
64. ✅ Sertifikatlar/litsenziyalar bo'limi (dron ruxsatnomasi)
65. Jamoa/studiya profillari (bir nechta a'zo)
66. ✅ QR-kod vizitka va profil uchun qisqa havola
67. Profil tema/aksent tanlash (vitrina)
68. ✅ Javob tezligi va "oxirgi faollik" ko'rsatkichi
69. ✅ Top Rated nishoni avtomatik (reyting + bajarilgan ishlar)
70. ✅ Narx kalkulyatori (soat/kun/loyiha)
71. ✅ Onboarding wizard (bosqichma-bosqich) yangi mutaxassis uchun
72. ✅ Mijoz uchun "Buyurtma sehrgari" (kategoriya → byudjet → hudud → tavsiya)
73. ✅ Blog/maqolalar va yordam markazi (SEO) — ✅ yordam markazi /yordam (11 maqola, qidiruv, /yordam/[slug]); blog — yo'q
74. ✅ Mijoz e'lonlar doskasi (mijoz e'lon qiladi, mutaxassislar taklif beradi)
75. ✅ Takliflar (proposal) tizimi va kunlik limit

### Xavfsizlik va hisob
76. ✅ Email tasdiqlash (OTP) va SMS tasdiqlash (Eskiz.uz)
77. ✅ 2FA (TOTP) admin va mutaxassislar uchun
78. ✅ Faol sessiyalar ro'yxati (qurilma, IP) va alohida chiqish
79. Google / Telegram / Apple orqali kirish
80. ✅ Akkauntni o'chirish va ma'lumot eksporti (GDPR)
81. ✅ Nonce asosidagi CSP
82. ✅ Logout'da token denylist
83. KYC: pasport/ID yuklash va admin tasdiqlash navbati
84. ✅ Oferta/shartnoma qabul qilish (versiyalangan)
85. ✅ Spam/shikoyat (report) tugmasi profil va sharhlarda

### Admin va operatsiya
86. ✅ Admin dashboard grafiklar — /admin#analitika (kunlik daromad: komissiya + obuna, buyurtmalar, haftalik ro'yxatdan o'tish, top yo'nalish/hudud, voronka; jadval ko'rinishi)
87. ✅ Foydalanuvchini bloklash / ogohlantirish
88. ✅ Sharh moderatsiyasi navbati
89. ✅ Fraud belgilari — ✅ /admin#shubhali (bir IP'dan ≥3 akkaunt, o'z-o'ziga buyurtma, 24 soatda ko'p buyurtma/taklif, takroriy bekor qilish); bir xil karta — yo'q
90. ✅ Audit jurnali filtrlari va CSV eksport
91. ✅ Platforma sozlamalari tarixi — Admin → Sozlamalar «O'zgarishlar tarixi» (audit admin_settings: kim, qachon, kalit: eski → yangi)
92. ✅ Status sahifasi (uptime) va /api/health DB tekshiruvi
93. ✅ Fon vazifalari (cron): eskirgan Payme pending, rate_limits tozalash, eslatmalar
94. ✅ E2E testlar (Playwright) va CI (GitHub Actions) — ✅ CI + smoke testlar (node:test); Playwright E2E — yo'q
95. Sentry + log aggregatsiya
96. Rasmlar uchun CDN/optimizatsiya (R2 + next/image)
97. ✅ PWA: offline, web push bildirishnomalar — ✅ offline (public/sw.js, /offline, manifest ikonka/shortcut'lar); web push — yo'q
98. Rus va kirill tillari (i18n)
99. ✅ USD ekvivalenti ko'rsatish
100. Telegram bot: bildirishnomalar va tezkor javoblar


## G. Oylik obuna (2026-10-13)

Odamlar Redince'da bir-birini topib, keyin Telegram va boshqa joylarda davom etadi — faqat eskrou komissiyasiga tayanib bo'lmaydi.

1. ✅ Mutaxassislar uchun oylik obuna: 50 000 so'm/oy (admin sozlamasi subscriptionPrice); mijozlar uchun platforma bepul; eskrou komissiyasi platforma ichidagi to'lovlar uchun saqlanadi
2. ✅ Yangi mutaxassislarga bepul sinov muddati (standart 30 kun, subscriptionTrialDays) va tugagach muhlat (standart 3 kun, subscriptionGraceDays)
3. ✅ Majburiy rejim (subscriptionEnforced): obunasiz profil katalog, xarita statistikasi/paneli, qidiruv takliflari, landing sahifalar va sitemap'dan yashiriladi; to'g'ridan-to'g'ri havolada kontaktlar yopiq va "Mutaxassis obunasi faol emas" xabari
4. ✅ Obunasiz mutaxassis yangi buyurtma olmaydi (POST /api/orders → 403) va taklif yubora olmaydi; mavjud buyurtmalar va eskrou odatdagidek davom etadi
5. ✅ Tariflar: 1, 3, 6, 12 oy chegirmalar bilan (SUBSCRIPTION_PLANS); /kabinet/obuna, /narxlar va /oferta'da narxlar sozlamalardan
6. ✅ To'lov: Payme (account.order_id sub_…), Click (merchant_trans_id sub_…) va qo'lda o'tkazma ("To'ladim" → admin tasdiqlaydi); chop etiladigan obuna cheki
7. ✅ Eslatmalar: tugashidan 3 kun va 1 kun oldin, tugaganda va muhlat tugaganda (kunlik cron, har bosqich bir marta); kabinetda banner va holat nuqtasi
8. ✅ Admin: /admin/obunalar (daromad, MRR, holatlar bo'yicha filtr, muddatni uzaytirish, o'tkazmani tasdiqlash/rad etish, qaytarish), sozlamalar tarixi, analitikada obuna daromadi