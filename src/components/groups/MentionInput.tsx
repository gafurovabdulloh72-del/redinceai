"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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
 * A11y: listbox id'si `useId` (bir sahifada bir nechta maydon), `aria-activedescendant` faol variantga ishora qiladi.
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
  onFocus,
  onBlur,
  onPaste,
  trailing,
  placement = "auto",
  inputRef,
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
  onFocus?: () => void;
  onBlur?: () => void;
  /** Clipboard'dan rasm qo'yish (kompozitor) */
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  /** Maydon ichida o'ngda ko'rsatiladigan element (masalan, hisoblagich) */
  trailing?: ReactNode;
  /** Ro'yxat qayerda ochiladi: auto — pastda joy kam bo'lsa (yoki overflow-hidden karta ichida chat kompozitori) tepada */
  placement?: "auto" | "up" | "down";
  /** Tashqaridan fokus/kursor boshqarish uchun */
  inputRef?: (el: HTMLTextAreaElement | HTMLInputElement | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const listId = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(placement === "up");
  const [maxH, setMaxH] = useState(256);
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
        if (cache.size > 200) cache.clear(); // xotira chegarasi (uzoq sessiyalarda o'smasin)
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

  // Joylashuv: eng yaqin overflow-hidden/auto ota element (masalan guruh chati kartasi) va viewport chegaralari ichida
  // qaysi tomonda joy ko'proq bo'lsa — o'sha tomonga ochiladi; balandlik mavjud joyga moslanadi.
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let top = 0;
    let bottom = window.innerHeight;
    let node: HTMLElement | null = el.parentElement;
    while (node && node !== document.body) {
      const ov = getComputedStyle(node).overflowY;
      if (ov === "hidden" || ov === "auto" || ov === "scroll" || ov === "clip") {
        const b = node.getBoundingClientRect();
        top = Math.max(top, b.top);
        bottom = Math.min(bottom, b.bottom);
        break;
      }
      node = node.parentElement;
    }
    // Telefonda yuqori panel fixed — ro'yxat uning ostida qolmasin
    const hdr = document.querySelector<HTMLElement>("header");
    if (hdr && getComputedStyle(hdr).position === "fixed") top = Math.max(top, hdr.getBoundingClientRect().bottom);
    const below = bottom - r.bottom - 8;
    const above = r.top - top - 8;
    const goUp = placement === "up" || (placement === "auto" && below < 280 && above > below);
    setUp(goUp);
    setMaxH(Math.max(120, Math.min(256, goUp ? above : below)));
  }, [open, placement]);

  // Faol variant ko'rinishda tursin (klaviatura bilan yurganda)
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);

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
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        setActive(e.key === "Home" ? 0 : items.length - 1);
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
    "aria-controls": open ? listId : undefined,
    "aria-activedescendant": open ? `${listId}-${active}` : undefined,
    onKeyDown: keyDown,
    onKeyUp: detect,
    onClick: detect,
    onFocus,
    onPaste,
    onBlur: () => {
      window.setTimeout(() => setQuery(null), 120);
      onBlur?.();
    },
    className,
  };
  const setRef = (el: HTMLTextAreaElement | HTMLInputElement | null) => {
    ref.current = el;
    inputRef?.(el);
  };

  return (
    <div className={cn("relative", wrapperClassName)}>
      {multiline ? (
        <textarea
          ref={setRef}
          rows={rows}
          onChange={(e) => {
            onChange(e.target.value);
            requestAnimationFrame(detect);
          }}
          {...common}
        />
      ) : (
        <input
          ref={setRef}
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
        <ul id={listId} role="listbox" aria-label="Foydalanuvchilar" style={{ maxHeight: maxH }} className={cn("card-floating pop-in absolute left-0 z-30 w-full max-w-sm overflow-auto p-1", up ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]")}>
          {items.map((s, i) => (
            <li key={s.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
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
