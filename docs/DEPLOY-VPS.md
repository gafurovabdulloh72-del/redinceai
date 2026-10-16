# O'z serverda ishga tushirish (domen + VPS) — qadam-baqadam

Vercel'dan o'z serverga ko'chish yo'riqnomasi. Kod tomoni tayyor: `Dockerfile`,
`docker-compose.yml`, `deploy/Caddyfile` (avto-SSL), `deploy/litestream.yml` (backup).
Sizdan faqat quyidagi qadamlarni bajarish so'raladi — **to'lov bosqichlari alohida belgilangan**.

Umumiy oylik xarajat: VPS (€4–8 yoki mahalliy ~200–400 ming so'm) + domen (~150 ming so'm/yil).

---

## 1-QISM. To'lovgacha bo'lgan qadamlar (brauzerda, ~20 daqiqa)

### 1.1 Domen tanlash — ahost.uz (yoki boshqa UZINFOCOM registratori)

1. https://ahost.uz → "Domenlar" → qidiruvga `kasbegalari` yozing.
2. **kasbegalari.uz** bo'shligini tekshiring (band bo'lsa: `kasbegalari.com`, `kasb-egalari.uz`).
3. Savatga qo'shing, hisob oching (email + telefon). 💳 **TO'LOV SHU YERDA** (~100–150 ming so'm/yil).
4. Qo'shimcha himoya uchun `.com` versiyasini ham oling (Cloudflare Registrar yoki Namecheap, ~$10/yil) — keyin .uz'ga redirect qilamiz.

### 1.2 Cloudflare hisobi (bepul) — DNS + CDN + himoya

1. https://dash.cloudflare.com/sign-up → hisob oching (bepul reja yetarli).
2. "Add a site" → domeningizni kiriting → **Free** rejani tanlang.
3. Cloudflare 2 ta NS (nameserver) beradi, masalan `ada.ns.cloudflare.com` / `bob.ns.cloudflare.com` — **yozib oling**.
4. ahost.uz kabinetida domen → DNS/NS sozlamalari → shu 2 ta NS ni kiriting (tarqalishi 1–24 soat).

### 1.3 Cloudflare R2 (fayllar uchun, keyinroq ham bo'ladi)

1. Cloudflare dash → R2 → "Create bucket" → nom: `kasbegalari-backup` (baza zaxirasi uchun) va keyin `kasbegalari-media` (fayllar).
2. ⚠️ R2 ni yoqishda Cloudflare karta so'raydi — **bu to'lov chegarasi** (10 GB gacha bepul, karta faqat kafolat uchun). Xohlasangiz bu qadamni keyinga qoldiring — sayt R2'siz ham to'liq ishlaydi (fayllar serverda saqlanadi).
3. R2 → "Manage API tokens" → token yarating (Object Read & Write) → `Access Key ID` va `Secret Access Key` ni yozib oling (Litestream backup uchun).

### 1.4 VPS tanlash — 2 variantdan biri

**A) Hetzner (arzon, zo'r temir):** https://console.hetzner.com → hisob oching (pasport tasdiqlashi so'ralishi mumkin) → "Add Server": joylashuv **Falkenstein/Nuremberg**, obraz **Ubuntu 24.04**, tur **CX22** (2 vCPU / 4 GB / 40 GB, ~€3.8/oy). SSH kalitingizni qo'shing. 💳 **TO'LOV SHU YERDA**.

**B) Mahalliy (ahost.uz VPS, ~200–400 ming so'm/oy):** 2 vCPU / 4 GB / 40 GB SSD, Ubuntu 24.04. Afzalligi: O'zbekiston qonuni fuqarolarning shaxsiy ma'lumotlarini mahalliy serverda saqlashni talab qiladi — rasmiy faoliyat uchun bu variant huquqiy jihatdan to'g'ri. 💳 **TO'LOV SHU YERDA**.

Natija: server **IP manzili** va **root SSH** kirishi.

### 1.5 Telegram bot (bepul, 2 daqiqa)

@BotFather → `/newbot` → nom va username → token. Batafsil: `docs/DEPLOY.md` §11.

---

## 2-QISM. Serverni ko'tarish (SSH orqali, ~15 daqiqa)

```bash
# 1. Kirish
ssh root@SERVER_IP

# 2. Docker o'rnatish (rasmiy skript)
curl -fsSL https://get.docker.com | sh

# 3. Kodni olish
git clone https://github.com/gafurovabdulloh72-del/redinceai.git /opt/kasbegalari
cd /opt/kasbegalari

# 4. Sozlamalar
cp deploy/env.vps.example .env
nano .env       # SITE_DOMAIN, SITE_URL, AUTH_SECRET, ADMIN_PASSWORD, CRON_SECRET to'ldiring
# Sirlar: openssl rand -base64 48   (AUTH_SECRET)
#         openssl rand -hex 32      (CRON_SECRET, TELEGRAM_WEBHOOK_SECRET)

# 5. Ishga tushirish (birinchi build 3-5 daqiqa)
docker compose up -d --build
docker compose logs -f app   # "Next.js ishga tushmoqda" ko'ringuncha
```

## 3-QISM. DNS ulash (Cloudflare)

1. Cloudflare → DNS → Records: `A` yozuv, nom `@`, qiymat `SERVER_IP`. Avval **DNS only (kulrang bulut)** qiling.
2. `CNAME` yozuv: nom `www`, qiymat `@` (yoki A yozuv o'sha IP).
3. 2-5 daqiqadan keyin `https://kasbegalari.uz` ochiladi — Caddy sertifikatni o'zi oladi.
4. Sertifikat ishlagach: ikkala yozuvda **Proxied (to'q sariq bulut)** yoqing va SSL/TLS rejimini **Full (strict)** qiling — CDN, kesh va DDoS himoya yonadi.

## 4-QISM. Yakuniy sozlashlar

```bash
# Kunlik fon vazifasi (eslatmalar, obuna, SLA) — serverda crontab -e:
7 1 * * * curl -s -H "Authorization: Bearer CRON_SECRET_QIYMATI" https://kasbegalari.uz/api/cron/daily

# Telegram webhook (yangi domen):
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d url="https://kasbegalari.uz/api/telegram/webhook" -d secret_token="<TELEGRAM_WEBHOOK_SECRET>"

# Backup yoqish (R2 kalitlari .env da bo'lsa):
docker compose --profile backup up -d
```

**Ma'lumotlarni ko'chirish (Vercel/Turso'dan):** `turso db shell <baza-nomi> .dump > dump.sql`,
so'ng serverda `docker compose down`, bo'sh `data/redince.db` o'rniga:
`sqlite3 data/redince.db < dump.sql` (sqlite3: `apt install sqlite3`), `SEED_ON_START=0` qiling va qayta `up -d`.
Bo'sh boshlasangiz — hech narsa kerak emas, seed o'zi demo ma'lumot yaratadi.

**Yangilash (yangi kod chiqqanda):**
```bash
cd /opt/kasbegalari && git pull && docker compose up -d --build
```
Qo'lda yangilamaslik uchun 6-QISMdagi GitHub Actions avto-deploy'ni yoqing — `main`ga push yetarli bo'ladi.

## Tekshiruv ro'yxati

- [ ] `https://DOMEN/api/health` → `{"ok":true}`
- [ ] Bosh sahifa, katalog, profil ochiladi; admin kira oladi
- [ ] Rasm yuklash ishlaydi (kabinet → portfolio)
- [ ] Telegram: kabinetda "Ulash" → botda ✅ xabari
- [ ] `docker compose logs litestream` — "replicating" (backup yoqilgan bo'lsa)
- [ ] Vercel loyihasini pauza qiling (ikki joyda ishlamasin), eski domen 301 redirect

## 5-QISM. R2 yoqish (fayllar Cloudflare'da — trafik bepul)

Kod tayyor: barcha 5 ta `R2_*` env to'ldirilsa yangi yuklamalar (rasm, hujjat, video) R2'ga boradi,
bo'sh qoldirilsa fayllar serverda (`/data/uploads`) saqlanadi — sayt R2'siz ham to'liq ishlaydi.

1. **Bucket:** Cloudflare dash → R2 → "Create bucket" → nom `kasbegalari-media` (1.3-qadamda ochgan bo'lsangiz — shu).
2. **Ommaviy domen:** bucket → Settings → **Public access → Custom Domains → Connect Domain** →
   `media.kasbegalari.uz` (domen Cloudflare'da bo'lgani uchun DNS yozuvi avtomatik qo'shiladi).
   Vaqtincha sinov uchun o'rniga **Public Development URL** (`https://pub-xxxx.r2.dev`) ni yoqsangiz ham bo'ladi.
3. **API token:** R2 → Manage API tokens → Create → ruxsat **Object Read & Write**, bucket: `kasbegalari-media` →
   `Access Key ID` va `Secret Access Key` ni yozib oling. Endpoint: `https://<account-id>.r2.cloudflarestorage.com`
   (token sahifasida ko'rsatiladi).
4. **Serverda `.env`ga qo'shing** (namuna: `deploy/env.vps.example` R2 bloki):
   ```bash
   R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   R2_BUCKET=kasbegalari-media
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_PUBLIC_BASE=https://media.kasbegalari.uz
   ```
   So'ng: `docker compose up -d --build app` (CSP/rasm sozlamalari env'dan o'qiladi — qayta build shart).
5. **Tekshiruv:** kabinet → portfolio → rasm yuklang; rasm `https://media.kasbegalari.uz/uploads/...` URL bilan
   ochilishi kerak. Chatda video yuboring (50 MB gacha) — brauzer to'g'ridan-to'g'ri R2'ga yuklaydi.
6. **Eski fayllarni ko'chirish** (Vercel Blob va/yoki serverdagi `public/uploads`dan — bazadagi URL'lar ham yangilanadi):
   ```bash
   # Avval reja (hech narsa yozmaydi):
   docker compose exec app npx tsx scripts/migrate-to-r2.ts --dry-run
   # Haqiqiy ko'chirish (idempotent — qayta ishga tushirsa o'tkazilganlarini tashlab ketadi):
   docker compose exec app npx tsx scripts/migrate-to-r2.ts
   ```
   Vercel Blob'dagi fayllar ham kerak bo'lsa, ishga tushirishdan oldin `.env`ga vaqtincha
   `BLOB_READ_WRITE_TOKEN=...` qo'shing (Vercel → Storage → Blob → Settings), tugagach olib tashlang.

## 6-QISM. GitHub Actions avto-deploy (push → server o'zi yangilanadi)

Workflow tayyor: `.github/workflows/deploy-vps.yml` — `main`ga push yoki qo'lda (Actions → Deploy VPS →
Run workflow) ishga tushadi; secrets qo'shilmaguncha hech narsa qilmaydi (xato ham bermaydi).

1. **Deploy kaliti yarating** (lokal kompyuterda yoki serverda):
   ```bash
   ssh-keygen -t ed25519 -f deploy_key -N "" -C "github-deploy"
   # Ochiq kalitni serverga qo'shing:
   cat deploy_key.pub >> /root/.ssh/authorized_keys   # (serverda)
   ```
2. **GitHub secrets** (repo → Settings → Secrets and variables → Actions → New repository secret):
   - `VPS_HOST` — server IP (yoki kasbegalari.uz; Cloudflare proxy SSH'ni o'tkazmaydi — IP ishonchliroq)
   - `VPS_USER` — `root`
   - `VPS_SSH_KEY` — `deploy_key` faylining TO'LIQ matni (`-----BEGIN OPENSSH PRIVATE KEY-----`dan boshlab)
3. **Tekshiruv:** Actions → "Deploy VPS" → Run workflow. Yashil bo'lsa: endi `main`ga har push serverda
   `git pull + docker compose up -d --build` bajaradi va `/api/health`ni kutadi.

## Keyingi bosqich (kalitlar tayyor bo'lganda Claude'ga ayting)

- Video-lenta uchun Bunny Stream integratsiyasi
