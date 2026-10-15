"use client";

/**
 * Qoralama (F56): forma matnlarini localStorage'da vaqtincha saqlash — sahifa yopilib
 * qolsa ham yozilganlar yo'qolmaydi. Hammasi try/catch ichida: private rejim yoki
 * bloklangan storage'da forma shunchaki qoralamasiz ishlayveradi.
 */

const PREFIX = "draft:";
/** 7 kundan eski qoralama tiklanmaydi (eskirgan matn chalg'itmasin) */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function saveDraft(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* storage yopiq — qoralamasiz davom etamiz */
  }
}

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; value?: T } | null;
    if (!parsed || typeof parsed.at !== "number" || parsed.value == null) return null;
    if (Date.now() - parsed.at > MAX_AGE_MS) {
      clearDraft(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* noop */
  }
}
