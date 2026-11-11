#!/bin/bash
# compose.sh name  -> final-name.mp4
cd $(dirname "$0")
n=$1
node compstudio4.mjs fl-$n cf-$n.json v-$n.mp4 > clog-$n.txt 2>&1 && INTRO=2.4 python3 finfull.py $n fl-$n >> clog-$n.txt 2>&1 && ffmpeg -y -loglevel error -i cfx-v-$n/00030.jpg -vf scale=1280:-1 -q:v 3 cover-$n.jpg && echo "DONE $n" >> clog-$n.txt
rm -rf cfx-v-$n
