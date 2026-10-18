"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  slug: string | null;
}
type ApiResp<T> = { ok: boolean; data?: T };

/** Kursordan oldingi `@so'z` (bo'sh yoki qator boshidan keyin) */
const TRIGGER = /(^|\s)@([a-z0-9_.-]{0,32})$/i;
const cache = new Map<string, Suggestion[]>();

/**
 * @eslatma maydoni: textarea (multiline) yoki input. `@` yozilganda foydalanuvchi taklifi ro'yxati chiqadi
 * (/api/users/mention), ↑↓ / Enter / Tab bilan tanlanadi, Esc yopadi. Tanlangan `@username ` matnga qo'yiladi.
 * Server tomonda @username'lar bildirishnomaga aylanadi (lib/groups/mentions.ts).
 */
export function MentionField({
  value,
  onChange,
  multiline = false,
  className,
  wrapperClassName,
  placeholder,
  maxLength,
  rows = 3,
  autoFocus,
  disabled,
  ariaLabel,
  onKeyDown,
  trailing,
}: {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  className?: string;
  wrapperClassName?: string;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  /** Maydon ichida o'ngda ko'rsatiladigan element (masalan, hisoblagich) */
  trailing?: ReactNode;
}) {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  const detect = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? el.value.length;
    const m = TRIGGER.exec(el.value.slice(0, caret));
    if (m) {
      setQuery(m[2]);
      setStart(caret - m[2].length - 1);
    } else {
      setQuery(null);
    }
  }, []);

  useEffect(() => {
    if (query === null || query.length === 0) {
      setItems([]);
      return;
    }
    const q = query.toLowerCase();
    const hit = cache.get(q);
    if (hit) {
      setItems(hit);
      setActive(0);
      return;
    }
    const my = ++seq.current;
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/mention?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const j = (await res.json()) as ApiResp<{ items: Suggestion[] }>;
        const list = j.ok && j.data ? j.data.items : [];
        cache.set(q, list);
        if (seq.current === my) {
          setItems(list);
          setActive(0);
        }
      } catch {
        if (seq.current === my) setItems([]);
      }
    }, 180);
    return () => window.clearTimeout(t);
  }, [query]);

  const open = query !== null && items.length > 0;

  function pick(s: Suggestion) {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const next = `${value.slice(0, start)}@${s.username} ${value.slice(caret)}`;
    onChange(next);
    setQuery(null);
    setItems([]);
    const pos = start + s.username.length + 2;
    requestAnimationFrame(() => {
      el?.focus();
      try {
        el?.setSelectionRange(pos, pos);
      } catch {}
    });
  }

  function keyDown(e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % items.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + items.length) % items.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(items[active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }
    onKeyDown?.(e);
  }

  const common = {
    value,
    placeholder,
    maxLength,
    autoFocus,
    disabled,
    "aria-label": ariaLabel,
    "aria-autocomplete": "list" as const,
    "aria-expanded": open,
    "aria-controls": open ? "mention-listbox" : undefined,
    onKeyDown: keyDown,
    onKeyUp: detect,
    onClick: detect,
    onBlur: () => window.setTimeout(() => setQuery(null), 120),
    className,
  };

  return (
    <div className={cn("relative", wrapperClassName)}>
      {multiline ? (
        <textarea
          ref={(el) => {
            ref.current = el;
          }}
          rows={rows}
          onChange={(e) => {
            onChange(e.target.value);
            requestAnimationFrame(detect);
          }}
          {...common}
        />
      ) : (
        <input
          ref={(el) => {
            ref.current = el;
          }}
          type="text"
          onChange={(e) => {
            onChange(e.target.value);
            requestAnimationFrame(detect);
          }}
          {...common}
        />
      )}
      {trailing}
      {open && (
        <ul id="mention-listbox" role="listbox" aria-label="Foydalanuvchilar" className="card-floating absolute left-0 top-[calc(100%+4px)] z-30 max-h-64 w-full max-w-sm overflow-auto p-1">
          {items.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition", i === active ? "bg-fg/6" : "hover:bg-fg/4")}
              >
                <Avatar name={s.name} src={s.avatarUrl} size={28} decorative />
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-fg">{s.name}</span>
                  <span className="block truncate text-[12px] text-fg-3">@{s.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
