"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Gift } from "lucide-react";
import { formatSom } from "@/lib/mentorship/format";

/** Do'stni taklif qilish: shaxsiy havola — do'sti chegirma oladi, siz kredit olasiz (keyingi xaridga) */
export function ReferralCard({ path, percent }: { path: string; percent: number }) {
  const [d, setD] = useState<{ code: string; invited: number; earned: number; balance: number } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void fetch("/api/mentorlik/tavsiya").then((r) => r.json()).then((j: { data?: typeof d }) => j.data && setD(j.data)).catch(() => undefined);
  }, []);
  if (!d || percent <= 0) return null;
  const link = typeof window !== "undefined" ? `${location.origin}${path}?ref=${d.code}` : "";
  return (
    <div className="card min-w-0 overflow-hidden p-4">
      <p className="flex items-center gap-2 text-[14px] font-bold text-fg"><Gift size={16} className="text-accent-text" /> Do&apos;stingizni taklif qiling</p>
      <p className="mt-1 text-[13px] leading-relaxed text-fg-3">Havolangiz orqali xarid qilgan do&apos;stingiz {percent}% chegirma oladi, siz esa shuncha kredit — keyingi xaridingizga.</p>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(link).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          });
        }}
        className="mt-2.5 flex h-10 w-full min-w-0 max-w-full items-center justify-between gap-2 overflow-hidden rounded-lg border border-line-2 px-3 text-left text-[13px] text-fg-2 hover:text-fg"
      >
        <span className="min-w-0 truncate">{link}</span>
        {copied ? <Check size={15} className="shrink-0 text-success" /> : <Copy size={15} className="shrink-0" />}
      </button>
      {(d.invited > 0 || d.balance > 0) && <p className="mt-2 text-[12.5px] text-fg-3">Taklif qilinganlar: {d.invited} · Kredit balansi: {formatSom(d.balance)}</p>}
    </div>
  );
}
