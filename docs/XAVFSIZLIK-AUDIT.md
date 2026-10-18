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
