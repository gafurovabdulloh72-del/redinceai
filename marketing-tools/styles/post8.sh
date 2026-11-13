#!/bin/bash
cd /tmp/claude-0/-home-user-redinceai/77cf9a75-26bd-5b69-afa7-330aecac2f47/scratchpad
while pgrep -f "post7.sh" >/dev/null || pgrep -f "render3.mjs" >/dev/null; do sleep 15; done
export P=y
first=1
while IFS='|' read -r k th btn url; do
  [ -z "$k" ] && continue
  [ -f sty/y-$k.mp4 ] || { echo "YO'Q $k"; continue; }
  [ $first = 1 ] || sleep 360; first=0
  sty/post4.sh "$k" "$th" "$btn" "$url" < /dev/null
done <<'L'
A4|3.8|🧭 Kasblar|/mutaxassislar
D4|10.6|🔐 Xavfsizlik|/kabinet/xavfsizlik
C4|4.6|💎 Tariflar|/narxlar
B3|3.6|👤 Kabinet|/kabinet
A5|3.8|📱 Lenta|/
C5|4.6|💰 Profil|/kabinet/profil
D5|10.6|🔐 Xavfsizlik|/kabinet/xavfsizlik
L
echo ALLPOSTED
