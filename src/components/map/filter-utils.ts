"use client";

import { useEffect, useState } from "react";
import type { SpecialistListItem } from "@/lib/queries";
import { CATEGORY_BY_SLUG, GENDERS, REGION_BY_SLUG } from "@/lib/constants";

/**
 * Xarita panellari (bosh sahifa HomeMapSection va /xarita MapExplorer) uchun UMUMIY filtr yordamchilari
 * va ro'yxat yuklash hook'i — ikki nusxada yashab, allaqachon bir-biridan uzoqlashgan kod shu yerga yig'ildi.
 */

export type Gender = (typeof GENDERS)[number]["value"];
/** Jins segmenti: "" — barchasi */
export const GENDER_OPTIONS: ReadonlyArray<{ value: Gender | ""; label: string }> = [{ value: "", label: "Barchasi" }, ...GENDERS];

export const validRegion = (v: string | null) => (v && REGION_BY_SLUG[v] ? v : null);
export const validCategory = (v: string | null) => (v && CATEGORY_BY_SLUG[v] ? v : null);
export const isGender = (v: string): v is Gender => GENDERS.some((g) => g.value === v);
export const validGender = (v: string | null): Gender | null => (v && isGender(v) ? v : null);

export function qsOf(region: string | null, category: string | null, gender: Gender | null = null) {
  const p = new URLSearchParams();
  if (region) p.set("region", region);
  if (category) p.set("category", category);
  if (gender) p.set("gender", gender);
  return p.toString();
}

/** API JSON'ida sanalar satr bo'lib keladi */
export type SerializedSpecialist = Omit<SpecialistListItem, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };

export interface SpecialistList {
  items: SerializedSpecialist[];
  total: number;
}

/**
 * Filtr bo'yicha mutaxassislar ro'yxati: kesh (sessiya davomida), bekor qilinadigan fetch,
 * xato holati va qayta urinish. enabled=false bo'lsa yuklanmaydi (list=null); bo'sh key — filtrsiz (butun O'zbekiston).
 */
export function useSpecialistList(region: string | null, category: string | null, gender: Gender | null, limit: number, enabled = true) {
  const key = qsOf(region, category, gender);
  const [list, setList] = useState<SpecialistList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [cache] = useState(() => new Map<string, SpecialistList>());

  useEffect(() => {
    if (!enabled) {
      setList(null);
      setLoading(false);
      setError(null);
      return;
    }
    const hit = cache.get(key);
    if (hit) {
      setList(hit);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const p = new URLSearchParams({ limit: String(limit), sort: "rating" });
    if (region) p.set("region", region);
    if (category) p.set("category", category);
    if (gender) p.set("gender", gender);
    fetch(`/api/specialists?${p.toString()}`, { signal: ctrl.signal })
      .then(async (res) => {
        const json = (await res.json()) as { ok: true; data: SpecialistList } | { ok: false; error: string };
        if (!json.ok) throw new Error(json.error);
        const next: SpecialistList = { items: json.data.items, total: json.data.total };
        cache.set(key, next);
        setList(next);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error && e.message ? e.message : "Ro'yxatni yuklab bo'lmadi");
      })
      .finally(() => {
        // Bekor qilingan so'rov keyingi so'rovning loading holatini o'chirmasin
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [key, region, category, gender, limit, enabled, attempt, cache]);

  const retry = () => {
    cache.delete(key);
    setAttempt((n) => n + 1);
  };
  return { key, list, loading, error, retry };
}
