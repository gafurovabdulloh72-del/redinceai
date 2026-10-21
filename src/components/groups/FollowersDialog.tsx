"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { UsersRound, X } from "lucide-react";
import { Avatar, Button } from "@/components/ui";
import { usePresence } from "@/components/motion/usePresence";
import { FollowButton } from "./FollowButton";
import type { FollowRow } from "@/lib/groups/service";
import { cn } from "@/lib/utils";

type Kind = "followers" | "following";
type ApiResp = { ok: boolean; data?: { items: FollowRow[]; nextCursor: number | null }; error?: string };

/** Obunachilar / obunalar ro'yxati (cursor bilan "Yana") — dialog va kabinet sahifasi uchun umumiy */
export function FollowList({ userId, kind, loggedIn, viewerId, emptyText }: { userId: string; kind: Kind; loggedIn: boolean; viewerId: string | null; emptyText?: string }) {
  const [items, setItems] = useState<FollowRow[] | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const base = `/api/follow/${encodeURIComponent(userId)}?list=${kind}`;

  const load = useCallback(
    async (after: number | null) => {
      setLoading(true);
      try {
        const res = await fetch(after ? `${base}&cursor=${after}` : base, { cache: "no-store" });
        const j = (await res.json()) as ApiResp;
        if (!j.ok || !j.data) return;
        const more = j.data.items;
        setItems((prev) => (after && prev ? [...prev, ...more.filter((m) => !prev.some((p) => p.id === m.id))] : more));
        setCursor(j.data.nextCursor);
      } finally {
        setLoading(false);
      }
    },
    [base],
  );
  useEffect(() => {
    setItems(null);
    void load(null);
  }, [load]);

  if (!items) {
    return (
      <ul className="space-y-1 p-1">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-3 p-2">
            <span className="h-10 w-10 shrink-0 rounded-full skeleton" />
            <span className="flex-1 space-y-2">
              <span className="block h-3.5 w-1/2 skeleton" />
              <span className="block h-3 w-1/3 skeleton" />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (items.length === 0) {
    return <p className="px-4 py-10 text-center text-[13px] text-fg-3">{emptyText ?? (kind === "followers" ? "Hali obunachilar yo'q" : "Hali hech kimga obuna bo'lmagan")}</p>;
  }
  return (
    <div>
      <ul className="divide-y divide-line">
        {items.map((u) => {
          const href = u.slug ? `/mutaxassislar/${u.slug}` : u.username ? `/yozish/${u.username}` : null;
          const name = <span className="block truncate text-[14px] font-semibold text-fg">{u.name}</span>;
          return (
            <li key={u.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="relative shrink-0">
                <Avatar name={u.name} src={u.avatarUrl} size={40} decorative />
                {u.online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-success" aria-label="Onlayn" />}
              </span>
              <span className="min-w-0 flex-1">
                {href ? (
                  <Link href={href} className="hover:underline">
                    {name}
                  </Link>
                ) : (
                  name
                )}
                <span className="block truncate text-[12px] text-fg-3">
                  {u.username ? `@${u.username}` : ""}
                  {u.followersCount > 0 && <span className="text-fg-4"> · {u.followersCount} obunachi</span>}
                </span>
              </span>
              {loggedIn && viewerId !== u.id && <FollowButton userId={u.id} initialFollowing={u.following} initialCount={u.followersCount} loggedIn size="sm" compact showCount={false} variant="outline" />}
            </li>
          );
        })}
      </ul>
      {cursor && (
        <div className="flex justify-center py-3">
          <Button type="button" variant="outline" size="sm" onClick={() => void load(cursor)} disabled={loading}>
            {loading ? "Yuklanmoqda…" : "Yana"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Segment: Obunachilar / Obunalar (kabinet sahifasi va dialog ichida) */
export function FollowTabs({ userId, followers, following, loggedIn, viewerId, initial = "followers" }: { userId: string; followers: number; following: number; loggedIn: boolean; viewerId: string | null; initial?: Kind }) {
  const [tab, setTab] = useState<Kind>(initial);
  return (
    <div>
      <div className="segment flex w-full" role="tablist" aria-label="Obunalar">
        <button type="button" role="tab" aria-selected={tab === "followers"} onClick={() => setTab("followers")} className={cn("segment-item flex-1", tab === "followers" && "segment-item-active")}>
          Obunachilar <span className="ml-1 text-fg-3">{followers}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "following"} onClick={() => setTab("following")} className={cn("segment-item flex-1", tab === "following" && "segment-item-active")}>
          Obunalar <span className="ml-1 text-fg-3">{following}</span>
        </button>
      </div>
      <div key={tab} className="animate-swap mt-2" role="tabpanel">
        <FollowList userId={userId} kind={tab} loggedIn={loggedIn} viewerId={viewerId} />
      </div>
    </div>
  );
}

/**
 * Profil sahifasida: "N obunachi · M obuna" — bosilganda ro'yxat oynasi (Instagram kabi).
 * Portal (body) orqali, kirish/chiqish animatsiyasi bilan; Esc / fon yopadi.
 */
export function FollowersDialog({
  userId,
  followers,
  following,
  loggedIn,
  viewerId,
  className,
  variant = "inline",
  extraStats = [],
}: {
  userId: string;
  followers: number;
  following: number;
  loggedIn: boolean;
  viewerId: string | null;
  className?: string;
  /** inline — bir qator matn; stats — Instagram uslubidagi teng ustunli statistika (telefon profil sarlavhasi) */
  variant?: "inline" | "stats";
  /** stats variantida obunachi/obunadan OLDIN ko'rinadigan oddiy ko'rsatkichlar (masalan, Ishlar soni) */
  extraStats?: Array<{ value: number | string; label: string }>;
}) {
  const [open, setOpen] = useState<Kind | null>(null);
  const [ready, setReady] = useState(false);
  const { mounted, closing } = usePresence(open !== null, 200);
  const [shown, setShown] = useState<Kind>("followers");
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (open) setShown(open);
  }, [open]);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    // Fon skrolli qulflanadi (telefonda ro'yxat ostidagi sahifa surilmasin), fokus oynaga o'tadi
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => closeRef.current?.focus(), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open]);

  return (
    <>
      {variant === "stats" ? (
        <div className={cn("grid divide-x divide-line rounded-card border border-line bg-surface-2/60", className)} style={{ gridTemplateColumns: `repeat(${extraStats.length + 2}, minmax(0, 1fr))` }}>
          {extraStats.map((s) => (
            <div key={s.label} className="px-2 py-2.5 text-center">
              <p className="stat-num text-[19px] leading-none text-fg">{s.value}</p>
              <p className="mt-1.5 truncate text-[12px] text-fg-3">{s.label}</p>
            </div>
          ))}
          <button type="button" onClick={() => setOpen("followers")} className="press px-2 py-2.5 text-center transition hover:bg-fg/4" aria-haspopup="dialog">
            <span className="stat-num block text-[19px] leading-none text-fg">{followers}</span>
            <span className="mt-1.5 block truncate text-[12px] text-fg-3">obunachi</span>
          </button>
          <button type="button" onClick={() => setOpen("following")} className="press px-2 py-2.5 text-center transition hover:bg-fg/4" aria-haspopup="dialog">
            <span className="stat-num block text-[19px] leading-none text-fg">{following}</span>
            <span className="mt-1.5 block truncate text-[12px] text-fg-3">obuna</span>
          </button>
        </div>
      ) : (
        <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-2", className)}>
          <button type="button" onClick={() => setOpen("followers")} className="rounded-full px-1 transition hover:text-fg" aria-haspopup="dialog">
            <b className="text-fg">{followers}</b> obunachi
          </button>
          <span className="text-fg-4" aria-hidden>
            ·
          </span>
          <button type="button" onClick={() => setOpen("following")} className="rounded-full px-1 transition hover:text-fg" aria-haspopup="dialog">
            <b className="text-fg">{following}</b> obuna
          </button>
        </div>
      )}
      {ready &&
        mounted &&
        createPortal(
          <div className={cn("fixed inset-0 z-[125] flex items-end justify-center bg-ink/55 backdrop-blur-sm sm:items-center sm:p-6", closing ? "animate-fade-out" : "animate-fade-in")} role="presentation" onClick={() => setOpen(null)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Obunachilar va obunalar"
              onClick={(e) => e.stopPropagation()}
              className={cn("card-elevated flex max-h-[85dvh] w-full max-w-md flex-col !rounded-b-none p-4 sm:!rounded-[24px] sm:p-5", closing ? "animate-sheet-down sm:animate-modal-out" : "animate-sheet-up sm:animate-modal-in")}
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              <div className="sheet-handle mb-3 sm:hidden" aria-hidden />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold text-fg">
                  <UsersRound size={17} className="text-fg-3" /> Obunalar
                </h2>
                <button ref={closeRef} type="button" onClick={() => setOpen(null)} aria-label="Yopish" className="flex h-9 w-9 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
                  <X size={17} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <FollowTabs userId={userId} followers={followers} following={following} loggedIn={loggedIn} viewerId={viewerId} initial={shown} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
