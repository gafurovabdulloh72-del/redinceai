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

echo "→ Sxema sinxronlanmoqda ($DATABASE_URL)"
npx drizzle-kit push --force

if [ "${SEED_ON_START:-1}" = "1" ]; then
  echo "→ Seed (faqat baza bo'sh bo'lsa)"
  npx tsx src/lib/db/seed.ts --if-empty
fi

echo "→ Next.js ishga tushmoqda (port ${PORT:-3000})"
exec npx next start -p "${PORT:-3000}" -H 0.0.0.0
