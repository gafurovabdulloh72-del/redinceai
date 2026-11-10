/**
 * Admin klient komponentlari uchun umumiy so'rov yordamchisi: JSON javobni ochadi, `ok: false` bo'lsa
 * server bergan xabar bilan (maydon xatosi ustun) Error tashlaydi — chaqiruvchi toast/inline ko'rsatadi.
 *
 *   const data = await adminApi<Stats>("/api/admin/cron");
 *   await adminApi("/api/admin/xatolar", { method: "PATCH", json: { ids, resolved: true } });
 */
export async function adminApi<T = unknown>(url: string, init: Omit<RequestInit, "body"> & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
  } catch {
    throw new Error("Tarmoq xatosi — internetni tekshiring");
  }
  const j = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: string; fields?: Record<string, string> } | null;
  if (!j?.ok) throw new Error((j?.fields && Object.values(j.fields)[0]) || j?.error || `Server xatosi (${res.status})`);
  return j.data as T;
}

/** Xato obyektidan foydalanuvchiga ko'rsatiladigan matn */
export const errText = (e: unknown, fallback = "Amal bajarilmadi"): string => (e instanceof Error && e.message ? e.message : fallback);

/** Tab yorlig'idagi sonni jonli yangilash (AdminTabs tinglaydi) — sahifani qayta yuklamasdan */
export function setAdminTabCount(key: string, count: number): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("admin-tab-count", { detail: { key, count } }));
}

/** Qolgan vaqt: 45 s → «45 soniya», 12 daq → «12 daqiqa», 3 soat 20 daq → «3 soat 20 daq», 2 kun → «2 kun» */
export function leftText(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} soniya`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} daqiqa`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} soat ${m % 60} daq` : `${h} soat`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} kun ${h % 24} soat` : `${d} kun`;
}
