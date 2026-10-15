"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Ban, Eye, EyeOff, Loader2, MessageCircle, Search, ShieldCheck, Star, Undo2 } from "lucide-react";
import { Avatar } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

/**
 * Admin: foydalanuvchilarni boshqarish — qidiruv (ism/email/@taxallus), holat filtri va
 * bloklash/blokdan chiqarish (mavjud PATCH /api/admin/users/[id] orqali; bloklashda sabab majburiy).
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
}

const ROLE_LABEL: Record<string, string> = { client: "Mijoz", specialist: "Mutaxassis", admin: "Administrator" };

export function UsersPanel() {
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState<"" | "banned" | "active" | "privileged" | "unlisted">("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** Bloklash sababi so'ralayotgan foydalanuvchi */
  const [arming, setArming] = useState<string | null>(null);
  const [reason, setReason] = useState("");
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
    }
  }, []);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => load(q, flt), q ? 300 : 0);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [q, flt, load]);

  /** Imtiyozli shaxs belgisi (faqat mutaxassis profili borlarga) — obunadan ozod qiladi */
  const setPrivileged = async (u: Row, isPrivileged: boolean) => {
    setBusy(u.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrivileged }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setRows((r) => r?.map((x) => (x.id === u.id ? { ...x, isPrivileged } : x)) ?? r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Amal bajarilmadi");
    } finally {
      setBusy(null);
    }
  };

  /** Katalogda ko'rsatish/yashirish — profili yo'q bo'lsa server minimal profil yaratadi (keyin o'zi to'ldiradi) */
  const setListed = async (u: Row, listed: boolean) => {
    setBusy(u.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listed }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setRows((r) => r?.map((x) => (x.id === u.id ? { ...x, listed, slug: json.data.slug ?? x.slug, isPrivileged: x.isPrivileged || (listed && !x.slug) } : x)) ?? r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Amal bajarilmadi");
    } finally {
      setBusy(null);
    }
  };

  const setBan = async (u: Row, isBanned: boolean) => {
    if (isBanned && !reason.trim()) {
      setError("Bloklash sababini yozing");
      return;
    }
    setBusy(u.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBanned, reason: isBanned ? reason.trim() : "" }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setArming(null);
      setReason("");
      setRows((r) => r?.map((x) => (x.id === u.id ? { ...x, isBanned, bannedReason: isBanned ? reason.trim() : null } : x)) ?? r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Amal bajarilmadi");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-4" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, email, telefon yoki @taxallus bo'yicha qidirish" className="field h-10 w-full rounded-full pl-9 text-[13.5px]" aria-label="Foydalanuvchini qidirish" />
        </label>
        <div className="segment flex w-full sm:w-auto" role="radiogroup" aria-label="Holat filtri">
          {([
            ["", "Barchasi"],
            ["active", "Faol"],
            ["banned", "Bloklangan"],
            ["privileged", "Imtiyozli"],
            ["unlisted", "Katalogda yo'q"],
          ] as const).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={flt === v} onClick={() => setFlt(v)} className={cn("segment-item flex-1 sm:flex-none", flt === v && "segment-item-active")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {total !== null && (
        <p className="border-b border-line px-4 py-2 text-[12px] text-fg-4">
          {q.trim() || flt ? `${total} ta topildi${q.trim() ? ` · qidiruv: «${q.trim()}»` : ""}${rows && total > rows.length ? ` · birinchi ${rows.length} tasi ko'rsatilgan` : ""}` : `Jami ${total} ta foydalanuvchi`}
        </p>
      )}
      {error && (
        <p className="border-b border-line bg-danger-soft px-4 py-2 text-[12.5px] font-medium text-danger-text" role="alert">
          {error}
        </p>
      )}

      {!rows ? (
        <ul>
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
          {rows.map((u) => (
            <li key={u.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={u.name} src={u.avatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-[14px] font-semibold text-fg">
                    <span className="truncate">{u.name}</span>
                    {u.role === "admin" && <ShieldCheck size={14} className="text-accent" aria-label="Administrator" />}
                    {u.isPrivileged && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-[10.5px] font-bold text-info-text">
                        <Star size={10} /> Imtiyozli
                      </span>
                    )}
                    {u.isBanned && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10.5px] font-bold text-danger-text">Bloklangan</span>}
                  </p>
                  <p className="truncate text-[12.5px] text-fg-3">
                    {u.email}
                    {u.username && <span className="text-fg-4"> · @{u.username}</span>}
                    <span className="text-fg-4"> · {ROLE_LABEL[u.role] ?? u.role} · {formatDate(new Date(u.createdAt))}</span>
                  </p>
                  {u.isBanned && u.bannedReason && <p className="mt-0.5 truncate text-[12px] text-danger-text">Sabab: {u.bannedReason}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {u.username && (
                    <Link
                      href={`/yozish/${u.username}`}
                      title="Foydalanuvchiga xabar yozish (ichki chat)"
                      aria-label={`${u.name}ga yozish`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg"
                    >
                      <MessageCircle size={13} /> Yozish
                    </Link>
                  )}
                  {u.slug && (
                    <Link href={`/mutaxassislar/${u.slug}`} className="hidden h-9 items-center rounded-full border border-line px-3 text-[12px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg sm:inline-flex">
                      Profil
                    </Link>
                  )}
                  {u.role === "specialist" && !u.slug && (
                    <span className="hidden h-9 items-center rounded-full bg-surface-3 px-3 text-[12px] font-medium text-fg-3 lg:inline-flex" title="Mutaxassis sifatida ro'yxatdan o'tgan, lekin kabinetda profilini hali to'ldirmagan">
                      Profil to'ldirilmagan
                    </span>
                  )}
                  {u.role !== "admin" && (u.role === "specialist" || u.slug) && (
                    <button
                      type="button"
                      onClick={() => setListed(u, !u.listed)}
                      disabled={busy === u.id}
                      title={
                        u.listed
                          ? "Katalogdan yashirish (ro'yxat va xaritada chiqmaydi, profil saqlanadi)"
                          : u.slug
                            ? "Katalogda ko'rsatish"
                            : "Katalogga qo'shish — minimal profil yaratiladi (imtiyozli), foydalanuvchi keyin to'ldiradi"
                      }
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold transition disabled:opacity-50",
                        u.listed ? "border-success/40 bg-success-soft text-success-text" : "border-line text-fg-2 hover:border-fg hover:text-fg",
                      )}
                    >
                      {busy === u.id ? <Loader2 size={13} className="animate-spin" /> : u.listed ? <Eye size={13} /> : <EyeOff size={13} />}
                      {u.listed ? "Katalogda ✓" : u.slug ? "Ko'rsatish" : "Katalogga qo'shish"}
                    </button>
                  )}
                  {u.slug && (
                    <button
                      type="button"
                      onClick={() => setPrivileged(u, !u.isPrivileged)}
                      disabled={busy === u.id}
                      title={u.isPrivileged ? "Imtiyozni bekor qilish (obuna yana talab qilinadi)" : "Imtiyozli shaxs deb belgilash (obuna talab qilinmaydi)"}
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold transition disabled:opacity-50",
                        u.isPrivileged ? "border-info/40 bg-info-soft text-info-text" : "border-line text-fg-2 hover:border-fg hover:text-fg",
                      )}
                    >
                      <Star size={13} /> {u.isPrivileged ? "Imtiyozli ✓" : "Imtiyoz berish"}
                    </button>
                  )}
                  {u.role !== "admin" &&
                    (u.isBanned ? (
                      <button
                        type="button"
                        onClick={() => setBan(u, false)}
                        disabled={busy === u.id}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50"
                      >
                        {busy === u.id ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Blokdan chiqarish
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setArming(arming === u.id ? null : u.id);
                          setReason("");
                          setError(null);
                        }}
                        disabled={busy === u.id}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-danger/40 px-3.5 text-[12.5px] font-semibold text-danger-text transition hover:bg-danger-soft disabled:opacity-50"
                      >
                        <Ban size={13} /> Bloklash
                      </button>
                    ))}
                </div>
              </div>
              {/* Bloklash sababi — tugma ostida ochiladi (modal yo'q) */}
              {arming === u.id && !u.isBanned && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={300}
                    placeholder="Bloklash sababi (foydalanuvchiga bildirishnomada ko'rinadi)"
                    className="field h-10 flex-1 text-[13px]"
                    onKeyDown={(e) => e.key === "Enter" && setBan(u, true)}
                  />
                  <button type="button" onClick={() => setBan(u, true)} disabled={busy === u.id} className="inline-flex h-10 items-center justify-center rounded-full bg-danger px-4 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                    {busy === u.id ? "Bloklanmoqda…" : "Tasdiqlash"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
