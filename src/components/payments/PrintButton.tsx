"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Chop etish / PDF: brauzer oynasi (PDF sifatida saqlash ham shu yerdan).
 * `fileName` — PDF fayl nomi uchun vaqtincha document.title (chop etish tugagach qaytariladi).
 */
export function PrintButton({ className, fileName, variant = "primary" }: { className?: string; fileName?: string; variant?: "primary" | "outline" }) {
  const print = () => {
    if (!fileName) {
      window.print();
      return;
    }
    const prev = document.title;
    document.title = fileName.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
    const restore = () => {
      document.title = prev;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    // afterprint kelmasa (ba'zi mobil brauzerlar) — baribir qaytariladi
    window.setTimeout(restore, 2000);
  };
  return (
    <Button type="button" size="md" variant={variant} onClick={print} className={className}>
      <Printer size={15} /> Chop etish / PDF
    </Button>
  );
}
