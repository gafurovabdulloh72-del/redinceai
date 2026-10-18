"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ExternalLink, Radio } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

/** Admin: barcha kanallardagi efir e'lonlari — kun bo'yicha guruhlangan kalendar (o'tgan 7 kun + kelgusi) */
interface EventRow {
  id: string;
  title: string;
  eventAt: number;
  eventUrl: string | null;
  past: boolean;
  group: { slug: string; name: string; kind: "group" | "channel"; isOfficial: boolean } | null;
  author: string | null;
  href: string | null;
}

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
/** Toshkent kuni kaliti (YYYY-MM-DD) */
const dayKey = (ms: number) => new Date(ms + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
const timeOf = (ms: number) => formatDateTime(ms).split(", ")[1] ?? "";

export function AdminEvents() {
  const [rows, setRows] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/events", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j?.ok ? setRows(j.data as EventRow[]) : setError(j?.error ?? "Yuklab bo'lmadi")))
      .catch(() => setError("Tarmoq xatosi"));
  }, []);

  if (error) return <p role="alert" className="rounded-[14px] bg-danger-soft px-4 py-2.5 text-[13px] font-medium text-danger-text">{error}</p>;
  if (!rows)
    return (
      <div className="card p-4" aria-busy="true" aria-label="Yuklanmoqda">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2.5">
            <span className="h-9 w-14 shrink-0 rounded-[10px] skeleton" />
            <span className="flex-1 space-y-2">
              <span className="block h-3.5 w-1/2 skeleton" />
              <span className="block h-3 w-1/3 skeleton" />
            </span>
          </div>
        ))}
      </div>
    );
  if (rows.length === 0) return <EmptyState icon={CalendarDays} title="Rejalashtirilgan efir yo'q" description="Kanal egalari efir e'lon qilganda shu yerda ko'rinadi (o'tgan 7 kun ham)." />;

  const days = new Map<string, EventRow[]>();
  for (const r of rows) {
    const k = dayKey(r.eventAt);
    days.set(k, [...(days.get(k) ?? []), r]);
  }
  const today = dayKey(Date.now());
  const upcoming = rows.filter((r) => !r.past).length;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <p className="text-[13px] font-semibold text-fg">
          {upcoming} ta kelgusi · {rows.length - upcoming} ta o&apos;tgan (7 kun)
        </p>
        <Link href="/jamoalar" className="text-[12px] font-semibold text-fg-3 transition hover:text-fg">
          Jamoalar →
        </Link>
      </div>
      {[...days.entries()].map(([day, items]) => (
        <section key={day} aria-label={formatDate(items[0]!.eventAt)}>
          <h3 className={cn("flex items-center gap-2 bg-surface-2 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] sm:px-5", day === today ? "text-accent-text" : "text-fg-3")}>
            {formatDate(items[0]!.eventAt)}
            {day === today && <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] normal-case tracking-normal">bugun</span>}
          </h3>
          <ul className="divide-y divide-line">
            {items.map((e) => (
              <li key={e.id} className={cn("flex items-center gap-3 px-4 py-2.5 sm:px-5", e.past && "opacity-60")}>
                <time dateTime={new Date(e.eventAt).toISOString()} className="w-12 shrink-0 text-[13px] font-semibold text-fg tabular-nums">
                  {timeOf(e.eventAt)}
                </time>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-fg">{e.title}</p>
                  <p className="flex flex-wrap items-center gap-x-1.5 truncate text-[12px] text-fg-3">
                    {e.group && (
                      <>
                        <Radio size={11} className="text-fg-4" /> {e.group.name}
                        {e.group.isOfficial && <Badge tone="accent" className="!px-1.5 !py-0 text-[10px]">Rasmiy</Badge>}
                      </>
                    )}
                    {e.author && <span>· {e.author}</span>}
                    {e.past && <span>· o&apos;tgan</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {e.eventUrl && (
                    <a href={e.eventUrl} target="_blank" rel="noreferrer noopener" className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg" aria-label={`${e.title}: efir havolasi`}>
                      <ExternalLink size={13} /> Efir
                    </a>
                  )}
                  {e.href && (
                    <Link href={e.href} className="inline-flex h-8 items-center rounded-full px-2.5 text-[12px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg" aria-label={`${e.title}: postni ochish`}>
                      Post
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
