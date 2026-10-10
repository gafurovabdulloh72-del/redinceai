/** Tailwind klasslarini qo'shish uchun engil yordamchi (clsx o'rnini bosadi) */
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatPrice(amount: number | null | undefined, opts: { compact?: boolean } = {}) {
  if (amount == null) return "—";
  if (opts.compact) {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)} mln so'm`;
    if (amount >= 1_000) return `${Math.round(amount / 1_000)} ming so'm`;
  }
  return `${new Intl.NumberFormat("uz-UZ").format(amount)} so'm`;
}

export function formatPriceRange(from: number, to?: number | null) {
  if (!from && !to) return "Kelishiladi";
  if (to && to > from) return `${formatPrice(from, { compact: true })} – ${formatPrice(to, { compact: true })}`;
  return `${formatPrice(from, { compact: true })} dan`;
}

const TRANSLIT: Record<string, string> = {
  "o'": "o", "g'": "g", "oʻ": "o", "gʻ": "g", "o‘": "o", "g‘": "g", "ʼ": "", "'": "", "’": "",
  sh: "sh", ch: "ch", ng: "ng",
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh",
  ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

export function slugify(input: string) {
  let s = input.toLowerCase().trim();
  for (const [from, to] of Object.entries(TRANSLIT)) s = s.split(from).join(to);
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function timeAgo(date: Date | number | string) {
  const d = typeof date === "object" ? date.getTime() : new Date(date).getTime();
  const diff = Math.max(0, Date.now() - d);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "hozirgina";
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} soat oldin`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} kun oldin`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} oy oldin`;
  return `${Math.floor(months / 12)} yil oldin`;
}

export function formatDate(date: Date | number | string) {
  const d = typeof date === "object" ? date : new Date(date);
  return new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

/** YouTube havolasidan video ID ajratib olish */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|v)\/([\w-]+)/);
      if (m) return m[2];
    }
  } catch {
    /* noop */
  }
  return null;
}

/** Deterministik rang (avatar fonlari uchun) */
export function hashHue(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function uid() {
  return crypto.randomUUID();
}
