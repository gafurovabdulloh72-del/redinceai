# Xavfsizlik auditi — ijtimoiy tarmoq bloki (2026-10-18)

Bu hujjat **dasturchi tekshiruvi** uchun: nima qo'shildi, qaysi xavflar ko'rib chiqildi, nima tuzatildi, nimani qo'lda tekshirish kerak
va keyingi tavsiyalar. Barcha API'lar `src/lib/api.ts` → `handler()` orqali o'raladi (CSRF: GET/HEAD/OPTIONS'dan boshqa usullarda
Origin/Referer o'z hostimizga teng bo'lishi shart), sessiya — `requireSession()` (JWT `sv` bazadagi sessiya versiyasi bilan solishtiriladi,
rol bazadan olinadi), kiritish — zod (`parseBody`/`parseQuery`, 422), tezlik chegarasi — `enforceLimit()` (`src/lib/security/rate-limit.ts`).

## 1. Qamrov (yangi qo'shilgan funksiyalar)

| Blok | Fayllar | API |
| --- | --- | --- |
| Ijtimoiy qobiq va lenta | `components/layout/Sidebar, CreateMenu, FooterGate`, `components/feed/*`, `lib/feed.ts` | `GET /api/feed` |
| Reaksiyalar, saqlash, @eslatma | `lib/groups/service.ts (setReaction, toggleSave)`, `lib/groups/mentions.ts`, `components/groups/Reactions.tsx, MentionInput.tsx` | `POST /api/posts/[id]/like`, `POST /api/posts/[id]/save`, `GET /api/posts/saved`, `GET /api/users/mention` |
| Chat: ovoz, iqtibos, yozmoqda | `components/chat/VoiceRecorder, MessageParts, DmChat`, `components/groups/GroupChat`, `lib/chat/dm.ts, quote.ts`, `api/upload` | `POST /api/upload (purpose=voice)`, `POST /api/chat/[id]` (`replyToId`), `POST /api/chat/[id]/typing`, `POST /api/groups/[slug]/chat` (`replyToId`), `POST /api/groups/[slug]/chat/typing` |
| Bloklash, maxfiylik, shikoyat | `lib/privacy/blocks.ts`, `components/kabinet/PrivacyPanel, BlockedList`, `components/specialists/BlockButton, ReportButton`, `api/reports` | `GET/POST/DELETE /api/blocks/[userId]`, `GET /api/blocks`, `GET/PUT /api/account/privacy`, `POST /api/reports` (post/comment/message) |
| Profil bo'limlari, obunalar | `components/kabinet/ProfileForm`, `components/groups/FollowersDialog`, `app/kabinet/obunalar` | `PUT /api/profile` (`workHistory`, `education`), `GET /api/follow/[userId]?list=` |

## 2. Tahdid modeli va tekshiruv natijalari

Belgilar: ✅ — tekshirildi/tuzatildi · ⚠️ — ongli qaror, e'tibor bering · 🔜 — tavsiya (keyingi bosqich).

### 2.1 Avtorizatsiya va IDOR (id klientdan keladi)

- ✅ **Reaksiya / izoh** (`/api/posts/[id]/like|comments`): jamoa posti — faqat faol a'zo (`assertActiveMember`), profil posti — kirgan har kim, lekin blok va `commentPolicy` tekshiriladi (`assertCanInteractProfilePost`). Bir foydalanuvchi = bitta reaksiya (unique indeks `post_likes_pair_idx`).
- ✅ **Saqlash** (`/api/posts/[id]/save`): yopiq jamoa posti faqat ko'ra oladiganlarga (`assertCanView`); `GET /api/posts/saved` — faqat egasining yozuvlari, yopiq jamoadan chiqib ketilgan bo'lsa post ro'yxatdan tushadi.
- ✅ **Iqtibos** (`replyToId`): faqat **shu suhbat/guruh** ichidagi xabarga (aks holda 422). Boshqa suhbat id'si bilan kontent sizdirib bo'lmaydi.
- ✅ **Typing**: DM — faqat ishtirokchi (`loadConversationFor`), guruh — faqat faol a'zo.
- ✅ **Shikoyat** (`/api/reports`): post — yopiq jamoada faqat ko'ra oladiganlar; izoh — xuddi shunday; xabar — DM'da faqat suhbat ishtirokchisi, guruhda faqat a'zo; o'z kontentiga shikoyat 400; takror 409.
- ✅ **Bloklash**: faqat o'z nomidan (`session.sub` → blocker), o'zini bloklash 400, mavjud bo'lmagan foydalanuvchi 404.
- ✅ **Maxfiylik sozlamalari**: faqat o'zi (`users.id = session.sub`), zod enum.
- ✅ **Obunalar ro'yxati**: `?list=` **faqat kirganlarga** (audit paytida ommaviydan yopildi — skreyping/profil yig'ishni cheklash); holat (`following`, sonlar) ommaviy.
- ✅ **@eslatma qidiruvi** (`/api/users/mention`): faqat kirganlarga; faqat taxallusi bor va banlanmaganlar; kontakt maydonlari (email/telefon) qaytarilmaydi.
- ✅ **Fayl egaligi**: biriktirma (ovozli xabar ham) faqat o'zi yuklagan URL bo'lishi kerak (`assertOwnUploads` — audit jurnalidagi `upload` yozuvi bo'yicha); test: boshqa foydalanuvchi faylini ulash → 422.
- ✅ **Admin**: `canModeratePost` orqali sayt admini post/izohni o'chira oladi; blanket bypass yo'q (`requireSession` qattiq).

### 2.2 Maxfiylik (kontent sizishi)

- ✅ Yopiq jamoa: lentada (`/api/feed`) faqat ochiq jamoalar; @eslatma yopiq jamoada **faqat faol a'zolarga** (`notifyMentions` → `groupMembers`); saqlanganlar ro'yxati a'zolikni qayta tekshiradi.
- ✅ Blok ikki tomonlama: DM (yangi suhbat ham, mavjudida yuborish ham) 403; obuna 403 va mavjud obunalar uziladi; profil postiga izoh/reaksiya 403; bosh lenta mualliflarni yashiradi (`notBlockedCondition`); @eslatma yetmaydi (`filterBlocked`); `/yozish/<username>` suhbat yaratmaydi.
- ✅ `showOnline=false`: `briefUsers` (guruh chati, izohlar, ro'yxatlar) va DM sarlavhasi (`lastSeenAt`/`lastActiveAt` null) — yashil nuqta va "oxirgi faollik" hech kimga ko'rinmaydi.
- ✅ Kontakt-gating qoidasi buzilmadi: yangi DTO'lar (`FollowRow`, `UserBrief`, mention) telefon/telegram/email bermaydi. Mutaxassis kontaktlari — faqat `filterSpecialistForViewer` orqali, buyurtma qabul qilingach.
- ⚠️ **Xabar shikoyati**: admin navbatida xabar matnining 160 belgilik parchasi ko'rinadi (shikoyat qiluvchi ongli ravishda yuboradi). Bu moderatsiya uchun zarur; `docs`da va shikoyat formasida aytib o'tilgan emas — 🔜 formaga "parcha adminga ko'rinadi" eslatmasi.
- ⚠️ Obunachilar ro'yxati va reaksiya/izoh mualliflari — ochiq profil kabi ommaviy (Instagram ochiq akkaunti modeli). Yopiq profil rejimi yo'q.

### 2.3 Kiritish tekshiruvi, XSS, SQL

- ✅ Barcha matnlar React matn tugunlari sifatida chiziladi (`dangerouslySetInnerHTML` yo'q). `RichText` faqat `https?://` havolalarni `<a rel="noopener noreferrer nofollow">` qiladi, `@username` → `/yozish/<encodeURIComponent>`; `javascript:` sxemasi o'tmaydi.
- ✅ Zod: reaksiya `enum`, `replyToId` ≤ 64, `typing` boolean, maxfiylik enum/boolean, `workHistory`/`education` (yil 1970…+1, `toYear ≥ fromYear`, limit 10/6, matn uzunliklari), shikoyat `targetType` enum.
- ✅ SQL — faqat drizzle parametrlari; xom `sql\`\`` joylari (`notBlockedCondition`, typing, LIKE naqshi) ham parametrlangan. LIKE: @qidiruvda `%`/`\` olib tashlanadi; reaksiya dedupe'da `ESCAPE '\'` bilan.
- ✅ `MENTION_RE` chiziqli, matn ≤ 2000 belgi, eslatma ≤ 10 ta.
- ✅ Fayllar: `purpose=voice` — faqat EBML (.weba), ftyp (.m4a), OggS (.ogg) sehrli baytlari; audio kengaytma bilan saqlanadi, `/uploads/[name]` route `nosniff` + `CSP sandbox` + `inline` beradi; 5 MB; alohida kvota (200/kun). Klient bergan MIME'ga ishonilmaydi (`mimeFromUrl`).

### 2.4 CSRF, sarlavhalar, brauzer ruxsatlari

- ✅ Mutatsiya route'lari `handler()` CSRF (same-origin) ostida; klient `fetch` same-origin → Origin avtomatik.
- ✅ CSP (`middleware.ts`): nonce + `strict-dynamic`, `media-src 'self' + Blob/R2` (ovozli xabar shu yerdan o'ynaydi), `frame-ancestors 'none'`; `/api/*` uchun `default-src 'none'`.
- ✅ **Permissions-Policy** o'zgardi: `microphone=()` → `microphone=(self)` (ovozli xabar uchun zarur; faqat o'z sahifalarimiz, iframe'ga emas). `camera=()` o'zgarmadi.
- ✅ Audio `new Audio(url)` — URL server tomonidan `UPLOAD_URL_RE` bilan tekshirilgan manbalardan.

### 2.5 Tezlik chegaralari (userId bo'yicha)

| Amal | Kalit | Chegara |
| --- | --- | --- |
| Reaksiya, saqlash, obuna, ro'yxatlar | `social` | 120 / soat |
| Izoh | `comments` | 60 / soat |
| Post | `posts` | 30 / soat |
| Xabar (DM/guruh) | `messages` | 60 / 10 daqiqa |
| Yozmoqda signali | `typing` | 900 / soat (klient 2.5 s throttle) |
| Ovozli xabar yuklash | `voice` | 200 / kun |
| @eslatma qidiruvi | `mention` | 600 / soat (klient kesh + 180 ms debounce) |
| Bloklash / maxfiylik | `blocks` | 60 / soat |
| Shikoyat | `reports` | mavjud |

- ⚠️ Reaksiya bildirishnomasi: bir odamdan bir postga **24 soatda bir marta** (yoqib-o'chirib spam qilib bo'lmaydi); almashtirish xabar bermaydi.
- ⚠️ `profile_post` fan-out: 25 talik bo'laklar, email yo'q; eslatilganlar umumiy xabarni qayta olmaydi.

### 2.6 Ma'lumotlar bazasi va migratsiya

- ✅ Barcha o'zgarishlar **qo'shimcha** (ALTER TABLE ADD / CREATE TABLE): `post_likes.reaction`, `post_saves`, `dm_messages.reply_to_id`, `group_messages.reply_to_id`, `conversations.a/b_typing_at`, `group_members.typing_at`, `user_blocks`, `users.dm_policy/comment_policy/show_online`, `specialists.work_history/education`, `reports.target_type` enum kengaytmasi (SQLite'da tekshiruvsiz matn).
- ⚠️ **Hodisa (lokal)**: ish tarixi dastlab `experience` nomi bilan qo'shilgan edi — bu ustun allaqachon mavjud (daraja: junior…expert). drizzle jadvalni qayta qurishga urindi; lokal bazada yarim qolgan `__new_specialists` tozalandi, ustun `work_history` deb qayta nomlandi. **Prod'ga deploy qilishdan oldin**: `npx tsx scripts/db-sync.ts` chiqishida faqat `ALTER TABLE … ADD` / `CREATE TABLE` / `CREATE INDEX` bo'lishi kerak; `DROP TABLE`/`__new_` ko'rinsa — to'xtating (skript masofaviy bazada buni o'zi bloklaydi).
- ✅ Pul harakatiga tegilmadi (eskrou/payout kodlari o'zgarmagan).

## 3. Qo'lda tekshirish (dasturchi uchun checklist)

Dev server: `npm run dev`; `restart-dev` kabi skriptdan keyin cookie jar'lar: `/tmp/sp.jar` (ijodkor), `/tmp/cl.jar` (mijoz), `/tmp/ad.jar` (admin). `O="Origin: http://localhost:3000"`.

```bash
# IDOR: boshqa suhbat xabariga iqtibos -> 422
curl -s -b /tmp/sp.jar -H "$O" -H 'Content-Type: application/json' -X POST localhost:3000/api/chat/<CONV>/chat -d '{"body":"x","replyToId":"<BOSHQA_SUHBAT_MSG_ID>"}'
# Blok: cl sp'ni bloklaydi -> DM 403, obuna 403, izoh 403, lentada yo'q
curl -s -b /tmp/cl.jar -H "$O" -X POST localhost:3000/api/blocks/<SP_USER_ID>
curl -s -b /tmp/sp.jar -H "$O" -H 'Content-Type: application/json' -X POST localhost:3000/api/chat/<CONV> -d '{"body":"salom"}'   # 403
# Maxfiylik: dmPolicy=none -> yangi suhbat 403 (mavjud, xabarli suhbat davom etadi)
curl -s -b /tmp/sp.jar -H "$O" -H 'Content-Type: application/json' -X PUT localhost:3000/api/account/privacy -d '{"dmPolicy":"none","commentPolicy":"all","showOnline":true}'
# Ovozli xabar: faqat audio sehrli baytlar; PNG -> 415
curl -s -b /tmp/cl.jar -H "$O" -F file=@fake.png -F purpose=voice localhost:3000/api/upload
# Shikoyat: o'z postiga 400, takror 409, ishtirokchi bo'lmagan DM xabari 404
# Mehmon: /api/follow/<id>?list=followers -> 401; /api/users/mention?q=a -> 401; /api/posts/saved -> 401
```

Avtomatik skriptlar (sessiya scratchpad'ida bor edi): `b2-api-test.sh` (reaksiya/saqlash/eslatma), `b3-api-test.sh` (ovoz/iqtibos/typing), `b4-api-test.sh` (maxfiylik/blok/shikoyat), `b5-api-test.sh` (profil bo'limlari/obunalar), Playwright `shots-v7…v10.mjs` (UI, fake mikrofon bilan haqiqiy ovoz yozish e2e).

## 4. Qolgan tavsiyalar (keyingi bosqich)

1. 🔜 **Real-time**: polling (4–5 s) o'rniga SSE/WebSocket (typing va yangi xabar uchun) — `docs/IJTIMOIY-TARMOQ.md` 2-bosqich.
2. 🔜 **Shikoyat formasida** "xabar parchasi adminga ko'rinadi" eslatmasi; shikoyat sabablari tahlili (dashboard).
3. 🔜 **Kontent moderatsiyasi**: taqiqlangan so'zlar/havolalar filtri (post, izoh, chat), avtomatik yashirish 3+ shikoyatda.
4. 🔜 **Ovozli xabar**: Blob'ga to'g'ridan-to'g'ri yuklash (hozir server orqali 5 MB ≈ 3 daqiqa Opus); transkripsiya (ixtiyoriy).
5. 🔜 **Yopiq profil** rejimi (obunachilarni tasdiqlash) — hozir faqat ochiq model.
6. 🔜 **Audit jurnali**: `report_created`, `user_block/unblock`, `privacy_update` yoziladi; reaksiya/saqlash yozilmaydi (hajm) — kerak bo'lsa yoqing.
7. 🔜 **Zaxira nusxa**: Turso point-in-time restore yoqilganini tekshiring (migratsiyalardan oldin).
8. 🔜 **Pentest**: ushbu hujjat 3-bo'limdagi ssenariylarni staging'da takrorlash; CSP hisobotlarini (`report-to`) yig'ish.

---

# 2-audit: 30 ta muhim kamchilik (2026-10-25)

Birinchi audit (2026-10-18) ijtimoiy tarmoq blokini qamragan edi. Undan keyin qo'shilganlar
(jonli efir + Zoom qo'shimchalari, Web Push, Telegram bilan kirish va bot to'lovlari, DM papka/TTL,
guruh mavzulari, mentorlik pul oqimi) tekshirilmagan edi. Quyida shular bo'yicha topilganlar va
HAR BIRINING joriy holati.

Belgilar: 🔴 yuqori · 🟠 o'rta · 🟡 past/qattiqlashtirish.
Holat: **✔ tuzatildi** (kod o'zgardi) · **✓ allaqachon to'g'ri** (tekshirildi, muammo yo'q edi) ·
**◔ qattiqlashtirildi** (xavf kamaytirildi, qoldig'i yozilgan) · **⚙ operatsion** (kodda emas — Vercel/Turso/jarayonda qilinadi) ·
**⏳ ongli ravishda keyinga** (sababi yozilgan).

> Yakuniy hisob: 16 ta kodda tuzatildi · 4 tasi tekshirilib «muammo yo'q» chiqdi · 3 tasi qattiqlashtirildi ·
> 5 tasi operatsion (sizdan talab qiladi) · 2 tasi ongli ravishda keyinga qoldirildi.

## A. Kod zaifliklari

1. 🔴 **Saqlangan XSS — vakansiya JSON-LD** (`app/vakansiyalar/[id]/page.tsx`). `JSON.stringify(jobPosting)`
   `<script type="application/ld+json">` ichiga `<` ekranlanmasdan qo'yilardi; `title`/`description`/
   `requirements`/`company` — foydalanuvchi matni. Tavsifga `</script><script>…` yozib skriptdan chiqib
   ketish mumkin edi. (CSP nonce + `strict-dynamic` zarbani yumshatadi, lekin bu himoya qatlami, yechim emas.)
   Boshqa barcha JSON-LD joylari allaqachon `.replace(/</g, "<")` qiladi.
   **✔ tuzatildi** (`9c88c77`) + `scripts/security.mjs` da regressiya testi.
2. 🟠 **Web Push endpoint — ko'r SSRF** (`lib/push/service.ts`). `ENDPOINT_RE` istalgan `https://host/...` ni
   qabul qilardi: kirgan foydalanuvchi o'z hisobiga ixtiyoriy manzil yozib, server har bildirishnomada
   o'sha manzilga POST qilishiga erishardi (ichki xizmatlarni skanerlash, tashqi xostni «urish»).
   **✔ tuzatildi**: `ALLOWED_HOSTS` oq ro'yxati (`*.googleapis.com`, `*.push.apple.com`,
   `*.notify.windows.com`, `updates.push.services.mozilla.com`) + begona xostga 422; testi bor.
3. 🟠 **Efir kodi (passcode) brute-force** (`api/live/[id]/token`). Rate limit yo'q, kod 4 belgidan
   boshlanardi, taqqoslash oddiy `!==`.
   **✔ tuzatildi**: `enforceLimit("liveGate")` (20 / 15 daqiqa), `secretEquals()` —
   `timingSafeEqual` bilan, minimal uzunlik 4 → **6**; testi bor.
4. 🟠 **Promokod brute-force** (`api/mentorlik/tolov/narx`). Limit yo'q edi — kodni lug'at bo'yicha terib,
   boshqa mentorlarning chegirma kodlarini topish mumkin edi.
   **✔ tuzatildi**: `promo` limiti (30 / soat), `/api/mentorlik/promo` POST/PATCH ham shu limitda.
5. 🟠 **Telegram login CSRF** (`lib/auth/telegram-login.ts`). 6 xonali kodni taxmin qilgan odam botga
   `/start l_<kod>` yuborib O'Z chatId'si bilan tasdiqlasa — qurbonning brauzeri HUJUMCHI hisobiga
   kirib qolardi (keyin qurbon o'z ma'lumotini begona hisobga kiritadi).
   **✔ tuzatildi, ikki qatlam**: (a) botda `/start l_` urinishlari chatId bo'yicha 10 / soat (`tgStart`);
   (b) sessiya endi **darhol ochilmaydi** — `PUT /api/auth/telegram` avval `status: "confirm"` va
   Telegram hisobining nomi/@username'ini qaytaradi, foydalanuvchi «Bu menman — kirish» bosgandan keyin
   (`?tasdiq=1`) sessiya ochiladi. Begona hisob bo'lsa foydalanuvchi ko'radi va bekor qiladi.
6. 🟠 **Telegram bot hisob spami** (`lib/mentorship/telegram-pay.ts` `handlePayCallback`). `bp:` tugmasiga
   limit yo'q edi — bitta chat cheksiz `subscription_invoices` qatori yaratishi mumkin edi.
   **✔ tuzatildi**: webhook'da `botLimited(chatId)` — `tgBot` 120 / soat (tugmalar) va
   xarid boshlashda `purchase` 30 / soat. Limitdan oshsa webhook baribir 200 qaytaradi
   (Telegram qayta yubormasin), lekin amal bajarilmaydi.
7. 🟡 **Efir subtitri va davomati ishonchsiz** (`api/live/[id]/{subtitr,davomat}`).
   **Qisman tuzatildi + qisman ✓ allaqachon to'g'ri**: limit YO'Q edi — qo'shildi (`liveWrite` 600 / soat).
   Lekin «har qanday ishtirokchi subtitr yozadi» degan topilmam **noto'g'ri edi**: `subtitr` route'i
   allaqachon `liveAccess()` dan `moderator || staged` ni tekshirib, boshqalarni jim qaytarardi.
   Davomat signali esa atayin har ishtirokchidan keladi (davomat shu bilan hisoblanadi) — endi limitlangan.
8. 🟡 **Efir passcode'i ochiq matnda** (`live_streams.passcode`). Baza sizib chiqsa barcha yopiq efirlar ochilardi.
   **✔ tuzatildi**: `lib/security/secret-box.ts` — AES-256-GCM + HKDF bilan maqsadga xos kalit
   (`sealSecret/openSecret`). Xesh emas, chunki boshlovchi kodni O'ZI ham ko'rishi kerak.
   Eski (shifrlanmagan) qatorlar `livePasscode()` da shaffof o'qiladi — migratsiya shart emas.

## B. Tezlik chegaralari (DoS, abuz)

9. 🔴 **100 ta mutatsiya route'ida limit yo'q** (254 tadan).
   **✔ tuzatildi, ildizdan**: `handler()` ning o'zida standart limit — kirgan foydalanuvchiga
   `BASE_MUTATION_LIMIT` 300 / soat (kalit `userId`), mehmonga `GUEST_MUTATION_LIMIT` 2000 / soat
   (kalit IP — O'zbekistonda mobil operator NAT'i ortida minglab odam bitta IP'da ko'rinadi,
   qattiq limit butun operatorni qulflab qo'yardi; mehmon tega oladigan route'lar —
   kirish/ro'yxat/parol tiklash/til/Telegram — o'zining qattiq limitlariga ega).
   GET/HEAD/OPTIONS tegilmaydi. Shu bitta o'zgarish
   `handler()` ishlatadigan **196 ta** mutatsiya route'ini qamradi; qolgan bittasi —
   Telegram webhook'i (`handler()` ishlatmaydi) — o'z chatId limitlariga ega.
   Kerak bo'lsa route `handler(fn, { limit: false })` bilan chetga chiqadi.
   Ustiga maxsus limitlar qo'shildi: `liveGate/liveToken/liveWrite/liveRecord/promo/mentor/purchase/
   tgBot/tgStart/call/stories/locale/postStats` (13 ta yangi).
10. 🟠 **LiveKit token cheksiz** (`api/live/[id]/token`, `api/qongiroq/token`). Har so'rovda yangi token —
    LiveKit daqiqalarini «yoqib» yuborish mumkin edi (to'g'ridan-to'g'ri pul).
    **✔ tuzatildi**: `liveToken` 60 / soat va `call` 120 / soat.
11. 🟠 **Egress (efir yozuvi) limiti yo'q** (`api/live/[id]/yozuv`). **✔ tuzatildi**: `liveRecord` 20 / soat.
12. 🟠 **Web Push fan-out o'lchanmagan.** **✓ allaqachon to'g'ri** — topilmam noto'g'ri edi:
    `api/admin/broadcast` allaqachon auditoriyani **20 talik guruhlarga** bo'lib ketma-ket yuboradi
    (`for (i += 20)`), bir hisobda esa ≤10 qurilma. Minglab foydalanuvchida navbat (queue) kerak
    bo'ladi — kod izohida shu yozilgan, hozirgi masshtabda muammo yo'q.
13. 🟡 **`/api/til` limitsiz.** **✔ tuzatildi**: `locale` 120 / soat, IP bo'yicha.
    (Bu route `handler()` ishlatmaydi — javob cookie/redirect — shuning uchun limit qo'lda.)

## C. Avtorizatsiya va ma'lumot sizishi

14. 🟠 **Efir kichik xonalari (breakout).** **✔ limit qo'shildi** (`liveWrite`) — `xonalar` va
    `hammuallif` route'lari. Egalik tekshiruvi `createBreakouts/assignBreakout/toggleCohost` ichida
    `canModerate` bilan qilinadi (hammuallifni faqat boshlovchi tayinlaydi). **Qolgan ish ⏳**:
    breakout a'zoligi uchun avtomatik test yozilmagan — LiveKit kerak, lokal `--dev` serverida
    egress/ko'p xonali ssenariy sinalmaydi. Staging'da qo'lda sinaladi.
15. 🟠 **Mentor daromadi** (`api/mentorlik/daromad`). **✔ limit qo'shildi** (`purchase` 30 / soat).
    Pul oqimi esa **✓ allaqachon to'g'ri** — tekshirildi: `requestPayout()` `db.transaction` ichida
    `status = "available"` shartli UPDATE bilan qatorlarni atomar «band qiladi» (CAS), summa minimumdan
    past bo'lsa tranzaksiya qaytadi; `resolvePayout()` ham `status = "requested"` CAS bilan ishlaydi,
    ikkinchi urinish 409 oladi. `mentorId` klientdan kelmaydi.
16. 🟡 **Post statistikasi** (`api/posts/[id]/statistika`). **✔ tuzatildi**: `postStats` 120 / soat.
    Avtorizatsiya (muallif · jamoa boshqaruvchisi · admin) allaqachon joyida edi.
17. 🟡 **Shikoyatdagi xabar parchasi** (1-auditdan qolgan). **✔ tuzatildi**: `ReportButton` da
    `targetType === "message"` bo'lsa formada «xabar matnining bir qismi adminga ko'rinadi»
    eslatmasi chiqadi (uz/ru).
18. 🟡 **Obunachilar/reaksiya ro'yxatlari ommaviy.** **⏳ ongli ravishda keyinga**: Instagram modeli —
    ochiq profil mahsulotning o'zagi. «Yopiq profil» rejimi alohida mahsulot qarori (obunachini
    tasdiqlash, lenta/qidiruv/sitemap'dan chiqarish, DM qoidalari) — xavfsizlik bandi emas,
    funksiya. Qaror sizda.

## D. Infratuzilma va sozlash

19. 🟠 **Lokal `.env` da soxta Telegram kalitlari** (`TELEGRAM_API_BASE=http://127.0.0.1:8099`).
    **✓ sizmagan**: `git check-ignore .env` o'tadi, repoda birorta `.env` fayli kuzatilmaydi.
    **⚙ operatsion**: prod'da `TELEGRAM_API_BASE` **umuman bo'lmasligi** kerak — Vercel env'da
    yo'qligini deploy'dan keyin tekshiring (bo'lsa bot jim ishlamay qoladi).
20. 🟠 **HSTS `preload` yo'q** (`next.config.ts`). **✔ tuzatildi**:
    `max-age=63072000; includeSubDomains; preload`. **⚙ qolgan qadam**: o'z domeningiz
    (`kasbegalari.uz`) ulangach hstspreload.org ga yuboring — `vercel.app` subdomenini yuborib bo'lmaydi.
21. 🟠 **Web Push VAPID kalitlari yo'q** — push jim o'chiq. **⚙ operatsion**: `node scripts/gen-vapid.mjs`
    bilan yarating va Vercel'ga `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
    qo'ying. Kalit yo'q bo'lsa panel ko'rinmaydi, xato bermaydi.
22. 🟠 **`CRON_SECRET` tekshirilmagan.** Kod productionda uni MAJBURIY qiladi (yo'q bo'lsa cron o'chadi).
    **⚙ operatsion**: Vercel'da o'rnatilganini tasdiqlang — aks holda kunlik vazifalar
    (jamlama, TOP e'loni, tozalash, eslatmalar) ishlamaydi.
23. 🟠 **Sxema sinxronizatsiyasi prod'da qo'lda.** **✓ aniqlashtirildi — qo'lda EMAS**: topilmam
    noto'g'ri edi. `npm run vercel-build` = `node scripts/db-prepare.mjs && next build`, va
    `db-prepare` ning o'zi Turso'ga qarshi `npx tsx scripts/db-sync.ts` ni ishga tushiradi,
    keyin `users` jadvali borligini tekshiradi (yo'q bo'lsa deploy to'xtaydi). Ya'ni yangi
    jadvallar (`live_*`, `push_subscriptions`, `dm_folders`, `group_topics`, `login_requests`,
    `story_*`, `mentor_*`…) HAR deployda avtomatik qo'llanadi. **⚙ sizdan**: deploy log'ida
    `→ N ta sxema o'zgarishi qo'llanmoqda` va `✓ Sxema joyida` satrlarini ko'rib qo'ying.
    DIQQAT (2026-10-25 da topildi va tuzatildi): shu zanjirning seed qadami BO'SH bazada
    yiqilardi (`seed.ts` kasb xaritalari 8 ta slug'da qolgan, `CATEGORIES` esa 94 ta) —
    ya'ni YANGI/bo'sh Turso bazasiga deploy build paytida to'xtar edi. Mavjud prod bazasi
    to'la bo'lgani uchun `--if-empty` seedni o'tkazib yuborardi va muammo sezilmagan.
    Endi `SEED_CATEGORIES` bilan tuzatildi va CI shu yo'lni har push'da tekshiradi.
24. 🟡 **Blob/R2 ochiq o'qish.** **◔ holat aniqlandi, xavf kutilganidan past**: fayl nomi
    `crypto.randomUUID()` (122 bit) — ro'yxatini olish yoki taxmin qilish mumkin emas, ya'ni
    «hamma chatni skanerlash» yo'q. Qolgan xavf: URL bir marta tarqalsa (skrinshot, forward,
    brauzer tarixi) muddatsiz ochiq qoladi. **⏳ keyinga**: to'liq yechim — `/api/fayl/[id]` proksi
    route'i + imzolangan qisqa muddatli URL; bu chat/portfolio/story'dagi barcha media yo'llarini
    o'zgartiradi, shuning uchun alohida blok sifatida rejalashtirilgan (Blob store Public rejimda
    yaratilgan — rejimi keyin o'zgarmaydi, ya'ni store ham qayta yaratilishi kerak).
25. 🟡 **Audit jurnali aylanmasi yo'q.** **✓ allaqachon bor** — topilmam noto'g'ri edi:
    `/api/cron/daily` da `AUDIT_RETENTION_DAYS` (180 kun) bo'yicha tozalash ishlaydi va
    muhim yozuvlarni (`upload`, `pay%`, `admin_%`) saqlab qoladi. `auditDeleted` soni javobda qaytadi.

## E. Jarayon va monitoring

26. 🔴 **Avtomatik xavfsizlik testi yo'q.** **✔ tuzatildi**: `scripts/security.mjs` — `node --test` uchun
    **21 ta** avtorizatsiya/regressiya testi: mehmon 401 (6 route), admin-only 403 (3), CSRF (Origin yo'q /
    begona Origin), IDOR (4 probe), XSS regressiyasi (JSON-LD'da ekranlanmagan `<` yo'qligi),
    SSRF regressiyasi (begona push xosti rad etiladi), 4 belgili efir kodi rad etiladi,
    xavfsizlik sarlavhalari, API `no-store`. CI'da majburiy qadam; `CLAUDE.md` ga yozilgan.
    Qoida: yangi API qo'shilsa shu yerga «begona foydalanuvchi 403 oladi» testi qo'shiladi.
27. 🟠 **Paket zaifliklari tekshirilmaydi.** **✔ tuzatildi**: CI'da `npm audit --omit=dev` —
    `--audit-level=critical` bloklaydi, `--audit-level=high` ogohlantiradi (`continue-on-error`).
    Shu qadam darhol **critical** topdi va tuzatildi: Next.js 15.3 → **15.5.28**
    (rasm optimizatsiyasidagi zaiflik; bizda `dangerouslyAllowSVG` yoqilmagani uchun yo'l
    yopiq edi, baribir yangilandi). Qolgan 6 ta `high` — pastdagi jadval.
28. 🟠 **Xatolik monitoringi yo'q** (Sentry va h.k.). **⚙ operatsion / ⏳**: kodga Sentry qo'shish
    oson, lekin loyihaga yangi tashqi xizmat, DSN va CSP'ga `*.sentry.io` kiritadi — buni sizning
    qaroringizsiz qo'shmadim. Hozircha: `/api/admin/health` va `/api/health` bor, kunlik cron
    xatolarni audit meta'ga yozadi. Tavsiya: Sentry bepul reja + Vercel integratsiyasi.
29. 🟡 **Rate-limit jadvali tozalanmaydi.** **✓ allaqachon bor** — topilmam noto'g'ri edi:
    `/api/cron/daily` da `delete(rateLimits).where(lt(resetAt, now))` ishlaydi
    (`rateLimitsDeleted` javobda), ustiga `rateLimit()` ning o'zi ~2% chaqiriqda `sweep()` qiladi.
30. 🟡 **Zaxira nusxa sinalmagan.** **⚙ operatsion**: Turso point-in-time restore yoqilganini
    tekshirib, `docs/DEPLOY.md` 6-bo'limi bo'yicha tiklashni **bir marta amalda** sinab ko'ring
    (staging bazaga). Buni kod bilan qilib bo'lmaydi.

## Paket zaifliklari — qolgan 6 ta `high` (2026-10-25)

`npm audit --omit=dev`: critical 0 · high 6 · moderate 1. CI critical'da yiqiladi, high'da ogohlantiradi.
Hech biri hozirgi kodda ishlatiladigan yo'lda emas; har biri uchun sabab va reja:

| Paket | Zaiflik | Nega hozir xavf emas | Reja |
|---|---|---|---|
| `drizzle-orm` <0.45.2 | SQL injection — identifikator (jadval/ustun nomi) ekranlanmasligi | Jadval/ustun nomlari faqat sxemadan keladi, foydalanuvchi matnidan HECH QAYERDA yasalmaydi; qiymatlar doim parametr | 0.45.x ga yangilash — breaking: relational query API o'zgargan, alohida blok |
| `zod` <4.6.6 | Katta kolleksiyani tekshirishda xotira tugashi | Barcha `z.array()` larimizda `.max()` bor, `handler()` body hajmini cheklaydi | zod v4 migratsiyasi (`.default()`/`.optional()` semantikasi o'zgargan) — alohida blok |
| `postcss` <=8.5.22 | CSS stringify'da XSS; attacker kiritgan CSS'ni o'qish | Faqat **build vaqtida** ishlaydi, foydalanuvchi CSS yozmaydi | Next 16 bilan keladi (Next 15 pin qilib turadi) |
| `@vercel/blob` | `@vercel/oidc` orqali tranzitiv | OIDC oqimi ishlatilmaydi (token env'dan) | `@vercel/blob` yangilanishini kuzatish |
| `@vercel/oidc`, `@vercel/cli-config` | `zod` orqali tranzitiv | Runtime'da chaqirilmaydi | `zod` v4 bilan birga yopiladi |

## Tavsiya etilgan tartib (yangilangan)

**Kodda qiladigan ish qolmadi** — 1–17, 20, 26, 27 yopildi; 12, 25, 29 tekshirilib «allaqachon to'g'ri» chiqdi.

**Sizdan talab qiladi (⚙), muhimlik tartibida:**
1. `CRON_SECRET` Vercel'da bor-yo'qligi (22) — bo'lmasa kunlik vazifalar ishlamaydi.
2. Deploy log'ida `✓ Sxema joyida` (23) — sxema avtomatik qo'llanadi, faqat ko'rib qo'yiladi.
3. `TELEGRAM_API_BASE` prod'da YO'Q (19).
4. VAPID kalitlari (21) — push kerak bo'lsa.
5. Zaxira nusxani bir marta tiklab sinash (30).
6. O'z domeni + HSTS preload (20), Sentry (28).

**Keyingi blok uchun (⏳):** 24 (imzolangan fayl URL'lari), 14 (breakout e2e testi staging'da),
18 (yopiq profil — mahsulot qarori), paket migratsiyalari (drizzle 0.45, zod v4).

---

# 3-audit: Telegram, sessiya va monitoring (2026-10-31)

Mini App (Telegram Web iframe), bot orqali kirish va kunlik bot oqimlari qo'shilgach qayta ko'rib chiqildi.
Hammasi kodda yopildi, `scripts/security.mjs` 46 ta test (oldin 21), bot oqimlari — `scripts/bot.mjs` (CI'da soxta Bot API bilan).

| # | Kamchilik | Xavf | Yechim |
|---|---|---|---|
| 1 | Telegram Web (web.telegram.org) Mini App'ni **uchinchi tomon iframe'ida** ochadi — `SameSite=Lax` sessiya cookie saqlanmaydi, foydalanuvchi mehmon bo'lib qoladi; «tuzatish» uchun `SameSite=None` ni hammaga yoqish CSRF yuzasini kengaytirardi | 🟠 | `createSession(..., {embedded})` → faqat iframe kirishida `SameSite=None; Secure; Partitioned` (CHIPS — cookie faqat telegram.org bo'lagida yashaydi, boshqa saytlar ichida yuborilmaydi). JWT'da `emb` belgisi (qayta chiqarishda saqlanadi), `clearSession` bo'lakli cookie'ni o'sha atributlar bilan o'chiradi. Oddiy kirish `Lax` bo'lib qoladi. Test: sessiya cookie atributlari |
| 2 | `TELEGRAM_API_BASE` env'i noto'g'ri qo'yilsa **bot tokeni** (URL ichida) begona serverga ketardi | 🔴 | `telegramApiBase()` — faqat `https://api.telegram.org` yoki loopback (CI/lokal soxta server), login/parolli URL rad etiladi, xato bir marta logga yoziladi |
| 3 | «Telegram bilan kirish» — firibgar o'z kodini qurbonga yuborib, uning botida «Tasdiqlash»ni bostirishi mumkin (phishing) | 🟠 | Tasdiq xabarida **qurilma (brauzer · OS) + vaqt** (`login_requests.device_label`) va «kodni kimdir yuborgan bo'lsa — firibgarlik» ogohlantirishi (uz/ru); sessiya baribir ikki qadamda ochiladi (sayt «Bu menman» so'raydi) |
| 4 | Begona oyna `window.opener` orqali sahifani boshqarishi (tabnabbing), XS-Leaks | 🟡 | `Cross-Origin-Opener-Policy: same-origin-allow-popups` (Payme/Click/Google popup'lari ishlaydi), `X-Permitted-Cross-Domain-Policies: none`. Test: sarlavhalar |
| 5 | Hisobga begona qurilmadan kirilsa egasi bilmaydi | 🟠 | `recordSession` → `alertNewDevice` (`after()` bilan, javobni sekinlashtirmaydi): oldingi sessiyalarda bunday «brauzer · OS» bo'lmasa — sayt + Telegram + email bildirishnomasi, `/kabinet/xavfsizlik` havolasi. Birinchi kirish va shu brauzerdagi sessiya almashinuvida jim |
| 6 | Admin hisobida 2FA ixtiyoriy — parol sizsa butun platforma ochiladi | 🟠 | Admin panel tepasida 2FA yoqilmagan admin uchun ogohlantirish kartasi («2FA'ni yoqish»). Majburiy qilish — keyingi qadam (pastda) |
| 7 | CSP buzilishlari (XSS urinishi, noto'g'ri sozlangan manba) ko'rinmaydi | 🟡 | `report-uri /api/csp-report` → Vercel loglarida `[csp]` yozuvi (yo'nalish, bloklangan manba, sahifa — **so'rov/hash parametrlari kesiladi**, token logga tushmaydi). Qabul qiluvchi: tana ≤16 KB (413), buzuq JSON 400, bir so'rovda ≤5 hisobot, IP bo'yicha xotiradagi limit (bazaga yozmaydi), brauzer kengaytmasi shovqini tashlanadi. `report-to` ATAYLAB qo'shilmagan: u bo'lsa Chrome `report-uri`ni e'tiborsiz qoldirib Reporting API'ga o'tadi (to'plab, kechiktirib yuboradi; background-sync bloklangan brauzerda umuman yubormaydi — sinovda tasdiqlandi). Test: 204/400/413/405 |
| 8 | Telegram ko'prigi `message` hodisalarini istalgan oynadan qabul qilsa, begona sahifa soxta `back_button_pressed`/`theme_changed` yuborishi mumkin | 🟡 | `TgAppBridge` — faqat ota-oyna (`event.source === window.parent`) va `*.telegram.org` manbasidan; tashqi havolalar `web_app_open_link`, t.me — `web_app_open_tg_link` orqali |
| 9 | Guruh posti havola prevyusi (`/api/posts/preview`, mehmonga ham ochiq) `redirect: "follow"` bilan so'rov yuborardi va faqat host NOMINI tekshirardi: ommaviy sayt → 302 → `169.254.169.254`/ichki xizmat (javob o'qilmasa ham «ko'r» SSRF), `127.0.0.1.nip.io` kabi DNS nomi ham o'tardi | 🟠 | Yangi `lib/security/safe-fetch.ts` (`safeFetchText`): IP **ulanish paytida** tekshiriladi (Node `lookup` ilgagi — DNS rebinding ham ishlamaydi), raqamli IP oldindan, redirect qo'lda va har qadamda qayta tekshiriladi, faqat standart port, login/parolli URL rad, CGNAT/link-local/IPv6 ULA/`::ffff:` ham bloklangan, gzip/br ochiladi va hajm chegarasi ochilgan javobga qo'llanadi. Post va chat prevyusi shunga o'tkazildi. Test: 5 ta ichki manzil (metadata, loopback, IPv6, o'nlik IP) |
| 10 | Mini App `/api/tg/auth` qaytaradigan `next` yo'li tab/yangi qator belgisini o'tkazib yuborardi — URL parser ularni tashlaydi va `/\t/evil.com` → `//evil.com` (begona sayt) | 🟡 | Umumiy `safeInternalPath` (middleware va `/api/til` bilan bir xil): boshqaruv belgilari, `//`, `\\`, begona origin rad |
| 11 | Bot tugmalari (`callback_query`) xabar qaysi chatda bo'lsa o'sha chat egasi nomidan bajarilardi — tugmali xabar guruhga tushib qolsa (yoki boshqa yo'l bilan) uni istalgan a'zo bosishi mumkin edi | 🟡 | Faqat `chat.type === "private"` va bosgan odam = chat egasi (`from.id === chat.id`); aks holda hech qanday ishlov yo'q. Bot testi: guruh tugmasi va begona bosuvchi e'tiborsiz (tuzatishsiz yiqilishi tekshirildi) |
| 12 | Telegram ichki to'lovi: `successful_payment` kelganda summa/valyuta qayta solishtirilmasdi (faqat `pre_checkout` tekshirardi) | 🟡 | Himoya qatlami: `total_amount === amount×100` va `UZS` bo'lmasa kirish OCHILMAYDI, adminlarga «summa hisobga mos emas» bildirishnomasi, foydalanuvchiga ogohlantirish. Webhook bilan sinaldi (hisob `created` holatida qoldi) |
| 13 | Admin paroli o'g'irlansa, qo'lda o'tkazma kartasi almashtirilib barcha karta to'lovlari begona kartaga burilishi mumkin — o'zgarish faqat audit jurnaliga yozilardi (hech kim bilmasdi) | 🟠 | Karta yoki egasi o'zgarsa BARCHA adminlarga darhol bildirishnoma (sayt + Telegram + email): kim, eski → yangi (oxirgi 4 raqam), «bu siz bo'lmasangiz…». Audit meta'ga oxirgi 4 raqam. O'zgarishsiz saqlashda jim. `readManualCard` (keshsiz) — `getManualCard` so'rov ichida keshlanadi, aks holda javob eski kartani qaytarardi |
| 14 | Mutaxassis/mentor hisobi o'g'irlansa, pul yechish so'rovi begona kartaga yuboriladi — xabar faqat adminlarga borardi, hisob egasi bilmasdi | 🟠 | So'rov yaratilganda hisob EGASIGA ham bildirishnoma (sayt + Telegram + email): summa, niqoblangan karta, «bu siz bo'lmasangiz — parolni almashtiring, pul hali o'tkazilmagan». Mutaxassis payout'i va mentor yechish so'rovi uchun. «Yangi qurilmadan kirish» ogohlantirishi bilan birga — egasi admin to'lashidan oldin xabardor bo'ladi |
| 15 | Parol almashtirilganda yoki email havolasi bilan tiklanganda egaga xabar yo'q edi (email o'zgarishi va 2FA o'chirilishida bor edi) | 🟡 | «Parolingiz o'zgartirildi» / «Parol tiklandi» — sayt + Telegram + email, xavfsizlik sahifasiga havola. Vaqtinchalik hisob bilan sinaldi |
| 16 | Hisobga yangi Telegram ulanganda (yoki boshqasi almashtirilganda) egaga xabar yo'q edi — begona Telegram ulansa, barcha bildirishnomalar (to'lov, xabar, kirish tasdiqlari) jimgina unga oqardi | 🟡 | Chat haqiqatan o'zgarganda «Telegram hisobingizga ulandi» — sayt + email (+ yangi Telegram), oldingi uzilgani haqida; bot `/start <kod>` va Mini App `link` yo'llarida. Vaqtinchalik hisob bilan sinaldi, bot testlari 9/9 |
| 17 | Ma'lumot eksporti (`/api/account/export`): ichki admin izohi (`admin_note` — moderatsiya eslatmasi) va `googleId` foydalanuvchiga chiqib ketardi; eksport faqat sessiya bilan ishlaydi va egaga xabar bermasdi | 🟡 | `adminNote/adminNoteAt/googleId` eksportdan chiqarildi (maxfiy kalitlar avvaldan chiqarilgan). Eksport qilinganda egaga «Ma'lumotlaringiz yuklab olindi» (sayt + Telegram + email) — o'g'irlangan sessiya bilan yuklansa sezib qolinadi. Parol so'rash (re-auth) — keyingi qadam (UI o'zgaradi) |
| 18 | Admin 2FA ixtiyoriy edi (faqat ogohlantirish kartasi) — majburlash yo'li yo'q edi | 🟠 | `ADMIN_REQUIRE_2FA=1` env (`lib/security/admin-2fa.ts`, standart O'CHIQ — o'zingizni qulflamaslik uchun): 2FA'siz admin admin API'lari (`requireSession(["admin"])` → 403), 8 ta admin sahifasi (→ `/kabinet/xavfsizlik?admin2fa=1`, tushuntirish kartasi bilan) va Telegram admin boti (`adminByChat` → «faqat administrator»)dan foydalana olmaydi; oddiy kabinet va 2FA sozlash ochiq. Lokal sinov: bayroq bilan API 403, sahifa redirect (admin ma'lumoti HTML'ga tushmaydi), bot rad etadi; bayroqsiz hammasi odatdagidek |
| 19 | Kontakt sotuvi chetlab o'tilishi mumkinmi (sahifa HTML/RSC payload, `/api/specialists/[slug]`, vCard, OG rasm, JSON-LD)? | — | **Tekshirildi — sizish yo'q.** Kontaktli, sotiladigan mutaxassislar uchun mehmon va ochmagan mijoz so'rovlarida haqiqiy telefon/Telegram/Instagram/email qiymatlari qidirildi — hech qayerda yo'q (JSON-LD'da kontakt maydoni yo'q). CI regressiya testi qo'shildi (API DTO'da kontakt null) |

**Tekshirildi — muammo yo'q:** 34 ta admin API'ning hammasida `requireSession(["admin"])`; profil yangilashda imtiyozli maydon yo'q (zod noma'lum maydonlarni tashlaydi); parol tiklash (xeshlangan bir martalik token, sessiya versiyasi, 2FA chetlab o'tilmaydi); TOTP qayta ishlatishdan himoya; R2 presign imzosida hajm/tur; qo'ng'iroq/efir tokenlari faqat ishtirokchiga; SSE oqimi faqat o'z suhbatlari; CDN keshlanadigan javoblar shaxsiy emas; CORS ochiq emas; xom HTML/`eval` yo'q; dinamik RegExp'lar ekranlangan; loglarda token/URL yo'q; bloklangan foydalanuvchi Telegram/Mini App/Google orqali ham kira olmaydi; bot HTML xabarlarida foydalanuvchi matni ekranlangan; kontakt sotuvi («faqat portfolio», o'z profili, yashirin) to'g'ri cheklangan.

**Qolgan (keyingi blok):**
- `ADMIN_REQUIRE_2FA=1` ni prod'da yoqish (18-band) — avval barcha adminlar 2FA'ni yoqsin.
- Ma'lumot eksportiga qayta parol so'rash (hozir — egaga xabar).
- Telegram orqali ochilgan hisoblar (parol tasodifiy, email `tg…@telegram.local`) hisobni o'chirish / email o'zgartirishni tasdiqlay olmaydi — bot orqali tasdiqlash oqimi kerak.
- 24-band: imzolangan (muddatli) fayl URL'lari — Blob public store'da hozircha ochiq havola.
- Paket migratsiyalari: drizzle 0.45, zod v4, Next 16 (postcss), @vercel/blob 2.x — har biri alohida blok, breaking o'zgarishlar bor.
- Sentry yoki boshqa xato monitoringi (28) — sizning qaroringiz bilan (CSP'ga yangi xost kiradi).
