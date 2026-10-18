# Lenta va postlar — batch-800 hisoboti (2026-10-18)

Qisqa hisob: A 0 · B 0 · C 0 · D 0 (reja — bajarilgani sari ✅ qilinadi)

Soha: bosh sahifa lentasi (`/`), `lib/feed.ts`, `/api/feed`, `components/feed/*`, `components/groups/GroupFeed.tsx` (PostCard/kompozitor/izohlar — bosh sahifa, jamoalar va profil uchun umumiy), `Reactions.tsx`, `MentionInput.tsx`, `RichText.tsx`, `useViewTracker.ts`, `/api/posts/**`, `/api/comments/**`, `/api/users/mention`, `lib/groups/mentions.ts`, `i18n/dict/feed.ts`, yangi server funksiyalar — `lib/groups/posts-extra.ts`.

## A. Yangi funksiyalar
1. ⬜ So'rovnoma (poll) postda — `post_polls`/`post_poll_votes` jadvallari, `POST /api/posts/[id]/poll` (yaratish), `POST /api/posts/[id]/poll/vote` (ovoz/qaytarish), kompozitorda 2–4 variant, kartada foizli chiziqlar
2. ⬜ «Qiziq emas» — postni lentadan yashirish (`post_hides`, `POST /api/posts/[id]/hide`, bekor qilish bilan)
3. ⬜ Muallifni lentadan yashirish (mute) — `feed_mutes`, `POST /api/feed/mute`, lentadan chiqib ketadi, bekor qilish
4. ⬜ «N ta yangi post» pilyulasi — fon so'rovi `GET /api/feed/new?since=` (faqat ko'rinadigan tabda), bosilganda yangilanadi
5. ⬜ Cheksiz aylantirish — sentinel ko'ringanda keyingi sahifa o'zi yuklanadi («Yana» tugma zaxira)
6. ⬜ Havola kartasi (OG preview) — `GET /api/posts/preview?url=` (server tomonda, 4 s timeout, 300 KB, faqat ochiq hostlar, xotira keshi), kartada sarlavha/tavsif/domen
7. ⬜ Hashtag filtri — `/?tag=montaj`, RichText'dagi #teg endi lentaga olib boradi, tepada chip + tozalash
8. ⬜ Trend teglar — o'ng panelda so'nggi 7 kun eng ko'p ishlatilgan teglar (`trendingTags`)
9. ⬜ Ulashish menyusi: havola nusxasi · Telegram · xabarda yuborish (suhbatlar ro'yxatidan tanlab `POST /api/chat/<id>`)
10. ⬜ Doimiy havola — vaqt `<time>` elementi postning permalinkiga olib boradi, title'da aniq sana
11. ⬜ Izohlarni saralash — `?sort=new|old` (API) + UI almashtirgich
12. ⬜ Izohga javob (1 daraja) — `post_comments.reply_to_id`, «Javob» tugmasi, iqtibos chiziqchasi
13. ⬜ Izohni tahrirlash — `PATCH /api/comments/[id]` (muallif, 15 daqiqa ichida), «tahrirlangan» belgisi
14. ⬜ Klaviatura: j/k — keyingi/oldingi post, l — yoqtirish, c — izohlar, s — saqlash (aria-keyshortcuts)
15. ⬜ «Obunalarim» bo'sh holati — tavsiya ijodkorlar ro'yxati obuna tugmasi bilan
16. ⬜ Saqlanganlar soni hikoyalar qatorida (kirganlar uchun birinchi element)
17. ⬜ Tahrir vaqti — `posts.edited_at` ustuni; «tahrirlangan» ustida aniq sana (title)
18. ⬜ Rasm lightbox — chap/o'ng, swipe, Esc, fokus qaytadi, hisoblagich
19. ⬜ Video ko'rinishda ovozsiz avtoijro + ovoz tugmasi (reduced-motion'da ijro yo'q)
20. ⬜ Kompozitor qoralamasi — localStorage (manba bo'yicha), tiklandi eslatmasi, yuborilgach tozalanadi
21. ⬜ Kompozitor: Ctrl/⌘+Enter yuboradi, rasmni clipboard'dan qo'yish (paste) va sudrab tashlash (drop)
22. ⬜ «Kim reaksiya qo'ydi» oynasi — `GET /api/posts/[id]/reactions`, reaksiya bo'yicha filtr
23. ⬜ Lenta turi eslab qolinadi — `lenta_scope` cookie («Obunalarim» tanlangan bo'lsa keyingi safar ham)
24. ⬜ Lentaga qaytganda aylantirish joyi tiklanadi (sessionStorage: yuklangan sahifalar + scrollY, 10 daqiqa)
25. ⬜ `/?post=<id>` — bosh sahifada aynan shu post tepada, belgilangan holda (slug'siz muallif havolalari uchun)
26. ⬜ Post matnini nusxalash (menyu) va «Tepaga» suzuvchi tugma (2 ekrandan keyin)
27. ⬜ Yangi post yuborilgach to'liq qayta yuklanmaydi — `GET /api/posts/[id]` bilan faqat shu post tepaga qo'shiladi (kabinet/postlar'da ham ishlaydi)

## B. Tuzatilgan buglar
1. ⬜ Bosh sahifada post joylangach yangi post lentada chiqmas edi (`router.refresh` HomeFeed state'ini yangilamaydi) → yangi post darhol tepaga qo'shiladi
2. ⬜ «tahrirlangan» belgisi izoh qoldirilgan har bir postda chiqardi (`updatedAt` izohda ham yangilanadi) → `posts.edited_at` bo'yicha (lenta)
3. ⬜ `kabinet/postlar` da `apiBase` so'rov satrisiz: reload/«Yana yuklash» 422 bilan yiqilar edi → `?`/`&` birlashtirish + yakka post qo'shish
4. ⬜ RichText: `email@domen.uz` ichidagi `@domen` eslatma havolasiga aylanardi → oldidan harf/raqam bo'lsa eslatma emas
5. ⬜ RichText: 60–68 belgili havola ko'p nuqtasiz kesilardi → qisqartirilganda har doim «…»
6. ⬜ RichText: havola oxiridagi `)` / `»` / `"` belgilari havolaga kirardi → kengaytirilgan tozalash
7. ⬜ Nisbiy vaqt hydration xatosi (server «hozirgina», klient «1 daqiqa oldin») + ru tilida o'zbekcha chiqardi → `RelativeTime` (suppressHydrationWarning, har daqiqa yangilanadi, uz/ru ko'plik)
8. ⬜ Efir blokidagi «N daqiqadan keyin» server/klientda farq qilardi → klientda hisoblanadi
9. ⬜ Kompozitor: `.mov` faylda brauzer `type` bo'sh bersa «faqat rasm yoki video» xatosi → kengaytma bo'yicha zaxira tekshiruv
10. ⬜ Kompozitor: limitdan ortiq fayl tanlanganda qolganlari indamay tashlanardi → ogohlantirish
11. ⬜ Kompozitor: o'tgan vaqtga efir e'lon qilish mumkin edi (faqat serverda rad) → klientda xato matni
12. ⬜ Kompozitor xato matni `role="alert"` emas edi (ekran o'quvchi eshitmaydi)
13. ⬜ Izohni o'chirish tasdiqsiz va xatoda jim → ikki bosqichli tasdiq + toast
14. ⬜ Izohlar yuklanmasa «Yuklanmoqda…» abadiy qolardi → xato holati + «Qayta urinish»
15. ⬜ Izohlar soni 100 tadan ko'p bo'lsa noto'g'ri hisoblanardi (`items.length`) → API `total` qaytaradi
16. ⬜ Reaksiya: telefonda uzoq bosib barmoqni olib qochilsa keyingi bosish yutilib ketardi (`suppressClick` qolib ketadi) → tanlagich yopilganda tozalanadi
17. ⬜ Reaksiya tanlagichi klaviaturadan ochilganda fokus kirmas, ←/→ ishlamas, Esc fokusni qaytarmas edi
18. ⬜ @ro'yxat: bir sahifada bir nechta maydon bir xil `id="mention-listbox"` ishlatardi (aria-controls noto'g'ri) → `useId`, `aria-activedescendant`
19. ⬜ Ko'rish hisobi fon tabda (ko'rinmayotgan sahifa) ham yozilardi → `visibilityState` tekshiruvi, yashiringanda taymer to'xtaydi
20. ⬜ «Yana yuklash» xatosi jim edi → toast + tugma qoladi
21. ⬜ Postni o'chirish xatosi jim edi → toast
22. ⬜ Izoh tugmasida aria-label yo'q edi (faqat son) → «Izohlar (N)»
23. ⬜ Hikoyalar havolasida faqat `title` → `aria-label` (ism + «yangi postlar»)
24. ⬜ `FEED.members` ru ko'pligi («1 участников») → to'g'ri ko'plik
25. ⬜ Yopiq jamoaga a'zo bo'lmagan kirgan foydalanuvchiga izoh yoza olmaslik sababi ko'rsatilmas edi
26. ⬜ Lenta «Yana yuklash» ikki marta bosilsa takror so'rov ketardi (loading ref) → qulf

## C. Dizayn va animatsiya tuzatishlari
1. ⬜ PostCard hover: soya (`shadow-2`) → v3 yassi `card-hover` (kontur quyuqlashadi)
2. ⬜ Karta pastki qatori ikonkalari bir xil 18px (yurak, izoh, ulashish, saqlash)
3. ⬜ Sarlavha amallari bitta «…» menyuga (pop-in/pop-out, Esc, tashqariga bosish)
4. ⬜ Izohlar paneli chiqish animatsiyasi (`usePresence` + `expand-out`)
5. ⬜ Yangi izoh `animate-msg-in`, o'chirilgani `usePresence` bilan chiqadi
6. ⬜ Kompozitor fokusgacha bir qatorli, fokusda kengayadi (`expand-in`)
7. ⬜ Yuklanish skeleti («Yana» paytida 2 ta skelet karta, kelganlar `animate-fade-in`)
8. ⬜ Hikoyalar halqasi: 24 soat ichida post qo'ygan — aksent, eskiroq — hairline; bosilganda press
9. ⬜ Lenta almashtirgichi (segment) yopishqoq (mobil sarlavha ostida), orqa fon surface
10. ⬜ Rasm yuklanganda so'nib kirish (`data-loaded` + opacity transition)
11. ⬜ Radius izchilligi 14px (kompozitor media, o'ng panel plitkalari, izoh pufagi)
12. ⬜ «Yangi postlar» pilyulasi `pop-in`/`pop-out`
13. ⬜ So'rovnoma chiziqlari kenglik o'tishi + tanlangan variant aksent
14. ⬜ Lightbox `animate-modal-in/out` + fon so'nishi
15. ⬜ Ulashish menyusi `pop-in`/`pop-out`
16. ⬜ «Kim reaksiya qo'ydi» oynasi: desktop modal, telefonda pastdan (`sheet-in/out`)
17. ⬜ Bo'sh holatlar `EmptyState` komponenti bilan (ikonka + qisqa matn)
18. ⬜ Xato holati `role="alert"` (avtomatik silkinadi) + qayta urinish tugmasi
19. ⬜ Kompozitor yuborish tugmasida `Spinner`, ikonka 16px
20. ⬜ Video ustida ovoz tugmasi — pastki o'ngda, so'nib kiradi
21. ⬜ Havola kartasi: hairline, 14px radius, hover'da kontur
22. ⬜ Hashtag chipi `expand-in`, tozalash tugmasi press
23. ⬜ Segment `aria-current` + fokus halqasi
24. ⬜ Sarlavha ikonka tugmalari 36px (teginish maydoni), press
25. ⬜ «Tepaga» tugmasi `pop-in/pop-out`
26. ⬜ Reaksiya soni almashganda `animate-swap`

## D. Minimalizm
1. ⬜ Karta pastki qatorida chegara yo'q (`border-t` olib tashlandi), bo'shliq bilan ajratiladi
2. ⬜ Izohlar bo'limida ikkinchi chegara olib tashlandi
3. ⬜ Ko'rishlar soni pastki qatordan sarlavha meta qatoriga («2 soat oldin · 12 ko'rish»), 0 bo'lsa chiqmaydi
4. ⬜ Jamoa chipi alohida qatordan sarlavhaga («Ism · Jamoa nomi»), «jamoasida» so'zi olib tashlandi
5. ⬜ Qadash/tahrir/o'chirish/shikoyat — 3–4 ikonka o'rniga bitta «…»
6. ⬜ «Qadalgan» pilyulasi → faqat pin ikonkasi (sr-only matn)
7. ⬜ Ulashish matni olib tashlandi — faqat ikonka (hamma joyda bir xil)
8. ⬜ Reaksiya/izoh soni 0 bo'lsa raqam chiqmaydi
9. ⬜ Hashtag/eslatma rangi aksentdan `fg` ga (aksent faqat havola va faol holat uchun)
10. ⬜ Kompozitor: hisoblagich faqat 80% dan keyin, «Rasm/video 0/4» → ikonka + son (faqat >0)
11. ⬜ Kompozitor efir paneli aksent fonidan neytral `bg-fg/4` ga
12. ⬜ Efir bloki: aksent doira faqat jonli holatda
13. ⬜ Mehmon kartasi: blur dog'i olib tashlandi, matn qisqartirildi, bitta asosiy tugma
14. ⬜ Hikoyalar qatori karta chegarasisiz (yassi tasma)
15. ⬜ O'ng panel: «men» kartasi bir qatorli, kanal kartasi tavsifsiz
16. ⬜ O'ng panel plitkalari aksent fonidan neytralga, xarita kartasi `bg-ink` → `bg-fg/6`
17. ⬜ O'ng panel sarlavhalari bitta uslubda (13px, fg-2), «Barchasi» havolasi bir xil
18. ⬜ Bo'sh holat matnlari qisqartirildi
19. ⬜ Jamoaga a'zo bo'lmaganlar uchun eslatma matnlari bir qatorga qisqartirildi
20. ⬜ Reaksiya tugmasi `title` matni qisqa
21. ⬜ `requireLogin` va «Yana yuklash» bloklari ikki komponentda takrorlanardi → `useRequireLogin` + `LoadMore` (feed/shared.tsx)
22. ⬜ Lentadagi jamoa chipi ikonka + nom
23. ⬜ Izoh qatori: «Shikoyat» faqat hover'da (bor edi) + o'chirish bitta menyu emas, ixcham
24. ⬜ Kompozitor placeholder'lari qisqartirildi
25. ⬜ `Composer` tugmasi «E'lon qilish» → «Joylash»

## Tekshiruv
- (to'ldiriladi)

## Boshqa sohalarga so'rovlar
- (to'ldiriladi)

## Qoldirilgan / xavf
- (to'ldiriladi)
