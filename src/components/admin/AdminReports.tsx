"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ExternalLink, Flag, RotateCcw, Trash2, UserCheck } from "lucide-react";
import { AdminBanToggle } from "@/components/admin/AdminBanToggle";
import { Badge, Button, EmptyState, Spinner } from "@/components/ui";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export interface AdminReportRowDto {
  id: string;
  targetType: "specialist" | "review" | "user" | "post" | "comment" | "message";
  targetId: string;
  reason: string;
  status: "open" | "closed";
  createdAt: number;
  reporter: { name: string; email: string };
  target: { label: string; href: string | null; snippet: string | null } | null;
  /** Profil shikoyatida — egasi (bloklash uchun) */
  owner?: { userId: string; name: string; isBanned: boolean; bannedReason: string | null } | null;
  /** Yopilgan shikoyatda — kim yopgani */
  resolver?: { name: string; email: string } | null;
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

const TYPE_META: Record<AdminReportRowDto["targetType"], { label: string; tone: "accent" | "purple" | "blue" | "neutral" }> = {
  specialist: { label: "Profil", tone: "accent" },
  review: { label: "Sharh", tone: "purple" },
  user: { label: "Chat", tone: "blue" },
  post: { label: "Post", tone: "accent" },
  comment: { label: "Izoh", tone: "purple" },
  message: { label: "Xabar", tone: "blue" },
};
/** Admin nishonning o'zini o'chira oladigan turlar (sharh — maxsus endpoint; post/izoh — umumiy DELETE, admin ruxsati bor) */
const DELETE_LABEL: Partial<Record<AdminReportRowDto["targetType"], string>> = { review: "Sharhni o'chirish", post: "Postni o'chirish", comment: "Izohni o'chirish" };

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
  /** Sharhni o'chirish inline tasdig'i (shikoyat id) */
  const [confirmDeleteReview, setConfirmDeleteReview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | AdminReportRowDto["targetType"]>("all");

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

  /** Nishonni o'chirish: sharh — /api/admin/reviews/[id] (reyting qayta hisoblanadi, barcha shikoyatlar yopiladi);
   *  post/izoh — umumiy DELETE (sayt admini ruxsati), keyin shu shikoyat yopiladi */
  const deleteReview = async (r: AdminReportRowDto) => {
    if (busy) return;
    setError(null);
    setBusy(r.id);
    setConfirmDeleteReview(null);
    try {
      const url = r.targetType === "review" ? `/api/admin/reviews/${r.targetId}` : r.targetType === "post" ? `/api/posts/${r.targetId}` : `/api/comments/${r.targetId}`;
      const res = await fetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" } });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ deleted: boolean }> | null;
      if (!json || !json.ok) throw new Error(json && !json.ok ? json.error : "Server javob bermadi");
      if (r.targetType !== "review") await fetch(`/api/admin/reports/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "closed" }) });
      const gone = r.targetType === "review" ? "O'chirilgan sharh" : r.targetType === "post" ? "O'chirilgan post" : "O'chirilgan izoh";
      setRows((rs) => rs.map((x) => (x.targetType === r.targetType && x.targetId === r.targetId ? { ...x, status: "closed" as const, target: { label: gone, href: null, snippet: null } } : x)));
      setNotice(r.targetType === "review" ? "Sharh o'chirildi — reyting qayta hisoblandi, shikoyat yopildi" : `${TYPE_META[r.targetType].label} o'chirildi, shikoyat yopildi`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Kutilmagan xatolik");
    } finally {
      setBusy(null);
    }
  };

  const openAll = rows.filter((r) => r.status === "open");
  const closed = rows.filter((r) => r.status === "closed");
  /** Tur bo'yicha filtr (faqat ochiqlar uchun; chiplar mavjud turlardan tuziladi) */
  const typeCounts = (Object.keys(TYPE_META) as AdminReportRowDto["targetType"][]).map((t) => [t, openAll.filter((r) => r.targetType === t).length] as const).filter(([, n]) => n > 0);
  const open = typeFilter === "all" ? openAll : openAll.filter((r) => r.targetType === typeFilter);

  const Row = ({ r }: { r: AdminReportRowDto }) => (
    <li className={cn("px-4 py-3.5 sm:px-5", busy === r.id && "opacity-60")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            <Badge tone={TYPE_META[r.targetType].tone}>{TYPE_META[r.targetType].label}</Badge>
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
          {r.status === "closed" && r.resolver && (
            <p className="mt-0.5 inline-flex items-center gap-1 truncate text-[11px] text-fg-4" title="Shikoyatni yopgan admin">
              <UserCheck size={11} /> Yopdi: {r.resolver.name} · {r.resolver.email}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2 sm:justify-end">
          {r.owner && <AdminBanToggle key={`${r.owner.userId}:${r.owner.isBanned}`} userId={r.owner.userId} name={r.owner.name} initialBanned={r.owner.isBanned} initialReason={r.owner.bannedReason} />}
          {DELETE_LABEL[r.targetType] && r.target && !r.target.label.startsWith("O'chirilgan") && r.status === "open" && (
            confirmDeleteReview === r.id ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="danger" className="h-11 md:h-9" onClick={() => deleteReview(r)} disabled={!!busy}>
                  {busy === r.id ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 size={14} />} Ha, o'chirish
                </Button>
                <Button size="sm" variant="ghost" className="h-11 md:h-9" onClick={() => setConfirmDeleteReview(null)} disabled={!!busy}>
                  Yo'q
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="outline" className="h-11 text-danger-text hover:border-danger hover:bg-danger-soft md:h-9" onClick={() => setConfirmDeleteReview(r.id)} disabled={!!busy} title="Kontent butunlay o'chadi, shikoyat yopiladi">
                <Trash2 size={14} /> {DELETE_LABEL[r.targetType]}
              </Button>
            )
          )}
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
          <p className="expand-in flex items-center gap-2 rounded-[14px] bg-success-soft px-4 py-2.5 text-[13px] font-medium text-success-text">
            <CheckCircle2 size={15} /> {notice}
          </p>
        )}
      </div>

      {typeCounts.length > 1 && (
        <div className="segment w-max max-w-full" role="group" aria-label="Shikoyat turi bo'yicha filtr">
          <button type="button" className="segment-item inline-flex min-h-9 items-center gap-1.5" data-active={typeFilter === "all"} aria-pressed={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
            Hammasi <span className="text-[11px] opacity-70 tabular-nums">{openAll.length}</span>
          </button>
          {typeCounts.map(([t, n]) => (
            <button key={t} type="button" className="segment-item inline-flex min-h-9 items-center gap-1.5" data-active={typeFilter === t} aria-pressed={typeFilter === t} onClick={() => setTypeFilter(t)}>
              {TYPE_META[t].label} <span className="text-[11px] opacity-70 tabular-nums">{n}</span>
            </button>
          ))}
        </div>
      )}

      {openAll.length === 0 ? (
        <EmptyState icon={Flag} title="Ochiq shikoyatlar yo'q" description="Profil, sharh, post, izoh yoki xabar haqida shikoyat kelsa shu yerda ko'rinadi." />
      ) : open.length === 0 ? (
        <EmptyState icon={Flag} title="Bu turda ochiq shikoyat yo'q" description="Boshqa turni tanlang." />
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
            <ul className="expand-in card mt-2 divide-y divide-line overflow-hidden">
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
