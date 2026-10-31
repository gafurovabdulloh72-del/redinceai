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
| `INDEXNOW_KEY` | tavsiya | `openssl rand -hex 16` | IndexNow (Yandex/Bing tez indekslash): kunlik cron o'zgargan sahifalarni darhol bildiradi; kalit fayli `/indexnow-key.txt` avtomatik. Bo'lmasa jim o'tadi (12-bo'lim). |
| `RESEND_API_KEY` | tavsiya | `re_…` | Parol tiklash, email tasdiqlash, bildirishnoma xatlari. Bo'lmasa xat server konsoliga yoziladi. |
| `MAIL_FROM` | Resend bilan | `Redince <no-reply@redince.uz>` | Jo'natuvchi (domen Resend'da tasdiqlangan bo'lsin). |
| `TELEGRAM_BOT_TOKEN` | yo'q | `123456789:AA…` | Telegram bot tokeni (BotFather). Bo'lmasa Telegram integratsiyasi butunlay o'chiq (11-bo'lim). |
| `TELEGRAM_BOT_USERNAME` | Telegram bilan | `kasbegalari_bot` | Bot username (@belgisisiz) — hisobni ulash deep-link'i uchun. |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram bilan | `openssl rand -hex 32` | Webhook himoyasi (`x-telegram-bot-api-secret-token`); mos kelmasa 401. |
| `TRUST_PROXY_HOST` | yo'q | `1` | `X-Forwarded-Host/Proto/For`'ga ishonish — faqat ishonchli proksi (Nginx) ularni qayta yozsa. Vercel/Railway'da avtomatik. |
| `TRUSTED_PROXY_HOPS` | yo'q | `1` | `X-Forwarded-For`'da o'ngdan nechta qiymat ishonchli proksiniki (rate limit IP'si). |
| `TRUST_CLOUDFLARE` | yo'q | `1` | Sayt Cloudflare orqasida bo'lsa — `cf-connecting-ip`'ga ishoniladi. Aks holda yoqmang (IP soxtalashtiriladi). |
| `BLOB_READ_WRITE_TOKEN` | Vercel'da ha | — | Vercel Blob (rasm yuklash). Vercel → Storage → Blob yaratilganda o'zi qo'shiladi. |
| `UPLOAD_DIR` | Railway'da | `/data/uploads` | Blob bo'lmasa yuklamalar papkasi (Railway Volume). |
| `SEED_ON_START` | yo'q | `0` | `0` — deploy'da seed o'tkazib yuboriladi (baza bo'sh bo'lsa ham). |
| `ADMIN_REQUIRE_2FA` | tavsiya | `1` | Admin uchun 2FA majburiy: yoqilsa 2FA'siz admin admin panel, admin API va Telegram admin botiga kira olmaydi (2FA sahifasiga yo'naltiriladi). **Avval barcha adminlar Kabinet → Xavfsizlik'da 2FA'ni yoqsin**, keyin qo'ying. |

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

## 11. Telegram bot (bildirishnomalar)

Foydalanuvchi hisobini Telegram botga ulasa, saytdagi bildirishnomalar (buyurtma, to'lov, takliflar, chat
xabarlari, eslatmalar) qisqa ko'rinishda botga ham boradi. Uchala env ham ixtiyoriy — `TELEGRAM_BOT_TOKEN`
bo'lmasa integratsiya jimgina o'chiq: kabinetda karta chiqmaydi, hech qayerda xato ko'rinmaydi.

1. **Bot yaratish**: Telegram'da [@BotFather](https://t.me/BotFather) → `/newbot` → bot nomi va username
   (masalan `kasbegalari_bot`). BotFather bergan token → `TELEGRAM_BOT_TOKEN`.
2. **Vercel env** (Production, 1-bo'limdagi jadval): `TELEGRAM_BOT_TOKEN` va `TELEGRAM_BOT_USERNAME`
   (@belgisisiz, masalan `kasbegalari_bot`). Redeploy qiling. `TELEGRAM_WEBHOOK_SECRET` ixtiyoriy —
   berilmasa sir `AUTH_SECRET`dan avtomatik hosil qilinadi.
3. **Webhook o'rnatish** (deploy'dan keyin bir marta): Admin panel → «Telegram bot» bo'limi →
   **«Webhookni o'rnatish»** tugmasi — server o'zi `setWebhook` chaqiradi va holatni (token to'g'riligi,
   webhook manzili, oxirgi xato) shu kartada ko'rsatadi. Qo'lda muqobil:
   `curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" -d url="https://kasbegalari.vercel.app/api/telegram/webhook" -d secret_token="<SECRET>"`.
   Webhook faqat `x-telegram-bot-api-secret-token` to'g'ri so'rovlarni qabul qiladi (aks holda 401).
4. **Bot profili (dizayn)**: Admin panel → «Telegram bot» → **«Bot profilini sozlash»** — nom, qisqa tavsif
   («About»), bo'sh chatdagi tavsif, buyruqlar menyusi va menyu tugmasi Bot API orqali qo'yiladi (matnlar
   `src/lib/telegram-bot/ui.ts`). Rasmlar faqat BotFather orqali: `/setuserpic` → `public/bot/avatar.png`
   (1024×1024), «Edit Bot → Edit Description Picture» → `public/bot/description.png` (640×360). `/start`
   banneri (`public/bot/welcome.png`) saytdan avtomatik olinadi.
5. **Ulash oqimi**: Kabinet → Profil → «Telegram bildirishnomalari» → «Telegramga ulash» → bot ochiladi →
   «Start». Ulash kodi 15 daqiqa amal qiladi (imzolangan, bazada saqlanmaydi); bitta chat faqat bitta hisobga
   ulanadi — yangi hisob ulansa eskisidan avtomatik uziladi. Uzish: kartadagi «Uzish» tugmasi yoki botda `/stop`.
   Botda: `/start` — menyu, `/buyurtmalarim`, `/xabarlar`, `/kurslar`, `/kurslarim`, `/efirlar`, `/vakansiyalar`,
   `/top`, `/profil`, `/sozlamalar` (bildirishnoma guruhlari switch'lari), `/yordam`; oddiy matn — ijodkor qidiruvi.
   **Admin uchun** (chat admin hisobiga ulangan bo'lsa): `/elon Sarlavha | Matn` — barcha/mutaxassislar/mijozlarga
   ommaviy e'lon (sayt + Telegram), yuborishdan oldin auditoriya tugmalari.
6. **Mini App (ilova)**: `SITE_URL` https bo'lsa «Bot profilini sozlash» menyu tugmasini `Ilova` (web_app → `/tg`)
   qiladi va `/start` menyusida «📱 Ilovani ochish» chiqadi. Ilova Telegram ichida ochiladi, `initData` imzosi
   bot tokeni bilan tekshiriladi va foydalanuvchi hisobiga avtomatik kiradi (hisob bo'lmasa yaratiladi —
   «Telegram bilan kirish» qoidalari). Ilova SDK'siz ishlaydi — Telegram URL hash'ida bergan `tgWebAppData`
   o'qiladi. Ulashish tugmalari (profil/post/kurs) `t.me/<bot>?startapp=…` havola beradi — qabul qiluvchi
   Telegram'da bossa ilova to'g'ri shu sahifada, kirgan holda ochiladi. **Chap paneldagi «Mini App» ro'yxati va profil «Open App» tugmasi** uchun BotFather: `/mybots` →
   bot → **Bot Settings → Configure Mini App → Enable Mini App** → URL `https://<sayt>/tg` (bu «asosiy mini
   ilova» — Telegram uni Apps bo'limida ko'rsatadi). Ixtiyoriy: `/newapp` → `t.me/<bot>/app` qisqa havola.

7. **Admin boti va qo'shimchalar (2026-10-31)**: admin hisobi Telegramga ulangan bo'lsa (Kabinet → Profil → «Telegramga ulash») botda
   `/admin` (menyu), `/stat` (bugun/7/30 kun), `/navbat` (tasdiq navbati — mutaxassisni bir bosishda tasdiqlash), `/tolovlar`,
   `/user <ism|email>` (bloklash/blokdan chiqarish, kontakt rejimi/maxsus narx), `/narx` (kontakt narxlari), `/elon` (ommaviy e'lon),
   `/shikoyatlar` (yopish / kontentni o'chirish / muallifni bloklash), `/mentorlar` (mentor arizasini tasdiqlash/rad etish),
   `/nizolar` (ochiq nizolar — qaror panelda), `/payoutlar` (pul chiqarish so'rovlari — «To'landi» / «Rad etish») ishlaydi;
   `/stat` oldingi davr bilan taqqoslaydi (▲/▼ %) va 7/30 kunlik trend chizadi; har kuni ertalab kunlik hisobot keladi
   (dushanba — haftalik ham); jonli ogohlantirishlar: yangi mutaxassis, yangi shikoyat (tugmalar bilan), mentor arizasi,
   kontakt sotuvi, qo'lda o'tkazma. Admin panel → Telegram bot → «Sinov xabari» tugmasi bildirishnoma yo'lini tekshiradi,
   «Kunlik hisobot» — kechagi hisobotni hozir yuboradi. Bot tili: Telegram tili ruscha bo'lgan foydalanuvchiga bot ruscha javob beradi. **Har deploydan keyin** «Bot profilini sozlash» (buyruqlar menyusi: /post, /royxat, admin buyruqlari)
   va «Webhookni yangilash» (allowed_updates: inline_query) bosilsin.
8. **Inline rejim** (`@bot montajchi` — istalgan chatda ijodkor kartasini ulashish): BotFather → `/setinline` → bot → placeholder
   («ijodkor qidirish…»). Admin panelda «Inline rejim yoqilgan» qatori ko'rinadi.
9. **Bot orqali post**: mutaxassis botga rasm/video (20 MB gacha, izoh rasm ostida) yuboradi → «Lentaga post qilamizmi?» →
   fayl R2/Blob'ga saqlanadi, profil posti yaratiladi. Ro'yxatdan o'tish: `/royxat` yoki Mini App'dagi «Yo'q, ro'yxatdan o'taman»
   (savollar ketma-ket) — Telegram'dan kirganga avtomatik hisob OCHILMAYDI.

## Muhim: sxema sinxronizatsiyasi (2026-10-14 hodisasi)

`drizzle-kit push --force` ISHLATMANG. drizzle-kit 0.31 SQLite/Turso'da `DEFAULT 0` yoki `DEFAULT false` bilan
NOT NULL ustun qo'shilganda oldidan `delete from <jadval>` qo'yadi va `--force` uni so'roqsiz bajaradi. 4-raund deployida
production'da `users` va `specialists` shu tarzda tozalangan, keyin seed `ADMIN_PASSWORD` yo'qligi sababli build'ni
to'xtatgan va sayt eski versiyada bo'sh katalog bilan qolgan.

Endi `scripts/db-prepare.mjs` sxemani `scripts/db-sync.ts` orqali sinxronlaydi:
- `delete from …` buyruqlari har doim o'tkazib yuboriladi;
- jadval/ustun/indeks o'chirish faqat `ALLOW_DATA_LOSS=1` bilan (aks holda build aniq xabar bilan to'xtaydi);
- katalog bo'sh va foydalanuvchilar ≤ 20 bo'lsa demo ma'lumotlar qayta yuklanadi;
- `ADMIN_PASSWORD` (kamida 10 belgi) berilsa admin paroli har deployda shunga o'rnatiladi — parol yo'qolsa env'ni
  o'zgartirib qayta deploy qilish kifoya;
- `ADMIN_PASSWORD` bo'lmasa build endi to'xtamaydi (admin tasodifiy parol bilan yaratiladi, logda ogohlantirish).

## 12. Qidiruv tizimlarida ko'rinish (SEO indekslash)

Sayt Google/Yandex'da chiqishi uchun kodda hammasi tayyor (`robots.ts`, `sitemap.ts`,
har sahifada `title`/`description`/`canonical`, JSON-LD). Qolgani — bir martalik sozlash.

**0. Avval shuni tekshiring (eng ko'p uchraydigan xato).**
Vercel → Project → Settings → Environment Variables da `NEXT_PUBLIC_SITE_URL`
PRODUCTION uchun to'g'ri qo'yilganmi (`https://kasbegalari.vercel.app` yoki o'z domeningiz).
Qo'yilmagan bo'lsa — `sitemap.xml`, `robots.txt` va barcha `canonical` havolalar
`http://localhost:3000` ga ishora qiladi va Google hech narsani indekslamaydi.
Tekshirish: `https://<domen>/robots.txt` va `/sitemap.xml` ni brauzerda oching —
ichidagi manzillar to'g'ri domen bilan boshlanishi kerak.

**1. O'z domeni (eng katta ta'sir).** `*.vercel.app` — Vercel'ning umumiy domeni;
Google unga kam ishonadi va ko'pincha umuman indekslamaydi. `kasbegalari.uz` kabi
o'z domeningizni oling → Vercel → Settings → Domains → qo'shing →
`NEXT_PUBLIC_SITE_URL` ni yangilang → qayta deploy.

**2. Google Search Console** (https://search.google.com/search-console):
«Add property» → URL prefix → domeningiz → tasdiqlash usuli «HTML tag» →
`content="..."` qiymatini oling → Vercel env'ga `GOOGLE_SITE_VERIFICATION` deb qo'ying →
qayta deploy → «Verify». So'ng: Sitemaps → `sitemap.xml` yuboring;
URL Inspection → bosh sahifa → «Request indexing».

**3. Yandex Webmaster** (https://webmaster.yandex.com) — O'zbekistonda Yandex ulushi katta.
Xuddi shunday: meta teg qiymatini `YANDEX_VERIFICATION` env'iga qo'ying, sitemap'ni yuboring.

**4. Tashqi havolalar.** Google yangi saytni faqat sitemap bilan tez indekslamaydi.
Telegram kanal/guruh, Instagram bio, YouTube tavsifi, mahalliy kataloglar (olx, uz
biznes kataloglari) — har bir havola indekslashni tezlashtiradi.

**5. Kutish.** Yangi domen uchun odatda 3 kundan 4 haftagacha. Holatni Search Console →
«Pages» bo'limida kuzating: «Discovered – currently not indexed» — kutilmoqda,
«Crawled – currently not indexed» — kontent yetarli emas (ko'proq profil/post kerak).

**6. IndexNow (Yandex/Bing — darhol bildirish).** Vercel env'ga `INDEXNOW_KEY` qo'ying (masalan `openssl rand -hex 16`),
redeploy. Kunlik cron (`/api/cron/daily`, (p)-bosqich) so'nggi 26 soatda o'zgargan sahifalarni `api.indexnow.org`ga
yuboradi — Yandex ularni sitemap'ni kutmasdan oladi. Tekshirish: `https://<domen>/indexnow-key.txt` kalitni qaytarsin;
Yandex Webmaster → «Индексирование → IndexNow» da so'rovlar ko'rinadi. Google IndexNow'ni qo'llamaydi — unga sitemap + «Request indexing».

Env (hammasi ixtiyoriy, bo'lmasa meta teg chizilmaydi / IndexNow jim o'tadi):
`GOOGLE_SITE_VERIFICATION`, `YANDEX_VERIFICATION`, `INDEXNOW_KEY`.
