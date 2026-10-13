"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { translit } from "@/lib/utils";

export interface HelpIndexItem {
  slug: string;
  title: string;
  summary: string;
  category: string;
  text: string;
}

/** Kirill/lotin, apostrof va registrdan qat'i nazar: barcha so'zlar matnda bo'lsin */
function search(index: HelpIndexItem[], q: string): HelpIndexItem[] {
  const words = translit(q).split(" ").filter((w) => w.length > 1);
  if (!words.length) return [];
  return index
    .map((item) => {
      const title = translit(item.title);
      const hay = translit(`${item.title} ${item.summary} ${item.text}`);
      if (!words.every((w) => hay.includes(w))) return null;
      const score = words.reduce((s, w) => s + (title.includes(w) ? 3 : 1), 0);
      return { item, score };
    })
    .filter((x): x is { item: HelpIndexItem; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}

/**
 * Yordam markazi qidiruvi: yozish bilan natijalar (JS), JS'siz — GET /yordam?q= (server ham shu indeks bo'yicha chizadi).
 */
export function HelpSearch({ index, initialQuery = "" }: { index: HelpIndexItem[]; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const results = useMemo(() => search(index, q), [index, q]);
  const active = q.trim().length > 1;

  return (
    <div className="w-full">
      <form action="/yordam" method="get" role="search" className="relative" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="help-q" className="sr-only">
          Yordam maqolalarini qidirish
        </label>
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
        <input
          id="help-q"
          name="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={80}
          placeholder="Masalan: eskrou, obuna, pul chiqarish…"
          autoComplete="off"
          aria-controls="help-results"
          className="field h-14 !rounded-full !pl-12 !pr-12 text-[15px]"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Qidiruvni tozalash" className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
            <X size={16} />
          </button>
        )}
      </form>

      <div id="help-results" aria-live="polite">
        {active && (
          <div className="card mt-3 overflow-hidden">
            <p className="border-b border-line px-5 py-3 text-[12px] font-semibold text-fg-3">{results.length > 0 ? `${results.length} ta maqola topildi` : "Hech narsa topilmadi"}</p>
            {results.length > 0 ? (
              <ul className="divide-y divide-line">
                {results.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/yordam/${r.slug}`} className="group flex min-h-14 items-center gap-3 px-5 py-3 transition hover:bg-fg/4">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-fg">{r.title}</span>
                        <span className="block truncate text-[12px] text-fg-3">
                          {r.category} · {r.summary}
                        </span>
                      </span>
                      <ArrowRight size={15} className="shrink-0 text-fg-4 transition group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-[13px] text-fg-2">Boshqa so&apos;z bilan urinib ko&apos;ring yoki quyidagi bo&apos;limlardan tanlang. Javob topilmasa — Telegram orqali yozing.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
