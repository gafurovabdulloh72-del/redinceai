#!/usr/bin/env sh
# Production start (Railway): baza sxemasini yangilash → bo'sh bo'lsa seed → Next.js
set -e

: "${DATABASE_URL:=file:./data/redince.db}"
export DATABASE_URL

# file: URL bo'lsa papkani yaratamiz (Railway Volume: /data)
case "$DATABASE_URL" in
  file:*)
    DB_PATH="${DATABASE_URL#file:}"
    mkdir -p "$(dirname "$DB_PATH")"
    ;;
esac
[ -n "$UPLOAD_DIR" ] && mkdir -p "$UPLOAD_DIR"

node scripts/db-prepare.mjs

echo "→ Next.js ishga tushmoqda (port ${PORT:-3000})"
exec npx next start -p "${PORT:-3000}" -H 0.0.0.0
