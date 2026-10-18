"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { LayoutGrid, MapPin, Search, Sparkles, UserRound, X, type LucideIcon } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { FILTR } from "@/lib/i18n/dict/catalog";
import { cn } from "@/lib/utils";

export type SuggestionType = "category" | "region" | "specialist" | "skill" | "city";
export interface SuggestionItem {
  type: SuggestionType;
  label: string;
  hint?: string;
  href: string;
}

const TYPE_ICON: Record<SuggestionType, LucideIcon> = {
  category: LayoutGrid,
  region: MapPin,
  city: MapPin,
  specialist: UserRound,
  skill: Sparkles,
};

type SuggestResponse = { ok: true; data: { items: SuggestionItem[] } } | { ok: false; error: string };

/** Bir xil so'rov qayta yuborilmasin (sessiya davomida) */
const cache = new Map<string, SuggestionItem[]>();

/**
 * Qidiruv maydoni + takliflar ro'yxati (F49): ism, ko'nikma, shahar, yo'nalish, hudud.
 * ARIA combobox: ↑/↓ — tanlash, Enter — ochish (tanlanmagan bo'lsa — oddiy qidiruv), Esc — yopish.
 */
export function SearchBox({
  id,
  value,
  onChange,
  onSubmit,
  onPick,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  /** Enter (taklif tanlanmagan) — qidiruvni darhol qo'llash */
  onSubmit: () => void;
  onPick: (s: SuggestionItem) => void;
  placeholder?: string;
}) {
  const til = useLocale();
  const listId = useId();
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const term = value.trim();

  useEffect(() => {
    if (!focused || term.length < 2) {
      setItems([]);
      setActive(-1);
      return;
    }
    const key = term.toLowerCase();
    const hit = cache.get(key);
    if (hit) {
      setItems(hit);
      setActive(-1);
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const json = (await res.json()) as SuggestResponse;
        const next = json.ok ? json.data.items : [];
        cache.set(key, next);
        setItems(next);
        setActive(-1);
      } catch {
        /* bekor qilindi yoki tarmoq xatosi — takliflarsiz davom etamiz */
      }
    }, 180);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [term, focused]);

  const visible = open && focused && items.length > 0;

  const pick = (s: SuggestionItem) => {
    setOpen(false);
    setActive(-1);
    onPick(s);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (visible && active >= 0 && items[active]) {
        e.preventDefault();
        pick(items[active]);
      } else {
        setOpen(false);
        onSubmit();
      }
    } else if (e.key === "Escape") {
      if (visible) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  };

  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
        className="field !h-11 !pl-10 !pr-10"
        placeholder={placeholder ?? tr(til, FILTR.searchPlaceholder)}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (blurTimer.current) window.clearTimeout(blurTimer.current);
          setFocused(true);
          setOpen(true);
        }}
        onBlur={() => {
          // Ro'yxatdagi bosish blur'dan keyin keladi — biroz kutamiz
          blurTimer.current = window.setTimeout(() => setFocused(false), 120);
        }}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={80}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          aria-label={tr(til, FILTR.searchClear)}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-fg"
        >
          <X size={14} />
        </button>
      )}

      <ul
        id={listId}
        role="listbox"
        aria-label={tr(til, FILTR.suggestionsAria)}
        hidden={!visible}
        className="pop-in card-elevated absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-[320px] overflow-y-auto p-1.5"
      >
        {items.map((s, i) => {
          const Icon = TYPE_ICON[s.type];
          return (
            <li
              key={`${s.type}:${s.href}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(s)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-[14px] transition",
                i === active ? "bg-fg/6 text-fg" : "text-fg-2",
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-surface-3 text-fg-3">
                <Icon size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-fg">{s.label}</span>
                {s.hint && <span className="block truncate text-[12px] text-fg-3">{s.hint}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
