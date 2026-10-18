"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle2, ChevronDown, Undo2, Wallet } from "lucide-react";
import { Badge, ButtonLink, Spinner } from "@/components/ui";
import { PROPOSAL_STATUS_LABEL, type ProposalStatusValue } from "@/lib/constants";
import { PROPOSAL_STATUS_TONE } from "@/lib/jobs/format";
import { cn, formatPrice, timeAgo } from "@/lib/utils";
import { patchProposal } from "./proposal-actions";

/** Qaytarib olish tugmasi (inline tasdiq bilan) — e'lon sahifasi va /kabinet/takliflar */
export function WithdrawButton({ proposalId, className, size = "md" }: { proposalId: string; className?: string; size?: "sm" | "md" }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const h = size === "sm" ? "h-10 px-3.5 text-[13px]" : "h-11 px-4 text-[14px]";

  const run = async () => {
    setBusy(true);
    setError(null);
    const r = await patchProposal(proposalId, "withdraw");
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAsk(false);
    router.refresh();
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {ask ? (
        <div className="expand-in flex flex-wrap items-center gap-2" role="group" aria-label="Taklifni qaytarib olishni tasdiqlang">
          <span className="text-[13px] font-medium text-fg-2">Taklif qaytarib olinsinmi?</span>
          <button type="button" onClick={run} disabled={busy} className={cn("inline-flex items-center gap-1.5 rounded-full bg-danger-strong font-semibold text-white transition hover:brightness-110 disabled:opacity-60", h)}>
            {busy ? <Spinner /> : <Undo2 size={14} aria-hidden="true" />} Ha, qaytarish
          </button>
          <button type="button" onClick={() => setAsk(false)} disabled={busy} className={cn("inline-flex items-center rounded-full border border-line-2 font-semibold text-fg transition hover:border-fg", h)}>
            Yo'q
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAsk(true)} className={cn("press inline-flex w-fit items-center gap-1.5 rounded-full border border-line-2 font-semibold text-fg-2 transition hover:border-fg hover:text-fg", h)}>
          <Undo2 size={14} aria-hidden="true" /> Qaytarib olish
        </button>
      )}
      {error && (
        <p role="alert" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-danger-text">
          <AlertCircle size={13} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}

/** Mutaxassis: shu e'longa yuborgan taklifi (holat, narx, muddat, xat, qaytarib olish / buyurtmaga o'tish) */
export function MyProposalCard({
  proposal,
}: {
  proposal: { id: string; status: ProposalStatusValue; amount: number; deliveryDays: number; coverLetter: string; orderId: string | null; createdAt: Date | string };
}) {
  const [open, setOpen] = useState(false);
  const active = proposal.status === "pending" || proposal.status === "shortlisted";
  const long = proposal.coverLetter.length > 180;
  return (
    <section aria-labelledby="my-proposal-title" className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="my-proposal-title" className="flex items-center gap-2 font-display text-[19px] font-semibold text-fg">
            {proposal.status === "accepted" && <CheckCircle2 size={19} className="text-success-text" aria-hidden="true" />}
            Sizning taklifingiz
          </h2>
          <p className="mt-0.5 text-[12.5px] text-fg-3" suppressHydrationWarning>
            Yuborildi: {timeAgo(proposal.createdAt)}
          </p>
        </div>
        <Badge tone={PROPOSAL_STATUS_TONE[proposal.status]}>{PROPOSAL_STATUS_LABEL[proposal.status]}</Badge>
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
        <div className="flex items-center gap-1.5">
          <Wallet size={15} className="text-fg-3" aria-hidden="true" />
          <dt className="sr-only">Narx</dt>
          <dd className="font-semibold text-fg">{formatPrice(proposal.amount)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarClock size={15} className="text-fg-3" aria-hidden="true" />
          <dt className="sr-only">Muddat</dt>
          <dd className="font-semibold text-fg">{proposal.deliveryDays} kun</dd>
        </div>
      </dl>

      <p className={cn("mt-3 whitespace-pre-line text-[14px] leading-relaxed text-fg-2", !open && long && "line-clamp-3")}>{proposal.coverLetter}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-1 inline-flex min-h-10 items-center gap-1 text-[13px] font-semibold text-accent-text">
          {open ? "Yopish" : "To'liq o'qish"}
          <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {proposal.status === "accepted" && proposal.orderId && (
          <ButtonLink href={`/kabinet/buyurtmalar?id=${proposal.orderId}`} variant="accent" size="md">
            Buyurtmaga o'tish <ArrowRight size={15} />
          </ButtonLink>
        )}
        {active && <WithdrawButton proposalId={proposal.id} />}
        {proposal.status === "declined" && <p className="text-[13px] text-fg-3">Mijoz boshqa taklifni tanladi. Boshqa e'lonlarni ko'rib chiqing.</p>}
        {proposal.status === "shortlisted" && <p className="text-[13px] text-fg-3">Mijoz taklifingizni saralab qo'ydi — tez orada qaror qiladi.</p>}
      </div>
    </section>
  );
}
