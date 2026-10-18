# Ish (vakansiya / e'lon / buyurtma / obuna UI) — batch-800 hisoboti (2026-10-18)
Qisqa hisob: A 27 · B 22 · C 26 · D 25

Soha: `src/app/vakansiyalar/**`, `src/app/rezyumelar/**`, `src/components/vacancies/*`, `src/lib/vacancies/*`, `src/app/api/vakansiyalar|arizalar|rezyume/**`, `src/app/kabinet/vakansiyalar|arizalarim|rezyume|elonlar|takliflar/**`, `src/components/jobs/*`, `src/lib/jobs/service.ts`, `src/components/orders/OrderWizard.tsx|OrdersList.tsx`, `src/app/api/orders/[id]/ics`, `src/components/payments/PrintButton.tsx`, `src/app/chek/**`, `src/app/narxlar/**`, `src/app/kabinet/obuna/**`, `src/components/subscription/UsdHint.tsx`. Sxema (faqat qo'shimcha): `vacancies.apply_clicks`, `applications.viewed_at`, `applications.employer_note`, `resumes.view_count`, yangi jadval `vacancy_alerts` (`npx tsx scripts/db-sync.ts` qo'llandi).

## A. Yangi funksiyalar
1. ✅ Vakansiya qidiruvini saqlash + «yangi mos vakansiya» bildirishnomasi: `vacancy_alerts` jadvali, `GET/POST/DELETE /api/vakansiyalar/obuna`, `checkVacancyAlerts()` (kanonik querystring, oyna siljiydi, egasining o'z vakansiyasi sanalmaydi), admin uchun `?check=1`; UI `VacancyAlertButton` («Xabardor qil») /vakansiyalar va kasb sahifalarida, mehmon → kirish — `src/lib/vacancies/service.ts`, `src/app/api/vakansiyalar/obuna/route.ts`, `src/components/vacancies/VacancyAlertButton.tsx`
2. ✅ Ish beruvchi sahifasi `/vakansiyalar/kompaniya/[key]` (username yoki id): nom/kompaniya, a'zolik sanasi, barcha ochiq vakansiyalari, yopilganlar soni; kontakt yo'q — `src/app/vakansiyalar/kompaniya/[key]/page.tsx`, `employerProfile()`
3. ✅ Nomzodlar ro'yxatida holat bo'limlari (Barchasi/Yangi/Ko'rildi/Tanlovda/Qabul/Rad) sonlar bilan — `src/components/vacancies/ApplicantsList.tsx`
4. ✅ Nomzod uchun «ko'rildi N oldin» (`applications.viewed_at` — birinchi ochilishda yoziladi) — `service.ts setApplicationStatus`, `src/app/kabinet/arizalarim/page.tsx`
5. ✅ Javob SLA ishorasi «N kundan beri javobsiz» (3 kundan oshsa; nomzod va ish beruvchi tomonida) — `format.ts slaHint`
6. ✅ Rezyume PDF: chop etish uslubi (yon panel/qobiq yashirin, kartalar bo'linmaydi) + «Chop etish / PDF» tugmasi — `src/app/rezyumelar/[id]/page.tsx`
7. ✅ Rezyumeni katalogda yuqoriga ko'tarish («Yuqoriga», `PATCH /api/rezyume {action:"bump"}`, 24 soatda 1 marta → 429) — `src/app/api/rezyume/route.ts`, `ResumeForm.tsx`
8. ✅ Vakansiyadan nusxa olish: `/vakansiyalar/yangi?nusxa=<id>` (faqat egasi/admin), kabinetda «Nusxa» tugmasi; forma «Nusxani joylash» — `src/app/vakansiyalar/yangi/page.tsx`, `VacancyForm.tsx`
9. ✅ Kabinetda bir bosishda «+30 kun» / «Qayta ochish» (`ExtendVacancyButton`, muddat ≤7 kun yoki yopiq/o'tgan bo'lsa) — `src/components/vacancies/ExtendVacancyButton.tsx`
10. ✅ Tashqi ariza havolasi bosilishlari: `POST /api/vakansiyalar/[id]/tashqi` (sendBeacon, egasi sanalmaydi, IP limit), egasi panelida «N ta tashqi o'tish» — `apply_clicks`
11. ✅ Maosh chiplari (3/5/10 mln+) va `pay=set|neg` («Maosh ko'rsatilgan» / «Kelishiladi») filtri — `validators.ts`, `service.ts listVacancies`, `src/app/vakansiyalar/page.tsx`
12. ✅ Tez chiplar «Masofaviy» va «Yangi (48 soat)» (`fresh=1`) — o'sha sahifa
13. ✅ Kasb bo'yicha SEO sahifalar `/vakansiyalar/kasb/[slug]` (alohida title/canonical, ItemList JSON-LD, format chiplari, qidiruvni saqlash) — `src/app/vakansiyalar/kasb/[slug]/page.tsx`
14. ✅ Takliflarni solishtirish jadvali (narx bo'yicha; eng arzon/eng tez belgilanadi; tor ekranda o'z ichida aylanadi) — `src/components/jobs/OwnerProposals.tsx`
15. ✅ Saralanganda mutaxassisga bildirishnoma (`proposal_shortlisted`, e'lon havolasi) — `src/lib/jobs/service.ts reviewProposal`
16. ✅ Taklif xati shablonlari (5 tagacha, localStorage, mount'dan keyin o'qiladi) — `src/components/jobs/ProposalForm.tsx`
17. ✅ Chop etishda PDF fayl nomi (`PrintButton fileName` → `chek-RD-…`, `obuna-chek-…`, `rezyume-<ism>`) — `src/components/payments/PrintButton.tsx`, `src/app/chek/[paymentId]/page.tsx`, `src/app/kabinet/obuna/chek/[id]/page.tsx`
18. ✅ /narxlar: so'm ⇄ USD ko'rsatkichi (platforma `usdRate` kursi, `formatUsd`) — `src/components/subscription/UsdHint.tsx`
19. ✅ Buyurtma muddati `.ics` (`GET /api/orders/[id]/ics`, butun kun, 1 kun oldin eslatma, faqat tomonlar) + OrdersList'da «Kalendar» havolasi — `src/app/api/orders/[id]/ics/route.ts`, `src/components/orders/OrdersList.tsx`
20. ✅ Ish beruvchining nomzod haqida shaxsiy eslatmasi (`employer_note`, `PATCH {note}`, blur'da saqlanadi, nomzodga ko'rinmaydi) — `ApplicantsList.tsx`, `src/app/api/arizalar/[id]/route.ts`
21. ✅ «Ishga olindi» → «Vakansiyani yopasizmi?» taklifi (bir bosishda yopish) — `ApplicantsList.tsx`
22. ✅ Rezyume ko'rishlar soni (`resumes.view_count`; egasi va botlar sanalmaydi; faqat egasiga) — `bumpResumeView`, rezyume sahifasi va kabinet
23. ✅ Saralash «Ko'p ariza» (`sort=applications`) — `validators.ts`, `listVacancies`
24. ✅ Arizalarim: holat bo'limlari (`?holat=faol|qabul|rad`) sonlar bilan — `src/app/kabinet/arizalarim/page.tsx`
25. ✅ Arizalarim: «Sizga mos yangi vakansiyalar» (rezyume kasbi bo'yicha, hali ariza berilmagan, o'ziniki emas) — `suggestedVacanciesForUser`
26. ✅ Nomzodlar CSV eksporti (`?format=csv`, UTF-8 BOM, `;`, faqat egasi, audit) — `src/app/api/vakansiyalar/[id]/ariza/route.ts`, `applicantsCsv`
27. ✅ JobCard «Yangi» belgisi (48 soat, uz/ru) — `src/components/jobs/JobCard.tsx`

## B. Tuzatilgan buglar
1. ✅ Vakansiya ko'rishlari botlar/curl/skrinshotlarda ham oshardi → `isBotUserAgent` tekshiruvi (sinov: bot +0, Chrome +1) — `src/app/vakansiyalar/[id]/page.tsx`
2. ✅ `?page=99` diapazondan tashqarida «Hali vakansiyalar yo'q» bo'sh holat chiqardi → oxirgi sahifaga yo'naltirish (/vakansiyalar, /rezyumelar, kasb) — sahifalar
3. ✅ `region` filtri istalgan satrni qabul qilar, noto'g'ri qiymat faqat masofaviylarni ko'rsatardi → viloyat enum | `remote` (API 422, sahifada tashlanadi) — `validators.ts`
4. ✅ Kabinetga kirilganda birinchi vakansiya o'z-o'zidan ochilib, yangi arizalar egasi ko'rmay «ko'rildi» bo'lardi → faqat `?v=` bilan — `src/app/kabinet/vakansiyalar/page.tsx`
5. ✅ `PATCH {status:"viewed"}` tanlovdagi/qabul qilingan arizani orqaga qaytarardi → faqat yangi arizaga qo'llanadi (no-op) — `setApplicationStatus`
6. ✅ Ikki marta bosilgan/parallel ariza UNIQUE xatosi bilan 500 berardi → 409 — `applyToVacancy`
7. ✅ Nomzod tanlovdagi/qabul qilingan arizani API orqali qaytarib olib, hisobni buzardi → faqat yangi/ko'rilgan (409, CAS delete) — `withdrawApplication`
8. ✅ Yopiq (isPublic=false) rezyume bilan kelgan arizada «Rezyume» havolasi ish beruvchiga 404 berardi → shu nomzod ariza yuborgan vakansiya egasiga ochiq (kontakt baribir yo'q; sinov: mijoz 200, mehmon topilmadi, email chiqmaydi) — `getResumeView`
9. ✅ Rezyume `generateMetadata` ko'ruvchisiz chaqirilib, egasining yopiq rezyumesiga «topilmadi» sarlavha berardi → ko'ruvchi bilan, yopiqqa `noindex` — `src/app/rezyumelar/[id]/page.tsx`
10. ✅ «0 kun qoldi» → «Bugun tugaydi» (`daysLeftLabel`), ≤3 kun — ogohlantirish rangi — vakansiya sahifasi, kabinet
11. ✅ Meta description'da qator tashlashlar (vakansiya va rezyume) → bo'shliqlar normallashtirildi
12. ✅ Nomzod telefoni xom ko'rinishda, uzun email 390px'da kartadan chiqib ketardi → `formatUzPhone`, `break-all`/`min-w-0` — `ApplicantsList.tsx`
13. ✅ Arizani qaytarish (ApplyForm, WithdrawButton) va rezyumeni o'chirish xatosi foydalanuvchiga ko'rsatilmasdi → `role="alert"` xabarlar
14. ✅ ApplyForm'da «qaytarib olish» faqat `new` da ko'rinardi, server `viewed` ga ham ruxsat beradi → ikkalasi (server bilan bir xil)
15. ✅ Saqlangan vakansiyalarda yopilgan/muddati o'tganlar faqat xira edi, holat yozuvi yo'q → «Yopilgan / Muddati o'tgan» belgisi — `arizalarim`
16. ✅ `page` va `min` chegarasiz edi (katta offset/summa) → `max(1000)` / `max(1e9)` — `validators.ts`
17. ✅ Bo'sh nomzodlar holatida xom `/vakansiyalar/{id}` yo'li chiqardi → «Havolani nusxalash» tugmasi (toast)
18. ✅ Kabinetda «Nomzodlar» havolasi sahifani tepaga sakratardi → `scroll={false}`
19. ✅ ApplicantsList xatosi bitta umumiy satrda, busy paytida yashirin edi → har ariza uchun alohida `role="alert"`
20. ✅ Holat belgisi o'z TONE xaritasi bilan umumiy `Badge` ohanglaridan farq qilardi → `Badge` (bir xil ranglar hamma joyda)
21. ✅ VacancyCard'da uzun kompaniya nomi 390px'da sig'masdi → `truncate` + `min-w-0`; kasb sahifalarida chip qatorlari gorizontal aylanadi (sahifa HSCROLL yo'q)
22. ✅ Desktop filtr formasi yashirin `sort` selektini ham yuborib URLga `sort=newest` shovqini qo'shardi → saralash faqat havolalar orqali; `PATCH {status:"closed"}` applyUrl'ni saqlashi curl bilan tasdiqlandi (xavf yo'q)

## C. Dizayn va animatsiya tuzatishlari
1. ✅ Holat belgisi almashganda `animate-badge-pop` (key=status) — `StatusBadge`
2. ✅ ApplicantsList: amal tugmalari `.press`, ro'yxat `.stagger`
3. ✅ ApplicantsList: eslatma paneli va «vakansiyani yopasizmi?» `.expand-in`
4. ✅ ApplyForm: yuborilgan holat `.expand-in`, belgi `animate-pop`; tashqi havola `.press`
5. ✅ WithdrawButton tasdiq qatori `.expand-in`, tugmalar `.press`
6. ✅ VacancyForm: o'chirish tasdig'i `.expand-in`, format radio chiplari `.press`
7. ✅ ResumeForm: o'chirish tasdig'i `.expand-in`
8. ✅ SaveVacancyButton: xom `active:scale` → `.press`, aria-label
9. ✅ Skelet: `/vakansiyalar/[id]/loading.tsx`
10. ✅ Skelet: `/rezyumelar/[id]/loading.tsx`
11. ✅ Skelet: `/kabinet/vakansiyalar/loading.tsx`
12. ✅ Skelet: `/kabinet/arizalarim/loading.tsx`
13. ✅ Skelet: `/kabinet/rezyume/loading.tsx`
14. ✅ Mobil filtr: qo'shimcha filtrlar `<details>` ichida (faol bo'lsa ochiq, nuqta belgisi), kontent `.expand-in`; kasb/tez chiplar qatori telefonda aylanadi
15. ✅ Radius izchilligi: ApplicantsList 16/12 → 14/10, OrderWizard plitkalari 16 → 14
16. ✅ Buyurtma sehrgari: qadam o'tishlari yo'nalishga qarab `animate-slide-left/right` (oldinga/orqaga), plitkalar `.press`
17. ✅ JobOwnerActions: yopish tasdig'i `.expand-in`, tugmalar `.press`
18. ✅ MyProposalCard: qaytarib olish tasdig'i `.expand-in`, `.press`
19. ✅ OwnerProposals: qabul tasdig'i va solishtirish jadvali `.expand-in`, «Solishtirish» `.press`
20. ✅ `.stagger`: kabinet vakansiyalar, arizalarim, e'lonlar, takliflar ro'yxatlari
21. ✅ Vakansiya sahifasi bo'limlari `data-reveal`
22. ✅ UsdHint: qiymat almashganda `animate-swap`
23. ✅ VacancyAlertButton: ichki forma `.expand-in`, Escape yopadi, fokus nomga
24. ✅ ProposalForm shablon qatori `.expand-in`
25. ✅ ExtendVacancyButton: bajarilayotganda `animate-spin`, `.press`; kabinet tugmalari `.press`, chevron `transition-transform`
26. ✅ Vakansiya sahifasi: «Muddati» ≤3 kun ogohlantirish ohangida; kabinet ham

## D. Minimalizm
1. ✅ VacancyCard faqat asosiysi: format, lavozim, kompaniya · kasb, maosh, vaqt (kasb/bandlik chiplari, ko'nikmalar, arizalar soni, 5 ta ikonka olib tashlandi)
2. ✅ Vakansiya sahifasi sarlavhasi: 4 chip → 1 chip + bitta matn qatori; Building2/Clock/Wallet/MapPin ikonkalari yo'q
3. ✅ Vakansiya sahifasi: takroriy «Arizalar/Ko'rishlar» kartasi → oddiy `dl` (Arizalar, Joylangan, Muddati)
4. ✅ Xavfsizlik eslatmasi 2 qatorga qisqardi
5. ✅ Talablar belgisi accent → neytral (aksent faqat asosiy amalga)
6. ✅ ResumeCard: izoh matni olib tashlandi, chiplar → bitta matn qatori, ikonkalarsiz
7. ✅ /vakansiyalar: eyebrow va tavsif qisqardi, pastki CTA'da ikonka plitkalari yo'q, matn qisqa
8. ✅ /vakansiyalar filtr formasi: 5 ta select → qidiruv + format + yig'iladigan qo'shimchalar
9. ✅ /rezyumelar: tavsif qisqardi, «Vakansiyalar» tugmasidagi ikonka yo'q
10. ✅ Rezyume sahifasi: chiplar → matn, Wallet/MapPin ikonkalari yo'q, uchinchi CTA («Vakansiya joylash») olib tashlandi, aloqa matni qisqa
11. ✅ Kabinet eyebrow'larida dekorativ accent ikonkalar olib tashlandi (vakansiyalar, arizalarim, rezyume, e'lonlar, takliflar)
12. ✅ kabinet/vakansiyalar: meta qatordagi Users/Eye/Clock ikonkalari yo'q, tugmalar matnli, sarlavha matni qisqa
13. ✅ kabinet/elonlar: MapPin/Wallet/MessageSquareText/Eye/Clock ikonkalari → bitta matn qatori
14. ✅ kabinet/takliflar: Wallet/CalendarClock/Clock ikonkalari olib tashlandi
15. ✅ ApplicantsList: Mail/Phone/MessageCircle/UserRound/ExternalLink ikonkalari yo'q, ko'nikmalar 6 ta + «+N»
16. ✅ Ikki xil holat belgisi (StatusBadge TONE + Badge) → bitta `Badge`
17. ✅ ApplyForm maxfiylik eslatmasi bir jumla
18. ✅ VacancyForm maosh ishorasi va pastki izoh qisqardi
19. ✅ ResumeForm «Katalogda ko'rinsin» tavsifi qisqardi
20. ✅ JobCard: kategoriya ikonkasi va Wallet ikonkasi olib tashlandi
21. ✅ OrderWizard: «Tanlovni keyin o'zgartirishingiz mumkin» matni olib tashlandi
22. ✅ /narxlar tinchroq: icon-tile'lar, BadgePercent, eyebrow ikonkalari yo'q; faqat bitta ajratilgan reja (hairline border, `card-elevated` emas), CTA kartasi yassi
23. ✅ /kabinet/obuna: imtiyozlar ro'yxati ikonkasiz (hairline bo'lingan), sarlavha matnlari qisqa, «Tarix» ikonkasi yo'q
24. ✅ /vakansiyalar/yangi va kabinet/rezyume tavsiflari qisqardi
25. ✅ Vakansiya sahifasida «boshqa vakansiyalari» sarlavhasi ish beruvchi sahifasiga havola — alohida tugma o'rniga

## Tekshiruv
- curl (`/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/work/api-test.sh`, log `api-test.log`): vakansiya yaratish (mijoz), filtrlar `pay=set|neg`, `fresh=1&sort=applications`, `min`, `region=xxx` → 422; ariza (201), takror (409), o'z vakansiyasiga (400); nomzodlar — egasi 200 / boshqa 403; CSV (BOM, sarlavha); `PATCH viewed` (viewedAt yoziladi), `note`, bo'sh (422), begona (403), `shortlisted`, keyin `viewed` no-op; hired → qaytarib olish 409; tashqi bosish (mehmon 200, egasi sanalmaydi; `applyClicks` egasiga 1, boshqaga 0); alert yaratish/takror 409/ro'yxat/`check` (sp 403, admin 200) → yangi mos vakansiya qo'shilgach `notified:1` va `saved_search` bildirishnomasi; rezyume PUT → bump 429 → 25 soatdan keyin 200; yopiq rezyume: ish beruvchi 200 (email yo'q), mehmon topilmadi; ko'rishlar: bot +0, Chrome +1 (vakansiya va rezyume); `.ics` — tomon 200 `text/calendar`, mehmon 401; `PATCH {status:"closed"}` applyUrl saqlanadi, `extend` qayta ochadi; jobs `shortlist` → `proposal_shortlisted` bildirishnoma; ommaviy JSON'larda email/telefon yo'q.
- Playwright (`shots.mjs`, 17 sahifa × desktop 1440 light + mobil 390 dark, HSCROLL va konsol xatolari): natija `shots-report.txt`, skrinshotlar `/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/work/<nom>-desktop-light.png|mobile-dark.png`.
- `npx tsc --noEmit` — soha fayllarida xato yo'q.

## Boshqa sohalarga so'rovlar
- `src/app/api/cron/daily/route.ts` (integrator/boshqa agent): (m) qadam qo'shish — `import { checkVacancyAlerts } from "@/lib/vacancies/service"` va `counts.vacancyAlerts = await checkVacancyAlerts(now)` (try/catch ichida). Funksiya tayyor va `GET /api/vakansiyalar/obuna?check=1` (admin) bilan sinalgan.
- `src/app/sitemap.ts`: `PROFESSIONS` bo'yicha `/vakansiyalar/kasb/<slug>` (priority 0.6, weekly) va ish beruvchi sahifalari (ixtiyoriy) qo'shish.
- `src/lib/i18n/dict/*`: vakansiyalar moduli hozircha faqat uz (dict yo'q) — ru juftligi alohida blok sifatida keyingi bosqichda.

## Qoldirilgan / xavf
- Yo'q sahifalar (`/vakansiyalar/<yoq-id>`, `/vakansiyalar/kasb/<yoq>`, `/rezyumelar/<yoq>`) oldingidek «soft 404» (HTTP 200 + topilmadi) — sabab: `src/app/vakansiyalar/loading.tsx` va `rezyumelar/loading.tsx` butun segmentni Suspense'ga o'raydi. Yechim: katalog page+loading'ni `(royxat)` route-guruhiga ko'chirish (`ishlar` kabi) — fayl ko'chirish qoidasi tufayli qilinmadi.
- `vacancy_alerts` tekshiruvi cron'ga ulanmagan (yuqoridagi so'rov) — ungacha admin `?check=1` bilan qo'lda.
- Taklif shablonlari faqat shu brauzerda (localStorage) — qurilmalararo sinxron yo'q (ataylab: maxfiy matn serverga yuborilmaydi).
