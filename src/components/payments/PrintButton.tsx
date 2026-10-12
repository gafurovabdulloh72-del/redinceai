"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/** Chek sahifasi: brauzer chop etish oynasi (PDF sifatida saqlash ham shu yerdan) */
export function PrintButton({ className }: { className?: string }) {
  return (
    <Button type="button" size="md" onClick={() => window.print()} className={className}>
      <Printer size={15} /> Chop etish / PDF
    </Button>
  );
}
