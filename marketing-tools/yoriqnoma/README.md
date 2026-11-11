# Yo'riqnoma videolari (Screen Studio uslubi)

Saytning haqiqiy kodi lokal prod build'da ishga tushiriladi (`npm start`), Playwright harakatlarni
kadrma-kadr yozadi, keyin kompozitor brauzer oynasi, kursor, kamera yaqinlashuvi va pastki yozuvni qo'shadi.

    node flow2.mjs t-portfolio.json fl-portfolio     # 1280x720 @1.5x, 30 fps, marks.json (tap/focus/caps/urls)
    node compstudio4.mjs fl-portfolio cf-portfolio.json v.mp4
    INTRO=2.4 python3 finfull.py portfolio fl-portfolio   # ovoz (-15,5 dBTP) + mux -> final-portfolio.mp4
    python3 postvid.py video.mp4 cover.jpg cap.txt "Tugma" "https://..." 30   # kanalga (token muhitdan)

Qoida: har video bosh sahifadan boshlanadi va bo'limga qanday kirilishini ko'rsatadi; namuna hisob «Ijodkor»
(soxta odam yo'q); tozalash faqat saytning o'z DELETE API'lari orqali.
