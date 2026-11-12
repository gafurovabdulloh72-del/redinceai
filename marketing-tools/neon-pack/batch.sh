#!/bin/bash
cd /tmp/claude-0/-home-user-redinceai/77cf9a75-26bd-5b69-afa7-330aecac2f47/scratchpad/neon
q(){ for k in "$@"; do node render2.mjs cfg-$k.json nv-$k.mp4 >> batch.log 2>&1 || echo "FAIL $k" >> batch.log; done; }
q kasblar mentorlik top3 story portfolio &
q qadamlar tayyorlik royxat takliflar vakansiya &
wait; echo ALLDONE >> batch.log
