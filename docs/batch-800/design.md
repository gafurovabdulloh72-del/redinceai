# Dizayn tizimi, harakat, qobiq, i18n, a11y — batch-800 hisoboti (2026-10-18)
Qisqa hisob: A 28 · B 29 · C 26 · D 27

Soha: `globals.css`, `layout.tsx`, `components/ui/*`, `components/motion/*`, `components/layout/*` (NotificationsBell'dan tashqari), `components/i18n/*`, `lib/i18n/**`, `api/til`, `public/sw.js`, `manifest.ts`.
Token o'zgarishlari (oldin → keyin) — pastda, «Token o'zgarishlari» bo'limida.

## A. Yangi funksiyalar
1. ✅ Tarmoq banneri: «Internet yo'q — ba'zi amallar vaqtincha ishlamaydi» (turadi) / «Aloqa tiklandi» (2.5 s), `html[data-offline]` belgisi, uz/ru — `src/components/layout/NetworkBanner.tsx`, `layout.tsx`
2. ✅ Tema uch holatli: Avto (tizim bilan sinxron — OS o'zgarsa darhol, `matchMedia change`) / Yorug' / Qorong'u; init skript `html[data-theme-mode]` — `src/components/layout/Appearance.tsx`, `ThemeToggle.tsx`
3. ✅ Shrift o'lchami Kichik/O'rta/Katta (`html[data-font=s|l]` → `main`/`footer` `zoom: 0.94/1.08`; qobiq o'zgarmaydi — iOS Dynamic Type kabi), saqlanadi — `Appearance.tsx`, `globals.css`
4. ✅ «Harakatni kamaytirish» foydalanuvchi tugmasi (`html[data-motion=reduce]`): universal 0.01ms qoidasi + xarita/reveal/alert istisnolari; `prefersReducedMotion()` OS va tugmani birga tekshiradi (usePresence, haptic, countup, Sheet) — `globals.css`, `motion/haptics.ts`
5. ✅ Yuqori kontrast (`prefers-contrast: more`): line 0.08→0.28, line-2 0.16→0.45, fg-2/3/4 to'qroq, fokus halqasi 3px — `globals.css`
6. ✅ Klaviatura qisqartmalari yordam oynasi (`?`) — Sheet + Kbd, ikki bo'lim (Amallar / O'tish), uz/ru — `src/components/layout/Shortcuts.tsx`
7. ✅ Global qisqartmalar: `g h/q/l/j/x/b/k` (1 s ichida ikkinchi tugma), `c` → yaratish (`open-create` hodisasi — md+ Sidebar, telefon NavbarClient), `/` → ⌘K paleti; input/textarea/contenteditable'da o'chadi — `Shortcuts.tsx`, `Sidebar.tsx`, `NavbarClient.tsx`
8. ✅ Mobil sarlavhada «Orqaga» (ichki sahifalarda; ilova ichida tarix bo'lsa `router.back()`, to'g'ridan-to'g'ri kirilgan bo'lsa ota yo'lga) — `NavbarClient.tsx`, `nav-utils.ts`
9. ✅ «Yuqoriga» modal/sheet ochiq paytda (`html[data-scroll-lock]`) yashirinadi; tab-bar ustida 12px bo'shliq bilan — `BackToTop.tsx`
10. ✅ SW yangilanishi: yangi versiya kutish holatiga o'tganda «Saytning yangi versiyasi tayyor» toast + «Yangilash» amali → `SKIP_WAITING` → `controllerchange` → reload; sahifa ko'ringanda `reg.update()` — `ServiceWorkerRegister.tsx`, `public/sw.js`
11. ✅ Toast amal tugmasi (`toast(text, tone, { action, duration })`, `showToast` ham), hover/fokusda pauza (WCAG 2.2.1), amal bo'lsa 6 s — `components/ui/toast.tsx`
12. ✅ Toast swipe bilan yopish (yon 80px / past 60px; qo'yib yuborilsa joyiga qaytadi) — `toast.tsx`, `globals.css` (`.toast-swipe`)
13. ✅ Katta ekran (≥1920): `container-x` 80→88rem, `main` 100rem markazda — `globals.css`, `layout.tsx`
14. ✅ Birinchi tashrifda til `Accept-Language`dan (cookie bo'lmasa; `ru`/`ru-*` eng yuqori q bilan → ru; cookie yozilmaydi) — `src/lib/i18n/server.ts`
15. ✅ Brauzer sarlavhasida o'qilmaganlar «(3) Kabinet · Kasb Egalari» (bildirishnoma + DM), navigatsiyada ham saqlanadi — `src/components/layout/TitleUnread.tsx`, `Navbar.tsx`
16. ✅ Umumiy `Sheet` (telefon — pastki varaq: tutqich, pastga surib yopish; sm+ — markaziy oyna yoki `desktop="sheet"`): portal, kirish/chiqish, fokus tuzog'i + fokus qaytishi, scroll qulfi, Escape, fon bosilganda yopish, `size`, `footer` — `src/components/ui/Sheet.tsx`
17. ✅ Umumiy `ConfirmDialog` (`role="alertdialog"`, `danger`, `busy`) + `ConfirmProvider`/`useConfirm()` (promise) layout'da — `src/components/ui/ConfirmDialog.tsx`, `layout.tsx`
18. ✅ `Tooltip` (CSS-only `data-tip`/`data-tip-pos`, 350 ms kechikish, faqat ko'rsatkichli qurilma, yon panel xl'da o'chadi) — `ui/index.tsx`, `globals.css`
19. ✅ `Kbd` primitivi (`.kbd`) — `ui/index.tsx`, `globals.css`; NavbarClient va qisqartmalar oynasida ishlatildi
20. ✅ `Skeleton` primitivi (`lines`), `--animate-skeleton` (pulsatsiya) va `.skeleton-swap` crossfade tokeni — `ui/index.tsx`, `globals.css`
21. ✅ `EmptyState variant="card|compact|inline"` + `className` — `ui/index.tsx`
22. ✅ `useCountUp()` / `<CountUp>` (ko'rinishga kirganda, ease-out 900 ms, reduced-motion'da darhol, SSR'da yakuniy qiymat) — `src/components/motion/useCountUp.tsx`
23. ✅ Tema almashishida View Transitions crossfade (`document.startViewTransition`, qo'llab-quvvatlasa va harakat kamaytirilmagan bo'lsa) — `Appearance.tsx`
24. ✅ `haptic("light|medium|success|error")` — toast xatosida va tema almashishida ishlatiladi — `src/components/motion/haptics.ts`
25. ✅ Print uslublari: yon panel/navbar/footer/toast/progress yashirin (`data-print-hide`), oq fon, kartalar `break-inside: avoid`, tashqi havola manzili qavsda — `globals.css`
26. ✅ `useScrollLock()` / `lockScroll()` — hisoblagichli, scrollbar kengligi kompensatsiyasi, `html[data-scroll-lock]` — `src/components/motion/useScrollLock.ts`
27. ✅ `useFocusTrap()` — Tab/Shift+Tab aylanishi, boshlang'ich fokus (`data-autofocus-skip`), yopilganda fokus qaytishi — `src/components/motion/useFocusTrap.ts`
28. ✅ Skip-link: `main tabIndex=-1` (Safari/Firefox'da fokus haqiqatan o'tadi), tugma uslubi, z 170 — `layout.tsx`

## B. Tuzatilgan buglar
1. ✅ Tema init faqat light/dark bilar edi; qo'lda tanlangandan keyin OS o'zgarsa javob yo'q, `theme-color` meta eskirardi → avto rejim + `change` kuzatuvi + meta sinxroni — `ThemeToggle.tsx`, `Appearance.tsx`
2. ✅ Sidebar: `/kabinet/chat`da «Xabarlar» ham, «Profil» (`/kabinet` prefiksi) ham faol — ikkita `aria-current` → profil faqat boshqa band faol bo'lmaganda — `Sidebar.tsx`
3. ✅ NavbarClient `isActive` `startsWith(href)` — `/ishlar` `/ishlar-…`ni ham faol qilardi → segment bo'yicha `routeActive` — `nav-utils.ts`
4. ✅ CreateMenu: fokus tuzog'i yo'q, yopilganda fokus qaytmasdi, fon scroll qulflanmasdi → Sheet — `CreateMenu.tsx`
5. ✅ Toast `z-[110]` CreateMenu `z-[125]` ostida ko'rinmasdi → z shkala (toast 140) — `toast.tsx`
6. ✅ Toast xato xabarlari `polite` hududda — endi har toast o'z hududi: xato `role="alert"`, qolgani `role="status"` — `toast.tsx`
7. ✅ Bir xil matn 1 s ichida qayta kelsa dublikat toastlar — `toast.tsx`
8. ✅ `ServiceWorkerRegister` Footer ichida edi — footer'siz sahifalarda (bosh sahifa, lenta, kabinet, admin) SW umuman ro'yxatdan o'tmasdi → root layout — `layout.tsx`, `Footer.tsx`
9. ✅ `GET /api/til?next=/\evil.com` — backslash tekshirilmasdi (brauzer `/`ga aylantiradi → ochiq redirect) → `safeInternalPath` — `api/til/route.ts` (curl: 303 → `/`)
10. ✅ NavigationProgress capture bosqichida tekshirardi — React handler `preventDefault` qilsa chiziq 8 s osilib qolardi; orqaga/oldinga ko'rsatilmasdi → bubble + `popstate`, taymer tozalanadi — `NavigationProgress.tsx`
11. ✅ Kontrast: `fg-3` surface-3 ustida yorug'da 4.45, `fg-4` 4.39, qorong'uda `fg-4` 4.41 (AA emas) → 4.7 / 4.65 / 4.7 — `globals.css`
12. ✅ Fokus halqasi `overflow-hidden` konteynerlarda (list-inset, InsetGroup) kesilardi → ichki `outline-offset: -3px` — `globals.css`
13. ✅ `text-wrap: balance` bilan uzun bitta so'z («Qoraqalpog'iston») 390px'da toshib ketishi → `overflow-wrap: break-word` h1–h4 — `globals.css`
14. ✅ Klasssiz kontent havolalari (oferta/maxfiylik matni) faqat rang bilan ajralardi → tagchiziq (WCAG 1.4.1) — `globals.css`
15. ✅ `main` fokuslanmas edi — skip-link Safari/Firefox'da ishlamasdi — `layout.tsx`
16. ✅ Footer huquqiy havolalar va «©» qatori 12px, bosish maydoni <24px → `min-h-9`; ijtimoiy 36→40px — `Footer.tsx`
17. ✅ `viewport.themeColor` (#f6f4ee/#0a0a0c) va manifest `background_color` `--bg` (#fafaf8/#0c0c0d) bilan mos emas edi — splash/manzil paneli rang sakrashi — `layout.tsx`, `manifest.ts`
18. ✅ ThemeToggle yorlig'i faqat o'zbekcha («Tungi rejim») → `Ko'rinish`/`Вид` — `ThemeToggle.tsx`
19. ✅ CreateMenu «Yopish» faqat o'zbekcha → Sheet `common.close` (uz/ru) — `CreateMenu.tsx`
20. ✅ BackToTop `aria-label` faqat o'zbekcha → uz/ru — `BackToTop.tsx`
21. ✅ Logo `aria-label` faqat o'zbekcha → uz/ru — `Logo.tsx`
22. ✅ Spinner `aria-label` role'siz (ekran o'quvchi e'lon qilmaydi) → `role="status"` + `label` prop — `ui/index.tsx`
23. ✅ TelegramShare yorlig'i faqat o'zbekcha → server komponent, `getLocale()` — `TelegramShare.tsx`
24. ✅ Footer ijtimoiy havolalar `div aria-label` (generic elementda ARIA nomi e'lon qilinmaydi) → `role="group"` — `Footer.tsx`
25. ✅ Sidebar badge soni o'zgarganda `badge-pop` qayta o'ynamasdi → `key={badge}` — `Sidebar.tsx`
26. ✅ Sidebar profil havolasida `aria-current` yo'q edi — `Sidebar.tsx`
27. ✅ sw.js: yangi SW darhol `skipWaiting` — ochiq sahifa eski chunklarni yo'qotardi → birinchi o'rnatishdagina darhol, yangilanishda faqat `SKIP_WAITING` xabari bilan — `public/sw.js` (v3)
28. ✅ Toast butunlay `<button>` edi — ichiga amal tugmasi qo'shib bo'lmasdi (button ichida button — yaroqsiz HTML); endi `div[role=status|alert]` + alohida yopish/amal tugmalari; dublikat nazorati state updater'dan tashqarida (StrictMode'da ikki marta chaqirilsa ham to'g'ri) — `toast.tsx`
29. ✅ `usePresence` faqat OS reduced-motion'ni bilar edi — foydalanuvchi tugmasida chiqish kechikishi qolardi → `prefersReducedMotion()` — `usePresence.ts`

## C. Dizayn va animatsiya tuzatishlari
1. ✅ Ochilish/yopilish juftlari yagona: `.pop-in/.pop-out` + `--pop-origin` (Sidebar «Yana» — bottom left, hisob menyusi — top right; ilgari `animate-scale-in`/`modal-in` aralash) — `globals.css`, `Sidebar.tsx`, `NavbarClient.tsx`
2. ✅ Sheet: `sheet-in/sheet-out` + `overlay-in/out`, sudrash paytida `.sheet-drag[data-dragging]` transition/animation o'chadi, qo'yib yuborilganda 200 ms qaytish — `Sheet.tsx`, `globals.css`
3. ✅ ConfirmDialog `animate-modal-in/out` + overlay juftligi — `ConfirmDialog.tsx`
4. ✅ Segment: faol element o'tishiga `transform` qo'shildi, `:active` 0.97 press — `globals.css`
5. ✅ Switch thumb soyasi 0 2px 5px .22 → 0 1px 2px .18 (yassi), yo'lak `--switch-track` — `globals.css`
6. ✅ Button: fokus halqasi global `:focus-visible`dan (dublikat `focus-visible:outline-*` klasslari olib tashlandi), transition ro'yxati qisqardi — `ui/index.tsx`
7. ✅ Skeleton: shimmer gradient → `skeleton-pulse` (opacity 1↔0.55, 1.6 s), kontent `.skeleton-swap` fade-in — `globals.css`
8. ✅ Stagger: 13 pog'ona (540 ms) → 8 pog'ona, 9+ elementlar 360 ms'da birga — `globals.css`
9. ✅ Badge-pop son o'zgarganda qayta o'ynaydi — `Sidebar.tsx`
10. ✅ Toast to'plami: chiqayotgan toast joyi `grid-template-rows 1fr→0fr` bilan yig'iladi, qolganlari sakramaydi — `toast.tsx`, `globals.css` (`.toast-cell`)
11. ✅ Tab-bar: faol ikonka prujinali o'tish, transition faqat rang/fon (layout emas) — `NavbarClient.tsx`
12. ✅ Reduced-motion: yangi animatsiyalar (banner, sheet, toast, tooltip, countup, view transition) OS va foydalanuvchi tugmasida o'chadi — `globals.css`, `motion/*`
13. ✅ `.btn-ink:hover` soyasi olib tashlandi (v3: tugmalarda soya yo'q), hover faqat yorqinlik — `globals.css`
14. ✅ `.nav-bar` soyasi shadow-2 → shadow-1, blur 12 → 8px, dark maxsus qoidasi yo'q — `globals.css`
15. ✅ `--shadow-3` 0 12px 32px -12px .18 → 0 8px 24px -10px .14 (dark .75 → .6), `--shadow-2` dark .6 → .55 — `globals.css`
16. ✅ Avatar: `shadow-[0_4px_14px_-4px_rgba(0,0,0,.35)]` olib tashlandi — faqat ring — `ui/index.tsx`
17. ✅ `.icon-tile-outline`, `.scroll-hint-btn` shisha tokenlarsiz (yuza + hairline, blur yo'q) — `globals.css`
18. ✅ Radiuslar tokenlarga: Sidebar `rounded-[14px]`→`rounded-tile`, CreateMenu `rounded-[16px]/[14px]`→`rounded-card/tile`, Logo 11→10px, Sheet `rounded-t-card-lg` — qobiq fayllari
19. ✅ Ikonka shkalasi: toast 17→18, X 14→16; CreateMenu 19→20; Sidebar menyu 16; NavbarClient orqaga 22 — qobiq fayllari
20. ✅ PageHeader: tavsif sarlavhaning birinchi bazaviy chizig'iga (`lg:items-baseline`, `pb-1.5` yo'q); PageHeader va SectionHeading bitta `HeadingBlock` — `ui/index.tsx`
21. ✅ SectionHeading h2: 24/28/32px → `.display-lg` 22→28px klamp; PageHeader `display-xl` 24→34 — `ui/index.tsx`, `globals.css`
22. ✅ Eyebrow tinchroq: letter-spacing 0.1→0.08em, `mb-3`→`mb-2` — `globals.css`, `ui/index.tsx`
23. ✅ Bo'lim oralig'i 48/64: `mt-section` 64/80→48/64, SectionHeading `mb-8/12`→`mb-6/8`, Footer `mt-12/20`→`mt-12/16` — `globals.css`, `ui/index.tsx`, `Footer.tsx`
24. ✅ ThemeToggle: ikki ikonkali 500 ms aylanish → bitta ikonka `swap` almashinuvi (avto/quyosh/oy) — `ThemeToggle.tsx`
25. ✅ Tooltip harakati: 4px siljish + fade, 350 ms kechikish, yopilishda kechikishsiz — `globals.css`
26. ✅ Dark: `.segment`/`.switch`/`.field` maxsus `[data-theme=dark]` qoidalari → `--seg-track/--seg-thumb/--switch-track/--field-bg` tokenlari (bitta qoida) — `globals.css`

## D. Minimalizm
1. ✅ Button variantlari: 7 → 5 haqiqiy uslub (`glass`→outline, `tint-soft`→ghost; tiplar moslik uchun qoldi — ShareButton buzilmaydi) — `ui/index.tsx`
2. ✅ Badge: `pink/purple`→neytral, `blue/green/orange`→semantik (eksportlar saqlanadi) — `ui/index.tsx`
3. ✅ `Stat` komponenti (0 ishlatish) olib tashlandi — `ui/index.tsx`
4. ✅ PageHeader: `display-xl` yonidagi o'lik `text-[28px]/[30px]` va `size` mantiqi olib tashlandi — `ui/index.tsx`
5. ✅ NavbarClient: hech qachon ko'rinmaydigan desktop NAV bloki (header `md:hidden`), `scrolled` holati, `grid-cols-6` shoxi, `SearchButton` o'lik responsiv klasslari olib tashlandi (312 → 264 qator) — `NavbarClient.tsx`
6. ✅ Sidebar tinchroq: hover 5%→4%, ikonka scale yo'q, avatar ring hover yo'q, `title` o'rniga faqat md'da tooltip — `Sidebar.tsx`
7. ✅ Logo: hover'dagi -6° aylanish olib tashlandi — `Logo.tsx`
8. ✅ Footer: tagline paragrafi va dublikat «Mutaxassis bo'lish» havolasi olib tashlandi, ikki tinch qator — `Footer.tsx`
9. ✅ globals.css: `.glass/.glass-strong/.glass-weak/.glass-hover/.glass-pill/.glass-tint` aliaslari (0 ishlatish) olib tashlandi
10. ✅ globals.css: `@supports not backdrop-filter`, `prefers-reduced-transparency`, 640px blur bloklari (blur yo'q) olib tashlandi
11. ✅ globals.css: `--glass-*` (15 ta), `--tint*` (3), `--shadow-accent`, `--card-inset`, `--color-tint*`, `--shadow-e1..3`, `--ease-studio/bounce` tokenlari (0 ishlatish) olib tashlandi
12. ✅ globals.css: ishlatilmaydigan utilitalar `text-gradient`, `edge-fade`, `hairline-b`, `link-underline`, `check-draw`, `delay-1..5`, `step-tile`, `cta-dark` olib tashlandi
13. ✅ globals.css: ishlatilmaydigan animatsiya tokenlari/keyframe'lar `float`, `float-slow`, `shimmer`, `marquee`, `drift`, `rotate-in`, `flip-in`, `blink`, `check-draw`, `glow`, `bounce-soft` (`spin-slow` chat ishlatgani uchun qoldi)
14. ✅ globals.css sarlavha izohi v3 holatiga (eski «suyuq shisha» tavsifi yo'q, z shkala va moslashuv atributlari hujjatlangan)
15. ✅ `.icon-tile-soft` rangi accent → fg-2 (bo'sh holat ikonkalari kulrang; aksent faqat asosiy amal) — `globals.css`
16. ✅ Toast: bitta pill, semantik rang faqat ikonkada, matn 14px — `toast.tsx`
17. ✅ ThemeToggle/LocaleSwitch: `card card-hover` karta-tugma → yassi ghost (hover 6% fon) — `ThemeToggle.tsx`, `LocaleSwitch.tsx`
18. ✅ Sidebar «Yana» menyusi: til/tema qatori → «Ko'rinish» paneli (til, tema, shrift, harakat — bitta joy) — `Sidebar.tsx`
19. ✅ CreateMenu Sheet ustida — o'z overlay/animatsiya/Escape/portal kodi yo'q (88 → 59 qator) — `CreateMenu.tsx`
20. ✅ `usePresence` + `useScrollLock` + `useFocusTrap` — Sheet/ConfirmDialog/Toast/Banner bitta mexanizm — `components/motion`
21. ✅ `[data-theme=dark] .field` / `.field:focus` maxsus fonlari → `--field-bg` tokeni — `globals.css`
22. ✅ Retina 0.5px ro'yxatidan o'lik klasslar (`glass-weak`, `hairline-b`) — `globals.css`
23. ✅ `--color-hairline` dublikati (`--color-line` bilan bir xil, ishlatilmagan) — `globals.css`
24. ✅ CSS hajmi: 1659 → 1648 qator, 56 012 → 55 537 bayt — ~330 qator o'lik kod olib tashlandi, ~320 qator yangi imkoniyat (tooltip, kbd, toast to'plami, print, kontrast, motion toggle) qo'shildi — sof hajm kichraydi
25. ✅ InsetGroup sarlavhasi (12px bold uppercase 0.14em) → `eyebrow` (bitta uslub) — `ui/index.tsx`
26. ✅ Sidebar/NavbarClient/Footer ikonka tugmalari `title`+`aria-label` dublikati → faqat `aria-label` (+ `data-tip` vizual)
27. ✅ NavbarClient mobil hisob tugmasi: ism matni (xl'da ham ko'rinmasdi — header md'da yashirin) olib tashlandi, faqat avatar — `NavbarClient.tsx`

## Token o'zgarishlari (oldin → keyin)
- `--fg-3` (light) #6f6d67 → #6b6963; `--fg-4` (light) #706e68 → #6c6a64; `--fg-4` (dark) #8a8881 → #8f8d86
- `--shadow-3` (light) 0 12px 32px -12px rgba(18,18,19,.18) → 0 8px 24px -10px rgba(18,18,19,.14); (dark) 0 16px 40px -14px rgba(0,0,0,.75) → 0 10px 28px -12px rgba(0,0,0,.6); `--shadow-2` (dark) .6 → .55
- Yangi: `--field-bg` (surface / dark surface-2), `--seg-track` (surface-3 / dark rgba(255,255,255,.08)), `--seg-thumb` (surface / dark rgba(255,255,255,.16)), `--switch-track` (surface-3 / dark rgba(255,255,255,.14))
- Yangi animatsiya tokenlari: `--animate-skeleton` (skeleton-pulse 1.6s), `--animate-skeleton-swap` (fade-in .3s)
- O'chirildi: `--glass-fill/-strong/-float/-weak`, `--glass-line/-rim/-rim-soft/-blur/-sat`, `--glass/-strong/-weak/-border/-border-soft/-specular/-shadow/-shadow-strong/-inner`, `--tint/-2/-soft`, `--shadow-accent`, `--card-inset`, `--color-tint/-2/-soft`, `--color-hairline`, `--shadow-e1..3`, `--ease-studio/-bounce`, `--animate-float/-float-slow/-shimmer/-marquee/-drift/-rotate-in/-flip-in/-blink/-check-draw/-glow/-bounce-soft`
- `prefers-contrast: more` ostida: `--line` .08→.28, `--line-2` .16→.45, `--fg-2/3/4` to'qroq (dark: ochroq), `--focus-ring-offset` 3→2px, halqa 3px
- Yangi atributlar: `html[data-theme-mode=auto|light|dark]`, `html[data-font=s|l]`, `html[data-motion=reduce]`, `html[data-scroll-lock]`, `html[data-offline]`; `[data-tip]`, `[data-print-hide]`
- Z shkala: yon panel 40 · navbar 50 · sheet 120 · modal/⌘K 130 · toast 140 · progress 150 · tarmoq banneri 160 · skip-link 170
- Bo'shliq: `mt-section` 64/80 → 48/64px; SectionHeading `mb` 32/48 → 24/32px

## Tekshiruv
- `npx tsc --noEmit` — o'z fayllarimda (globals/layout/manifest/api/til, components/ui|motion|layout|i18n, lib/i18n) xato yo'q (qolgan xatolar `kabinet/hisobot/csv/route.ts` — kabinet agenti fayli)
- curl: `GET /narxlar` + `Accept-Language: ru-RU,ru;q=0.9` → `<html lang="ru">`; `GET /api/til?t=ru&next=/\evil.com` → 303 `http://localhost:3000/` (ochiq redirect yopildi); `/api/health` 200
- Removed-klass auditi: `grep` bo'yicha o'chirilgan CSS klass/tokenlarga `src/` ichida murojaat yo'q (faqat `animate-spin-slow` chatda — token qoldirildi)
- Playwright `verify.mjs` (1440 mutaxassis + 390 mobil + Accept-Language): 34 tekshiruvdan 30 ✅ birinchi urinishda:
  Sheet (scroll qulfi, fokus ichkarida, Tab tuzog'i, Escape, qulf tiklanishi, fokus qaytishi), toast sheet ustida (z 140) + amal tugmasi, dublikat toast yo'q,
  `?` oynasi, input ichida qisqartma o'chadi, Ko'rinish: qorong'u → `data-theme=dark` + `theme-color` meta, shrift L → `main zoom 1.08` (HSCROLL yo'q), harakat → `data-motion=reduce`,
  Avto → localStorage tozalanadi, OS dark → avto rejim darhol, oflayn/onlayn banner (2.5 s), print'da yon panel/footer yashirin, `Accept-Language: ru` → `lang=ru`,
  mobil «Orqaga» faqat ichki sahifada, 390 HSCROLL yo'q, Sheet pastga surib yopiladi, Ko'rinish varag'i (6 radio + switch), «Yuqoriga» tab-bar ustida (756 ≤ 766px).
  4 ta ❌ tahlili: (1) `g l` → /lenta — dev server kompilyatsiyasi 8 s kutishdan uzun (verify2'da 60 s bilan qayta); (2) «Orqaga» ota yo'lga — HAQIQIY BUG topildi: StrictMode'da mount effekti ikki marta → `navDepth=2` → tarixsiz `router.back()`; tuzatildi (`prevPath` bilan faqat haqiqiy o'zgarishda ortadi); (3) font-display — next/font'ning lokal size-adjust `Fallback` yuzlari `auto` (to'g'ri), Unbounded/Manrope `swap`; (4) konsol — faqat tashqi rasm (`ERR_TUNNEL_CONNECTION_FAILED`, sandbox proksi), kod xatosi yo'q
VERIFY2_PLACEHOLDER
- Skrinshotlar (`/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/design/shots/`): `v-create-sheet-desktop.png`, `v-toast-over-sheet.png`, `v-shortcuts-dialog.png`, `v-appearance-menu.png`, `v-appearance-sheet-mobile.png`, `v-offline-banner.png`, `v-mobile-back.png`, `v-mobile-backtotop.png`, `after-guest-d1440-light-_vakansiyalar.png` (PageHeader baseline tekislash), `after-guest-d1440-light-_haqida.png`
CRAWL_PLACEHOLDER

## Boshqa sohalarga so'rovlar
- Barcha sohalar: `window.confirm(...)` o'rniga `useConfirm()` (`components/ui/ConfirmDialog`): `AdminSpecialistsTable.tsx`, `PortfolioManager.tsx`, `ReviewDeleteButton.tsx`, `ReviewForm.tsx` — `if (await confirm({ title, text, danger: true })) …`
- Barcha sohalar: `document.body.style.overflow = "hidden"` qo'lda emas — `useScrollLock(open)` (`components/motion/useScrollLock`): `PostModal.tsx`, `CommandPalette.tsx` (documentElement), `MapExplorer.tsx`, `PayButton.tsx`, `Filters.tsx`, `PortfolioGallery.tsx` — ichma-ich modal'da qulf qolib ketmasin
- Lenta/profil/jamoalar: like/reaksiya bosilganda `haptic("light")` (`components/motion/haptics`); o'z pastki varaqlaringiz (filtr, reaksiya paneli) — `Sheet` komponentiga o'tkazing
- Kabinet/admin statistikalari: raqamlarga `<CountUp value={n} format={formatNumber} />`
- Ro'yxat skeletlari: `<Skeleton lines={3} />`, yuklangan kontentga `className="skeleton-swap"`
- Kabinet (NotificationsBell): bell popover'iga `.pop-in/.pop-out` + `--pop-origin: top right` (NavbarClient hisob menyusi bilan bir xil)
- Katalog/qidiruv: filtr natijasi bo'sh bo'lsa `EmptyState variant="inline"` yoki `compact`
- Chat: `animate-spin-slow` o'rniga Tailwind `animate-spin` (token faqat shu bitta ishlatish uchun qoldi)

## Qoldirilgan / xavf
- Shrift o'lchami `zoom` orqali: Chrome/Safari/Firefox 126+ da ishlaydi; eski Firefox'da e'tiborsiz (xavfsiz degradatsiya). `main` ichida `100dvh` balandlikli bloklar (chat) L rejimida ~8% uzunroq bo'ladi
- Global qisqartmalar (`g …`, `c`, `/`) matn maydonidan tashqarida; agar biror sahifa o'z `c`/`/` tugmasini ishlatsa, `e.preventDefault()` qilsin (Shortcuts `defaultPrevented`ni hurmat qiladi)
- `PageHeader`/`SectionHeading` tavsifi endi `items-baseline` — sarlavha ikki qatorga tushsa tavsif birinchi qator chizig'ida turadi (ilgari pastki chetda)
- Button `glass`/`tint-soft` va Badge `pink/purple/glass` eski nomlari ko'rinishi o'zgardi (outline/ghost/neytral) — 2+1 joyda ishlatilgan, atayin
- `Logo` endi klient komponent (`useLocale`) — server sahifalarda ham ishlaydi, lekin `aria-label` uchun LocaleProvider kerak (layout'da bor)
