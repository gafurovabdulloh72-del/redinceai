"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, CircleHelp, Clapperboard, CornerDownLeft, FileText, Search, UsersRound, X } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { usePresence } from "@/components/motion/usePresence";
import { tr } from "@/lib/i18n";
import { PALET } from "@/lib/i18n/dict/search";
import { cn } from "@/lib/utils";
import { Highlight } from "./Highlight";

interface Item {
  title: string;
  sub?: string;
  href: string;
}
interface Section {
  key: string;
  label: string;
  items: Item[];
}

const ICON: Record<string, typeof Search> = { pages: FileText, specialists: Clapperboard, vacancies: Briefcase, groups: UsersRound, jobs: Briefcase, help: CircleHelp };
const RECENT_KEY = "qidiruv-tarixi";

/**
 * Global qidiruv paleti (Spotlight uslubi): ⌘K / Ctrl+K yoki "open-search" hodisasi ochadi.
 * Natijalar bo'limlar bo'yicha (listbox/option — aria-activedescendant bilan), ↑/↓ yuriladi, Enter ochadi, Esc yopadi;
 * mos matn ajratib ko'rsatiladi; so'nggi qidiruvlar eslab qolinadi (alohida o'chirish mumkin). Matnlar — PALET lug'ati.
 */
export function CommandPalette() {
  const til = useLocale();
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  const close = useCallback(() => setOpen(false), []);
  const { mounted: shown, closing } = usePresence(open, 180);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSections([]);
    setActive(0);
    try {
      const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      setRecent(Array.isArray(v) ? v.filter((x: unknown): x is string => typeof x === "string") : []);
    } catch {
      setRecent([]);
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setSections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ac.signal });
        const j = (await res.json()) as { ok: boolean; data?: { sections: Section[] } };
        if (!ac.signal.aborted) {
          setSections(j.ok && j.data ? j.data.sections : []);
          setActive(0);
        }
      } catch {
        /* bekor qilingan */
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(t);
  }, [q, open]);

  const quick: Item[] = PALET.quickItems.map((it) => ({ href: it.href, title: tr(til, it.title), sub: tr(til, it.sub) }));
  const searching = q.trim().length >= 2;
  const flat: Item[] = searching ? sections.flatMap((s) => s.items) : quick;

  function saveRecent(term: string) {
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 6);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* xususiy rejim */
    }
    setRecent(next);
  }
  function removeRecent(term: string) {
    const next = recent.filter((r) => r !== term);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* xususiy rejim */
    }
    setRecent(next);
  }
  function go(item: Item) {
    const term = q.trim();
    if (term.length >= 2) saveRecent(term);
    setOpen(false);
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = flat[active];
      if (it) go(it);
      else if (q.trim()) go({ title: q, href: `/qidiruv?q=${encodeURIComponent(q.trim())}` });
    }
  }

  if (!shown) return null;
  let idx = -1;
  const optId = (i: number) => `${listId}-${i}`;
  return (
    <div className={cn("fixed inset-0 z-[130] flex items-start justify-center bg-black/40 px-3 pt-[12vh]", closing ? "overlay-out" : "overlay-in")} onClick={close} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={tr(til, PALET.aria)} onClick={(e) => e.stopPropagation()} className={cn("card-floating w-full max-w-xl overflow-hidden !rounded-[var(--r-lg)]", closing ? "pop-out" : "pop-in")}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="shrink-0 text-fg-3" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={tr(til, PALET.placeholder)}
            aria-label={tr(til, PALET.aria)}
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={flat.length > 0 ? optId(active) : undefined}
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-fg-4"
            autoComplete="off"
          />
          {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-fg/20 border-t-fg" role="status" aria-label={tr(til, PALET.loading)} />}
          <button type="button" onClick={close} aria-label={tr(til, PALET.close)} className="press flex h-8 w-8 items-center justify-center rounded-full text-fg-3 hover:bg-fg/6 hover:text-fg">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[min(60vh,520px)] overflow-y-auto p-2">
          {!searching ? (
            <>
              {recent.length > 0 && (
                <div className="px-2 pb-1 pt-2">
                  <p className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4">{tr(til, PALET.recent)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {recent.map((r) => (
                      <span key={r} className="inline-flex h-8 items-center rounded-full border border-line pl-3 pr-1 text-[12.5px] font-medium text-fg-2">
                        <button type="button" onClick={() => setQ(r)} className="press max-w-[160px] truncate hover:text-fg">
                          {r}
                        </button>
                        <button type="button" onClick={() => removeRecent(r)} aria-label={`${r} ×`} className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full text-fg-4 transition hover:bg-fg/6 hover:text-fg">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4">{tr(til, PALET.quick)}</p>
              <ul id={listId} role="listbox" aria-label={tr(til, PALET.quick)}>
                {quick.map((it) => {
                  idx += 1;
                  const i = idx;
                  return <Row key={it.href} id={optId(i)} it={it} q="" active={i === active} onHover={() => setActive(i)} onPick={() => go(it)} icon={ArrowRight} />;
                })}
              </ul>
            </>
          ) : sections.length === 0 && !loading ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[14px] font-semibold text-fg">{tr(til, PALET.notFound)}</p>
              <p className="mt-1 text-[12.5px] text-fg-3">{tr(til, PALET.notFoundDesc)}</p>
              <button type="button" onClick={() => go({ title: q, href: `/qidiruv?q=${encodeURIComponent(q.trim())}` })} className="press mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-semibold text-fg transition hover:border-fg">
                <Search size={14} aria-hidden /> {PALET.fullSearch[til](q.trim())}
              </button>
            </div>
          ) : (
            <div id={listId} role="listbox" aria-label={tr(til, PALET.aria)}>
              {sections.map((s) => (
                <div key={s.key} className="pb-1" role="group" aria-label={PALET.sections[s.key] ? tr(til, PALET.sections[s.key]) : s.label}>
                  <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4" aria-hidden>
                    {PALET.sections[s.key] ? tr(til, PALET.sections[s.key]) : s.label}
                  </p>
                  <ul>
                    {s.items.map((it) => {
                      idx += 1;
                      const i = idx;
                      return <Row key={it.href} id={optId(i)} it={it} q={q} active={i === active} onHover={() => setActive(i)} onPick={() => go(it)} icon={ICON[s.key] ?? Search} />;
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-[11.5px] text-fg-4 sm:flex">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded-md border border-line px-1.5 py-0.5 font-sans text-[11px]">↑↓</kbd> {tr(til, PALET.hintNav)}
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded-md border border-line px-1.5 py-0.5 font-sans text-[11px]">
              <CornerDownLeft size={10} className="inline" />
            </kbd>{" "}
            {tr(til, PALET.hintOpen)}
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded-md border border-line px-1.5 py-0.5 font-sans text-[11px]">esc</kbd> {tr(til, PALET.hintClose)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ id, it, q, active, onHover, onPick, icon: Icon }: { id: string; it: Item; q: string; active: boolean; onHover: () => void; onPick: () => void; icon: typeof Search }) {
  return (
    <li id={id} role="option" aria-selected={active} onMouseEnter={onHover} onClick={onPick} className={cn("flex w-full cursor-pointer items-center gap-3 rounded-[var(--r-sm)] px-3 py-2.5 text-left transition-colors", active ? "bg-fg/6" : "hover:bg-fg/4")}>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)]", active ? "bg-ink text-ink-fg" : "bg-fg/6 text-fg-2")}>
        <Icon size={15} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-fg">
          <Highlight text={it.title} q={q} />
        </span>
        {it.sub && (
          <span className="block truncate text-[12px] text-fg-3">
            <Highlight text={it.sub} q={q} />
          </span>
        )}
      </span>
      {active && <CornerDownLeft size={14} className="shrink-0 text-fg-4" aria-hidden />}
    </li>
  );
}
