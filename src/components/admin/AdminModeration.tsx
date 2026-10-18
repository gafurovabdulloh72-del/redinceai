"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, ExternalLink, Flag, Loader2, Lock, LockOpen, Search, Trash2, UserCog, Users, XCircle } from "lucide-react";
import { AdminRowMenu } from "@/components/admin/AdminRowMenu";
import { Badge, Button, EmptyState, Spinner } from "@/components/ui";
import { showToast } from "@/components/ui/toast";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

/**
 * Admin: jamoalar va vakansiyalar moderatsiyasi — mavjud jadvallar ustida:
 * jamoa: ochish, egasini almashtirish (email), yopiq/ochiq, o'chirish; vakansiya: yopish (sabab bilan) / qayta ochish, o'chirish.
 * Avto-bayroqlar (oldindan to'lov so'rash, matnda kontakt) qator ustida ogohlantirish sifatida.
 */

interface GroupRow {
  id: string;
  slug: string;
  name: string;
  kind: "group" | "channel";
  isPrivate: boolean;
  isOfficial: boolean;
  membersCount: number;
  postsCount: number;
  openReports: number;
  lastActivityAt: number | null;
  createdAt: number;
  owner: { id: string; name: string; email: string; isBanned: boolean } | null;
}
interface VacancyRow {
  id: string;
  title: string;
  company: string;
  profession: string;
  status: "open" | "closed";
  expired: boolean;
  applicationsCount: number;
  viewCount: number;
  createdAt: number;
  expiresAt: number | null;
  externalApply: boolean;
  flags: Array<"prepayment" | "contact">;
  author: { id: string; name: string; email: string; isBanned: boolean } | null;
}
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

const FLAG_LABEL: Record<VacancyRow["flags"][number], string> = { prepayment: "Oldindan to'lov so'raydi", contact: "Matnda kontakt (arizani chetlab o'tish)" };
const PAGE = 8;

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) throw new Error("Server javob bermadi");
  if (!json.ok) throw new Error((json.fields && Object.values(json.fields)[0]) || json.error);
  return json.data;
}
const errMsg = (e: unknown) => (e instanceof Error && e.message ? e.message : "Kutilmagan xatolik");

export function AdminModeration() {
  const [tab, setTab] = useState<"groups" | "vacancies">("groups");
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ groups: GroupRow[]; vacancies: VacancyRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** Inline panel: {id, kind} — ega almashtirish / o'chirish tasdig'i / yopish sababi */
  const [panel, setPanel] = useState<{ id: string; kind: "owner" | "delete" | "close" } | null>(null);
  const [input, setInput] = useState("");
  const [showAll, setShowAll] = useState(false);
  const timer = useRef<number | null>(null);

  const load = useCallback(async (query: string) => {
    try {
      const d = await req<{ groups: GroupRow[]; vacancies: VacancyRow[] }>(`/api/admin/moderation${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
      setData(d);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void load(q), q ? 300 : 0);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [q, load]);

  const run = async (id: string, fn: () => Promise<void>, okText: string) => {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      await fn();
      setPanel(null);
      setInput("");
      showToast(okText);
    } catch (e) {
      setError(errMsg(e));
      showToast(errMsg(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const openPanel = (id: string, kind: "owner" | "delete" | "close") => {
    setError(null);
    setInput("");
    setPanel(panel?.id === id && panel.kind === kind ? null : { id, kind });
  };

  /* ---------- Jamoa amallari ---------- */
  const transferOwner = (g: GroupRow) =>
    run(
      g.id,
      async () => {
        const d = await req<{ owner: GroupRow["owner"] }>(`/api/admin/moderation/groups/${g.id}`, { method: "PATCH", body: JSON.stringify({ ownerEmail: input.trim() }) });
        setData((s) => (s ? { ...s, groups: s.groups.map((x) => (x.id === g.id ? { ...x, owner: d.owner } : x)) } : s));
      },
      `«${g.name}» egasi almashtirildi`,
    );
  const togglePrivate = (g: GroupRow) =>
    run(
      g.id,
      async () => {
        const d = await req<{ isPrivate: boolean }>(`/api/admin/moderation/groups/${g.id}`, { method: "PATCH", body: JSON.stringify({ isPrivate: !g.isPrivate }) });
        setData((s) => (s ? { ...s, groups: s.groups.map((x) => (x.id === g.id ? { ...x, isPrivate: d.isPrivate } : x)) } : s));
      },
      g.isPrivate ? `«${g.name}» ochiq qilindi` : `«${g.name}» yopiq qilindi`,
    );
  const deleteGroup = (g: GroupRow) =>
    run(
      g.id,
      async () => {
        await req(`/api/admin/moderation/groups/${g.id}`, { method: "DELETE" });
        setData((s) => (s ? { ...s, groups: s.groups.filter((x) => x.id !== g.id) } : s));
      },
      `«${g.name}» o'chirildi`,
    );

  /* ---------- Vakansiya amallari ---------- */
  const setVacancyStatus = (v: VacancyRow, status: "open" | "closed") =>
    run(
      v.id,
      async () => {
        const d = await req<{ status: "open" | "closed" }>(`/api/admin/moderation/vacancies/${v.id}`, { method: "PATCH", body: JSON.stringify({ status, reason: status === "closed" && input.trim() ? input.trim() : undefined }) });
        setData((s) => (s ? { ...s, vacancies: s.vacancies.map((x) => (x.id === v.id ? { ...x, status: d.status } : x)) } : s));
      },
      status === "closed" ? `«${v.title}» yopildi` : `«${v.title}» qayta ochildi`,
    );
  const deleteVacancy = (v: VacancyRow) =>
    run(
      v.id,
      async () => {
        await req(`/api/admin/moderation/vacancies/${v.id}`, { method: "DELETE" });
        setData((s) => (s ? { ...s, vacancies: s.vacancies.filter((x) => x.id !== v.id) } : s));
      },
      `«${v.title}» o'chirildi`,
    );

  const flaggedCount = data?.vacancies.filter((v) => v.flags.length > 0 && v.status === "open").length ?? 0;
  const reportedGroups = data?.groups.filter((g) => g.openReports > 0).length ?? 0;

  const ConfirmDelete = ({ id, name, onYes }: { id: string; name: string; onYes: () => void }) => (
    <div className="card-outline expand-in mt-3 flex flex-col gap-2 !rounded-[14px] p-2.5 sm:flex-row sm:items-center" role="alertdialog" aria-label="O'chirishni tasdiqlash">
      <p className="flex flex-1 items-start gap-1.5 text-[12px] font-medium text-fg">
        <AlertCircle size={14} className="mt-0.5 shrink-0 text-danger" /> «{name}» butunlay o&apos;chirilsinmi? Qaytarib bo&apos;lmaydi; egasiga bildirishnoma boradi.
      </p>
      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" variant="danger" onClick={onYes} disabled={busy === id}>
          {busy === id ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 size={14} />} Ha, o&apos;chirish
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPanel(null)} disabled={busy === id}>
          Yo&apos;q
        </Button>
      </div>
    </div>
  );

  const list = tab === "groups" ? (data?.groups ?? []) : (data?.vacancies ?? []);
  const shown = showAll ? list : list.slice(0, PAGE);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="segment" role="tablist" aria-label="Moderatsiya bo'limi">
          <button type="button" role="tab" aria-selected={tab === "groups"} data-active={tab === "groups"} onClick={() => { setTab("groups"); setShowAll(false); }} className="segment-item inline-flex min-h-9 items-center gap-1.5">
            <Users size={14} /> Jamoalar <span className="text-[11px] opacity-70 tabular-nums">{data?.groups.length ?? "…"}</span>
            {reportedGroups > 0 && <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning-text">{reportedGroups}</span>}
          </button>
          <button type="button" role="tab" aria-selected={tab === "vacancies"} data-active={tab === "vacancies"} onClick={() => { setTab("vacancies"); setShowAll(false); }} className="segment-item inline-flex min-h-9 items-center gap-1.5">
            <Flag size={14} /> Vakansiyalar <span className="text-[11px] opacity-70 tabular-nums">{data?.vacancies.length ?? "…"}</span>
            {flaggedCount > 0 && <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning-text">{flaggedCount}</span>}
          </button>
        </div>
        <label className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-4" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder={tab === "groups" ? "Jamoa nomi yoki slug" : "Vakansiya yoki kompaniya"} aria-label="Moderatsiyada qidirish" className="field !h-9 !min-h-0 w-full !rounded-full !py-0 !pl-8 text-[13px]" autoComplete="off" />
        </label>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-[14px] bg-danger-soft px-4 py-2.5 text-[13px] font-medium text-danger-text">
          <AlertCircle size={15} /> {error}
        </p>
      )}

      {!data ? (
        <div className="card p-4" aria-busy="true" aria-label="Yuklanmoqda">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <span className="h-9 w-9 shrink-0 rounded-[10px] skeleton" />
              <span className="flex-1 space-y-2">
                <span className="block h-3.5 w-1/3 skeleton" />
                <span className="block h-3 w-1/2 skeleton" />
              </span>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={tab === "groups" ? Users : Flag} title={q ? "Hech narsa topilmadi" : tab === "groups" ? "Jamoalar yo'q" : "Vakansiyalar yo'q"} description={q ? "Boshqa so'z bilan qidiring." : undefined} />
      ) : tab === "groups" ? (
        <ul className="card divide-y divide-line">
          {(shown as GroupRow[]).map((g) => (
            <li key={g.id} className={cn("px-4 py-3 sm:px-5", busy === g.id && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold text-fg">
                    <Link href={`/jamoalar/${g.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-accent">
                      <span className="truncate">{g.name}</span> <ExternalLink size={12} className="text-fg-4" />
                    </Link>
                    <Badge tone={g.kind === "channel" ? "info" : "neutral"}>{g.kind === "channel" ? "Kanal" : "Guruh"}</Badge>
                    {g.isOfficial && <Badge tone="accent">Rasmiy</Badge>}
                    {g.isPrivate && <Badge tone="neutral">Yopiq</Badge>}
                    {g.openReports > 0 && (
                      <Badge tone="warning">
                        <Flag size={10} /> {g.openReports} ta shikoyat
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-[12px] text-fg-3">
                    {g.membersCount} a&apos;zo · {g.postsCount} post · faollik {g.lastActivityAt ? timeAgo(g.lastActivityAt) : "yo'q"} · egasi: {g.owner ? `${g.owner.name} (${g.owner.email})` : "—"}
                    {g.owner?.isBanned ? " · bloklangan" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {g.openReports > 0 && (
                    <Link href="#shikoyatlar" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                      Shikoyatlar
                    </Link>
                  )}
                  <AdminRowMenu
                    label={`${g.name}: amallar`}
                    disabled={busy === g.id}
                    items={[
                      { key: "owner", label: "Egasini almashtirish", icon: UserCog, onSelect: () => openPanel(g.id, "owner") },
                      { key: "private", label: g.isPrivate ? "Ochiq qilish" : "Yopiq qilish", icon: g.isPrivate ? LockOpen : Lock, disabled: g.isOfficial, onSelect: () => void togglePrivate(g) },
                      { key: "delete", label: "Jamoani o'chirish", icon: Trash2, danger: true, divider: true, disabled: g.isOfficial, title: g.isOfficial ? "Rasmiy kanal o'chirilmaydi" : undefined, onSelect: () => openPanel(g.id, "delete") },
                    ]}
                  />
                </div>
              </div>
              {panel?.id === g.id && panel.kind === "owner" && (
                <div className="expand-in mt-3 flex flex-col gap-2 sm:flex-row" role="group" aria-label="Egasini almashtirish">
                  <input autoFocus type="email" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Yangi egasining emaili" aria-label="Yangi egasining emaili" className="field !h-10 !min-h-0 flex-1 text-[13px]" onKeyDown={(e) => e.key === "Enter" && input.includes("@") && void transferOwner(g)} />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-10" onClick={() => void transferOwner(g)} disabled={busy === g.id || !input.includes("@")}>
                      {busy === g.id ? <Loader2 size={14} className="animate-spin" /> : <UserCog size={14} />} Almashtirish
                    </Button>
                    <Button size="sm" variant="ghost" className="h-10" onClick={() => setPanel(null)}>
                      Bekor
                    </Button>
                  </div>
                </div>
              )}
              {panel?.id === g.id && panel.kind === "delete" && <ConfirmDelete id={g.id} name={g.name} onYes={() => void deleteGroup(g)} />}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="card divide-y divide-line">
          {(shown as VacancyRow[]).map((v) => (
            <li key={v.id} className={cn("px-4 py-3 sm:px-5", busy === v.id && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold text-fg">
                    <Link href={`/vakansiyalar/${v.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-accent">
                      <span className="truncate">{v.title}</span> <ExternalLink size={12} className="text-fg-4" />
                    </Link>
                    <Badge tone={v.status === "open" ? (v.expired ? "neutral" : "success") : "neutral"}>{v.status === "open" ? (v.expired ? "Muddati o'tgan" : "Ochiq") : "Yopilgan"}</Badge>
                    {v.externalApply && <Badge tone="info">Tashqi ariza</Badge>}
                  </p>
                  <p className="truncate text-[12px] text-fg-3">
                    {v.company || "Shaxs"} · {v.applicationsCount} ariza · {v.viewCount} ko&apos;rish · {formatDateTime(v.createdAt)} · {v.author ? `${v.author.name} (${v.author.email})` : "—"}
                  </p>
                  {v.flags.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {v.flags.map((f) => (
                        <span key={f} className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning-text">
                          <AlertTriangle size={11} /> {FLAG_LABEL[f]}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {v.status === "open" ? (
                    <Button size="sm" variant="outline" onClick={() => openPanel(v.id, "close")} disabled={busy === v.id} aria-expanded={panel?.id === v.id && panel.kind === "close"}>
                      <XCircle size={14} /> Yopish
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => void setVacancyStatus(v, "open")} disabled={busy === v.id}>
                      {busy === v.id ? <Spinner className="h-3.5 w-3.5" /> : <LockOpen size={14} />} Qayta ochish
                    </Button>
                  )}
                  <AdminRowMenu label={`${v.title}: amallar`} disabled={busy === v.id} items={[{ key: "delete", label: "Vakansiyani o'chirish", icon: Trash2, danger: true, onSelect: () => openPanel(v.id, "delete") }]} />
                </div>
              </div>
              {panel?.id === v.id && panel.kind === "close" && (
                <div className="expand-in mt-3 flex flex-col gap-2 sm:flex-row" role="group" aria-label="Yopish sababi">
                  <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} maxLength={300} placeholder="Sabab (ixtiyoriy, egasiga yuboriladi): masalan, oldindan to'lov so'ralgan" aria-label="Yopish sababi" className="field !h-10 !min-h-0 flex-1 text-[13px]" />
                  <div className="flex gap-2">
                    <Button size="sm" variant="danger" className="h-10" onClick={() => void setVacancyStatus(v, "closed")} disabled={busy === v.id || (input.trim().length > 0 && input.trim().length < 5)}>
                      {busy === v.id ? <Spinner className="h-3.5 w-3.5" /> : <XCircle size={14} />} Yopish
                    </Button>
                    <Button size="sm" variant="ghost" className="h-10" onClick={() => setPanel(null)}>
                      Bekor
                    </Button>
                  </div>
                </div>
              )}
              {panel?.id === v.id && panel.kind === "delete" && <ConfirmDelete id={v.id} name={v.title} onYes={() => void deleteVacancy(v)} />}
            </li>
          ))}
        </ul>
      )}
      {list.length > PAGE && !showAll && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(true)}>
          Yana {list.length - PAGE} ta ko&apos;rsatish
        </Button>
      )}
    </div>
  );
}
