# Admin / Auth / Statik — batch-800 hisoboti (2026-10-18)
Qisqa hisob: A 32 · B 27 · C 27 · D 26

Foydalanuvchi skrinshotidagi /admin (dark, 1440) nuqsonlari BIRINCHI NAVBATDA tuzatildi: bo'lim sarlavhasi tekislanmasligi, bo'shliqlar, katta sarlavhalar, nomuvofiq strelkalar, 2×2 ikonka klasteri, uzun bio. Oldin/keyin skrinshotlari «Tekshiruv» bo'limida.

## A. Yangi funksiyalar
1. ✅ Tasdiqlash navbati filtrlari: qidiruv (ism/email/kasb), yo'nalish, hudud, «7+ kun» — faqat navbatda bor variantlar; bo'sh natija holati + «Filtrni tozalash» — `src/components/admin/AdminSpecialistsTable.tsx`
2. ✅ Ommaviy tasdiqlash / rad etish: qator va «hammasini tanlash» checkboxlari, pastki yopishqoq panel (pop-in/pop-out), sabab bilan rad, natija «N ta bajarildi · M tasida xato» — `AdminSpecialistsTable.tsx`
3. ✅ Umumiy qator «⋯» menyusi: role=menu/menuitem, pop-in/pop-out (usePresence), Escape/tashqariga bosish, fokus birinchi bandga va yopilganda tugmaga qaytadi, strelka/Home/End — `src/components/admin/AdminRowMenu.tsx`
4. ✅ Bio «ko'proq / kamroq» (2 qatorga qisqartirish, 140+ belgida tugma, aria-expanded) — `AdminSpecialistsTable.tsx`
5. ✅ Jamoalar va vakansiyalar moderatsiyasi API: ro'yxat + qidiruv, egasi/muallif, hisoblagichlar, jamoa postlari bo'yicha ochiq shikoyatlar soni — `src/app/api/admin/moderation/route.ts`
6. ✅ Jamoa egasini almashtirish (email bo'yicha, tranzaksiya: yangi ega owner, eski ega admin bo'lib qoladi, ikkalasiga bildirishnoma, audit) — `src/app/api/admin/moderation/groups/[id]/route.ts`
7. ✅ Jamoani yopiq/ochiq qilish va o'chirish (rasmiy kanal himoyalangan; egasiga bildirishnoma) — o'sha route
8. ✅ Vakansiyani yopish (ixtiyoriy sabab bilan) / qayta ochish / o'chirish — egasiga bildirishnoma, audit — `src/app/api/admin/moderation/vacancies/[id]/route.ts`
9. ✅ Vakansiya avto-bayroqlari: «oldindan to'lov so'raydi» (uz/ru regex) va «matnda kontakt» (@username, +998…, t.me/) — `vacancyFlags()` moderation route'da
10. ✅ Moderatsiya UI: Jamoalar/Vakansiyalar tablari (bayroq/shikoyat hisoblagichlari), qidiruv, inline panellar (ega emaili, yopish sababi, o'chirish tasdig'i), «Yana N ta» — `src/components/admin/AdminModeration.tsx`, bo'lim `#moderatsiya`
11. ✅ Spam filtri kutubxonasi: `getSpamFilter / saveSpamFilter / checkSpamText / checkSpam / assertNotSpam` — so'z chegarasi, translit/registrsiz, havola siyosati (ruxsat etilgan domenlar suffiks bo'yicha) — `src/lib/security/spam-filter.ts` (boshqa agentlar validatorlarda `assertNotSpam()` chaqiradi — pastdagi so'rov)
12. ✅ Spam filtri API: GET / PUT (audit `admin_spam_filter`) / POST «sinov» (saqlamasdan tekshirish) — `src/app/api/admin/settings/spam/route.ts`
13. ✅ SpamFilterPanel: so'zlar (har qatorda), havola cheklovi switch'i, domenlar, namuna matnni tekshirish, «Saqlanmagan o'zgarishlar» — `src/components/admin/SpamFilterPanel.tsx` (Sozlamalar bo'limida)
14. ✅ Efirlar kalendari: barcha kanallardagi `posts.eventAt` — API + kun bo'yicha guruhlangan UI («bugun» belgisi, efir havolasi, post) — `src/app/api/admin/events/route.ts`, `src/components/admin/AdminEvents.tsx`, bo'lim `#efirlar`
15. ✅ Tizim holati API: DB kechikishi (select 1, ms), saqlash backend'i, cron oxirgi ishlashi + xatolar soni + «eskirgan» belgisi, rate-limit faol kalitlar va top-5 prefiks, Telegram/email sozlanganligi, faol sessiyalar — `src/app/api/admin/health/route.ts`
16. ✅ Tizim holati kartasi (8 metrika, semantik holat nuqtalari, yangilash) — `src/components/admin/AdminHealthCard.tsx`, bo'lim `#tizim`
17. ✅ CSV eksport: foydalanuvchilar — joriy qidiruv/filtr bo'yicha (5000 tagacha), audit `admin_export` — `src/app/api/admin/users/route.ts` (`format=csv`), tugma UsersPanel'da
18. ✅ CSV eksport: mutaxassislar (`status=all|pending|verified`) — `src/app/api/admin/specialists/route.ts`
19. ✅ Umumiy CSV yordamchisi (formula-injection himoyasi, BOM, fayl nomi/sana) — `src/lib/security/csv.ts`; audit eksporti ham shunga o'tkazildi
20. ✅ Foydalanuvchiga admin izohi: sxema `users.admin_note/admin_note_at` (qo'shimcha ustunlar, db-sync bajarildi), PATCH `adminNote` (≤500, audit `admin_user_note`), UI: qo'shish/tahrirlash/o'chirish, qatorda ko'rinadi — `src/lib/db/schema.ts`, `src/app/api/admin/users/[id]/route.ts`, `src/components/admin/UsersPanel.tsx`
21. ✅ Audit jurnali qidiruvi `q` (nishon ID / harakat kodi / meta matni), «Tozalash» uni ham olib tashlaydi, CSV eksporti ham `q` ni oladi — `src/app/admin/queries.ts`, `src/app/admin/audit/page.tsx`, `src/app/api/admin/audit/route.ts`
22. ✅ Nizo: qaror oldidan buyurtma jurnali (timeline) — GET `/api/admin/orders/[id]/dispute` + inline ochiladigan ro'yxat (holat → holat, izoh, kim, qachon) — `src/app/api/admin/orders/[id]/dispute/route.ts`, `src/components/admin/AdminDisputes.tsx`
23. ✅ Payout navbati: qidiruv (ism/email/rekvizit) + holat segmenti (So'ralgan/Tasdiqlangan), 4+ so'rovda ko'rinadi — `src/components/admin/AdminPayoutsQueue.tsx`
24. ✅ Shikoyatlar: tur bo'yicha filtr chiplari (mavjud turlardan, hisoblagich bilan) — `src/components/admin/AdminReports.tsx`
25. ✅ Ommaviy xabar: jonli ko'rinish — «Saytda (qo'ng'iroqcha)» va «Telegramda» (tugma yorlig'i bilan) — `src/components/admin/AdminBroadcast.tsx`
26. ✅ Telegram inline tugma yorliqlari turga mos: «Efirga qo'shilish», «Arizani ko'rish», «Taklifni ko'rish», «Obunani uzaytirish» … (33 tur) — `src/lib/notifications.ts` (TG_BUTTON_LABEL, qo'shimcha)
27. ✅ Auth: Caps Lock eslatmasi (getModifierState, uz/ru, role=status, aria-describedby) — `src/components/auth/PasswordField.tsx`, `src/lib/i18n/dict/auth.ts` (`password.capsLock`)
28. ✅ Offline sahifa: aloqa tiklanganda avtomatik qaytish (online hodisasi → history.back / «/»), holat matni; GET forma JS'siz ishlayveradi — `src/components/pwa/OfflineRetry.tsx`, `src/app/offline/page.tsx`
29. ✅ Yordam maqolasi: har `h2` ga id + hover/fokusda «#» chuqur havola (scroll-mt) — `src/app/yordam/[slug]/page.tsx`
30. ✅ Smoke testlar: admin API mehmonga 401 (6 endpoint), robots Disallow ro'yxati, sitemap /haqida + lastmod, statik sahifalar canonical, auth autocomplete, admin sahifalar yo'naltirishi — `scripts/smoke.mjs` (17 test)
31. ✅ Loading skeletlari: `/admin/audit`, `/admin/obunalar` — `src/app/admin/audit/loading.tsx`, `src/app/admin/obunalar/loading.tsx`
32. ✅ Yangi audit harakatlari nomlari (spam filtri, izoh, jamoa egasi/yopiq/o'chirish, vakansiya yopildi/ochildi/o'chirildi, eksport) — `src/lib/security/audit.ts` (qo'shimcha)

## B. Tuzatilgan buglar
1. ✅ Bo'lim sarlavhasi (SectionHeading) tekislanmas edi: eyebrow ~100px tepada, o'ngdagi tavsif + «N ta kutmoqda» chipi boshqa balandlikda → ixcham admin sarlavhasi: sarlavha + ostida tavsif, chip bir qatorda — `src/components/admin/AdminSectionHeading.tsx`, `src/app/admin/page.tsx`
2. ✅ 4 ta stat karta va birinchi bo'lim orasidagi katta bo'shliq (mt-14/16) → mt-10/12; statistika mt-5
3. ✅ h1 «Boshqaruv markazi» 34/48px displey, bo'lim sarlavhalari 32px → h1 26/30px, bo'limlar 20/22px; audit/obunalar/buyurtma sahifalarida ham
4. ✅ Stat kartalarda burchak strelkasi 4 tadan 2 tasida → hamma karta havola (buyurtmalar → #faollik, sharhlar → #sharhlar), strelka hammasida
5. ✅ Navbat qatorida amallar klasteri (2 tugma + 2×2 ikonka) → Tasdiqlash + Rad etish + «⋯» (aria-label'lar bilan)
6. ✅ Uzun bio qatorni cho'zardi → 2 qatorga qisqartirish + «ko'proq»
7. ✅ h1 ikki qatorga tushardi (tugmalar guruhi kenglikni olardi) → chap blok flex-1, tugmalar max-w-55%
8. ✅ To'lovlar jadvali: `min-w-900` + yopishqoq «Amallar» «Holat» ustunini bosib qisib qo'yardi («Yar», «Qa»…) → `@container` + ustunlar yig'ilishi (Usul/Komissiya → Summa ostida), sticky olib tashlandi — `src/components/admin/AdminPaymentsTable.tsx`
9. ✅ To'lovlar filtr segmenti jami matni bilan bir qatorda kesilardi → flex-wrap, jami pastga tushadi
10. ✅ Scrollspy: IntersectionObserver bandi (20–35%) sahifa oxiridagi qisqa bo'limga yetmasdi — «Sozlamalar» hech qachon faol bo'lmasdi → pozitsiya asosida + «sahifa oxiri = oxirgi bo'lim» — `src/components/admin/AdminSectionNav.tsx`
11. ✅ Scrollspy: havola bosilganda faol belgi kechikardi → onClick darhol; `aria-current="location"`
12. ✅ Langar siljishi: desktopda sobit header yo'q, lekin `scroll-mt-28` (112px bo'sh joy) → `scroll-mt-20 md:scroll-mt-6`; o'ng nav `top-24` → `top-8`, balandlik hisob-kitobi
13. ✅ `loading.tsx` skeleti eski tartib (48px h1, chiplar hamma ekranda, xl 4 ustun) → yangi o'lchamlar, o'ng nav skeleti — `src/app/admin/loading.tsx`
14. ✅ Sitemap'da `/haqida` yo'q edi → qo'shildi — `src/app/sitemap.ts`
15. ✅ Sitemap: statik sahifalar `lastmod` har so'rovda «hozir» (qidiruv tizimi uchun yolg'on signal) → oferta/maxfiylik = TERMS_VERSION, statiklar = barqaror sana, katalog/xarita = eng so'nggi profil yangilanishi, yordam = eng so'nggi maqola
16. ✅ robots: `/chek/`, `/yozish/`, `/tolov`, `/offline` indekslanishi mumkin edi → Disallow — `src/app/robots.ts`
17. ✅ `/haqida` va `/oferta` canonical yo'q edi (maxfiylikda bor) → qo'shildi
18. ✅ Foydalanuvchilar: `lastLoginAt` API'dan kelardi, UI ko'rsatmasdi → «kirgan N oldin / hali kirmagan» (title'da aniq vaqt) — `UsersPanel.tsx`
19. ✅ Foydalanuvchilar: amal xatosi faqat ro'yxat tepasida inline (uzun ro'yxatda ko'rinmasdi) → toast (error) + inline; muvaffaqiyat ham toast
20. ✅ Foydalanuvchilar: ro'yxat yuklanmasa abadiy skeleton → xato xabari
21. ✅ Sharhlar: `MOBILE_CAP` faqat mobilda, desktopda 30 ta qator → hamma ekranlarda 10 + «Yana» — `AdminReviews.tsx`
22. ✅ Audit: `<time>` qaysi vaqt mintaqasi ekani noma'lum → title «Toshkent vaqti (UTC+5)»
23. ✅ Auth (kirish): email maydonida autoFocus yo'q, `autoCapitalize` yo'q (iOS «Siz@…» bosh harf qiladi) → `autoFocus` (faqat kirish), `autoCapitalize="none" autoCorrect="off" spellCheck=false`; parol maydonida ham `autoCapitalize="none"`; parolni tiklashda ham — `AuthForm.tsx`, `ResetRequestForm.tsx`, `PasswordField.tsx`
24. ✅ Inline tasdiq panellari (o'chirish/rad/blok/to'lov/qaror) a11y: `role="alertdialog"/"group"` + `aria-label` yo'q edi → qo'shildi (7 komponent)
25. ✅ To'lovlar jadvalidagi amal tugmalarida qaysi buyurtma ekani (aria) yo'q edi → `aria-label="<buyurtma>: <amal>"`
26. ✅ Tasdiqlash: ommaviy tanlov checkboxlari va «hammasini tanlash» aria-label'siz → qo'shildi
27. ✅ Admin sahifalar eyebrow ikonkasi aksent rangda (dekorativ aksent) → kulrang 12px, `aria-hidden`

## C. Dizayn va animatsiya tuzatishlari
1. ✅ Bo'lim sarlavhalari `[data-reveal]` bilan kiradi (CSS scroll-driven; real nav bosishda opacity 1 tekshirildi)
2. ✅ Stat plitkalar: yassi `card` + hairline, ikonka plitkasiz, yorliq tepada, qiymat 22/24px `tabular-nums`, hover strelka rangi
3. ✅ Scrollspy faol belgisi — 2px chiziq bandlar orasida silliq siljiydi (`transition-[top,height]`, reduced-motion'da o'chadi), matn `transition-colors`
4. ✅ O'ng nav faol bandni ko'rinib turishini ta'minlaydi (ro'yxat ichida scrollTo)
5. ✅ «⋯» menyu `pop-in / pop-out` (usePresence), `card-floating`
6. ✅ Ommaviy amal paneli `pop-in / pop-out`, pastda yopishqoq (mobilda tab panel ustida)
7. ✅ Inline tasdiq panellari xom `animate-fade-up + style` o'rniga `expand-in` — Specialists, Disputes, Payouts, Payments, Reviews, BanToggle, UsersPanel, Moderation
8. ✅ Muvaffaqiyat xabarlari (notice) `expand-in` — 5 komponent
9. ✅ Demo tozalash modali: `fade-in/fade-out` fon + `modal-in/modal-out` (usePresence), `card-floating` — `DemoCleanButton.tsx`
10. ✅ Payout «Yopilgan so'rovlar» ochilishi `expand-in`
11. ✅ Telegram/R2 kartalari «yuklanmoqda…» matni o'rniga skeleton (aria-busy)
12. ✅ Moderatsiya, Efirlar, Tizim, Foydalanuvchilar, Spam filtri — skeleton holatlari
13. ✅ Shubhali faollik: ikonka plitkalari → 16px ikonka, sarlavha 15px (bo'lim bilan izchil) — `AdminFraudSignals.tsx`
14. ✅ Shubhali faollik: «Profil»/«Audit» — tinch matnli havolalar (14px ikonka), «Bloklash» yagona ramkali tugma
15. ✅ To'lovlar jadvali konteyner so'rovlari (`@container`, `@[66rem]`, `@[74rem]`) — tasdiqlash jadvali bilan bir xil yondashuv
16. ✅ To'lovlar: amallar tor konteynerda ustun, kengda bir qator (`@[74rem]:md:flex-row`)
17. ✅ So'nggi faollik kartalari: 14px sarlavha, hairline header, 34px avatar, 13.5px matn
18. ✅ Jadval/menyu ikonkalari 16px (ExternalLink, menyu bandlari), qatorda `transition-colors`
19. ✅ Tanlangan qator `bg-accent-soft/40`, mobil karta `border-accent/50`
20. ✅ Auth: xato bloklari radius 16 → 14 va `expand-in`; maqsad kartalari radius 18 → 14 — v3 radius tizimi
21. ✅ Auth brend paneli: qora `btn-ink` ikonka plitkalari → `icon-tile-outline` (tinch kontur) — `src/app/auth/layout.tsx`
22. ✅ Caps Lock eslatmasi `expand-in`, warning toni
23. ✅ Yordam maqolasi sarlavhasida hover/fokusda «#» (opacity transition)
24. ✅ Tizim holati metrikalari: semantik holat nuqtasi (ok/warn/bad), `tabular-nums`
25. ✅ Efirlar: kun sarlavhalari `surface-2`, «bugun» aksent, o'tgan efirlar opacity-60
26. ✅ Admin ichki sahifalar (audit, obunalar, buyurtma) h1 bir xil o'lcham tizimi (26/30, buyurtma 24/28)
27. ✅ Loading skeletlari (admin, audit, obunalar) — haqiqiy tartib va balandliklar bilan

## D. Minimalizm
1. ✅ Eyebrow takrori olib tashlandi («Shikoyatlar / Shikoyatlar», «Sharhlar / Sharh moderatsiyasi») — bitta sarlavha
2. ✅ 16 bo'lim tavsifi bir jumlaga qisqartirildi
3. ✅ `accent-serif` urg'ular admin sarlavhalaridan olib tashlandi — bo'limda bitta aksent (chip yoki asosiy tugma)
4. ✅ Sozlamalar: «Hozirgi qiymatlar» dublikat kartasi olib tashlandi (forma o'zi ko'rsatadi)
5. ✅ Sozlamalar formasi: takror «Platforma sozlamalari» sarlavhasi + icon-tile olib tashlandi — `PlatformSettingsForm.tsx`
6. ✅ So'nggi foydalanuvchilar: takroriy «Bloklash» tugmasi olib tashlandi (Foydalanuvchilar panelida bor) — qatorlar bir qatorli bo'ldi
7. ✅ So'nggi faollik kartalaridagi dekorativ 18px ikonkalar olib tashlandi
8. ✅ Stat plitkalarda ikonka plitkalari → 14px inline ikonka
9. ✅ Navbat amallari 6 → 2 + «⋯»
10. ✅ Foydalanuvchilar: 5 ta tugma → «Katalogda» + «Bloklash» + «⋯» (Yozish/Profil/Imtiyoz/Izoh menyuda) — `UsersPanel.tsx`
11. ✅ Shubhali faollik: har qatorda 3 ta ramkali tugma → 1 tugma + 2 matnli havola
12. ✅ Shubhali faollik: uzun ro'yxatlar 4 ta + «Yana N ta» (`<details>`, JS'siz)
13. ✅ Sharhlar 30 → 10 + «Yana»
14. ✅ To'lovlar 60 → 15 + «Yana»; yopishqoq ustun soyasi olib tashlandi
15. ✅ To'lovlar jami matni qisqa: «Aylanma … · komissiya …»
16. ✅ Navbat filtr hisoblagichi faqat filtr faol bo'lganda (chip bilan takrorlanmaydi)
17. ✅ Moliya: 1 mln dan katta summalar ixcham (ikki qatorli «2 080 000 so'm» yo'q)
18. ✅ Chip/nav nomlari qisqa («Payout so'rovlari» → «Payoutlar», «To'lov sozlamalari» → «To'lov tizimlari»)
19. ✅ Header: tavsif bir jumla, eyebrow kulrang ikonka aksentsiz
20. ✅ Audit/Obunalar sahifalari: eyebrow aksentsiz, tavsif 13.5px kulrang
21. ✅ Offline sahifa: tugma + bitta holat qatori (ortiqcha matn yo'q)
22. ✅ Auth brend paneli ikonkalari tinch (3 ta qora kvadrat yo'q)
23. ✅ `QueueChip` — 6 ta takroriy Badge shartlari bitta komponentda
24. ✅ `Tile` — bitta variant (hamma havola), shartli ikki shox yo'q
25. ✅ Tasdiqlash: ro'yxat ostidagi «O'chirish qaytarib bo'lmaydi…» eslatma qatori olib tashlandi (tasdiq paneli o'zi aytadi)
26. ✅ Shikoyat/payout filtr hisoblagichlari kichik, opacity-70 — raqamlar sarlavha bilan raqobatlashmaydi

## Tekshiruv
- `npx tsc --noEmit | grep -v "^.next/types"` — o'z fayllarimda xato yo'q (har bosqichdan keyin tekshirildi).
- curl (admin `/tmp/ad.jar`, mehmon, mutaxassis `/tmp/sp.jar`): `/api/admin/health` 200 (db 0.7 ms, cron 17 soat oldin, rate-limit top prefikslar), `/api/admin/moderation` (4 jamoa, 4 vakansiya, muallif/egasi), `?q=rasmiy` qidiruv, `/api/admin/events` (1 efir), `/api/admin/settings/spam` GET + POST sinov («kazino» → word, youtube ruxsatda → ok), `/api/admin/users?format=csv&holat=banned` va `/api/admin/specialists?format=csv&status=pending` (BOM + `'`-himoya), PATCH `adminNote` → saqlandi, 501 belgi → 422, `/api/admin/audit?q=refund` → 3 yozuv, GET dispute timeline; mehmon → 401 (6 endpoint), mutaxassis → 403.
- Smoke: `node --test scripts/smoke.mjs` — 17 test (server restart'dan keyin qayta ishga tushirildi; natija pastda yangilanadi).
- Playwright (chromium): 1440 / 1024 / 390, light + dark, HSCROLL yo'q; «⋯» menyu ochilishi, Escape yopishi, fokus; nav bosilganda sarlavha ko'rinishi (opacity 1).
- Skrinshotlar (`/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/admin/`):
  - OLDIN (foydalanuvchi skrinshoti bilan bir xil): `before-admin-1440-dark.png`, `before-tasdiqlash-1440-dark.png`, `before-tolovlar-1440-dark.png`, `before-shubhali-1440-dark.png`, `before-faollik-1440-dark.png`, `before-sozlamalar-1440-dark.png`
  - KEYIN: `after1-admin-1440-dark.png` (header + stat + navbat), `after2-header-1440-dark.png`, `after1-tasdiqlash-1440-dark.png`, `after1-tasdiqlash-390-dark.png`, `after1-tasdiqlash-1024-light.png`, `after1-menu-open-1440-dark.png`, `after3-tolovlar-1440-dark.png`, `after2-shubhali-1440-dark.png`, `after2-faollik-1440-dark.png`, `after2-sozlamalar-1440-dark.png`, `after2-payoutlar-1440-dark.png`, `after2-shikoyatlar-1440-dark.png`, `after4-moderatsiya-1440-dark.png`, `after4-efirlar-1440-dark.png`, `after4-tizim-1440-dark.png`, `after4-foydalanuvchilar-1440-dark.png`, `after4-xabar-1440-dark.png`, `after3-navclick-tolovlar-1440-dark.png`
  - Yakuniy to'liq sahifalar (final-*): pastda yangilanadi.

## Boshqa sohalarga so'rovlar
- **groups / feed / kabinet / vacancies agentlari**: post, izoh, guruh chati, DM va vakansiya validatorlarida `await assertNotSpam(text, "body")` (`@/lib/security/spam-filter`) chaqiring — spam filtri sozlamalari admin panelda tayyor; `checkSpamText` sof funksiya (testlar uchun).
- **design agent (`globals.css`)**: `.field` uchun ixcham `--size-sm` varianti (hozir `!h-9 !min-h-0 !py-0` override'lari ishlatilmoqda — admin filtr maydonlari).
- **kabinet agent**: `/kabinet/xavfsizlik` 2FA sahifasida ham `PasswordField`dagi Caps Lock eslatmasi avtomatik ishlaydi (komponent umumiy).

## Qoldirilgan / xavf
- `users.admin_note`, `users.admin_note_at` — qo'shimcha ustunlar; prod'da `npx tsx scripts/db-sync.ts` (yoki Turso'da `ALTER TABLE users ADD admin_note text; ADD admin_note_at integer`) kerak.
- Spam filtri hozircha faqat admin sozlamasi va yordamchi; haqiqiy bloklash boshqa agentlar validatorlarga ulagach ishlaydi.
- Reports jadvalida «triage» holati uchun sxema o'zgartirilmadi (faqat open/closed) — tur filtri bilan cheklandi.
- `print` uslublari chek sahifasi uchun — chek sahifasi mening sohamda emas.
