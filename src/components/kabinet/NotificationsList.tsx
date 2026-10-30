"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCheck, ChevronDown, Eraser } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { NOTIFICATIONS_CHANGED_EVENT, NOTIFICATIONS_UNREAD_EVENT, notificationMeta, TONE_TILE } from "@/components/layout/notification-meta";
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

/** Bir kun ichida bir xil hodisa 3+ marta takrorlansa — bitta qatorga yig'iladi (href bo'yicha: reaksiya/izoh/obuna; tur bo'yicha: kanal/efir/profil posti) */
const GROUP_BY_HREF = new Set(["post_like", "post_comment", "follow"]);
const GROUP_BY_TYPE = new Set(["channel_post", "live_event", "profile_post", "broadcast"]);
const GROUP_MIN = 3;

/** Toshkent kuni (UTC+5) — server va brauzerda bir xil */
const DAY_MS = 86_400_000;
const TZ = 5 * 3_600_000;
const dayKey = (ms: number) => Math.floor((ms + TZ) / DAY_MS);

function groupTitle(type: string, n: number) {
  switch (type) {
    case "post_like":
      return `${n} kishi postingizga reaksiya bildirdi`;
    case "post_comment":
      return `Postingizga ${n} ta yangi izoh`;
    case "follow":
      return `${n} kishi sizga obuna bo'ldi`;
    case "channel_post":
      return `Kanallarda ${n} ta yangi post`;
    case "live_event":
      return `${n} ta jonli efir e'loni`;
    case "profile_post":
      return `Obunalaringizdan ${n} ta yangi post`;
    case "broadcast":
      return `${n} ta e'lon`;
    default:
      return `${n} ta bildirishnoma`;
  }
}

type Entry = { kind: "one"; n: NotificationRow } | { kind: "group"; key: string; type: string; href: string | null; items: NotificationRow[] };
interface DaySection {
  day: number;
  label: string;
  entries: Entry[];
}

function buildSections(items: NotificationRow[], today: number): DaySection[] {
  const byDay = new Map<number, NotificationRow[]>();
  for (const n of items) {
    const d = dayKey(n.createdAt);
    const arr = byDay.get(d);
    if (arr) arr.push(n);
    else byDay.set(d, [n]);
  }
  const out: DaySection[] = [];
  for (const [day, rows] of byDay) {
    const buckets = new Map<string, NotificationRow[]>();
    const order: string[] = [];
    for (const n of rows) {
      const key = GROUP_BY_HREF.has(n.type) ? `${n.type}|${n.href ?? ""}` : GROUP_BY_TYPE.has(n.type) ? `${n.type}|*` : `id|${n.id}`;
      const b = buckets.get(key);
      if (b) b.push(n);
      else {
        buckets.set(key, [n]);
        order.push(key);
      }
    }
    const entries: Entry[] = order.map((key) => {
      const list = buckets.get(key)!;
      if (list.length >= GROUP_MIN) return { kind: "group", key: `${day}|${key}`, type: list[0].type, href: GROUP_BY_HREF.has(list[0].type) ? list[0].href : null, items: list };
      return { kind: "one", n: list[0] };
    });
    // Guruhdan tashqari qolganlar: vaqt tartibida (bucket tartibi birinchi uchrashga ko'ra)
    const diff = today - day;
    out.push({ day, label: diff <= 0 ? "Bugun" : diff === 1 ? "Kecha" : diff < 7 ? `${diff} kun oldin` : formatDateTime(rows[0].createdAt).slice(0, 10), entries });
  }
  return out;
}

/**
 * Bildirishnomalar sahifasidagi to'liq ro'yxat: kun bo'yicha bo'limlar, takroriy ijtimoiy hodisalar yig'ilgan («3 kishi…»),
 * bosilganda o'qilgan deb belgilanadi (PATCH {ids}) va havolaga o'tadi; «Hammasini o'qilgan deb belgilash» — PATCH {all:true};
 * «Eskilarini tozalash» — DELETE (30 kundan eski o'qilganlar). Qo'ng'iroqdan «hammasi o'qildi» kelsa (UNREAD=0) ro'yxat ham yangilanadi.
 */
export function NotificationsList({ items, unread, canPurge }: { items: NotificationRow[]; unread: number; canPurge: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());
  // Telefon: qatorni chapga surish — o'qilgan deb belgilash (Mail/Telegram odati)
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null);
  const swipeStart = useRef<{ id: string; x: number; y: number; locked: boolean | null } | null>(null);
  const SWIPE_READ = 64;
  const [allRead, setAllRead] = useState(false);
  const [busy, setBusy] = useState<"all" | "purge" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  // «Bugun» yorlig'i brauzer vaqtiga bog'liq — hidratsiyadan keyin hisoblanadi (SSR'da serverning kuni)
  const [today, setToday] = useState(() => dayKey(Date.now()));
  useEffect(() => setToday(dayKey(Date.now())), []);

  const isRead = (n: NotificationRow) => allRead || Boolean(n.readAt) || readIds.has(n.id);
  const left = allRead ? 0 : Math.max(0, unread - items.filter((n) => !n.readAt && readIds.has(n.id)).length);
  const sections = useMemo(() => buildSections(items, today), [items, today]);

  // O'qilmagan son o'zgarishi bilan (bu sahifada o'qildi) — qobiq badge'larini (yon panel, kabinet nav, qo'ng'iroq) darhol yangilaymiz
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    window.dispatchEvent(new CustomEvent<number>(NOTIFICATIONS_UNREAD_EVENT, { detail: left }));
  }, [left]);

  // Qo'ng'iroq paneli «hammasini o'qilgan» qilsa — bu ro'yxat ham "o'qilgan" bo'lsin (hisoblagich desinxron bo'lmasin)
  useEffect(() => {
    const on = (e: Event) => {
      const n = (e as CustomEvent<unknown>).detail;
      if (n === 0) setAllRead(true);
    };
    window.addEventListener(NOTIFICATIONS_UNREAD_EVENT, on);
    return () => window.removeEventListener(NOTIFICATIONS_UNREAD_EVENT, on);
  }, []);

  const patch = async (body: { ids?: string[]; all?: boolean }) => {
    const res = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });
    if (!res.ok) throw new Error(String(res.status));
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  };

  const markMany = (rows: NotificationRow[], refreshIfNoHref = true) => {
    const fresh = rows.filter((n) => !isRead(n));
    if (!fresh.length) return;
    const ids = fresh.map((n) => n.id);
    setReadIds((s) => new Set([...s, ...ids]));
    void patch({ ids })
      .then(() => {
        if (refreshIfNoHref && rows.every((n) => !n.href)) router.refresh();
      })
      .catch(() => {
        setReadIds((s) => {
          const next = new Set(s);
          for (const id of ids) next.delete(id);
          return next;
        });
        toast("Belgilab bo'lmadi", "error");
      });
  };

  const markAll = async () => {
    if (busy) return;
    setBusy("all");
    setError(null);
    try {
      await patch({ all: true });
      setAllRead(true);
      router.refresh();
    } catch {
      setError("Belgilab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setBusy(null);
    }
  };

  const purge = async () => {
    if (busy) return;
    setBusy("purge");
    setError(null);
    try {
      const res = await fetch("/api/notifications?days=30", { method: "DELETE" });
      const j = (await res.json()) as { ok: boolean; data?: { removed: number }; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Tozalab bo'lmadi");
      toast(j.data?.removed ? `${j.data.removed} ta eski bildirishnoma o'chirildi` : "30 kundan eski o'qilgan yozuv yo'q", j.data?.removed ? "success" : "info");
      if (j.data?.removed) router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tozalab bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  const toggleGroup = (key: string) =>
    setOpenGroups((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const rowCls = (fresh: boolean) => cn("press flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-fg/4 sm:px-5", !fresh && "opacity-75");

  const renderOne = (n: NotificationRow) => {
    const meta = notificationMeta(n.type);
    const fresh = !isRead(n);
    const inner = (
      <>
        <span className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", TONE_TILE[meta.tone])} aria-hidden="true">
          <meta.icon size={18} />
          {fresh && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[14px] leading-snug text-fg", fresh ? "font-semibold" : "font-medium")}>
            {n.title}
            {fresh && <span className="sr-only"> (yangi)</span>}
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
    const cls = rowCls(fresh);
    const swipeHandlers = fresh
      ? {
          onTouchStart: (e: React.TouchEvent) => {
            const t0 = e.touches[0];
            swipeStart.current = { id: n.id, x: t0.clientX, y: t0.clientY, locked: null };
          },
          onTouchMove: (e: React.TouchEvent) => {
            const st = swipeStart.current;
            if (!st || st.id !== n.id) return;
            const t0 = e.touches[0];
            const dx = t0.clientX - st.x;
            const dy = t0.clientY - st.y;
            if (st.locked === null) {
              if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
              st.locked = Math.abs(dx) > Math.abs(dy) && dx < 0;
            }
            if (!st.locked) return;
            setSwipe({ id: n.id, dx: Math.max(-96, Math.min(0, dx * 0.7)) });
          },
          onTouchEnd: () => {
            const st = swipeStart.current;
            swipeStart.current = null;
            if (st && swipe && swipe.id === st.id && -swipe.dx >= SWIPE_READ) markMany([n], false);
            setSwipe(null);
          },
          onTouchCancel: () => {
            swipeStart.current = null;
            setSwipe(null);
          },
        }
      : {};
    const wrap = (node: ReactNode) => (
      <div {...swipeHandlers} className="relative overflow-hidden">
        {swipe?.id === n.id && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-success/15 text-[12px] font-semibold text-success-text" style={{ opacity: Math.min(1, -swipe.dx / SWIPE_READ) }}>
            O&apos;qildi
          </span>
        )}
        <div style={swipe?.id === n.id ? { transform: `translateX(${swipe.dx}px)`, transition: "none" } : undefined} className="transition-transform duration-200">
          {node}
        </div>
      </div>
    );
    if (n.href) {
      return wrap(n.href.startsWith("https://") ? (
        // Tashqi havola (masalan, admin e'lonidagi Telegram) — yangi oynada
        <a href={n.href} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => markMany([n])}>
          {inner}
        </a>
      ) : (
        <Link href={n.href} className={cls} onClick={() => markMany([n])}>
          {inner}
        </Link>
      ));
    }
    return wrap(
      <button type="button" className={cls} onClick={() => markMany([n])}>
        {inner}
      </button>,
    );
  };

  const renderGroup = (g: Extract<Entry, { kind: "group" }>) => {
    const meta = notificationMeta(g.type);
    const freshN = g.items.filter((n) => !isRead(n)).length;
    const open = openGroups.has(g.key);
    const newest = g.items[0];
    return (
      <div>
        <div className={cn("flex items-start gap-3 px-4 py-3.5 sm:px-5", freshN === 0 && "opacity-75")}>
          <span className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", TONE_TILE[meta.tone])} aria-hidden="true">
            <meta.icon size={18} />
            {freshN > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block text-[14px] leading-snug text-fg", freshN > 0 ? "font-semibold" : "font-medium")}>{groupTitle(g.type, g.items.length)}</span>
            <span className="mt-0.5 block truncate text-[13px] leading-snug text-fg-2">{newest.title}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-fg-4">
              <span className="font-semibold uppercase tracking-wide">{meta.label}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={new Date(newest.createdAt).toISOString()} suppressHydrationWarning>
                {timeAgo(newest.createdAt)}
              </time>
              {freshN > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-accent-text">{freshN} ta yangi</span>
                </>
              )}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {g.href && (
              <Link href={g.href} onClick={() => markMany(g.items, false)} className="inline-flex h-9 items-center rounded-full border border-line px-3 text-[12.5px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4">
                Ochish
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                toggleGroup(g.key);
                if (!open) markMany(g.items, false);
              }}
              aria-expanded={open}
              aria-label={open ? "Yig'ish" : `${g.items.length} ta yozuvni ko'rsatish`}
              className="flex h-9 w-9 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg"
            >
              <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
            </button>
          </span>
        </div>
        {open && (
          <ul className="expand-in divide-y divide-line border-t border-line bg-surface-2/50 pl-6 sm:pl-8">
            {g.items.map((n) => (
              <li key={n.id}>{renderOne(n)}</li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <section className="card m-flat overflow-hidden" aria-labelledby="notif-list-title">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <h2 id="notif-list-title" className="text-[14px] font-semibold text-fg">
          {left > 0 ? (
            <>
              <span className="tabular-nums text-accent-text">{left}</span> ta o&apos;qilmagan
            </>
          ) : (
            "Hammasi o'qilgan"
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {canPurge && left === 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={purge} disabled={busy !== null} title="30 kundan eski o'qilganlarni o'chirish">
              {busy === "purge" ? <Spinner /> : <Eraser size={15} />} Eskilarini tozalash
            </Button>
          )}
          {left > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={markAll} disabled={busy !== null}>
              {busy === "all" ? <Spinner /> : <CheckCheck size={15} />} Hammasini o&apos;qilgan deb belgilash
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="border-t border-line px-5 py-2.5 text-[13px] font-medium text-danger-text">
          {error}
        </p>
      )}
      <div className="border-t border-line">
        {sections.map((s) => (
          <section key={s.day} aria-label={s.label}>
            <h3 className="sticky top-0 z-[1] bg-surface/95 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4 backdrop-blur-sm sm:px-5" suppressHydrationWarning>
              {s.label}
            </h3>
            <ul className="divide-y divide-line border-y border-line">
              {s.entries.map((e) => (
                <li key={e.kind === "one" ? e.n.id : e.key}>{e.kind === "one" ? renderOne(e.n) : renderGroup(e)}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
