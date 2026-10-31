"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bookmark, Check, Heart, Link2, MessageSquareShare, Send, Share2, X } from "lucide-react";
import { usePresence } from "@/components/motion/usePresence";
import { LIKE_EVENT } from "./PostParts";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { Avatar } from "@/components/ui";
import { REACTIONS, REACTION_BY_KEY, type ReactionKind } from "@/lib/groups/limits";
import type { ReactionCounts, UserBrief } from "@/lib/groups/service";
import { tr } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import { cn } from "@/lib/utils";
import { EmojiSticker, EmojiStack } from "@/components/social/EmojiSticker";

type ApiResp<T> = { ok: boolean; data?: T; error?: string };

export interface ReactionState {
  liked: boolean;
  likesCount: number;
  myReaction: ReactionKind | null;
  reactions: ReactionCounts;
}

/** Postning doimiy havolasi (nisbiy): jamoa posti → /jamoalar/<slug>?post=, profil posti → /mutaxassislar/<slug>?post=, aks holda /?post= */
export function postPermalink(post: { id: string; author: { slug: string | null } }, groupSlug?: string | null): string {
  if (groupSlug) return `/jamoalar/${groupSlug}?post=${post.id}`;
  if (post.author.slug) return `/mutaxassislar/${post.author.slug}?post=${post.id}`;
  return `/?post=${post.id}`;
}

function topKinds(counts: ReactionCounts, exclude: ReactionKind | null, n: number): ReactionKind[] {
  return (Object.entries(counts) as Array<[ReactionKind, number]>)
    .filter(([k, v]) => v > 0 && k !== exclude)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

/* ------------------------------------------------------------------ */
/* Umumiy dialog (modal / telefonda pastdan)                            */
/* ------------------------------------------------------------------ */
/** Kichik dialog: portal, Esc/fon yopadi, ochilganda birinchi fokuslanadigan elementga, yopilganda ochgan tugmaga fokus qaytadi */
export function MiniDialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const til = useLocale();
  const { mounted, closing } = usePresence(open, 180);
  const [ready, setReady] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panel.current?.querySelector<HTMLElement>("button, [href], input, [tabindex]")?.focus(), 40);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener.current?.focus?.();
    };
  }, [open, onClose]);
  if (!mounted || !ready) return null;
  return createPortal(
    <div className={cn("fixed inset-0 z-[125] flex items-end justify-center bg-black/60 sm:items-center sm:p-6", closing ? "animate-fade-out" : "animate-fade-in")} role="presentation" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "card-elevated flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden !rounded-b-none !rounded-t-[20px] sm:!rounded-[20px]",
          closing ? "animate-modal-out max-sm:animate-sheet-down" : "animate-modal-in max-sm:animate-sheet-up",
        )}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-fg">{title}</h2>
          <button type="button" onClick={onClose} aria-label={tr(til, FEED.close)} className="press flex h-9 w-9 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Reaksiya tugmasi                                                    */
/* ------------------------------------------------------------------ */
/**
 * Reaksiya tugmasi (Facebook/Telegram uslubi): bosish — ❤️ (yoki joriy reaksiyani olib tashlash);
 * sichqonchani ustida ushlab turish / telefonda uzoq bosish / ↑ tugmasi — 6 ta reaksiya tanlagichi (←/→, Esc fokusni qaytaradi).
 * Optimistik yangilanish, xato bo'lsa qaytariladi. `canInteract=false` (jamoa a'zosi emas) — o'chirilgan, sabab title'da.
 * `showCount=false` — son alohida ReactorsButton'da ko'rsatiladi (lenta kartasi).
 */
export function ReactionButton({
  postId,
  initial,
  canInteract,
  requireLogin,
  lockedTitle,
  size = "md",
  showCount = true,
  onChange,
}: {
  postId: string;
  initial: { likesCount: number; myReaction: ReactionKind | null; reactions: ReactionCounts };
  canInteract: boolean;
  requireLogin: () => boolean;
  lockedTitle?: string;
  size?: "md" | "lg";
  showCount?: boolean;
  onChange?: (state: ReactionState) => void;
}) {
  const til = useLocale();
  const { toast } = useToast();
  const [my, setMy] = useState<ReactionKind | null>(initial.myReaction);
  const [total, setTotal] = useState(initial.likesCount);
  const [counts, setCounts] = useState<ReactionCounts>(initial.reactions);
  const [open, setOpen] = useState(false);
  const [viaKeyboard, setViaKeyboard] = useState(false);
  const picker = usePresence(open, 160);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const busy = useRef(false);

  const clearTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => () => clearTimer(), []);
  useEffect(() => {
    if (!open) {
      // Tanlagich yopilganda uzoq bosish bayrog'i tozalanadi — keyingi oddiy bosish yutilib ketmasin
      const t = window.setTimeout(() => {
        suppressClick.current = false;
      }, 250);
      return () => window.clearTimeout(t);
    }
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const els = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? []);
        if (!els.length) return;
        e.preventDefault();
        const i = els.indexOf(document.activeElement as HTMLElement);
        els[(i + (e.key === "ArrowRight" ? 1 : -1) + els.length) % els.length]?.focus();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    let t: number | null = null;
    if (viaKeyboard) t = window.setTimeout(() => (menuRef.current?.querySelector<HTMLElement>("[aria-checked=true]") ?? menuRef.current?.querySelector<HTMLElement>("[role=menuitemradio]"))?.focus(), 30);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      if (t) window.clearTimeout(t);
    };
  }, [open, viaKeyboard]);

  async function send(kind: ReactionKind) {
    setOpen(false);
    if (!requireLogin() || !canInteract || busy.current) return;
    busy.current = true;
    const prev = { my, total, counts };
    // Optimistik: shu reaksiya → olib tashlash; boshqasi → almashtirish; yo'q → qo'shish
    const next: ReactionCounts = { ...counts };
    let nextTotal = total;
    let nextMy: ReactionKind | null;
    if (my === kind) {
      next[kind] = Math.max(0, (next[kind] ?? 0) - 1);
      nextTotal = Math.max(0, total - 1);
      nextMy = null;
    } else {
      if (my) next[my] = Math.max(0, (next[my] ?? 0) - 1);
      else nextTotal = total + 1;
      next[kind] = (next[kind] ?? 0) + 1;
      nextMy = kind;
    }
    setMy(nextMy);
    setTotal(nextTotal);
    setCounts(next);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/like`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reaction: kind }) });
      const j = (await res.json()) as ApiResp<ReactionState>;
      if (!res.ok || !j.ok || !j.data) throw new Error(j.error || "Bo'lmadi");
      setMy(j.data.myReaction);
      setTotal(j.data.likesCount);
      setCounts(j.data.reactions);
      onChange?.(j.data);
    } catch (e) {
      setMy(prev.my);
      setTotal(prev.total);
      setCounts(prev.counts);
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    } finally {
      busy.current = false;
    }
  }

  // Rasmga ikki marta bosilganda (MediaGrid) — reaksiya yo'q bo'lsa yurak qo'yiladi, bor bo'lsa tegilmaydi
  const myRef = useRef(my);
  myRef.current = my;
  useEffect(() => {
    const onLike = (e: Event) => {
      const d = (e as CustomEvent<{ postId: string }>).detail;
      if (d?.postId !== postId || myRef.current) return;
      void send("heart");
    };
    window.addEventListener(LIKE_EVENT, onLike);
    return () => window.removeEventListener(LIKE_EVENT, onLike);
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = !canInteract && Boolean(lockedTitle);
  const others = showCount ? topKinds(counts, my, 3) : [];
  const lg = size === "lg";

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        data-action="like"
        aria-pressed={my !== null}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={locked}
        title={locked ? lockedTitle : my ? REACTION_BY_KEY[my].label : tr(til, FEED.reactionTitle)}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          void send(my ?? "heart");
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse" || locked) return;
          clearTimer();
          timer.current = window.setTimeout(() => {
            setViaKeyboard(false);
            setOpen(true);
          }, 380);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "mouse") return;
          clearTimer();
          timer.current = window.setTimeout(() => setOpen(false), 320);
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" || locked) return;
          clearTimer();
          timer.current = window.setTimeout(() => {
            suppressClick.current = true;
            setViaKeyboard(false);
            setOpen(true);
            try {
              navigator.vibrate?.(8);
            } catch {}
          }, 420);
        }}
        onPointerUp={clearTimer}
        onPointerCancel={() => {
          clearTimer();
          suppressClick.current = false;
        }}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey)) {
            e.preventDefault();
            setViaKeyboard(true);
            setOpen(true);
          }
        }}
        className={cn(
          "press inline-flex items-center gap-1.5 rounded-full font-semibold transition disabled:opacity-50",
          lg ? "h-10 px-3 text-[13px]" : "h-9 px-2.5 text-[13px] max-sm:h-10",
          my ? "bg-accent-soft text-accent-text" : "text-fg-2 hover:bg-fg/6 hover:text-fg",
        )}
      >
        {my ? (
          <span key={my} className="animate-heartbeat inline-flex leading-none" aria-hidden>
            <EmojiSticker e={REACTION_BY_KEY[my].emoji} size={20} />
          </span>
        ) : (
          <Heart size={18} />
        )}
        {showCount && total > 0 && (
          <span key={total} className="animate-swap tabular-nums">
            {total}
          </span>
        )}
        {others.length > 0 && (
          <span className="ml-0.5 inline-flex leading-none opacity-90" aria-label={others.map((k) => REACTION_BY_KEY[k].label).join(", ")}>
            <EmojiStack list={others.map((k) => REACTION_BY_KEY[k].emoji)} size={14} />
          </span>
        )}
        <span className="sr-only">{my ? `Sizning reaksiyangiz: ${REACTION_BY_KEY[my].label}` : "Reaksiya"}</span>
      </button>

      {picker.mounted && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Reaksiyalar"
          onPointerEnter={clearTimer}
          onPointerLeave={(e) => {
            if (e.pointerType !== "mouse") return;
            clearTimer();
            timer.current = window.setTimeout(() => setOpen(false), 320);
          }}
          className={cn("card-floating absolute bottom-[calc(100%+6px)] left-0 z-20 flex items-center gap-0.5 !rounded-full px-1.5 py-1", picker.closing ? "animate-modal-out" : "animate-modal-in")}
        >
          {REACTIONS.map((r, i) => (
            <button
              key={r.key}
              type="button"
              role="menuitemradio"
              aria-checked={my === r.key}
              title={r.label}
              onClick={() => void send(r.key)}
              style={{ animationDelay: `${i * 28}ms` }}
              className={cn(
                "animate-pop flex h-10 w-10 items-center justify-center rounded-full leading-none transition-transform duration-150 hover:-translate-y-1 hover:scale-125 focus-visible:scale-125 focus-visible:outline-none",
                my === r.key && "bg-accent-soft",
              )}
            >
              <EmojiSticker e={r.emoji} size={30} />
              <span className="sr-only">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kim reaksiya qo'ydi                                                 */
/* ------------------------------------------------------------------ */
interface ReactorRow extends UserBrief {
  reaction: ReactionKind;
  at: number;
}

/** Reaksiyalar yig'indisi (emoji'lar + son) — bosilganda «Kim reaksiya qo'ydi» oynasi; 0 bo'lsa chiqmaydi */
export function ReactorsButton({ postId, total, counts, className }: { postId: string; total: number; counts: ReactionCounts; className?: string }) {
  const til = useLocale();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ReactionKind | null>(null);
  const [items, setItems] = useState<ReactorRow[] | null>(null);
  const [error, setError] = useState(false);
  const top = topKinds(counts, null, 3);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setItems(null);
    setError(false);
    fetch(`/api/posts/${encodeURIComponent(postId)}/reactions${kind ? `?kind=${kind}` : ""}`)
      .then((r) => r.json() as Promise<ApiResp<{ items: ReactorRow[] }>>)
      .then((j) => {
        if (cancelled) return;
        if (j.ok && j.data) setItems(j.data.items);
        else setError(true);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [open, kind, postId]);
  if (total <= 0) return null;
  const kinds = (Object.entries(counts) as Array<[ReactionKind, number]>).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`${tr(til, FEED.whoReacted)} (${total})`} title={tr(til, FEED.whoReacted)} className={cn("press inline-flex h-9 items-center gap-1 rounded-full px-1.5 text-[13px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg", className)}>
        <span className="inline-flex leading-none" aria-hidden>
          <EmojiStack list={top.map((k) => REACTION_BY_KEY[k].emoji)} size={16} />
        </span>
        <span key={total} className="animate-swap tabular-nums">
          {total}
        </span>
      </button>
      <MiniDialog open={open} onClose={() => setOpen(false)} title={tr(til, FEED.whoReacted)}>
        {kinds.length > 1 && (
          <div className="no-scrollbar mb-2 flex gap-1 overflow-x-auto px-2" role="tablist" aria-label="Reaksiya turi">
            <button type="button" role="tab" aria-selected={kind === null} onClick={() => setKind(null)} className={cn("pill h-8 shrink-0 px-3 text-[12.5px] font-semibold", kind === null ? "bg-fg text-surface" : "text-fg-2 hover:text-fg")}>
              {tr(til, FEED.all)} {total}
            </button>
            {kinds.map(([k, n]) => (
              <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cn("pill h-8 shrink-0 px-3 text-[12.5px] font-semibold", kind === k ? "bg-fg text-surface" : "text-fg-2 hover:text-fg")}>
                <EmojiSticker e={REACTION_BY_KEY[k].emoji} size={16} className="mr-1" /> {n}
              </button>
            ))}
          </div>
        )}
        {error ? (
          <p role="alert" className="px-3 py-6 text-center text-[13px] text-danger-text">
            {tr(til, FEED.loadFailed)}
          </p>
        ) : !items ? (
          <ul className="grid gap-1 px-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 px-2 py-2">
                <span className="skeleton h-9 w-9 !rounded-full" />
                <span className="skeleton h-3 w-32" />
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-fg-3">{tr(til, FEED.nobodyYet)}</p>
        ) : (
          <ul className="stagger grid gap-0.5 px-1">
            {items.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-[12px] px-2 py-1.5 transition hover:bg-fg/4">
                <Avatar name={u.name} src={u.avatarUrl} size={36} decorative />
                <span className="min-w-0 flex-1">
                  {u.slug ? (
                    <a href={`/mutaxassislar/${u.slug}`} className="block truncate text-[13.5px] font-semibold text-fg hover:underline">
                      {u.name}
                    </a>
                  ) : (
                    <span className="block truncate text-[13.5px] font-semibold text-fg">{u.name}</span>
                  )}
                  {u.username && <span className="block truncate text-[12px] text-fg-3">@{u.username}</span>}
                </span>
                <span className="inline-flex leading-none" title={REACTION_BY_KEY[u.reaction].label}>
                  <EmojiSticker e={REACTION_BY_KEY[u.reaction].emoji} size={22} label={REACTION_BY_KEY[u.reaction].label} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </MiniDialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Saqlash                                                             */
/* ------------------------------------------------------------------ */
/** Postni saqlash (bookmark) — Kabinet › Saqlanganlar */
export function SaveButton({ postId, initial, requireLogin, size = "md", className }: { postId: string; initial: boolean; requireLogin: () => boolean; size?: "md" | "lg"; className?: string }) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(initial);
  const busy = useRef(false);
  async function toggle() {
    if (!requireLogin() || busy.current) return;
    busy.current = true;
    const prev = saved;
    setSaved(!saved);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/save`, { method: "POST" });
      const j = (await res.json()) as ApiResp<{ saved: boolean }>;
      if (!res.ok || !j.ok || !j.data) throw new Error(j.error || "Bo'lmadi");
      setSaved(j.data.saved);
      toast(j.data.saved ? "Saqlandi — Kabinet › Saqlanganlar" : "Saqlanganlardan olindi", j.data.saved ? "success" : "info");
    } catch (e) {
      setSaved(prev);
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    } finally {
      busy.current = false;
    }
  }
  return (
    <button
      type="button"
      data-action="save"
      onClick={() => void toggle()}
      aria-pressed={saved}
      aria-label={saved ? "Saqlanganlardan olish" : "Postni saqlash"}
      title={saved ? "Saqlangan — olish" : "Saqlash"}
      className={cn("press flex items-center justify-center rounded-full transition", size === "lg" ? "h-10 w-10" : "h-9 w-9 max-sm:h-10 max-sm:w-10", saved ? "text-fg" : "text-fg-3 hover:bg-fg/6 hover:text-fg", className)}
    >
      <Bookmark key={saved ? "on" : "off"} size={18} className={cn(saved && "animate-pop fill-current")} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Ulashish: menyu (havola · Telegram · xabarda yuborish)               */
/* ------------------------------------------------------------------ */
interface ConvRow {
  id: string;
  peer: { id: string; name: string; avatarUrl: string | null; username?: string | null };
}

/**
 * Ulashish tugmasi — bitta komponent hamma joyda: telefonda tizim oynasi (navigator.share) birinchi band,
 * havola nusxasi, Telegram, kirganlar uchun «Xabarda yuborish» (suhbatlar ro'yxatidan tanlanadi).
 */
export function ShareAction({ url, title, size = "md", label = false, loggedIn = false }: { url: string; title?: string; size?: "md" | "lg"; label?: boolean; loggedIn?: boolean }) {
  const til = useLocale();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [dm, setDm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [convs, setConvs] = useState<ConvRow[] | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [canNative, setCanNative] = useState(false);
  const presence = usePresence(open, 160);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const abs = () => (url.startsWith("http") ? url : `${window.location.origin}${url}`);

  useEffect(() => {
    setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => {
    if (!dm || convs) return;
    fetch("/api/chat")
      .then((r) => r.json() as Promise<ApiResp<{ items: ConvRow[] }>>)
      .then((j) => setConvs(j.ok && j.data ? j.data.items : []))
      .catch(() => setConvs([]));
  }, [dm, convs]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(abs());
      // Menyu ✓ ko'rsatib, biroz o'tib yopiladi
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 900);
    } catch {
      setOpen(false);
      toast(abs(), "info");
    }
  }
  async function native() {
    setOpen(false);
    try {
      await navigator.share({ url: abs(), title: title || "Kasb Egalari" });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      await copy();
    }
  }
  async function sendTo(convId: string) {
    if (sending) return;
    setSending(convId);
    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(convId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: `${title ? `${title}\n` : ""}${abs()}` }) });
      const j = (await res.json()) as ApiResp<unknown>;
      if (!res.ok || !j.ok) throw new Error(j.error || "Yuborilmadi");
      toast(tr(til, FEED.sentToDm));
      setDm(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Yuborilmadi", "error");
    } finally {
      setSending(null);
    }
  }
  const tg = () => `https://t.me/share/url?url=${encodeURIComponent(abs())}&text=${encodeURIComponent(title || "Kasb Egalari")}`;
  const row = "flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] font-semibold text-fg transition hover:bg-fg/6 focus-visible:bg-fg/6 focus-visible:outline-none";

  return (
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={tr(til, FEED.share)}
        title={tr(til, FEED.share)}
        className={cn("press inline-flex items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg", size === "lg" ? "h-10 min-w-10" : "h-9 min-w-9 max-sm:h-10 max-sm:min-w-10", label ? "px-3" : "px-0", open && "bg-fg/6 text-fg")}
      >
        <Share2 size={18} /> {label && <span className="hidden sm:inline">{tr(til, FEED.share)}</span>}
      </button>
      {presence.mounted && (
        <div role="menu" aria-label={tr(til, FEED.share)} className={cn("card-floating absolute bottom-[calc(100%+6px)] left-0 z-30 min-w-[210px] origin-bottom-left p-1", presence.closing ? "pop-out" : "pop-in")}>
          {canNative && (
            <button type="button" role="menuitem" onClick={() => void native()} className={row}>
              <Share2 size={16} className="text-fg-3" /> {tr(til, FEED.share)}…
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => void copy()} className={row}>
            {copied ? <Check key="ok" size={16} className="animate-pop text-success-text" /> : <Link2 key="l" size={16} className="text-fg-3" />} {copied ? tr(til, FEED.linkCopied) : tr(til, FEED.copyLink)}
          </button>
          <a role="menuitem" href={tg()} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={row}>
            <Send size={16} className="text-fg-3" /> {tr(til, FEED.shareTelegram)}
          </a>
          {loggedIn && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setDm(true);
              }}
              className={row}
            >
              <MessageSquareShare size={16} className="text-fg-3" /> {tr(til, FEED.shareDm)}
            </button>
          )}
        </div>
      )}
      <MiniDialog open={dm} onClose={() => setDm(false)} title={tr(til, FEED.pickChat)}>
        {!convs ? (
          <ul className="grid gap-1 px-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 px-2 py-2">
                <span className="skeleton h-9 w-9 !rounded-full" />
                <span className="skeleton h-3 w-32" />
              </li>
            ))}
          </ul>
        ) : convs.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-fg-3">{tr(til, FEED.noChats)}</p>
        ) : (
          <ul className="stagger grid gap-0.5 px-1">
            {convs.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => void sendTo(c.id)} disabled={sending !== null} className="flex w-full items-center gap-3 rounded-[12px] px-2 py-1.5 text-left transition hover:bg-fg/4 disabled:opacity-60">
                  <Avatar name={c.peer.name} src={c.peer.avatarUrl} size={36} decorative />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-fg">{c.peer.name}</span>
                    {c.peer.username && <span className="block truncate text-[12px] text-fg-3">@{c.peer.username}</span>}
                  </span>
                  <Send size={15} className={cn("shrink-0 text-fg-3", sending === c.id && "animate-pulse")} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </MiniDialog>
    </div>
  );
}
