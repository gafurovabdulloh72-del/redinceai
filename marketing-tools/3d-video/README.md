# 3D marketing videolari

Brauzerda (Three.js) ekransiz chiziladigan minimalist 3D sahnalar. Ovoz kodda sintez qilinadi (litsenziyasiz).

## v3 (amaldagi) — `scene3.html` + `render3.mjs`

Studiya muhitlari (cyclorama fon, PBR yorug'lik, bokeh, bloom, plyonka donasi, SMAA):
`E1` ko'mir · `E2` tungi iliq · `E3` krem · `E5` grafit · `E6` oq. Faqat brend ranglari (ink, krem, marjon).

Buyumlar (`props`): `table`, `plinth`, `phone` (ekran kadrlari `frames: [{t, src}]`), `tripod`, `cinemaCamera`,
`mirrorless`, `ringLight`, `monitor`, `jog`, `headphones`, `mic`, `tablet`, `notebook`, `clay`, `curve`, `drone`,
`keyboard`, `map` (viloyat slug + `pinAt`, `regions.json` dan). Oxirida 3D «k» logotipi va CTA kartasi.

    npm install                                             # three.js
    node ui.mjs screens.json ui-out                         # telefon ekranlari (780x1688 PNG)
    node render3.mjs cfg.json out.mp4 1080 1920 30          # ~2,5 s/kadr (CPU, SwiftShader)
    ONLY=0,3.5,13 node render3.mjs cfg.json t.mp4           # faqat shu soniyalar (tez tekshiruv)
    python3 sfx2.py a.wav ev.json 7                          # ev: {dur, cuts, caps_in, words_in, ui}
    ffmpeg -i out.mp4 -i a.wav -c:v copy -c:a aac -b:a 160k -ar 48000 -shortest final.mp4

Ovoz: true-peak -15,5 dBTP, ~-25 LUFS (baland emas). Shrift `src/fonts` dan (`FONT_DIR` bilan almashtiriladi).

`ui.mjs` turlari: chat, checklist, map, list, reels, topics, form, resume, stats, card, qa.
Qoida: ekranlarda ism, reyting, ko'rish soni YO'Q — faqat UI yorliqlari va skeletlar (soxta raqam chiqmasin).

## Nashr — `publish2.py`

    python3 publish2.py lint posts.json                     # taqiqlangan iboralar, uzunlik, dumi, tugma URL
    python3 publish2.py upload posts.json                   # final-<id>.mp4 + cover-<id>.jpg egasiga jim → ids-v3.json
    python3 publish2.py send posts.json <id> owner|channel  # muqova + 2 tugma, jim rejim, so'rovnoma/quiz

Token faqat muhit o'zgaruvchisida (`MARKETING_BOT_TOKEN`, `MARKETING_CHANNEL`) — faylga yozilmaydi.

## v1 (tarixiy) — `scene2.html` + `render.mjs` + `sfx.py`

Retro kompyuter sahnasi, 2026-11-09 dagi 6 video shunda chizilgan.
