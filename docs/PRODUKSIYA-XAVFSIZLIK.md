# Produksiya xavfsizligi — ishga tushirishdan oldingi majburiy checklist

Bu hujjat — **pul oqimini (Payme/Click) va real foydalanuvchi ma'lumotlarini jonli qo'yishdan oldin** bajarilishi
shart bo'lgan qat'iy choralar ro'yxati. Bir dasturchi maslahati (2026-10) va O'zR qonunchiligi asosida tuzildi.

Belgilar: ✅ — kodda bajarilgan · ⚠️ — tashkiliy/huquqiy, siz bajarasiz · 🔴 — jonli pulni yoqishdan oldin SHART.

---

## 1. Ma'lumot joylashuvi (lokalizatsiya) — 🔴 eng muhim

O'zR **«Shaxsga doir ma'lumotlar to'g'risida»gi qonun** (№ ZRU-547, 2019; 2021-y. o'zgartirishlar) talabi:
O'zbekiston fuqarolarining shaxsiy ma'lumotlari **O'zbekiston hududidagi texnik vositalarda (serverlarda)**
qayta ishlanishi va saqlanishi, hamda baza **Davlat reyestridan** (Davlat personallashtirish markazi) o'tkazilishi shart.

Jinoyat kodeksi **278-modda** (va unga aloqador 141-modda — shaxsiy hayot daxlsizligi) — ma'lumot sizib chiqsa
yoki qonunbuzilik bo'lsa javobgarlik nazarda tutadi. Shuning uchun:

- 🔴 **Baza O'zbekistonда**: hozir `Turso` (chet el) + `Vercel` (chet el). Variantlar:
  1. O'zbekistondagi VPS/host (Ahost, UZINFOCOM, ValueHost va sh.k.) + PostgreSQL yoki libSQL (self-host).
  2. Mahalliy data-markaz (DATAPARK, Uzcloud) — yuridik shaxs uchun rasmiy shartnoma bilan.
- 🔴 **Media ham O'zbekistonда**: Cloudflare R2 chet el. Agar qat'iy talab bo'lsa — mahalliy S3-mos object storage.
  (Kod R2 → Blob → disk zanjirini qo'llab-quvvatlaydi: `src/lib/storage/r2.ts` — endpoint'ni mahalliyga almashtirish kifoya.)
- ⚠️ **Reyestr**: bazani Davlat personallashtirish markazi reyestridan o'tkazish (operator sifatida ro'yxatdan o'tish).
- ✅ Kod tomoni tayyor: baza ulanishi faqat env orqali (`TURSO_DATABASE_URL`), media URL-lari ko'chma — server
  joyini almashtirish kodga tegmaydi.

## 2. Ma'lumot arxitekturasi — ✅ to'g'ri qilingan

- ✅ **Bazada media bayt EMAS, faqat URL** saqlanadi (`avatarUrl`, `url`, `videoUrl`, `coverUrl`, `attachments`/`media`
  JSON). Baytlar tashqi object-storage'da (R2 → Blob → disk). Bu dasturchi maslahatining 1-nuqtasi.
- ✅ **Fayl turi sehrli baytlardan** aniqlanadi (brauzer MIME'siga ishonilmaydi) — `src/app/api/upload/route.ts`.
- ✅ **Fayl egaligi**: biriktirma faqat o'zi yuklagan URL bo'lishi shart (`assertOwnUploads`).

## 3. Autentifikatsiya va sessiya — ✅

- ✅ Parol `bcrypt` (cost 12) + user-enumeration himoyasi (`verifyAgainstDummy`).
- ✅ JWT sessiya versiyasi (`sv`) bazadan — parol/rol o'zgarsa eski cookie bekor; sessiyalar jadvali (qurilmalar, revoke).
- ✅ 2FA TOTP (`src/lib/security/totp.ts`), login ikki bosqichli.
- ✅ CSRF: har bir yozuv (POST/PUT/PATCH/DELETE)da Origin/Referer o'z hostimizga teng (`src/lib/api.ts handler`).
- ✅ Rate-limit (`enforceLimit`) login/ro'yxat/upload/yozuvlarda.
- ✅ CSP (nonce asosida, `src/middleware.ts`).
- 🔴 **Sirlar aylanishi**: jonli oldidan `JWT_SECRET`, `TURSO_AUTH_TOKEN`, provayder kalitlarini yangilash; hech biri
  kodда/gitда bo'lmasin (hozir tekshirildi — hardcoded sir yo'q).

## 4. Pul oqimi (eskrou/payout) — ✅ texnik jihatdan to'g'ri

- ✅ Har bir pul harakati **`db.transaction`** ichida (`src/lib/payments/service.ts`).
- ✅ **CAS guard**: `markPaid` holatga-bog'liq UPDATE qiladi (`WHERE state IN (active)`) — parallel
  Payme/Click `Perform/Complete` chaqiruvlarida faqat bittasi "paid" yo'lidan o'tadi, qolgani idempotent
  qaytadi yoki 409. Yarim holat (pul olindi, buyurtma yangilanmadi) qolmaydi — `ensureOrderPaidState` tuzatadi.
- ✅ Webhook idempotentligi: Payme (-31050…) va Click protokollari o'z-o'zini tuzatish bilan.
- 🔴 **Provayder hujjatlari** (tashkiliy): Payme/Click integratsiyasi uchun ariza —
  1) yuridik shaxs (MChJ/YaTT) + STIR; 2) kompaniya logotipi; 3) shartnoma; 4) test/prod kalitlari.
  Aniq ro'yxatni **Payme/Click call-markazi**dan oling: "dasturimni integratsiya qilmoqchiman, qanday hujjat kerak".
- 🔴 **Jonli pul oldidan tashqi pentest** (quyida, 7-bo'lim).

## 5. Maxfiylik (kontent sizishi, IDOR) — ✅

To'liq tahdid modeli: `docs/XAVFSIZLIK-AUDIT.md`. Qisqa: IDOR tekshiruvlari (reaksiya/izoh/iqtibos/shikoyat/
bloklash/obuna/@eslatma), kontakt-gating (telefon/Telegram/email buyurtmagacha yopiq), ikki tomonlama blok,
yopiq jamoa kontenti faqat a'zolarga. Video qo'ng'iroq tokeni ham egalik tekshiruvidan **keyin** beriladi
(`/api/qongiroq/token` — begona xonaga token olib bo'lmaydi).

## 6. Zaxira, monitoring, incident — ⚠️ yoqilsin

- ⚠️ **Avtomatik zaxira (backup)**: bazaning kunlik nusxasi (boshqa joyda), tiklashni sinab ko'rish.
- ⚠️ **Xato monitoringi**: Sentry yoki shunga o'xshash (server xatolari, 500lar).
- ⚠️ **Incident reja**: sizish/buzilish bo'lsa — kimga xabar, qanday qadamlar (qonun bo'yicha ma'lum muddatда
  xabar berish talabi bo'lishi mumkin), foydalanuvchilarni ogohlantirish matni tayyor.
- ✅ Audit jurnali bor (`src/lib/security/audit.ts`) — admin amallari, to'lov holatlari yoziladi.

## 7. Jonli ishga tushirishdan oldingi oxirgi qadamlar — 🔴

1. 🔴 Ma'lumot lokalizatsiyasi (1-bo'lim) — baza + media O'zbekistonda, reyestr.
2. 🔴 Tashqi/professional **penetratsion test** (pul tizimi va auth bo'yicha) — inson auditi.
3. 🔴 Sirlar yangilandi, `.env` gitда yo'q, prod env to'liq (`DEPLOY.md`).
4. 🔴 Payme/Click hujjatlari topshirildi, prod kalitlar faol.
5. ⚠️ Zaxira + monitoring + incident reja yoqilgan.
6. ⚠️ Foydalanish shartlari (`/oferta`) va maxfiylik siyosati (`/maxfiylik`) huquqshunos ko'rigidan o'tgan.

> **Xulosa (dasturchi maslahatiga):** texnik arxitektura (media≠baza, CAS pul guardlari, auth, IDOR) bizda
> to'g'ri qurilgan. Qolgan asosiy ish — **huquqiy**: ma'lumotni O'zbekistonga ko'chirish, reyestr, Payme/Click
> hujjatlari va jonli pul oldidan inson tomonidan pentest. Shoshmaslik to'g'ri.
