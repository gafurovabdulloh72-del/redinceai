"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ExternalLink, Flag, RotateCcw } from "lucide-react";
import { AdminBanToggle } from "@/components/admin/AdminBanToggle";
import { Badge, Button, EmptyState, Spinner } from "@/components/ui";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export interface AdminReportRowDto {
  id: string;
  targetType: "specialist" | "review" | "user";
  targetId: string;
  reason: string;
  status: "open" | "closed";
  createdAt: number;
  reporter: { name: string; email: string };
  target: { label: string; href: string | null; snippet: string | null } | null;
  /** Profil shikoyatida — egasi (bloklash uchun) */
  owner?: { userId: string; name: string; isBanned: boolean; bannedReason: string | null } | null;
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

/** Admin: shikoyatlar (profil / sharh) — yopish, qayta ochish; nishonga havola (F85/F88) */
export function AdminReports({ rows: initialRows }: { rows: AdminReportRowDto[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [seen, setSeen] = useState(initialRows);
  if (seen !== initialRows) {
    setSeen(initialRows);
    setRows(initialRows);
  }
  const [busy, setBusy] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [notice]);

  const setStatus = async (r: AdminReportRowDto, status: "open" | "closed") => {
    if (busy) return;
    setError(null);
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/reports/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ status: "open" | "closed" }> | null;
      if (!json || !json.ok) throw new Error(json?.error ?? "Server javob bermadi");
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, status: json.data.status } : x)));
      setNotice(status === "closed" ? "Shikoyat yopildi" : "Shikoyat qayta ochildi");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Kutilmagan xatolik");
    } finally {
      setBusy(null);
    }
  };

  const open = rows.filter((r) => r.status === "open");
  const closed = rows.filter((r) => r.status === "closed");

  const Row = ({ r }: { r: AdminReportRowDto }) => (
    <li className={cn("px-4 py-3.5 sm:px-5", busy === r.id && "opacity-60")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            <Badge tone={r.targetType === "review" ? "purple" : r.targetType === "user" ? "blue" : "accent"}>{r.targetType === "review" ? "Sharh" : r.targetType === "user" ? "Chat" : "Profil"}</Badge>
            {r.target ? (
              r.target.href ? (
                <Link href={r.target.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-fg hover:text-accent">
                  {r.target.label} <ExternalLink size={12} className="text-fg-4" />
                </Link>
              ) : (
                <span className="font-semibold text-fg-3">{r.target.label}</span>
              )
            ) : null}
            <time dateTime={new Date(r.createdAt).toISOString()} className="text-[11px] text-fg-4" title={formatDateTime(r.createdAt)} suppressHydrationWarning>
              {timeAgo(r.createdAt)}
            </time>
          </p>
          {r.target?.snippet && <p className="mt-1 line-clamp-2 rounded-[12px] bg-surface-2 px-3 py-1.5 text-[12px] italic text-fg-3">«{r.target.snippet}»</p>}
          <p className="mt-1.5 text-[13px] leading-snug text-fg-2">
            <span className="font-semibold text-fg">Sabab:</span> {r.reason}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-fg-4">
            {r.reporter.name} · {r.reporter.email}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2 sm:justify-end">
          {r.owner && <AdminBanToggle key={`${r.owner.userId}:${r.owner.isBanned}`} userId={r.owner.userId} name={r.owner.name} initialBanned={r.owner.isBanned} initialReason={r.owner.bannedReason} />}
          {r.status === "open" ? (
            <Button size="sm" variant="outline" className="h-11 md:h-9" onClick={() => setStatus(r, "closed")} disabled={!!busy}>
              {busy === r.id ? <Spinner className="h-3.5 w-3.5" /> : <Check size={14} />} Yopish
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-11 md:h-9" onClick={() => setStatus(r, "open")} disabled={!!busy}>
              {busy === r.id ? <Spinner className="h-3.5 w-3.5" /> : <RotateCcw size={14} />} Qayta ochish
            </Button>
          )}
        </div>
      </div>
    </li>
  );

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

      {open.length === 0 ? (
        <EmptyState icon={Flag} title="Ochiq shikoyatlar yo'q" description="Foydalanuvchilar profil yoki sharh haqida shikoyat qilsa shu yerda ko'rinadi." />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {open.map((r) => (
            <Row key={r.id} r={r} />
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowClosed((v) => !v)} className="inline-flex min-h-10 items-center gap-1.5 px-1 text-[13px] font-semibold text-fg-2 transition hover:text-fg" aria-expanded={showClosed}>
            {showClosed ? "Yopilganlarni yashirish" : `Yopilgan shikoyatlar (${closed.length})`}
          </button>
          {showClosed && (
            <ul className="card mt-2 divide-y divide-line overflow-hidden">
              {closed.map((r) => (
                <Row key={r.id} r={r} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
