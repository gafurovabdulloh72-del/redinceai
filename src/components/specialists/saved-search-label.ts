/**
 * Saqlangan qidiruvlar (F53) uchun sof yordamchilar — server (kabinet ro'yxati, ogohlantirishlar) va klient
 * ("Qidiruvni saqlash" tugmasining standart nomi) bir xil natija beradi. Bazaga tegmaydi.
 */
import { CATEGORY_BY_SLUG, EXPERIENCE_LEVELS, GENDERS, REGION_BY_SLUG, WORK_TYPE_BY_SLUG } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";

/** Saqlanadigan /mutaxassislar parametrlari (page/limit/view saqlanmaydi) */
export const SAVED_SEARCH_KEYS = [
  "q",
  "category",
  "region",
  "priceMin",
  "priceMax",
  "experience",
  "gender",
  "verified",
  "available",
  "skill",
  "equipment",
  "workType",
  "openNow",
  "sort",
] as const;

/** Joriy URL parametrlaridan faqat saqlanadiganlari (bo'sh/standart qiymatlarsiz) */
export function pickSavedParams(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const k of SAVED_SEARCH_KEYS) {
    const v = params.get(k);
    if (!v || v === "0" || (k === "sort" && v === "rating")) continue;
    out.set(k, v);
  }
  return out;
}

const short = (n: number) => formatPrice(n, { compact: true }).replace(" so'm", "");

/** "Videograf · Samarqand · 3 mln gacha" — saqlangan qidiruvning odam o'qiydigan tavsifi */
export function describeSavedQuery(query: string): string {
  const p = new URLSearchParams(query);
  const parts: string[] = [];
  const q = p.get("q");
  if (q) parts.push(`“${q}”`);
  const cat = p.get("category");
  if (cat) parts.push(CATEGORY_BY_SLUG[cat]?.plural ?? cat);
  const region = p.get("region");
  if (region) parts.push(REGION_BY_SLUG[region]?.short ?? region);
  const wt = p.get("workType");
  if (wt) parts.push(WORK_TYPE_BY_SLUG[wt]?.label ?? wt);
  const min = Number(p.get("priceMin")) || 0;
  const max = Number(p.get("priceMax")) || 0;
  if (min && max) parts.push(`${short(min)}–${short(max)} so'm`);
  else if (min) parts.push(`${short(min)} so'mdan`);
  else if (max) parts.push(`${short(max)} so'mgacha`);
  const exp = p.get("experience");
  if (exp) parts.push(EXPERIENCE_LEVELS.find((e) => e.value === exp)?.label.split(" (")[0] ?? exp);
  const gender = p.get("gender");
  if (gender) parts.push(GENDERS.find((g) => g.value === gender)?.label ?? gender);
  const skill = p.get("skill");
  if (skill) parts.push(skill);
  const equipment = p.get("equipment");
  if (equipment) parts.push(equipment);
  if (p.get("verified") === "1") parts.push("Tasdiqlangan");
  if (p.get("available") === "1") parts.push("Hozir bo'sh");
  if (p.get("openNow") === "1") parts.push("Hozir ochiq");
  return parts.length ? parts.join(" · ") : "Barcha mutaxassislar";
}
