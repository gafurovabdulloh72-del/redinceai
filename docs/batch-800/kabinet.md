# Kabinet (foydalanuvchi kabineti va hisob) — batch-800 hisoboti (2026-10-18)
Qisqa hisob: A 28 · B 25 · C 25 · D 27

Soha: `src/app/kabinet/**` (chat, vakansiyalar/arizalarim/rezyume/elonlar/takliflar/buyurtmalar/obuna'dan tashqari), `src/components/kabinet/*`,
API `account|profile|portfolio|notifications|favorites|saved-searches|blocks|privacy|auth/sessions|auth/2fa|telegram/link|unlink`,
`lib/saved-searches.ts`, `lib/draft.ts`, `lib/notifications.ts` (qo'shimcha), `NotificationsBell.tsx` + `notification-meta.ts`.
Sxema (faqat qo'shimcha, `db-sync` o'tkazildi): `users.notify_prefs` (JSON), `users.is_paused` (bool), `saved_searches.frequency` (daily|weekly).

## A. Yangi funksiyalar
1. ✅ Kabinet «Bugun» bloki: yangi buyurtmalar, muddati yaqin/o'tgan buyurtmalar (`orders.dueDate`), jamoalardagi yaqin efirlar (`posts.eventAt`), vakansiyaga yangi arizalar, e'lonlarga yangi takliflar, o'qilmagan xabar/bildirishnoma — faqat nol bo'lmagan qatorlar, bo'sh bo'lsa bitta tinch qator — `src/app/kabinet/page.tsx`
2. ✅ Faollik lentasi: kim postlaringizga reaksiya bildirdi / izoh yozdi / obuna bo'ldi / sharh qoldirdi (post_likes, post_comments, follows, reviews), oxirgi 8 ta, havolalar bilan — `src/components/kabinet/ActivityFeed.tsx`
3. ✅ Bildirishnoma sozlamalari tur-guruh bo'yicha (`users.notify_prefs`): 5 guruh (Buyurtmalar, E'lonlar/vakansiyalar, Ijtimoiy, Xabarlar, Tizim); `notify()` o'chirilgan guruhni umuman yozmaydi (xavfsizlik/nizo/qaytarish turlari doim keladi) — `src/lib/notifications.ts` (`NOTIFY_GROUPS`, `isNotifyAllowed`), API `GET/PUT /api/notifications/prefs`, UI `src/components/kabinet/NotificationPrefs.tsx`
4. ✅ Bildirishnomalar sahifasida tur bo'yicha filtr chiplari (`?filter=orders|jobs|social|chat|system`) soni bilan, faqat mavjud guruhlar — `src/app/kabinet/bildirishnomalar/page.tsx`
5. ✅ Bildirishnomalarni guruhlash: bir kunda 3+ takror (reaksiya/izoh/obuna — href bo'yicha; kanal/efir/profil posti/e'lon — tur bo'yicha) → «3 kishi postingizga reaksiya bildirdi», ochish/yig'ish, ochganda hammasi o'qilgan bo'ladi — `src/components/kabinet/NotificationsList.tsx`
6. ✅ Ro'yxatda kun bo'limlari (Bugun / Kecha / N kun oldin / sana), yopishqoq sarlavha — `NotificationsList.tsx`
7. ✅ «Eskilarini tozalash»: 30 kundan eski o'qilganlar o'chiriladi — `DELETE /api/notifications?days=` + `purgeReadNotifications()` (`lib/notifications.ts`)
8. ✅ JSON eksportga ijtimoiy tarmoq qo'shildi: postlar (media bilan), izohlar, obunalar (ikki tomon), bloklaganlar, saqlangan postlar, jamoalar a'zoligi — `src/app/api/account/export/route.ts`
9. ✅ Hisobni pauza qilish (`users.is_paused`): API `GET/PUT /api/account/pause`, Xavfsizlik → Maxfiylik switch (faqat mutaxassis), umumiy sahifada «Pauzada» belgisi; katalog filtri — so'rov (pastda)
10. ✅ Kirish tarixi: audit (kirish, noto'g'ri parol, 2FA, chiqish, parol o'zgarishi, sessiya yopilishi) — 12 ta, IP maskalangan (`185.12.•.•`), yig'iladigan bo'lim — `src/app/kabinet/xavfsizlik/page.tsx`, `SecurityPanel.tsx`
11. ✅ Chat taxallusi bandligini jonli tekshirish (400 ms debounce, ✓/✗, band bo'lsa «Saqlash» bloklanadi) — `GET /api/account/username?u=` (`src/app/api/account/username/route.ts`) + `AccountForm.tsx`
12. ✅ Telefon maskasi «+998 90 123 45 67» (yozishda va qo'yishda; chet el raqamiga tegmaydi) — `AccountForm.tsx` (`maskUzPhone`)
13. ✅ Portfolio: sudrab tartiblash (HTML5 DnD, ustiga kelganda halqa) + tutqichda klaviatura (↑/↓/←/→, Home/End) — `PortfolioManager.tsx`
14. ✅ Portfolio: «Tanlash» rejimi — kartalarda checkbox, «Hammasi/Tozalash», tanlanganlarni o'chirish (inline tasdiq) — `DELETE /api/portfolio` `{ids}` (`src/app/api/portfolio/route.ts`) + UI
15. ✅ Portfolio: «Muqova qilish» (ishni birinchi o'ringa) tezkor amali — `PortfolioManager.tsx`
16. ✅ Saqlangan qidiruv chastotasi: «Har kuni / Haftada bir» (`saved_searches.frequency`); cron weekly'da oxirgi xabardan 7 kun o'tmaguncha o'tkazib yuboradi — `lib/saved-searches.ts`, `PATCH /api/saved-searches/[id]`, `SavedSearchList.tsx`
17. ✅ Saqlangan qidiruv «Hozir tekshirish»: oxirgi tekshiruvdan keyin mos kelgan yangi mutaxassislar soni + «Ochish» yangilarini birinchi ko'rsatadi; oxirgi tekshiruv sanasi — `GET /api/saved-searches/[id]` (`countNewMatches`) + UI
18. ✅ Bloklanganlar ro'yxatida qidiruv (5 tadan ko'p bo'lsa; ism yoki @taxallus) — `BlockedList.tsx`
19. ✅ Telegram «Sinov xabari» — `POST /api/telegram/test` (soatiga 5 ta, ulanmagan bo'lsa aniq xato) + `TelegramCard.tsx`
20. ✅ Telegram ulanish holati `GET /api/telegram/link` + karta botda «Start» bosilishini 3 s'da bir o'zi tekshiradi (2 daqiqa), ulangach yangilanadi — `src/app/api/telegram/link/route.ts`, `TelegramCard.tsx`
21. ✅ Mutaxassis profili formasi: qoralama avtosaqlash (localStorage, 600 ms debounce, `lib/draft.ts`) + «Qoralama tiklandi · Bekor qilish» banneri; saqlangach tozalanadi — `ProfileForm.tsx`
22. ✅ Saqlanmagan o'zgarishlar himoyasi (`beforeunload`) — `src/components/kabinet/useUnsavedGuard.ts`, ulangan: AccountForm, ProfileForm, PrivacySettings, ScheduleEditor
23. ✅ Kabinet navigatsiyasida holat nuqtalari: «Profil» (6 mezondan <4 bajarilgan — sariq, foiz sr-only), «Xavfsizlik» (email tasdiqlanmagan) — `src/app/kabinet/layout.tsx`
24. ✅ Tezkor amallar rolga ko'ra (mutaxassis: Ish qo'shish / Post yozish / Profil / «Mehmon ko'zi bilan ko'rish» `?preview=guest`; mijoz: Mutaxassis topish / E'lon joylash / Xarita / Profil) — `page.tsx`
25. ✅ Ish vaqti: har kun qatorida «shu soatlarni barcha ish kunlariga nusxalash» tugmasi — `ScheduleEditor.tsx` (`copyHoursToAll`)
26. ✅ Oylik hisobot CSV eksporti (UTF-8 BOM, `;` ajratgich, formulalar neytrallangan; xulosa + 4 bo'lim) — `src/app/kabinet/hisobot/csv/route.ts` + «CSV» tugmasi
27. ✅ Hisobotda «Joriy oy / O'tgan oy» tez tanlov chiplari — `src/app/kabinet/hisobot/page.tsx`
28. ✅ Telegram eslatmasini «Keyinroq» (7 kunga kechiktirish) — `TelegramNudge.tsx`

## B. Tuzatilgan buglar
1. ✅ PrivacyPanel: tanlangan segment hech qachon ko'rinmas edi (`segment-item-active` klassi CSS'da yo'q) → `data-active` — `PrivacyPanel.tsx`
2. ✅ PrivacyPanel: `aria-checked` aria-hidden span'da (noto'g'ri ARIA, switch tugma butun qator edi) → yorliq + alohida `role="switch"` tugma (AccountForm bilan bir xil) — `PrivacyPanel.tsx`
3. ✅ SecurityPanel: telefon plitkasida «Tasdiq kutilmoqda» — telefon tasdiqlash mavjud emas (yolg'on holat) → «Kiritilgan» — `SecurityPanel.tsx`
4. ✅ TelegramCard: `window.open` `await fetch`dan keyin chaqirilardi — popup bloklovchilar bosardi → oyna bosish paytida sinxron ochiladi, so'ng manzil qo'yiladi — `TelegramCard.tsx`
5. ✅ TelegramCard: «Tekshirish» ulanmaganda hech qanday javob bermasdi → toast («Hali ulanmagan…») + avtomatik tekshiruv — `TelegramCard.tsx`
6. ✅ ImageCropper: sensorli ekranda pinch, sichqonchada g'ildirak bilan kattalashtirish ishlamasdi → ikki barmoq pinch + wheel (sahifa skrolli bloklanadi) — `ImageCropper.tsx`
7. ✅ ImageCropper: ochilganda fokus kirmas, yopilganda qaytmas edi → `tabIndex=-1` dialogga fokus, yopilganda oldingi elementga — `ImageCropper.tsx`
8. ✅ ImageCropper: saqlash jarayonida fon bosilsa bekor bo'lib `onDone` yo'qolardi → busy paytida yopilmaydi — `ImageCropper.tsx`
9. ✅ Qo'ng'iroqdan «Hammasini o'qilgan» bosilsa /kabinet/bildirishnomalar ro'yxati «N ta o'qilmagan» bo'lib qolardi (desinxron) → ro'yxat UNREAD=0 hodisasini eshitadi — `NotificationsList.tsx`
10. ✅ KabinetNav (desktop): 20 ta bandli yopishqoq panel past ekranda (768px) kesilib «Xavfsizlik/Chiqish» yetib bo'lmasdi → `max-h-[calc(100vh-8rem)]` + ichki skroll — `KabinetNav.tsx`
11. ✅ SavedSearchList: nomni tahrirlashda Escape/«Bekor»dan keyin fokus body'ga tushardi → qalam tugmasiga qaytadi — `SavedSearchList.tsx`
12. ✅ Kabinet layout: obuna pill'i `role="alert"` — har navigatsiyada avtomatik silkinardi (CLAUDE qoidasi) → `role="status"` — `layout.tsx`
13. ✅ PrivacySettings: `aria-label` lucide ikonkada (aria-hidden) — ekran o'quvchiga yetmasdi → sr-only «ko'rinadi/yopiq» — `PrivacySettings.tsx`
14. ✅ Postlar bo'sh holati: «Profilni yaratish» `/kabinet/profil` sahifa boshiga olib borardi → `#mutaxassis` — `postlar/page.tsx`
15. ✅ AccountForm: avatar «O'chirish»dan keyin saqlash kerakligi haqida ishora yo'q va qaytarib bo'lmasdi → «Rasm “Saqlash” bosilgach o'chiriladi» + «Qaytarish» — `AccountForm.tsx`
16. ✅ NotificationsBell: panel ochilganda fokus panelga o'tmas, yopilganda tugmaga qaytmas edi — `NotificationsBell.tsx`
17. ✅ `chat` (DM) bildirishnoma turi uchun meta yo'q edi — umumiy qo'ng'iroq + «Bildirishnoma» chiqardi → xabar ikonkasi/«Yangi xabar» — `notification-meta.ts`
18. ✅ AccountForm: band/noto'g'ri taxallus bilan ham «Saqlash» yuborilardi (server 422) → jonli tekshiruv natijasi submit'ni to'xtatadi, tekshiruv paytida tugma o'chiq — `AccountForm.tsx`
19. ✅ AccountForm: maydon izohlari/xatolari `aria-describedby` bilan bog'lanmagan edi (ism, telefon, taxallus, email, parol) — `AccountForm.tsx`
20. ✅ AccountForm: taxallus `maxLength=21`, server esa 20 belgi — → 20 — `AccountForm.tsx`
21. ✅ ImageCropper: zoom slayderida `aria-valuetext` yo'q (ekran o'quvchi «1.37» o'qirdi) → foiz + ko'rinadigan % — `ImageCropper.tsx`
22. ✅ NotificationsList: bitta yozuvni o'qilgan deb belgilash xatosi jimgina qaytarilardi → toast «Belgilab bo'lmadi» — `NotificationsList.tsx`
23. ✅ TelegramCard: «Ulangan ✓» — ikonka va ✓ belgisi ikki marta; AccountForm'da `Mail` ikonkasi `aria-hidden`siz; BlockedList bo'sh holatidagi `Ban` ikonkasiga nom yo'q — tozalandi — `TelegramCard.tsx`, `AccountForm.tsx`, `BlockedList.tsx`
24. ✅ SecurityPanel: `Badge tone="green"/"orange"` eski nomlar (semantik tokenlarga yo'naltirilgan, lekin qorong'u temada farq qilishi mumkin) → `success`/`warning` — `SecurityPanel.tsx`
25. ✅ ScheduleEditor / SecurityPanel: xato konturi `!border-ios-red` (tema tokeni emas, qorong'uda noto'g'ri) → `!border-danger` — `ScheduleEditor.tsx`, `SecurityPanel.tsx`

## C. Dizayn va animatsiya tuzatishlari
1. ✅ Kabinet sarlavhalarida `accent-serif text-accent` (coral so'z) → v3 kulrang `accent-serif`; `display-xl`dagi inline o'lchamlar olib tashlandi (klamp `!important`) — umumiy, profil, portfolio, postlar, saqlanganlar, obunalar, sevimlilar, qidiruvlar, xavfsizlik, to'lovlar, hisobot, mutaxassislarim
2. ✅ Eyebrow ikonkalari coral → neytral (10 sahifa)
3. ✅ Xom ranglar → tokenlar: `text-ios-red`, `bg-ios-red/12`, `text-[#15803d] dark:text-ios-green`, `bg-ios-green/14`, `text-ios-orange` → `text-danger-text`/`bg-danger-soft`/`text-success-text`/`bg-success-soft`/`text-warning-text` — AccountForm, ProfileForm, PrivacySettings, SecurityPanel, TelegramCard, ScheduleEditor
4. ✅ Har sahifaga o'z skeleti (`loading.tsx`): bildirishnomalar, profil, portfolio, xavfsizlik, qidiruvlar, sevimlilar (ilgari hammasi umumiy sahifa shaklida edi)
5. ✅ Qatorlarda bosish holati `.press`: bildirishnomalar, bloklanganlar, umumiy sahifa qatorlari/plitkalari, nav bandlari, filtr chiplari, profil bo'lim chiplari
6. ✅ Switch qatorlari izchil (yorliq + izoh + o'ngda switch): PrivacyPanel, NotificationPrefs, AccountForm
7. ✅ Kirish staggeri (`.stagger` + `animate-fade-up`): profil formalari, xavfsizlik ikki ustuni, umumiy sahifa plitkalari, saqlangan qidiruv kartalari
8. ✅ ImageCropper chiqish animatsiyasi (`animate-modal-out` + `animate-fade-out`, reduced-motion'da darhol)
9. ✅ Inline tasdiq/qo'shimcha panellar `expand-in`: SavedSearchList (tahrir, o'chirish, chastota), PortfolioManager (o'chirish, tanlash paneli, qo'shish formasi), AccountForm (joriy parol maydoni), TelegramCard (kutish), ProfileForm (qoralama banneri); xom `style={{animationDuration}}` olib tashlandi
10. ✅ NotificationPrefs paneli `usePresence` bilan `expand-in`/`expand-out`
11. ✅ Guruhlangan bildirishnoma ochilishi `expand-in`
12. ✅ Karta ichki bo'shliqlari izchil: `p-5 sm:p-7` → `p-5 sm:p-6` (AccountForm, ProfileForm, PrivacySettings, PrivacyPanel, BlockedList, ScheduleEditor, SecurityPanel, TelegramCard)
13. ✅ Sarlavha plitkalari 44→40px, ikonkalar 20→18 (barcha kabinet formalari), umumiy sahifa plitkalari 18
14. ✅ Bo'lim sarlavhalari 20→19px izchil
15. ✅ Soyali kartalar yassi: umumiy sahifadagi «Profil» kartasi, KabinetNav (desktop/mobil), Portfolio qo'shish formasi, ProfileForm CTA, To'lovlar urg'u plitkasi (`card-elevated` → `card`/aksent kontur)
16. ✅ Profil xush kelibsiz banneri va ProfileForm CTA'dagi blur glow olib tashlandi
17. ✅ ImageCropper fon `bg-[#101012]` → `bg-ink`, radius 16→14
18. ✅ Bildirishnomalar filtri telefonda gorizontal aylanadigan pill qatori (segment o'rniga — 7 ta chip sig'maydi)
19. ✅ KabinetNav desktop bandlarida `.press` (ilgari `active:scale`)
20. ✅ TelegramNudge: to'liq coral doira → `accent-soft` plitka, `rounded-16`/`line-2` → hairline karta
21. ✅ SecurityPanel kirish tarixi — semantik nuqta (yashil/qizil) + mono IP, shovqinsiz
22. ✅ Bildirishnomalar kun sarlavhalari yopishqoq (`sticky` + blur fon)
23. ✅ Portfolio sudrash holatlari: ko'chirilayotgan karta 50% shaffof, nishon kartada aksent halqa; tanlangan karta `ring-fg`
24. ✅ Umumiy sahifa «Bugun» va bo'limlar `list-inset`/hairline qatorlar — qutili kartalar o'rniga
25. ✅ PrivacySettings daraja kartalari va jonli ko'rinishda ikonkalar coral → kulrang (aksent faqat faol holat uchun)

## D. Minimalizm
1. ✅ Umumiy sahifa: Obuna / Takliflar / E'lonlar / Sevimlilar — 4 ta katta karta → bitta `list-inset` ro'yxat (qiymat bilan)
2. ✅ Umumiy sahifa: «Reyting» va «Sharhlar» plitkalari bir xil ma'lumot edi → bitta «Reyting · N ta sharh», o'rniga «Obunachilar»
3. ✅ Umumiy sahifa: «Tezkor amallar» alohida kartasi → Profil kartasi ichiga
4. ✅ Umumiy sahifa: 4 bosqichli onboarding stepper (checklist bilan takror) olib tashlandi — faqat halqa + ro'yxat, 100% bo'lgach yo'qoladi
5. ✅ Umumiy sahifa: sarlavha ostidagi uzun tagline olib tashlandi; «Salom, Ism!» undovsiz
6. ✅ Umumiy sahifa: «Barchasi» tugmasi → matn havolasi; mijoz «Siz ijodkormisiz?» kartasidan badge olib tashlandi
7. ✅ Navigatsiya yorliqlari qisqaroq: «Saqlangan qidiruvlar»→«Qidiruvlar», «Vakansiyalarim»→«Vakansiyalar», «Rezyumem»→«Rezyume», «Ommaviy profil»→«Profilim (ommaviy)»
8. ✅ KabinetNav: ism ostidagi email qatori olib tashlandi (rol yetarli)
9. ✅ Sahifa tavsiflari qisqartirildi: portfolio, postlar, saqlanganlar, obunalar, sevimlilar, qidiruvlar, mutaxassislarim, xavfsizlik, bildirishnomalar, profil
10. ✅ Sahifa eyebrow'lari bir xil «Kabinet» (ilgari «Sozlamalar», «Kabinet · Portfolio», «Xavfsizlik»)
11. ✅ AccountForm sarlavha izohi («…Telefon va jins kimga ko'rinishini…») qisqartirildi
12. ✅ PrivacySettings izohi 2 jumladan 1 ga
13. ✅ PrivacyPanel: izoh qisqa; doimiy yashil «Saqlangan» badge → neytral matn (faqat «Saqlanmoqda…» ko'rinadi)
14. ✅ BlockedList izohi qisqa; sana `formatDateTime` → `formatDate`
15. ✅ TelegramCard: «Telegram bildirishnomalari» → «Telegram», matnlar qisqa
16. ✅ SecurityPanel «Maslahatlar» (6 ta karta) → yig'iladigan `details`, ikonkalar plitkasiz
17. ✅ SecurityPanel kirish tarixi yig'iq (`details`) — kerak bo'lganda ochiladi
18. ✅ Hisobot: «Kabinetga qaytish» havolasi olib tashlandi (nav bor)
19. ✅ Saqlanganlar tavsifidagi emoji (🔖) olib tashlandi
20. ✅ Profil bo'lim-nav chiplarida har ikonka coral edi → kulrang
21. ✅ Bildirishnomalar: «Email sozlamalari» alohida tugmasi → Sozlamalar paneli ichidagi switch
22. ✅ Bildirishnomalar: bir vaqtda bitta asosiy amal («Hammasini o'qilgan» faqat o'qilmagan bo'lsa; «Eskilarini tozalash» faqat hammasi o'qilganda)
23. ✅ Bildirishnomalar bo'sh holat matnlari qisqa
24. ✅ TelegramNudge: ikkinchi jumla telefonda yashirin, «Keyinroq» desktopda
25. ✅ Portfolio yuqori panel matnlari qisqa («Ommaviy», «Sudrab yoki strelkalar bilan tartiblang. Birinchi ish — muqova.»)
26. ✅ SavedSearchList: «Yangilari haqida xabar beramiz» → «Xabar beramiz»; «Men obuna bo'lganlar» → «Obunalarim»
27. ✅ Umumiy sahifa plitkalarida ikonka plitkasi `soft` kichik (katta `ink` plitka o'rniga)

## Tekshiruv
- (quyida to'ldiriladi)

## Boshqa sohalarga so'rovlar
- `src/lib/queries.ts` / `src/lib/subscriptions/access.ts` (katalog/qidiruv egasi): `listableCondition` (yoki `notBanned()` yonida) `users.is_paused = 0` sharti qo'shilsin — hisob pauzasi (A9) katalog, xarita, qidiruv va saqlangan qidiruv ogohlantirishlarida hurmat qilinsin. Bayroq va UI tayyor: `users.isPaused`.
- `src/components/groups/FollowersDialog.tsx` (jamoalar egasi): `/kabinet/obunalar` sahifasida `FollowList` `/api/follow/<id>?list=followers` ga so'rov yuboradi — mutaxassis hisobida 404 + «Unexpected token '<'» konsol xatosi (HTML javob JSON deb o'qilmoqda). API yo'li yoki `res.ok` tekshiruvi ko'rib chiqilsin.
- `src/components/layout/TitleUnread.tsx` (layout egasi): brauzer sarlavhasidagi «(N)» prefiks allaqachon umumiy qobiqda — shuning uchun kabinetdagi alohida `document.title` effekti qo'shilmadi (to'qnashuv bo'lmasin).

## Qoldirilgan / xavf
- Hisob pauzasi hozircha faqat bayroq + UI; katalogdan yashirish `listableCondition`ga bog'liq (so'rov yuqorida).
- `beforeunload` himoyasi faqat brauzer yopilishi/yangilanishida ishlaydi — Next.js ichki navigatsiyasini to'xtatmaydi (forma pastida «hali saqlanmagan» holati qoladi).
- Portfolio sudrash HTML5 DnD — sensorli ekranlarda strelkalar/klaviatura tutqichi ishlatiladi (DnD mobil Safari'da cheklangan).
- Bildirishnoma guruhlash faqat joriy sahifa (20 ta) ichida; sahifalar orasida guruh bo'linishi mumkin.
