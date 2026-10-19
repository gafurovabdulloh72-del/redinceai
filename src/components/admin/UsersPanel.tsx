"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ban, BarChart3, Download, ExternalLink, Eye, EyeOff, Loader2, MessageCircle, Search, ShieldCheck, Star, StickyNote, Undo2 } from "lucide-react";
import { AdminRowMenu } from "@/components/admin/AdminRowMenu";
import { UserAnalyticsSheet } from "@/components/admin/UserAnalyticsSheet";
import { Avatar, Button } from "@/components/ui";
import { showToast } from "@/components/ui/toast";
import { cn, formatDate, formatDateTime, timeAgo } from "@/lib/utils";

/**
 * Admin: foydalanuvchilarni boshqarish — qidiruv (ism/email/telefon/@taxallus), holat filtri,
 * katalogda ko'rsatish, bloklash (sabab bilan), admin izohi; ikkilamchi amallar «⋯» menyuda.
 * CSV eksport — joriy filtr bo'yicha (GET /api/admin/users?format=csv).
 */

interface Row {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: string;
  isBanned: boolean;
  bannedReason: string | null;
  isPrivileged: boolean;
  /** Katalogda ko'rinadimi (profil bor va admin yashirmagan) */
  listed: boolean;
  avatarUrl: string | null;
  slug: string | null;
  createdAt: number;
  lastLoginAt: number | null;
  adminNote: string | null;
  adminNoteAt: number | null;
}

type Filter = "" | "banned" | "active" | "privileged" | "unlisted";
const FILTERS: Array<[Filter, string]> = [
  ["", "Barchasi"],
  ["active", "Faol"],
  ["banned", "Bloklangan"],
  ["privileged", "Imtiyozli"],
  ["unlisted", "Katalogda yo'q"],
];
const ROLE_LABEL: Record<string, string> = { client: "Mijoz", specialist: "Mutaxassis", admin: "Administrator" };

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

export function UsersPanel() {
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState<Filter>("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** Inline panel: bloklash sababi yoki izoh tahriri (bitta vaqtda bittasi) */
  const [panel, setPanel] = useState<{ id: string; kind: "ban" | "note" } | null>(null);
  /** Faollik tahlili pastki varag'i (bitta foydalanuvchi) */
  const [analyticsUser, setAnalyticsUser] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const load = useCallback(async (query: string, holat: string) => {
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (holat) p.set("holat", holat);
    const res = await fetch(`/api/admin/users?${p}`).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    if (json?.ok) {
      setRows(json.data.items);
      // matchTotal — filtr/qidiruvga mos jami son (global son emas)
      setTotal(json.data.matchTotal ?? json.data.total);
    } else setError("Ro'yxatni yuklab bo'lmadi — sahifani yangilang");
  }, []);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => load(q, flt), q ? 300 : 0);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [q, flt, load]);

  /** Umumiy PATCH: xato — inline + toast (foydalanuvchi sahifaning boshqa joyida bo'lsa ham ko'radi) */
  const patch = async <T,>(u: Row, body: Record<string, unknown>): Promise<T | null> => {
    setBusy(u.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
      if (!json) throw new Error("Server javob bermadi");
      if (!json.ok) throw new Error((json.fields && Object.values(json.fields)[0]) || json.error);
      return json.data;
    } catch (e) {
      const m = e instanceof Error && e.message ? e.message : "Amal bajarilmadi";
      setError(m);
      showToast(m, "error");
      return null;
    } finally {
      setBusy(null);
    }
  };

  /** Imtiyozli shaxs belgisi (faqat mutaxassis profili borlarga) — obunadan ozod qiladi */
  const setPrivileged = async (u: Row, isPrivileged: boolean) => {
    const data = await patch<{ isPrivileged: boolean }>(u, { isPrivileged });
    if (data) {
      setRows((r) => r?.map((x) => (x.id === u.id ? { ...x, isPrivileged } : x)) ?? r);
      showToast(isPrivileged ? `${u.name} — imtiyoz berildi` : `${u.name} — imtiyoz bekor qilindi`);
    }
  };

  /** Katalogda ko'rsatish/yashirish — profili yo'q bo'lsa server minimal profil yaratadi (keyin o'zi to'ldiradi) */
  const setListed = async (u: Row, listed: boolean) => {
    const data = await patch<{ slug?: string | null }>(u, { listed });
    if (data) setRows((r) => r?.map((x) => (x.id === u.id ? { ...x, listed, slug: data.slug ?? x.slug, isPrivileged: x.isPrivileged || (listed && !x.slug) } : x)) ?? r);
  };

  const setBan = async (u: Row, isBanned: boolean) => {
    if (isBanned && reason.trim().length < 3) {
      setError("Bloklash sababini yozing (kamida 3 belgi)");
      return;
    }
    const data = await patch<{ isBanned: boolean; bannedReason: string | null }>(u, { isBanned, reason: isBanned ? reason.trim() : "" });
    if (data) {
      setPanel(null);
      setReason("");
      setRows((r) => r?.map((x) => (x.id === u.id ? { ...x, isBanned: data.isBanned, bannedReason: data.bannedReason } : x)) ?? r);
      showToast(isBanned ? `${u.name} bloklandi` : `${u.name} blokdan chiqarildi`);
    }
  };

  const saveNote = async (u: Row) => {
    const data = await patch<{ adminNote: string | null; adminNoteAt: number | null }>(u, { adminNote: noteDraft.trim() });
    if (data) {
      setPanel(null);
      setRows((r) => r?.map((x) => (x.id === u.id ? { ...x, adminNote: data.adminNote, adminNoteAt: data.adminNoteAt } : x)) ?? r);
      showToast(data.adminNote ? "Izoh saqlandi" : "Izoh o'chirildi");
    }
  };

  const openPanel = (u: Row, kind: "ban" | "note") => {
    setError(null);
    if (panel?.id === u.id && panel.kind === kind) {
      setPanel(null);
      return;
    }
    setPanel({ id: u.id, kind });
    setReason("");
    setNoteDraft(u.adminNote ?? "");
  };

  const csvHref = `/api/admin/users?format=csv${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}${flt ? `&holat=${flt}` : ""}`;

  return (
    <div className="card overflow-visible">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-4" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, email, telefon yoki @taxallus" className="field !h-10 !min-h-0 w-full !rounded-full !py-0 pl-9 text-[13.5px]" aria-label="Foydalanuvchini qidirish" type="search" autoComplete="off" />
        </label>
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="segment flex w-max" role="radiogroup" aria-label="Holat filtri">
            {FILTERS.map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={flt === v} data-active={flt === v} onClick={() => setFlt(v)} className="segment-item inline-flex min-h-9 items-center whitespace-nowrap">
                {label}
              </button>
            ))}
          </div>
        </div>
        <a href={csvHref} download className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg" title="Joriy filtr bo'yicha CSV (5000 tagacha)">
          <Download size={14} /> CSV
        </a>
      </div>
      {total !== null && (
        <p className="border-b border-line px-4 py-2 text-[12px] text-fg-4" aria-live="polite">
          {q.trim() || flt ? `${total} ta topildi${q.trim() ? ` · «${q.trim()}»` : ""}${rows && total > rows.length ? ` · birinchi ${rows.length} tasi ko'rsatilgan` : ""}` : `Jami ${total} ta foydalanuvchi`}
        </p>
      )}
      {error && (
        <p className="border-b border-line bg-danger-soft px-4 py-2 text-[12.5px] font-medium text-danger-text" role="alert">
          {error}
        </p>
      )}

      {!rows ? (
        <ul aria-busy="true" aria-label="Yuklanmoqda">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-3 border-b border-line p-4 last:border-0">
              <span className="h-10 w-10 shrink-0 rounded-full skeleton" />
              <span className="flex-1 space-y-2">
                <span className="block h-3.5 w-1/3 skeleton" />
                <span className="block h-3 w-1/2 skeleton" />
              </span>
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="p-8 text-center text-[13.5px] text-fg-3">Hech kim topilmadi.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((u) => {
            const isBusy = busy === u.id;
            const canList = u.role !== "admin" && (u.role === "specialist" || u.slug);
            return (
              <li key={u.id} className={cn("p-4 transition-colors", isBusy && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={u.name} src={u.avatarUrl} size={38} decorative />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] font-semibold text-fg">
                      <span className="truncate">{u.name}</span>
                      {u.role === "admin" && <ShieldCheck size={14} className="text-accent" aria-label="Administrator" />}
                      {u.isPrivileged && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-bold text-info-text">
                          <Star size={10} /> Imtiyozli
                        </span>
                      )}
                      {u.isBanned && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-bold text-danger-text">Bloklangan</span>}
                    </p>
                    <p className="truncate text-[12.5px] text-fg-3">
                      {u.email}
                      {u.username && <span className="text-fg-4"> · @{u.username}</span>}
                      <span className="text-fg-4">
                        {" "}
                        · {ROLE_LABEL[u.role] ?? u.role} · {formatDate(new Date(u.createdAt))}
                        {u.lastLoginAt ? (
                          <>
                            {" "}
                            · kirgan{" "}
                            <time dateTime={new Date(u.lastLoginAt).toISOString()} title={formatDateTime(u.lastLoginAt)} suppressHydrationWarning>
                              {timeAgo(u.lastLoginAt)}
                            </time>
                          </>
                        ) : (
                          " · hali kirmagan"
                        )}
                      </span>
                    </p>
                    {u.isBanned && u.bannedReason && <p className="mt-0.5 truncate text-[12px] text-danger-text">Sabab: {u.bannedReason}</p>}
                    {u.adminNote && (
                      <button type="button" onClick={() => openPanel(u, "note")} className="mt-0.5 inline-flex max-w-full items-start gap-1 text-left text-[12px] text-fg-2 transition hover:text-fg" title={u.adminNoteAt ? `Izoh · ${formatDateTime(u.adminNoteAt)}` : "Izoh"}>
                        <StickyNote size={12} className="mt-0.5 shrink-0 text-warning-text" aria-hidden="true" />
                        <span className="line-clamp-1">{u.adminNote}</span>
                      </button>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {canList && (
                      <button
                        type="button"
                        onClick={() => setListed(u, !u.listed)}
                        disabled={isBusy}
                        aria-pressed={u.listed}
                        title={u.listed ? "Katalogdan yashirish (profil saqlanadi)" : u.slug ? "Katalogda ko'rsatish" : "Katalogga qo'shish — minimal profil yaratiladi (imtiyozli)"}
                        className={cn(
                          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition disabled:opacity-50",
                          u.listed ? "border-transparent bg-success-soft text-success-text" : "border-line-2 text-fg-2 hover:border-fg hover:text-fg",
                        )}
                      >
                        {isBusy ? <Loader2 size={13} className="animate-spin" /> : u.listed ? <Eye size={13} /> : <EyeOff size={13} />}
                        {u.listed ? "Katalogda" : u.slug ? "Ko'rsatish" : "Katalogga qo'shish"}
                      </button>
                    )}
                    {u.role !== "admin" &&
                      (u.isBanned ? (
                        <button type="button" onClick={() => setBan(u, false)} disabled={isBusy} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50">
                          {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Blokdan chiqarish
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openPanel(u, "ban")}
                          disabled={isBusy}
                          aria-expanded={panel?.id === u.id && panel.kind === "ban"}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-danger/40 px-3 text-[12.5px] font-semibold text-danger-text transition hover:bg-danger-soft disabled:opacity-50"
                        >
                          <Ban size={13} /> Bloklash
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={() => setAnalyticsUser({ id: u.id, name: u.name })}
                      title={`${u.name}: faollik analitikasi`}
                      aria-label={`${u.name}: faollik analitikasi`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg"
                    >
                      <BarChart3 size={13} /> Analitika
                    </button>
                    <AdminRowMenu
                      label={`${u.name}: boshqa amallar`}
                      disabled={isBusy}
                      items={[
                        ...(u.username ? [{ key: "dm", label: "Xabar yozish", icon: MessageCircle, href: `/yozish/${u.username}` }] : []),
                        ...(u.slug ? [{ key: "profile", label: "Ommaviy profil", icon: ExternalLink, href: `/mutaxassislar/${u.slug}` }] : []),
                        ...(u.slug ? [{ key: "priv", label: u.isPrivileged ? "Imtiyozni bekor qilish" : "Imtiyoz berish (obunasiz)", icon: Star, active: u.isPrivileged, onSelect: () => void setPrivileged(u, !u.isPrivileged) }] : []),
                        { key: "note", label: u.adminNote ? "Izohni tahrirlash" : "Izoh qo'shish", icon: StickyNote, divider: true, onSelect: () => openPanel(u, "note") },
                      ]}
                    />
                  </div>
                </div>

                {/* Bloklash sababi — tugma ostida ochiladi (modal yo'q) */}
                {panel?.id === u.id && panel.kind === "ban" && !u.isBanned && (
                  <div className="expand-in mt-3 flex flex-col gap-2 sm:flex-row" role="group" aria-label={`${u.name}: bloklash sababi`}>
                    <input
                      autoFocus
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={300}
                      placeholder="Bloklash sababi (foydalanuvchiga bildirishnomada ko'rinadi)"
                      aria-label="Bloklash sababi"
                      className="field !h-10 !min-h-0 flex-1 text-[13px]"
                      onKeyDown={(e) => e.key === "Enter" && setBan(u, true)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="danger" className="h-10" onClick={() => setBan(u, true)} disabled={isBusy || reason.trim().length < 3}>
                        {isBusy ? "Bloklanmoqda…" : "Bloklash"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-10" onClick={() => setPanel(null)} disabled={isBusy}>
                        Bekor
                      </Button>
                    </div>
                  </div>
                )}

                {/* Admin izohi — faqat admin ko'radi */}
                {panel?.id === u.id && panel.kind === "note" && (
                  <div className="expand-in mt-3 flex flex-col gap-2" role="group" aria-label={`${u.name}: admin izohi`}>
                    <label htmlFor={`note-${u.id}`} className="sr-only">
                      Admin izohi
                    </label>
                    <textarea id={`note-${u.id}`} autoFocus value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} maxLength={500} rows={2} placeholder="Faqat adminlar ko'radi: masalan, «telefon orqali tasdiqlangan», «shikoyatlar tekshirildi»" className="field w-full resize-y py-2 text-[13px] leading-relaxed" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={() => saveNote(u)} disabled={isBusy || (noteDraft.trim() === (u.adminNote ?? ""))}>
                        {isBusy ? <Loader2 size={13} className="animate-spin" /> : <StickyNote size={13} />} Saqlash
                      </Button>
                      {u.adminNote && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setNoteDraft("");
                            void (async () => {
                              const data = await patch<{ adminNote: string | null }>(u, { adminNote: "" });
                              if (data) {
                                setPanel(null);
                                setRows((r) => r?.map((x) => (x.id === u.id ? { ...x, adminNote: null, adminNoteAt: null } : x)) ?? r);
                                showToast("Izoh o'chirildi");
                              }
                            })();
                          }}
                          disabled={isBusy}
                        >
                          O&apos;chirish
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setPanel(null)} disabled={isBusy} className="ml-auto">
                        Bekor
                      </Button>
                      <span className="text-[11px] text-fg-4 tabular-nums">{noteDraft.length}/500</span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <UserAnalyticsSheet user={analyticsUser} onClose={() => setAnalyticsUser(null)} />
    </div>
  );
}
