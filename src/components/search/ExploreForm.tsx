"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Clock3, Search, Sparkles, X } from "lucide-react";
import { Spinner } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { QIDIRUV } from "@/lib/i18n/dict/search";
import { cn } from "@/lib/utils";

/** ⌘K paleti bilan bir xil kalit — tarix ikkala joyda ko'rinadi */
const RECENT_KEY = "qidiruv-tarixi";
const DEBOUNCE_MS = 450;

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}
function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)));
  } catch {
    /* xususiy rejim */
  }
}
function hrefOf(q: string, type: string) {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (type !== "all") sp.set("type", type);
  const s = sp.toString();
  return s ? `/qidiruv?${s}` : "/qidiruv";
}

/**
 * /qidiruv formasi: yozish bilan qidiradi (450 ms debounce; eskirgan so'rov bekor qilinadi, URL `replace`),
 * Enter — darhol. So'rov bo'sh bo'lsa — so'nggi qidiruvlar (localStorage) va ommabop so'zlar chiplari.
 * JS'siz ham ishlaydi: oddiy GET forma.
 */
export function ExploreForm({ q, type, popular }: { q: string; type: string; popular: string[] }) {
  const til = useLocale();
  const router = useRouter();
  const [value, setValue] = useState(q);
  const [recent, setRecent] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const timer = useRef<number | null>(null);
  const lastNav = useRef(q);
  const inputRef = useRef<HTMLInputElement>(null);

  // URL tashqaridan o'zgarsa (chip, orqaga) — maydon sinxronlanadi
  useEffect(() => {
    setValue(q);
    lastNav.current = q;
  }, [q]);
  useEffect(() => setRecent(readRecent()), []);

  const go = (next: string, replace: boolean) => {
    const term = next.trim().slice(0, 80);
    if (term === lastNav.current) return;
    lastNav.current = term;
    if (term.length >= 2) {
      const list = [term, ...readRecent().filter((r) => r !== term)];
      writeRecent(list);
      setRecent(list.slice(0, 6));
    }
    startTransition(() => {
      if (replace) router.replace(hrefOf(term, type), { scroll: false });
      else router.push(hrefOf(term, type), { scroll: false });
    });
  };

  // Debounce: har bir yangi harf oldingi kutishni bekor qiladi (abort)
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const term = value.trim();
    if (term === lastNav.current) return;
    if (term.length === 1) return; // bitta harf — kutamiz
    timer.current = window.setTimeout(() => go(value, true), DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (timer.current) window.clearTimeout(timer.current);
    go(value, false);
  };
  const removeRecent = (r: string) => {
    const list = recent.filter((x) => x !== r);
    writeRecent(list);
    setRecent(list);
  };
  const pick = (term: string) => {
    setValue(term);
    go(term, false);
  };

  const showChips = value.trim().length < 2 && (recent.length > 0 || popular.length > 0);

  return (
    <div>
      <form action="/qidiruv" method="get" role="search" onSubmit={onSubmit} className="card m-flat mt-6 flex flex-col gap-3 p-3 max-sm:mt-3 max-sm:!border-0 sm:flex-row sm:items-center">
        {type !== "all" && <input type="hidden" name="type" value={type} />}
        <label className="relative min-w-0 flex-1">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
          <input
            ref={inputRef}
            data-search-input
            name="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={80}
            placeholder={tr(til, QIDIRUV.placeholder)}
            aria-label={tr(til, QIDIRUV.inputAria)}
            autoComplete="off"
            enterKeyHint="search"
            className="field h-13 w-full pl-12 pr-11 text-[15px]"
          />
          {pending ? (
            <Spinner className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
          ) : (
            value && (
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  go("", true);
                  inputRef.current?.focus();
                }}
                aria-label={tr(til, QIDIRUV.clear)}
                className="press absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg"
              >
                <X size={15} />
              </button>
            )
          )}
        </label>
        <button type="submit" className="btn-ink press inline-flex h-13 items-center justify-center rounded-full px-6 text-[15px] font-semibold max-sm:hidden">
          {tr(til, QIDIRUV.submit)}
        </button>
      </form>

      {showChips && (
        <div className="expand-in mt-3 flex flex-col gap-2">
          {recent.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 pr-1 text-[12px] font-semibold text-fg-3">
                <Clock3 size={12} aria-hidden /> {tr(til, QIDIRUV.recent)}
              </span>
              {recent.map((r) => (
                <span key={r} className="inline-flex h-8 items-center rounded-full border border-line pl-3 pr-1 text-[12.5px] font-medium text-fg-2">
                  <button type="button" onClick={() => pick(r)} className="press max-w-[160px] truncate hover:text-fg">
                    {r}
                  </button>
                  <button type="button" onClick={() => removeRecent(r)} aria-label={QIDIRUV.recentRemove[til](r)} className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full text-fg-4 transition hover:bg-fg/6 hover:text-fg">
                    <X size={11} />
                  </button>
                </span>
              ))}
              <button type="button" onClick={() => (writeRecent([]), setRecent([]))} className="press h-8 rounded-full px-2.5 text-[12px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg">
                {tr(til, QIDIRUV.recentClear)}
              </button>
            </div>
          )}
          {popular.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 pr-1 text-[12px] font-semibold text-fg-3">
                <Sparkles size={12} aria-hidden /> {tr(til, QIDIRUV.popular)}
              </span>
              {popular.map((p) => (
                <button key={p} type="button" onClick={() => pick(p)} className={cn("press inline-flex h-8 items-center rounded-full border border-line px-3 text-[12.5px] font-medium text-fg-2 transition hover:border-fg hover:text-fg")}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
