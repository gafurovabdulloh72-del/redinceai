# Chat (DM, umumiy chat qismlari, yuklash) — batch-800 hisoboti (2026-10-18)

Qisqa hisob: A 28 · B 27 · C 25 · D 25

Asosiy fayllar: `src/components/chat/DmChat.tsx` (to'liq qayta yozildi), `DmPanels.tsx` (yangi: Layer/menyu/dialoglar), `MessageParts.tsx`, `VoiceRecorder.tsx`, `attachments.ts`, `OrderChat.tsx`;
`src/lib/chat/dm.ts` (kengaytirildi), `constants.ts` (yangi), `time.ts` (yangi), `link-preview.ts` (yangi); API `src/app/api/chat/**` (8 ta yangi route), `src/app/api/upload/route.ts`;
sahifalar `src/app/kabinet/chat/page.tsx`, `src/app/yozish/[username]/page.tsx`; sxema (qo'shimcha): `dm_messages.edited_at/deleted_at/hidden_for/forwarded_from`, `conversations.pinned_message_id/created_by`, jadvallar `dm_message_reactions`, `dm_conversation_prefs`; rate-limit: `dmEdit`, `linkPreview`.

## A. Yangi funksiyalar
1. ✅ Xabarni tahrirlash — 15 daqiqa oynasi, faqat o'z xabari, «tahrirlangan» belgisi (`PATCH /api/chat/[id]/messages/[mid]`, `editDm`, kompozitorda «Tahrirlash» paneli) — `lib/chat/dm.ts`, `DmChat.tsx`
2. ✅ O'chirish: men uchun (`hidden_for`) / hamma uchun (tana tozalanadi, «Xabar o'chirildi» kursiv o'rinbosar; qadalgan bo'lsa yechiladi) — `DELETE …/messages/[mid]?scope=me|all`
3. ✅ Suhbat ichida qidirish — sarlavha ikonkasi/menyu → panel, parcha + vaqt, bosilsa xabarga o'tadi (`GET …/search?q=`, LIKE escape) — `api/chat/[id]/search/route.ts`
4. ✅ Xabarni qadash — tepadagi banner (expand-in/out), bosilsa o'tadi, ✕ yechadi; ikkala tomon ko'radi (`PUT …/pin`) 
5. ✅ Yo'naltirish — dialog (qidiruv bilan suhbat tanlash), nusxa «Yo'naltirilgan: <ism>» belgisi bilan; qabul qiluvchi blok/dm_policy tekshiriladi (`POST …/forward`)
6. ✅ Emoji reaksiyalar — `dm_message_reactions` (1 foydalanuvchi = 1 reaksiya, qayta bosilsa olinadi), menyuda tanlov qatori, bubble ostida chiplar, polling'da sinxron (`PUT …/messages/[mid]/reaction`)
7. ✅ «Ma'lumot va media» dialogi — ishtirokchi kartasi, sozlamalar, 4 tab (rasm/video/fayl/ovoz) sanog'i bilan, grid/ro'yxat, «Yana» kursor (`GET …/media[?kind=&cursor=]`) — `DmPanels.tsx`
8. ✅ ZIP biriktirmalar — PK\x03\x04 / PK\x05\x06 sehrli baytlar + .zip nomi; soxta zip → 415; `UPLOAD_URL_RE`, `EXT_MIME`, accept ro'yxati — `api/upload/route.ts`, `attachments.ts`
9. ✅ Ovozli xabar: to'lqinni surish (pointer capture, barmoq/sichqoncha) + klaviatura (←/→ 5 s, Home/End, Space) — `MessageParts.tsx` AudioBubble
10. ✅ Ijro tezligi 1×/1.5×/2× eslab qolinadi (`localStorage chat:rate`), barcha pleyerlarga tegishli
11. ✅ «Yangi xabarlar» ajratuvchisi — server `readAt` (avvalgi o'qigan vaqtim) beradi, birinchi o'qilmagan xabar oldida chiziq; ochilganda shu joyga scroll
12. ✅ «Pastga» tugmasi — pastdan uzoqlashganda chiqadi (pop-in/out), yangi kelgan xabarlar soni bilan
13. ✅ Suhbat sozlamalari: arxiv / ovozsiz / ro'yxatda qadash — `dm_conversation_prefs`, qator menyusi + sarlavha menyusi + info dialog; ovozsizda bildirishnoma yuborilmaydi va badge hisobiga kirmaydi (`PATCH …/prefs`)
14. ✅ Ro'yxat qidiruvi oxirgi xabar matni bo'yicha ham; «Arxiv N» chip — arxivdagilar alohida ko'rinish
15. ✅ Qoralama har suhbat uchun (`chat:draft:<id>`, 300 ms), ochilganda tiklanadi, yuborilgach tozalanadi
16. ✅ Rasmni buferdan qo'yish (paste) — darhol yuklanadi va chip bo'ladi
17. ✅ Drag&drop — suhbat ustiga tashlash, «Faylni shu yerga tashlang» overlay (overlay-in/out), blokda o'chiq
18. ✅ Ctrl/Cmd+Enter bilan yuborish sozlamasi («+» menyuda, `chat:ctrlEnter`)
19. ✅ Ro'yxatda «yozmoqda…» — server `peerTyping` har suhbat uchun; sarlavhada ham ism o'rniga holat
20. ✅ ✓✓ belgisida o'qilgan vaqt (tooltip + aria: «O'qildi 14:32»)
21. ✅ Havola prevyusi — `GET /api/chat/preview?url=`: faqat https/443, user-info yo'q, DNS orqali xususiy/loopback IP taqiqi, redirect qo'lda (2 ta), 4 s timeout, 256 KB, text/html; OG/title/description/image parse; 1 soat kesh; klientda `LinkCard` (birinchi havola) — `lib/chat/link-preview.ts`
22. ✅ Tez javob shablonlari DM'da (mutaxassis) — «+» menyuda, OrderChat bilan bir xil `redince:quick-replies` kaliti
23. ✅ Sarlavha ⋯ menyusi — profil, qidirish, ma'lumot/media, qadash/ovozsiz/arxiv, shikoyat (mavjud ReportButton modal), bloklash/blokdan chiqarish
24. ✅ Suhbat ma'lumot paneli (7-band bilan birga: ishtirokchi, @username, faollik, profil havolasi, media soni)
25. ✅ Klaviatura: Alt+↑/↓ — suhbatlar orasida, Esc — panel/menyu, telefonda ro'yxatga qaytish
26. ✅ PWA badge — `navigator.setAppBadge(o'qilmaganlar)` / `clearAppBadge` (ovozsizlar hisobga olinmaydi); `GET /api/chat/unread` yengil endpoint
27. ✅ «Yuborildi» uchish animatsiyasi (Send ikonkasi transition bilan uchib ketadi) + xabar matnidagi havolalar bosiladigan (`Linkified`)
28. ✅ Xabar matnini nusxalash (menyu, toast «Nusxalandi»)

## B. Tuzatilgan buglar
1. ✅ Yashirin tabda polling davom etardi → `visibilitychange`/`focus` + yangilik bo'lmasa sekinlashish (4 s → 8 s → 15 s), ko'ringanda darhol so'rov — `DmChat.tsx`
2. ✅ Yangi xabarda `scrollIntoView` butun sahifani sakratardi (telefonda ayniqsa) → faqat konteyner `scrollTop`
3. ✅ Yuborish xatosida holat yo'q edi (tugma aylanardi, matn qolardi) → optimistik xabar «yuborilmoqda», xatoda qizil halqa + «Qayta / O'chirish»
4. ✅ Textarea bir qatorli, o'smas, yuborgach balandlik qolardi → autosize (140 px gacha) + reset
5. ✅ Sensorli ekranda Enter yuborib yuborardi, IME kiritishda ham → `pointer: coarse` bo'lsa Enter yangi qator (Ctrl/Cmd+Enter yoki tugma), `isComposing` tekshiruvi (DM + OrderChat)
6. ✅ Mikrofon ruxsati rad etilganda faqat bir martalik xato edi → tugma «o'chiq mikrofon» holati + title/aria sabab; NotFound/NotReadable alohida matn — `VoiceRecorder.tsx`
7. ✅ `MediaRecorder.isTypeSupported` bo'lmagan brauzerda TypeError → himoya; `mimeType` rad etilsa standart konstruktorga fallback
8. ✅ Audio/video bir-birini to'xtatmasdi (video o'ynab turganda ovozli xabar ham) → yagona `claimMedia` (audio + `<video onPlay>`; DM, guruh, OrderChat)
9. ✅ Uzun URL 390 px'da bubble'dan chiqib ketardi (flex min-width) → `min-w-0` + `[overflow-wrap:anywhere]` + havola `break-all`
10. ✅ Sana/vaqt faqat `uz-UZ` + brauzer zonasi edi → `lib/chat/time.ts` (Toshkent UTC+5, uz/ru: Bugun/Kecha/oylar, nisbiy vaqt ru)
11. ✅ «oxirgi faollik 5 daqiqa oldin» hech qachon yangilanmasdi → `useNowTick` (60 s) DM va OrderChat
12. ✅ Butun xabarlar oynasi `aria-live` edi (skeleton almashganda ham o'qilardi) → `role=log` + `aria-relevant=additions` + `aria-busy`; «yozmoqda» `role=status`
13. ✅ Suhbat ochilganda fokus yo'qolardi → desktopda kompozitorga, telefonda «Orqaga» tugmasiga; ro'yxatga qaytganda avvalgi qator fokuslanadi
14. ✅ Yon panel «Chat» badge'i o'qilgandan keyin ham qolardi → o'qilmagan suhbat ochilganda `router.refresh()` (1.2 s) + app badge
15. ✅ Fayl yuklashda jarayon/bekor qilish yo'q edi → XHR progress (chip ichida foiz chizig'i) + AbortController bekor tugmasi — `attachments.ts`
16. ✅ Iqtibos ichidagi uzun so'z qisqarmasdi (inline span) → `block min-w-0 overflow-hidden` — `QuoteBlock`/`ReplyBar`
17. ✅ 429 xabari Retry-After'siz edi → «… (N soniyadan keyin)» (yuborish, tahrir, yuklash) — `withRetryAfter`
18. ✅ Oyna fokussiz bo'lsa ham polling suhbatni «o'qildi» qilardi (yolg'on ✓✓) → `document.hasFocus()` yo'q bo'lsa `?read=0`, server belgilamaydi
19. ✅ Ro'yxatda kechagi/eski xabar vaqti ham HH:MM edi → Kecha / sana (`listStamp`)
20. ✅ dm_policy chetlab o'tish: `/yozish/<user>` bo'sh suhbat yaratib, qabul qiluvchi ro'yxatida chiqarardi → sahifada `assertCanDm` (→ `?xato=yopiq` toast), `conversations.created_by`, bo'sh suhbat faqat yaratuvchiga ko'rinadi (curl bilan tasdiqlandi)
21. ✅ `listConversations` har suhbatga alohida count (N+1) → bitta guruhlangan so'rov (CASE bilan tomon)
22. ✅ Parallel polling ustma-ust tushardi → in-flight guard; yangi xabar faqat `after` kursoridan
23. ✅ Bloklangan (ban) suhbatdoshda matn kompozitori ochiq, server 403 berardi → banner, kompozitor yopiq
24. ✅ Fayl tanlashda `MAX_ATTACHMENTS` poygasi (stale closure) → yuklanayotganlar ham hisobga olinadi, funksional yangilash
25. ✅ VoiceRecorder suhbat almashganda unmount'dan keyin setState/yuklash qilardi → `mounted` guard, yozuv tashlab yuboriladi
26. ✅ Ovoz slayderi fokuslanmas (div, tabIndex yo'q), klaviaturasiz → `tabIndex=0`, `aria-valuetext`, tugmalar
27. ✅ `/api/chat` POST `startSchema.refine(... || true)` bema'ni edi → olib tashlandi; tahrir/o'chirish/reaksiya/pin/forward/prefs/preview — barchasi `handler()` CSRF ostida (Origin'siz → 403 tasdiqlandi)

## C. Dizayn va animatsiya tuzatishlari
1. ✅ Yangi kelgan/yuborilgan xabarlar `animate-msg-in` (faqat ochilgandan keyin qo'shilganlari — dastlabki 200 tasi emas)
2. ✅ Yuborish: Send ikonkasi yuqoriga-o'ngga «uchib» ketadi (transition, 300 ms)
3. ✅ Bubble bosilganda yengil press (`active:scale-[0.995]`)
4. ✅ Kun ajratuvchisi yopishqoq pill (`DayPill`, sticky) — DM + OrderChat
5. ✅ «Yozmoqda» `role=status` + `usePresence` chiqish (`expand-out`)
6. ✅ Barcha menyular/varaqlar: desktopda `pop-in/pop-out` popover (pastda bo'lsa yuqoriga ochiladi), telefonda `sheet-in/out` + `overlay-in/out`, Esc/fon yopadi — `Layer`
7. ✅ Kompozitor kengayishi (`transition-[height]`), fayl chiplari `expand-in`, «+» ikonkasi 45° buriladi
8. ✅ Javob/Tahrir paneli `usePresence` bilan chiqadi
9. ✅ Ro'yxat skeletoni 6 qator + `stagger`, sarlavha skeletoni (avatar + ism)
10. ✅ Bubble radiusi 14 (dum 4 px) — DM va OrderChat bir xil; skeleton ham 14
11. ✅ Ro'yxat hairline `divide-y` ajratuvchilar (bo'shliq o'rniga)
12. ✅ Ovoz pleyeri: play tugmasi aksentsiz (ink / ink-fg), surishda `cursor-grabbing`, fokus halqasi
13. ✅ Ikonka tugmalarga yagona `iconBtn` (40 px, `focus-visible` halqa) — sarlavha, ro'yxat, kompozitor
14. ✅ «Pastga» tugmasi `pop-in/pop-out`, `card-floating`
15. ✅ Qadalgan xabar banneri `expand-in/out`
16. ✅ Reaksiya chipi `animate-badge-pop` (son o'zgarganda), bubble burchagiga tiqilgan
17. ✅ O'chirilgan xabar — kursiv, xira (opacity 70)
18. ✅ «tahrirlangan ·» belgisi vaqt oldida
19. ✅ Drag overlay `overlay-in/out`, punktir kontur
20. ✅ Blok tasdig'i `expand-in/out`; qidiruv paneli `expand-in/out`
21. ✅ Faol suhbat qatori — `surface-2` + chap 2 px chiziq (aksent faqat o'qilmagan badge'da; ovozsizda kulrang badge)
22. ✅ OrderChat paneli `usePresence` bilan yopiladi (`expand-out`)
23. ✅ OrderChat kun ajratuvchisi sticky pill
24. ✅ OrderChat o'z bubble'i ink (accent-soft emas), radius 14/4
25. ✅ Fayl chiplari bir xil: kengaytma kvadrati (PDF/ZIP/DOCX) + nom + hajm, radius 10 (DM, media dialog); OrderChat thumb/chip radius 10

## D. Minimalizm
1. ✅ Ro'yxat qatori: ism · vaqt / bir qatorlik prevyu (mikrofon/skrepka ikonkasi, emoji matn yo'q), ovozsiz/qadalgan 11 px belgilar
2. ✅ Kompozitor: skrepka o'rniga bitta «+» menyu (fayl, tez javoblar, Ctrl+Enter sozlamasi)
3. ✅ Bubble'lar faqat ink / surface-2 — chegara, soya, `transition-shadow` yo'q
4. ✅ /kabinet/chat sarlavhasi: eyebrow + 2 qatorli displey + tavsif → bitta «Xabarlar» qatori; chat balandligi 220 → 150/130 px chegirma
5. ✅ Sarlavhadagi 2 ta rangli holatli ikonka (bayroq, blok) → bitta ⋯ menyu (qidiruv ikonkasi qoldi)
6. ✅ Inline `ReportPanel` (≈80 qator forma) o'chirildi → mavjud `ReportButton` modal (user/message), dasturiy ochiladi
7. ✅ Xabar yonidagi 2 ta hover-ikonka (javob + bayroq) → bitta ⋯ (javob/reaksiya/nusxa/yo'naltirish/qadash/tahrir/o'chirish/shikoyat)
8. ✅ Bo'sh holat matnlari qisqartirildi (3 joy: ro'yxat, suhbat tanlash, birinchi xabar)
9. ✅ Blok tasdig'i «Bloklaysizmi? U sizga yoza olmaydi.» va banner «Siz bloklagansiz — yozib bo'lmaydi.»
10. ✅ Tooltip/aria matnlari qisqa («Fayl», «Profil», «Menyu»)
11. ✅ Audio bubble: ortiqcha mikrofon ikonkasi olib tashlandi
12. ✅ VoiceRecorder: «Ovoz yozilmoqda · ko'pi bilan 3 daqiqa» matni yo'q — nuqta + taymer + 2 tugma
13. ✅ Ro'yxat va sarlavhada `@username` fallback matni olib tashlandi
14. ✅ Kun ajratuvchi — ikki chiziqsiz, faqat pill
15. ✅ Vaqt belgisi ixcham bir qator (tahrir · vaqt · ✓✓)
16. ✅ OrderChat xavfsizlik eslatmasi 2 gap → 1 gap
17. ✅ OrderChat «Enter — yuborish · Shift+Enter» yordam qatori olib tashlandi
18. ✅ OrderChat tez javoblar — doimiy chip qatori o'rniga «⚡ Tez javoblar» yig'iladigan
19. ✅ OrderChat admin eslatmasi «Faqat ko'rish (admin)»
20. ✅ OrderChat thumb hover-zoom, video/rasm chegaralari olib tashlandi
21. ✅ Bo'sh ro'yxat CTA tugma → matn havola
22. ✅ Fayl havolasi underline o'rniga tinch chip (hover fon)
23. ✅ Ro'yxat ustki qatori: qidiruv + «Arxiv» chip bitta qatorda, alohida sarlavha/filtr paneli yo'q
24. ✅ Ovoz yozish paneli: aksent chegara/fon o'rniga hairline + surface-2
25. ✅ Qidiruv maydonlari h-10 → h-9, ro'yxat avatari 44 → 40

## Tekshiruv
- `npx tsc --noEmit | grep -v .next/types` — mening fayllarimda xato yo'q (boshqa agentning `vakansiyalar` fayllarida 4 ta xato bor).
- curl (`/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/chat/api-test.sh`, `api-test2.sh`, natijalar `api-test.out`, `api-test2.out`): thread GET yangi maydonlar (`readAt/pinned/prefs/reactions/updates/now`); edit own 200 / begona 403 / Origin'siz 403 / o'chirilgan 410; reaksiya ❤️→🔥 almashish, noto'g'ri emoji 422, null olib tashlash; pin/unpin; search (2 belgi 422); media counts/kind; prefs (muted → `/api/chat/unread` 0, bo'sh 422); forward 201 + `forwardedFrom`, a'zo bo'lmagan suhbatga 404; delete me (keyingi GET'da yo'q) / all begona 403 / own 200 + sync `updates` + pin yechilgan; preview: 127.0.0.1 → null, http → null, yomon URL 422, kirmagan 401; ZIP 201 `.zip`, soxta zip 415; `/yozish` dm_policy=none → 307 `?xato=yopiq`, suhbat yaratilmaydi; policy=all → yaratiladi `created_by` bilan; bo'sh suhbat admin ro'yxatida yo'q, mijozda bor.
- Playwright (`shots.mjs`, `interact.mjs`): 1440 light + 390 dark/light, HSCROLL=false hammasida, konsol xatosi yo'q (dev server qayta ishga tushgan paytdagi ERR_EMPTY_RESPONSE'dan tashqari). Skrinshotlar:
  - `/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/chat/chat-v2-d-light-thread.png` (desktop: tahrirlangan belgisi, reaksiya, o'chirilgan o'rinbosar, «+» kompozitor)
  - `/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/chat/chat-v2-d-dark-thread.png`
  - `/tmp/claude-0/-home-user-redinceai/e7eeba0d-30d9-5a8d-a460-9bb9ce1add69/scratchpad/batch/chat/chat-v2-m-dark-list.png`, `chat-v2-m-dark-thread.png`, `chat-v2-m-light-thread.png`
  - interaktiv: `chat-ix-d-msg-menu.png`, `chat-ix-d-header-menu.png`, `chat-ix-d-search.png`, `chat-ix-d-info.png`, `chat-ix-d-plus-menu.png`, `chat-ix-d-recording.png`, `chat-ix-m-sheet.png`, `chat-ix-order-d-light.png`, `chat-ix-order-m-dark.png` (natijalar `interact.log`)
  - baza: `chat-base-*.png` (oldingi holat)

## Boshqa sohalarga so'rovlar
- `src/app/uploads/[name]/route.ts` (disk fayl serveri, dev/VPS): nom regex'iga `zip`, `MIME` xaritasiga `zip: "application/zip"`, `DOWNLOAD` to'plamiga `"zip"` qo'shilsin — aks holda lokal diskda saqlangan .zip havolasi 404 beradi (Blob/R2'da muammo yo'q).
- `design` (globals.css): ixtiyoriy — `.sheet-handle` uchun standart fon (`bg-fg/15`) tokeni; hozir Layer'da utility bilan berilgan.
- `groups` (GroupChat): `MessageParts` eksportlari mos qoldi (`AttachmentList/QuoteBlock/ReplyBar/ReplyButton/TypingDots/typingLabel`); xohlasa `DayPill`, `Linkified`, `ReactionChips`, `claimMedia`, `useNowTick`ni ishlatishi mumkin; `uploadAttachment` endi `onProgress/signal` qabul qiladi (ixtiyoriy).

## Qoldirilgan / xavf
- Havola prevyusi sandbox'da DNS yo'qligi sababli faqat himoya shoxlari (null/422/401) sinaldi; prod'da Node fetch to'g'ridan-to'g'ri chiqadi (proksi talab qilinmaydi). SSRF himoyasi DNS natijasiga tayanadi (DNS rebinding oynasi nazariy — 4 s timeout + faqat text/html + 256 KB).
- Polling'da reaksiyalar so'nggi 200 ta xabar oynasi bo'yicha har safar qayta yuklanadi (bitta guruhlangan so'rov) — real-time bosqichida push'ga o'tkazish mumkin.
- «Men uchun o'chirilgan» xabar qadalgan bo'lsa, banner baribir ko'rinadi (qadash umumiy) — ataylab.
