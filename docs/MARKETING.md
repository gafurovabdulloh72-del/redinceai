# Marketing rejasi — Kasb Egalari

Yuritadi: marketing agenti (`.claude/agents/marketing.md`). Oxirgi yangilanish: 2026-11-04.
QOIDA: bu faylga faqat HAQIQIY raqamlar yoziladi. Noma'lum — «?».

## 1. Maqsad (birinchi 30 kun: 2026-11-04 → 2026-12-04)
**Asosiy: 100 ta faol ijodkor** (ro'yxatdan o'tgan + profili ≥70% to'lgan + ≥3 portfolio).
Sabab: bo'sh katalogga kirgan mijoz qaytmaydi; ijodkor ko'p bo'lsa mijoz ortidan keladi.

| Ko'rsatkich | Hozir | 30 kun maqsadi |
|---|---|---|
| Ro'yxatdan o'tgan ijodkor | ? | 100 |
| Profili to'lgan (≥70%) | ? | 60 |
| Haftalik faol foydalanuvchi | ? | 300 |
| Birinchi pullik kontakt sotuvi | ? | 5 |
| Google'da indekslangan sahifa | ? | 200+ |

**Raqamlarni egasi beradi** (admin panel → `/stat` yoki Telegram botda `/stat 30`). Shunsiz maqsadlar taxminiy.

## 2. Kanallar (ustuvorlik tartibida)
1. **Telegram** — O'zbekistonda asosiy kanal. Ijodkorlar guruhlari/kanallari, o'z kanalimiz, bot (`/elon`).
2. **Instagram** — ijodkorlar shu yerda portfolio qo'yadi; Reels/post, DM orqali shaxsiy taklif.
3. **SEO / blog** — `/blog` maqolalar + `/yonalish/<kasb>/<hudud>` landinglar (uzoq muddat, bepul trafik).
4. **Og'zaki tavsiya** — mavjud ijodkorlar → do'stlariga (referal kodlar tizimda bor).

## 3. Birinchi hafta (2026-11-04 → 11-10)
Agent tayyorlaydi → egasi bajaradi.

**Agent tayyorlaydi:**
- [ ] 7 ta Telegram/Instagram post (ijodkorlar uchun: «portfolio bir joyda», «mijoz sizni topadi»)
- [ ] 2 ta Reels ssenariysi (platformaning o'zini ko'rsatuvchi, 20–30 s)
- [ ] 2 ta blog maqola (mavzular: «Videograf narxlari O'zbekistonda 2026», «Portfolio qanday tuziladi»)
- [ ] Ijodkorlarni topish ro'yxati shabloni va DM xabarlari (3 variant)
- [ ] Raqobatchilar tahlili (Telegram kanallar, freelance saytlar)

**Egasi (siz) qiladi:**
- [ ] Admin paneldan haqiqiy raqamlarni olib, 1-bo'limdagi «Hozir» ustuniga yozish (yoki agentga aytish)
- [ ] Google Search Console'da saytni tasdiqlash (`GOOGLE_SITE_VERIFICATION`) va sitemap yuborish — `docs/DEPLOY.md` 12-bo'lim
- [ ] Rasmiy Instagram va Telegram kanal ochish (yoki mavjudini aytish)
- [ ] Tayyor postlarni joylash; kuniga 10–15 ta ijodkorga shaxsiy DM yuborish (agent shablon beradi)
- [ ] Har kuni kechqurun: nechta yangi ro'yxatdan o'tdi — shu faylning «Natijalar jurnali»ga yozish

## 4. Xabar (positioning)
- **Ijodkorga**: «Ishlaringizni ko'rsating — mijozlar o'zi topsin. Bepul profil, portfolio, reels, mijozlar chatda yozadi.»
- **Mijozga**: «O'zbekistondagi videograf, montajchi, dizaynerlarni ishlari bo'yicha toping — narx, reyting, portfolio bir joyda.»
- Ohang: samimiy, oddiy, va'dalar faqat haqiqiy funksiyalar bo'yicha.

## 5. O'lchash
Har dushanba: yangi ijodkor soni, profil to'lish %, qaysi kanaldan kelgan (taklif havolasi/referal), nima ishladi → keyingi hafta rejasi.

## 6. Dasturchiga takliflar (agent yozadi, kod o'zgarishi kerak bo'lsa)
- 2026-11-10 TUZATILDI (547e73f): oylik TOP g'olibiga bildirishnoma «post va story cheklovlari yo'q» deb yolg'on va'da berardi — endi `TIER_LIMITS.pro` dagi haqiqiy limitlar yoziladi; obuna majburiy rejimda g'olib (`awardPremiumUntil`) katalogdan yashirinib qolardi — `listableCondition` endi uni Pro deb hisoblaydi.
- Efir yozuvi (Egress + R2) prod'da sinalmagan: kanal matnlarida «yozuvini keyin ko'rasiz» deb va'da qilinmaydi, sinalgandan keyin qaytariladi.

## 7. Natijalar jurnali
| Sana | Nima qilindi | Natija |
|---|---|---|
| 2026-11-04 | Agent va reja yaratildi | — |
| 2026-11-05 | Bot tekshirildi (@kasb_egalari_bot sayt boti, marketing boti — alohida), kanal @kasb_egalari ulandi; 1-kun «tanishtirish» posti chiqdi | message_id 5 |
| 2026-11-05 | «Savolingiz bormi? Kasbdoshlardan so'rang» (Maslahat bo'limi) rasmli posti chiqdi | message_id 6 |
| 2026-11-05 | Kunlik avtomatik jadval: 08:07/16:07 egasiga ko'rsatish, 10:07/18:07 kanalga (6–15-noyabr banki, rasmlar `docs/marketing/img/`) | — |
| 2026-11-06 | 10:07 — «Mijoz sizni 10 soniyada baholaydi» (rasmli post) | message_id 7 |
| 2026-11-06 | 12:37 — videograf uchun to'liq videopost (jadval bo'yicha avtomatik) | message_id 8 |
| 2026-11-06 | 12:4x — dizayner, videograf, mobilograf, montajor uchun umumiy videopost (egasi so'rovi bilan qo'lda) | message_id 9 |
| 2026-11-06 | Rejа qayta tuzildi: har kasb alohida, burchaklar xilma-xil (ustozlar, viloyat, vakansiya, jamoa, konkurs, Reels, bot); 13 ta yangi video (3 ta bugun, 10 ta 7–11-noyabr) | — |
| 2026-11-07…11-09 | 7–23 postlar (har kasb alohida, 3D videolar v1) | message_id 10–23 |
| 2026-11-10 | AUDIT (ultracode, ko'p agentli): chiqqan 34 post fakt/uslub bo'yicha tekshirildi. Topilgan yolg'on/noaniq da'volar: «bot uchta savol beradi» (aslida rol → ism → yo'nalish → kasb → tajriba → hudud → telefon → tasdiq), konkurs ↔ oylik TOP Pro mukofoti (aslida mukofot faqat TOP-3 da, ≥20 ball), «efir yozuvi» (prod'da sinalmagan), «Instagram'da hudud bo'yicha qidirib bo'lmaydi», «10 soniyada», «minglab», sharhlar (faqat platforma buyurtmasidan keyin), «Bepul profil 1 daqiqada» (katalogda ko'rinish obuna majburiy bo'lsa 30 kun bepul) | `scratchpad/audit/` |
| 2026-11-10 | Tuzatish (bajarildi, 18/18 ok): eski 18 post izohi `editMessageCaption` bilan, 11-09 dagi 6 videoning o'zi (`editMessageMedia`) qayta chizildi — yakuniy karta «Ro'yxatdan o'tish bepul», bot ekrani haqiqiy oqim, konkurs ekranida «G'olib belgisi»; hamma postga 2 ta inline tugma (Ro'yxatdan o'tish + mavzuga mos sahifa) | — |
| 2026-11-10 | Yangi tizim: 3D v3 dvigateli (`marketing-tools/3d-video`: studiya muhitlari, 18 buyum, viloyat xaritasi, soxta raqamsiz UI ekranlar, -15,5 dBTP ovoz), matn qoidalari (taqiqlangan iboralar ro'yxati + `publish2.py lint`), muqova + tugmalar + jim ertalabki slot. Jadval: 08:07 ko'rsatish → 10:07 kanal (jim), 18:07 ko'rsatish → 20:07 kanal | trigger v2 |
| 2026-11-10 | 20:07 — «Kasb Egalari kanaliga xush kelibsiz» (rejalashtirilgan: qadaladi + kanal tavsifi) | — |
| 2026-11-11 | Jadval kuniga 4 post: 08:00 · 13:30 · 17:00 · 21:00; ertangi 4 tasi 21:30 da egaga bitta to'plamda («to'xta» / «to'xta N»). Rasm = saytning haqiqiy ekrani telefon maketida (lokal prod build, `still.py`/`flow.mjs`/`comp.mjs`), matnlar humanizer + stop-slop, faktlar koddan. Bank 11-11…11-17 (25 post): `docs/marketing/bank-*.json`, `jadval-2026-11.json` | 2 trigger |
