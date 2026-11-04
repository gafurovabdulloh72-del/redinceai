"use client";

import { Printer } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { MK } from "@/lib/i18n/dict/mentorship";

/** Brauzer chop etish oynasi: «PDF sifatida saqlash» */
export function PrintButton() {
  const til = useLocale();
  return (
    <button type="button" onClick={() => window.print()} className="btn-accent inline-flex h-10 items-center gap-2 px-5 text-[13.5px] font-semibold">
      <Printer size={15} /> {tr(til, MK.printPdf)}
    </button>
  );
}
