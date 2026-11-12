#!/bin/bash
# cmp.sh t1 t2 ... -> cmp3.jpg (yuqori: namuna, past: bizniki)
cd /tmp/claude-0/-home-user-redinceai/77cf9a75-26bd-5b69-afa7-330aecac2f47/scratchpad/neon
F="/root/.claude/uploads/77cf9a75-26bd-5b69-afa7-330aecac2f47/57e628e9-Screen_Recording_2026-11-12_at_16.10.06_1.mov"
HTML=neon3.html node prev.mjs "$@" >/dev/null
A=""; B=""; i=0; FA=""; 
for t in "$@"; do ffmpeg -y -loglevel error -ss $t -i "$F" -frames:v 1 -vf "crop=1156:2055:0:70,scale=240:427" rf-$t.jpg; ffmpeg -y -loglevel error -i pv-$t.jpg -vf scale=240:427 mf-$t.jpg; A="$A -i rf-$t.jpg"; B="$B -i mf-$t.jpg"; i=$((i+1)); done
ffmpeg -y -loglevel error $A -filter_complex "hstack=$i" top.jpg; ffmpeg -y -loglevel error $B -filter_complex "hstack=$i" bot.jpg; ffmpeg -y -loglevel error -i top.jpg -i bot.jpg -filter_complex vstack cmp3.jpg
