/**
 * TUZOQ NAQSHLARI (2026-11-10) — SOF modul (hech narsa import qilmaydi): edge middleware HAM, Node (handler, trap route) HAM
 * shu yagona manbadan foydalanadi. Ilgari yo'llar ikki joyda (honeypot.ts ro'yxati + middleware regex) qo'lda
 * sinxronlanardi — endi bitta ro'yxat.
 *
 * 1) HONEYPOT_PATHS — hech bir haqiqiy mijoz/qidiruv boti so'ramaydigan yo'llar (prefiks bo'yicha).
 * 2) attackSignature() — URL'dagi aniq hujum imzolari (XSS, SQL-inyeksiya, fayl o'qish, RCE). Naqshlar ATAYLAB tor:
 *    o'zbekcha matn (apostroflar), oddiy qidiruv so'zlari, havolalar noto'g'ri tutilmasligi kerak.
 * 3) CANARY — soxta `.env`da beriladigan qiymatlar; ishlatilsa aniq hujum.
 *
 * DIQQAT: middleware matcher `/api/*` va kengaytmali statik fayllarni (.txt/.xml/.js/.css/.map/rasm) o'tkazib yuboradi —
 * shuning uchun API tomonda imzo tekshiruvi `handler()` ichida (`probeGuard`), tuzoq API yo'llari esa alohida route.
 */

/** Tuzoq yo'llari (prefiks: aniq moslik yoki `/…` davomi). Haqiqiy route'lar bilan to'qnashmasligi SHART. */
export const HONEYPOT_PATHS: readonly string[] = [
  // WordPress / PHP skanerlari
  "/wp-admin", "/wp-login.php", "/wp-content", "/wp-includes", "/wp-json", "/wp-config.php", "/xmlrpc.php", "/wordpress",
  "/phpmyadmin", "/pma", "/adminer.php", "/administrator", "/admin.php", "/login.php", "/phpinfo.php", "/info.php", "/test.php",
  "/config.php", "/configuration.php", "/shell.php", "/cmd.php", "/vendor/phpunit", "/cgi-bin",
  // Sirlar va konfiguratsiya
  "/.env", "/.env.local", "/.env.production", "/.env.development", "/.env.bak", "/.env.backup", "/.env.old", "/.env.save", "/.git", "/.svn", "/.hg", "/.aws", "/.ssh", "/.vscode", "/.npmrc", "/.htaccess", "/.htpasswd", "/.DS_Store", "/.dockerenv",
  "/web.config", "/sftp-config.json", "/credentials.json", "/docker-compose.yml", "/composer.json", "/id_rsa",
  // Zaxira nusxalar
  "/backup.sql", "/backup.zip", "/db.sql", "/dump.sql", "/database.sql", "/backup", "/backups", "/old-admin",
  // Server/servis panellari
  "/server-status", "/actuator", "/telescope", "/_profiler", "/solr", "/jenkins", "/manager/html", "/owa", "/autodiscover",
  "/graphql", "/swagger.json", "/swagger-ui", "/api-docs",
  // Canary: soxta «maxfiy admin» yo'li (faqat soxta .env'dan bilib olinadi)
  "/boshqaruv-7731",
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const HONEYPOT_RE = new RegExp(`^(?:${HONEYPOT_PATHS.map(esc).join("|")})(?:$|[/?])`, "i");

/** Yo'l tuzoqmi (oxirgi `/` e'tiborsiz) */
export function isHoneypotPath(pathname: string): boolean {
  return HONEYPOT_RE.test(pathname.replace(/\/+$/, "") || "/");
}

/* ------------------------------------------------------------------ */
/* CANARY (tuzoq) qiymatlari — soxta `.env`da; ishlatilsa 100% hujumchi */
/* ------------------------------------------------------------------ */
export const CANARY_TOKEN = "ke_live_sk_4Fq8Zx2Rn7Wv3Lm9Tb6Yc1Hd5Gj0Kp"; // soxta — hech qayerda haqiqiy emas
export const CANARY_ADMIN_PATH = "/boshqaruv-7731";
/** Soxta «admin» emaili: shu email bilan kirishga urinish = soxta .env'ni o'g'irlagan hujumchi */
export const CANARY_EMAIL = "sysadmin@kasbegalari.internal";
export const isCanaryToken = (s: string | null | undefined) => Boolean(s) && s === CANARY_TOKEN;
export const isCanaryEmail = (s: string | null | undefined) => Boolean(s) && s!.trim().toLowerCase() === CANARY_EMAIL;

/* ------------------------------------------------------------------ */
/* Hujum imzolari                                                      */
/* ------------------------------------------------------------------ */
export type ProbeSig = "xss" | "sqli" | "lfi" | "rce";

const SIGNATURES: Array<[ProbeSig, RegExp]> = [
  // XSS: skript tegi, hodisa atributi, javascript: + bajariladigan chaqiruv
  ["xss", /<\s*script\b|<\s*(?:img|svg|iframe|body|video|audio|details)\b[^>]*\bon[a-z]{3,}\s*=|\bon(?:error|load|mouseover|focus)\s*=\s*["'`]?\s*(?:alert|confirm|prompt|eval|fetch|document\.|window\.)|javascript:\s*(?:alert|confirm|prompt|eval|fetch|document\.|window\.)/i],
  // SQL-inyeksiya: UNION SELECT, ' OR 1=1, vaqtga asoslangan, sxema o'qish
  ["sqli", /\bunion(?:\s|\/\*.*?\*\/)+(?:all\s+)?select\b|'\s*(?:or|and)\s+['"]?\w+['"]?\s*=\s*['"]?\w+|\binformation_schema\b|\bsqlite_master\b|\b(?:pg_)?sleep\s*\(\s*\d+\s*\)|\bbenchmark\s*\(\s*\d+|\bwaitfor\s+delay\b|\bxp_cmdshell\b|;\s*drop\s+table\b/i],
  // Fayl o'qish / yo'l bo'ylab ko'tarilish
  ["lfi", /(?:\.\.[/\\]){2,}|\/etc\/(?:passwd|shadow)\b|\/proc\/self\/environ|\bboot\.ini\b|php:\/\/(?:input|filter)|file:\/\/\//i],
  // Buyruq bajarish / Log4Shell
  ["rce", /\$\{jndi:|[;|`]\s*(?:cat\s+\/|wget\s+http|curl\s+http|whoami\b|id\s*[;|`]|uname\s+-a)|\$\(\s*(?:whoami|id|cat\s)/i],
];

/**
 * URL bo'lagida (yo'l + query) hujum imzosi bormi. Ikki marta dekodlaydi (`%253Cscript` kabi qo'sh kodlash uchun),
 * 2000 belgidan ortig'ini ko'rmaydi (ReDoS/CPU chegarasi; naqshlarda ichma-ich cheksiz takror yo'q).
 */
export function attackSignature(urlPart: string): ProbeSig | null {
  if (!urlPart || urlPart.length < 6) return null;
  let s = urlPart.slice(0, 2000);
  for (let i = 0; i < 2; i++) {
    try {
      const d = decodeURIComponent(s.replace(/\+/g, " "));
      if (d === s) break;
      s = d;
    } catch {
      break; // buzuq %-kodlash — borini tekshiramiz
    }
  }
  for (const [sig, re] of SIGNATURES) if (re.test(s)) return sig;
  return null;
}
