"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, ArrowRight, Award, CalendarClock, Check, ChevronDown, Inbox, Lock, MapPin, Phone, Star, X } from "lucide-react";
import { Avatar, Badge, ButtonLink, Spinner, Stars, VerifiedBadge } from "@/components/ui";
import { CATEGORY_BY_SLUG, PROPOSAL_STATUS_LABEL, REGION_BY_SLUG } from "@/lib/constants";
import { PROPOSAL_STATUS_TONE } from "@/lib/jobs/format";
import type { OwnerProposal } from "@/lib/jobs/queries";
import { cn, formatPrice, timeAgo } from "@/lib/utils";
import { patchProposal, type ProposalActionName } from "./proposal-actions";

type Tab = "all" | "shortlisted" | "declined";

/**
 * E'lon egasi: takliflar ro'yxati — saralash, rad etish, qabul qilish (buyurtma yaratiladi → /kabinet/buyurtmalar?id=).
 * Mutaxassis ma'lumoti serverda toListItem() bilan maskalangan; canHire — obuna faolmi (sanalar chiqmaydi).
 */
export function OwnerProposals({ proposals, jobOpen, defaultPhone }: { proposals: OwnerProposal[]; jobOpen: boolean; defaultPhone: string }) {
  const [tab, setTab] = useState<Tab>("all");
  const counts = {
    all: proposals.length,
    shortlisted: proposals.filter((p) => p.status === "shortlisted").length,
    declined: proposals.filter((p) => p.status === "declined").length,
  };
  const list = proposals.filter((p) => (tab === "all" ? p.status !== "declined" : p.status === tab));
  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "Faol" },
    { key: "shortlisted", label: "Saralangan" },
    { key: "declined", label: "Rad etilgan" },
  ];

  return (
    <section id="takliflar" aria-labelledby="owner-proposals-title" className="scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="owner-proposals-title" className="font-display text-[22px] font-semibold text-fg">
            Takliflar <span className="tabular-nums text-fg-3">{proposals.length}</span>
          </h2>
          <p className="mt-0.5 text-[13.5px] text-fg-3">Solishtiring, mosini saralang va qabul qiling — buyurtma avtomatik yaratiladi.</p>
        </div>
        {proposals.length > 0 && (
          <div className="segment max-w-full overflow-x-auto no-scrollbar" role="tablist" aria-label="Takliflar filtri">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-active={tab === t.key} onClick={() => setTab(t.key)} className="segment-item min-h-10">
                {t.label} <span className="tabular-nums opacity-70">{t.key === "all" ? counts.all - counts.declined : counts[t.key]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <div className="card-outline mt-4 flex flex-col items-center px-6 py-10 text-center">
          <span className="icon-tile-soft icon-tile-lg mb-3" aria-hidden="true">
            <Inbox size={22} />
          </span>
          <p className="font-display text-[16px] font-semibold text-fg">{proposals.length === 0 ? "Hali taklif yo'q" : "Bu bo'limda taklif yo'q"}</p>
          <p className="mt-1 max-w-sm text-[13.5px] text-fg-3">
            {proposals.length === 0 ? "Mutaxassislar taklif yuborishi bilan shu yerda ko'rinadi va bildirishnoma keladi." : "Boshqa bo'limni tanlang."}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((p) => (
            <li key={p.id}>
              <ProposalItem p={p} jobOpen={jobOpen} defaultPhone={defaultPhone} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProposalItem({ p, jobOpen, defaultPhone }: { p: OwnerProposal; jobOpen: boolean; defaultPhone: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<ProposalActionName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [phone, setPhone] = useState(defaultPhone);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const sp = p.specialist;
  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];
  const actionable = jobOpen && (p.status === "pending" || p.status === "shortlisted");
  const long = p.coverLetter.length > 220 || p.coverLetter.split("\n").length > 3;

  const run = async (action: ProposalActionName) => {
    setBusy(action);
    setError(null);
    setPhoneErr(null);
    const r = await patchProposal(p.id, action, action === "accept" ? { contactPhone: phone.trim() } : {});
    setBusy(null);
    if (!r.ok) {
      if (r.fields?.contactPhone) setPhoneErr(r.fields.contactPhone);
      setError(r.error);
      return;
    }
    if (action === "accept" && r.href) {
      router.push(r.href);
      return;
    }
    router.refresh();
  };

  return (
    <article className={cn("card p-4 sm:p-5", p.status === "declined" && "opacity-75", p.status === "accepted" && "ring-2 ring-success/40")}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link href={`/mutaxassislar/${sp.slug}`} className="shrink-0 rounded-full" aria-label={`${sp.user.name} — profil`}>
            <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={48} decorative />
          </Link>
          <div className="min-w-0">
            <Link href={`/mutaxassislar/${sp.slug}`} className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-fg hover:underline">
              <span className="truncate">{sp.user.name}</span>
              {sp.isVerified && <VerifiedBadge size={15} />}
              {sp.topRated && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-line px-1.5 py-0.5 text-[11px] font-semibold text-fg">
                  <Award size={10} className="text-accent" aria-hidden="true" /> Top
                </span>
              )}
            </Link>
            <p className="truncate text-[13px] text-fg-3">{sp.title}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-fg-3">
              {sp.reviewCount > 0 ? (
                <Stars value={sp.rating} count={sp.reviewCount} size={11} />
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Star size={11} aria-hidden="true" /> Hali sharh yo'q
                </span>
              )}
              <span>{sp.completedCount > 0 ? `${sp.completedCount} ta ish bajarilgan` : "Yangi mutaxassis"}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} aria-hidden="true" />
                {sp.city}
                {region && region.slug !== "toshkent-shahri" && region.short !== sp.city ? ` · ${region.short}` : ""}
              </span>
              {cat && <span className="max-sm:hidden">{cat.name}</span>}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1.5">
          <p className="font-display text-[19px] font-semibold tabular-nums text-fg">{formatPrice(p.amount)}</p>
          <p className="inline-flex items-center gap-1 text-[12.5px] font-medium text-fg-2">
            <CalendarClock size={13} className="text-fg-3" aria-hidden="true" /> {p.deliveryDays} kunda
          </p>
        </div>
      </div>

      <div className="mt-3">
        <p className={cn("whitespace-pre-line text-[14px] leading-relaxed text-fg-2", !expanded && long && "line-clamp-3")}>{p.coverLetter}</p>
        {long && (
          <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="mt-1 inline-flex min-h-10 items-center gap-1 text-[13px] font-semibold text-accent-text">
            {expanded ? "Yopish" : "To'liq xat"}
            <ChevronDown size={14} className={cn("transition-transform", expanded && "rotate-180")} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <div className="flex items-center gap-2 text-[12px] text-fg-3">
          <Badge tone={PROPOSAL_STATUS_TONE[p.status]}>{PROPOSAL_STATUS_LABEL[p.status]}</Badge>
          <span suppressHydrationWarning>{timeAgo(p.createdAt)}</span>
        </div>

        {p.status === "accepted" && p.orderId && (
          <ButtonLink href={`/kabinet/buyurtmalar?id=${p.orderId}`} variant="primary" size="sm" className="!h-10">
            Buyurtmaga o'tish <ArrowRight size={14} />
          </ButtonLink>
        )}

        {actionable && !confirming && (
          /* Mobil: «Qabul qilish» birinchi qatorda to'liq kenglikda, qolganlari ikki ustunda; sm+: bitta qator */
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            {p.status === "pending" && (
              <button type="button" onClick={() => run("shortlist")} disabled={busy !== null} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[13px] font-semibold text-fg transition hover:border-fg disabled:opacity-60">
                {busy === "shortlist" ? <Spinner /> : <Star size={14} aria-hidden="true" />} Saralash
              </button>
            )}
            <button
              type="button"
              onClick={() => run("decline")}
              disabled={busy !== null}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-semibold text-fg-2 transition hover:bg-danger-soft hover:text-danger-text disabled:opacity-60 sm:border-transparent",
                p.status !== "pending" && "col-span-2",
              )}
            >
              {busy === "decline" ? <Spinner /> : <X size={14} aria-hidden="true" />} Rad etish
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={busy !== null || !sp.canHire}
              title={sp.canHire ? undefined : "Mutaxassis obunasi faol emas"}
              className="btn-accent order-first col-span-2 inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold disabled:opacity-50 sm:order-none sm:h-10 sm:text-[13px]"
            >
              <Check size={14} aria-hidden="true" /> Qabul qilish
            </button>
          </div>
        )}
      </div>

      {actionable && !sp.canHire && (
        <p className="mt-2 inline-flex items-start gap-1.5 text-[12.5px] font-medium text-warning-text">
          <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> Mutaxassis obunasi faol emas — hozircha yangi buyurtma qabul qila olmaydi.
        </p>
      )}

      {actionable && confirming && (
        <div className="mt-3 rounded-[var(--r-sm)] border border-line bg-surface-2 p-4" role="group" aria-label="Taklifni qabul qilishni tasdiqlang">
          <p className="text-[14px] font-semibold text-fg">
            {sp.user.name} bilan {formatPrice(p.amount)} ga, {p.deliveryDays} kunlik buyurtma yaratiladi
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">
            Qolgan faol takliflar avtomatik rad etiladi va e'lon yopiladi. Keyin to'lovni eskrouga o'tkazasiz — pul ishni qabul qilganingizda mutaxassisga o'tadi.
          </p>
          <label htmlFor={`accept-phone-${p.id}`} className="field-label mt-3">
            Mutaxassis bog'lanadigan telefon
          </label>
          <div className="relative max-w-xs">
            <Phone size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
            <input
              id={`accept-phone-${p.id}`}
              className="field pl-10"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+998 90 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={Boolean(phoneErr)}
            />
          </div>
          {phoneErr && <p className="field-error">{phoneErr}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => run("accept")} disabled={busy !== null} className="btn-accent inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[14px] font-semibold disabled:opacity-60">
              {busy === "accept" ? <Spinner /> : <Check size={15} aria-hidden="true" />} Tasdiqlash va buyurtma yaratish
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy !== null} className="inline-flex h-11 items-center rounded-full border border-line-2 px-5 text-[14px] font-semibold text-fg transition hover:border-fg">
              Bekor qilish
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 inline-flex items-start gap-1.5 text-[12.5px] font-medium text-danger-text">
          <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}
    </article>
  );
}
