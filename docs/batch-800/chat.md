# Chat (DM, umumiy chat qismlari, yuklash) — batch-800 hisoboti (2026-10-18)

Qisqa hisob: A 0 · B 0 · C 0 · D 0 (reja — bajarilgani sari ✅ qilinadi)

## A. Yangi funksiyalar
1. ⬜ Xabarni tahrirlash (15 daqiqa oynasi, faqat o'z xabari, «tahrirlangan» belgisi)
2. ⬜ Xabarni o'chirish: men uchun / hamma uchun («Xabar o'chirildi» o'rinbosar)
3. ⬜ Suhbat ichida xabar qidirish (sarlavha menyusi → qidiruv paneli, natijaga o'tish)
4. ⬜ Xabarni qadash (pin) — tepadagi banner, bosilsa xabarga o'tadi
5. ⬜ Xabarni boshqa suhbatga yo'naltirish (forward) — tanlov varag'i, «Yo'naltirilgan» belgisi
6. ⬜ Emoji reaksiyalar (alohida `dm_message_reactions` jadvali, 1 foydalanuvchi = 1 reaksiya)
7. ⬜ «Media» paneli — suhbatdagi rasm/video/fayl/ovoz galereyasi
8. ⬜ ZIP biriktirmalar (sehrli bayt tekshiruvi bilan) — PDF/ZIP/DOC(X)
9. ⬜ Ovozli xabar: to'lqinni sichqoncha/barmoq bilan surish (scrub) + klaviatura
10. ⬜ Ijro tezligi 1×/1.5×/2× — tanlov eslab qolinadi (localStorage)
11. ⬜ «Yangi xabarlar» ajratuvchisi (o'qilmagan chegarasi)
12. ⬜ «Pastga» tugmasi o'qilmaganlar soni bilan
13. ⬜ Suhbatni arxivlash / ovozsiz / ro'yxatda qadash (`dm_conversation_prefs`)
14. ⬜ Ro'yxat qidiruvi oxirgi xabar matni bo'yicha ham + «Arxiv» ko'rinishi
15. ⬜ Har suhbat uchun qoralama (localStorage), yuborilganda tozalanadi
16. ⬜ Rasmni buferdan qo'yib yuborish (paste)
17. ⬜ Fayllarni sudrab tashlash (drag&drop) — overlay bilan
18. ⬜ Ctrl/Cmd+Enter bilan yuborish sozlamasi (menyuda, eslab qolinadi)
19. ⬜ Ro'yxatda «yozmoqda…» holati (suhbatdosh yozayotganda oxirgi xabar o'rnida)
20. ⬜ ✓✓ belgisida o'qilgan vaqt tooltip'i
21. ⬜ Havola prevyusi (server OG fetch: faqat https, xususiy IP taqiqi, 4 s timeout, 256 KB, kesh)
22. ⬜ Tez javob shablonlari DM'da (mutaxassis; OrderChat bilan bir xil saqlash kaliti)
23. ⬜ Sarlavha menyusi (⋯): profil, qidirish, media, ovozsiz, arxiv, shikoyat, bloklash
24. ⬜ Suhbat ma'lumot paneli (ishtirokchi kartasi, media soni, sozlamalar)
25. ⬜ Klaviatura: Alt+↑/↓ suhbatlar orasida, Esc — ro'yxatga/panelni yopish
26. ⬜ PWA badge (navigator.setAppBadge) — o'qilmaganlar soni
27. ⬜ «Yuborildi» uchish animatsiyasi + xabar matnidagi havolalar bosiladigan
28. ⬜ Xabar matnini nusxalash (menyu)

## B. Tuzatilgan buglar
1. ⬜ Yashirin tabda polling davom etardi → visibilitychange + sekinlashish (backoff)
2. ⬜ Yangi xabar kelganda butun sahifa sakrardi (scrollIntoView) → faqat konteyner scroll
3. ⬜ Yuborish xatosida holat yo'q edi → optimistik xabar «yuborilmoqda/yuborilmadi» + qayta yuborish
4. ⬜ Textarea o'smas/qayta tiklanmas edi → autosize + yuborgach reset
5. ⬜ Mobil (sensorli) ekranda Enter yangi qator; IME (isComposing) hisobga olinadi
6. ⬜ Mikrofon ruxsati rad etilganda holat yo'q edi → aniq xabar + tugma holati, NotFound/NotReadable ajratildi
7. ⬜ MediaRecorder.isTypeSupported yo'q brauzerda TypeError → himoya + mime fallback
8. ⬜ Audio/video bir-birini to'xtatmasdi → yagona «current media» boshqaruvi
9. ⬜ Uzun URL 390px'da bubble'dan chiqib ketardi → overflow-wrap:anywhere + min-w-0
10. ⬜ Sana/vaqt faqat uz-UZ edi → uz/ru lokal (Bugun/Kecha, oylar)
11. ⬜ Nisbiy vaqtlar («5 daqiqa oldin») yangilanmasdi → 60 s tick
12. ⬜ aria-live butun oynada edi → role=log + aria-relevant=additions, «yozmoqda» alohida status
13. ⬜ Suhbat ochilganda fokus yo'qolardi → fokus kompozitorga / orqaga qaytganda ro'yxat elementiga
14. ⬜ Sidebar badge yangilanmasdi → o'qilgach router.refresh() + app badge
15. ⬜ Yuklash jarayoni/bekor qilish yo'q edi → XHR progress + bekor tugmasi
16. ⬜ Iqtibos uzun so'zda qisqarmasdi → block overflow-hidden
17. ⬜ 429 xabari Retry-After'siz edi → «N soniyadan keyin» ko'rsatiladi
18. ⬜ Fokussiz oynada polling «o'qildi» qilib qo'yardi → ?read=0 (document.hasFocus) 
19. ⬜ Ro'yxat vaqti kechagi xabar uchun ham HH:MM edi → Kecha / sana
20. ⬜ dm_policy chetlab o'tish: /yozish/<user> bo'sh suhbat yaratib ro'yxatda chiqarardi → siyosat tekshiruvi + bo'sh suhbat faqat yaratuvchiga
21. ⬜ listConversations N+1 count so'rovlari → bitta guruhlangan so'rov
22. ⬜ Parallel polling ustma-ust tushardi → in-flight guard
23. ⬜ Bloklangan (ban) suhbatdoshda matn kompozitori ochiq qolardi → banner, kompozitor yopiq
24. ⬜ Fayl tanlashda MAX_ATTACHMENTS poygasi (stale closure) → funksional yangilash
25. ⬜ VoiceRecorder unmount paytida setState/yuklash → mounted guard
26. ⬜ Ovoz slayderi fokuslanmas/klaviaturasiz edi → tabIndex + ←/→ 
27. ⬜ startSchema'dagi bema'ni refine (`|| true`) → olib tashlandi, bo'sh tana server tomonda tekshiriladi

## C. Dizayn va animatsiya tuzatishlari
1. ⬜ Yangi xabarlar `animate-msg-in` (faqat keyin kelganlari, dastlabki 200 tasi emas)
2. ⬜ Yuborish tugmasi «uchish» (transition) animatsiyasi
3. ⬜ Bubble bosilganda yengil press holati
4. ⬜ Kun ajratuvchisi yopishqoq (sticky) pill
5. ⬜ «Yozmoqda» — role=status + usePresence chiqish animatsiyasi
6. ⬜ Barcha menyular/varaqlar `.pop-in/.pop-out`, mobil `.sheet-in/.sheet-out` + overlay
7. ⬜ Kompozitor kengayishi (autosize transition), chiplar `expand-in`
8. ⬜ Javob paneli chiqish animatsiyasi (usePresence)
9. ⬜ Ro'yxat skeletoni 6 qator + stagger, sarlavha skeletoni
10. ⬜ Bubble radiusi 14 (dum 4px) — DM va OrderChat bir xil
11. ⬜ Ro'yxat hairline ajratuvchilar
12. ⬜ Ovoz bubble: play tugmasi aksentsiz (ink/surface), to'lqinda scrub dastagi
13. ⬜ Ikonka tugmalarga yagona `iconBtn` (40px, focus-visible halqa)
14. ⬜ «Pastga» tugmasi pop-in/pop-out
15. ⬜ Qadalgan xabar banneri expand-in/out
16. ⬜ Reaksiya chipi `animate-badge-pop`
17. ⬜ O'chirilgan xabar — kursiv, xira
18. ⬜ «tahrirlangan» belgisi
19. ⬜ Drag overlay `overlay-in`
20. ⬜ Shikoyat/blok tasdiqlari expand-in/out
21. ⬜ Faol suhbat qatori — surface-2 + chap chiziq (aksent faqat o'qilmagan badge'da)
22. ⬜ OrderChat paneli usePresence bilan yopiladi
23. ⬜ OrderChat kun ajratuvchisi sticky
24. ⬜ OrderChat o'z bubble'i ink (accent-soft emas)
25. ⬜ Fayl chiplari bir xil (hairline, radius 10)

## D. Minimalizm
1. ⬜ Ro'yxat qatori: ism · vaqt / bir qatorlik prevyu (ikonka bilan, emoji matnsiz)
2. ⬜ Kompozitor: bitta «+» menyu (fayl, tez javoblar, sozlama) — ortiqcha ikonkalar yo'q
3. ⬜ Bubble'lar faqat ink/surface, chegara/soya yo'q
4. ⬜ /kabinet/chat sahifa sarlavhasi ixcham (eyebrow/tavsif olib tashlandi), chat balandroq
5. ⬜ Sarlavhadagi 2 ta ikonka → bitta ⋯ menyu
6. ⬜ ReportPanel (≈80 qator) o'rniga mavjud ReportButton modal (user)
7. ⬜ Xabar yonidagi 2 ta hover-ikonka → bitta ⋯ menyu (javob/reaksiya/nusxa/…)
8. ⬜ Bo'sh holat matnlari qisqartirildi (3 joy)
9. ⬜ Blok tasdig'i va blok banneri qisqa matn
10. ⬜ Tooltip/aria matnlari qisqartirildi
11. ⬜ Audio bubble: ortiqcha mikrofon ikonkasi olib tashlandi
12. ⬜ VoiceRecorder: «Ovoz yozilmoqda · ko'pi bilan 3 daqiqa» matni olib tashlandi
13. ⬜ Ro'yxatda `@username` fallback olib tashlandi
14. ⬜ Kun ajratuvchi — chiziqlarsiz pill
15. ⬜ Vaqt belgisi ixcham (bubble ichida bir qator)
16. ⬜ OrderChat: xavfsizlik eslatmasi qisqa
17. ⬜ OrderChat: «Enter — yuborish…» yordam qatori olib tashlandi
18. ⬜ OrderChat: tez javoblar yig'iladigan (chevron) — doimiy chip qatori yo'q
19. ⬜ OrderChat: admin eslatmasi qisqa
20. ⬜ OrderChat: thumb hover-zoom va ortiqcha chegaralar olib tashlandi
21. ⬜ Bo'sh ro'yxat CTA tugma → matn havola
22. ⬜ AttachmentList fayl havolasi: underline o'rniga hairline chip
23. ⬜ Yuborish tugmasi faqat matn/fayl bo'lganda aksent
24. ⬜ Ovoz yozish paneli: faqat nuqta + taymer + 2 tugma
25. ⬜ Qidiruv maydoni ro'yxatda ixcham (h-9)

## Tekshiruv
(to'ldiriladi)

## Boshqa sohalarga so'rovlar
(to'ldiriladi)
