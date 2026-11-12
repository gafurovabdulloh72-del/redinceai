#!/bin/bash
# 10 ta videoni kanalga jim joylaydi (muqova: hisoblagich kadri)
cd /tmp/claude-0/-home-user-redinceai/77cf9a75-26bd-5b69-afa7-330aecac2f47/scratchpad
S=https://kasbegalari.vercel.app
while IFS='|' read -r k btn url; do
  [ -z "$k" ] && continue
  ffmpeg -y -loglevel error -ss 5.25 -i neon/nv-$k.mp4 -frames:v 1 -q:v 3 nv/cov-$k.jpg
  echo -n "$k: "; python3 nv/postvid9x16.py neon/nv-$k.mp4 nv/cov-$k.jpg nv/caps/$k.txt "$btn" "$S$url" 18
  sleep 20
done <<'L'  # DIQQAT: ffmpeg -nostdin va python < /dev/null kerak (stdin yutiladi)
kasblar|🧭 Mutaxassislar|/mutaxassislar
mentorlik|🎓 Mentorlik|/mentorlik
top3|🏆 TOP reyting|/top
story|📱 Saytni ochish|/
portfolio|🖼 Portfolio|/kabinet/portfolio
qadamlar|✅ Kabinet|/kabinet
tayyorlik|📊 Profil|/kabinet/profil
royxat|🌐 Saytda ro'yxatdan o'tish|/auth/royxat
takliflar|💳 Narxlar|/narxlar
vakansiya|💼 Vakansiyalar|/vakansiyalar
L
