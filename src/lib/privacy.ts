/**
 * Maxfiylik dvigateli: mutaxassisning shaxsiy maydonlari kimga ko'rinishini hal qiladi
 * va server tomonda yashirin maydonlarni OLIB TASHLAYDI (UI'ga umuman yetib bormaydi).
 *
 * Bu modul ataylab "server-only" emas — sof funksiyalar (resolveVisibility, canView,
 * ish vaqti hisob-kitobi) kabinetdagi jonli ko'rinish (preview) uchun klientda ham ishlatiladi.
 * Baza bilan ishlaydigan qism (buyurtma borligini tekshirish) queries.ts'da.
 */
import { DEFAULT_VISIBILITY, REGION_BY_SLUG, VISIBILITY_FIELDS, WEEKDAYS, type VisibilityFieldKey, type VisibilityLevelValue, type WeekdayKey } from "./constants";
import type { Schedule, Visibility } from "./db/schema";

/* ------------------------------------------------------------------ */
/* Ko'rinish darajalari                                                */
/* ------------------------------------------------------------------ */
export type ResolvedVisibility = Record<VisibilityFieldKey, VisibilityLevelValue>;

/** Bazadagi (qisman) sozlamani standart qiymatlar bilan to'ldiradi; noma'lum qiymatlar e'tiborsiz */
export function resolveVisibility(v: Visibility | null | undefined): ResolvedVisibility {
  const out: ResolvedVisibility = { ...DEFAULT_VISIBILITY };
  if (!v || typeof v !== "object") return out;
  for (const f of VISIBILITY_FIELDS) {
    const level = (v as Record<string, unknown>)[f.key];
    if (level === "public" || level === "clients" || level === "orders" || level === "hidden") out[f.key] = level;
  }
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
 * Yashirin maydonlarni server tomonda olib tashlaydi va "locked" belgilarini qaytaradi.
 * Egasi va admin hamma narsani ko'radi. `visibility` obyektining o'zi natijaga kirmaydi.
 */
export function filterSpecialistForViewer<T extends SpecialistLike>(sp: T, viewer: Viewer): FilteredSpecialist<T> {
  const vis = resolveVisibility(sp.visibility);
  const locked: Locked = {};
  const { visibility: _visibility, user, ...rest } = sp;
  void _visibility;

  const gate = <V,>(key: VisibilityFieldKey, value: V, empty: V): V => {
    if (canView(vis[key], viewer)) return value;
    const reason = lockReason(vis[key], viewer);
    const hasValue = Array.isArray(value) ? value.length > 0 : value != null && value !== "";
    if (reason && hasValue) locked[key] = reason;
    return empty;
  };

  const cityVisible = canView(vis.city, viewer);
  const region = REGION_BY_SLUG[sp.regionSlug];
  const city = cityVisible ? sp.city : (region?.capital ?? sp.city);
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
    user: {
      ...user,
      phone: gate("phone", user.phone ?? null, null),
      email: gate("email", user.email ?? null, null),
      gender: gate("gender", user.gender ?? null, null),
    },
    locked,
  } as FilteredSpecialist<T>;
}

/**
 * Ro'yxat elementlari uchun xavfsiz DTO: aloqa vositalari, ish vaqti va sozlamalar
 * ro'yxatga umuman chiqmaydi (telefon/email ham). Shahar — faqat ruxsat bo'lsa.
 */
export function toListItem<
  T extends {
    regionSlug: string;
    city: string;
    visibility: Visibility;
    telegram?: unknown;
    instagram?: unknown;
    youtube?: unknown;
    website?: unknown;
    schedule?: unknown;
    userId?: unknown;
    user: { name: string; avatarUrl: string | null };
  },
>(sp: T, viewer: Viewer = GUEST_VIEWER) {
  const vis = resolveVisibility(sp.visibility);
  const { visibility: _v, telegram: _t, instagram: _i, youtube: _y, website: _w, schedule: _s, userId: _u, ...rest } = sp;
  void _v;
  void _t;
  void _i;
  void _y;
  void _w;
  void _s;
  void _u;
  const region = REGION_BY_SLUG[sp.regionSlug];
  const city = canView(vis.city, viewer) ? sp.city : (region?.capital ?? sp.city);
  return { ...rest, city, user: { name: sp.user.name, avatarUrl: sp.user.avatarUrl } };
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
