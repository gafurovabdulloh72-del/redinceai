"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { KONTAKTLAR as K } from "@/lib/i18n/dict/kontaktlar";

/** Mutaxassis kabineti: «Kontaktim sotilsin» / «Faqat portfolio» rejimi (narxni admin belgilaydi) */
export function ContactModeSwitch({ initial, price }: { initial: "paid" | "hidden"; price: number }) {
  const til = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function set(next: "paid" | "hidden") {
    if (busy || next === mode) return;
    setBusy(true);
    const prev = mode;
    setMode(next);
    try {
      const r = await fetch("/api/kontakt/rejim", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ contactMode: next }) });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error || "Xatolik");
      showToast(next === "paid" ? tr(til, K.savedPaid) : tr(til, K.savedHidden), "success");
      router.refresh();
    } catch (e) {
      setMode(prev);
      showToast(e instanceof Error ? e.message : tr(til, K.err), "error");
    } finally {
      setBusy(false);
    }
  }

  const Opt = ({ v, title, desc }: { v: "paid" | "hidden"; title: string; desc: string }) => (
    <button type="button" role="radio" aria-checked={mode === v} disabled={busy} onClick={() => void set(v)} className={cn("flex w-full items-start gap-3 rounded-[12px] border px-3.5 py-3 text-left transition", mode === v ? "border-fg bg-fg/[0.03]" : "border-line hover:border-line-2")}>
      <span className={cn("mt-1 h-4 w-4 shrink-0 rounded-full border-2", mode === v ? "border-fg bg-fg" : "border-line-2")} aria-hidden />
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-3">{desc}</span>
      </span>
      {busy && mode === v && <Loader2 size={14} className="ml-auto mt-1 animate-spin text-fg-3" />}
    </button>
  );

  return (
    <div role="radiogroup" aria-label={tr(til, K.modeAria)} className="space-y-2">
      <Opt v="paid" title={tr(til, K.paidTitle)} desc={K.paidDesc[til](`${new Intl.NumberFormat("ru-RU").format(price)} so'm`)} />
      <Opt v="hidden" title={tr(til, K.hiddenTitle)} desc={tr(til, K.hiddenDesc)} />
    </div>
  );
}
