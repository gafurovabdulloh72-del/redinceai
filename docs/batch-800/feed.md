# Lenta va postlar — batch-800 hisoboti (2026-10-18)

Qisqa hisob: A 27 · B 28 · C 30 · D 27

Soha: bosh sahifa lentasi (`/`), `lib/feed.ts`, `/api/feed/**`, `components/feed/*`, `components/groups/GroupFeed.tsx` (PostCard/kompozitor/izohlar — bosh sahifa, jamoalar va profil uchun umumiy, props mos qoldi), `Reactions.tsx`, `MentionInput.tsx`, `RichText.tsx`, `useViewTracker.ts`, `/api/posts/**`, `/api/comments/**`, `i18n/dict/feed.ts`. Yangi fayllar: `lib/groups/posts-extra.ts` (server), `components/groups/PostParts.tsx` (menyu, so'rovnoma, lightbox, video, havola kartasi, media to'ri), `components/feed/shared.tsx` (umumiy mayda qismlar), `components/feed/ScopeTabs.tsx`. Sxema (faqat qo'shimcha): `post_polls`, `post_poll_votes`, `post_hides`, `feed_mutes` jadvallari; `posts.edited_at`, `post_comments.reply_to_id`, `post_comments.edited_at` ustunlari. Rate-limit: `feedActions`, `preview`.

## A. Yangi funksiyalar
1. ✅ So'rovnoma postda — `POST /api/posts/[id]/poll` (muallif, 10 daqiqa ichida, 2–4 variant, takrorsiz), `POST /api/posts/[id]/poll/vote` (ovoz/almashtirish/qaytarish; jamoa posti — faol a'zo, profil posti — blok tekshiruvi), lentada `poll` maydoni, kompozitorda so'rovnoma tahrirlagichi, kartada foizli chiziqlar — `lib/groups/posts-extra.ts`, `api/posts/[id]/poll/**`, `PostParts.tsx` (PollBlock), `GroupFeed.tsx`
2. ✅ «Qiziq emas» — `POST /api/posts/[id]/hide` (o'z postini yashirib bo'lmaydi), lentadan chiqadi (`notHiddenCondition`), kartada «Post yashirildi · Bekor qilish» — `api/posts/[id]/hide/route.ts`, `lib/feed.ts`
3. ✅ Muallifni lentadan yashirish — `GET/POST /api/feed/mute` (`feed_mutes`), lenta `notMutedCondition`, menyuda «<Ism> postlarini yashirish», bekor qilish, shu muallifning boshqa postlari ham lentadan olinadi — `api/feed/mute/route.ts`, `HomeFeed.tsx`
4. ✅ «N ta yangi post» pilyulasi — `GET /api/feed/new?since=&scope=&tag=` (o'z postlari sanalmaydi, 50 gacha), 45 soniyada bir faqat ko'rinadigan tabda (`useVisibleInterval`), bosilganda yangilanadi va tepaga — `api/feed/new/route.ts`, `HomeFeed.tsx`
5. ✅ Cheksiz aylantirish — sentinel (600px oldindan) keyingi sahifani yuklaydi, «Yana» tugma zaxira, ikki marta so'rov ketmaydi — `shared.tsx` (`useInfiniteSentinel`), `HomeFeed.tsx`
6. ✅ Havola kartasi (Open Graph) — `GET /api/posts/preview?url=` server tomonda: 4 s timeout, 300 KB, faqat ommaviy http(s) hostlar (xususiy IP/localhost rad), 1 soat kesh (xato — 5 daqiqa), rasm yo'q (CSP); kartada sayt nomi/sarlavha/tavsif, ko'rinishga kirganda yuklanadi — `posts-extra.ts` (`fetchLinkPreview`), `api/posts/preview/route.ts`, `PostParts.tsx` (LinkPreviewCard)
7. ✅ Hashtag filtri — `/?tag=montaj` va `GET /api/feed?tag=` (LIKE + aniq moslik `extractTags`), RichText'dagi #teg endi lentaga olib boradi, tepada chip + «Tozalash», bo'sh holat `#teg bo'yicha post yo'q` — `lib/feed.ts`, `lib/groups/limits.ts` (`HASHTAG_RE/extractTags/normalizeTag`), `HomeFeed.tsx`
8. ✅ Trend teglar — o'ng panelda so'nggi 7 kun ochiq postlaridagi eng ko'p teglar (`trendingTags`), `/?tag=` ga havola — `posts-extra.ts`, `RightRail.tsx`
9. ✅ Ulashish menyusi — bitta `ShareAction`: tizim oynasi (telefon), havola nusxasi, Telegram, kirganlar uchun «Xabarda yuborish» (suhbatlar `GET /api/chat`, yuborish `POST /api/chat/<id>`) — `Reactions.tsx`
10. ✅ Doimiy havola — vaqt `<time>` elementi permalinkka havola (jamoa / profil / `/?post=`), title'da aniq sana — `shared.tsx` (`RelativeTime`), `GroupFeed.tsx`
11. ✅ Izohlarni saralash — `GET …/comments?sort=old|new` + UI «Eski/Yangi» — `posts-extra.ts` (`listCommentsX`), `api/posts/[id]/comments/route.ts`
12. ✅ Izohga javob (1 daraja) — `replyToId` (javobga javob asl izohga bog'lanadi), «Javob» tugmasi `@taxallus` qo'yadi, iqtibos chiziqchasi «<Ism>ga javob», javob berilgan muallifga xabar — `posts-extra.ts` (`addCommentX`)
13. ✅ Izohni tahrirlash — `PATCH /api/comments/[id]` (faqat muallif, 15 daqiqa), «tahrirlangan» belgisi aniq sana bilan — `api/comments/[id]/route.ts`, `GroupFeed.tsx`
14. ✅ Klaviatura: J/K — postlar bo'ylab fokus (markazga), L — yoqtirish, C — izohlar, S — saqlash (maydon ichida ishlamaydi; `data-action` orqali) — `HomeFeed.tsx`
15. ✅ «Obunalarim» bo'sh holati — tavsiya ijodkorlar ro'yxati obuna tugmasi bilan — `HomeFeed.tsx`, `page.tsx`
16. ✅ Saqlanganlar soni hikoyalar qatorida (kirganlar uchun, `savedCount`) — `Stories.tsx`, `posts-extra.ts`
17. ✅ Tahrir vaqti — `posts.edited_at` (PATCH yozadi), «tahrirlangan» ustida `Tahrirlangan: <sana>` — `api/posts/[id]/route.ts`, `lib/feed.ts`
18. ✅ Rasm lightbox — chap/o'ng, swipe (pointer), Esc, hisoblagich «1 / 3», fokus yopish tugmasiga va yopilgach ochgan tugmaga qaytadi — `PostParts.tsx` (Lightbox, MediaGrid)
19. ✅ Video: 60% ko'rinishda ovozsiz avtoijro, chiqsa pauza, ovoz tugmasi, reduced-motion'da oddiy boshqaruv (seed'da video post yo'q — kod darajasida, vizual tekshiruv yo'q) — `PostParts.tsx` (FeedVideo)
20. ✅ Kompozitor qoralamasi — localStorage (manba kaliti), «Qoralama tiklandi · Tozalash», yuborilgach o'chadi — `GroupFeed.tsx` (Composer)
21. ✅ Kompozitor: Ctrl/⌘+Enter yuboradi, clipboard'dan rasm (paste), sudrab tashlash (drop, karta konturi yonadi) — `GroupFeed.tsx`, `MentionInput.tsx` (`onPaste/onFocus/onBlur/inputRef`)
22. ✅ «Kim reaksiya qo'ydi» — `GET /api/posts/[id]/reactions?kind=` (yopiq jamoa — faqat ko'ra oladiganlar), reaksiya bo'yicha filtr chiplari, desktop modal / telefonda pastdan — `Reactions.tsx` (ReactorsButton, MiniDialog)
23. ✅ Lenta turi eslab qolinadi — `lenta_scope` cookie (`ScopeTabs`), `page.tsx` `?scope` bo'lmasa cookie'dan oladi
24. ✅ Orqaga qaytganda joy tiklanadi — yuklangan sahifalar + cursor + scrollY sessionStorage'da (10 daqiqa), faqat klientda tiklanadi — `HomeFeed.tsx`
25. ✅ `/?post=<id>` — shu post tepada, belgilangan (`feedItemById`: blok/ban/yopiq jamoa tekshiruvi) — `lib/feed.ts`, `page.tsx`
26. ✅ Menyuda «Matnni nusxalash», «Havolani nusxalash»; «Tepaga» suzuvchi tugma 2 ekrandan keyin — `GroupFeed.tsx`, `HomeFeed.tsx`
27. ✅ Yangi post yuborilgach to'liq qayta yuklanmaydi — `GET /api/posts/[id]` (yangi) bilan faqat shu post tepaga qo'shiladi (bosh sahifa `feed:posted` hodisasi; jamoa/profil lentasida ham) — `api/posts/[id]/route.ts`, `HomeComposer.tsx`, `GroupFeed.tsx`

## B. Tuzatilgan buglar
1. ✅ Bosh sahifada post joylangach yangi post lentada chiqmas edi (`router.refresh` HomeFeed holatini yangilamaydi) → `feed:posted` hodisasi, post darhol tepada — `HomeComposer.tsx`, `HomeFeed.tsx`
2. ✅ «tahrirlangan» belgisi izoh qoldirilgan har qanday postda chiqardi (`addComment` `updatedAt`ni yangilaydi) → lenta `edited_at` bo'yicha (eski postlar: izohsiz bo'lsa updatedAt farqi) — `lib/feed.ts`
3. ✅ `kabinet/postlar`: `apiBase` ga `?cursor=` noto'g'ri ulanardi (`?user=…?cursor=`) va reload 422 bilan jim yiqilardi → `withQuery` (`?`/`&`), yangi post `GET /api/posts/[id]` bilan qo'shiladi — `shared.tsx`, `GroupFeed.tsx`
4. ✅ RichText: `ism@domen.uz` ichidagi `@domen` eslatma havolasiga aylanardi → oldida harf/raqam/nuqta bo'lsa eslatma emas (lookbehind) — `RichText.tsx`
5. ✅ RichText: 60–68 belgili havola ko'p nuqtasiz kesilardi → qisqartirilganda har doim «…», title'da to'liq havola
6. ✅ RichText: havola oxiridagi `»`, `”`, `"`, `]` havolaga kirardi; qavs ichidagi (vikipediya) havolaning `)`i kesilardi → kengaytirilgan tozalash + qavs balansi
7. ✅ Nisbiy vaqt hydration xatosi (server «hozirgina», klient «1 daqiqa oldin») va ru tilida o'zbekcha matn → `RelativeTime` (`suppressHydrationWarning`, har daqiqa yangilanadi, uz/ru ko'plik) — `shared.tsx`, `dict/feed.ts`
8. ✅ Efir blokida «N daqiqadan keyin» va jonli/o'tgan holati server/klientda farq qilardi (className mismatch) → serverda neytral holat, klientda `useNow` — `GroupFeed.tsx` (EventBlock)
9. ✅ Kompozitor: `.mov/.webm` faylda brauzer `type` bo'sh bersa «faqat rasm yoki video» deb rad etilardi → kengaytma bo'yicha zaxira tekshiruv
10. ✅ Kompozitor: limitdan ortiq fayl tanlanganda qolganlari indamay tashlanardi → toast «Ko'pi bilan 4 ta fayl — qolgani qo'shilmadi»
11. ✅ Kompozitor: o'tgan vaqtga efir e'lon qilish mumkin edi (faqat server rad etardi) → klientda «Efir vaqti kelajakda bo'lsin», tugma o'chadi
12. ✅ Kompozitor va izoh xato matnlari `role="alert"` emas edi → ekran o'quvchi eshitadi, CSS avtomatik silkitadi
13. ✅ Izohni o'chirish tasdiqsiz va xatoda jim → «O'chirilsinmi? Ha/Yo'q» + xatoda toast, chiqish animatsiyasi
14. ✅ Izohlar yuklanmasa «Yuklanmoqda…» abadiy qolardi → xato holati + «Qayta urinish»
15. ✅ Izohlar soni `items.length` bo'yicha (100 tadan ko'p bo'lsa noto'g'ri) → API `total`, UI shu sonni ko'rsatadi, «Yana N ta izoh» eslatmasi
16. ✅ Reaksiya: telefonda uzoq bosib barmoqni olib qochilsa `suppressClick` qolib keyingi bosish yutilardi → tanlagich yopilganda/pointercancel'da tozalanadi — `Reactions.tsx`
17. ✅ Reaksiya tanlagichi klaviaturadan (↑) ochilganda fokus kirmas, ←/→ ishlamas, Esc fokusni qaytarmas edi → fokus joriy variantga, ←/→ aylanadi, Esc tugmaga qaytaradi
18. ✅ @ro'yxat: bir sahifadagi bir nechta maydon bir xil `id="mention-listbox"` ishlatardi (`aria-controls` noto'g'ri), `aria-activedescendant` yo'q, variant tugmalari Tab tartibida edi → `useId`, option id'lari, `tabIndex=-1`, Home/End — `MentionInput.tsx`
19. ✅ Ko'rish hisobi fon tabda (sahifa yashirin) ham yozilardi → `visibilityState` tekshiruvi, yashiringanda taymer to'xtaydi, qaytganda qayta — `useViewTracker.ts`
20. ✅ «Yana» xatosi jim edi (foydalanuvchi nima bo'lganini bilmasdi) → `role=alert` matn + «Qayta urinish»
21. ✅ Postni o'chirish xatosi jim edi → toast (o'chirilgach ham «O'chirildi»)
22. ✅ Izoh tugmasida aria-label yo'q edi (faqat son) → «Izohlar (N)», `aria-expanded`
23. ✅ Hikoyalar havolasida faqat `title` → `aria-label` «<Ism> — yangi postlar», efir/saqlangan ham
24. ✅ `FEED.members` ru ko'pligi «1 участников» → `ruPlural` (участник/участника/участников); yangi satrlar ham ko'plik bilan — `dict/feed.ts`
25. ✅ Yopiq jamoaga a'zo bo'lmagan kirgan foydalanuvchiga izoh yoza olmaslik sababi ko'rinmas edi → «Izoh yozish uchun jamoaga qo'shiling»
26. ✅ Lenta «Yana» tez-tez bosilsa yoki sentinel ikki marta ishlasa takror so'rov ketardi → `loadingRef` qulfi
27. ✅ `postPermalink` slug'siz muallif uchun `null` qaytarardi — ulashish tugmasi yo'qolardi → `/?post=<id>` zaxira, bosh sahifa shu postni ochadi
28. ✅ Kompozitordagi yashirin `<input type=file>` (sr-only) Tab tartibida edi → `tabIndex=-1`

## C. Dizayn va animatsiya tuzatishlari
1. ✅ PostCard hover: soya (`shadow-2`) → v3 yassi `card-hover` (kontur quyuqlashadi), klaviatura fokusida kontur — `GroupFeed.tsx`
2. ✅ Karta pastki qatori ikonkalari bir xil 18px (yurak, izoh, ulashish, saqlash; ilgari 14–17) — `Reactions.tsx`, `GroupFeed.tsx`
3. ✅ Sarlavha amallari bitta «…» menyuga: `pop-in/pop-out`, `role=menu`, ↑↓, Esc fokusni qaytaradi, tashqariga bosish yopadi — `PostParts.tsx` (PostMenu)
4. ✅ Izohlar paneli chiqish animatsiyasi (`usePresence` + `expand-out`; ilgari xom `{open && …}`)
5. ✅ Yangi izoh `animate-msg-in`, o'chirilgani `expand-out` bilan chiqadi
6. ✅ Kompozitor fokusgacha bir qatorli, fokusda 3 qator + asboblar paneli `expand-in`; so'rovnoma/efir panellari `expand-in`; media eskizlari `expand-in`
7. ✅ Yuklanish skeleti — «Yana» paytida 2 ta skelet karta (`PostSkeleton`, `skeleton` utility), kelganlar `stagger`
8. ✅ Hikoyalar halqasi: 24 soat ichida post qo'ygan — aksent, eskiroq — hairline; ichki avatar halqa/soyasiz (ikki halqa artefakti yo'q) — `Stories.tsx`
9. ✅ Lenta almashtirgichi (segment) yopishqoq: telefonda yuqori panel ostida, desktopda tepada, orqa fon `bg-bg` — `ScopeTabs.tsx`
10. ✅ Rasm yuklanganda so'nib kirish (`FadeImage`: opacity o'tishi; SSR'da yuklangan bo'lsa darhol) — `PostParts.tsx`
11. ✅ Radius izchilligi 14px: kompozitor media eskizlari (12→14), o'ng panel plitkalari (12→14), xarita plitkasi, so'rovnoma/havola kartasi
12. ✅ «Yangi postlar» pilyulasi `pop-in/pop-out` (usePresence), yopishqoq tepada
13. ✅ So'rovnoma chiziqlari kenglik o'tishi (500 ms ease-out), tanlangan variant `accent-soft` + qora kontur, boshqalar neytral
14. ✅ Lightbox `animate-modal-in/out` + fon `fade-in/out`, rasm `modal-in`
15. ✅ Ulashish menyusi `pop-in/pop-out`, faol holatda tugma `bg-fg/6`
16. ✅ «Kim reaksiya qo'ydi» / «Suhbatni tanlang» oynasi: desktop `modal-in/out`, telefonda pastdan `sheet-up/down` (MiniDialog)
17. ✅ Bo'sh holatlar bitta `FeedEmpty` (ikonka plitkasi + sarlavha + qisqa matn + amal) — lenta, jamoa lentasi, teg
18. ✅ Xato holatlari `role="alert"` (avtomatik silkinadi) + «Qayta urinish» (lenta, izohlar, reaksiya ro'yxati)
19. ✅ Kompozitor yuborish tugmasida `Spinner`, ikonka 16px; media tugmasida yuklash paytida Spinner
20. ✅ Video ustida ovoz tugmasi pastki o'ngda `animate-fade-in`, press
21. ✅ Havola kartasi: `card-outline` hairline, 14px radius, hover'da kontur, `expand-in`
22. ✅ Hashtag chipi `expand-in`, «Tozalash» press
23. ✅ Segment `aria-current="page"` + fokus halqasi (accent outline)
24. ✅ Sarlavha/menyu tugmasi 36px (teginish maydoni), `press`; izoh/ulashish tugmalari `min-w-9`
25. ✅ «Tepaga» tugmasi `card-floating` dumaloq, `pop-in/pop-out`
26. ✅ Reaksiya va izoh sonlari almashganda `animate-swap`
27. ✅ O'chirish tasdig'i alohida `expand-in` qator (`role=alertdialog`) — sarlavha tugmalari siljimaydi
28. ✅ @ro'yxat `pop-in` bilan ochiladi, faol variant ko'rinishga suriladi
29. ✅ «Qiziq emas»/mute holati karta o'rnida `expand-in` chiziq (ko'z ikonkasi + bekor qilish)
30. ✅ Pastki panel `-mx-1.5` — ikonkalar karta chetiga tekis, bir xil `h-9` balandlik

## D. Minimalizm
1. ✅ Karta pastki qatorida chegara (`border-t`) olib tashlandi — bo'shliq bilan ajratiladi
2. ✅ Izohlar bo'limida ikkinchi chegara olib tashlandi
3. ✅ Ko'rishlar soni pastki qatordan sarlavha meta qatoriga («2 soat oldin · 12 ko'rish»), 0 bo'lsa chiqmaydi
4. ✅ Jamoa chipi alohida qatordan sarlavhaga («Ism · Jamoa nomi»), «jamoasida/kanalida» so'zi olib tashlandi — `HomeFeed.tsx`, `GroupFeed.tsx`
5. ✅ Qadash/tahrir/o'chirish/shikoyat — 3–4 ta ikonka o'rniga bitta «…» (shikoyat menyu ichida)
6. ✅ «Qadalgan» pilyulasi → faqat pin ikonkasi (sr-only matn, title)
7. ✅ Ulashish matni olib tashlandi — faqat ikonka (hamma joyda bir xil)
8. ✅ Reaksiya va izoh soni 0 bo'lsa raqam chiqmaydi (yig'indi tugmasi ham yashirin)
9. ✅ Hashtag/eslatma rangi aksentdan `fg` (qalin) ga — aksent faqat havola, faol holat va semantik belgilar uchun — `RichText.tsx`
10. ✅ Kompozitor: hisoblagich faqat 80% dan keyin (qolgan belgilar; 95% dan keyin qizil), «Rasm/video 0/4» matni → ikonka + son (faqat >0), asboblar ikonka-tugmalar (aria-label/title)
11. ✅ Kompozitor efir paneli aksent fon/konturdan neytral `bg-fg/4` ga, matni qisqartirildi
12. ✅ Efir bloki: aksent doira va fon faqat jonli holatda, «Jonli efir / yig'ilish» → «Jonli efir»
13. ✅ Mehmon kartasi: blur dog'i olib tashlandi (v3 — nur dog'lari yo'q), matn qisqartirildi, bitta asosiy tugma + matnli «Kirish» — `page.tsx`
14. ✅ Hikoyalar qatori karta chegarasisiz (yassi tasma), elementlar 64px
15. ✅ O'ng panel: «men» kartasi bir qatorli havola, rasmiy kanal kartasi tavsifsiz bir qatorli (keyingi efir yoki «Kanalni ochish») — `RightRail.tsx`
16. ✅ O'ng panel plitkalari aksent fonidan neytral `bg-fg/5`, xarita plitkasi `bg-ink` → neytral
17. ✅ O'ng panel sarlavhalari bitta uslubda (`RailHead`: 13px fg-2 + bir xil «Barchasi»), xarita matni «14 hudud bo'yicha ijodkorlar»
18. ✅ Bo'sh holat matnlari qisqartirildi (sarlavha + 1 qator), «Yana yuklash» → «Yana», «Показать ещё» → «Ещё»
19. ✅ Jamoaga a'zo bo'lmaganlar uchun eslatmalar kartasiz, bir qatorli
20. ✅ Reaksiya tugmasi `title` matni qisqa («Yoqtirish · ushlab turing — reaksiyalar»)
21. ✅ `requireLogin`, «Yana», bo'sh holat, skelet, nisbiy vaqt — ikki komponentda takrorlangan kod bitta `components/feed/shared.tsx` ga
22. ✅ Lentadagi jamoa chipi ikonka + nom (max 14rem, truncate)
23. ✅ Izoh qatori amallari (Javob · Tahrirlash · O'chirish · Shikoyat) matnli, faqat hover/fokusda (telefonda doim), ikonka tugmalar o'rniga
24. ✅ Kompozitor placeholder'lari qisqartirildi («Nima yangilik?», «Kanal e'loni…»)
25. ✅ «E'lon qilish» → «Joylash», «Yuborilmoqda…» spinner bilan
26. ✅ Composer efir paneli matni va efir bloki havola yorlig'i («Yozuv/havola» → «Yozuv»)
27. ✅ Mehmon kartasi eyebrow ikonkasiz (`Sparkles` olib tashlandi), sarlavha 26→24px

## Tekshiruv
- curl (API): post + so'rovnoma yaratish (takror 409, bo'sh/takror variantlar tozalanadi), ovoz berish/almashtirish/noto'g'ri indeks 422, `GET /api/posts/[id]` (mehmon), `GET /api/feed?tag=montaj` (2 ta post), `GET /api/feed/new?since=` (mehmon va kirgan), `hide` (lentadan yo'qoladi, bekor, o'z posti 400), `mute` (muallif postlari 0, ro'yxat, bekor), `GET …/reactions`, izoh javob + `?sort=new` + `total`, `PATCH /api/comments/[id]` (muallif 200, begona 403), `preview` (localhost dev — sarlavha/tavsif; xususiy IP va ftp — null). Sahifalar 200: `/`, `/?tag=montaj`, `/?scope=following`, `/?post=<id>`, `/kabinet/saqlanganlar`, `/kabinet/postlar`.
- `npx tsc --noEmit` — o'z fayllarimda xato yo'q.
- Playwright (desktop 1440 light + mobil 390 dark; mehmon / mutaxassis / mijoz), HSCROLL yo'q, konsolda xato yo'q (dev'da `ERR_TUNNEL` — tashqi rasm xostlari, bog'liq emas):
  - `/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/feed/v1-sp-d_.png` — mutaxassis, desktop: so'rovnoma, meta qator, «…», trend teglar, saqlanganlar belgisi
  - `/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/feed/v1-cl-m_.png` — mijoz, mobil dark: ovoz berilgan so'rovnoma (foizlar, «Ovozni qaytarish»)
  - `/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/feed/v1-guest-d_tag_montaj.png`, `…/v1-guest-m_tag_montaj.png` — teg filtri chipi
  - `/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/feed/i-post-menu.png` — kompozitor so'rovnoma tahrirlagichi (yuborish holati)
  - `/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/feed/i-m-reactors.png` — «Kim reaksiya qo'ydi» pastdan (mobil)
  - `/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/feed/i-m-hidden.png`, `i-m-lightbox.png`, `i-share-dm.png`, `i-comments.png`, `v2-*.png` — interaktiv sinovlar (quyida)
- Interaktiv Playwright (`interact.mjs`, `verify2.mjs`): kompozitor yig'ilgan→kengayadi, so'rovnomali post → lentada tepada, qoralama tozalanadi, «…» menyu + Esc, izoh → javob → «Yangi» saralash, J/K/L klaviatura, ulashish menyusi + «Xabarda yuborish» oynasi, reaksiya tanlagichi ↑/Esc fokus, HSCROLL yo'q (390), ovoz berish → foizlar, «Qiziq emas» → bekor, lightbox Esc, «Kim reaksiya qo'ydi», havola kartasi, cheksiz aylantirish, «Tepaga», orqaga qaytganda joy, scope cookie, «Obunalarim» bo'sh holati, yangi post pilyulasi, `?post=`, qoralama tiklanishi, Ctrl+Enter. Natijalar — hisobot oxiridagi «Sinov natijalari».

## Boshqa sohalarga so'rovlar
- **groups** (`src/lib/groups/service.ts`): `toPostViews` da `edited` ni `posts.editedAt` bo'yicha hisoblash (PATCH route endi yozadi) — hozir izoh qo'shilganda `updatedAt` yangilanib jamoa/profil lentasida «tahrirlangan» noto'g'ri chiqadi; `listPosts` natijasiga `pollsFor(ids, viewer)` (posts-extra) ni biriktirish — jamoa lentasida so'rovnoma ko'rinsin; `addComment` da `posts.updatedAt` yangilashni olib tashlash mumkin.
- **profile** (`src/components/profile/PostModal.tsx`, `ProfileTabs.tsx`, `src/lib/profile/posts.ts`): o'z «Ulashish» tugmasi o'rniga `ShareAction` (dublikat), `Composer` ga `allowPoll`, `listProfilePosts` ga `pollsFor`, `timeAgo` o'rniga `RelativeTime`.
- **kabinet** (`src/app/kabinet/postlar/page.tsx`): `apiBase="/api/profil/postlar?user=<userId>"` — hozir `?user=` siz, reload/«Yana» 422 oladi (GroupFeed endi `?`/`&` ni to'g'ri ulaydi va yangi postni alohida so'rov bilan qo'shadi, lekin «Yana» uchun `user` kerak).
- **design** (`globals.css`): so'rov yo'q — faqat mavjud tokenlar/klasslar ishlatildi.

## Qoldirilgan / xavf
- Havola kartasida rasm yo'q (CSP `img-src` tashqi hostlarni cheklaydi) — faqat matn; prod'da tashqi fetch proxy'siz ishlaydi, sandbox'da tashqi hostlar yetib bormaydi (localhost bilan sinaldi).
- Video avtoijro vizual tekshirilmadi (seed'da video post yo'q), kod `IntersectionObserver` + `visibilityState` bilan.
- So'rovnoma hozircha bosh sahifa lentasi va `GET /api/posts/[id]` da; jamoa/profil ro'yxatlari `pollsFor` biriktirmaguncha so'rovnomani ko'rsatmaydi (so'rov yuqorida).
- «Qiziq emas» va mute faqat bosh sahifa lentasiga ta'sir qiladi (jamoa sahifasi va profil lentasi emas) — ataylab.
- Umumiy server yuklamasi (8 agent + dev kompilyatsiya) tufayli Playwright sinovlari uzoq timeout bilan qayta ishga tushirildi.
