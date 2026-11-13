#!/bin/bash
# post4.sh KEY THUMB_S BTN URL  — bitta uslub videosini Telegram va Instagram'ga joylaydi
cd /tmp/claude-0/-home-user-redinceai/77cf9a75-26bd-5b69-afa7-330aecac2f47/scratchpad
k=$1; th=$2; btn=$3; url=$4
ffmpeg -nostdin -y -loglevel error -ss $th -i sty/s-$k.mp4 -frames:v 1 -q:v 3 sty/cov-$k.jpg
echo -n "TG $k: "; python3 nv/postvid9x16.py sty/s-$k.mp4 sty/cov-$k.jpg sty/tg-$k.txt "$btn" "https://kasbegalari.vercel.app$url" 12 < /dev/null
ffmpeg -nostdin -y -loglevel error -i sty/s-$k.mp4 -c:v copy -c:a aac -b:a 128k -ar 48000 -movflags +faststart sty/ig-$k.mp4
echo "IG $k:"; python3 ig/igpost.py sty/ig-$k.mp4 sty/cap-$k.txt $(python3 -c "print(int(float('$th')*1000))") < /dev/null | grep -E "publish|link|container|ERROR|error" 
