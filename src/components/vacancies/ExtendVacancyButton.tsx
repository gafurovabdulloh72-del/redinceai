"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useToast } from "@/components/ui/toast";
import { tr } from "@/lib/i18n";
import { VAK_UZAYTIRISH } from "@/lib/i18n/dict/vacancies-catalog";
import { VACANCY_TTL_DAYS } from "@/lib/vacancies/format";
import { cn } from "@/lib/utils";

/** Kabinet: bir bosishda uzaytirish / qayta ochish (PATCH {extend:true}) — muddat bugundan yana 30 kun */
export function ExtendVacancyButton({ vacancyId, reopen = false, className }: { vacancyId: string; reopen?: boolean; className?: string }) {
  const til = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/vakansiyalar/${encodeURIComponent(vacancyId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ extend: true }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || tr(til, VAK_UZAYTIRISH.failed));
      toast(VAK_UZAYTIRISH.extendedToast[til](VACANCY_TTL_DAYS), "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : tr(til, VAK_UZAYTIRISH.failed), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={go} disabled={busy} className={cn("press inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold disabled:opacity-50", reopen ? "btn-accent" : "border border-line-2 text-fg-2 hover:text-fg", className)}>
      <RotateCcw size={13} className={busy ? "animate-spin" : undefined} /> {reopen ? tr(til, VAK_UZAYTIRISH.reopen) : VAK_UZAYTIRISH.plusDays[til](VACANCY_TTL_DAYS)}
    </button>
  );
}
