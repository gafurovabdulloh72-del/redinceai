# Kasb Egalari — o'z serverda (VPS) ishga tushirish uchun obraz.
# Ishonchli yo'l: Railway'da sinalgan scripts/start.sh (db-prepare → next start) ishlatiladi.
# Ma'lumotlar /data hajmida (volume): SQLite baza + yuklangan fayllar.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build paytida vaqtinchalik bo'sh baza (ba'zi sahifalar prerender'da bazaga qarashi mumkin)
RUN DATABASE_URL=file:/tmp/build.db SEED_ON_START=0 node scripts/db-prepare.mjs && npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=file:/data/redince.db UPLOAD_DIR=/data/uploads
COPY --from=build /app ./
# start.sh: /data papkalarini yaratadi → sxema sinxron → (bo'sh bo'lsa) seed → next start
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]
