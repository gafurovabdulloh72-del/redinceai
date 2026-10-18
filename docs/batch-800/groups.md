# Jamoalar (guruhlar/kanallar) — batch-800 hisoboti (2026-10-18)
Qisqa hisob: A 25 · B 27 · C 26 · D 26

Sxema (faqat qo'shimcha ustunlar, `npx tsx scripts/db-sync.ts` bilan qo'llandi): `groups.invite_expires_at/invite_max_uses/invite_uses/rules/welcome_text/cover_position/prev_slug/pinned_message_id`, `group_members.muted_until/event_reminders/join_note`, `group_messages.deleted_at/edited_at`.

## A. Yangi funksiyalar
1. ✅ Chatda xabarni qadash (egasi/admin): `PATCH /api/groups/[slug]/chat/[id] {pinned}`, chat tepasida «Qadalgan» paneli (bosilsa xabarga o'tadi, qadoqdan olish tugmasi), xabar ostida 📌 — `src/lib/groups/service.ts` (`setPinnedMessage/pinnedMessage`), `src/app/api/groups/[slug]/chat/[id]/route.ts`, `src/components/groups/GroupChat.tsx`
2. ✅ Xabarni o'chirish (soft delete → «Xabar o'chirilgan» o'rinbosari; iqtiboslar ham yangilanadi; moderator har qanday xabarni) — `deleteGroupMessage`, `DELETE …/chat/[id]`, GroupChat
3. ✅ O'z xabarini tahrirlash (24 soat ichida, «tahrirlangan» belgisi, kompozitorda «Tahrirlash» paneli, Esc bekor) — `editGroupMessage`, `MESSAGE_EDIT_WINDOW_MS`, GroupChat
4. ✅ Chatda qidirish (`GET …/chat?q=`, 2+ belgi, 350 ms debounce, natija ro'yxati → xabarga o'tish) — `searchGroupMessages`, GroupChat
5. ✅ Xabar amallari menyusi «⋯» (javob, nusxalash, tahrirlash, qadash, o'chirish, shikoyat) — `role="menu"`, tashqi bosish/Esc yopadi — GroupChat
6. ✅ Qoidalar muharriri (markdown-lite: `- ` ro'yxat, `**qalin**`) — `groups.rules`, GroupForm maydoni, «Haqida» kartasida `RulesText` (bo'sh bo'lsa umumiy qoidalar) — `src/components/groups/RulesText.tsx`, `src/app/jamoalar/[slug]/page.tsx`
7. ✅ «Media» bo'limi — postlardagi rasm/videolar to'ri (3 ustun, bosilsa post ochiladi, bo'sh holat) — `listGroupMedia`, `?tab=media`
8. ✅ Tavsif «ko'proq / kamroq» (hero) — `src/components/groups/ExpandableText.tsx`
9. ✅ Statistika kartasi «So'nggi 7 kun»: postlar, xabarlar, faol a'zolar, yangi a'zolar — `groupStats`, AboutCard
10. ✅ Xush kelibsiz matni (`groups.welcome_text`): qo'shilganda (ochiq, taklif, tasdiq, approve_all) `group_joined` bildirishnoma + JoinButton toast'i — `sendWelcome`, join route `welcome` maydoni
11. ✅ «Hammasini qabul qilish» (`{action:"approve_all"}`) — `approveAllPending`, GroupMembers
12. ✅ Taklif havolasi muddati (24 soat / 7 kun / cheksiz) va limiti (10 / 50 / cheksiz), ishlatilgan soni, tugaganda ogohlantirish — `ensureInviteCode(opts)`, `inviteValid`, `src/app/api/groups/[slug]/invite/route.ts`, `InviteLink options`
13. ✅ A'zolar CSV eksporti (`?format=csv`, faqat egasi; ism, taxallus, rol, sana — kontaktlar YO'Q) — `membersCsv`, members route, GroupMembers «CSV»
14. ✅ Jim qilish muddati (1 soat / 8 soat / doim, `muted_until`), `notifyMembers` hurmat qiladi — `setMuted`, mute route, `MuteButton` menyusi
15. ✅ Yo'nalish chiplarida jamoalar soni (nol bo'lganlar yashirin) — `categoryCounts`, `src/app/jamoalar/page.tsx`
16. ✅ «O'xshash jamoalar» (yo'nalish/hudud bo'yicha, 3 ta) — `similarGroups`, AboutCard
17. ✅ A'zolar soni ixcham (1,2K) karta, hero, chat sarlavhasi, rasmiy bannerda — `compactCount`
18. ✅ Efir eslatmalari yoqish/o'chirish (a'zo sozlamasi, `live_event` fan-out faqat yoqilganlarga) — `setEventReminders`, MuteButton «Efir eslatmalari»
19. ✅ «Efirlar» bo'limi — yaqin va o'tgan efirlar (kalendar havolalari, «Yozuv»), tab faqat efir bo'lsa chiqadi — `listEvents`, `?tab=efirlar`
20. ✅ Muqova joylashuvi (slayder 0–100 %, `cover_position`) — karta va hero'da `object-position` — GroupForm, GroupCard, [slug]/page
21. ✅ Egasi manzilni (slug) o'zgartiradi; eski manzil `prev_slug`da qoladi va yangisiga yo'naltiriladi (`loadGroupByAnySlug`, `permanentRedirect`), band/zaxira manzillar 409/422 — `updateGroup`, GroupForm «Manzil»
22. ✅ Chiqish / so'rovni qaytarish oldidan inline tasdiq («Jamoadan chiqasizmi? Ha · Yo'q», expand-in) — JoinButton
23. ✅ Chiqarilganlar ro'yxati (`?status=banned`) va qaytarish (`unban`) — GroupMembers «Chiqarilganlar»
24. ✅ Chatda «↓ N yangi xabar» tugmasi (yuqorida o'qiyotganda yangi kelsa; pop-in/out) — GroupChat
25. ✅ A'zolar filtri: Hammasi / Onlayn / Adminlar (segment, sonlar bilan) + yopiq jamoaga so'rovda qisqa izoh (`join_note`, 200 belgi) — boshqaruvchi so'rovlar ro'yxatida «…» ko'radi — JoinButton, GroupMembers, `joinGroup`

## B. Tuzatilgan buglar
1. ✅ Chiqarilgan (banned) a'zo `DELETE /join` bilan ban yozuvini o'chirib qayta qo'shila olardi → 403 «Siz bu jamoadan chiqarilgansiz» — `leaveGroup`
2. ✅ Admin o'z ustida amal bajara olardi (o'zini chiqarish → ban) → 400 — `memberAction`
3. ✅ Polling: tab qaytganda darhol yangilanmas edi, tarmoq xatosida 4 s bilan urib turardi → `visibilitychange` + backoff 4→8→16→30 s — GroupChat
4. ✅ Chat ochilganda `scrollIntoView` butun sahifani sakratardi → konteyner `scrollTop` — GroupChat
5. ✅ Muallif o'z postidan keyin katalogda «yangi» nuqtasini ko'rardi → `createPost` → `markGroupRead` — service
6. ✅ 390px'da uzun ism a'zolar ro'yxatida kesilmas edi (inline span'da `truncate` ishlamaydi) → `block truncate` — GroupMembers
7. ✅ Chat ro'yxatida `role="log" aria-live="polite"` yo'q edi — GroupChat
8. ✅ Shakl maydonlarida `aria-invalid`/`aria-describedby`/`required` yo'q, xatolar `role="alert"`siz — GroupForm
9. ✅ Slug to'qnashuvi (unique indeks) 500 berardi → qayta urinish (3 marta) — `createGroup`
10. ✅ Chat sanalari `toLocaleDateString("uz-UZ")` (brauzerga bog'liq, ru'ni hurmat qilmas edi) → qo'lda uz/ru, «Bugun/Kecha» — GroupChat (`useLocale`)
11. ✅ Taklif havolasi bilan kelgan, so'rovi kutayotgan (pending) a'zo faollashmas edi → `joinGroup` pending'ni active qiladi — service
12. ✅ JoinButton xatosi inline span'da e'lon qilinmas edi → toast (xato/muvaffaqiyat) — JoinButton
13. ✅ `GET /api/groups` `sort` parametrini e'tiborsiz qoldirardi — `src/app/api/groups/route.ts`
14. ✅ Obuna bildirishnomasi har toggle'da (spam) → bir odamdan 24 soatda bir marta — `toggleFollow`
15. ✅ FollowersDialog: fon skroll qulflanmagan, fokus oynaga o'tmas edi → `body overflow`, yopish tugmasiga fokus — FollowersDialog
16. ✅ GroupForm «Bekor» create rejimida `router.back()` — to'g'ridan-to'g'ri kelganda saytdan chiqarib yuborardi → tarix bo'sh bo'lsa `/jamoalar` — GroupForm
17. ✅ CalendarLinks `.ics`: `;` qochirish `"\;"` (backslash yo'q) → `"\\;"` (RFC 5545) — CalendarLinks
18. ✅ Kanal chati sarlavhasi «Jamoa chati» deb turardi → «Muhokama»; bo'sh holat matni ham kanalga mos — GroupChat (`kind` prop)
19. ✅ `pendingCount` so'rovi har ko'ruvchi (mehmon ham) uchun bajarilardi → faqat boshqaruvchi — `toGroupView`
20. ✅ Katalogda 30 tadan ko'p jamoa ko'rinmas edi → «Yana ko'rsatish» (limit=60) — jamoalar/page
21. ✅ Katalog: Link'da `aria-pressed`, `role="tab"` panelsiz → `aria-current`; tur guruhi `<nav>` — jamoalar/page
22. ✅ GroupMembers amallar xatosi sahifa pastida, e'lonsiz → toast; chat xatosi `role="alert"` — GroupMembers, GroupChat
23. ✅ Matn tozalanganda `typing:false` yuborilmas edi (6 s «yozmoqda» qolardi) → darhol o'chiriladi — GroupChat
24. ✅ `listGroupMessages(afterId)` noma'lum id'da abadiy bo'sh qaytarardi → oxirgi 50 ta fallback — service
25. ✅ Hero muqova 4:1, karta va kesish 3:1 — bir xil emas edi → hamma joyda 3:1 — [slug]/page
26. ✅ `[slug]` sahifasi uchun yuklanish skeleti yo'q edi → `src/app/jamoalar/[slug]/loading.tsx`
27. ✅ «Tahrirlash»/«Javob berish» tanlanganda fokus kompozitorga o'tmas edi (klaviaturadan yozib bo'lmasdi) → `useEffect` fokus + kursor oxirida — GroupChat

## C. Dizayn va animatsiya tuzatishlari
1. ✅ Dastlabki yuklashda 200 xabar birdan `msg-in` o'ynardi → faqat polling orqali kelganlar animatsiyalanadi (`fresh` to'plami) — GroupChat
2. ✅ Bildirishnoma menyusi `.pop-in/.pop-out` + `usePresence`, Esc/tashqi bosish — MuteButton
3. ✅ JoinButton holat almashinuvi `animate-swap` (key=state) — JoinButton
4. ✅ A'zolar va so'rovlar ro'yxati `.stagger` — GroupMembers
5. ✅ Kompozitor ustidagi hairline faqat ro'yxat yuqoriga surilganda (`atBottom`), pastda — ko'rinmas — GroupChat
6. ✅ Radiuslar v3: GroupForm 16→14, kompozitor/menyular 14/10; JoinButton `Button md` (h-11) boshqa tugmalar bilan bir xil — GroupForm, JoinButton
7. ✅ Bo'lim tablari: faol chiziq `animate-fade-in`, 2px ink (coral emas), `transition-colors` — [slug]/page
8. ✅ Muqova nisbati 3:1 (karta = hero = kesish) + `object-position` — GroupCard, [slug]/page
9. ✅ Chat pufakchalari chegarasiz (`bg-surface-2`), fayl chiplari `bg-fg/6` — GroupChat
10. ✅ GroupCard hover: ko'tarilish/soya → hairline qorayadi (`hover:border-fg/40`), blur yo'q — GroupCard
11. ✅ Tasdiqlash/rad etish/matn tugmalari `.press` — GroupMembers
12. ✅ So'rovlar bo'limi `animate-fade-in`, ro'yxat filtr almashganda qayta stagger (`key`) — GroupMembers
13. ✅ `[slug]/loading.tsx` skelet (hero 3:1 + sarlavha + tugmalar + tablar + kartalar + yon panel)
14. ✅ Chat tugmalarida `focus-visible` konturi (qidiruv, ⋯, fayl) — GroupChat
15. ✅ Efir qatorlari `bg-surface-2`, aksent faqat jonli holatda; karta chegarasi coral emas — [slug]/page `EventRow`
16. ✅ Rasmiy banner: `ring-accent` olib tashlandi, oddiy `.card` — jamoalar/page
17. ✅ «↓ N yangi xabar» tugmasi pop-in/pop-out (`usePresence`) — GroupChat
18. ✅ Xabar amallari menyusi `.pop-in`, Esc/tashqi bosish (shikoyat oynasi ochiq bo'lsa tegilmaydi) — GroupChat
19. ✅ GroupForm tur kartalari: faol holat ink kontur + ink ikonka (coral emas) — GroupForm
20. ✅ Chat kun ajratgichlari: kichik kulrang pill («Bugun», «Kecha», «18 oktabr») — GroupChat
21. ✅ Hero sarlavhasi faqat `display-xl` (ortiqcha `text-[28px] sm:text-[36px]` olib tashlandi), ✓ belgisi nom yonida — [slug]/page
22. ✅ LockedNotice, Media/Efirlar bo'sh holatlari `data-reveal="scale"` — [slug]/page
23. ✅ A'zolar qidiruv/filtr qatori `expand-in` — GroupMembers
24. ✅ InviteJoin banner `expand-in`, coral fon olib tashlandi — InviteJoin
25. ✅ Karta chiplari `backdrop-blur`siz, a'zolik yorlig'i `bg-surface/90` (coral emas) — GroupCard
26. ✅ Qadalgan xabar paneli `expand-in/expand-out` (`usePresence`), tahrir paneli `expand-in` — GroupChat

## D. Minimalizm
1. ✅ GroupCard: muqova ustidagi 3–4 chip → bitta (Kanal yoki Yopiq); yo'nalish·hudud meta qatorida; post soni olib tashlandi
2. ✅ Hero: chiplar qatori yo'q → bitta meta qatori (tur · yo'nalish · hudud · a'zolar · egasi)
3. ✅ Tablardagi dublikat sonlar olib tashlandi (a'zolar soni hero'da)
4. ✅ Rasmiy banner tinchroq: coral «Rasmiy kanal» chipi → ✓ nom yonida, «Siz a'zosiz» chipi yo'q, tugma «Ochish»
5. ✅ Katalog sarlavha tavsifi va meta description qisqartirildi
6. ✅ Join/Follow bir uslub (`Button outline` faol holatda); JoinButton «owner» tarmog'i (dublikat «Sozlash») olib tashlandi; rasmiy a'zolik belgisi kulrang
7. ✅ Chat ichida kam chegara: pufakcha, fayl chipi, fayl tugmasi chegarasiz; kompozitor hairline shartli
8. ✅ Chat sarlavhasi «Jamoa chati · N a'zo | Faqat a'zolar ko'radi» → «Chat · N»
9. ✅ Hero amallar qatori: InviteLink faqat Sozlash sahifasida, TelegramShare olib tashlandi (ShareButton bor) → 4 ta element
10. ✅ AboutCard: «Egasi» alohida karta → bitta qator; «Turi/Yo'nalish/Hudud» qatorlari (meta bilan dublikat) olib tashlandi
11. ✅ Katalog filtr qatori: ajratgich chiziq yo'q, «Barcha yo'nalishlar» faqat yo'nalish tanlanganda, bo'sh yo'nalish chiplari yashirin
12. ✅ Bo'lim sarlavhasi: coral ikonka → kulrang, hint qisqartirildi
13. ✅ EmptyState matnlari qisqartirildi (3 ta variant)
14. ✅ GroupForm «Yopiq» va «Rasmiy» qatorlari: chegara+fon kartalar → hairline ro'yxat, matn qisqa
15. ✅ GroupForm muqova matni «Rasm tanlang — 3:1 nisbatda kesiladi» → «Muqova rasmi (3:1)», «Boshqa rasm tanlash» → «Boshqa rasm»
16. ✅ JoinButton xatosi inline span → toast (layout sakramaydi)
17. ✅ Mute + efir eslatmasi bitta menyuda (ikki tugma o'rniga bitta qo'ng'iroqcha)
18. ✅ Sozlash sahifasi: eyebrow/tavsif/taklif matni qisqartirildi, ikonka kulrang
19. ✅ RoleChip coral → kulrang (`bg-fg/6`)
20. ✅ «Qo'shilgan: 3 kun oldin» → «3 kun oldin»
21. ✅ Xabar yonidagi doimiy 2 ta hover ikonka (javob, shikoyat) → bitta «⋯» menyu (shikoyat ham ichida)
22. ✅ Katalog asosiy tugma «Guruh yoki kanal ochish» → «Yangi jamoa» (ikki joyda)
23. ✅ OfficialCover ichidagi «Rasmiy kanal» yozuvi olib tashlandi (✓ belgisi nom yonida)
24. ✅ LockedNotice matni bir jumlaga
25. ✅ Yangi jamoa sahifasi tavsifi qisqartirildi
26. ✅ Chat skeleti 3 → 2 qator; GroupForm tur kartalari matni qisqa

## Tekshiruv
- curl (jar'lar bilan): `GET /api/groups?sort=new` tartib; chat `POST` → `PATCH {body}` (tahrir) → `PATCH {pinned:true}` (egasi; mijoz 403) → `?q=` qidiruv → `DELETE` (moderator) → `pinned:null`, `deleted:true`, `changed[]` qaytadi; o'chirilganni tahrirlash 400; `mute {duration:"1h", eventReminders:false}` → `mutedUntil` va `eventReminders` view'da; `invite {expiresIn:"1d", maxUses:10}` → `uses` 1 ga oshdi (pending → active invite orqali); `members?format=csv` egasi 200 (`text/csv`, kontaktsiz), mijoz 403; `?status=banned` mijoz 403; o'z ustida amal 400; `approve_all` → `{count:1}`; so'rov izohi pending ro'yxatida; `remove` → banned `DELETE /join` 403, `POST /join` 403; `unban` → qayta so'rov 200; `PATCH {slug, rules, welcomeText, coverPosition}` 200, band slug 409, zaxira slug 422, mijoz 403; follow 4 marta toggle → bildirishnoma soni o'zgarmadi (4 → 4).
- Playwright (`/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/groups/shots.mjs`, `final.mjs`): 1440 light (mehmon, egasi, mijoz) + 390 dark (mehmon, egasi, mijoz) — HSCROLL hech qayerda yo'q, konsolda xato yo'q (hydration ogohlantirishi faqat test skriptining `data-theme` injeksiyasidan edi — skriptsiz tekshirildi: toza). Interaktiv: xabar menyusi, tahrir («tahrirlangan»), qadash paneli, qidiruv natijalari, yuborish (faqat yangi pufakcha animatsiyalanadi), jim qilish menyusi (1 soat → qo'ng'iroqcha title'i «… gacha jim»), chiqish tasdig'i, yopiq jamoada so'rov izohi, eski slug → yangi manzil.
- Skrinshotlar (`/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/groups/`): `d-light-guest-katalog.png`, `d-light-guest-guruh-lenta.png`, `d-light-guest-guruh-haqida.png`, `d-light-owner-chat.png`, `d-light-owner-chat-menu-nofull.png`, `d-light-owner-chat-edit-nofull.png`, `d-light-owner-chat-pinned-nofull.png`, `d-light-owner-chat-qidiruv-nofull.png`, `d-light-owner-mute-menu-nofull.png`, `d-light-owner-azolar.png`, `d-light-owner-media.png`, `d-light-owner-efirlar.png`, `d-light-owner-sozlash.png`, `d-light-owner-yopiq-azolar.png`, `d-light-client-chiqish-tasdiq-nofull.png`, `d-light-client-kanal.png`, `m-dark-guest-katalog.png`, `m-dark-guest-guruh.png`, `m-dark-owner-chat-nofull.png`, `m-dark-owner-azolar.png`, `m-dark-owner-haqida.png`, `m-dark-owner-sozlash.png`, `m-dark-owner-rasmiy.png`, `m-dark-client-yopiq.png`.
- `npx tsc --noEmit` — soha fayllarida xato yo'q (boshqa sohaning `vacancies` xatosi bor edi, menga tegishli emas).

## Boshqa sohalarga so'rovlar
- **shell/infra (middleware):** eski jamoa slug'i (`groups.prev_slug`) uchun haqiqiy 308 — sahifa ichidagi `permanentRedirect` `jamoalar/loading.tsx` tufayli 200 + meta refresh + klient yo'naltirish bo'lib qoladi (foydalanuvchi uchun ishlaydi, SEO uchun middleware'da `prev_slug` → `slug` yo'naltirish yaxshiroq).
- **chat agenti (`components/chat/MessageParts.tsx`):** `QuoteBlock` o'chirilgan iqtibos uchun xira/italic uslub varianti (`q.senderName === ""` holati) foydali bo'lardi; hozircha matn «Xabar o'chirilgan» bilan chiqadi.
- **moderation/reports:** `reports.target_type` enum'iga `group` qo'shilsa — «Jamoaga shikoyat» tugmasi (hozir faqat post/izoh/xabar/foydalanuvchi).
- **feed agenti (`GroupFeed`):** efir e'loni formasida vaqt Toshkent vaqti ekani yozilsin (`formatEventDate` server Asia/Tashkent bilan chiqaradi).

## Qoldirilgan / xavf
- Slug o'zgartirilganda faqat bitta eski manzil saqlanadi (`prev_slug`); ikki marta o'zgartirilsa birinchi manzil ishlamaydi — kerak bo'lsa alohida `group_slug_aliases` jadvali.
- Chat qidiruvi `LIKE` bilan (10 ming+ xabarda FTS5 kerak).
- `approve_all`/`sendWelcome` bildirishnomalari ketma-ket (25 talik) — minglab so'rovda navbat.
- Dev serverda birinchi kompilyatsiya sekin (6–13 s); Playwright kutishlari shunga moslangan.
