# Kasb Egalari — O'zbekiston ijodkorlar xaritasi

Kasb Egalari — O'zbekistonning **14 ta hududi** bo'ylab videograf, montajor, dizayner va boshqa ijodiy mutaxassislarni bir joyda topish platformasi. Mijoz interaktiv xaritada viloyatni bosadi, portfolio va narxlarni ko'radi, to'g'ridan-to'g'ri buyurtma beradi. Mutaxassis esa bepul ro'yxatdan o'tib, profil va portfoliosini joylaydi — buyurtmalar kabinetiga keladi.

## Imkoniyatlar

- **Interaktiv xarita** (`/xarita`) — hududlar mutaxassislar soniga qarab bo'yaladi (choropleth). Hududni bosing — ro'yxat chiqadi; yo'nalish tanlansa xarita ranglari ham shu yo'nalish bo'yicha qayta hisoblanadi. Holat URL bilan sinxron (`?region=&category=`).
- **Mutaxassislar katalogi** (`/mutaxassislar`) — qidiruv, yo'nalish, hudud, narx, tajriba, "faqat tasdiqlanganlar" filtrlari, saralash va sahifalash.
- **Profil sahifasi** — portfolio galereyasi (rasm / YouTube / havola), narxlar, ko'nikmalar, tillar, sharhlar, o'xshash mutaxassislar.
- **Buyurtma** — mijoz loyihani yozadi, mutaxassis kabinetda qabul qiladi / rad etadi / bajaradi (holatlar: yangi → qabul qilindi → jarayonda → bajarildi / bekor).
- **Sharhlar va reyting** — faqat ro'yxatdan o'tgan foydalanuvchilar; reyting avtomatik qayta hisoblanadi.
- **Kabinet** — buyurtmalar (kelgan / yuborilgan), profil tahriri, portfolio boshqaruvi, akkaunt sozlamalari.
- **Admin panel** (`/admin`) — statistika, yangi profillarni tasdiqlash, "tavsiya etilgan" belgisi, o'chirish, so'nggi foydalanuvchilar va buyurtmalar.
- **Ikki rejim** — Paper (yorug') va Noir (qorong'u), tizim sozlamasiga mos keladi.
- SEO: `sitemap.xml`, `robots.txt`, Open Graph, PWA manifest.

Barcha interfeys matnlari o'zbek tilida (lotin).

## Texnologiyalar

| Qatlam | Nima ishlatilgan |
| --- | --- |
| Framework | **Next.js 15** (App Router, Server Components, Route Handlers), **React 19**, TypeScript (strict) |
| Uslub | **Tailwind CSS v4**, "Studio" dizayn tizimi (`src/app/globals.css`), lokal shriftlar: Unbounded, Manrope, Instrument Serif |
| Ma'lumotlar bazasi | **SQLite / libSQL** (`@libsql/client`) + **Drizzle ORM** (`drizzle-kit push` bilan sxema) |
| Autentifikatsiya | Cookie'dagi **JWT** (`jose`), parollar `bcryptjs` bilan xeshlanadi, `middleware.ts` himoyalangan yo'llarni tekshiradi |
| Tekshiruv | **Zod** sxemalari (`src/lib/validators.ts`) — API va formalar uchun bitta manba |
| Ikonkalar | `lucide-react` |
| Xarita | Inline SVG, geoBoundaries ma'lumotlaridan avtomatik yaratilgan yo'llar |

## Ishga tushirish

Talablar: Node.js 20+ va npm.

```bash
cp .env.example .env     # muhit o'zgaruvchilari
npm i                    # bog'liqliklar
npm run db:push          # SQLite sxemasini yaratish (data/redince.db)
npm run db:seed          # namuna ma'lumotlar: admin, mijozlar, 65 ta mutaxassis, sharhlar, buyurtmalar
npm run dev              # http://localhost:3000
```

Boshqa skriptlar:

| Skript | Vazifasi |
| --- | --- |
| `npm run build` / `npm start` | Production build va server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:reset` | Bazani o'chirib, qayta yaratish va to'ldirish |
| `npm run db:studio` | Drizzle Studio (bazani brauzerda ko'rish) |

### Muhit o'zgaruvchilari (`.env`)

| Kalit | Tavsif |
| --- | --- |
| `DATABASE_URL` | `file:./data/redince.db` (lokal) yoki `libsql://xxx.turso.io` |
| `DATABASE_AUTH_TOKEN` | Turso ishlatilsa — token |
| `AUTH_SECRET` | JWT imzosi uchun uzun tasodifiy satr (kamida 32 belgi): `openssl rand -base64 48` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Seed paytida yaratiladigan admin hisobi |

## Demo hisoblar

`npm run db:seed` dan keyin:

| Rol | Email | Parol |
| --- | --- | --- |
| Admin | `admin@redince.uz` | `admin12345` |
| Mutaxassis | `mutaxassis@redince.uz` | `demo12345` |
| Mijoz | `mijoz@redince.uz` | `demo12345` |

Qolgan mutaxassislar uchun ham parol `demo12345`.

## Papka tuzilmasi

```
src/
├─ app/
│  ├─ page.tsx                 # Bosh sahifa (hero xarita, yo'nalishlar, tavsiya etilganlar)
│  ├─ xarita/                  # To'liq xarita rejimi (MapExplorer)
│  ├─ mutaxassislar/           # Katalog + [slug] profil sahifasi
│  ├─ buyurtma/[id]/           # Buyurtma berish formasi
│  ├─ auth/kirish, auth/royxat # Kirish / ro'yxatdan o'tish
│  ├─ kabinet/                 # Umumiy, buyurtmalar, profil, portfolio
│  ├─ admin/                   # Admin panel
│  ├─ api/                     # Route Handlers (quyidagi jadval)
│  ├─ not-found.tsx            # 404
│  ├─ layout.tsx, globals.css  # Asosiy layout va dizayn tizimi
│  └─ sitemap.ts, robots.ts, manifest.ts
├─ components/
│  ├─ ui/                      # Primitivlar: Button, Badge, Avatar, Stars, Card, SectionHeading, EmptyState…
│  ├─ map/                     # UzbekistanMap (SVG), MapExplorer, HomeMapSection, regions-geo.ts
│  ├─ specialists/             # Karta, filtrlar, sahifalash, portfolio galereyasi, sharhlar
│  ├─ orders/                  # Buyurtma formasi va ro'yxati
│  ├─ kabinet/                 # Kabinet navigatsiyasi va formalar
│  ├─ admin/                   # AdminSpecialistsTable
│  └─ layout/                  # Navbar, Footer, ThemeToggle, Backdrop
├─ lib/
│  ├─ db/schema.ts             # Drizzle sxemasi (users, specialists, portfolio_items, orders, reviews)
│  ├─ db/seed.ts               # Namuna ma'lumotlar
│  ├─ queries.ts               # Server tomonidagi so'rovlar (server-only)
│  ├─ auth.ts                  # Sessiya, JWT, parol
│  ├─ api.ts                   # Route handler yordamchilari (ok / fail / parseBody / requireSession)
│  ├─ validators.ts            # Zod sxemalari
│  ├─ constants.ts             # 14 hudud, 8 yo'nalish, buyurtma holatlari
│  └─ utils.ts                 # cn, formatPrice, slugify, timeAgo…
├─ fonts/                      # Unbounded, Manrope, Instrument Serif (woff2)
└─ middleware.ts               # /kabinet, /admin, /buyurtma himoyasi
```

## API

Barcha javoblar bir xil ko'rinishda:

```json
{ "ok": true, "data": { } }
{ "ok": false, "error": "Xabar", "fields": { "email": "Email band" } }
```

| Metod | Yo'l | Kirish | Tavsif |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | — | Ro'yxatdan o'tish (`role`: `client` \| `specialist`), sessiya cookie o'rnatiladi |
| `POST` | `/api/auth/login` | — | Kirish |
| `POST` | `/api/auth/logout` | — | Chiqish |
| `GET` | `/api/auth/me` | — | Joriy foydalanuvchi (yoki `null`) |
| `GET` | `/api/specialists` | — | Katalog. Parametrlar: `q, region, category, priceMax, experience, verified=1, sort (rating\|popular\|newest\|price_asc\|price_desc), page, limit (≤60)` → `{ items, total, page, pages }` |
| `GET` | `/api/specialists/[slug]` | — | Profil: portfolio va sharhlar bilan |
| `GET` | `/api/regions/stats` | — | Hududlar va yo'nalishlar bo'yicha sonlar (xarita uchun) |
| `PUT` | `/api/profile` | mutaxassis / admin | Mutaxassis profilini yaratish yoki yangilash |
| `PATCH` | `/api/profile` | har qanday | Akkaunt: ism, telefon, avatar |
| `POST` | `/api/portfolio` | mutaxassis / admin | Portfolio ishi qo'shish (ko'pi bilan 30 ta; YouTube uchun thumbnail avtomatik) |
| `DELETE` | `/api/portfolio/[id]` | egasi / admin | Ishni o'chirish |
| `POST` | `/api/orders` | har qanday | Buyurtma yuborish |
| `GET` | `/api/orders` | har qanday | Mening buyurtmalarim (mijoz va mutaxassis sifatida) |
| `PATCH` | `/api/orders/[id]` | tomonlar / admin | Holatni o'zgartirish (ruxsat etilgan o'tishlar tekshiriladi) |
| `POST` | `/api/reviews` | har qanday | Sharh qoldirish / yangilash (bitta mutaxassisga bitta) |
| `POST` | `/api/upload` | har qanday | Rasm yuklash (`multipart/form-data`, `file`, ≤5 MB, jpg/png/webp/gif) → `public/uploads` |
| `PATCH` | `/api/admin/specialists/[id]` | admin | `{ isVerified?, isFeatured? }` |
| `DELETE` | `/api/admin/specialists/[id]` | admin | Mutaxassisni o'chirish (cascade) |

## Xarita manbasi

Hudud chegaralari **geoBoundaries** (gbOpen, UZB ADM1) ma'lumotlar to'plamidan olingan — litsenziya **CC BY 4.0**. GeoJSON equirectangular proyeksiyada (o'rta kenglik bo'yicha tuzatilgan) tekislikka o'tkazilib, Douglas–Peucker algoritmi bilan soddalashtirilgan va `src/components/map/regions-geo.ts` fayliga SVG `path` ko'rinishida yozilgan (fayl avtomatik yaratilgan, qo'lda tahrirlanmaydi). Har bir hududning markazi (`cx`, `cy`) markerlar va yorliqlar uchun ishlatiladi.

Manba: [geoboundaries.org](https://www.geoboundaries.org) — Runfola, D. et al. (2020). *geoBoundaries: A global database of political administrative boundaries.*

## Production eslatmalari

- **`AUTH_SECRET` majburiy.** Productionda u o'rnatilmagan bo'lsa server ishga tushmaydi (dev rejimida vaqtinchalik kalit ishlatiladi). Kalit almashtirilsa barcha sessiyalar bekor bo'ladi.
- **Baza.** SQLite fayli bitta serverda yetarli. Serverless / bir nechta instansiya uchun **Turso (libSQL)** ishlating: `DATABASE_URL=libsql://…` va `DATABASE_AUTH_TOKEN`. Sxemani `npm run db:push` bilan yuboring.
- **Yuklamalar.** `/api/upload` fayllarni `public/uploads` ichiga yozadi — bu faqat doimiy diskli serverda ishlaydi. Productionda **S3 / Cloudflare R2** kabi obyekt saqlovchiga almashtiring (handler bitta joyda: `src/app/api/upload/route.ts`).
- **Rasmlar.** Tashqi rasm manbalari `next.config.ts` → `images.remotePatterns` da ro'yxatdan o'tkaziladi.
- **Cookie.** Sessiya cookie `httpOnly`, `sameSite=lax`, productionda `secure` — sayt HTTPS orqali xizmat qilishi kerak.
- **Admin.** Seed admin parolini (`ADMIN_PASSWORD`) albatta o'zgartiring.
- Tavsiya: so'rovlar chastotasini cheklash (rate limit) va xatolarni kuzatish (Sentry va h.k.) qo'shish.

## Roadmap

- [ ] Chat / xabarlar (mijoz ↔ mutaxassis) va bildirishnomalar (Telegram bot, email)
- [ ] To'lovlar va kafolatlangan bitim (Payme / Click / Uzum)
- [ ] Telefon orqali tasdiqlash (SMS) va ijtimoiy tarmoqlar orqali kirish
- [ ] Mutaxassis kalendari va bandlik jadvali
- [ ] Rus va ingliz tillari (i18n)
- [ ] Qidiruvda to'liq matnli indeks va geolokatsiya bo'yicha "yaqin atrofdagilar"
- [ ] Mutaxassislar uchun statistika paneli (ko'rishlar, konversiya)
- [ ] Testlar (Playwright e2e, Vitest) va CI

## Litsenziya

Loyiha kodi — xususiy. Xarita ma'lumotlari — geoBoundaries, CC BY 4.0. Shriftlar — SIL Open Font License.
