# Instagram: yangi kreativ yo'nalish (2026-11-21)

## Raqamlar nima deydi (23 ta Reels, ko'rishlar profil to'ridan)

| Format | Misol | Ko'rish |
|---|---|---|
| Chizilgan qahramonlar + hayotiy voqea | To'y juftligi + nonvoy (30-okt) | **1 796** |
| Real odam + muammo voqeasi | «Kafe ochilishiga 3 kun» | 185 |
| Haqiqiy ekran yozuvi | «Endi esa ijodkorlar tarmog'i», chat, xarita | 133–181 |
| Uslub videolari (retro, telefon maketi) | D, B, C seriyalari | 90–125 |
| Katta raqam + matn | «11 ta yo'nalish», «94 xil», «24 soat» | **0–109** |

Xulosa:
1. Voqea va qahramon bor video raqam/funksiya videosidan 10–15 baravar ko'p ko'rilgan.
2. «Saytda nima bor» tipidagi funksiya videolari reklama bo'lib ko'rinadi, surib o'tkaziladi.
3. 13-noyabrda 14 ta video 6 daqiqa oraliq bilan chiqdi: Instagram ketma-ket ko'p postni kam tarqatadi. Kuniga 1 ta, kechqurun 19:00–21:00 (Toshkent).
4. API orqali yuklangan videoga Instagram kutubxonasidagi trend musiqa qo'shib bo'lmaydi. Eng muhim videolarni ilovadan trend ovoz bilan qo'yish yaxshiroq.

## Yangi qoidalar

- 1-soniyada ilgak: savol yoki muammo, qahramon yuzi bilan.
- 8–15 soniya, bitta g'oya.
- Sayt funksiyasi oxirida 1 qatorda, asosiy mavzu emas.
- Izoh so'rash: caption oxirida savol («Sizga yana kim kerak bo'ldi?»), faqat «+» emas.
- Soxta raqam, soxta sharh yo'q; ijodkor ishlari faqat ruxsat bilan.

## Seriyalar va ssenariylar

### 1. «Kim kerak?» (eng ko'p ko'rilgan formatning davomi, mijoz tomoni)
Chizilgan qahramonlar, daftar varag'i foni. Asosiy mavzular: ta'lim, shaxsiy brend, restoran/kafe, biznes. To'y kam (oyiga ko'pi bilan 1 marta).
Kasb nomlari saytdagi haqiqiy kasblar ro'yxatidan (`src/lib/categories.ts`).
- Ta'lim: «Onlayn kurs ochmoqchisiz. Kim kerak?» → Videograf, Montajor, Prezentatsiya dizayner, Targetolog.
- Shaxsiy brend: «Shaxsiy brend. 0 obunachi. Kim kerak?» → Portret fotograf, Reels yaratuvchi, Logo dizayner, Kopirayter.
- Restoran: «Restoran ochilishiga 3 kun. Kim kerak?» → Ovqat (mahsulot) fotografi, Menyu (poligrafiya) dizayneri, Videograf, SMM menejer.
- Keyingilar: o'quv markazi reklamasi, repetitor o'z kanalini ochadi, onlayn do'kon, kafe menyusini yangilash, ekspert podkasti (Podkast muharriri, Ovoz rejissyori).
- Oxirgi kadr: «Hudud va kasb bo'yicha bitta saytda izlang».
Caption: «Sizga yana kim kerak bo'ldi? Izohda yozing.»
Birinchi kadrlar generatori: `styles/kim-kerak/frames.py`.

### 2. «Ochilishiga 3 kun» (185 ko'rishli formatning seriyasi)
Bir qahramon (restoran egasi yoki kurs muallifi), sanoq: 3 kun → logo yo'q, 2 kun → menyu yo'q, 1 kun → Instagram uchun video yo'q. Yechim: katalogda hudud va kasb bo'yicha qidiradi.

### 3. POV: ijodkor hayoti (ijodkor tomoni, hazil)
- «Mijoz: "kichkina o'zgarish"» → 47-tahrir.
- «Do'stim 50 mingga qilardi» → dizaynerning yuzi. Oxiri: «Saytda xizmat narxi kamida 200 000 so'm».
- «Mijoz: "birinchi variant yaxshi ekan"».

### 4. «15 soniyada ijodkor» (haqiqiy ijtimoiy isbot)
Saytdagi ijodkorning 3 ta ishi + ismi + shahri. Faqat ruxsat bilan.

### 5. «Qaysi biri yaxshi: A yoki B?» (izoh yig'adi)
Ikki logo, ikki rang tuzatish, ikki kadr. «Izohga A yoki B yozing».

## Ishlab chiqarish

- Qahramonlar: o'zimiz chizgan vektor qahramonlar (bepul, har videoda bir xil). Sinalgan: Gemini rasm (bepul limit 0), Higgsfield (kredit 0), Pollinations (xira, logo bilan) - yaramadi.
- Animatsiya va ovoz: mavjud render + psynth vositalari.
- Gemini bepul kalit: tayyor videoni tekshirish (montaj QC, ilgak kuchi).
