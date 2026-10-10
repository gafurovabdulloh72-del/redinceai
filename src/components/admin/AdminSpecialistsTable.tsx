"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, BadgeCheck, CheckCircle2, ExternalLink, Mail, MapPin, Phone, Star, Trash2 } from "lucide-react";
import { Avatar, Button, EmptyState, Spinner } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Turlar                                                              */
/* ------------------------------------------------------------------ */
export interface PendingSpecialist {
  id: string;
  slug: string;
  title: string;
  category: string;
  regionSlug: string;
  city: string;
  isVerified: boolean;
  isFeatured: boolean;
  /** ms timestamp */
  createdAt: number;
  user: { name: string; email: string; phone: string | null };
}

type Busy = "verify" | "feature" | "delete";
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) throw new Error("Server javob bermadi");
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : "Kutilmagan xatolik");

/* ------------------------------------------------------------------ */
/* Komponent                                                           */
/* ------------------------------------------------------------------ */
export function AdminSpecialistsTable({ pending }: { pending: PendingSpecialist[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(pending);
  const [busy, setBusy] = useState<Record<string, Busy>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Server yangi ro'yxat bersa (router.refresh) — mahalliy holatni unga moslaymiz
  const [seen, setSeen] = useState(pending);
  if (seen !== pending) {
    setSeen(pending);
    setRows(pending);
  }

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const mark = (id: string, b: Busy | null) =>
    setBusy((prev) => {
      const next = { ...prev };
      if (b) next[id] = b;
      else delete next[id];
      return next;
    });

  /* ---------- Amallar (optimistik) ---------- */
  const verify = async (row: PendingSpecialist) => {
    setError(null);
    mark(row.id, "verify");
    const snapshot = rows;
    setRows((r) => r.filter((x) => x.id !== row.id));
    try {
      await call(`/api/admin/specialists/${row.id}`, { method: "PATCH", body: JSON.stringify({ isVerified: true }) });
      setNotice(`${row.user.name} tasdiqlandi`);
      router.refresh();
    } catch (e) {
      setRows(snapshot);
      setError(msg(e));
    } finally {
      mark(row.id, null);
    }
  };

  const toggleFeatured = async (row: PendingSpecialist) => {
    setError(null);
    const next = !row.isFeatured;
    mark(row.id, "feature");
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, isFeatured: next } : x)));
    try {
      await call(`/api/admin/specialists/${row.id}`, { method: "PATCH", body: JSON.stringify({ isFeatured: next }) });
      setNotice(next ? `${row.user.name} tavsiya etilganlarga qo'shildi` : `${row.user.name} tavsiyadan olib tashlandi`);
      router.refresh();
    } catch (e) {
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, isFeatured: !next } : x)));
      setError(msg(e));
    } finally {
      mark(row.id, null);
    }
  };

  const remove = async (row: PendingSpecialist) => {
    if (!window.confirm(`${row.user.name} profilini butunlay o'chirasizmi?\nPortfolio, sharhlar va buyurtmalar ham o'chib ketadi.`)) return;
    setError(null);
    mark(row.id, "delete");
    const snapshot = rows;
    setRows((r) => r.filter((x) => x.id !== row.id));
    try {
      await call(`/api/admin/specialists/${row.id}`, { method: "DELETE" });
      setNotice(`${row.user.name} o'chirildi`);
      router.refresh();
    } catch (e) {
      setRows(snapshot);
      setError(msg(e));
    } finally {
      mark(row.id, null);
    }
  };

  /* ---------- Amallar tugmalari (desktop va mobil uchun umumiy) ---------- */
  const Actions = ({ row, compact = false }: { row: PendingSpecialist; compact?: boolean }) => {
    const b = busy[row.id];
    return (
      <div className={cn("flex items-center gap-1.5", !compact && "justify-end")}>
        <Button size="sm" onClick={() => verify(row)} disabled={!!b} className={cn(compact && "flex-1")}>
          {b === "verify" ? <Spinner className="h-3.5 w-3.5" /> : <BadgeCheck size={14} />} Tasdiqlash
        </Button>
        <Button
          size="sm"
          variant={row.isFeatured ? "tint-soft" : "outline"}
          onClick={() => toggleFeatured(row)}
          disabled={!!b}
          aria-pressed={row.isFeatured}
          title={row.isFeatured ? "Tavsiyadan olib tashlash" : "Tavsiya etilganlarga qo'shish"}
        >
          {b === "feature" ? <Spinner className="h-3.5 w-3.5" /> : <Star size={14} className={cn(row.isFeatured && "fill-current")} />} Tavsiya
        </Button>
        <Link
          href={`/mutaxassislar/${row.slug}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Ommaviy profilni ochish"
          title="Ommaviy profil"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line-2 text-fg-2 transition hover:border-fg hover:text-fg"
        >
          <ExternalLink size={14} />
        </Link>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => remove(row)}
          disabled={!!b}
          className={cn("text-ios-red hover:!bg-ios-red/10 hover:!text-ios-red", compact && "h-9 w-9 !px-0")}
          aria-label={`${row.user.name} profilini o'chirish`}
          title="O'chirish"
        >
          {b === "delete" ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 size={14} />}
          <span className={cn(compact ? "sr-only" : "sr-only lg:not-sr-only")}>O'chirish</span>
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Xabarlar */}
      <div aria-live="polite" className="space-y-2 empty:hidden">
        {error && (
          <p className="flex items-center gap-2 rounded-[14px] bg-ios-red/10 px-4 py-2.5 text-[13px] font-medium text-ios-red">
            <AlertCircle size={15} /> {error}
          </p>
        )}
        {notice && (
          <p className="flex items-center gap-2 rounded-[14px] bg-ios-green/12 px-4 py-2.5 text-[13px] font-medium text-[#15803d] dark:text-ios-green animate-fade-up" style={{ animationDuration: "0.25s" }}>
            <CheckCircle2 size={15} /> {notice}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Navbat bo'sh" description="Barcha mutaxassislar tasdiqlangan. Yangi profil kelsa shu yerda ko'rinadi." />
      ) : (
        <>
          {/* ---------- Desktop: jadval ---------- */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">
                  <th className="px-5 py-3.5 font-bold">Mutaxassis</th>
                  <th className="px-3 py-3.5 font-bold">Yo'nalish</th>
                  <th className="px-3 py-3.5 font-bold">Hudud</th>
                  <th className="px-3 py-3.5 font-bold">Qo'shilgan</th>
                  <th className="px-5 py-3.5 text-right font-bold">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => {
                  const cat = CATEGORY_BY_SLUG[row.category];
                  const region = REGION_BY_SLUG[row.regionSlug];
                  return (
                    <tr key={row.id} className={cn("transition hover:bg-fg/3", busy[row.id] && "opacity-60")}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={row.user.name} size={40} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-semibold text-fg">
                              <span className="truncate">{row.user.name}</span>
                              {row.isFeatured && <Star size={13} className="shrink-0 fill-accent-3 text-accent-3" aria-label="Tavsiya etilgan" />}
                            </p>
                            <p className="truncate text-[12px] text-fg-3">{row.title}</p>
                            <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-fg-3">
                              <a href={`mailto:${row.user.email}`} className="inline-flex items-center gap-1 hover:text-fg">
                                <Mail size={11} /> {row.user.email}
                              </a>
                              {row.user.phone && (
                                <a href={`tel:${row.user.phone}`} className="inline-flex items-center gap-1 hover:text-fg">
                                  <Phone size={11} /> {row.user.phone}
                                </a>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        {cat ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-fg/6 px-2.5 py-1 text-[12px] font-semibold text-fg-2">
                            <CategoryIcon icon={cat.icon} size={12} style={{ color: cat.accent }} /> {cat.name}
                          </span>
                        ) : (
                          <span className="text-fg-4">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="whitespace-nowrap font-medium text-fg">{region?.short ?? row.regionSlug}</p>
                        <p className="text-[12px] text-fg-3">{row.city}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-[13px] text-fg-2" suppressHydrationWarning>{timeAgo(row.createdAt)}</td>
                      <td className="px-5 py-3.5">
                        <Actions row={row} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ---------- Mobil: kartalar ---------- */}
          <ul className="space-y-3 md:hidden">
            {rows.map((row) => {
              const cat = CATEGORY_BY_SLUG[row.category];
              const region = REGION_BY_SLUG[row.regionSlug];
              return (
                <li key={row.id} className={cn("card p-4", busy[row.id] && "opacity-60")}>
                  <div className="flex items-start gap-3">
                    <Avatar name={row.user.name} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[15px] font-semibold text-fg">
                        <span className="truncate">{row.user.name}</span>
                        {row.isFeatured && <Star size={13} className="shrink-0 fill-accent-3 text-accent-3" aria-label="Tavsiya etilgan" />}
                      </p>
                      <p className="truncate text-[13px] text-fg-2">{row.title}</p>
                      <p className="mt-0.5 text-[12px] text-fg-3" suppressHydrationWarning>{timeAgo(row.createdAt)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
                    {cat && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-fg/6 px-2.5 py-1 font-semibold text-fg-2">
                        <CategoryIcon icon={cat.icon} size={12} style={{ color: cat.accent }} /> {cat.name}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-fg/6 px-2.5 py-1 font-semibold text-fg-2">
                      <MapPin size={11} /> {region?.short ?? row.regionSlug} · {row.city}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-1 text-[13px] text-fg-2">
                    <a href={`mailto:${row.user.email}`} className="inline-flex items-center gap-1.5 truncate">
                      <Mail size={13} className="shrink-0 text-fg-3" /> {row.user.email}
                    </a>
                    {row.user.phone && (
                      <a href={`tel:${row.user.phone}`} className="inline-flex items-center gap-1.5">
                        <Phone size={13} className="shrink-0 text-fg-3" /> {row.user.phone}
                      </a>
                    )}
                  </div>

                  <div className="mt-4 border-t border-line pt-3">
                    <Actions row={row} compact />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
