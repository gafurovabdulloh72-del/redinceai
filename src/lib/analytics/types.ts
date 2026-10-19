/** Faollik analitikasi — klient va server uchun umumiy, DB'siz turlar va sof yordamchilar */

export interface UserAnalytics {
  user: { id: string; name: string; role: string; createdAt: number; lastSeenAt: number | null; lastLoginAt: number | null };
  /** Faol kunlar (faollik yozuvi bor kunlar soni) */
  activeDays: { total: number; week: number; month: number };
  /** Faol vaqt (daqiqa) — taqribiy */
  minutes: { total: number; week: number; month: number };
  /** Tashriflar (30+ daqiqa tanaffusdan keyin qaytish) */
  visits: { total: number; week: number; month: number };
  /** O'rtacha: kuniga daqiqa (faol kunlar bo'yicha), haftasiga kun */
  avg: { minutesPerActiveDay: number; daysPerWeek: number };
  /** So'nggi 30 kunlik kunlik daqiqalar (grafik uchun; eskidan yangiga) */
  series: Array<{ day: number; minutes: number; label: string }>;
  /** Asosiy faoliyat (jami): nima ko'proq qilgan */
  activity: Array<{ key: string; label: string; count: number }>;
}

/** daqiqa → "N soat M min" yoki "M min" (0 — "—") */
export function formatMinutes(min: number): string {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} soat ${m} min`;
  if (h) return `${h} soat`;
  return `${m} min`;
}
