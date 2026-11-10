/**
 * Chat bo'limining qurilmadagi (localStorage) kichik sozlamalari: qoralamalar, «o'qilmagan deb belgilangan» chatlar,
 * Ctrl+Enter rejimi, tez javoblar. Faqat brauzerda chaqiriladi (effekt / hodisa ishlovchisi ichida) — render paytida emas.
 */
export const store = {
  get(k: string): string | null {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null) {
    try {
      if (v === null || v === "") window.localStorage.removeItem(k);
      else window.localStorage.setItem(k, v);
    } catch {
      /* saqlanmasa ham ishlaydi */
    }
  },
};

export const CTRL_ENTER_KEY = "chat:ctrlEnter";
/** Mutaxassis uchun tayyor javoblar (OrderChat bilan bir xil saqlash kaliti — bitta ro'yxat) */
export const QUICK_KEY = "redince:quick-replies";
export const draftKey = (convId: string) => `chat:draft:${convId}`;

/** Suhbat qoralamasi (yuborilmagan matn) */
export const readDraft = (convId: string): string => store.get(draftKey(convId)) ?? "";
export const writeDraft = (convId: string, text: string) => store.set(draftKey(convId), text.trim() ? text : null);

/**
 * «O'qilmagan deb belgilash» (QA C3) — shu qurilmada saqlanadigan belgi: kalit `d:<suhbat>` yoki `g:<jamoa>`.
 * Server bilan sinxronlash uchun `dm_conversation_prefs.marked_unread` ustuni kerak bo'lardi (sxema o'zgarishi) —
 * hozircha belgi faqat shu brauzerda ko'rinadi; chat ochilganda yoki yangi xabar o'qilganda olib tashlanadi.
 */
const MARKS_KEY = "chat:unread-marks";
export function readMarks(): Set<string> {
  try {
    const v: unknown = JSON.parse(store.get(MARKS_KEY) ?? "[]");
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 200) : []);
  } catch {
    return new Set();
  }
}
export function writeMarks(marks: Set<string>) {
  store.set(MARKS_KEY, marks.size ? JSON.stringify([...marks]) : null);
}

/** Foydalanuvchi qo'shgan tez javoblar (12 tagacha) */
export function readQuickReplies(): string[] {
  try {
    const v: unknown = JSON.parse(store.get(QUICK_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 12) : [];
  } catch {
    return [];
  }
}
