# Instagram Reels joylash (@kasb.egalari)

Token: Meta Business portfolio "Kasb egalari" → System users → `kasb-reels-bot` (muddatsiz).
Token sessiya muhitining tarmoq siri sifatida saqlangan (graph.facebook.com va rupload.facebook.com) —
kodda ham, git'da ham YO'Q, proksi so'rovga o'zi qo'shadi.

- `igpost.py video.mp4 caption.txt thumb_ms` — bitta Reels: konteyner (upload_type=resumable) → rupload → status FINISHED → media_publish.
- `igbatch.py [interval_s] [max_minutes]` — NEON videolar, keyin 9:16 yo'riqnomalar va motion-videolar navbatma-navbat; natija `igposted.json`, jurnal `iglog.txt`.
- Izohlar Telegram'dan moslanadi: HTML olib tashlanadi, "@bot" o'rniga "Havola profilda", xeshteglar qo'shiladi.
- Limit: Meta 24 soatda 100 ta post. Rasm postlari uchun ommaviy image_url kerak — shuning uchun rasm kartalarining motion (video) variantlari ishlatiladi.
