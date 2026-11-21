# Kanallardan vakansiya (ochiq Telegram kanallari)

Ochiq Telegram kanallaridagi vakansiyalar avtomatik saytning **Vakansiyalar** bo'limiga chiqadi.
Matn o'zgarmaydi; har e'londa «Manba: Kanal nomi» va asl postga havola turadi; «Murojaat» — asl post.

## Qanday ishlaydi
1. Har 15 daqiqada `https://t.me/s/<kanal>` sahifasi o'qiladi (oxirgi ~20 post). Faqat **ochiq** kanallar.
2. Post saralanadi — Vercel'da `ANTHROPIC_API_KEY` bo'lsa **Claude** (model `ANTHROPIC_MODEL`, standart claude-opus-5-5, effort low), bo'lmasa yoki javob kelmasa MATN qoidalari: ish beruvchining vakansiyasimi, lavozim, kasb (lavozim nomidagi rol so'zi: «Sotuv operatori» → sotuv, «Video operator» → video), format, hudud, maosh.
   Kalit bo'lmasa — kalit so'zlar bo'yicha (aniqligi pastroq). Rezyume, kurs/xizmat reklamasi o'tkazib yuboriladi.
3. Mos bo'lsa — manba rejimiga qarab: **Darhol** joylanadi yoki **Tasdiq bilan** admin navbatiga tushadi.
4. Bir xil matn boshqa kanaldan kelsa — takror deb tashlanadi. Vakansiya 30 kundan keyin yopiladi.
5. Saytda bu e'longa ariza yuborilmaydi (egasi saytda yo'q) — «Asl e'lonni ochish».

## Sozlash (bir marta)
- **Admin → Kontent → «Kanallardan vakansiya»**: kanallarni yozing (har qatorga `@kanal` yoki `t.me/kanal`), rejimni tanlang.
  Har kanalda kasblar filtri (standart: Dizayn, Video, Marketing, Kontent), yoqish/o'chirish, «Hozir tekshirish».
- **GitHub → Settings → Secrets → Actions**: `PROD_URL` = `https://kasbegalari.vercel.app`, `CRON_SECRET` = Vercel'dagi bilan bir xil.
  Shundan keyin `.github/workflows/vacancy-import.yml` har 15 daqiqada ishlaydi.
  Sirlar bo'lmasa ham ishlaydi, lekin sekinroq: vakansiyalar sahifasi ochilganda (15 daqiqada ko'pi bilan bir marta) va kunlik cron'da.
- Ixtiyoriy: `ANTHROPIC_API_KEY` (console.anthropic.com → API keys) — saralashni Claude qiladi. Kalit chatga yozilmaydi, faqat Vercel → Environment Variables.

## Kanal egasi so'rasa
Kanal qatoridagi 🗑 → «Vakansiyalari bilan o'chirish» — kanal va undan olingan barcha vakansiyalar o'chadi.

## Texnik
`src/lib/vacancies/telegram-channel.ts` (sahifa tahlilchisi — Telegram tuzilishi o'zgarsa shu yer),
`src/lib/vacancies/import.ts` (saralash, joylash, admin amallari), `GET|POST /api/cron/vakansiya-import` (Bearer CRON_SECRET),
`/api/admin/vakansiya-manbalari`, jadvallar `vacancy_sources`, `vacancy_imports`, `vacancies.source_*`.
