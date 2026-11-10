#!/usr/bin/env bash
# Dev serverni toza qayta ishga tushirish (kamchilik #88).
# Nega kerak: `npm run build` dev server ishlab turganda .next'ni buzadi (MODULE_NOT_FOUND),
# yetim next jarayonlari portni band qilib qoladi. Bu skript ikkalasini ham hal qiladi.
# Ishlatish: bash scripts/restart-dev.sh   (log: /tmp/dev.log; boshqa port: PORT=3200 bash scripts/restart-dev.sh)
#
# DIQQAT (2026-11-10): faqat SHU PORTDAGI serverni to'xtatadi. Ilgari mashinadagi BARCHA next jarayonlari o'ldirilardi —
# parallel ishlayotgan boshqa nusxalar (git worktree, boshqa port) ham yiqilib qolardi.
set -e
cd "$(dirname "$0")/.."
PORT="${PORT:-3000}"

# Shu portni tinglayotgan jarayon(lar) va ularning `next dev` ota jarayoni
PIDS="$(ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true)"
for pid in $PIDS; do
  parent="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
  if [ -n "$parent" ] && ps -o args= -p "$parent" 2>/dev/null | grep -q "next"; then kill "$parent" 2>/dev/null || true; fi
  kill "$pid" 2>/dev/null || true
done
sleep 1
for pid in $PIDS; do kill -9 "$pid" 2>/dev/null || true; done

rm -rf .next
LOG="/tmp/dev${PORT:+-$PORT}.log"
[ "$PORT" = "3000" ] && LOG="/tmp/dev.log"
NODE_OPTIONS="--max-old-space-size=6144" nohup npx next dev -p "$PORT" > "$LOG" 2>&1 &
echo "Dev server ishga tushirildi (port $PORT, log: $LOG) — sog'liq: curl -s localhost:$PORT/api/health"
