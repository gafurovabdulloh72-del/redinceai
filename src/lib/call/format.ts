/**
 * Qo'ng'iroq tarixi — klient va serverga xavfsiz (server-only import YO'Q).
 * Chat tarixiga Telegram kabi yoziladi: kim chaqirdi, qachon boshlandi, qachon tugadi, necha daqiqa.
 */

export type CallEndStatus = "ended" | "missed" | "declined" | "cancelled";

/** dm_messages.call JSON — tugagan qo'ng'iroq yozuvi. Vaqtlar ms (epoch). */
export interface CallInfo {
  video: boolean;
  status: CallEndStatus;
  /** Chaqiruv boshlangan vaqt */
  startedAt: number;
  /** Javob berilgan vaqt (faqat status=ended) */
  answeredAt: number | null;
  /** Tugagan vaqt */
  endedAt: number;
  /** Suhbat davomiyligi (soniya) — javob berilgandan tugaguncha */
  durationSec: number;
}

/** 205 → "3:25", 3725 → "1:02:05" (taymer uchun) */
export function clockDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

/** 205 → "3 daq 25 s", 40 → "40 s", 3725 → "1 soat 2 daq" (tarixda o'qiladigan shakl) */
export function humanDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return m > 0 ? `${h} soat ${m} daq` : `${h} soat`;
  return r > 0 ? `${m} daq ${r} s` : `${m} daq`;
}

export interface CallLabel {
  /** Asosiy sarlavha */
  title: string;
  /** Qizil (javobsiz/rad) ko'rinishmi */
  bad: boolean;
  /** Yo'nalish: chiquvchi (↗) yoki kiruvchi (↙) */
  outgoing: boolean;
}

/**
 * Ko'ruvchi nuqtai nazaridan yorliq. mine = chaqiruvchi men.
 * Telegram qoidasi: javobsiz qo'ng'iroq (kimdir bekor qilsa ham) qabul qiluvchiga «Javobsiz» bo'ladi.
 */
export function callLabel(c: CallInfo, mine: boolean): CallLabel {
  const kind = c.video ? "video qo'ng'iroq" : "qo'ng'iroq";
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  switch (c.status) {
    case "ended":
      return { title: cap(`${mine ? "chiquvchi" : "kiruvchi"} ${kind}`), bad: false, outgoing: mine };
    case "declined":
      return { title: mine ? "Rad etildi" : "Rad etdingiz", bad: true, outgoing: mine };
    case "cancelled":
      return { title: mine ? "Bekor qilindi" : `Javobsiz ${kind}`, bad: !mine || false, outgoing: mine };
    case "missed":
    default:
      return { title: mine ? "Javob berilmadi" : `Javobsiz ${kind}`, bad: true, outgoing: mine };
  }
}

/** Chatlar ro'yxatidagi qisqa matn (dm_messages.body va bildirishnoma uchun) */
export function callPreview(c: CallInfo, mine: boolean): string {
  const l = callLabel(c, mine);
  const icon = c.video ? "🎥" : "📞";
  return c.status === "ended" ? `${icon} ${l.title} · ${humanDuration(c.durationSec)}` : `${icon} ${l.title}`;
}
