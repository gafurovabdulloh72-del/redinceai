"use client";

import { Printer } from "lucide-react";

/** Brauzer chop etish oynasi: «PDF sifatida saqlash» */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-accent inline-flex h-10 items-center gap-2 px-5 text-[13.5px] font-semibold">
      <Printer size={15} /> Chop etish / PDF
    </button>
  );
}
