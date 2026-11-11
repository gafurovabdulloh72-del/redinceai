# Yo'riqnoma videolari (Screen Studio uslubi)

Saytning haqiqiy kodi lokal prod build'da ishga tushiriladi (`npm start`), Playwright harakatlarni
kadrma-kadr yozadi, keyin kompozitor brauzer oynasi, kursor, kamera yaqinlashuvi va pastki yozuvni qo'shadi.

    node flow2.mjs t-portfolio.json fl-portfolio     # 1280x720 @1.5x, 30 fps, marks.json (tap/focus/caps/urls)
    node compstudio4.mjs fl-portfolio cf-portfolio.json v.mp4
    INTRO=2.4 python3 finfull.py portfolio fl-portfolio   # ovoz (-15,5 dBTP) + mux -> final-portfolio.mp4
    python3 postvid.py video.mp4 cover.jpg cap.txt "Tugma" "https://..." 30   # kanalga (token muhitdan)

Qoida: har video bosh sahifadan boshlanadi va bo'limga qanday kirilishini ko'rsatadi; namuna hisob «Ijodkor»
(soxta odam yo'q); tozalash faqat saytning o'z DELETE API'lari orqali.

## 2026-11-11 qo'shimchalari

- `flow2.mjs`: `zoom` (har `focus`/`type` uchun alohida yaqinlashtirish), `saver: true` (fon videolari o'ynamaydi),
  `tgNudge: true` (Telegram eslatmasi ko'rinadi, aks holda yashiriladi), `key` qadami (masalan Escape),
  lokal manzil `127.0.0.1:3000` kadrda `kasbegalari.vercel.app` bo'lib chiqadi.
- `studio4.html`: kamera nuqta bo'yicha zoom'ni silliq almashtiradi. Oyna (dialog) ochilganda unga alohida
  past zoom (1.25–1.6) bering, ichidagi mayda bandlarga 2.2–2.6: aks holda oyna chetda kichik qoladi.
- `compose.sh name`: compstudio4 + ovoz + muqova. `sheet.py fl-dir out.jpg`: tezkor kadr varag'i.
- Nashr: `postvid.py` (jim), `editvid.py <msg_id> ...` (videoni almashtirish), `postphoto.py`, `sendtext.py send|<msg_id>`.
- Tekshiruv qoidasi: joylashdan oldin `final-*.mp4` dan har oyna/zoom bosqichida to'liq o'lchamli kadr ko'ring.
