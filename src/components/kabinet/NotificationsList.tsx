"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { NOTIFICATIONS_CHANGED_EVENT, notificationMeta, TONE_TILE } from "@/components/layout/notification-meta";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  /** ms yoki null (o'qilmagan) */
  readAt: number | null;
  createdAt: number;
}

/**
 * Bildirishnomalar sahifasidagi to'liq ro'yxat: bosilganda o'qilgan deb belgilanadi (PATCH {ids}) va havolaga o'tadi;
 * «Hammasini o'qilgan deb belgilash» — PATCH {all:true}. Har o'zgarishdan keyin qo'ng'iroq badge'i va server sanog'i yangilanadi.
 */
export function NotificationsList({ items, unread }: { items: NotificationRow[]; unread: number }) {
  const router = useRouter();
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());
  const [allRead, setAllRead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRead = (n: NotificationRow) => allRead || Boolean(n.readAt) || readIds.has(n.id);
  const left = allRead ? 0 : Math.max(0, unread - items.filter((n) => !n.readAt && readIds.has(n.id)).length);

  const patch = async (body: { ids?: string[]; all?: boolean }) => {
    const res = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });
    if (!res.ok) throw new Error(String(res.status));
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  };

  const markOne = (n: NotificationRow) => {
    if (isRead(n)) return;
    setReadIds((s) => new Set(s).add(n.id));
    void patch({ ids: [n.id] })
      .then(() => {
        // Havolasiz yozuv — sahifada qolamiz, server sanog'i (kabinet nav) yangilansin
        if (!n.href) router.refresh();
      })
      .catch(() => {
        setReadIds((s) => {
          const next = new Set(s);
          next.delete(n.id);
          return next;
        });
      });
  };

  const markAll = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await patch({ all: true });
      setAllRead(true);
      router.refresh();
    } catch {
      setError("Belgilab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card overflow-hidden" aria-labelledby="notif-list-title">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <h2 id="notif-list-title" className="text-[14px] font-semibold text-fg">
          {left > 0 ? (
            <>
              <span className="tabular-nums text-accent-text">{left}</span> ta o'qilmagan
            </>
          ) : (
            "Hammasi o'qilgan"
          )}
        </h2>
        {left > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={markAll} disabled={busy}>
            {busy ? <Spinner /> : <CheckCheck size={15} />} Hammasini o'qilgan deb belgilash
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="border-t border-line px-5 py-2.5 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
      <ul className="divide-y divide-line border-t border-line">
        {items.map((n) => {
          const meta = notificationMeta(n.type);
          const fresh = !isRead(n);
          const inner = (
            <>
              <span className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", TONE_TILE[meta.tone])} aria-hidden="true">
                <meta.icon size={17} />
                {fresh && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className={cn("text-[14px] leading-snug text-fg", fresh ? "font-semibold" : "font-medium")}>{n.title}</span>
                  {fresh && <span className="sr-only">(yangi)</span>}
                </span>
                {n.body && <span className="mt-0.5 block text-[13px] leading-snug text-fg-2">{n.body}</span>}
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-fg-4">
                  <span className="font-semibold uppercase tracking-wide">{meta.label}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={new Date(n.createdAt).toISOString()} title={formatDateTime(n.createdAt)} suppressHydrationWarning>
                    {timeAgo(n.createdAt)}
                  </time>
                </span>
              </span>
            </>
          );
          const cls = cn("flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-fg/4 sm:px-5", !fresh && "opacity-75");
          return (
            <li key={n.id}>
              {n.href ? (
                n.href.startsWith("https://") ? (
                  // Tashqi havola (masalan, admin e'lonidagi Telegram) — yangi oynada
                  <a href={n.href} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => markOne(n)}>
                    {inner}
                  </a>
                ) : (
                  <Link href={n.href} className={cls} onClick={() => markOne(n)}>
                    {inner}
                  </Link>
                )
              ) : (
                <button type="button" className={cls} onClick={() => markOne(n)}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
