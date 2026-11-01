#!/usr/bin/env bash
# Dev serverni toza qayta ishga tushirish (kamchilik #88).
# Nega kerak: `npm run build` dev server ishlab turganda .next'ni buzadi (MODULE_NOT_FOUND),
# yetim next jarayonlari 3000-portni band qilib qoladi. Bu skript ikkalasini ham hal qiladi.
# Ishlatish: bash scripts/restart-dev.sh   (log: /tmp/dev.log)
set -e
cd "$(dirname "$0")/.."

# Yetim next/node jarayonlarini to'xtatamiz (buyruq matnida naqsh yozilmaydi — o'zini o'ldirmasin)
PAT="next"
PAT="$PAT-server"
pkill -f "$PAT" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 1

rm -rf .next
NODE_OPTIONS="--max-old-space-size=6144" nohup npm run dev > /tmp/dev.log 2>&1 &
echo "Dev server ishga tushirildi (log: /tmp/dev.log) — sog'liq: curl -s localhost:3000/api/health"
