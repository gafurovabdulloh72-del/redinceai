# Kasb Egalari — ijtimoiy tarmoq qatlami: holat va reja

> Maqsad: ijodkorlar va barcha onlayn kasb egalari uchun Telegram + Instagram darajasidagi hamjamiyat —
> kanallar, guruhlar, lenta, chat, jonli efirlar, qo'ng'iroqlar, vakansiyalar. Hujjat ikki qismdan iborat:
> **nima qilindi** (kodda bor, prod'ga deploy qilinganda ishlaydi) va **nima qilinadi** (bosqichlar, texnologiya, xarajat, kimning ishi).

Oxirgi yangilanish: 2026-10-17 (commitlar 4a2bfe3 → fee5b50, branch `claude/quirky-volta-tzlqwh`).

---

## 1. Qilindi (1-bosqich — kodda tayyor)

| Blok | Nima bor | Qayerda |
|---|---|---|
| **Jamoalar (guruhlar)** | Ochiq/yopiq guruh, qo'shilish so'rovi va tasdiq, lenta (post: matn + 4 tagacha rasm/video, like, izoh), guruh chati (fayl/video bilan), a'zolar va rollar (egasi/admin/a'zo), moderatsiya (post/izoh o'chirish, chiqarish, admin qilish) | `/jamoalar`, `src/lib/groups/`, `src/components/groups/` |
| **Kanallar** | Faqat egasi/adminlar yozadi, a'zolar o'qiydi/yoqtiradi/izoh qoldiradi; "Muhokama" chati; kanal postlari a'zolarga bildirishnoma (sayt + Telegram) | `groups.kind = channel` |
| **Rasmiy kanal** | Sayt admini belgilaydi; **har bir ro'yxatdan o'tgan foydalanuvchi avtomatik a'zo** (mavjudlar backfill, yangilar register'da), **ro'yxat tepasida qadalgan**, **chiqib bo'lmaydi**; brend muqova | `groups.isOfficial`, `/jamoalar` banner |
| **Admin nazorati** | Foydalanuvchi ochgan har bir guruh/kanalga sayt adminlari avtomatik "admin" a'zo bo'ladi — boshqarish va moderatsiya | `createGroup()` |
| **Efir / yig'ilish e'lonlari** | Kanal/guruh egasi vaqt + havola (Zoom/Meet/YouTube/Telegram) bilan e'lon qiladi; a'zolarga "Jonli efir" bildirishnomasi; "Yaqin efirlar" kartasi; holatlar: kutilmoqda / hozir jonli / o'tkazildi | `posts.eventAt/eventUrl` |
| **Follow (obuna)** | Mutaxassis profilida "Obuna bo'lish", obunachilar soni, bildirishnoma | `/api/follow`, `FollowButton` |
| **Vakansiyalar** | 11 soha (IT, dizayn, video, marketing, kontent, sotuv, moliya, ta'lim, boshqaruv, data/AI, boshqa); format (masofaviy/gibrid/ofis), bandlik, tajriba, maosh, hudud, ko'nikmalar; 30 kun muddat + uzaytirish; **to'lovsiz** | `/vakansiyalar`, `src/lib/vacancies/` |
| **Rezyumelar** | Bitta rezyume/foydalanuvchi, ommaviy katalog (kontaktsiz — aloqa sayt chati orqali), ariza bilan avtomatik biriktiriladi | `/rezyumelar`, `/kabinet/rezyume` |
| **Arizalar** | Bir bosishda ariza (rezyume yoki xat), holatlar: yangi → ko'rildi → tanlovda / rad / ishga olindi; ish beruvchi nomzod kontaktini (email/telefon) faqat ariza kelganda ko'radi; ikki tomonga bildirishnoma | `/kabinet/vakansiyalar`, `/kabinet/arizalarim` |
| **Ro'yxatdan o'tish** | "Mutaxassis/mijoz" o'rniga **maqsad tanlovi**: Xizmat ko'rsataman / Buyurtma beraman / Ish qidiryapman / Xodim qidiryapman → mos sahifaga olib boradi | `/auth/royxat?intent=` |
| **Harakat (animatsiya)** | Sahifa kirishi, ro'yxatlar ketma-ket (stagger), like "pop", chat/tab fade, skeleton yuklanish, reduced-motion hurmati | `globals.css`, `app/template.tsx` |

Bildirishnoma turlari qo'shildi: `group_request`, `group_joined`, `post_comment`, `follow`, `channel_post`, `live_event`, `application_new`, `application_status`.

### Prod'ga chiqarish (deploy) — 3 qadam
1. Vercel deploy (push qilingan; `db-prepare` sxemani additive sinxronlaydi — mavjud ma'lumot saqlanadi).
2. Admin sifatida: **Jamoalar → "Guruh yoki kanal ochish" → Turi: Kanal → "Rasmiy kanal" ni yoqing** → barcha foydalanuvchilar avtomatik a'zo bo'ladi (bir martalik).
3. Rasmiy kanalda birinchi post + birinchi efir e'loni (Google Meet / YouTube Live havolasi bilan).

---

## 2. Keyingi bosqichlar

### 2-bosqich — Real-time qatlam (1–2 hafta)
Hozir chat 4 soniyalik polling bilan ishlaydi; bildirishnomalar sahifa yangilanganda ko'rinadi. "Telegram hissi" uchun kerak:
- **Texnologiya (tavsiya): Ably** (serverless/Vercel bilan mos, presence va typing bor, bepul tarif: oyiga 6 mln xabar / 200 bir vaqtdagi ulanish). Muqobil: Pusher Channels (200 ulanish bepul) yoki VPS'da Socket.IO (o'zimizniki, lekin VPS + monitoring kerak).
- Ishlar: xabar/post/like/izoh yaratilganda kanalga publish; klientda subscribe (DM, guruh chati, lenta); "yozmoqda…", onlayn/oxirgi faollik (lastSeenAt bor), o'qilmaganlar hisoblagichi real vaqtda; navbar qo'ng'iroqcha jonli.
- **Web push** (VAPID): PWA service worker bor — brauzer push bildirishnomalari (Telegram ulamaganlar uchun ham).
- Xarajat: $0 (bepul tarif) → ~$29/oy (minglab faol foydalanuvchida).

### 3-bosqich — Ovozli va video qo'ng'iroqlar (2–3 hafta)
- **Texnologiya (tavsiya): LiveKit** — ochiq kodli WebRTC SFU; avval **LiveKit Cloud** (bepul tarif bor), keyin xohlasak o'z VPS'imizga ko'chiramiz. Muqobil: Daily.co (oyiga 10 000 ishtirokchi-daqiqa bepul), Agora (10 000 daqiqa bepul).
- Ishlar: `/api/calls/token` (xona + foydalanuvchi uchun token), 1:1 qo'ng'iroq DM chatdan (tugma), guruh/kanal xonalari ("Ovozli chat" — Telegram voice chat kabi), qo'ng'iroq keldi ekrani + Telegram/push orqali "qo'ng'iroq" xabari, mikrofon/kamera/ekran ulashish, qo'ng'iroq tarixi.
- **TURN server**: O'zbekiston mobil tarmoqlarida NAT ortidagi ulanishlar uchun shart — LiveKit Cloud'da bor; o'zimiz qilsak VPS'da `coturn`.
- Xarajat: $0 → ~$50/oy (LiveKit Cloud), yoki VPS €4–8/oy.

### 4-bosqich — Jonli efirlar (2–3 hafta, 3-bosqichdan keyin)
- Bugun: efir e'loni + tashqi havola (YouTube Live / Google Meet / Telegram) — **ishlaydi**.
- Keyin: **sayt ichida efir** — LiveKit xonasi (1 boshlovchi + yuzlab tomoshabin), yonida jonli chat va reaksiyalar, qo'l ko'tarish, mehmonni sahnaga chiqarish; **yozib olish** (LiveKit Egress) → R2'ga saqlash → Lentada qayta ko'rish; efirdan 1 soat oldin eslatma (soatlik cron kerak — hozir kunlik).
- Haftada 2–4 efir rejasi uchun: "Efirlar jadvali" sahifasi (`/efirlar`), kalendar, takrorlanuvchi efir shabloni.

### 5-bosqich — Moderatsiya va xavfsizlik (parallel, 1 hafta)
- Post/izoh/xabar/guruhga **shikoyat** tugmasi (DM'da bor), admin navbati (`/admin` → "Shikoyatlar"), foydalanuvchini bloklash (bor), spam heuristikasi (bir xil matn, havola ko'pligi), kanal/guruh qoidalari matni, "ko'rinmas" (shadow) cheklovlar.
- Guruh chati va lentada rate-limit bor; minglab a'zoda bildirishnoma fan-out'ni **navbatga** (queue) o'tkazish (hozir 25 talik guruhlarda ketma-ket).

### 6-bosqich — Monetizatsiya va o'sish (YaTT + Payme/Click'dan keyin)
- Pullik kanallar / masterklasslar (obuna), donat ("rahmat"), vakansiyani tepaga ko'tarish (pullik pin), "tasdiqlangan ish beruvchi" belgisi, kanal statistikasi (ko'rishlar, o'sish).
- Vakansiyalar o'zi **to'lovsiz qoladi** (qaror).

### 7-bosqich — Mobil ilova
- Hozir PWA (bosh ekranga qo'shish). Keyin Capacitor/Expo qobig'i → Play Market / App Store, push orqali qo'ng'iroq va efir xabarlari.

---

## 3. Infratuzilma va taxminiy xarajatlar

| Nima | Hozir | Keyin | Narx |
|---|---|---|---|
| Hosting | Vercel Hobby | Vercel Pro (trafik oshsa) | $0 → $20/oy |
| Baza | Turso (bepul) | Turso Scaler | $0 → $29/oy |
| Fayllar | Vercel Blob 1 GB | Cloudflare R2 (10 GB bepul, keyin $0.015/GB) | $0 → arzon |
| Email | yo'q | Resend (domen kerak) | $0 → $20/oy |
| Real-time | polling | Ably | $0 → $29/oy |
| Qo'ng'iroq/efir | tashqi havola | LiveKit Cloud yoki VPS (Hetzner CX22 ≈ €4/oy) + coturn | $0 → $50/oy |
| SMS | yo'q | Eskiz.uz (YaTT kerak) | ~50 so'm/SMS |
| Domen | yo'q | ahost.uz → Cloudflare → Vercel | ~$10/yil |

---

## 4. Foydalanuvchi (loyiha rahbari) tomonidan qilinadigan ishlar

1. **Domen**: sotib olish → Cloudflare DNS → Vercel Domains (yo'riqnoma berilgan). Domen bo'lgach: Resend (email), OG/SEO to'liq ishlaydi.
2. **Telegram bot**: Admin panel → "Webhookni yangilash" (callback tugmalar — to'lovni tasdiqlash — ishlashi uchun).
3. **Rasmiy kanal**ni prod'da yaratish (yuqoridagi 3 qadam) va birinchi efirni e'lon qilish.
4. **YaTT** → Payme/Click merchant kalitlari → avtomatik to'lov; Eskiz SMS.
5. 2–3-bosqich boshlanganda: **Ably** va **LiveKit Cloud** hisoblarini ochish, kalitlarni Vercel env'ga qo'yish (chatga emas).
6. Hamjamiyat qoidalari matni va 1–2 moderator tayinlash (kanal/guruh adminlari).
7. Rus tili: Jamoalar va Vakansiyalar matnlari hozircha faqat o'zbekcha — tarjima qilinadi (texnik qarz ro'yxatida).

---

## 5. Texnik qarz va eslatmalar
- Guruh chati polling → 2-bosqichda real-time; DM chat ham shu qatlamga o'tadi.
- `notifyMembers` fan-out (kanal posti/efir) — a'zolar minglab bo'lganda navbat (Vercel Queue / cron batch).
- Vakansiya muddati tugashidan oldin egasiga eslatma (cron) — hozir faqat ro'yxatdan tushadi.
- Qidiruv `LIKE` bilan — 10 ming+ yozuvda SQLite FTS5.
- i18n: yangi modullar (`/jamoalar`, `/vakansiyalar`, `/rezyumelar`, kabinet bo'limlari) uz-only; `lib/i18n/dict/` ga `community.ts`, `vacancies.ts` qo'shiladi.
- Smoke testlar: `scripts/smoke.mjs` ga jamoalar/vakansiyalar oqimlari qo'shilsin.
- Bosh sahifada "Jamoalar" va "Vakansiyalar" bo'limlari (strip) — hozircha navbar/footer/menyu orqali.
