"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, X } from "lucide-react";

const KEY = "ke:recent-search";
const MAX = 8;

/** Saqlangan so'rovlar (faqat shu brauzerda — serverga yuborilmaydi) */
function read(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/**
 * So'nggi qidiruvlar (2026-10-29). Ilgari qidiruv so'rovi hech qayerda saqlanmasdi —
 * foydalanuvchi bir xil so'rovni har safar qo'lda terishi kerak edi. Ro'yxat FAQAT
 * shu brauzerda (localStorage), serverga yuborilmaydi va boshqa qurilmaga o'tmaydi.
 * `q` bo'lsa — joriy so'rov ro'yxat boshiga yoziladi.
 */
export function RecentSearches({ q }: { q: string }) {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    const term = q.trim();
    const cur = read();
    if (!term) {
      setItems(cur);
      return;
    }
    const next = [term, ...cur.filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, MAX);
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private rejimda yozib bo'lmaydi — ro'yxat shunchaki saqlanmaydi */
    }
  }, [q]);

  const drop = (term: string) => {
    const next = items.filter((x) => x !== term);
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* e'tiborsiz */
    }
  };

  // Joriy so'rovning o'zini takror ko'rsatmaymiz
  const show = items.filter((x) => x.toLowerCase() !== q.trim().toLowerCase());
  if (show.length === 0) return null;

  return (
    <section className="mt-3 max-sm:px-4" aria-label="So'nggi qidiruvlar">
      <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-3">
        <Clock size={13} /> So&apos;nggi qidiruvlar
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {show.map((term) => (
          <li key={term} className="flex items-center">
            <Link href={`/qidiruv?q=${encodeURIComponent(term)}`} className="chip max-w-[14rem] truncate !pr-1.5 hover:bg-fg/6">
              {term}
            </Link>
            <button type="button" onClick={() => drop(term)} aria-label={`«${term}» so'rovini ro'yxatdan o'chirish`} className="-ml-6 flex h-6 w-6 items-center justify-center rounded-full text-fg-4 transition hover:text-fg">
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
