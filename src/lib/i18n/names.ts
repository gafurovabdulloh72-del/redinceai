import "server-only";
import dict from "./ru-dict.json";
import { normalizeUz } from "./auto";
import type { Locale } from "./index";

/**
 * SERVER tomonda (SSR, metadata) lug'atdan ruscha nom: kasb («Videograf» → «Видеограф»), hudud («Toshkent sh.» → «г. Ташкент»),
 * bo'lim nomi. Brauzerdagi avtomatik qatlam (`RuAutoLayer`) shu lug'at bilan DOM matnini almashtiradi, lekin u faqat BUTUN
 * matn tuguni lug'atda bo'lsa ishlaydi — «dizaynerlar — Toshkent sh.» kabi YIG'MA satrlarni server o'zi ruscha yig'ishi kerak.
 * Topilmasa — asl matn. Lug'at (~200 KB) faqat serverda yuklanadi (`server-only`), klient bundle'iga kirmaydi.
 */
const RU = dict as Record<string, string>;
export function ruName(til: Locale, uz: string): string {
  if (til !== "ru") return uz;
  return RU[normalizeUz(uz)] ?? uz;
}
