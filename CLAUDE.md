# Kasb Egalari — loyiha xotirasi

O'zbekiston bo'ylab videograf / montajchi / dizayner mutaxassislar marketpleysi.
Prod: https://kasbegalari.vercel.app (Vercel + Turso). Barcha UI matnlari va kod izohlari O'ZBEK tilida.

## Stek
- Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4 (token tizimi `src/app/globals.css`da)
- Drizzle ORM + @libsql/client — dev: `file:./data/redince.db`, prod: Turso (`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`)
- Auth: jose JWT cookie (+ 2FA TOTP, sessiyalar jadvali), zod validatsiya, lucide-react ikonkalar, @vercel/blob yuklamalar
- To'lovlar: Payme/Click webhook protokollari + qo'lda o'tkazma; escrow + payout CAS (`src/lib/payments/`)

## Buyruqlar
- `npm run dev` — dev server (3000-port); health: `GET /api/health`
- `npx tsc --noEmit` — har push oldidan MAJBURIY
- `npm run build` — prod build tekshiruvi
- `node scripts/smoke.mjs` — smoke testlar (dev server ishlab turishi kerak)
- `npx tsx scripts/db-sync.ts` — sxema o'zgarishini lokal bazaga qo'llash (yangi ustun/jadval qo'shilganda shu faylga ham yoz)
- Seed: `src/lib/db/seed.ts` (demo ma'lumotlar), xarita mesh: `node scripts/gen-map-mesh.mjs`

## Tuzilma (muhim joylar)
- `src/lib/queries.ts` — katalog so'rovlari + `listable` sharti (ban/hidden/obuna filtri). Xarita statistikasi: `src/lib/map-stats.ts`
- `src/lib/privacy.ts` — maxfiylik dvigateli: `filterSpecialistForViewer`/`toListItem` DTOlari. QOIDA: mutaxassis kontaktlari (telefon/telegram/instagram/email) mijozga faqat buyurtma qabul qilingach ko'rinadi — `resolveVisibility` majburiy clamp qiladi; yangi API/sahifa kontakt chiqarsa faqat shu DTOlar orqali
- `src/lib/notifications.ts` — `notify()` (sayt ichi + email + Telegram fan-out)
- `src/lib/i18n/` — til (uz/ru) cookie `til` orqali; server: `getLocale()`, klient: `useLocale()`, almashtirish: `/api/til`; lug'atlar `{ uz, ru }` juftligi bilan bo'lim fayllari
- Xarita: `src/components/map/NeonMap.tsx` (vizual qatlam, mesh `src/components/map/map-mesh.ts` — qo'lda tahrirlanmaydi, generator orqali), `UzbekistanMap.tsx` (hit-layer/pin/tooltip), `MapExplorer.tsx`
- Admin: `src/app/admin/` (queries.ts + page.tsx + components/admin/)
- Jamoalar (hamjamiyat): `src/lib/groups/` (service.ts — barcha egalik/huquq tekshiruvlari, validators.ts, limits.ts — klientga xavfsiz konstantalar), API `src/app/api/groups|posts|comments|follow`, UI `src/components/groups/`, sahifalar `src/app/jamoalar/`. Guruh chati 4s polling (2-bosqichda real-time). Reja: `docs/IJTIMOIY-TARMOQ.md`
- Kanallar: `groups.kind` (group|channel), `groups.isOfficial` — rasmiy kanal: hamma avtomatik a'zo (register + backfill), chiqib bo'lmaydi, faqat egasi/adminlar yozadi; efir e'loni `posts.eventAt/eventUrl`. Sayt adminlari har yangi jamoa/kanalga avtomatik admin a'zo
- Vakansiyalar (to'lovsiz, barcha onlayn kasblar): `src/lib/vacancies/` (format.ts — PROFESSIONS/lug'atlar, validators, service), API `src/app/api/vakansiyalar|arizalar|rezyume|rezyumelar`, UI `src/components/vacancies/`, sahifalar `/vakansiyalar`, `/rezyumelar`, kabinet `vakansiyalar|arizalarim|rezyume`. QOIDA: nomzod kontakti (email/telefon) faqat o'zi ariza yuborgan vakansiya egasiga ko'rinadi; ommaviy rezyumeda kontakt yo'q (chat orqali)

## Konvensiyalar
- Dizayn: premium-minimal "liquid glass"; globals.css tokenlari (`card`, `accent`, `fg-1..3`, `surface`, `line`) — xom ranglar emas. Brend: ink `#1a1a1c`, cream `#f6f4ee`, coral `#ff5a36`, displey shrift Unbounded
- Responsiv: mobil 390px'da gorizontal scroll bo'lmasin; admin jadvallar container query (`@container`, `@[66rem]`) bilan
- Playwright skrinshot/testlar: `.mjs` fayl yoz (inline `node -e` ISHLATMA — o'zbekcha apostroflar sindiradi), chromium: `/opt/pw-browsers/chromium`
- DB tranzaksiyalari: pul harakati har doim `db.transaction` + compare-and-swap holat guardlari
- Admin asosiy oqimlarni sinay oladi: obuna checkout/hisob, e'lon joylash, taklif yuborish route'lariga admin roli aniq qo'shilgan (blanket bypass YO'Q — `requireSession` qattiq qoladi); buyurtma oqimi ID bo'yicha — admin o'z buyurtmasida tomon sifatida qatnashadi
- Git: ishchi branch `claude/quirky-volta-tzlqwh`; har katta blokdan keyin commit+push; PR so'ralmagunicha ochilmaydi
- Foydalanuvchiga hisobotlar O'ZBEK tilida, skrinshotlar bilan

## Env (prod — Vercel)
`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `NEXT_PUBLIC_SITE_URL`, `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY` (email), `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME`/`TELEGRAM_WEBHOOK_SECRET` (bot), Payme/Click kalitlari — to'liq ro'yxat va yo'riqnoma `DEPLOY.md`da.

## QA rituali (har katta blokdan keyin)
1. `npx tsc --noEmit` toza; 2. `npm run build` muvaffaqiyatli; 3. smoke testlar; 4. Playwright skrinshotlar (desktop 1440 + mobil 390, light + dark) scratchpad'ga; 5. commit+push; 6. hisobot.

## Saqlash (prod holati)
Fayllar: Vercel Blob (`kasb.egalari-blob` store, **Public** access, 2026-10-16). Eslatma: Blob store access rejimi yaratilgandan keyin o'zgarmaydi — faqat Public store ishlaydi (kod `access: "public"` bilan yuklaydi). Diagnostika: Admin panel → "Fayl saqlash" → Sinab ko'rish. Arzon muqobil R2 — kartadagi yig'ma ko'rsatma.
