/**
 * Sevimlilar holati — sahifadagi barcha yurak tugmalari uchun umumiy, modul darajasidagi do'kon.
 * - Navbar ko'ruvchini e'lon qiladi (setFavoritesViewer): kirgan bo'lsa bir marta GET /api/favorites?ids=1,
 *   mehmon bo'lsa so'rov yuborilmaydi; kirish/chiqishdan so'ng (router.refresh) avtomatik yangilanadi.
 * - Tugma mount bo'lganda ko'ruvchi hali noma'lum bo'lsa o'zi yuklaydi (401 → mehmon).
 * - toggleFavorite optimistik: avval UI, keyin so'rov; xato bo'lsa qaytariladi.
 * - Server ID'larni allaqachon bilsa (/kabinet/sevimlilar) — seedFavorites(): holat darhol "ready",
 *   yo'lda turgan eski GET natijasi (gen) bekor qilinadi.
 */
export type FavoritesStatus = "unknown" | "loading" | "guest" | "ready";

export interface FavoritesSnapshot {
  status: FavoritesStatus;
  ids: ReadonlySet<string>;
}

const EMPTY: ReadonlySet<string> = new Set();
const SERVER_SNAPSHOT: FavoritesSnapshot = { status: "unknown", ids: EMPTY };

let snapshot: FavoritesSnapshot = SERVER_SNAPSHOT;
/** Navbar e'lon qilgan ko'ruvchi: undefined — hali e'lon qilinmagan */
let viewerKey: string | null | undefined;
/** load() avlodi: seedFavorites() undan keyin chaqirilsa, eski javob holatni qayta yozmasin */
let gen = 0;
const listeners = new Set<() => void>();

function publish(next: FavoritesSnapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

export function subscribeFavorites(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getFavoritesSnapshot() {
  return snapshot;
}
export function getFavoritesServerSnapshot() {
  return SERVER_SNAPSHOT;
}

type ApiJson<T> = { ok: true; data: T } | { ok: false; error: string };

async function load() {
  const my = ++gen;
  publish({ status: "loading", ids: EMPTY });
  try {
    const res = await fetch("/api/favorites?ids=1", { credentials: "same-origin" });
    if (my !== gen) return;
    if (res.status === 401) {
      publish({ status: "guest", ids: EMPTY });
      return;
    }
    const json = (await res.json()) as ApiJson<{ ids: string[] }>;
    if (my !== gen) return;
    publish({ status: "ready", ids: json.ok ? new Set(json.data.ids) : EMPTY });
  } catch {
    if (my !== gen) return;
    // Tarmoq xatosi: tugmalar ishlayveradi, holat keyingi bosishda aniqlanadi
    publish({ status: "ready", ids: EMPTY });
  }
}

/** Server allaqachon bilgan sevimlilar (masalan /kabinet/sevimlilar): holat darhol "ready", qo'shimcha GET kerak emas */
export function seedFavorites(viewerId: string, ids: readonly string[]) {
  viewerKey = viewerId;
  gen++;
  publish({ status: "ready", ids: new Set(ids) });
}

/** Tugma mount bo'lganda: ko'ruvchi noma'lum va hali yuklanmagan bo'lsa yuklaymiz */
export function ensureFavoritesLoaded() {
  if (snapshot.status === "unknown") void load();
}

/** Navbar: joriy ko'ruvchi (user.id yoki null). O'zgarsa holat qayta yuklanadi */
export function setFavoritesViewer(id: string | null) {
  if (viewerKey === id) return;
  const wasUnknown = viewerKey === undefined;
  viewerKey = id;
  if (!id) {
    publish({ status: "guest", ids: EMPTY });
    return;
  }
  // Tugma allaqachon yuklashni boshlagan bo'lsa — ikkinchi so'rov shart emas
  if (wasUnknown && snapshot.status === "loading") return;
  void load();
}

function setHas(id: string, on: boolean) {
  if (snapshot.ids.has(id) === on) return;
  const ids = new Set(snapshot.ids);
  if (on) ids.add(id);
  else ids.delete(id);
  publish({ status: "ready", ids });
}

export type ToggleResult = "ok" | "guest" | "error";

/**
 * Sevimlini qo'shish/olib tashlash. `optimistic` — holat ishonchli (ready) bo'lsa UI darhol o'zgaradi.
 * 401 bo'lsa "guest" qaytadi — chaqiruvchi kirish sahifasiga yo'naltiradi.
 */
export async function toggleFavorite(id: string, optimistic = true): Promise<ToggleResult> {
  const was = snapshot.ids.has(id);
  if (optimistic) setHas(id, !was);
  try {
    const res = was
      ? await fetch(`/api/favorites?specialistId=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" })
      : await fetch("/api/favorites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ specialistId: id }),
        });
    if (res.status === 401) {
      viewerKey = null;
      publish({ status: "guest", ids: EMPTY });
      return "guest";
    }
    if (!res.ok) {
      setHas(id, was);
      return "error";
    }
    setHas(id, !was);
    return "ok";
  } catch {
    setHas(id, was);
    return "error";
  }
}
