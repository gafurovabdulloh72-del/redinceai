#!/bin/bash
D=/tmp/claude-0/-home-user-redinceai/77cf9a75-26bd-5b69-afa7-330aecac2f47/scratchpad/sty
( cd $D; for k in A4 B3 C5 D5; do node render3.mjs cfg-$k.json y-$k.mp4 > log-y-$k.txt 2>&1; echo "R $k $?"; done ) &
( cd $D; for k in A5 C4 D4; do node render3.mjs cfg-$k.json y-$k.mp4 > log-y-$k.txt 2>&1; echo "R $k $?"; done ) &
wait
echo RENDERED
