"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Heart, Share2 } from "lucide-react";
import { usePresence } from "@/components/motion/usePresence";
import { useToast } from "@/components/ui/toast";
import { REACTIONS, REACTION_BY_KEY, type ReactionKind } from "@/lib/groups/limits";
import type { ReactionCounts } from "@/lib/groups/service";
import { cn } from "@/lib/utils";

type ApiResp<T> = { ok: boolean; data?: T; error?: string };

export interface ReactionState {
  liked: boolean;
  likesCount: number;
  myReaction: ReactionKind | null;
  reactions: ReactionCounts;
}

/** Postning doimiy havolasi (nisbiy): jamoa posti → /jamoalar/<slug>?post=, profil posti → /mutaxassislar/<slug>?post= */
export function postPermalink(post: { id: string; author: { slug: string | null } }, groupSlug?: string | null): string | null {
  if (groupSlug) return `/jamoalar/${groupSlug}?post=${post.id}`;
  if (post.author.slug) return `/mutaxassislar/${post.author.slug}?post=${post.id}`;
  return null;
}

function topKinds(counts: ReactionCounts, exclude: ReactionKind | null, n: number): ReactionKind[] {
  return (Object.entries(counts) as Array<[ReactionKind, number]>)
    .filter(([k, v]) => v > 0 && k !== exclude)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

/**
 * Reaksiya tugmasi (Facebook/Telegram uslubi): bosish — ❤️ (yoki joriy reaksiyani olib tashlash);
 * sichqonchani ustida ushlab turish / telefonda uzoq bosish / ↑ tugmasi — 6 ta reaksiya tanlagichi.
 * Optimistik yangilanish, xato bo'lsa qaytariladi. `canInteract=false` (jamoa a'zosi emas) — o'chirilgan, sabab title'da.
 */
export function ReactionButton({
  postId,
  initial,
  canInteract,
  requireLogin,
  lockedTitle,
  size = "md",
  onChange,
}: {
  postId: string;
  initial: { likesCount: number; myReaction: ReactionKind | null; reactions: ReactionCounts };
  canInteract: boolean;
  requireLogin: () => boolean;
  lockedTitle?: string;
  size?: "md" | "lg";
  onChange?: (state: ReactionState) => void;
}) {
  const { toast } = useToast();
  const [my, setMy] = useState<ReactionKind | null>(initial.myReaction);
  const [total, setTotal] = useState(initial.likesCount);
  const [counts, setCounts] = useState<ReactionCounts>(initial.reactions);
  const [open, setOpen] = useState(false);
  const picker = usePresence(open, 160);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const busy = useRef(false);

  const clearTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => () => clearTimer(), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

  const locked = !canInteract && Boolean(lockedTitle);
  const others = topKinds(counts, my, 3);
  const lg = size === "lg";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-pressed={my !== null}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={locked}
        title={locked ? lockedTitle : my ? `${REACTION_BY_KEY[my].label} — bosib olib tashlang; ushlab turing — boshqa reaksiya` : "Yoqtirish (ushlab turing — reaksiyalar)"}
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
          timer.current = window.setTimeout(() => setOpen(true), 380);
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
            setOpen(true);
            try {
              navigator.vibrate?.(8);
            } catch {}
          }, 420);
        }}
        onPointerUp={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey)) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "press inline-flex items-center gap-1.5 rounded-full font-semibold transition disabled:opacity-50",
          lg ? "h-10 px-3 text-[13px]" : "h-9 px-3 text-[13px]",
          my ? "bg-accent-soft text-accent-text" : "text-fg-2 hover:bg-fg/6 hover:text-fg",
        )}
      >
        {my ? (
          <span key={my} className="animate-heartbeat text-[17px] leading-none" aria-hidden>
            {REACTION_BY_KEY[my].emoji}
          </span>
        ) : (
          <Heart size={lg ? 18 : 16} />
        )}
        <span key={total} className="animate-fade-in tabular-nums">
          {total}
        </span>
        {others.length > 0 && (
          <span className="ml-0.5 text-[12px] leading-none opacity-80" aria-label={others.map((k) => REACTION_BY_KEY[k].label).join(", ")}>
            {others.map((k) => REACTION_BY_KEY[k].emoji).join("")}
          </span>
        )}
        <span className="sr-only">{my ? `Sizning reaksiyangiz: ${REACTION_BY_KEY[my].label}` : "Reaksiya"}</span>
      </button>

      {picker.mounted && (
        <div
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
                "animate-pop flex h-10 w-10 items-center justify-center rounded-full text-[24px] leading-none transition-transform duration-150 hover:-translate-y-1 hover:scale-125 focus-visible:scale-125",
                my === r.key && "bg-accent-soft",
              )}
            >
              <span aria-hidden>{r.emoji}</span>
              <span className="sr-only">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
      onClick={() => void toggle()}
      aria-pressed={saved}
      aria-label={saved ? "Saqlanganlardan olish" : "Postni saqlash"}
      title={saved ? "Saqlangan — olish" : "Saqlash"}
      className={cn("press flex items-center justify-center rounded-full transition", size === "lg" ? "h-10 w-10" : "h-9 w-9", saved ? "text-fg" : "text-fg-3 hover:bg-fg/6 hover:text-fg", className)}
    >
      <Bookmark key={saved ? "on" : "off"} size={size === "lg" ? 18 : 16} className={cn(saved && "animate-pop fill-current")} />
    </button>
  );
}

/** Ulashish: telefonda tizim oynasi (navigator.share), aks holda havola nusxalanadi */
export function ShareAction({ url, title, size = "md", label = true }: { url: string; title?: string; size?: "md" | "lg"; label?: boolean }) {
  const { toast } = useToast();
  async function share() {
    const abs = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    try {
      if (typeof navigator.share === "function" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ url: abs, title: title || "Kasb Egalari" });
        return;
      }
      await navigator.clipboard.writeText(abs);
      toast("Havola nusxalandi");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast(abs, "info");
    }
  }
  return (
    <button type="button" onClick={() => void share()} aria-label="Ulashish" title="Ulashish" className={cn("press inline-flex items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg", size === "lg" ? "h-10" : "h-9")}>
      <Share2 size={size === "lg" ? 17 : 16} /> {label && <span className="hidden sm:inline">Ulashish</span>}
    </button>
  );
}
