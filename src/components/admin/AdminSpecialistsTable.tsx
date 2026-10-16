"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, BadgeCheck, CheckCircle2, ExternalLink, EyeOff, Hourglass, Images, Mail, MapPin, Phone, ShieldBan, ShieldCheck, Star, Trash2, X, XCircle } from "lucide-react";
import { Avatar, Button, EmptyState, Spinner } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { cn, formatUzPhone, normalizeUzPhone, timeAgo } from "@/lib/utils";

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
  user: { name: string; email: string; phone: string | null; avatarUrl?: string | null };
  /** Egasining users.id — bloklash uchun (berilmasa tugma chiqmaydi) */
  userId?: string | null;
  isBanned?: boolean;
  bannedReason?: string | null;
  /** Bio parchasi (bir qatorda ko'rsatiladi) */
  bio?: string | null;
  /** Portfolio ishlari soni */
  portfolioCount?: number;
  /** Admin katalogdan yashirgan (rad etilgan) */
  isHidden?: boolean;
}

/** So'nggi tasdiqlanganlar qatori — tasdiqni olib tashlash uchun */
export interface VerifiedSpecialist {
  id: string;
  slug: string;
  title: string;
  category: string;
  regionSlug: string;
  isFeatured: boolean;
  /** ms timestamp — oxirgi o'zgarish (tasdiq vaqtiga eng yaqin belgi) */
  verifiedAt: number;
  user: { name: string; avatarUrl?: string | null };
}

type Busy = "verify" | "feature" | "delete" | "ban" | "reject" | "unverify";
/** Shuncha kundan ko'p kutgan profil ogohlantirish rangida ko'rinadi */
const WAIT_WARN_MS = 7 * 24 * 60 * 60 * 1000;

/** "Kutmoqda · 12 kun oldin" belgisi — 7 kundan oshsa warning tonida */
function WaitBadge({ createdAt, className }: { createdAt: number; className?: string }) {
  const late = Date.now() - createdAt > WAIT_WARN_MS;
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", late ? "bg-warning-soft text-warning-text" : "bg-fg/6 text-fg-2", className)}
      title={late ? "7 kundan ortiq navbatda kutmoqda" : "Tasdiqlashni kutmoqda"}
    >
      <Hourglass size={10} /> Kutmoqda ·{" "}
      <time dateTime={new Date(createdAt).toISOString()} suppressHydrationWarning>
        {timeAgo(createdAt)}
      </time>
    </span>
  );
}
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) throw new Error("Server javob bermadi");
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : "Kutilmagan xatolik");
/** Mobil kartalar: dastlab shuncha, qolgani «Yana ko'rsatish» bilan */
const MOBILE_CAP = 10;

/* ------------------------------------------------------------------ */
/* Komponent                                                           */
/* ------------------------------------------------------------------ */
export function AdminSpecialistsTable({ pending, verified = [] }: { pending: PendingSpecialist[]; verified?: VerifiedSpecialist[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(pending);
  const [vRows, setVRows] = useState(verified);
  /** "Tasdiqni olib tashlash" — bitta bosishda emas: avval shu qator tasdiq so'raydi */
  const [confirmUnverify, setConfirmUnverify] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, Busy>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Inline o'chirish tasdig'i (window.confirm o'rniga) */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  /** Inline bloklash formasi (sabab bilan) */
  const [banAsk, setBanAsk] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  /** Inline rad etish formasi (sabab bilan) */
  const [rejectAsk, setRejectAsk] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Server yangi ro'yxat bersa (router.refresh) — mahalliy holatni unga moslaymiz
  const [seen, setSeen] = useState(pending);
  if (seen !== pending) {
    setSeen(pending);
    setRows(pending);
    setVRows(verified);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setNotice(`${row.user.name} tasdiqlandi — kerak bo'lsa pastdagi ro'yxatdan qaytarib olsa bo'ladi`);
      // Darhol "So'nggi tasdiqlanganlar"ga qo'shiladi — adashib bosilgan bo'lsa shu yerdan qaytariladi
      setVRows((v) => [
        { id: row.id, slug: row.slug, title: row.title, category: row.category, regionSlug: row.regionSlug, isFeatured: row.isFeatured, verifiedAt: Date.now(), user: { name: row.user.name, avatarUrl: row.user.avatarUrl } },
        ...v.filter((x) => x.id !== row.id),
      ]);
      router.refresh();
    } catch (e) {
      setRows(snapshot);
      setError(msg(e));
    } finally {
      mark(row.id, null);
    }
  };

  /** Tasdiqni olib tashlash: profil belgini yo'qotadi va yana tasdiqlash navbatiga qaytadi */
  const unverify = async (row: VerifiedSpecialist) => {
    setError(null);
    setConfirmUnverify(null);
    mark(row.id, "unverify");
    const snapshot = vRows;
    setVRows((v) => v.filter((x) => x.id !== row.id));
    try {
      await call(`/api/admin/specialists/${row.id}`, { method: "PATCH", body: JSON.stringify({ isVerified: false }) });
      setNotice(`${row.user.name} tasdig'i olib tashlandi — profil yana navbatga qaytdi`);
      router.refresh();
    } catch (e) {
      setVRows(snapshot);
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
    setConfirmDelete(null);
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

  /** Rad etish: profil o'chmaydi — katalogdan yashiriladi, egasiga sabab bilan bildirishnoma boradi */
  const reject = async (row: PendingSpecialist, reason: string) => {
    setError(null);
    setRejectAsk(null);
    mark(row.id, "reject");
    try {
      await call(`/api/admin/specialists/${row.id}`, { method: "PATCH", body: JSON.stringify({ action: "reject", reason: reason.trim() }) });
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, isHidden: true } : x)));
      setNotice(`${row.user.name} profili rad etildi — katalogdan yashirildi, sabab egasiga yuborildi`);
      setRejectReason("");
      router.refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      mark(row.id, null);
    }
  };

  const toggleBan = async (row: PendingSpecialist, reason?: string) => {
    if (!row.userId) return;
    const next = !row.isBanned;
    setError(null);
    setBanAsk(null);
    mark(row.id, "ban");
    try {
      const data = await call<{ isBanned: boolean; bannedReason: string | null }>(`/api/admin/users/${row.userId}`, { method: "PATCH", body: JSON.stringify({ isBanned: next, reason: reason?.trim() || undefined }) });
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, isBanned: data.isBanned, bannedReason: data.bannedReason } : x)));
      setNotice(next ? `${row.user.name} bloklandi — sessiyalari bekor qilindi, profili ro'yxatdan yashirildi` : `${row.user.name} blokdan chiqarildi`);
      setBanReason("");
      router.refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      mark(row.id, null);
    }
  };

  /* ---------- Amallar: desktopda ixcham (ikonka tugmalar), mobilda 44px ---------- */
  const Actions = ({ row, compact = false }: { row: PendingSpecialist; compact?: boolean }) => {
    const b = busy[row.id];
    const iconBtn = cn("inline-flex shrink-0 items-center justify-center rounded-full border border-line-2 text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50", compact ? "h-11 w-11" : "h-9 w-9");

    if (confirmDelete === row.id) {
      return (
        <div className={cn("card-outline flex flex-col gap-2 whitespace-normal !rounded-[14px] p-2.5 text-left animate-fade-up", compact ? "sm:flex-row sm:items-center" : "ml-auto w-[19rem]")} style={{ animationDuration: "0.2s" }}>
          <p className="flex items-start gap-1.5 text-[12px] font-medium text-fg">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-danger" /> Butunlay o'chirilsinmi? Portfolio, sharhlar va buyurtmalar ham o'chadi. Eskrou/o'tkazilgan to'lovlari yoki ochiq payout so'rovi bo'lsa — o'chirish rad etiladi.
          </p>
          <div className="flex shrink-0 gap-1.5">
            <Button size={compact ? "md" : "sm"} variant="danger" onClick={() => remove(row)} disabled={!!b}>
              {b === "delete" ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 size={14} />} Ha, o'chirish
            </Button>
            <Button size={compact ? "md" : "sm"} variant="ghost" onClick={() => setConfirmDelete(null)} disabled={!!b}>
              Yo'q
            </Button>
          </div>
        </div>
      );
    }

    if (rejectAsk === row.id) {
      return (
        <div className={cn("card-outline flex flex-col gap-2 whitespace-normal !rounded-[14px] p-2.5 text-left animate-fade-up", !compact && "ml-auto w-[19rem]")} style={{ animationDuration: "0.2s" }}>
          <p className="flex items-start gap-1.5 text-[12px] font-medium text-fg">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-warning" /> Rad etilsinmi? Profil o'chmaydi — katalogdan yashiriladi, egasi sababni bildirishnomada ko'radi va tuzatib qayta murojaat qila oladi.
          </p>
          <label htmlFor={`reject-${row.id}`} className="sr-only">
            Rad etish sababi
          </label>
          <input id={`reject-${row.id}`} className="field !min-h-10 !py-1.5 text-[13px]" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={300} placeholder="Sabab (kamida 5 belgi): masalan, portfolio bo'sh" autoFocus />
          <div className="flex shrink-0 gap-1.5">
            <Button size={compact ? "md" : "sm"} variant="danger" onClick={() => reject(row, rejectReason)} disabled={!!b || rejectReason.trim().length < 5}>
              {b === "reject" ? <Spinner className="h-3.5 w-3.5" /> : <XCircle size={14} />} Rad etish
            </Button>
            <Button size={compact ? "md" : "sm"} variant="ghost" onClick={() => setRejectAsk(null)} disabled={!!b}>
              Bekor
            </Button>
          </div>
        </div>
      );
    }

    if (banAsk === row.id) {
      return (
        <div className={cn("card-outline flex flex-col gap-2 whitespace-normal !rounded-[14px] p-2.5 text-left animate-fade-up", !compact && "ml-auto w-[19rem]")} style={{ animationDuration: "0.2s" }}>
          <p className="flex items-start gap-1.5 text-[12px] font-medium text-fg">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-danger" /> Bloklansinmi? Foydalanuvchi tizimga kira olmaydi, profili ro'yxat va xaritadan yashiriladi. Sabab unga bildirishnomada ko'rinadi.
          </p>
          <label htmlFor={`ban-${row.id}`} className="sr-only">
            Bloklash sababi
          </label>
          <input id={`ban-${row.id}`} className="field !min-h-10 !py-1.5 text-[13px]" value={banReason} onChange={(e) => setBanReason(e.target.value)} maxLength={300} placeholder="Sabab: masalan, soxta portfolio, spam" autoFocus />
          <div className="flex shrink-0 gap-1.5">
            <Button size={compact ? "md" : "sm"} variant="danger" onClick={() => toggleBan(row, banReason)} disabled={!!b || banReason.trim().length < 3}>
              {b === "ban" ? <Spinner className="h-3.5 w-3.5" /> : <ShieldBan size={14} />} Bloklash
            </Button>
            <Button size={compact ? "md" : "sm"} variant="ghost" onClick={() => setBanAsk(null)} disabled={!!b}>
              Bekor
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("flex items-center gap-1.5", !compact && "justify-end")}>
        <Button size={compact ? "md" : "sm"} onClick={() => verify(row)} disabled={!!b} className={cn(compact && "flex-1")}>
          {b === "verify" ? <Spinner className="h-3.5 w-3.5" /> : <BadgeCheck size={14} />} Tasdiqlash
        </Button>
        {!row.isHidden && (
          <Button
            size={compact ? "md" : "sm"}
            variant="outline"
            onClick={() => {
              setRejectAsk(row.id);
              setRejectReason("");
              setBanAsk(null);
              setConfirmDelete(null);
            }}
            disabled={!!b}
            title="Katalogga qo'shmaslik — sabab egasiga yuboriladi"
          >
            {b === "reject" ? <Spinner className="h-3.5 w-3.5" /> : <XCircle size={14} />} Rad etish
          </Button>
        )}
        {row.userId && (
          <button
            type="button"
            onClick={() => {
              if (row.isBanned) void toggleBan(row);
              else {
                setBanAsk(row.id);
                setBanReason("");
                setConfirmDelete(null);
              }
            }}
            disabled={!!b}
            aria-pressed={Boolean(row.isBanned)}
            aria-label={row.isBanned ? "Blokdan chiqarish" : "Bloklash"}
            title={row.isBanned ? `Bloklangan${row.bannedReason ? `: ${row.bannedReason}` : ""} — blokdan chiqarish` : "Bloklash"}
            className={cn(iconBtn, row.isBanned ? "border-danger/50 bg-danger-soft text-danger-text hover:text-danger-text" : "hover:border-danger hover:text-danger-text")}
          >
            {b === "ban" ? <Spinner className="h-3.5 w-3.5" /> : row.isBanned ? <ShieldCheck size={15} /> : <ShieldBan size={15} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => toggleFeatured(row)}
          disabled={!!b}
          aria-pressed={row.isFeatured}
          aria-label={row.isFeatured ? "Tavsiyadan olib tashlash" : "Tavsiya etilganlarga qo'shish"}
          title={row.isFeatured ? "Tavsiyadan olib tashlash" : "Tavsiya etilganlarga qo'shish"}
          className={cn(iconBtn, row.isFeatured && "border-accent-3/50 bg-accent-3/15 text-accent-3 hover:text-accent-3")}
        >
          {b === "feature" ? <Spinner className="h-3.5 w-3.5" /> : <Star size={15} className={cn(row.isFeatured && "fill-current")} />}
        </button>
        <Link href={`/mutaxassislar/${row.slug}`} target="_blank" rel="noreferrer" aria-label="Ommaviy profilni ochish" title="Ommaviy profil" className={iconBtn}>
          <ExternalLink size={15} />
        </Link>
        <button
          type="button"
          onClick={() => setConfirmDelete(row.id)}
          disabled={!!b}
          aria-label={`${row.user.name} profilini o'chirish`}
          title="O'chirish"
          className={cn(iconBtn, "text-danger-text hover:border-danger hover:bg-danger-soft hover:text-danger-text")}
        >
          {b === "delete" ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 size={15} />}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Xabarlar */}
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
        <EmptyState icon={CheckCircle2} title="Navbat bo'sh" description="Barcha mutaxassislar tasdiqlangan. Yangi profil kelsa shu yerda ko'rinadi." />
      ) : (
        <>
          {/* ---------- Desktop: jadval. Konteyner tor bo'lsa (masalan, o'ng navigatsiya bilan) yo'nalish/hudud/vaqt
               ustunlari ism ostidagi bitta qatorga yig'iladi — amallar ustuni hech qachon kesilmaydi ---------- */}
          <div className="@container card hidden overflow-hidden md:block">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">
                  <th className="px-5 py-3 font-bold">Mutaxassis</th>
                  <th className="hidden px-3 py-3 font-bold @[66rem]:table-cell">Yo'nalish</th>
                  <th className="hidden px-3 py-3 font-bold @[66rem]:table-cell">Hudud</th>
                  <th className="hidden px-3 py-3 font-bold @[66rem]:table-cell">Kutmoqda</th>
                  <th className="w-px px-5 py-3 text-right font-bold">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => {
                  const cat = CATEGORY_BY_SLUG[row.category];
                  const region = REGION_BY_SLUG[row.regionSlug];
                  return (
                    <tr key={row.id} className={cn("transition hover:bg-fg/3", busy[row.id] && "opacity-60")}>
                      <td className="w-full max-w-0 px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={row.user.name} src={row.user.avatarUrl ?? undefined} size={36} decorative />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-semibold text-fg">
                              <span className="truncate">{row.user.name}</span>
                              {row.isFeatured && <Star size={12} className="shrink-0 fill-accent-3 text-accent-3" aria-label="Tavsiya etilgan" />}
                              {row.isBanned && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger-text" title={row.bannedReason ?? undefined}>
                                  <ShieldBan size={10} /> Bloklangan
                                </span>
                              )}
                              {row.isHidden && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-fg/8 px-1.5 py-0.5 text-[10px] font-bold text-fg-2" title="Rad etilgan — katalogda ko'rinmaydi">
                                  <EyeOff size={10} /> Yashirilgan
                                </span>
                              )}
                            </p>
                            <p className="truncate text-[12px] text-fg-3">{row.title}</p>
                            {row.bio?.trim() ? <p className="truncate text-[12px] text-fg-4">{row.bio}</p> : null}
                            <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-fg-3 @[66rem]:hidden">
                              {cat && (
                                <span className="inline-flex items-center gap-1 font-semibold text-fg-2">
                                  <CategoryIcon icon={cat.icon} size={11} className="text-fg-3" /> {cat.name}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={11} /> {region?.short ?? row.regionSlug}
                                {row.city ? ` · ${row.city}` : ""}
                              </span>
                              <WaitBadge createdAt={row.createdAt} />
                            </p>
                            <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-fg-4">
                              <a href={`mailto:${row.user.email}`} className="inline-flex min-w-0 items-center gap-1 truncate hover:text-fg">
                                <Mail size={11} /> {row.user.email}
                              </a>
                              {row.user.phone && (
                                <a href={`tel:${normalizeUzPhone(row.user.phone) ?? row.user.phone}`} className="inline-flex items-center gap-1 hover:text-fg">
                                  <Phone size={11} /> {formatUzPhone(row.user.phone)}
                                </a>
                              )}
                              {typeof row.portfolioCount === "number" && (
                                <span className="inline-flex items-center gap-1" title="Portfolio ishlari soni">
                                  <Images size={11} /> {row.portfolioCount} ta ish
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-3 py-2.5 @[66rem]:table-cell">
                        {cat ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-fg/6 px-2.5 py-1 text-[12px] font-semibold text-fg-2">
                            <CategoryIcon icon={cat.icon} size={12} className="text-fg-3" /> {cat.name}
                          </span>
                        ) : (
                          <span className="text-fg-4">—</span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2.5 @[66rem]:table-cell">
                        <p className="whitespace-nowrap font-medium text-fg">{region?.short ?? row.regionSlug}</p>
                        <p className="text-[12px] text-fg-3">{row.city}</p>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-[12px] text-fg-2 @[66rem]:table-cell">
                        <WaitBadge createdAt={row.createdAt} />
                      </td>
                      <td className="w-px whitespace-nowrap px-5 py-2.5">
                        <Actions row={row} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ---------- Mobil: kartalar (ustun nomlari saqlanadi) ---------- */}
          <ul className="space-y-3 md:hidden">
            {rows.map((row, i) => {
              const cat = CATEGORY_BY_SLUG[row.category];
              const region = REGION_BY_SLUG[row.regionSlug];
              return (
                <li key={row.id} className={cn("card p-4", busy[row.id] && "opacity-60", i >= MOBILE_CAP && !showAll && "hidden")}>
                  <div className="flex items-start gap-3">
                    <Avatar name={row.user.name} src={row.user.avatarUrl ?? undefined} size={44} decorative />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[15px] font-semibold text-fg">
                        <span className="truncate">{row.user.name}</span>
                        {row.isFeatured && <Star size={13} className="shrink-0 fill-accent-3 text-accent-3" aria-label="Tavsiya etilgan" />}
                        {row.isBanned && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger-text">
                            <ShieldBan size={10} /> Bloklangan
                          </span>
                        )}
                        {row.isHidden && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-fg/8 px-1.5 py-0.5 text-[10px] font-bold text-fg-2" title="Rad etilgan — katalogda ko'rinmaydi">
                            <EyeOff size={10} /> Yashirilgan
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[13px] text-fg-2">{row.title}</p>
                      {row.bio?.trim() ? <p className="truncate text-[12px] text-fg-4">{row.bio}</p> : null}
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-fg-3">
                        <WaitBadge createdAt={row.createdAt} />
                        {typeof row.portfolioCount === "number" && (
                          <span className="inline-flex items-center gap-1" title="Portfolio ishlari soni">
                            <Images size={12} /> {row.portfolioCount} ta ish
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                    <div>
                      <dt className="text-fg-4">Yo'nalish</dt>
                      <dd className="inline-flex items-center gap-1.5 font-semibold text-fg-2">{cat ? <>
                            <CategoryIcon icon={cat.icon} size={12} className="text-fg-3" /> {cat.name}
                          </> : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-fg-4">Hudud</dt>
                      <dd className="inline-flex items-center gap-1 font-semibold text-fg-2">
                        <MapPin size={11} /> {region?.short ?? row.regionSlug} · {row.city}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-fg-4">Aloqa</dt>
                      <dd className="flex flex-col gap-0.5 text-[13px] text-fg-2">
                        <a href={`mailto:${row.user.email}`} className="inline-flex min-h-7 items-center gap-1.5 truncate">
                          <Mail size={13} className="shrink-0 text-fg-3" /> {row.user.email}
                        </a>
                        {row.user.phone && (
                          <a href={`tel:${normalizeUzPhone(row.user.phone) ?? row.user.phone}`} className="inline-flex min-h-7 items-center gap-1.5">
                            <Phone size={13} className="shrink-0 text-fg-3" /> {formatUzPhone(row.user.phone)}
                          </a>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 border-t border-line pt-3">
                    <Actions row={row} compact />
                  </div>
                </li>
              );
            })}
          </ul>
          {rows.length > MOBILE_CAP && !showAll && (
            <Button variant="outline" size="md" className="w-full md:hidden" onClick={() => setShowAll(true)}>
              Yana {rows.length - MOBILE_CAP} ta ko'rsatish
            </Button>
          )}
        </>
      )}
      {rows.length > 0 && (
        <p className="px-1 text-[12px] text-fg-4">
          <X size={11} className="mr-1 inline" /> O'chirish qaytarib bo'lmaydi — avval ommaviy profilni ko'rib chiqing.
        </p>
      )}

      {/* ---------- So'nggi tasdiqlanganlar: tasdiqni qaytarib olish mumkin ---------- */}
      {vRows.length > 0 && (
        <section className="card overflow-hidden" aria-label="So'nggi tasdiqlanganlar">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
            <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">
              <BadgeCheck size={13} className="text-success" /> So'nggi tasdiqlanganlar
            </p>
            <p className="text-[12px] text-fg-4">Adashib tasdiqlangan bo'lsa — shu yerdan qaytarib olinadi</p>
          </header>
          <ul className="divide-y divide-line">
            {vRows.slice(0, 10).map((row) => {
              const b = busy[row.id];
              const cat = CATEGORY_BY_SLUG[row.category];
              const region = REGION_BY_SLUG[row.regionSlug];
              const asking = confirmUnverify === row.id;
              return (
                <li key={row.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-5", b && "opacity-60")}>
                  <Avatar name={row.user.name} src={row.user.avatarUrl} size={34} decorative />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-fg">
                      <span className="truncate">{row.user.name}</span>
                      <BadgeCheck size={13} className="shrink-0 text-success" aria-label="Tasdiqlangan" />
                      {row.isFeatured && <Star size={12} className="shrink-0 fill-accent-3 text-accent-3" aria-label="Tavsiya etilgan" />}
                    </p>
                    <p className="truncate text-[12px] text-fg-3">
                      {row.title}
                      {cat ? ` · ${cat.name}` : ""}
                      {region ? ` · ${region.short}` : ""}
                    </p>
                  </div>
                  <time className="hidden whitespace-nowrap text-[11.5px] text-fg-4 md:block" dateTime={new Date(row.verifiedAt).toISOString()} suppressHydrationWarning>
                    {timeAgo(row.verifiedAt)}
                  </time>
                  {asking ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="hidden text-[12px] font-medium text-fg-2 sm:inline">Belgi olinadi, profil navbatga qaytadi.</span>
                      <Button size="sm" variant="danger" onClick={() => unverify(row)} disabled={!!b}>
                        {b === "unverify" ? <Spinner className="h-3.5 w-3.5" /> : <XCircle size={14} />} Ha, olib tashlash
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmUnverify(null)} disabled={!!b}>
                        Bekor
                      </Button>
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1.5">
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
                      <Button size="sm" variant="outline" onClick={() => setConfirmUnverify(row.id)} disabled={!!b}>
                        <XCircle size={14} /> Tasdiqni olib tashlash
                      </Button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {vRows.length > 10 && <p className="border-t border-line px-4 py-2.5 text-[12px] text-fg-4 sm:px-5">Oxirgi 10 tasi ko'rsatilgan</p>}
        </section>
      )}
    </div>
  );
}
