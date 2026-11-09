"use client";

import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { VAK_AI as T } from "@/lib/i18n/dict/vacancies-ai";
import type { ApplicantView } from "@/lib/vacancies/service";
import { ApplicantsList } from "./ApplicantsList";
import { MatchingCandidates } from "./MatchingCandidates";

/** Kabinetdagi vakansiya paneli: Arizalar (saralash, ball, voronka) · Mos nomzodlar (hunting) — ikkinchisi faqat bosilganda yuklanadi */
export function VacancyPanel({ vacancyId, initial, vacancyOpen }: { vacancyId: string; initial: ApplicantView[]; vacancyOpen: boolean }) {
  const til = useLocale();
  const [tab, setTab] = useState<"apps" | "hunt">("apps");
  return (
    <div className="grid gap-4">
      <div className="flex gap-1 border-b border-line" role="tablist" aria-label={tr(til, T.tabApplicants)}>
        {(
          [
            { k: "apps", label: `${tr(til, T.tabApplicants)} · ${initial.length}` },
            { k: "hunt", label: tr(til, T.tabCandidates) },
          ] as const
        ).map((x) => (
          <button
            key={x.k}
            type="button"
            role="tab"
            aria-selected={tab === x.k}
            onClick={() => setTab(x.k)}
            className={`relative inline-flex h-10 items-center px-3 text-[13px] font-semibold transition-colors ${tab === x.k ? "text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-fg" : "text-fg-3 hover:text-fg"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {/* Arizalar paneli yashirin bo'lsa ham o'rnatilgan qoladi — holat (tab/saralash) yo'qolmasin */}
      <div hidden={tab !== "apps"}>
        <ApplicantsList vacancyId={vacancyId} initial={initial} vacancyOpen={vacancyOpen} />
      </div>
      {tab === "hunt" && <MatchingCandidates vacancyId={vacancyId} vacancyOpen={vacancyOpen} />}
    </div>
  );
}
