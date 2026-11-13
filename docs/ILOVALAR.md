# Kasb Egalari ilovalari (Android + kompyuter)

Hamma ilovalar saytning o'zini ochadi: hisob, chat, to'lov, kurslar bir xil. Saytga yangilik qo'shilsa,
ilovalarda ham darhol paydo bo'ladi — ilovani qayta yig'ish shart emas.

| Ilova | Papka | Natija |
|---|---|---|
| Android (TWA) | `apps/android` | `.aab` — Google Play, `.apk` — to'g'ridan-to'g'ri o'rnatish |
| Windows | `apps/desktop` | `KasbEgalari-Setup-<v>-x64.exe` (+ arm64) |
| macOS | `apps/desktop` | `KasbEgalari-<v>-mac.dmg` (Intel + Apple Silicon) |
| Linux | `apps/desktop` | `.AppImage`, `.deb` |

Yig'ish — GitHub Actions: `.github/workflows/apps.yml`.
- `apps/**` o'zgarsa — tekshiruv yig'ishi (Actions → «Ilovalar» → Artifacts, 14 kun).
- **Release**: Actions → «Ilovalar» → *Run workflow* → versiya (masalan `1.0.1`) — yoki `app-v1.0.1` tegi.
  Fayllar repo'ning Releases bo'limiga yuklanadi.

## Android

1. **Imzo kaliti (bir marta).** GitHub → Settings → Secrets and variables → Actions:
   - `ANDROID_KEYSTORE_B64` — `.jks` faylning base64 matni
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`kasbegalari`)
   Kalitni YO'QOTMANG (zaxira nusxa saqlang). Sirsiz faqat sinov (debug) APK yig'iladi.
2. **Sayt tasdig'i.** Vercel env `ANDROID_CERT_SHA256` = kalitning SHA-256 barmoq izi. Google Play «App signing»
   yoqilgach Play Console → Test and release → App integrity → «App signing key certificate» SHA-256'ni ham
   vergul bilan qo'shing. Tekshirish: `https://<sayt>/.well-known/assetlinks.json`. Bu bo'lmasa ilova ishlaydi,
   lekin tepada manzil paneli ko'rinadi.
3. **Google Play.** play.google.com/console ($25, bir martalik) → yangi ilova → `.aab` yuklash. Yangi shaxsiy
   hisoblarda avval yopiq test: 12 tester × 14 kun, keyin «Production».
4. Domen o'zgarsa: `apps/android/gradle.properties` → `twaHost`, Vercel `ANDROID_CERT_SHA256` o'z joyida qoladi.

Paket nomi: `uz.kasbegalari.app` (o'zgartirilmaydi — Play'da yangi ilova bo'lib qoladi).

## Kompyuter (Electron)

- Sayt manzili: `apps/desktop/config.json` → `siteUrl` (domen o'zgarsa shu yerda; eski domen `extraHosts`ga).
- **Google bilan kirish**: Google ichki oynada kirishni taqiqlaydi, shuning uchun ilova tizim brauzerini ochadi
  (`/ilova/ulash`), foydalanuvchi u yerda kiradi va «Ilovaga qaytish» bosadi → `kasbegalari://auth?code=…` →
  ilova kodni o'zidagi PKCE verifier bilan sessiyaga almashtiradi (`/api/auth/ilova/kirish`; faqat ilova UA'si
  `KasbEgalariDesktop/`, kod 2 daqiqa, bir martalik). Email/parol va «Telegram bilan kirish» ilovaning o'zida.
- Imzo: hozir imzosiz. Windows — birinchi ishga tushishda SmartScreen «More info → Run anyway». macOS — ad-hoc
  imzo: birinchi marta o'ng tugma → «Open» (yoki System Settings → Privacy & Security → «Open Anyway»).
  Ogohlantirishsiz bo'lishi uchun: macOS — Apple Developer ($99/yil) sirlari `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`,
  `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`; Windows — kod imzolash sertifikati.
- Lokal: `cd apps/desktop && npm ci && npm start` (boshqa sayt: `KASB_SITE_URL=http://localhost:3000 npm start`),
  testlar `npm test`, yig'ish `npx electron-builder --linux AppImage`.
- Ikonkalar: `node apps/scripts/gen-app-icons.mjs` (`src/app/icon.svg` bilan bir xil belgi).
