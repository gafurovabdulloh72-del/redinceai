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
PIDFILE="/tmp/dev-$PORT.pid"

# To'xtatiladigan jarayonlar: (1) oldingi ishga tushirishda yozilgan PID, (2) aynan shu port bilan ishga tushirilgan `next dev`
PIDS=""
[ -f "$PIDFILE" ] && PIDS="$(cat "$PIDFILE" 2>/dev/null || true)"
PIDS="$PIDS $(pgrep -f "next dev -p $PORT( |\$)" 2>/dev/null || true)"
ALL=""
for pid in $PIDS; do
  [ -n "$pid" ] || continue
  ALL="$ALL $pid $(pgrep -P "$pid" 2>/dev/null || true)"   # bolasi — next-server
done
for pid in $ALL; do kill "$pid" 2>/dev/null || true; done
sleep 1
for pid in $ALL; do kill -9 "$pid" 2>/dev/null || true; done

rm -rf .next
LOG="/tmp/dev-$PORT.log"
[ "$PORT" = "3000" ] && LOG="/tmp/dev.log"
NODE_OPTIONS="--max-old-space-size=${DEV_HEAP_MB:-3072}" nohup node node_modules/next/dist/bin/next dev -p "$PORT" > "$LOG" 2>&1 &
echo $! > "$PIDFILE"
echo "Dev server ishga tushirildi (port $PORT, pid $(cat "$PIDFILE"), log: $LOG) — sog'liq: curl -s localhost:$PORT/api/health"
