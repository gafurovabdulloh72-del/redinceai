# Redince — deploy, sozlash va operatsion qo'llanma

Bu hujjat production muhitini noldan ko'tarish, to'lov tizimlarini ulash, kunlik cron, zaxira nusxa (backup)
va baza migratsiyasi siyosatini tushuntiradi. Asosiy yo'l — **Vercel + Turso**. Railway (Docker/Nixpacks,
`railway.toml`) ham qo'llab-quvvatlanadi.

- Stack: Next.js 15 (App Router), React 19, Drizzle ORM + libSQL (lokal SQLite fayl yoki Turso).
- Build paytida `node scripts/db-prepare.mjs` ishlaydi: `drizzle-kit push --force` (sxema) + baza bo'sh bo'lsa seed.
- Holat tekshiruvi: `GET /api/health` → `{"ok":true,"db":"ok"}`.

---

## 1. Muhit o'zgaruvchilari

"Majburiy" — productionda bo'lmasa ilova ishga tushmaydi yoki asosiy funksiya o'chadi.

| O'zgaruvchi | Majburiy | Misol | Tavsif |
|---|---|---|---|
| `DATABASE_URL` / `TURSO_DATABASE_URL` | ha | `libsql://redince-<org>.turso.io` | Baza manzili. Lokal: `file:./data/redince.db`. Vercel Turso integratsiyasi `TURSO_*` ni o'zi qo'yadi. Vercel'da `file:` ishlamaydi (build to'xtaydi). |
| `DATABASE_AUTH_TOKEN` / `TURSO_AUTH_TOKEN` | Turso'da ha | `eyJhbGciOi…` | Turso tokeni (`turso db tokens create <db>`). |
| `SITE_URL` (yoki `NEXT_PUBLIC_SITE_URL`) | ha | `https://redince.uz` | Kanonik manzil: parol tiklash/tasdiqlash xatlari, to'lov qaytish URL'lari, sitemap, OG. Sozlanmasa productionda xatlar **yuborilmaydi** (Host sarlavhasiga ishonilmaydi). |
| `AUTH_SECRET` | ha, ≥ 32 belgi | `openssl rand -base64 48` | JWT sessiya kaliti; 2FA sirlari va payout rekvizitlari ham shu kalitdan (HKDF) shifrlanadi. Namunaviy (`change-me…`, `dev-only…`) yoki qisqa qiymat rad etiladi. **Almashtirilsa** — barcha sessiyalar bekor bo'ladi, 2FA foydalanuvchilari zaxira kod bilan kirib 2FA'ni qayta sozlaydi. |
| `ADMIN_EMAIL` | yo'q | `admin@redince.uz` | Seed yaratadigan admin. |
| `ADMIN_PASSWORD` | birinchi seed'da ha | kuchli parol | Bo'sh yoki `admin12345` bo'lsa production seed to'xtaydi. |
| `DEMO_PASSWORD` | yo'q | — | Demo hisoblar paroli; productionda bo'sh bo'lsa tasodifiy. |
| `NEXT_PUBLIC_DEMO_ACCOUNTS` | yo'q | `0` | `1` bo'lsa kirish sahifasida demo panel. **Productionda 0.** |
| `CRON_SECRET` | ha | `openssl rand -hex 32` | `/api/cron/daily` uchun `Authorization: Bearer …`. Bo'lmasa productionda cron o'chiq. Vercel uni o'zi yuboradi. |
| `PAYME_MERCHANT_ID` | Payme uchun | `65f…` | Payme kassa ID. |
| `PAYME_KEY` | Payme uchun | — | Production kalit (Merchant API Basic auth). |
| `PAYME_TEST_KEY` | test uchun | — | Test kassasi kaliti. |
| `PAYME_TEST` | yo'q | `1` | `1` — test kassasi (`checkout.test.paycom.uz`) va `PAYME_TEST_KEY`. Productionda olib tashlang. |
| `CLICK_SERVICE_ID` | Click uchun | `12345` | Click xizmat ID. |
| `CLICK_MERCHANT_ID` | Click uchun | `6789` | Click merchant ID. |
| `CLICK_MERCHANT_USER_ID` | Click uchun | `1011` | Click merchant user ID. |
| `CLICK_SECRET_KEY` | Click uchun | — | SHOP API imzo kaliti (md5 sign). |
| `PLATFORM_CARD` | yo'q | `8600 1234 5678 9012` | Qo'lda o'tkazma uchun karta (admin tasdiqlaydi). Bo'sh bo'lsa bu usul chiqmaydi. |
| `PLATFORM_CARD_NAME` | yo'q | `REDINCE MChJ` | Karta egasi nomi. |
| `RESEND_API_KEY` | tavsiya | `re_…` | Parol tiklash, email tasdiqlash, bildirishnoma xatlari. Bo'lmasa xat server konsoliga yoziladi. |
| `MAIL_FROM` | Resend bilan | `Redince <no-reply@redince.uz>` | Jo'natuvchi (domen Resend'da tasdiqlangan bo'lsin). |
| `TRUST_PROXY_HOST` | yo'q | `1` | `X-Forwarded-Host/Proto/For`'ga ishonish — faqat ishonchli proksi (Nginx) ularni qayta yozsa. Vercel/Railway'da avtomatik. |
| `TRUSTED_PROXY_HOPS` | yo'q | `1` | `X-Forwarded-For`'da o'ngdan nechta qiymat ishonchli proksiniki (rate limit IP'si). |
| `TRUST_CLOUDFLARE` | yo'q | `1` | Sayt Cloudflare orqasida bo'lsa — `cf-connecting-ip`'ga ishoniladi. Aks holda yoqmang (IP soxtalashtiriladi). |
| `BLOB_READ_WRITE_TOKEN` | Vercel'da ha | — | Vercel Blob (rasm yuklash). Vercel → Storage → Blob yaratilganda o'zi qo'shiladi. |
| `UPLOAD_DIR` | Railway'da | `/data/uploads` | Blob bo'lmasa yuklamalar papkasi (Railway Volume). |
| `SEED_ON_START` | yo'q | `0` | `0` — deploy'da seed o'tkazib yuboriladi (baza bo'sh bo'lsa ham). |

Platforma sozlamalari (komissiya darajalari, minimal summa, **obuna narxi / sinov / imtiyozli muddat / talab**,
shoshilinch ustama, USD kursi) env'da emas — **Admin → Sozlamalar**da o'zgartiriladi va audit jurnaliga
(«O'zgarishlar tarixi») yoziladi.

---

## 2. Vercel + Turso

1. **Turso baza**
   ```bash
   turso auth login
   turso db create redince --location fra        # yaqin region tanlang
   turso db show redince --url                    # → DATABASE_URL
   turso db tokens create redince                 # → DATABASE_AUTH_TOKEN
   ```
   Yoki Vercel → Storage → Marketplace → **Turso** → loyihaga *Connect* (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` avtomatik).
2. **Vercel loyiha**: GitHub repo'ni import qiling. Framework — Next.js. Build Command: `npm run vercel-build`
   (`db-prepare` + `next build`). Node 20.
3. **Blob**: Vercel → Storage → Blob → Create → loyihaga ulang (`BLOB_READ_WRITE_TOKEN`).
4. **Env**: 1-bo'limdagi jadval bo'yicha Production (va kerak bo'lsa Preview) muhitiga qo'shing.
   Preview uchun **alohida** Turso baza ishlating (`turso db create redince-preview --from-db redince`) — preview
   build'lari ham `drizzle-kit push` qiladi.
5. **Domen**: Settings → Domains → `redince.uz`; `SITE_URL=https://redince.uz`.
6. Birinchi deploy: build loglarida `✓ Sxema joyida` va seed natijasini tekshiring, so'ng:
   ```bash
   curl -s https://redince.uz/api/health
   BASE_URL=https://redince.uz npm run test:smoke
   ```
7. Admin bilan kiring → **Sozlamalar**: komissiya va obuna qiymatlarini tekshiring (4-bo'lim — obunani ishga tushirish).

**Railway**: `railway.toml` start buyrug'i `npm run start:railway` (db-prepare + `next start`). Volume'ni `/data`ga ulang,
`DATABASE_URL=file:/data/redince.db`, `UPLOAD_DIR=/data/uploads`. Cron uchun 5-bo'limdagi tashqi cron.

---

## 3. Payme va Click kabinetlari

Ikkala provayder ham bitta endpoint orqali **eskrou buyurtmalari** va **mutaxassis obunasi** to'lovlarini qabul qiladi.
Farq hisob identifikatorida: obuna hisoblari `sub_` prefiksi bilan boshlanadi (`subscription_invoices.id`), qolganlari — buyurtma ID.

### Payme (Merchant API, JSON-RPC)
- Kabinet: business.paycom.uz → Kassa → Sozlamalar.
- **Endpoint URL**: `https://redince.uz/api/payments/payme`
- **Hisob maydoni (account)**: bitta maydon — `order_id` (nomi aynan shunday, turi: matn).
  - Eskrou: `order_id` = buyurtma ID.
  - Obuna: `order_id` = `sub_…` (obuna hisobi ID). Summa hisobdagi summaga teng bo'lishi shart (tiyinda: so'm × 100).
- Kalitlar: production kalit → `PAYME_KEY`, test kalit → `PAYME_TEST_KEY`, kassa ID → `PAYME_MERCHANT_ID`.
- Test: `PAYME_TEST=1` bilan test.paycom.uz «Песочница»da barcha metodlarni (CheckPerformTransaction, CreateTransaction,
  PerformTransaction, CancelTransaction, CheckTransaction, GetStatement) o'tkazing — buyurtma va `sub_` hisobi uchun alohida.
- Tranzaksiya 12 soat ichida bajarilmasa cron uni bekor qiladi (holat −1, sabab 4).

### Click (SHOP API)
- Kabinet: merchant.click.uz → Xizmat sozlamalari.
- **Prepare URL** va **Complete URL**: ikkalasi ham `https://redince.uz/api/payments/click`
  (`action=0` — Prepare, `action=1` — Complete).
- `merchant_trans_id` = buyurtma ID yoki obuna uchun `sub_…`.
- Imzo: `md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id [+ merchant_prepare_id] + amount + action + sign_time)`.
- `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_MERCHANT_USER_ID`, `CLICK_SECRET_KEY`.

### Qo'lda o'tkazma
`PLATFORM_CARD` / `PLATFORM_CARD_NAME` bo'lsa mijoz (yoki obuna to'layotgan mutaxassis) karta rekvizitini ko'radi;
pul tushgach admin **Admin → To'lovlar** (eskrou) yoki **Admin → Obunalar** sahifasida tasdiqlaydi.

---

## 4. Mutaxassis obunasi: ishga tushirish xavfi

Obuna qoidasi (`src/lib/subscriptions/access.ts`): `subscription_until` bo'sh bo'lsa sinov muddati `created_at`dan
hisoblanadi (standart 30 kun + 3 kun imtiyoz). Productiondagi **eski mutaxassislarning** deyarli hammasi 33 kundan katta —
`subscriptionEnforced = 1` (standart) bilan deploy qilinsa ular katalog, xarita, qidiruv va sitemap'dan **darhol yo'qoladi**.

Deploy'dan oldin bittasini tanlang:

- **A. Talabni vaqtincha o'chirish**: Admin → Sozlamalar → «Obuna talabi» → O'chirilgan. Hamma ko'rinadi; e'lon qilingan
  sanada qayta yoqing.
- **B. Hammaga ishga tushirish sanasidan sinov berish** (bir martalik SQL, deploy'dan keyin darhol):
  ```bash
  turso db shell redince "UPDATE specialists SET subscription_until = (CAST(strftime('%s','now') AS INTEGER) + 30*86400) * 1000 WHERE subscription_until IS NULL;"
  ```
  (Bu 30 kun bepul davr beradi; qolgan kunlar to'lov paytida yo'qolmaydi.)

---

## 5. Kunlik cron

`vercel.json`: har kuni **03:00 UTC (08:00 Toshkent)** → `GET /api/cron/daily`. Vercel `CRON_SECRET`ni Bearer sifatida yuboradi.

Vazifalar: eskirgan Payme/Click pending tranzaksiyalarini bekor qilish; muddati o'tgan eskrouni avtomatik mutaxassisga
o'tkazish (ish topshirilgach 7 kun); topshirish sanasi va 24 soatlik SLA eslatmalari, 72 soat javobsiz buyurtmani bekor qilish;
`rate_limits` va 180 kundan eski audit yozuvlarini tozalash (sozlamalar tarixi ham 180 kun saqlanadi).
Shuningdek: muddati o'tgan e'lonlarni yopish (`closeExpiredJobs` → `jobsClosed`), saqlangan qidiruvlar bo'yicha xabarlar
(`checkSavedSearchAlerts` → `savedSearches`), obuna eslatmalari — 3 kun / 1 kun oldin, tugaganda va profil yashirilganda,
12 soatdan eski pending obuna hisoblarini bekor qilish (`runSubscriptionReminders` → `subscriptions`) va eskirgan
sessiyalarni tozalash (`sessionsDeleted`). Har bir qadam alohida try/catch ichida; sonlar JSON javobda va `cron_daily` audit yozuvida.
`?dry=1` — buyurtma eslatmalari va obuna eslatmalarini faqat sanaydi (hech narsa yubormaydi).

Vercel'dan tashqarida (Railway, VPS) — istalgan cron xizmati:
```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://redince.uz/api/cron/daily
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://redince.uz/api/cron/daily?dry=1"   # quruq sinov
```

---

## 6. Zaxira nusxa (backup) va tiklash

### Turso point-in-time restore (asosiy himoya)
Turso har bir bazaning o'zgarishlar tarixini saqlaydi (muddat tarifga bog'liq). Xato migratsiya yoki noto'g'ri
o'chirishdan keyin **yangi** bazaga ma'lum vaqtdagi holatni tiklang va ilovani unga yo'naltiring:
```bash
turso db create redince-restore --from-db redince --timestamp 2026-10-13T06:00:00Z
turso db show redince-restore --url        # → yangi DATABASE_URL
turso db tokens create redince-restore     # → yangi token
```
Tekshirib bo'lgach Vercel env'ni almashtirib redeploy qiling (yoki ma'lumotni eski bazaga qo'lda ko'chiring).

### Davriy SQL dump (tarifdan mustaqil, off-site)
Kamida kuniga bir marta, saqlash muddati ≥ 30 kun, boshqa provayderda (S3/R2/Backblaze) shifrlangan holda:
```bash
turso db shell redince .dump > redince-$(date +%F).sql
gzip -9 redince-$(date +%F).sql
# tiklash — yangi bazaga:
turso db create redince-from-dump
gunzip -c redince-2026-10-13.sql.gz | turso db shell redince-from-dump
```
Har oy bir marta tiklashni sinab ko'ring (dump'ni yangi bazaga yuklab, `npm run test:smoke` bilan tekshirish).

Lokal/Railway SQLite fayli uchun: `sqlite3 /data/redince.db ".backup '/data/backup-$(date +%F).db'"`.

**Eslatma**: yuklangan rasmlar (Vercel Blob / `UPLOAD_DIR`) bazada emas — ularni alohida zaxiralang
(Blob: `vercel blob list` + yuklab olish skripti; Railway: Volume snapshot).

---

## 7. Migratsiya siyosati

Build har safar `drizzle-kit push --force` qiladi: `src/lib/db/schema.ts` bilan baza o'rtasidagi farq **tasdiqsiz**
qo'llanadi. Shuning uchun:

**Ruxsat etilgan (additive) o'zgarishlar** — oddiy PR + deploy:
- yangi jadval, yangi indeks;
- yangi ustun: nullable yoki `default` bilan (`NOT NULL` + `default`);
- `$type<…>()` / enum ro'yxatini kengaytirish (SQLite'da bu faqat TypeScript darajasida).

**Taqiqlangan bitta deploy'da** (ma'lumot yo'qolishi yoki build xatosi):
- ustun yoki jadvalni o'chirish / qayta nomlash (push uni drop + create qiladi — ma'lumot yo'qoladi);
- ustun turini o'zgartirish, mavjud ustunni `default`siz `NOT NULL` qilish;
- iflos ma'lumotli ustunga `uniqueIndex` qo'shish.

**Destruktiv o'zgarishni xavfsiz qilish (expand → migrate → contract):**
1. *Expand*: yangi ustun/jadvalni additive qo'shing; kod ikkalasiga yozadi, eskisidan o'qiydi. Deploy.
2. *Backfill*: bir martalik skript yoki SQL bilan eski ma'lumotni ko'chiring (avval staging nusxada).
3. *Switch*: kod yangisidan o'qiydi. Deploy, kuzating.
4. *Contract*: keyingi relizda, **PITR nuqtasi va dump olingandan keyin**, eski ustunni schema.ts'dan olib tashlang.

**Har bir sxema PR'ida tekshiruv:**
```bash
turso db create redince-staging --from-db redince          # productionning nusxasi
DATABASE_URL=libsql://redince-staging-<org>.turso.io DATABASE_AUTH_TOKEN=… npx drizzle-kit push --verbose --strict
```
`--strict` har bir SQL'ni ko'rsatib tasdiq so'raydi — `DROP`/`ALTER … RENAME` ko'rinsa, PR'ni bo'ling.
Murakkab holatlarda `npx drizzle-kit generate` bilan SQL faylini yarating, ko'rib chiqing va past trafik paytida
`turso db shell redince < migration.sql` bilan qo'lda qo'llang.

---

## 8. CI va smoke testlar

- `.github/workflows/ci.yml`: har push/PR — `npm ci`, `tsc --noEmit`, ESLint (sozlangan bo'lsa, xato build'ni to'xtatmaydi),
  `DATABASE_URL=file:./data/ci.db node scripts/db-prepare.mjs`, `next build`, `next start` + smoke testlar.
- Smoke testlar (`scripts/smoke.mjs`, faqat `node:test` + `fetch`): health, bosh sahifa + CSP nonce, ro'yxat API shakli va
  maxfiyligi, profil va mehmon uchun yashirin telefon, `/ishlar`, Origin'siz POST → 403, noto'g'ri parol → 401,
  noma'lum profil → 404, `/kabinet` → kirishga yo'naltirish, PWA (manifest, `sw.js`, `/offline`), yordam markazi.
  ```bash
  npm run test:smoke                                   # BASE_URL standart: http://localhost:3000
  BASE_URL=https://redince.uz npm run test:smoke       # deploy'dan keyin
  ```

## 9. PWA

`public/sw.js` faqat productionda ro'yxatdan o'tadi: statik fayllar cache-first, ommaviy sahifalar network-first
(oflaynda keshdagi nusxa yoki `/offline`), `/api`, kabinet, admin, to'lov sahifalari hech qachon keshlanmaydi; kirish/chiqishda
sahifalar keshi tozalanadi. Kesh strategiyasi o'zgarsa `sw.js` ichidagi `VERSION`ni oshiring — eski keshlar avtomatik o'chadi.

## 10. Deploy'dan keyingi tekshiruv ro'yxati

- [ ] `/api/health` → ok; `npm run test:smoke` (production `BASE_URL` bilan) yashil.
- [ ] Admin → Sozlamalar: komissiya, obuna (narx, sinov, imtiyoz, talab) to'g'ri; 4-bo'lim bajarilgan.
- [ ] Payme test kassasi va Click test to'lovi: buyurtma va `sub_` hisobi uchun bittadan.
- [ ] `CRON_SECRET` bilan `/api/cron/daily?dry=1` → 200.
- [ ] Resend: parol tiklash xati keladi, havola `SITE_URL` bilan.
- [ ] `NEXT_PUBLIC_DEMO_ACCOUNTS=0`, `PAYME_TEST` o'chirilgan.
- [ ] Backup: birinchi dump olingan, off-site saqlangan.
