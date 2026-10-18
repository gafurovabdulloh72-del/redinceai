"use client";

import { usePresence } from "@/components/motion/usePresence";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Bell, CheckCheck, Inbox, RotateCcw } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { cn, timeAgo } from "@/lib/utils";
import { NOTIFICATIONS_CHANGED_EVENT, NOTIFICATIONS_UNREAD_EVENT, notificationMeta, TONE_TILE } from "./notification-meta";

/**
 * Bildirishnoma qo'ng'irog'i (yuqori panel): o'qilmaganlar soni + ochilganda ro'yxat.
 * - Boshlang'ich son serverdan (Navbar) keladi — birinchi chizishda "0 → N" sakrashi bo'lmaydi
 * - Ro'yxat GET /api/notifications orqali: mount, sahifa almashganda, ochilganda va har 60 soniyada
 *   (faqat sahifa ko'rinib turganda; tab qaytganda darhol) yangilanadi
 * - Bosilganda yozuv o'qilgan deb belgilanadi (PATCH {ids}) va href'ga o'tiladi
 * - "Hammasini o'qilgan deb belgilash" → PATCH {all:true}
 */

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: number | null;
  createdAt: number;
}

type ApiResponse = { ok: true; data: { unread: number; items: NotificationItem[] } } | { ok: false; error: string };

/** Fon yangilanish oralig'i (ms) */
const POLL_MS = 60_000;

export function NotificationsBell({ initialUnread = 0 }: { initialUnread?: number }) {
  const til = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/notifications", { signal, cache: "no-store" });
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) throw new Error(json.error);
      setItems(json.data.items);
      setUnread(json.data.unread);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  /* Mount + sahifa almashganda: son yangilanadi (layout qayta chizilmaydi, shuning uchun mijozda) */
  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [pathname, load]);

  useEffect(() => setOpen(false), [pathname]);

  /* O'qilmaganlar soni o'zgarsa — kabinet navigatsiyasi badge'i ham yangilansin */
  useEffect(() => {
    window.dispatchEvent(new CustomEvent<number>(NOTIFICATIONS_UNREAD_EVENT, { detail: unread }));
  }, [unread]);

  /* /kabinet/bildirishnomalar sahifasida o'qilgan deb belgilansa — badge darhol yangilansin */
  useEffect(() => {
    const onChanged = () => void load();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
  }, [load]);

  /* Har 60 soniyada (sahifa ko'rinib turganda) va tab qayta ochilganda — badge eskirmasin */
  useEffect(() => {
    let ctrl: AbortController | null = null;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      ctrl?.abort();
      ctrl = new AbortController();
      void load(ctrl.signal);
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      ctrl?.abort();
    };
  }, [load]);

  /* Ochilganda yangi ro'yxat; tashqariga bosilganda / Escape'da yopiladi */
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    void load(ctrl.signal);
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      ctrl.abort();
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, load]);

  const patch = (body: { ids?: string[]; all?: boolean }) =>
    fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});

  const markRead = (id: string) => {
    const it = items?.find((n) => n.id === id);
    if (!it || it.readAt) return;
    const now = Date.now();
    setItems((prev) => prev?.map((n) => (n.id === id ? { ...n, readAt: now } : n)) ?? prev);
    setUnread((n) => Math.max(0, n - 1));
    void patch({ ids: [id] });
  };

  const markAll = () => {
    const now = Date.now();
    setItems((prev) => prev?.map((n) => (n.readAt ? n : { ...n, readAt: now })) ?? prev);
    setUnread(0);
    void patch({ all: true });
  };

  const badge = unread > 99 ? "99+" : String(unread);
  const { mounted: panelMounted, closing: panelClosing } = usePresence(open, 180);

  return (
    /* Mobil: panel nav kapsulasiga nisbatan (uning kengligida, 12px gutter); sm+: qo'ng'iroq ostida o'ngga tekis */
    <div className="sm:relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? SHELL.bell.labelUnread[til](unread) : tr(til, SHELL.bell.label)}
        title={tr(til, SHELL.bell.label)}
        className="card card-hover relative flex h-10 w-10 shrink-0 items-center justify-center !rounded-full text-fg-2 hover:text-fg"
      >
        <Bell key={unread} size={18} className={unread > 0 ? "animate-wiggle" : undefined} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-strong px-1 text-[11px] font-bold leading-none text-white ring-2 ring-surface"
          >
            {badge}
          </span>
        )}
      </button>

      {panelMounted && (
        <div
          role="dialog"
          aria-label={tr(til, SHELL.bell.label)}
          className={`card-floating absolute inset-x-0 top-[calc(100%+10px)] origin-top-right overflow-hidden sm:left-auto sm:right-0 sm:w-[380px] ${panelClosing ? "animate-modal-out" : "animate-fade-up"}`}
          style={{ animationDuration: panelClosing ? "0.16s" : "0.22s" }}
        >
          <div className="flex items-baseline gap-2 whitespace-nowrap px-4 py-3">
            <p className="text-[15px] font-semibold text-fg">{tr(til, SHELL.bell.label)}</p>
            {unread > 0 && <span className="text-[12px] font-semibold text-accent-text tabular-nums">{SHELL.bell.newCount[til](unread)}</span>}
          </div>
          <div className="h-px bg-line" />

          <div className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain">
            {items === null && loading ? (
              <ul className="divide-y divide-line" aria-busy="true" aria-label={tr(til, SHELL.bell.loading)}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="space-y-2 px-4 py-3">
                    <span className="skeleton block h-3.5 w-2/3" />
                    <span className="skeleton block h-3 w-full" />
                    <span className="skeleton block h-2.5 w-1/4" />
                  </li>
                ))}
              </ul>
            ) : error && !items ? (
              <div className="flex flex-col items-center px-4 py-8 text-center">
                <p className="text-[14px] font-semibold text-fg">{tr(til, SHELL.bell.loadFailed)}</p>
                <button type="button" onClick={() => void load()} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[12.5px] font-semibold text-fg transition hover:border-fg">
                  <RotateCcw size={13} /> {tr(til, SHELL.bell.retry)}
                </button>
              </div>
            ) : items && items.length > 0 ? (
              <ul className="divide-y divide-line">
                {items.map((n) => {
                  const isNew = !n.readAt;
                  const meta = notificationMeta(n.type);
                  const inner = (
                    <>
                      <span className={cn("relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]", TONE_TILE[meta.tone])} aria-hidden="true">
                        <meta.icon size={15} />
                        {isNew && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[13.5px] leading-snug text-fg", isNew ? "font-semibold" : "font-medium")}>
                          {n.title}
                          {isNew && <span className="sr-only">{tr(til, SHELL.bell.newSr)}</span>}
                        </span>
                        {n.body && <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-fg-3">{n.body}</span>}
                        <time dateTime={new Date(n.createdAt).toISOString()} className="mt-1 block text-[11px] text-fg-4">
                          {timeAgo(n.createdAt)}
                        </time>
                      </span>
                    </>
                  );
                  const cls = cn("flex w-full items-start gap-2.5 px-4 py-3 text-left transition hover:bg-fg/4", !isNew && "opacity-80");
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        n.href.startsWith("https://") ? (
                          // Tashqi havola (masalan, admin e'lonidagi Telegram) — yangi oynada
                          <a href={n.href} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => markRead(n.id)}>
                            {inner}
                          </a>
                        ) : (
                          <Link href={n.href} className={cls} onClick={() => markRead(n.id)}>
                            {inner}
                          </Link>
                        )
                      ) : (
                        <button type="button" className={cls} onClick={() => markRead(n.id)}>
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <span className="icon-tile-soft mb-3 !rounded-full">
                  <Inbox size={20} />
                </span>
                <p className="text-[14px] font-semibold text-fg">{tr(til, SHELL.bell.emptyTitle)}</p>
                <p className="mt-1 text-[12.5px] text-fg-3">{tr(til, SHELL.bell.emptyText)}</p>
              </div>
            )}
          </div>

          <div className="flex items-stretch border-t border-line">
            {unread > 0 && items && items.length > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 border-r border-line px-3 text-[12.5px] font-semibold text-fg-2 transition hover:bg-fg/4 hover:text-fg"
              >
                <CheckCheck size={15} className="shrink-0" /> <span className="truncate">{tr(til, SHELL.bell.markAll)}</span>
              </button>
            )}
            <Link
              href="/kabinet/bildirishnomalar"
              className={cn(
                "flex min-h-11 items-center justify-center gap-1 px-4 text-[12.5px] font-semibold text-fg transition hover:bg-fg/4",
                unread > 0 && items && items.length > 0 ? "shrink-0" : "flex-1",
              )}
            >
              {tr(til, SHELL.bell.all)} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
