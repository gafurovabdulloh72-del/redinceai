"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { PROFIL_X } from "@/lib/i18n/dict/profile";
import { cn } from "@/lib/utils";

const KEY = "korilgan-ijodkorlar";
const MAX = 8;
export interface RecentItem {
  slug: string;
  name: string;
  title: string;
  avatarUrl: string | null;
  at: number;
}

function read(): RecentItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x): x is RecentItem => x && typeof x.slug === "string" && typeof x.name === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}
function write(list: RecentItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* xususiy rejim */
  }
}

/** Profil sahifasida: ko'rilgan ijodkorni ro'yxat boshiga yozadi (egasi o'z profilini ko'rganda yozilmaydi — `enabled`) */
export function RecentViewRecorder({ item, enabled = true }: { item: Omit<RecentItem, "at">; enabled?: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const list = [{ ...item, at: Date.now() }, ...read().filter((x) => x.slug !== item.slug)];
    write(list);
  }, [item, enabled]);
  return null;
}

/**
 * «Yaqinda ko'rilganlar» lentasi (localStorage, 8 tagacha) — katalog va profil pastida.
 * Serverda hech narsa chizilmaydi (hydration'ga ta'sir yo'q); yuklangach `expand-in` bilan kiradi.
 */
export function RecentlyViewed({ excludeSlug, className }: { excludeSlug?: string; className?: string }) {
  const til = useLocale();
  const [items, setItems] = useState<RecentItem[] | null>(null);
  useEffect(() => {
    setItems(read().filter((x) => x.slug !== excludeSlug));
  }, [excludeSlug]);
  if (!items || items.length === 0) return null;
  return (
    <section className={cn("expand-in", className)} aria-label={tr(til, PROFIL_X.recentAria)}>
      <div className="mb-2.5 flex items-center justify-between gap-3 px-0.5">
        <h2 className="text-[13px] font-semibold text-fg-2">{tr(til, PROFIL_X.recentTitle)}</h2>
        <button
          type="button"
          onClick={() => {
            write([]);
            setItems([]);
          }}
          className="press inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg"
        >
          <X size={12} aria-hidden /> {tr(til, PROFIL_X.recentClear)}
        </button>
      </div>
      <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {items.map((it) => (
          <li key={it.slug} className="shrink-0">
            <Link href={`/mutaxassislar/${it.slug}`} className="card hover-lift press flex w-[164px] items-center gap-2.5 p-2.5">
              <Avatar name={it.name} src={it.avatarUrl} size={36} decorative />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-fg">{it.name}</span>
                <span className="block truncate text-[11.5px] text-fg-3">{it.title}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
