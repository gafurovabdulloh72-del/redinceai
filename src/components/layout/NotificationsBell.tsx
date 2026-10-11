"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Inbox, RotateCcw } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

/**
 * Bildirishnoma qo'ng'irog'i (yuqori panel): o'qilmaganlar soni + ochilganda ro'yxat.
 * - Boshlang'ich son serverdan (Navbar) keladi — birinchi chizishda "0 → N" sakrashi bo'lmaydi
 * - Ro'yxat GET /api/notifications orqali: mount, sahifa almashganda va ochilganda yangilanadi
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

export function NotificationsBell({ initialUnread = 0 }: { initialUnread?: number }) {
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

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Bildirishnomalar: ${unread} ta yangi` : "Bildirishnomalar"}
        title="Bildirishnomalar"
        className="card card-hover relative flex h-10 w-10 shrink-0 items-center justify-center !rounded-full text-fg-2 hover:text-fg"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Bildirishnomalar"
          className="card-floating absolute right-0 top-[calc(100%+10px)] w-[min(340px,calc(100vw-4.5rem))] origin-top-right overflow-hidden animate-fade-up"
          style={{ animationDuration: "0.22s" }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-[15px] font-semibold text-fg">
              Bildirishnomalar
              {unread > 0 && <span className="ml-1.5 text-[12px] font-semibold text-accent-text">{unread} yangi</span>}
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[12px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg"
              >
                <CheckCheck size={14} /> Hammasini o'qilgan deb belgilash
              </button>
            )}
          </div>
          <div className="h-px bg-line" />

          <div className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain">
            {items === null && loading ? (
              <ul className="divide-y divide-line" aria-busy="true" aria-label="Yuklanmoqda">
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
                <p className="text-[14px] font-semibold text-fg">Yuklab bo'lmadi</p>
                <button type="button" onClick={() => void load()} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[12.5px] font-semibold text-fg transition hover:border-fg">
                  <RotateCcw size={13} /> Qayta urinish
                </button>
              </div>
            ) : items && items.length > 0 ? (
              <ul className="divide-y divide-line">
                {items.map((n) => {
                  const isNew = !n.readAt;
                  const inner = (
                    <>
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", isNew ? "bg-accent" : "bg-transparent")} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[13.5px] leading-snug text-fg", isNew ? "font-semibold" : "font-medium")}>
                          {n.title}
                          {isNew && <span className="sr-only"> (yangi)</span>}
                        </span>
                        {n.body && <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-fg-3">{n.body}</span>}
                        <span className="mt-1 block text-[11px] text-fg-4">{timeAgo(n.createdAt)}</span>
                      </span>
                    </>
                  );
                  const cls = cn("flex w-full items-start gap-2.5 px-4 py-3 text-left transition hover:bg-fg/4", !isNew && "opacity-80");
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link href={n.href} className={cls} onClick={() => markRead(n.id)}>
                          {inner}
                        </Link>
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
                <p className="text-[14px] font-semibold text-fg">Yangi bildirishnoma yo'q</p>
                <p className="mt-1 text-[12.5px] text-fg-3">Buyurtma va to'lov yangiliklari shu yerda chiqadi.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
