"use client";

import { usePresence } from "@/components/motion/usePresence";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, CircleHelp, Clapperboard, CornerDownLeft, FileText, Search, UsersRound, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
const QUICK: Item[] = [
  { title: "Ijodkorlar katalogi", sub: "Portfolio, narx, sharh", href: "/mutaxassislar" },
  { title: "Jamoalar va kanallar", sub: "Rasmiy kanal, efirlar", href: "/jamoalar" },
  { title: "Vakansiyalar", sub: "Onlayn ish o'rinlari", href: "/vakansiyalar" },
  { title: "Vakansiya joylash", sub: "Bepul", href: "/vakansiyalar/yangi" },
  { title: "Kabinet", sub: "Buyurtmalar va chat", href: "/kabinet" },
];
const RECENT_KEY = "qidiruv-tarixi";

/**
 * Global qidiruv paleti (Spotlight uslubi): ⌘K / Ctrl+K yoki "open-search" hodisasi ochadi.
 * Natijalar bo'limlar bo'yicha, strelkalar bilan yuriladi, Enter ochadi, Esc yopadi; so'nggi qidiruvlar eslab qolinadi.
 */
export function CommandPalette() {
  const router = useRouter();
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
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"));
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

  const flat: Item[] = q.trim().length >= 2 ? sections.flatMap((s) => s.items) : QUICK;

  function go(item: Item) {
    const term = q.trim();
    if (term.length >= 2) {
      const next = [term, ...recent.filter((r) => r !== term)].slice(0, 6);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* xususiy rejim */
      }
    }
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
  return (
    <div className={`fixed inset-0 z-[130] flex items-start justify-center bg-ink/40 px-3 pt-[12vh] backdrop-blur-sm ${closing ? "animate-fade-out" : "animate-fade-in"}`} onClick={close} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Qidiruv" onClick={(e) => e.stopPropagation()} className={`card-floating w-full max-w-xl overflow-hidden !rounded-[22px] ${closing ? "animate-modal-out" : "animate-modal-in"}`}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="shrink-0 text-fg-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ijodkor, vakansiya, jamoa, sahifa…"
            aria-label="Qidiruv"
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-fg-4"
            autoComplete="off"
          />
          {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-fg/20 border-t-fg" aria-label="Yuklanmoqda" />}
          <button type="button" onClick={close} aria-label="Yopish" className="flex h-8 w-8 items-center justify-center rounded-full text-fg-3 hover:bg-fg/6 hover:text-fg">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[min(60vh,520px)] overflow-y-auto p-2">
          {q.trim().length < 2 ? (
            <>
              {recent.length > 0 && (
                <div className="px-2 pb-1 pt-2">
                  <p className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4">So&apos;nggi qidiruvlar</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {recent.map((r) => (
                      <button key={r} type="button" onClick={() => setQ(r)} className="rounded-full border border-line px-3 py-1 text-[12.5px] font-medium text-fg-2 hover:border-fg hover:text-fg">
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4">Tez o&apos;tish</p>
              <ul>
                {QUICK.map((it) => {
                  idx += 1;
                  const i = idx;
                  return <Row key={it.href} it={it} active={i === active} onHover={() => setActive(i)} onPick={() => go(it)} icon={ArrowRight} />;
                })}
              </ul>
            </>
          ) : sections.length === 0 && !loading ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[14px] font-semibold text-fg">Hech narsa topilmadi</p>
              <p className="mt-1 text-[12.5px] text-fg-3">Boshqa so&apos;z bilan urinib ko&apos;ring yoki Enter — to&apos;liq qidiruv (videolar, postlar, ijodkorlar)</p>
            </div>
          ) : (
            sections.map((s) => (
              <div key={s.key} className="pb-1">
                <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4">{s.label}</p>
                <ul>
                  {s.items.map((it) => {
                    idx += 1;
                    const i = idx;
                    return <Row key={it.href} it={it} active={i === active} onHover={() => setActive(i)} onPick={() => go(it)} icon={ICON[s.key] ?? Search} />;
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
        <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-[11.5px] text-fg-4 sm:flex">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded-md border border-line px-1.5 py-0.5 font-sans text-[11px]">↑↓</kbd> yurish
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded-md border border-line px-1.5 py-0.5 font-sans text-[11px]">
              <CornerDownLeft size={10} className="inline" />
            </kbd>{" "}
            ochish
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded-md border border-line px-1.5 py-0.5 font-sans text-[11px]">esc</kbd> yopish
          </span>
          <span className="ml-auto">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}

function Row({ it, active, onHover, onPick, icon: Icon }: { it: Item; active: boolean; onHover: () => void; onPick: () => void; icon: typeof Search }) {
  return (
    <li>
      <button
        type="button"
        onMouseEnter={onHover}
        onClick={onPick}
        className={cn("flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors", active ? "bg-fg/6" : "hover:bg-fg/4")}
        aria-selected={active}
      >
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]", active ? "bg-ink text-ink-fg" : "bg-fg/6 text-fg-2")}>
          <Icon size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-fg">{it.title}</span>
          {it.sub && <span className="block truncate text-[12px] text-fg-3">{it.sub}</span>}
        </span>
        {active && <CornerDownLeft size={14} className="shrink-0 text-fg-4" />}
      </button>
    </li>
  );
}
