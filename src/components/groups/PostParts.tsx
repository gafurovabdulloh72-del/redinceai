"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BarChart3, ChevronLeft, ChevronRight, ExternalLink, Heart, MoreHorizontal, Volume2, VolumeX, X, type LucideIcon } from "lucide-react";
import { usePresence } from "@/components/motion/usePresence";
import { haptic } from "@/components/motion/haptics";
import { useIsPhone } from "@/components/motion/useMediaQuery";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { SafeImage } from "@/components/specialists/SafeImage";
import { isVideoAttachment, type Attachment } from "@/components/chat/attachments";
import { tr } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import type { PollView } from "@/lib/groups/posts-extra";
import { cn } from "@/lib/utils";

type ApiResp<T> = { ok: boolean; data?: T; error?: string };

/* ------------------------------------------------------------------ */
/* «…» menyu                                                            */
/* ------------------------------------------------------------------ */
export interface MenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
}

/**
 * Post sarlavhasidagi bitta «…» tugma: popover (pop-in/pop-out), role=menu, ↑↓ navigatsiya, Esc — fokus tugmaga qaytadi,
 * tashqariga bosilganda yopiladi. `extra` — ReportButton kabi o'z trigger'i bor element (oxirgi qator).
 */
export function PostMenu({ items, extra, label }: { items: MenuItem[]; extra?: ReactNode; label?: string }) {
  const til = useLocale();
  const [open, setOpen] = useState(false);
  const presence = usePresence(open, 160);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const visible = items.filter((i) => !i.hidden);
  // Telefonda — Instagram uslubidagi pastki varaq (katta qatorlar), keng ekranda popover
  const phone = useIsPhone();

  useEffect(() => {
    if (!open || phone) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const els = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        if (!els.length) return;
        e.preventDefault();
        const i = els.indexOf(document.activeElement as HTMLElement);
        els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    // Klaviaturadan ochilganda birinchi bandga fokus
    const t = window.setTimeout(() => menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), 30);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, phone]);

  if (!visible.length && !extra) return null;
  return (
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label ?? tr(til, FEED.menu)}
        title={label ?? tr(til, FEED.menu)}
        onClick={() => setOpen((v) => !v)}
        className={cn("press flex h-9 w-9 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg max-sm:h-10 max-sm:w-10", open && "bg-fg/6 text-fg")}
      >
        <MoreHorizontal size={18} />
      </button>
      {presence.mounted && phone && (
        <Sheet open={open} onClose={() => setOpen(false)} title={label ?? tr(til, FEED.menu)} size="sm">
          <ul className="-mx-1 divide-y divide-line">
            {visible.map((it) => (
              <li key={it.key}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    it.onSelect();
                  }}
                  className={cn("press flex h-13 w-full items-center gap-3 px-3 text-left text-[15.5px] font-semibold", it.danger ? "text-danger-text" : "text-fg")}
                >
                  {it.icon && <it.icon size={20} className={cn("shrink-0", it.danger ? "text-danger-text" : "text-fg-3")} />}
                  <span className="truncate">{it.label}</span>
                </button>
              </li>
            ))}
          </ul>
          {extra && <div className="mt-2 border-t border-line pt-2">{extra}</div>}
        </Sheet>
      )}
      {presence.mounted && !phone && (
        <div ref={menu} role="menu" aria-label={label ?? tr(til, FEED.menu)} className={cn("card-floating absolute right-0 top-[calc(100%+6px)] z-30 min-w-[200px] origin-top-right p-1", presence.closing ? "pop-out" : "pop-in")}>
          {visible.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={cn("flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] font-semibold transition hover:bg-fg/6 focus-visible:bg-fg/6 focus-visible:outline-none", it.danger ? "text-danger-text" : "text-fg")}
            >
              {it.icon && <it.icon size={16} className="shrink-0 text-fg-3" />}
              <span className="truncate">{it.label}</span>
            </button>
          ))}
          {extra && <div className="mt-0.5 border-t border-line pt-0.5">{extra}</div>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* So'rovnoma                                                          */
/* ------------------------------------------------------------------ */
/**
 * So'rovnoma bloki: ovoz bergunga qadar oddiy variantlar, ovozdan keyin (yoki yakunlanganda) foizli chiziqlar.
 * Bosish — ovoz; shu variant yana — qaytariladi; boshqasi — almashadi. Kirmagan — kirish sahifasiga.
 */
export function PollBlock({ postId, poll: initial, canInteract, requireLogin }: { postId: string; poll: PollView; canInteract: boolean; requireLogin: () => boolean }) {
  const til = useLocale();
  const { toast } = useToast();
  const [poll, setPoll] = useState(initial);
  const [busy, setBusy] = useState(false);
  const groupId = useId();
  const showResults = poll.myVote !== null || poll.closed;

  async function vote(idx: number) {
    if (!requireLogin() || !canInteract || busy || poll.closed) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/poll/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ option: idx }) });
      const j = (await res.json()) as ApiResp<PollView>;
      if (!res.ok || !j.ok || !j.data) throw new Error(j.error || tr(til, FEED.pollFailed));
      setPoll(j.data);
    } catch (e) {
      toast(e instanceof Error ? e.message : tr(til, FEED.pollFailed), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-[14px] border border-line p-3" role="group" aria-labelledby={groupId}>
      <p id={groupId} className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.1em] text-fg-3">
        <BarChart3 size={13} /> {tr(til, FEED.poll)}
        {poll.closed && <span className="ml-auto font-semibold normal-case tracking-normal text-fg-4">{tr(til, FEED.pollClosed)}</span>}
      </p>
      <ul className="mt-2 grid gap-1.5">
        {poll.options.map((o, i) => {
          const mine = poll.myVote === i;
          return (
            <li key={i}>
              <button
                type="button"
                aria-pressed={mine}
                disabled={busy || poll.closed || (!canInteract && poll.myVote === null && false)}
                onClick={() => void vote(i)}
                className={cn(
                  "press relative flex min-h-10 w-full items-center gap-2 overflow-hidden rounded-[10px] border px-3 py-2 text-left text-[13.5px] transition disabled:cursor-default",
                  mine ? "border-fg font-semibold text-fg" : "border-line text-fg hover:border-line-2",
                )}
              >
                {showResults && <span aria-hidden className={cn("absolute inset-y-0 left-0 rounded-[9px] transition-[width] duration-500 ease-out", mine ? "bg-accent-soft" : "bg-fg/5")} style={{ width: `${o.pct}%` }} />}
                <span className="relative min-w-0 flex-1 break-words">{o.text}</span>
                {showResults && <span className="relative shrink-0 text-[12.5px] tabular-nums text-fg-2">{o.pct}%</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex items-center gap-2 text-[12px] text-fg-3">
        <span>{FEED.pollVotes[til](poll.total)}</span>
        {poll.myVote !== null && !poll.closed && (
          <button type="button" onClick={() => void vote(poll.myVote!)} disabled={busy} className="ml-auto font-semibold text-fg-2 underline-offset-2 hover:underline">
            {tr(til, FEED.pollRetract)}
          </button>
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rasm: so'nib kirish + lightbox                                       */
/* ------------------------------------------------------------------ */
/** Rasm yuklanganda so'nib kiradi; SSR'dan keyin allaqachon yuklangan bo'lsa darhol ko'rinadi */
export function FadeImage({ src, alt, className, width, height }: { src: string; alt: string; className?: string; width: number; height: number }) {
  const wrap = useRef<HTMLSpanElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const img = wrap.current?.querySelector("img");
    if (img?.complete) setLoaded(true);
  }, [src]);
  return (
    <span ref={wrap} className="block h-full w-full" data-loaded={loaded}>
      <SafeImage src={src} alt={alt} width={width} height={height} onLoad={() => setLoaded(true)} className={cn("transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0", className)} />
    </span>
  );
}

/**
 * Lightbox: rasmlar to'plami, ←/→ va swipe, Esc; ochilganda yopish tugmasiga, yopilganda ochgan tugmaga fokus qaytadi.
 */
/**
 * Lightbox rasmi: ikki barmoq bilan kattalashtirish (pinch), kattalashganda surish, ikki marta bosish = 2.5× / qaytish.
 * Pointer hodisalari (touch + sichqoncha g'ildiragi). Kattalashgan holatda ota elementning svayp-slayd almashuvi o'chadi.
 */
function ZoomableImage({ src, alt, closing, onZoomChange }: { src: string; alt: string; closing: boolean; onZoomChange: (zoomed: boolean) => void }) {
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; s: number; cx: number; cy: number; x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef(0);
  const moved = useRef(false);
  const clamp = (n: { s: number; x: number; y: number }) => {
    const s = Math.min(5, Math.max(1, n.s));
    if (s === 1) return { s: 1, x: 0, y: 0 };
    const lim = (s - 1) * 0.5 * Math.min(window.innerWidth, 1200);
    return { s, x: Math.max(-lim, Math.min(lim, n.x)), y: Math.max(-lim, Math.min(lim, n.y)) };
  };
  useEffect(() => {
    onZoomChange(t.s > 1);
  }, [t.s, onZoomChange]);
  const dist = () => {
    const [a, b] = [...pts.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const center = () => {
    const [a, b] = [...pts.current.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        moved.current = false;
        if (pts.current.size === 2) {
          const c = center();
          pinch.current = { d: dist(), s: t.s, cx: c.x, cy: c.y, x: t.x, y: t.y };
          drag.current = null;
        } else if (t.s > 1) {
          drag.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }
      }}
      onPointerMove={(e) => {
        if (!pts.current.has(e.pointerId)) return;
        pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch.current && pts.current.size === 2) {
          e.stopPropagation();
          const p = pinch.current;
          const s = p.s * (dist() / Math.max(1, p.d));
          setT(clamp({ s, x: p.x, y: p.y }));
          moved.current = true;
        } else if (drag.current && t.s > 1) {
          e.stopPropagation();
          const d = drag.current;
          if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) moved.current = true;
          setT((cur) => clamp({ s: cur.s, x: d.tx + (e.clientX - d.x), y: d.ty + (e.clientY - d.y) }));
        }
      }}
      onPointerUp={(e) => {
        pts.current.delete(e.pointerId);
        if (pts.current.size < 2) pinch.current = null;
        if (pts.current.size === 0) drag.current = null;
        if (t.s > 1) e.stopPropagation();
        // Ikki marta bosish: 2.5× ↔ 1×
        if (!moved.current && pts.current.size === 0) {
          const now = Date.now();
          if (now - lastTap.current < 300) {
            e.stopPropagation();
            setT((cur) => (cur.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 }));
            lastTap.current = 0;
          } else lastTap.current = now;
        }
      }}
      onPointerCancel={(e) => {
        pts.current.delete(e.pointerId);
        pinch.current = null;
        drag.current = null;
      }}
      onWheel={(e) => {
        if (!e.ctrlKey && Math.abs(e.deltaY) < 1) return;
        e.stopPropagation();
        setT((cur) => clamp({ s: cur.s * (e.deltaY < 0 ? 1.12 : 0.9), x: cur.x, y: cur.y }));
      }}
      style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`, transition: pinch.current || drag.current ? "none" : "transform 0.18s ease-out", touchAction: "none", cursor: t.s > 1 ? "grab" : "zoom-in" }}
      className={cn("max-h-[92dvh] max-w-[96vw] select-none object-contain will-change-transform", closing ? "animate-modal-out" : "animate-modal-in")}
    />
  );
}

export function Lightbox({ items, index, onClose, onIndex }: { items: Attachment[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  const til = useLocale();
  const open = index !== null;
  const { mounted, closing } = usePresence(open, 180);
  const [ready, setReady] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const startX = useRef<number | null>(null);
  const zoomed = useRef(false);
  const [shown, setShown] = useState(index ?? 0);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (index !== null) setShown(index);
  }, [index]);

  const go = useCallback(
    (d: number) => {
      if (index === null || items.length < 2) return;
      onIndex((index + d + items.length) % items.length);
    },
    [index, items.length, onIndex],
  );

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => closeBtn.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener.current?.focus?.();
    };
  }, [open, onClose, go]);

  if (!mounted || !ready) return null;
  const m = items[shown];
  if (!m) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={FEED.openImage[til](shown + 1, items.length)}
      className={cn("fixed inset-0 z-[130] flex items-center justify-center bg-black/90", closing ? "animate-fade-out" : "animate-fade-in")}
      onClick={onClose}
      onPointerDown={(e) => {
        startX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (zoomed.current) return;
        if (Math.abs(dx) > 48) {
          e.stopPropagation();
          go(dx < 0 ? 1 : -1);
        }
      }}
    >
      <button ref={closeBtn} type="button" onClick={onClose} aria-label={tr(til, FEED.close)} className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
        <X size={18} />
      </button>
      <ZoomableImage key={m.url} src={m.url} alt={m.name} closing={closing} onZoomChange={(z) => (zoomed.current = z)} />
      {items.length > 1 && (
        <>
          <button type="button" onClick={(e) => (e.stopPropagation(), go(-1))} aria-label={tr(til, FEED.prev)} className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
            <ChevronLeft size={20} />
          </button>
          <button type="button" onClick={(e) => (e.stopPropagation(), go(1))} aria-label={tr(til, FEED.next)} className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
            <ChevronRight size={20} />
          </button>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold tabular-nums text-white" aria-live="polite">
            {shown + 1} / {items.length}
          </span>
        </>
      )}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Video: ko'rinishda ovozsiz avtoijro                                  */
/* ------------------------------------------------------------------ */
/**
 * Lenta videosi: karta 60% ko'rinishda — ovozsiz o'ynaydi, chiqsa pauza; ovoz tugmasi pastki o'ngda.
 * prefers-reduced-motion — avtoijro yo'q, oddiy boshqaruv. Ovoz yoqilgach brauzer boshqaruvi ko'rinadi.
 */
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
/** Ko'rish holati 15 soniyada bir saqlanadi (davom ettirish uchun) */
const PROGRESS_EVERY_MS = 15_000;

export function FeedVideo({ src, title, className, poster, postId, resumeAt = 0 }: { src: string; title?: string; className?: string; poster?: string; /** Ko'rish holatini saqlash uchun (davom ettirish + tarix) */ postId?: string; /** Qaysi soniyadan davom ettirish */ resumeAt?: number }) {
  const til = useLocale();
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const lastSent = useRef(0);
  const resumed = useRef(false);

  // Tezlik — video elementiga qo'llanadi (menyudan tanlangach)
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed;
  }, [speed]);

  // «Davom ettirish»: saqlangan joydan boshlanadi (oxiriga 10 s qolmagan bo'lsa)
  useEffect(() => {
    const el = ref.current;
    if (!el || !resumeAt || resumed.current) return;
    const apply = () => {
      if (resumed.current) return;
      if (el.duration && resumeAt < el.duration - 10) el.currentTime = resumeAt;
      resumed.current = true;
    };
    if (el.readyState >= 1) apply();
    else el.addEventListener("loadedmetadata", apply, { once: true });
  }, [resumeAt]);

  // Ko'rish holatini 15 soniyada bir va pauzada saqlaymiz
  useEffect(() => {
    const el = ref.current;
    if (!el || !postId) return;
    const send = (force = false) => {
      const now = Date.now();
      if (!force && now - lastSent.current < PROGRESS_EVERY_MS) return;
      if (!el.currentTime) return;
      lastSent.current = now;
      void fetch(`/api/posts/${encodeURIComponent(postId)}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: Math.floor(el.currentTime), duration: Math.floor(el.duration || 0) }),
        keepalive: true,
      }).catch(() => undefined);
    };
    const onTime = () => send();
    const onPause = () => send(true);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onPause);
    };
  }, [postId]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Ma'lumot tejash (html[data-saver]) — lentada video o'zi o'ynamaydi, foydalanuvchi bosadi
    const saver = document.documentElement.dataset.saver === "1";
    if (reduce || saver || typeof IntersectionObserver === "undefined") return;
    setAuto(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio >= 0.6 && document.visibilityState === "visible") el.play().catch(() => undefined);
          else el.pause();
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className="relative">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted={muted}
        loop={auto && muted}
        playsInline
        preload="metadata"
        controls={!auto || !muted}
        title={title}
        onClick={(e) => {
          if (!auto || !muted) return;
          const v = e.currentTarget;
          if (v.paused) v.play().catch(() => undefined);
          else v.pause();
        }}
        className={cn("w-full bg-black", className)}
      />
      {auto && muted && (
        <button
          type="button"
          onClick={() => setMuted(false)}
          aria-label={tr(til, FEED.soundOn)}
          title={tr(til, FEED.soundOn)}
          className="press animate-fade-in absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-ink/80"
        >
          <VolumeX size={16} />
        </button>
      )}
      {auto && !muted && (
        <button type="button" onClick={() => setMuted(true)} aria-label={tr(til, FEED.soundOff)} title={tr(til, FEED.soundOff)} className="press absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-white transition hover:bg-ink/80">
          <Volume2 size={16} />
        </button>
      )}
      {/* Tezlik (0.5×–2×): brauzer menyusidan mustaqil — har qurilmada bir xil */}
      <div className="absolute left-2.5 top-2.5">
        <button
          type="button"
          onClick={() => setSpeedOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={speedOpen}
          aria-label="Ijro tezligi"
          title="Ijro tezligi"
          className={cn("press flex h-7 items-center rounded-full bg-black/55 px-2 text-[11.5px] font-bold tabular-nums text-white transition hover:bg-black/75", speed !== 1 && "bg-accent text-white")}
        >
          {speed}×
        </button>
        {speedOpen && (
          <div role="menu" aria-label="Ijro tezligi" className="pop-in absolute left-0 top-[calc(100%+4px)] z-20 grid gap-0.5 rounded-[10px] bg-black/85 p-1 backdrop-blur-sm">
            {SPEEDS.map((x) => (
              <button
                key={x}
                type="button"
                role="menuitemradio"
                aria-checked={speed === x}
                onClick={() => {
                  setSpeed(x);
                  setSpeedOpen(false);
                }}
                className={cn("rounded-[7px] px-2.5 py-1 text-[12px] font-semibold tabular-nums text-white/80 transition hover:bg-white/15", speed === x && "bg-white/20 text-white")}
              >
                {x}×
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Media to'ri                                                          */
/* ------------------------------------------------------------------ */
/** Rasmlar (lightbox'ga ochiladi) va videolar (avtoijro) — 1 ta: to'liq, 2–4 ta: 2 ustun, 3-chi to'liq qator */
/** Ikki marta bosib yoqtirish hodisasi (MediaGrid → ReactionButton): detail.postId */
export const LIKE_EVENT = "ke:double-like";

export function MediaGrid({ media, alt, postId, resumeAt = 0 }: { media: Attachment[]; alt: string; /** Ko'rish holati (davom ettirish) uchun */ postId?: string; resumeAt?: number }) {
  const til = useLocale();
  const [idx, setIdx] = useState<number | null>(null);
  const [heart, setHeart] = useState(0);
  const tapTimer = useRef<number | null>(null);
  const images = media.filter((a) => !isVideoAttachment(a));
  const single = media.length === 1;
  useEffect(() => () => { if (tapTimer.current) window.clearTimeout(tapTimer.current); }, []);
  if (!media.length) return null;
  // Instagram: bitta bosish — lightbox (260 ms kutib), ikki marta — yoqtirish + katta yurak
  const tapImage = (i: number) => {
    if (tapTimer.current) {
      window.clearTimeout(tapTimer.current);
      tapTimer.current = null;
      if (postId) {
        setHeart((n) => n + 1);
        haptic("medium");
        window.dispatchEvent(new CustomEvent(LIKE_EVENT, { detail: { postId } }));
      }
      return;
    }
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      setIdx(i);
    }, 260);
  };
  return (
    <>
      <div className={cn("relative mt-3 grid gap-1 overflow-hidden rounded-[14px] max-sm:-mx-4 max-sm:rounded-none", single ? "grid-cols-1" : "grid-cols-2")}>
        {heart > 0 && (
          <span key={heart} aria-hidden className="pointer-events-none absolute inset-0 z-[1] grid place-items-center">
            <Heart size={96} className="animate-double-heart fill-white text-white drop-shadow-[0_6px_24px_rgba(0,0,0,.45)]" />
          </span>
        )}
        {media.map((a, i) =>
          isVideoAttachment(a) ? (
            <FeedVideo key={a.url} src={a.url} poster={a.poster} postId={postId} resumeAt={resumeAt} title={a.name} className={cn(single ? "max-h-[480px]" : "aspect-[4/3] object-cover", !single && media.length === 3 && i === 2 && "col-span-2 aspect-[2/1]")} />
          ) : (
            <button
              key={a.url}
              type="button"
              onClick={() => tapImage(images.indexOf(a))}
              aria-label={FEED.openImage[til](images.indexOf(a) + 1, images.length)}
              className={cn("img-zoom block w-full overflow-hidden bg-surface-2 text-left focus-visible:outline-2 focus-visible:outline-accent", !single && "aspect-[4/3]", !single && media.length === 3 && i === 2 && "col-span-2 aspect-[2/1]")}
            >
              <FadeImage src={a.url} alt={a.name || alt} width={960} height={720} className={cn("w-full object-cover", single ? "h-auto max-h-[560px]" : "h-full")} />
            </button>
          ),
        )}
      </div>
      <Lightbox items={images} index={idx} onClose={() => setIdx(null)} onIndex={setIdx} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Havola kartasi (Open Graph)                                          */
/* ------------------------------------------------------------------ */
interface Preview {
  url: string;
  host: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
}
const previewMem = new Map<string, Preview | null>();

/** Postdagi birinchi havola uchun karta: ko'rinishga kirganda yuklanadi, topilmasa hech narsa chiqmaydi */
export function LinkPreviewCard({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Preview | null | undefined>(previewMem.has(url) ? previewMem.get(url) : undefined);
  useEffect(() => {
    if (data !== undefined) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/posts/preview?url=${encodeURIComponent(url)}`);
        const j = (await res.json()) as ApiResp<Preview | null>;
        const d = j.ok ? (j.data ?? null) : null;
        previewMem.set(url, d);
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setData(null);
      }
    };
    if (typeof IntersectionObserver === "undefined") {
      void load();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void load();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [url, data]);
  if (data === null) return null;
  return (
    <div ref={ref} className="mt-3 min-h-px">
      {data && (
        <a href={data.url} target="_blank" rel="noopener noreferrer nofollow" className="expand-in card-outline flex items-start gap-3 rounded-[14px] px-3.5 py-3 transition hover:border-line-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] font-semibold uppercase tracking-[0.08em] text-fg-4">{data.siteName || data.host}</span>
            {data.title && <span className="mt-0.5 line-clamp-2 block text-[13.5px] font-semibold leading-snug text-fg">{data.title}</span>}
            {data.description && <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-fg-3">{data.description}</span>}
          </span>
          <ExternalLink size={14} className="mt-0.5 shrink-0 text-fg-4" />
        </a>
      )}
    </div>
  );
}
