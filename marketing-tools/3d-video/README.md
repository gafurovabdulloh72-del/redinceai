# 3D marketing videolari

Brauzerda (Three.js) ekransiz chiziladigan minimalist 3D sahna: retro kompyuter, jalyuzi soyalari, kasbga mos buyum, havoda suzuvchi so'zlar, oxirida bot va kanal kartasi. Ovoz `sfx.py` bilan sintez qilinadi (litsenziyasiz): SFX cho'qqisi -15 dBFS, fon -34 dBFS.

    npm install                       # three.js
    node render.mjs out.mp4 configs/cfg-p1-videograf-ustoz.json 720 1280 30
    python3 sfx.py a.wav 16 1         # numpy + scipy kerak
    ffmpeg -i out.mp4 -i a.wav -c:v copy -c:a aac -b:a 160k -shortest final.mp4

Sozlama (configs/*.json): `props` (tripodCamera, headphones, tablet, ringPhone, secondMonitor, photoKit), `screen` (mentor, qa, feed, contest, catalog, bot), `words`, `caps`, `shots`, `minimal`. Shrift `src/fonts/SpaceGrotesk-Bold.ttf` dan olinadi. Bir kadr ~0,3 s (720×1280), 16 soniyalik video ~2,5 daqiqa.
