# Tungi blok — 2026-10-30/31 (telefon UI, Instagram/Telegram/Udemy odatlari)

Maqsad: telefon ko'rinishini boshqa ijtimoiy tarmoqlar darajasiga chiqarish, mentorlikni Udemy/Skillshare/Coursera bilan
solishtirib yetishmaganlarni qo'shish, topilgan kamchiliklarni tuzatish. Hammasi `claude/quirky-volta-tzlqwh` (prod) ga
ketdi, CI har commit'da yashil. 22 commit, 45 fayl, +1035/−138 qator.

## Audit usuli
Scratchpad `night-crawl.mjs <outDir> <light,dark> [width]` — 45 sahifa × 2 tema × 390px (+1440px): HSCROLL, viewport'dan
chiqqan elementlar, <32px bosish nuqtalari, kesilgan matn, konsol xatolari, to'liq va fold skrinshotlar. SMALL/CLIP
bayroqlari ko'pincha `sr-only` matnlar — qo'lda tekshiriladi. Qo'shimcha: 360×640, 375×667, 430×932 o'lchamlar; auth
sahifalari «bitta ekran» qoidasi (scroll 0) uchalasida ham o'tdi.

## Instagram / Telegram / TikTok odatlari (telefon)
- Yuqori panel pastga aylantirilganda yashirinadi, yuqoriga — qaytadi (`html[data-topbar-hidden]`).
- Faol tab qayta bosilsa sahifa tepasiga (haptic, reduced-motion hisobga olinadi).
- Rasmga ikki marta bosish = yurak (katta oq yurak animatsiyasi, haptic); bitta bosish 260 ms kutib lightbox.
- Lightbox: pinch 1–5×, surish, ikki marta bosish 2.5×, g'ildirak; kattalashganda svayp-slayd o'chadi.
- Lenta: izohlar pastki varaqda (`CommentsSheet`), media chetdan chetgacha, post «⋯» menyusi action sheet.
- Tortib yangilash (`usePullToRefresh` + `PullIndicator`).
- DM va guruh chati: xabarni o'ngga surib javob berish (56px bo'sag'a, orqada belgi, haptic).
- Bildirishnomalar: qatorni chapga surish — o'qilgan deb belgilash (yashil «O'qildi» fon).
- Story ko'ruvchi: pastga surish yopadi, chap/o'ng svayp — keyingi/oldingi muallif.
- «Yaratish → Post joylash» bosh sahifada kompozitorga fokus beradi (sahifa almashmaydi).
- Qidiruv: telefonda «Qidirish» tugmasi yo'q — yozish bilan qidiradi (enterKeyHint=search).
- Jamoa sahifasi: sarlavha yassi, muqova chetdan chetgacha, breadcrumb yo'q.
- Yopishqoq CTA (`components/ui/StickyCta.tsx`, sticky — fixed emas): vakansiyada «Ariza yuborish», e'londa «Taklif
  yuborish», kurs sahifasida «Kursga yozilish / Bepul boshlash» (narx bilan), mutaxassis profilida «Yozish · Ism»;
  maqsad blok ko'ringanda o'zi yashirinadi.
- «Ma'lumot tejash» (Ko'rinish paneli, `html[data-saver]`, localStorage `redince-saver`; brauzer Data Saver
  yoqilgan bo'lsa avtomatik): lentada video o'zi o'ynamaydi (controls bilan), Reels'da qo'shni videolar `preload=none`,
  yuklashdan oldin rasm 1280px/0.78 sifatda siqiladi. Hook `components/motion/useDataSaver.ts`. Instagram «Use less
  mobile data» muqobili.

- Telefon «karta ichida karta yo'q» qoidasi kengaytirildi: Kabinet umumiy, Kabinet → Mentorlik (6 sahifa, takror sarlavha yashirin),
  ijodkor profili (Instagram to'ri 2px, haqida/yo'l/sertifikat/jamoalar/sharhlar tekis), ustoz sahifasi (muqova ustida doira portret),
  rezyume/vakansiya tafsiloti, e'lonlar va rezyumelar katalogi (qator ko'rinishi `m-plain` + hairline, filtr ramkasiz,
  rezyume filtrida 3 tanlov bir qatorda `AutoSubmitSelect`), Yordam markazi.

## Kabinet telefonda
- Profil sahifasi tablar (`ProfilePanels`): Akkaunt · Telegram · Mutaxassis profili · Maxfiylik · Ish vaqti — faqat
  tanlangani chiziladi (16 000px → 1 700px); `?tab=` va `#hash` havolalari ishlaydi; sm+ da avvalgidek.
- Mutaxassis profili formasi akkordeon (`Section defaultOpen`, `ke:open-section` hodisasi).
- Buyurtmalar ro'yxati 8 tadan «Yana ko'rsatish» (15 900px → 5 400px).
- Ishlar filtri «Filtrlar» tugmasi ostida; qisqa panel nomlari (Vakansiyalar · Rezyumelar · Ishlar).

## Mentorlik (Udemy/Skillshare/Coursera taqqosi)
- Kurs sahifasi: «Nimalarni o'rganasiz» ✓ to'ri, «Talablar», «Kimlar uchun», jami video daqiqa, dars tili,
  yangilangan sana, «Sertifikat beriladi». Sxema: `courses.outcomes/requirements` (json), `audience`, `language`
  (faqat qo'shimcha ustunlar, db-prepare o'zi qo'llaydi). Tahrirlagichda har qator bitta band.
- Katalog: yo'nalish chiplari ikonka bilan, «Mashhur kurslar» karuseli (`CourseMiniCard`), telefonda ustozlar
  story-doira qatori; kartalarda «Mashhur» (≥10 talaba) / «Yangi» (≤14 kun) belgilari.
- Ustoz sahifasi telefonda: hero 16:10, kichik avatar, tablar gorizontal aylanadi.

- Dars sahifasida tezlik + vaqt belgilari sarlavhadan KEYIN (telefonda video → dars nomi → tezlik, Udemy tartibi).
- Qidiruv to'ri: yuklanmagan (buzilgan havola) yoki muqovasiz havola-ish bo'sh kulrang katak o'rniga sarlavhali matn plitka
  (`MediaTile` → `SafeImage` fallback). Xavfsizlik: holat plitkalari telefonda 2 ustun, bloklanganlar eslatmasi to'g'ri o'raladi.

- RUS TILI (kabinet qobig'i): `i18n/dict/kabinet.ts` — kabinet navigatsiyasi (bandlar, guruhlar, «Kashf etish», sozlamalar, rol, nuqta
  yorliqlari), telefon «Menyu» sarlavhasi, Telegram eslatmasi va 34 ta kabinet sahifa sarlavhasi (`generateMetadata` + `KABINET_NAV.titles`).
  QOLGANI: kabinet sahifalarining ichki matni (umumiy, buyurtmalar, bildirishnomalar, chat, profil…) va vakansiyalar bo'limi hali faqat o'zbekcha —
  alohida katta blok (yuzlab satr), foydalanuvchi qarori bilan. Qo'shimcha: 8 ta ommaviy sahifaning telefon sarlavhasi (`m-title`)
  tilga mos (qidiruv, jamoalar, yordam, haqida, TOP, xarita, narxlar, mutaxassislar); `formatDate(date, "ru")` / `monthLabel(key, "ru")`
  — TOP sahifasida ruscha sana.

## Tuzatilgan kamchiliklar
- Buyurtma sehrgari kasb qatorlari ekrandan 48px chiqib ketardi (grid `minmax(0,1fr)`), sehrgar kartasi telefonda yassi.
- Story qatorida «Story qo'shi…» kesilgan yorliq; «+» 28px; rezyume ko'nikma o'chirish tugmasi 20→28px.
- **Yashirin xato**: `max-sm:m-flat` / `max-sm:m-bleed` Tailwind utility emas — hech narsa qilmas edi (kurs sahifasida
  3 joy, jamoa, qidiruv). CLAUDE.md'ga qoida yozildi: `m-*` sinflari variantsiz yoziladi.
- Takror sarlavhalar: chat h1, Narxlar/Yordam eyebrow telefonda yashirin.
- `ZoomableImage` effekt cleanup xatosi («destroy is not a function») — lightbox ochilmay qolgan edi, tuzatildi.

- `mutaxassislar/[slug]/loading.tsx` olib tashlandi — tafsilot sahifasida Suspense chegarasi `notFound()` dan oldin 200 oqizib
  yuborardi (CLAUDE.md «Yumshoq 404 qoidasi»); ijodkor profili indekslanadigan eng muhim sahifa. Prod build'da `/mutaxassislar/<yo'q>`
  endi haqiqiy 404.

## Tekshiruv
- tsc toza, smoke 23/23, xavfsizlik 28/28, CI (build+smoke+security) har commit'da yashil.
- Yorug' va qorong'u tema regressiya crawl'i: yangi muammo yo'q (qolgan bayroqlar — marquee, dekorativ SVG,
  truncate ichidagi inline span — soxta).

- Kurs kartalarida jami davomiylik («50 daq», «2 soat 10 daq») — `listCourses` extras (korrelyatsion sum; DIQQAT:
  relational `extras` ichida `${courses.id}` yalang'och "id" bo'lib ichki jadvalga tegadi — tashqi jadval nomi aniq yoziladi).
- Kurs sahifasida reyting taqsimoti (katta ball + 5★…1★ foiz chiziqlari, `CourseDetail.ratingDist`).
- Dars pleyeri: video tugagach «Keyingi dars» kartasi — 6 soniyalik halqa sanoq, «Bekor qilish», «Avto-o'tishni o'chirish»
  (`kasb_autonext` localStorage), tugagan darsning saqlangan joyi tozalanadi; overlay chiqqanda native boshqaruv yashirinadi.
- Reels: TikTok kabi pastki progress chizig'i (2px, bosilganda 4px + tutqich), bosish/surish bilan videoning istalgan joyiga o'tish
  (`role=slider`, pointer capture); tab panelining ustida turadi (`bottom: safe-area + 3.75rem`).
- Lenta posti: uzun matn 4 qatorga yig'iladi, «ko'proq»/«yig'ish» (`PostBody`, 220 belgi yoki 4+ qator; lug'at `FEED.readMore/readLess`).
- Rasm yuklashdan OLDIN brauzerda siqiladi (`compressImage` attachments.ts): uzun tomon 2048px, JPEG 0.86, PNG→WebP (shaffoflik saqlanadi,
  Safari WebP yoza olmasa asl fayl), GIF tegilmaydi, siqilgan nusxa kattaroq chiqsa asl fayl; sinov: 3600×2400 395 KB → 2048×1365 139 KB.
  `uploadAttachment(file, { raw: true })` — siqmasdan.
- Chat ro'yxati: Telegram kabi qatorni chapga surish → Qadash · Ovozsiz · Arxiv (faqat telefon, 150px, vertikal scroll buzilmaydi,
  ochiq qatorga bosish — yopadi). Klaviatura: `viewport.interactiveWidget="resizes-content"` (Android) + `useVisualViewport()`
  (iOS Safari — to'liq ekranli chat balandligi ko'rinadigan maydonga teng, yozish maydoni klaviatura ustida qoladi).
- Dars «Eslatmalar» (Udemy Notes): `lesson_notes` jadvali (faqat egasiga ko'rinadi, ustoz ham ko'rmaydi), vaqt belgisi — yozish
  boshlanganda pleyerdagi soniya (`data-lesson-video`), belgi bosilsa pleyer o'sha joyga o'tadi (`ke:lesson-seek` hodisasi);
  API `/api/mentorlik/darslar/[id]/eslatmalar` (GET/POST, kursga yozilgan/egasi/admin) va `/api/mentorlik/eslatmalar/[id]` (DELETE, faqat egasi);
  xavfsizlik testlariga 2 ta IDOR holati qo'shildi (30/30).
- Kurs sahifasi: «Kursni ko'rib chiqish» — birinchi bepul namuna darsining videosi muqova ustida o'ynaydi (`CoursePreview`,
  `CourseDetail.previewVideo`), «Bu kursga kiradi» ro'yxati haqiqiy sonlar bilan (video daqiqa, material, test, vazifa —
  `materialsCount/quizCount/assignmentCount`); telefonda asosiy ustunda, keng ekranda narx panelida. Qidiruv tur chiplari telefonda bitta aylanuvchi qator.
- Kursni saqlash (Udemy Wishlist): `course_saves` (kurs+foydalanuvchi noyob), `toggleCourseSave`/`listSavedCourses`,
  `POST /api/mentorlik/kurslar/[id]/saqlash`, `GET /api/mentorlik/kurslar/saqlangan`; kurs sahifasida belgi tugmasi (`CourseSaveButton`,
  mehmon → kirish), Kabinet → Saqlanganlar endi Postlar · Kurslar (`?tur=kurslar`). Xavfsizlik: mehmon 401 + begona kurs 404 testlari (32/32).
- O'quv seriyasi (Duolingo/Coursera odati): `lib/mentorship/streak.ts` `learningStreak()` — faqat `lesson_completions`dan (Toshkent kuni,
  90 kunlik oyna): joriy zanjir, rekord, hafta nuqtalari; kabinet → Mentorlik'da `LearningStreakCard` (yozilganlarga), dars tugatilganda
  javobda `streak` → toast «🔥 N kunlik seriya».
- Bosh sahifada «O'qishni davom ettirish» (Udemy/Coursera): tugallanmagan eng so'nggi kursning navbatdagi darsi + progress
  (`continueLearning()` service.ts, `components/feed/ContinueLearningCard.tsx`, story qatoridan keyin, faqat yozilganlarga).
- Reels: birinchi tashrifda (sensorli ekran) «Keyingisi uchun yuqoriga suring» ishorasi — 3 s yoki birinchi surishgacha, `kasb_reels_hint`
  (scroll konteyner ichida `sticky top-0 h-0` + absolute — `fixed`siz). Izohlar varag'ida «Javob» (Instagram/TikTok): chip + `replyToId`,
  javob izohida «…ga javob» iqtibosi.
- Regressiya crawl (yorug'+qorong'u, 86 sahifa): yangi HSCROLL/xato yo'q; OVER — marquee/dekorativ SVG/`truncate` ichidagi span (soxta),
  ERR — kompilyatsiya paytidagi vaqtinchalik «network error» (qayta tekshirildi: toza), BTN-NONAME — `aria-labelledby` switch'lar (crawler hisobga olmaydi).
- Guruh chati telefonda TO'LIQ EKRAN (Telegram): `GroupChat` DmChat naqshida — `createPortal(document.body)` + `data-chat-open`
  (yuqori panel/pastki tab yashirinadi), sarlavhada «Orqaga» (inline kartaga qaytadi), inline kartada «To'liq ekran» tugmasi,
  klaviatura ochilganda balandlik `useVisualViewport`dan. Chat tabi ochilganda telefonda darhol to'liq ekran.
- Dars pleyeri telefon/planshetda YOPISHQOQ (YouTube/Udemy mobil): `LessonPlayer` endi faqat video (`max-lg:sticky`, `data-sticky-player`,
  yuqori panel yashiringanda `top: 0` — globals.css), tezlik va vaqt belgilari alohida `LessonControls` (video elementni `data-lesson-video`
  orqali boshqaradi, bob bosilsa `ke:lesson-seek`). Yopishish doirasi — chap ustun (tablar/eslatmalar/savol-javob).
- Vakansiyalar/Ishlar qidiruv formasi telefonda ixcham: katta «Qidirish» tugmasi yashirin (Enter / klaviatura «Qidirish»),
  tanlov o'zgarsa darhol qidiradi (`components/ui/AutoSubmitSelect.tsx` — server GET formalar uchun), forma kartasi yassi.
- Kurs BO'LIMLARI (Udemy sections): `lessons.section` (ixtiyoriy nom; LessonForm'da maydon + mavjud bo'limlar `datalist`), ketma-ket bir xil
  nomli darslar kurs sahifasida yig'iladigan `<details>` (dars soni · davomiylik · bajarildi; birinchisi va bajarilmagani ochiq), dars yon panelida
  bo'lim sarlavhalari; efir yozuvi dars qilinganda «Efir yozuvlari» bo'limiga tushadi. Bo'lim nomi bo'lmasa — avvalgidek yassi ro'yxat.
- Mentor tahlili: har kurs ostida «Talabalar · N» (yig'iladigan) — ism/avatar, progress chizig'i, oxirgi ochilgan dars, yozilgan sana,
  «Yozish» (username bo'lsa); faqat ommaviy maydonlar, kontakt yo'q (`mentorAnalytics().courses[].studentsList`, ≤100).
- Kabinet telefonda ixcham: Telegram eslatmasi bitta qator («Telegram'ni ulang — xabarlar darhol keladi»), Bildirishnomalar sahifasida
  tavsif yashirin, Web Push kartasi yassi va tavsifsiz — ro'yxat ~500px yuqoriroq boshlanadi. Dars sahifasida kurs tugagach «Kursga baho bering».
- PostModal karuseli telefonda: chap/o'ng surish — keyingi/oldingi rasm (Instagram), strelkalar yashirin, o'ng yuqorida «1/3» hisoblagich.
- Story ko'ruvchi: Instagram tez reaksiyalar — javob maydoni fokusda 6 emoji (❤️🔥👏😂😮😢), bosilsa DM ketadi va markazda emoji
  «portlashi» (`animate-pop`); `pointerdown` ishlatiladi (blur'dan oldin).

## Ertalabki yakun (01:50 UTC / 06:50 Toshkent)
- 54 commit, 67 fayl, +2167/−277 qator; CI (build + smoke + security) har push'da yashil; smoke 23/23, xavfsizlik 32/32.
- Telefon: Instagram/Telegram/TikTok odatlari (ikki marta bosish, pull-to-refresh, pinch-zoom, swipe-javob, swipe-o'qildi, swipe-pin/mute/arxiv,
  pastki varaqlar, yopishqoq CTA'lar, to'liq ekranli chat, karusel swipe, story tez reaksiyalar, Reels progress + svayp ishorasi, ixcham formalar,
  klaviatura moslashuvi, rasm siqish).
- Mentorlik (Udemy/Coursera pariteti): natijalar/talablar/auditoriya, davomiylik, reyting taqsimoti, namuna video, «Bu kursga kiradi», bo'limlar,
  eslatmalar, avto-keyingi dars, yopishqoq pleyer, wishlist, streak, «Davom etish», talabalar ro'yxati, baho so'rovi, jamlama eslatmasi.
- Ertalab foydalanuvchi qiladigan ishlar o'zgarmadi: Vercel'da `VAPID_PRIVATE_KEY` → Secret, push sinovi, Google OAuth kalitlari,
  Yandex sitemap/hudud, domen + Resend, Payme/Click kalitlari, Google «Request indexing» qayta urinish.

## Tong yakuni 2 (01:05 UTC / 06:05 Toshkent)
- Tun davomida jami 81 commit (so'nggi 3 soatda 43 ta, 109 fayl, +1584/−390). Hammasi push qilingan, CI yashil, smoke 23/23, xavfsizlik 32/32.
- So'nggi 3 soat: «Ma'lumot tejash», telefon «tekis» o'tishi (kabinet, profil, ustoz, kataloglar, TOP, Yordam), qidiruv to'ri fallback,
  dars sahifasi tartibi, SEO `loading.tsx`, RU kabinet qobig'i (navigatsiya, 34 sahifa sarlavhasi, Telegram eslatmasi), regressiya crawl
  (44 yorug' + 46 qorong'u sahifa, 768px planshet, mehmon, RU) — HSCROLL yo'q.
- Admin bosh sahifasi: 14 so'rov parallel, har biri ~55–70 ms (dev); sekinlik faqat dev kompilyatsiyasi/yuklama paytida.

- Reaksiya emojilari Apple (iPhone) emoji rasmlariga almashtirildi (iamcal/emoji-data): Android/Windows'da ham iPhone'dagidek ko'rinadi.

## Keyingi g'oyalar
- RU: kabinet sahifalarining ichki matni va vakansiyalar bo'limi (katta blok, foydalanuvchi qarori bilan).
- Kabinet mentorlik sahifalari telefonda tablar (ProfilePanels naqshi bilan).
