#!/bin/bash
cd /tmp/claude-0/-home-user-redinceai/77cf9a75-26bd-5b69-afa7-330aecac2f47/scratchpad
while pgrep -f "render3.mjs" >/dev/null; do sleep 10; done
export P=x
first=1
while IFS='|' read -r k th btn url; do
  [ -z "$k" ] && continue
  [ -f sty/x-$k.mp4 ] || { echo "YO'Q $k"; continue; }
  [ $first = 1 ] || sleep 360; first=0
  sty/post4.sh "$k" "$th" "$btn" "$url" < /dev/null
done <<'L'
A2|3.8|🗺 Xarita|/xarita
C2|4.6|🖼 Portfolio|/kabinet/portfolio
D2|10.6|🔐 Kontaktlar|/kabinet/kontaktlar
B2|3.6|🔎 Qidiruv|/qidiruv
A3|3.8|💼 Vakansiyalar|/vakansiyalar
C3|4.6|📱 Saytni ochish|/
D3|10.6|🎓 Mentorlik|/mentorlik
L
echo ALLPOSTED
