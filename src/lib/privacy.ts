/**
 * Maxfiylik dvigateli: mutaxassisning shaxsiy maydonlari kimga ko'rinishini hal qiladi
 * va server tomonda yashirin maydonlarni OLIB TASHLAYDI (UI'ga umuman yetib bormaydi).
 *
 * Bu modul ataylab "server-only" emas — sof funksiyalar (resolveVisibility, canView,
 * ish vaqti hisob-kitobi) kabinetdagi jonli ko'rinish (preview) uchun klientda ham ishlatiladi.
 * Baza bilan ishlaydigan qism (buyurtma borligini tekshirish) queries.ts'da.
 */
import { DEFAULT_VISIBILITY, PROFILE_HIRING, REGION_BY_SLUG, VISIBILITY_FIELDS, WEEKDAYS, type VisibilityFieldKey, type VisibilityLevelValue, type WeekdayKey } from "./constants";
import type { Schedule, ServicePackage, Visibility } from "./db/schema";

/* ------------------------------------------------------------------ */
/* Ko'rinish darajalari                                                */
/* ------------------------------------------------------------------ */
export type ResolvedVisibility = Record<VisibilityFieldKey, VisibilityLevelValue>;

/**
 * Platforma qoidasi: kontakt almashuvi faqat buyurtma orqali. Mutaxassisning telefon,
 * Telegram, Instagram va email'i buyurtma QABUL QILINGUNGA qadar mijozga ko'rinmaydi —
 * mutaxassis "hammaga ochiq" tanlagan bo'lsa ham. Shu maydonlar uchun public/clients
 * darajasi majburan "orders"ga tushiriladi (clamp); "hidden" o'z holicha qoladi.
 */
export const FORCED_ORDER_FIELDS: readonly VisibilityFieldKey[] = ["phone", "telegram", "instagram", "email"];

/** PROFILE_HIRING=false bo'lganda hech kimga (egasi/admindan tashqari) ko'rsatilmaydigan aloqa maydonlari (YouTube/veb-sayt portfolio havolasi — ular o'z darajasi bo'yicha) */
const HIDDEN_CONTACT_KEYS: readonly VisibilityFieldKey[] = ["phone", "telegram", "instagram", "email"];

/** Platforma polini qo'llaydi: aloqa maydonlarida public/clients → "orders" (jimgina, xatosiz) */
export function clampVisibilityLevel(key: VisibilityFieldKey, level: VisibilityLevelValue): VisibilityLevelValue {
  return FORCED_ORDER_FIELDS.includes(key) && (level === "public" || level === "clients") ? "orders" : level;
}

/** Bazadagi (qisman) sozlamani standart qiymatlar bilan to'ldiradi; noma'lum qiymatlar e'tiborsiz */
export function resolveVisibility(v: Visibility | null | undefined): ResolvedVisibility {
  const out: ResolvedVisibility = { ...DEFAULT_VISIBILITY };
  if (v && typeof v === "object") {
    for (const f of VISIBILITY_FIELDS) {
      const level = (v as Record<string, unknown>)[f.key];
      if (level === "public" || level === "clients" || level === "orders" || level === "hidden") out[f.key] = level;
    }
  }
  // Majburiy pol (FORCED_ORDER_FIELDS): bazada eski public/clients qiymat qolgan bo'lsa ham
  // barcha iste'molchilar (profil sahifa, API DTO, vcard, preview) shu yerda avtomatik qoplanadi.
  for (const key of FORCED_ORDER_FIELDS) out[key] = clampVisibilityLevel(key, out[key]);
  return out;
}

/** Sahifani ko'rayotgan shaxs */
export interface Viewer {
  userId: string | null;
  role?: "client" | "specialist" | "admin" | null;
  /** Profil egasi */
  isOwner?: boolean;
  /** Shu mutaxassis bilan qabul qilingan / jarayondagi / bajarilgan buyurtmasi bor */
  hasOrder?: boolean;
}

export const GUEST_VIEWER: Viewer = { userId: null };

/** Nega yopiq: tizimga kirish kerak yoki buyurtma qabul qilinishi kerak. `hidden` darajada marker berilmaydi. */
export type LockReason = "login" | "order";

export function canView(level: VisibilityLevelValue, viewer: Viewer): boolean {
  if (viewer.isOwner || viewer.role === "admin") return true;
  switch (level) {
    case "public":
      return true;
    case "clients":
      return Boolean(viewer.userId);
    case "orders":
      return Boolean(viewer.userId) && Boolean(viewer.hasOrder);
    default:
      return false;
  }
}

/** Ko'rinmasa — sababi (UI'da "Kirish" yoki "Buyurtma qabul qilingach" ko'rsatish uchun) */
export function lockReason(level: VisibilityLevelValue, viewer: Viewer): LockReason | null {
  if (canView(level, viewer)) return null;
  if (level === "clients") return "login";
  if (level === "orders") return viewer.userId ? "order" : "login";
  return null; // hidden — hech qanday iz qoldirmaymiz
}

export const LOCK_LABEL: Record<LockReason, string> = {
  login: "Faqat ro'yxatdan o'tganlarga ko'rinadi",
  order: "Buyurtma qabul qilingach ko'rinadi",
};

/* ------------------------------------------------------------------ */
/* Mutaxassisni ko'ruvchiga moslab filtrlash                           */
/* ------------------------------------------------------------------ */
export type Locked = Partial<Record<VisibilityFieldKey, LockReason>>;

interface SpecialistLike {
  id: string;
  regionSlug: string;
  city: string;
  telegram: string | null;
  instagram: string | null;
  youtube: string | null;
  website: string | null;
  schedule: Schedule | null;
  visibility: Visibility;
  /** Band kunlar (F41) — ish vaqti ko'rinishiga bog'liq */
  blockedDates?: string[];
  user: { phone?: string | null; email?: string | null; gender?: "male" | "female" | null };
}

export type FilteredSpecialist<T extends SpecialistLike> = Omit<T, "visibility" | "user"> & {
  user: Omit<T["user"], "phone" | "email" | "gender"> & { phone: string | null; email: string | null; gender: "male" | "female" | null };
  /** Qaysi maydonlar yopiq va nega (faqat qiymati BOR maydonlar uchun) */
  locked: Locked;
  /** Shahar hudud markazi bilan almashtirilganmi */
  cityApprox: boolean;
};

/**
 * Ko'ruvchiga ko'rsatiladigan shahar (E28): `city` darajasi ruxsat bersa — aniq shahar,
 * aks holda hudud markazi (masalan, Rishton → Farg'ona). /buyurtma, profil va ro'yxat bir xil qoidani ishlatadi.
 */
export function viewerCity(sp: { regionSlug: string; city: string; visibility: Visibility | null | undefined }, viewer: Viewer): string {
  if (canView(resolveVisibility(sp.visibility).city, viewer)) return sp.city;
  return REGION_BY_SLUG[sp.regionSlug]?.capital ?? sp.city;
}

/**
 * Yashirin maydonlarni server tomonda olib tashlaydi va "locked" belgilarini qaytaradi.
 * Egasi va admin hamma narsani ko'radi. `visibility` obyektining o'zi natijaga kirmaydi.
 */
export function filterSpecialistForViewer<T extends SpecialistLike>(sp: T, viewer: Viewer): FilteredSpecialist<T> {
  const vis = resolveVisibility(sp.visibility);
  const locked: Locked = {};
  const { visibility: _visibility, user, ...rest } = sp;
  void _visibility;

  const gate = <V,>(key: VisibilityFieldKey, value: V, empty: V): V => {
    // Platforma qoidasi (PROFILE_HIRING=false): ijodkorlarning aloqa vositalari egasi va adminlardan boshqa HECH KIMGA ko'rinmaydi
    // (buyurtma qabul qilingan bo'lsa ham) — "yopiq" belgisi ham qo'yilmaydi, iz qolmaydi
    if (!PROFILE_HIRING && HIDDEN_CONTACT_KEYS.includes(key) && !viewer.isOwner && viewer.role !== "admin") return empty;
    if (canView(vis[key], viewer)) return value;
    const reason = lockReason(vis[key], viewer);
    const hasValue = Array.isArray(value) ? value.length > 0 : value != null && value !== "";
    if (reason && hasValue) locked[key] = reason;
    return empty;
  };

  const cityVisible = canView(vis.city, viewer);
  const city = viewerCity(sp, viewer);
  if (!cityVisible) {
    const reason = lockReason(vis.city, viewer);
    if (reason && sp.city && sp.city !== city) locked.city = reason;
  }

  return {
    ...rest,
    city,
    cityApprox: !cityVisible && sp.city !== city,
    telegram: gate("telegram", sp.telegram, null),
    instagram: gate("instagram", sp.instagram, null),
    youtube: gate("youtube", sp.youtube, null),
    website: gate("website", sp.website, null),
    schedule: gate("schedule", sp.schedule, null),
    // Band kunlar — ish vaqti bilan bir xil daraja (jadval yashirin bo'lsa kalendar ham chiqmaydi)
    ...(sp.blockedDates !== undefined ? { blockedDates: canView(vis.schedule, viewer) ? sp.blockedDates : [] } : {}),
    user: {
      ...user,
      phone: gate("phone", user.phone ?? null, null),
      email: gate("email", user.email ?? null, null),
      gender: gate("gender", user.gender ?? null, null),
    },
    locked,
  } as FilteredSpecialist<T>;
}

/** Eng arzon paket narxi (F31) — paket yo'q bo'lsa null */
export function minPackagePrice(packages: ReadonlyArray<Pick<ServicePackage, "price">> | null | undefined): number | null {
  const prices = (packages ?? []).map((p) => p.price).filter((n) => Number.isFinite(n) && n > 0);
  return prices.length ? Math.min(...prices) : null;
}

/** "… dan" narxi: priceFrom bo'sh (0) bo'lsa — eng arzon paket narxi (F31) */
export function effectivePriceFrom(sp: { priceFrom: number; packages?: ReadonlyArray<Pick<ServicePackage, "price">> | null }): number {
  return sp.priceFrom > 0 ? sp.priceFrom : (minPackagePrice(sp.packages) ?? 0);
}

/**
 * Ro'yxat elementlari uchun xavfsiz DTO: aloqa vositalari, ish vaqti va sozlamalar
 * ro'yxatga umuman chiqmaydi (telefon/email ham). Shahar — faqat ruxsat bo'lsa.
 * Band kunlar (jadvalga bog'liq), obuna muddati (ichki billing) va og'ir JSON'lar (paketlar, sertifikatlar) ham chiqmaydi —
 * taqqoslash sahifasi ularni alohida ommaviy DTO bilan oladi.
 */
export function toListItem<
  T extends {
    regionSlug: string;
    city: string;
    visibility: Visibility;
    priceFrom: number;
    telegram?: unknown;
    instagram?: unknown;
    youtube?: unknown;
    website?: unknown;
    schedule?: unknown;
    userId?: unknown;
    blockedDates?: unknown;
    subscriptionUntil?: unknown;
    packages?: ReadonlyArray<Pick<ServicePackage, "price">> | null;
    certificates?: unknown;
    user: { name: string; avatarUrl: string | null };
  },
>(sp: T, viewer: Viewer = GUEST_VIEWER) {
  const {
    visibility: _v,
    telegram: _t,
    instagram: _i,
    youtube: _y,
    website: _w,
    schedule: _s,
    userId: _u,
    blockedDates: _b,
    subscriptionUntil: _su,
    packages: _p,
    certificates: _c,
    ...rest
  } = sp;
  void _v;
  void _t;
  void _i;
  void _y;
  void _w;
  void _s;
  void _u;
  void _b;
  void _su;
  void _p;
  void _c;
  // equipment / completedCount / topRated / workTypes / rates (F51, F12, F69, F52, F70) — maxfiy emas, `rest` orqali o'tadi.
  // priceFrom bo'sh bo'lsa — eng arzon paket narxi ("… dan", F31)
  return { ...rest, priceFrom: effectivePriceFrom(sp), city: viewerCity(sp, viewer), user: { name: sp.user.name, avatarUrl: sp.user.avatarUrl } };
}

/**
 * "Hozir ochiq" (F42): ish vaqti bo'yicha hozir ochiq va ta'tilda emas.
 * Ko'ruvchiga ish vaqti ko'rinmasa (yashirin / faqat buyurtmachilarga) — noma'lum, ya'ni false.
 */
export function isOpenNowFor(sp: { schedule: Schedule | null; vacationUntil: string | null; visibility: Visibility | null | undefined }, viewer: Viewer, now = Date.now()): boolean {
  if (!sp.schedule || isOnVacation(sp.vacationUntil, now)) return false;
  if (!canView(resolveVisibility(sp.visibility).schedule, { userId: viewer.userId, role: viewer.role })) return false;
  return scheduleStatus(sp.schedule, now).state === "open";
}

/** Bot/crawler'lar ko'rishlar sonini oshirmasin */
export function isBotUserAgent(ua: string | null | undefined) {
  if (!ua) return true;
  return /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|monitor|curl|wget|python-requests|go-http-client/i.test(ua);
}

/* ------------------------------------------------------------------ */
/* Ish vaqti (Asia/Tashkent, UTC+5, yozgi vaqt yo'q — Intl ishlatilmaydi) */
/* ------------------------------------------------------------------ */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_ORDER: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const pad2 = (n: number) => String(n).padStart(2, "0");

export function toMinutes(hhmm: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Toshkent vaqti bo'yicha hafta kuni kaliti, kun ichidagi daqiqa va YYYY-MM-DD */
export function tashkentNow(now = Date.now()) {
  const t = new Date(now + TASHKENT_OFFSET_MS);
  const jsDay = t.getUTCDay(); // 0 = yakshanba
  const key = DAY_ORDER[(jsDay + 6) % 7];
  return {
    dayKey: key,
    minutes: t.getUTCHours() * 60 + t.getUTCMinutes(),
    date: `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`,
  };
}

export function isOnVacation(vacationUntil: string | null | undefined, now = Date.now()) {
  if (!vacationUntil || !/^\d{4}-\d{2}-\d{2}$/.test(vacationUntil)) return false;
  return vacationUntil >= tashkentNow(now).date;
}

export type ScheduleStatus =
  | { state: "open"; closesAt: string }
  | { state: "closed"; opensAt: string | null; opensDay: "today" | "tomorrow" | WeekdayKey | null }
  | { state: "none" };

/** Hozir ochiqmi; yopiq bo'lsa — qachon ochiladi (keyingi 7 kun ichida) */
export function scheduleStatus(schedule: Schedule | null | undefined, now = Date.now()): ScheduleStatus {
  if (!schedule?.days) return { state: "none" };
  const days = schedule.days;
  const anyEnabled = DAY_ORDER.some((k) => days[k]?.enabled);
  if (!anyEnabled) return { state: "none" };

  const { dayKey, minutes } = tashkentNow(now);
  const todayIdx = DAY_ORDER.indexOf(dayKey);
  const today = days[dayKey];

  if (today?.enabled) {
    const from = toMinutes(today.from);
    const to = toMinutes(today.to);
    if (from <= minutes && minutes < to) return { state: "open", closesAt: today.to };
    if (minutes < from) return { state: "closed", opensAt: today.from, opensDay: "today" };
  }
  for (let i = 1; i <= 7; i++) {
    const key = DAY_ORDER[(todayIdx + i) % 7];
    const d = days[key];
    if (d?.enabled) return { state: "closed", opensAt: d.from, opensDay: i === 1 ? "tomorrow" : key };
  }
  return { state: "closed", opensAt: null, opensDay: null };
}

/** "Hozir ochiq · 18:00 gacha" / "Yopiq · ertaga 09:00 da ochiladi" */
export function scheduleStatusLabel(status: ScheduleStatus): string {
  if (status.state === "none") return "Ish vaqti ko'rsatilmagan";
  if (status.state === "open") return `Hozir ochiq · ${status.closesAt} gacha`;
  if (!status.opensAt || !status.opensDay) return "Yopiq";
  const when =
    status.opensDay === "today" ? "bugun" : status.opensDay === "tomorrow" ? "ertaga" : (WEEKDAYS.find((w) => w.key === status.opensDay)?.label.toLowerCase() ?? "");
  return `Yopiq · ${when} ${status.opensAt} da ochiladi`;
}

/** Jadvalning qisqa xulosasi: "Du–Ju 09:00–18:00 · Sh 10:00–15:00" */
export function scheduleSummary(schedule: Schedule | null | undefined): string {
  if (!schedule?.days) return "";
  const parts: string[] = [];
  let runStart: number | null = null;
  let runRange = "";
  const flush = (endIdx: number) => {
    if (runStart == null) return;
    const a = WEEKDAYS[runStart].short;
    const b = WEEKDAYS[endIdx].short;
    parts.push(`${runStart === endIdx ? a : `${a}–${b}`} ${runRange}`);
    runStart = null;
    runRange = "";
  };
  DAY_ORDER.forEach((key, idx) => {
    const d = schedule.days[key];
    const range = d?.enabled ? `${d.from}–${d.to}` : "";
    if (!range) {
      flush(idx - 1);
      return;
    }
    if (runStart == null) {
      runStart = idx;
      runRange = range;
    } else if (range !== runRange) {
      flush(idx - 1);
      runStart = idx;
      runRange = range;
    }
  });
  flush(DAY_ORDER.length - 1);
  return parts.join(" · ");
}

export const DEFAULT_DAY = { enabled: false, from: "09:00", to: "18:00" } as const;

/** "Hafta ichi 9–18" kabi tez andozalar */
export function presetSchedule(kind: "weekdays" | "everyday" | "weekend"): Schedule {
  const on = (from: string, to: string) => ({ enabled: true, from, to });
  const off = { ...DEFAULT_DAY };
  const days = Object.fromEntries(
    DAY_ORDER.map((k) => {
      const weekend = k === "sat" || k === "sun";
      if (kind === "weekdays") return [k, weekend ? { ...off } : on("09:00", "18:00")];
      if (kind === "weekend") return [k, weekend ? on("10:00", "16:00") : { ...off }];
      return [k, on("10:00", "20:00")];
    }),
  ) as Schedule["days"];
  return { days, note: "" };
}

export function emptySchedule(): Schedule {
  return { days: Object.fromEntries(DAY_ORDER.map((k) => [k, { ...DEFAULT_DAY }])) as Schedule["days"], note: "" };
}
