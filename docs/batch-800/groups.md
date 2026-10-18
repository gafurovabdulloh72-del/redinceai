# Jamoalar (guruhlar/kanallar) — batch-800 hisoboti (2026-10-18)
Qisqa hisob: A 0 · B 0 · C 0 · D 0 (reja — bajarilgani sari ✅)

## A. Yangi funksiyalar
1. ⬜ Guruh chatida xabarni qadash (pin) — boshqaruvchi; chat tepasida «Qadalgan» paneli, bosilsa xabarga o'tadi
2. ⬜ O'z xabarini o'chirish (soft delete → «Xabar o'chirilgan» o'rinbosari); moderator har qanday xabarni o'chira oladi
3. ⬜ O'z xabarini tahrirlash («tahrirlangan» belgisi, 24 soat ichida)
4. ⬜ Chatda xabar qidirish (`?q=` server qidiruvi + natijaga o'tish)
5. ⬜ Xabar amallari menyusi («⋯»: javob, nusxalash, qadash, tahrirlash, o'chirish, shikoyat)
6. ⬜ Jamoa qoidalari muharriri (markdown-lite: `- ` ro'yxat, `**qalin**`) — egasi sozlashda yozadi, «Haqida»da chiqadi
7. ⬜ «Media» bo'limi — postlardagi rasm/videolar to'ri
8. ⬜ Tavsif «ko'proq / kamroq» ochilishi (hero)
9. ⬜ Statistika kartasi (haftalik post/xabar, faol a'zolar, haftalik yangi a'zolar)
10. ⬜ Yangi a'zolarga xush kelibsiz xabari (egasi matni → qo'shilganda bildirishnoma + toast)
11. ⬜ Barcha so'rovlarni bir bosishda tasdiqlash (`approve_all`)
12. ⬜ Taklif havolasi muddati va limiti (24 soat / 7 kun / cheksiz; 10 / 50 / cheksiz marta), ishlatilgan soni
13. ⬜ A'zolar ro'yxatini CSV eksport (egasi; kontaktlarsiz — ism, taxallus, rol, sana)
14. ⬜ Bildirishnomalarni vaqtincha o'chirish (1 soat / 8 soat / doim) — `muted_until`
15. ⬜ Yo'nalish chiplarida jamoalar soni
16. ⬜ «O'xshash jamoalar» paneli (yo'nalish/hudud bo'yicha)
17. ⬜ A'zolar sonini ixcham formatlash (1,2K) karta va hero'da
18. ⬜ Efir eslatmalarini yoqish/o'chirish (a'zo sozlamasi; `live_event` fan-out hurmat qiladi)
19. ⬜ «Efirlar» bo'limi — yaqin va o'tgan efirlar ro'yxati (kalendar havolalari bilan)
20. ⬜ Muqova joylashuvini sozlash (vertikal %, `cover_position`) — karta va hero'da `object-position`
21. ⬜ Egasi slug'ni o'zgartiradi; eski manzil yangisiga yo'naltiriladi (`prev_slug`)
22. ⬜ Chiqishdan oldin tasdiq (inline, expand-in)
23. ⬜ Chiqarilgan a'zolar ro'yxati va qaytarish (`unban`)
24. ⬜ Chatda «↓ N yangi xabar» tugmasi (yuqorida o'qiyotganda yangi kelsa)
25. ⬜ A'zolar filtri: Onlayn / Adminlar
26. ⬜ Yopiq jamoaga so'rov yuborishda qisqa izoh (`join_note`) — boshqaruvchi so'rovlar ro'yxatida ko'radi

## B. Tuzatilgan buglar
1. ⬜ Chiqarilgan (banned) a'zo `DELETE /join` bilan o'z ban yozuvini o'chirib qayta qo'shila olardi → endi 403
2. ⬜ Admin o'z ustida amal bajara olardi (o'zini chiqarish) → «O'zingiz ustida amal bajarib bo'lmaydi»
3. ⬜ Chat polling: tab ko'rinmaganda 4 s davom etar, qaytganda darhol yangilanmas edi → visibilitychange + xatoda backoff (4→8→16→30 s)
4. ⬜ Chat ochilganda `scrollIntoView` butun sahifani sakratardi → konteyner `scrollTop` bilan
5. ⬜ Muallif o'z posti/xabaridan keyin «yangi» nuqtasini ko'rardi (`lastReadAt` yangilanmas edi) → createPost'da markGroupRead
6. ⬜ 390px'da uzun ism a'zolar ro'yxatida kesilmas edi (inline span) → `block truncate`
7. ⬜ Chat xabarlar ro'yxatida `role="log" aria-live` yo'q edi
8. ⬜ Shakl maydonlarida `aria-invalid`/`aria-describedby` yo'q, xato matni ekran o'quvchiga bog'lanmagan
9. ⬜ Slug to'qnashuvi (unique) 500 berardi → qayta urinish
10. ⬜ Chat sanalari `toLocaleDateString("uz-UZ")` (brauzerga bog'liq, ru'ni hurmat qilmaydi) → qo'lda uz/ru
11. ⬜ Taklif havolasi bilan kelgan «pending» a'zo faollashmas edi → invite pending'ni active qiladi
12. ⬜ JoinButton xatosi `role="alert"`siz → e'lon qilinadi
13. ⬜ `GET /api/groups` `sort` parametrini e'tiborsiz qoldirardi
14. ⬜ Obuna (follow) bildirishnomasi har toggle'da — spam → 24 soatda bir marta
15. ⬜ FollowersDialog: fon skroll qulflanmagan, fokus dialogga o'tmaydi
16. ⬜ GroupForm «Bekor» create rejimida `router.back()` — to'g'ri kelganda saytdan chiqib ketardi → /jamoalar
17. ⬜ CalendarLinks `.ics`: `;` escape `"\;"` (backslash yo'q) → `"\\;"`
18. ⬜ Kanal chati sarlavhasi «Jamoa chati» deb turardi → «Muhokama»
19. ⬜ `pendingCount` so'rovi har ko'ruvchi uchun bajarilardi → faqat boshqaruvchi
20. ⬜ Katalogda 30 tadan ko'p jamoa ko'rinmas edi → «Yana» (limit=60)
21. ⬜ Katalog «Mening jamoalarim» linkida `aria-pressed`, tab-linklarda `role=tab` panelsiz → `aria-current`
22. ⬜ GroupMembers xatosi `role="alert"`siz, chat xatosi ham
23. ⬜ Chat: matn tozalanganda `typing:false` yuborilmas edi (6 s «yozmoqda» qolardi)
24. ⬜ `listGroupMessages(afterId)` noma'lum id'da abadiy bo'sh → vaqt bo'yicha fallback
25. ⬜ Hero muqova 4:1, karta va kesish 3:1 — bir xil emas → 3:1
26. ⬜ Sahifa yuklanishida `[slug]` uchun skeleton yo'q edi (bo'sh ekran) → `loading.tsx`

## C. Dizayn va animatsiya tuzatishlari
1. ⬜ Dastlabki yuklashda 200 xabar birdan `msg-in` o'ynardi → faqat yangi kelganlar animatsiyalanadi
2. ⬜ Mute menyusi `.pop-in/.pop-out` + `usePresence`, Esc/tashqi bosish yopadi
3. ⬜ JoinButton holat almashinuvi `animate-swap`
4. ⬜ A'zolar ro'yxati `.stagger`
5. ⬜ Kompozitor ustida hairline/soyа faqat yuqoriga skroll qilinganda
6. ⬜ Radiuslar v3 (10/14/20): GroupForm 16→14, tugmalar balandligi 11 → bir xil
7. ⬜ Bo'lim tablari: faol chiziq `animate-fade-in`, rang o'tishi
8. ⬜ Muqova nisbati 3:1 hamma joyda
9. ⬜ Chat pufakchalari: chegarasiz (`bg-surface-2`), hairline faqat kompozitor ustida
10. ⬜ GroupCard hover: ko'tarilish/soya o'rniga hairline qoraygan (v3 yassi)
11. ⬜ Tasdiqlash/rad etish tugmalari `.press`
12. ⬜ So'rovlar/a'zolar qatori kirish `animate-fade-in` (key bo'yicha)
13. ⬜ `[slug]/loading.tsx` skeleton (hero + tablar + ro'yxat)
14. ⬜ Chat tugmalarida `focus-visible` halqa
15. ⬜ EventsCard qatorlari `bg-surface-2`, aksent faqat jonli holatda
16. ⬜ Rasmiy banner: `ring-accent` yo'q, hairline
17. ⬜ «↓ yangi xabar» tugmasi pop-in/pop-out
18. ⬜ Xabar amallari menyusi pop-in/pop-out, Esc
19. ⬜ GroupForm tur kartalari: faol holat ink kontur (coral emas)
20. ⬜ Chat kun ajratgichlari: kichik kulrang pill
21. ⬜ Hero sarlavhasi `display-xl` (ortiqcha o'lchamlar olib tashlandi)
22. ⬜ LockedNotice `data-reveal`
23. ⬜ Qidiruv maydoni (a'zolar) `expand-in`
24. ⬜ InviteJoin banner `expand-in`
25. ⬜ Karta chiplari blur'siz (v3)
26. ⬜ Qadalgan xabar paneli `expand-in/expand-out`

## D. Minimalizm
1. ⬜ GroupCard: muqova ustidagi 3–4 chip → faqat tur/yopiq belgisi; a'zolik yorlig'i kulrang
2. ⬜ Hero: chiplar qatori olib tashlandi → bitta meta qatori (yo'nalish · hudud · a'zolar)
3. ⬜ Dublikat hisoblagichlar: tablardagi sonlar olib tashlandi (hero'da bor)
4. ⬜ Rasmiy banner tinchroq: coral chip o'rniga ✓ belgisi nom yonida, «Siz a'zosiz» chip yo'q
5. ⬜ Katalog sarlavha/tavsif matni qisqartirildi
6. ⬜ Join/Follow tugmalari bir uslub (`Button outline` faol holatda), JoinButton «owner» tarmog'i olib tashlandi (dublikat «Sozlash»)
7. ⬜ Chat ichida kam chegara: fayl chiplari, pufakchalar, kompozitor
8. ⬜ Chat sarlavhasidagi «Faqat a'zolar ko'radi» olib tashlandi
9. ⬜ Hero amallar qatori: InviteLink faqat Sozlash sahifasida, TelegramShare olib tashlandi (ShareButton bor)
10. ⬜ AboutCard: «Egasi» alohida karta → bitta qator; «Turi» qatori (chip bilan dublikat) olib tashlandi
11. ⬜ Katalog filtr qatori: ajratgich chiziq va «Barcha yo'nalishlar» chipi (faol bo'lmaganda) olib tashlandi
12. ⬜ Bo'lim sarlavhasi: coral ikonka → kulrang, hint qisqartirildi
13. ⬜ EmptyState matnlari qisqartirildi
14. ⬜ GroupForm «Yopiq» va «Rasmiy» qatorlari: chegara+fon → hairline qator, matn qisqa
15. ⬜ GroupForm muqova matni «Muqova rasmi (3:1)»
16. ⬜ JoinButton xatosi inline span o'rniga toast
17. ⬜ Mute + efir eslatmasi bitta menyuda
18. ⬜ Sozlash sahifasida taklif matni qisqartirildi
19. ⬜ RoleChip coral → kulrang
20. ⬜ «Qo'shilgan: 3 kun oldin» → «3 kun oldin»
21. ⬜ Xabar yonidagi 2 ta hover ikonka → bitta «⋯» menyu
22. ⬜ Katalog asosiy tugma «Guruh yoki kanal ochish» → «Yangi jamoa»
23. ⬜ OfficialCover ichidagi «Rasmiy kanal» yozuvi olib tashlandi (nom yonida ✓ bor)
24. ⬜ LockedNotice matni bir jumlaga
25. ⬜ Yangi jamoa sahifasi tavsifi qisqartirildi
26. ⬜ Chat skeleton 3 → 2 qator, sarlavha matni «Chat · N»

## Tekshiruv
(to'ldiriladi)

## Boshqa sohalarga so'rovlar
(to'ldiriladi)

## Qoldirilgan / xavf
(to'ldiriladi)
