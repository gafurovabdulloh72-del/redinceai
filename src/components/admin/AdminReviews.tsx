"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, MessageSquareText, Star, Trash2 } from "lucide-react";
import { Avatar, Button, EmptyState, Spinner } from "@/components/ui";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export interface AdminReviewRow {
  id: string;
  rating: number;
  text: string;
  createdAt: number;
  author: { name: string; email: string };
  specialist: { slug: string; name: string };
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };
const MOBILE_CAP = 10;

/** Admin: so'nggi sharhlar — o'chirish (inline tasdiq) → reyting qayta hisoblanadi (F88) */
export function AdminReviews({ rows: initialRows }: { rows: AdminReviewRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [seen, setSeen] = useState(initialRows);
  if (seen !== initialRows) {
    setSeen(initialRows);
    setRows(initialRows);
  }
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [notice]);

  const remove = async (r: AdminReviewRow) => {
    if (busy) return;
    setError(null);
    setAsk(null);
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/reviews/${r.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ deleted: boolean }> | null;
      if (!json || !json.ok) throw new Error(json?.error ?? "Server javob bermadi");
      setRows((rs) => rs.filter((x) => x.id !== r.id));
      setNotice(`${r.author.name} sharhi o'chirildi — ${r.specialist.name} reytingi qayta hisoblandi`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Kutilmagan xatolik");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div aria-live="polite" className="space-y-2 empty:hidden">
        {error && (
          <p className="flex items-center gap-2 rounded-[14px] bg-danger-soft px-4 py-2.5 text-[13px] font-medium text-danger-text">
            <AlertCircle size={15} /> {error}
          </p>
        )}
        {notice && (
          <p className="flex items-center gap-2 rounded-[14px] bg-success-soft px-4 py-2.5 text-[13px] font-medium text-success-text animate-fade-up" style={{ animationDuration: "0.25s" }}>
            <CheckCircle2 size={15} /> {notice}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={MessageSquareText} title="Sharhlar yo'q" description="Mijozlar sharh qoldirganda shu yerda ko'rinadi." />
      ) : (
        <>
          <ul className="card divide-y divide-line overflow-hidden">
            {rows.map((r, i) => (
              <li key={r.id} className={cn("px-4 py-3.5 sm:px-5", busy === r.id && "opacity-60", i >= MOBILE_CAP && !showAll && "hidden md:block")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <Avatar name={r.author.name} size={36} decorative />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                      <span className="font-semibold text-fg">{r.author.name}</span>
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-3/15 px-1.5 py-0.5 text-[11px] font-bold text-accent-3">
                        <Star size={10} className="fill-current" /> {r.rating}
                      </span>
                      <span className="text-fg-4">→</span>
                      <Link href={`/mutaxassislar/${r.specialist.slug}#sharhlar`} className="text-fg-2 hover:text-accent">
                        {r.specialist.name}
                      </Link>
                      <time dateTime={new Date(r.createdAt).toISOString()} className="text-[11px] text-fg-4" title={formatDateTime(r.createdAt)} suppressHydrationWarning>
                        {timeAgo(r.createdAt)}
                      </time>
                    </p>
                    <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-fg-2">{r.text}</p>
                    <p className="mt-0.5 truncate text-[11px] text-fg-4">{r.author.email}</p>
                  </div>
                  <div className="shrink-0 sm:w-[200px] sm:text-right">
                    {ask === r.id ? (
                      <div className="card-outline flex flex-col gap-2 !rounded-[14px] p-2.5 text-left animate-fade-up" style={{ animationDuration: "0.2s" }}>
                        <p className="flex items-start gap-1.5 text-[12px] text-fg">
                          <AlertCircle size={14} className="mt-0.5 shrink-0 text-danger" /> Sharh butunlay o'chiriladi, reyting qayta hisoblanadi.
                        </p>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="danger" className="h-11 md:h-9" onClick={() => remove(r)} disabled={!!busy}>
                            {busy === r.id ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 size={14} />} Ha, o'chirish
                          </Button>
                          <Button size="sm" variant="ghost" className="h-11 md:h-9" onClick={() => setAsk(null)} disabled={!!busy}>
                            Yo'q
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="h-11 text-danger-text hover:border-danger hover:bg-danger-soft md:h-9" onClick={() => setAsk(r.id)} disabled={!!busy}>
                        <Trash2 size={14} /> O'chirish
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {rows.length > MOBILE_CAP && !showAll && (
            <Button variant="outline" size="md" className="w-full md:hidden" onClick={() => setShowAll(true)}>
              Yana {rows.length - MOBILE_CAP} ta ko'rsatish
            </Button>
          )}
        </>
      )}
    </div>
  );
}
