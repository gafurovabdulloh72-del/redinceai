# Profil / katalog / qidiruv / xarita — batch-800 hisoboti (2026-10-18)

Qisqa hisob: A 29 · B 26 · C 25 · D 26 (hammasi bajarilgan; tekshiruv bo'limi quyida)

Soha: ommaviy ijodkor profili (`/mutaxassislar/[slug]`), katalog (`/mutaxassislar`), qidiruv (`/qidiruv`, ⌘K), xarita (`/xarita`), taqqoslash, qisqa havola (`/u/<kod>`), SEO landing (`/yonalish`).

## A. Yangi funksiyalar
1. ✅ Ulashish varaqi: nusxalash / Telegram / QR / tizim ulashuvi — `components/specialists/ShareButton.tsx`
2. ✅ QR kod generatori (sof SVG, kutubxonasiz, Byte mode, EC-M) — `lib/profile/qr.ts`
3. ✅ QR'ni yuklab olish: `GET /u/<kod>/qr` (image/svg+xml) — `app/u/[code]/qr/route.ts`
4. ✅ Qadalgan post (egasi profil postini qadaydi, 1 ta; lentada birinchi) — `api/profil/postlar/[id]/pin`, `lib/profile/posts.ts`, `ProfileTabs`
5. ✅ O'xshash ijodkorlar — umumiy ko'nikma/yo'nalish/hudud bo'yicha ballik saralash — `lib/queries.ts getSimilarSpecialists`
6. ✅ «Jamoalari» ommaviy bo'limi (ochiq jamoa/kanallar) — `lib/profile/groups.ts`, profil sahifasi
7. ✅ «Yo'l» — ish tajribasi + ta'lim bitta xronologik chiziqda, umumiy yillar — `components/profile/Timeline.tsx`
8. ✅ «Profil to'liqligi» (faqat egasiga): foiz + yetishmayotgan qismlar havolasi — `lib/profile/completeness.ts`, `components/profile/Completeness.tsx`
9. ✅ Ko'rishlar kunlik noyob (`profile_views` jadvali, user/IP+UA xeshi), egasiga «so'nggi 7 kun» — `schema.ts`, `lib/queries.ts`, profil sahifasi
10. ✅ Sharhlar saralash `?sharh=yangi|yuqori|past` — profil sahifasi + `components/specialists/ReviewSort.tsx`
11. ✅ Sharh «Foydali» ovozi (`review_votes` jadvali, `POST /api/reviews/[id]/helpful`) — `ReviewList`, `HelpfulButton.tsx`
12. ✅ Sharhlar «Yana ko'rsatish» (dastlab 4 ta) — `components/specialists/ReviewList.tsx`
13. ✅ Katalog ko'rinishi (to'r/ro'yxat) cookie'da eslab qolinadi — `Filters.tsx ViewToggle`, katalog sahifasi
14. ✅ Katalog: sahifada 24/48 tanlovi — `Filters.tsx PerPage`
15. ✅ Katalog filtri: ko'p uchraydigan ko'nikmalar chiplari (sonlar bilan) — `lib/queries.ts getSkillStats`, `Filters.tsx`
16. ✅ «Yaqinda ko'rilganlar» lentasi (localStorage, 8 ta) — katalog va profil — `components/specialists/RecentlyViewed.tsx`
17. ✅ Taqqoslash jadvaliga Ko'nikmalar / Tillar / Sharhlar soni qatorlari — `app/taqqoslash/page.tsx`
18. ✅ Taqqoslash paneli: har bir ijodkorni alohida olib tashlash — `CompareTray.tsx`
19. ✅ /qidiruv: yozish bilan qidirish (450 ms debounce, abort, URL sinxron) — `components/search/ExploreForm.tsx`
20. ✅ /qidiruv: so'nggi qidiruvlar + ommabop so'rovlar (bo'sh holat takliflari) — `ExploreForm.tsx`, `lib/queries.ts`
21. ✅ /qidiruv: natija turlari — jamoa / vakansiya filtri — `lib/search/service.ts`, `app/qidiruv/page.tsx`
22. ✅ Mos matnni ajratib ko'rsatish (highlight) — `components/search/Highlight.tsx` (qidiruv + ⌘K)
23. ✅ /qidiruv: «/» qidiruvga fokus, ↑/↓ natijalar bo'ylab — `components/search/ResultsKeyNav.tsx`
24. ✅ Xarita: hudud kartochkasida eng ko'p ko'nikmalar — `lib/map-stats.ts getRegionTopSkills`, `UzbekistanMap.tsx`
25. ✅ Xarita: `?hudud=` chuqur havola + «Hududni ulashish» — `app/xarita/page.tsx`, `MapExplorer.tsx`
26. ✅ Ish (portfolio) chuqur havolasi `?ish=<id>` — qidiruvdan to'g'ridan-to'g'ri ochiladi — `ProfileTabs`, profil sahifasi, `lib/search/service.ts`
27. ✅ Post oynasida Telegram orqali ulashish — `PostModal.tsx`
28. ✅ Profil sarlavhasida `@username` (nusxalanadi) — profil sahifasi, `components/profile/Handle.tsx`
29. ✅ Landing (yo'nalish) BreadcrumbList JSON-LD — `app/yonalish/landing.tsx`

## B. Tuzatilgan buglar
1. ✅ PostModal'da fokus qopqoni yo'q edi (Tab orqaga chiqib ketardi, yopilganda fokus qaytmasdi) → `useFocusTrap`
2. ✅ PostModal media varaqlagichda ←/→ ishlamasdi → klaviatura
3. ✅ PostModal matnlari faqat uz edi (Yopish/Ulashish/Oldingi/…) → `POST_OYNA` lug'ati
4. ✅ MediaTile `aria-label` «N ta ko'rish» faqat uz → til-mos + ko'plik
5. ✅ `?post=<yo'q id>` jimgina e'tiborsiz qolardi → «Post topilmadi» holati, URL tozalanadi
6. ✅ Video post joylangach «Videolar» soni yangilanmasdi → qayta hisob
7. ✅ Katalog: `?page=5` + natija 0 → «Hali mutaxassislar yo'q» noto'g'ri; → 1-sahifaga yo'naltirish
8. ✅ Bo'sh natija «Filtrlarni tozalash» `limit`ni yo'qotardi (ActiveFilters bilan nomuvofiq) → saqlanadi
9. ✅ `responseTimeLabel` faqat uz → til parametri (profil + taqqoslash)
10. ✅ Qidiruv takliflari hint'lari («Yo'nalish», «Hudud»…) faqat uz → klientda tur bo'yicha lug'at
11. ✅ ⌘K qidiruvida obunasi tugagan/yashirin profillar chiqardi → `listableCondition`
12. ✅ ⌘K: `aria-selected` tugmada (yaroqsiz ARIA), combobox roli yo'q → listbox/option
13. ✅ /qidiruv `type=people` + bo'sh so'rov → «Hali ommaviy kontent yo'q» yolg'on xabari → tushunarli matn
14. ✅ /qidiruv butunlay uz edi → `QIDIRUV` lug'ati (ru juftligi)
15. ✅ `compactCount(999 999)` → «1000K» → «1M»
16. ✅ Sharh formasi: yuklash tugamay yuborilsa jimgina hech narsa bo'lmasdi; 10 belgidan kam matn serverga ketardi → klient xabari
17. ✅ Galereya lightbox: chiqish animatsiyasi yo'q, ishora matni faqat uz → `usePresence` + lug'at
18. ✅ Karta ko'nikma chiplari: «+N» tugmasi `overflow-hidden` ostida qirqilardi → wrap
19. ✅ `SearchButton` aria/title faqat uz → til-mos
20. ✅ ShareButton: tizim ulashuvi bekor qilinsa ham «Nusxalandi» chiqardi → AbortError ajratiladi
21. ✅ Profil `?tab=`/`?post=` variantlari metadata'siz (dublikat kontent indekslanardi) → sarlavha qo'shimchasi + noindex
22. ✅ ProfileTabs: tabpanel/aria-controls yo'q, ←/→ bilan yurib bo'lmasdi → WAI-ARIA tabs
23. ✅ `SearchBox` takliflar keshi cheksiz o'sardi → 50 ta bilan cheklandi
24. ✅ Xarita sahifasi sarlavhasi faqat uz → lug'at
25. ✅ Ish (portfolio) oynasi URL'ga yozilmasdi (yangilansa yo'qolardi) → `?ish=` sinxron
26. ✅ Taqqoslash: javob vaqti «Odatda …» qirqib ko'rsatilardi (ru'da buzilardi) → qisqa variant

## C. Dizayn va animatsiya tuzatishlari
1. ✅ MediaTile hover zoom xom `scale-[1.04] duration-500` → `.img-zoom` tokeni
2. ✅ ProfileTabs: siljuvchi tab ostki chizig'i (transform o'tish) — har tabda alohida border o'rniga
3. ✅ Filtr chiplari bosilganda `.press`
4. ✅ Videolar yuklanayotganda 3×3 skelet plitkalar
5. ✅ Katalog kartalari/qatorlari inline `animationDelay` o'rniga `.stagger`
6. ✅ Muqova fade-in xom `animation:` inline → `animate-fade-in` tokeni
7. ✅ Radiuslar tokenlarga: hero 28/32 → `--r-lg`, PostModal 24 → `--r-lg`, lightbox 22 → `--r-lg`, galereya plitkasi 20 → `--r-md`, skeletlar
8. ✅ Isbot chiplari «tinch»: yashil ikonkalar → neytral, hairline
9. ✅ Sharh kartalari `.stagger`
10. ✅ Lightbox kirish/chiqish (`modal-in/out`)
11. ✅ Faol filtr chiplari: `card card-hover` soyali → hairline chip + `.press`
12. ✅ Sahifalash tugmalari `.press`
13. ✅ Hero holat/kategoriya pill'lari soya → hairline (v3 soyasiz)
14. ✅ Karta muqovasidagi chiplar soya → hairline
15. ✅ ProfileTabs bo'sh holatlar yagona `EmptyState`
16. ✅ /qidiruv natija plitkalari fokus halqasi + `hover-lift`
17. ✅ Ulashish varaqi `pop-in`/`pop-out` (usePresence)
18. ✅ ReviewForm bloklari `rounded-[16px]` → `--r-md`
19. ✅ ShortLink maydoni filled → kontur (v3 `.field` uslubi)
20. ✅ Video plitkalarida fokus halqasi (postlardagi bilan bir xil)
21. ✅ «Yana yuklash» tugmasi `.press` + markaz
22. ✅ Taqqoslash paneli chiqish animatsiyasi (`usePresence` + `slide-up` teskarisi)
23. ✅ Similar kartalar `hover-lift`
24. ✅ Qidiruv tur chiplari `.press` + faol holat `btn-ink`
25. ✅ Katalog bo'sh holat illyustratsiyasi `[data-reveal]`

## D. Minimalizm
1. ✅ ProfileTabs sarlavhasidagi «7 post · 2 video · 3 ish» dublikat qatori olib tashlandi (tablarda son bor)
2. ✅ Profil meta chiplari (4–5 ta konturli) → bir qatorli matn «·» bilan
3. ✅ Profil ko'nikmalari 8 tagacha + «+N»
4. ✅ Yon paneldagi reyting/sharh/ish statistikasi (hero va tablar bilan dublikat) olib tashlandi
5. ✅ Sharh kartasi: 3 ta mini chiziq → bitta qator «Sifat 5 · Muddat 4 · Muloqot 5»
6. ✅ Katalog kartasi: ko'nikma chiplari olib tashlandi (ism, kasb, hudud, narx, reyting)
7. ✅ Karta muqovasidagi chiplar: faqat kategoriya; «Top» — ism yonida ikonka
8. ✅ Filtr paneli «Boshqa»: 3 ta ramkali quti → hairline bilan ajratilgan qatorlar
9. ✅ Qisqaroq matnlar: katalog/qidiruv/xarita tavsiflari
10. ✅ Profil «Haqida» eyebrow + sarlavha dublikati → faqat sarlavha
11. ✅ Tajriba/Ta'lim/Sertifikat/Sharhlar bo'limlarida ortiqcha eyebrow olib tashlandi
12. ✅ Hero: `grain` qatlami olib tashlandi
13. ✅ Hero muqovasidagi «Top»/«Tanlangan» pill'lari → ism yonida kichik belgi
14. ✅ O'xshashlar bo'limi: eyebrow + tavsif olib tashlandi (sarlavha + «Barchasi»)
15. ✅ Katalog natija jumlasi: «· reyting bo'yicha» (select allaqachon ko'rsatadi) olib tashlandi
16. ✅ Sahifalash ostidagi «1 / 5 sahifa» matni olib tashlandi (aria saqlanadi)
17. ✅ ⌘K pastki ishoralar qatori qisqartirildi
18. ✅ ReviewSummary mezonlar o'rtachasi bitta qatorda
19. ✅ PostModal «Ulashish» matnli tugma → ikonka (boshqalar bilan bir xil)
20. ✅ Mobil «Qisqa havola» sarlavhasi olib tashlandi (maydon o'zi tushunarli)
21. ✅ Yon panel kartasi boshidagi kasb/hudud (hero dublikati) olib tashlandi
22. ✅ Karta pastki qismi: narx va reyting bir qatorda
23. ✅ /qidiruv sarlavhalaridagi bezak ikonkalar olib tashlandi
24. ✅ Xarita sahifasi eyebrow qisqartirildi
25. ✅ ProfileTabs tab yorliqlari UPPERCASE → oddiy yozuv
26. ✅ Taqqoslash izohi qisqartirildi

## Tekshiruv
- `npx tsc --noEmit | grep -v "^.next/types"` — soha fayllarida xato yo'q (oxirgi tekshiruv barcha o'zgarishlardan keyin).
- Sxema: `profile_views`, `review_votes` jadvallari qo'shildi (faqat qo'shimcha), `npx tsx scripts/db-sync.ts` — "✓ Sxema sinxronlandi".
- QR generatori mustaqil dekoder bilan tekshirildi (jsQR, Chromium canvas): v1/v3/v4/v7/v8/v10 — 7 ta namuna, hammasi to'g'ri dekodlandi; 214 bayt → null (sig'im chegarasi). Skript: `/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/profile/qr-test.mts`
- curl (200): `/mutaxassislar/dilnoza-nazarova` (+ `?tab=videolar`, `?post=yoq-id` → «Post topilmadi» holati, `?sharh=yuqori`, `?ish=seed-0000b-3tubc6` → Videolar tabi + ish oynasi), `/mutaxassislar` (+ `?view=list`, cookie `katalog_korinish=list` → qatorlar, `?page=99` → oxirgi sahifaga meta-refresh, `?page=3&q=zzz` → 1-sahifa), `/qidiruv?q=montaj` (data-result, data-search-input), `?type=people` → «So'z kiriting», `?type=groups&q=mon` → faqat Jamoalar, ru: `?q=монтаж`, `/xarita?hudud=samarqand` (+ «Hududni ulashish»), `/u/CP82B5/qr` (SVG 37×37 modul), `/u/zzzzzz/qr` → 404, `/api/search?q=diln`, `/taqqoslash?ids=…`, `/yonalish/videograf` (BreadcrumbList JSON-LD), `/mutaxassislar/otabek-ergashev` (6 ta «Foydali», saralash segmenti, «Yana 1 ta sharh»).
- curl API: `POST /api/profil/postlar/<id>/pin` — egasi ✓ (isPinned=true, lentada birinchi), mijoz → 403; `POST /api/reviews/<id>/helpful` — mijoz ✓ (voted/n), qayta → olib tashlanadi, o'z sharhiga → 400, mehmon → 401.
- Ko'rishlar: 2 ta mehmon so'rovi (bir xil IP+UA, haqiqiy UA) → `profile_views`da 1 qator, `viewCount` +1; mijoz ko'rishi → `u:<id>` qatori.
- ru lug'at: profil (Заполненность профиля, Путь, Сообщества, Похожие, «Обычно отвечает в течение 19 часов», «за 7 дней»), qidiruv, xarita sarlavhasi — tekshirildi.
- Playwright (1440 light, mehmon): HSCROLL=false; tablar ←/→ (aria-selected + URL `?tab=`); post oynasi — fokus ichida (12×Tab), Esc yopadi, `?post=` tozalanadi, fokus plitkaga qaytadi; ulashish varaqi — QR SVG + yuklab olish havolasi, Esc yopadi; katalogda «Yaqinda ko'rilganlar» lentasi; ro'yxat tugmasi → cookie `katalog_korinish=list`, URL toza; ⌘K — mos matn `<mark>` bilan; qidiruvda «/» fokus, ↓ natijaga o'tadi; xaritada «Hududni ulashish».
- Skrinshotlar (`/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/profile/`): `01-profile-guest-1440-light.png`, `02-post-modal-1440-light.png`, `03-share-qr-1440-light.png`, `04-catalog-1440-light.png`, `05-catalog-list-1440-light.png`, `06-palette-1440-light.png`, `07-qidiruv-1440-light.png`, `08-xarita-1440-light.png`, `09-profile-reviews-1440-light.png`, `10-owner-modal-pin-1440-light.png`, `11-profile-390-dark.png`, `12-catalog-390-dark.png`, `13-qidiruv-390-dark.png`, `14-xarita-390-dark.png`, `15-profile-reviews-390-dark.png`, `16-compare-390-dark.png`, `17-share-sheet-390-dark.png`, `18-owner-profile-1440-light.png`; jurnal: `shots.log`.
- Eslatma: dev server 8 agent yuki ostida vaqti-vaqti bilan javob bermay qoldi (health 000) — ba'zi brauzer qadamlari qayta ishga tushirildi; bitta `SyntaxError: Unexpected end of JSON input` (Next kesh/kompilyatsiya to'qnashuvi, qayta so'rovda 200) kuzatildi — kodimizda server tomonda JSON.parse yo'q.

## Boshqa sohalarga so'rovlar
- `src/lib/validators.ts` (umumiy): `specialistFilterSchema.sort` ga `"active"` (oxirgi faollik bo'yicha) qo'shilsa — katalogda «Faol» saralash tayyor bo'ladi (`listSpecialists` orderBy'ga `users.lastSeenAt` qo'shish kifoya).
- `src/lib/groups/service.ts` (groups sohasi): `toPostViews` allaqachon `isPinned` qaytaradi — o'zgarish shart emas; jamoa postlari uchun qadash o'z API'sida qoladi.
- Cron (`src/app/api/cron/**` egasi): `purgeOldProfileViews(30)` (`lib/queries.ts`) ni mavjud `purgeOldViews` yoniga qo'shish.
- `design` agent: `--r-*` tokenlariga ko'ra `.card-elevated` ichidagi `!rounded-[24px]`/`[28px]` qoldiqlari boshqa sahifalarda ham uchrashi mumkin.

## Qoldirilgan / xavf
- `src/lib/utils.ts` `compactCount` — umumiy faylda 1 qatorli tuzatish (999 500+ → «1M»); boshqa iste'molchilarga ta'siri faqat shu chegarada.
- Profil ko'rishlari endi kunlik noyob — `viewCount` o'sishi avvalgidan sekinroq (bu kutilgan; eski qiymatlar saqlanadi).
- Katalog kartasidan ko'nikma chiplari olib tashlandi (`SkillChips` komponenti profil sahifasida ishlatiladi); kerak bo'lsa bir qatorda qaytarish oson.
- `/taqqoslash` sahifasi asosan uz (faqat yangi qatorlar va javob vaqti tilga mos) — to'liq ru tarjima alohida ish.
- `/mutaxassislar?page=99` yo'naltirish `loading.tsx` (Suspense) sabab 200 + meta-refresh bilan (oldingi xatti-harakat), brauzerda to'g'ri ishlaydi.
