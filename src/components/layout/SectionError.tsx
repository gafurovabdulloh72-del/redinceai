"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Bo'lim darajasidagi xatolik chegarasi (2026-10-29).
 * Ilgari loyihada FAQAT `app/error.tsx` bor edi — kabinet yoki admin ichidagi bitta
 * bo'limda xato chiqsa butun sahifa (qobiq bilan birga) almashardi va foydalanuvchi
 * navigatsiyani yo'qotardi. Bu komponent xatoni shu bo'lim ichida ushlab qoladi:
 * yon panel, yuqori panel va tablar joyida qoladi, faqat kontent o'rnida karta chiqadi.
 */
export function SectionError({ error, reset, title }: { error: Error & { digest?: string }; reset: () => void; title: string }) {
  useEffect(() => {
    console.error("[section-error]", error);
  }, [error]);

  return (
    <div className="card-outline mx-auto my-6 flex max-w-xl flex-col items-center gap-3 px-5 py-10 text-center" role="alert">
      <span className="icon-tile-soft !rounded-full">
        <TriangleAlert size={18} />
      </span>
      <p className="text-[15px] font-semibold text-fg">{title}</p>
      <p className="max-w-sm text-[13px] leading-relaxed text-fg-3">
        Bu bo&apos;limni yuklashda xatolik bo&apos;ldi. Qayta urinib ko&apos;ring — saytning qolgan qismi ishlayapti.
      </p>
      {error.digest && <p className="text-[12px] text-fg-4">Kod: {error.digest}</p>}
      <Button type="button" variant="outline" size="sm" onClick={reset} className="mt-1">
        <RotateCcw size={14} /> Qayta urinish
      </Button>
    </div>
  );
}
