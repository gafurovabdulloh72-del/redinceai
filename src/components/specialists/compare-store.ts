/**
 * Taqqoslash ro'yxati (F54) — ko'ruvchining brauzerida (localStorage), 3 tagacha mutaxassis.
 * Modul darajasidagi do'kon: barcha "Taqqoslash" tugmalari va pastdagi panel bitta holatni ko'radi;
 * boshqa tabda o'zgarsa ("storage" hodisasi) ham yangilanadi. localStorage ishlamasa (yashirin rejim) — xotirada.
 */
export const COMPARE_MAX = 3;
const KEY = "redince:compare:v1";

export interface CompareItem {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface CompareSnapshot {
  items: readonly CompareItem[];
  /** Oxirgi ogohlantirish (masalan, "ko'pi bilan 3 ta") — panel qisqa ko'rsatadi */
  notice: { text: string; at: number } | null;
}

const SERVER_SNAPSHOT: CompareSnapshot = { items: [], notice: null };
let snapshot: CompareSnapshot = SERVER_SNAPSHOT;
let loaded = false;
const listeners = new Set<() => void>();

function isItem(v: unknown): v is CompareItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.name === "string" && (o.avatarUrl === null || typeof o.avatarUrl === "string");
}

function read(): CompareItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isItem).slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

function write(items: readonly CompareItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* yashirin rejim / kvota — holat xotirada qoladi */
  }
}

function publish(next: CompareSnapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  snapshot = { items: read(), notice: null };
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) publish({ items: read(), notice: null });
  });
}

export function subscribeCompare(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getCompareSnapshot(): CompareSnapshot {
  ensureLoaded();
  return snapshot;
}
export function getCompareServerSnapshot(): CompareSnapshot {
  return SERVER_SNAPSHOT;
}

/** Qo'shish/olib tashlash. To'lib qolgan bo'lsa — false va ogohlantirish */
export function toggleCompare(item: CompareItem): boolean {
  ensureLoaded();
  const has = snapshot.items.some((i) => i.id === item.id);
  if (has) {
    const items = snapshot.items.filter((i) => i.id !== item.id);
    write(items);
    publish({ items, notice: null });
    return true;
  }
  if (snapshot.items.length >= COMPARE_MAX) {
    publish({ items: snapshot.items, notice: { text: `Ko'pi bilan ${COMPARE_MAX} ta mutaxassisni taqqoslash mumkin`, at: Date.now() } });
    return false;
  }
  const items = [...snapshot.items, item];
  write(items);
  publish({ items, notice: null });
  return true;
}

export function removeCompare(id: string) {
  ensureLoaded();
  const items = snapshot.items.filter((i) => i.id !== id);
  write(items);
  publish({ items, notice: null });
}

export function clearCompare() {
  ensureLoaded();
  write([]);
  publish({ items: [], notice: null });
}

/** Taqqoslash sahifasi server natijasi bilan moslashtiradi (topilmagan / katalogdan chiqqanlar olib tashlanadi) */
export function syncCompare(items: CompareItem[]) {
  ensureLoaded();
  const next = items.slice(0, COMPARE_MAX);
  if (JSON.stringify(next) === JSON.stringify(snapshot.items)) return;
  write(next);
  publish({ items: next, notice: null });
}

export function compareHref(items: readonly Pick<CompareItem, "id">[]) {
  return `/taqqoslash?ids=${items.map((i) => encodeURIComponent(i.id)).join(",")}`;
}
