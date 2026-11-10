"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { reportClientError } from "@/components/system/report-error";
import { tr } from "@/lib/i18n";
import { SECTION_ERROR } from "@/lib/i18n/dict/system";

/**
 * Bo'lim darajasidagi xatolik chegarasi (2026-10-29).
 * Ilgari loyihada FAQAT `app/error.tsx` bor edi — kabinet yoki admin ichidagi bitta
 * bo'limda xato chiqsa butun sahifa (qobiq bilan birga) almashardi va foydalanuvchi
 * navigatsiyani yo'qotardi. Bu komponent xatoni shu bo'lim ichida ushlab qoladi:
 * yon panel, yuqori panel va tablar joyida qoladi, faqat kontent o'rnida karta chiqadi.
 * 2026-11-10: matn ikki tilda (uz/ru); xato admin «Xatolar» jurnaliga yuboriladi (server xatosi — digest bilan —
 * serverda yozilgan, brauzerdan takror yuborilmaydi).
 */
export function SectionError({ error, reset, title }: { error: Error & { digest?: string }; reset: () => void; title: string }) {
  const til = useLocale();
  useEffect(() => {
    console.error("[section-error]", error);
    reportClientError(error, { type: "boundary", digest: error.digest });
  }, [error]);

  return (
    <div className="card-outline mx-auto my-6 flex max-w-xl flex-col items-center gap-3 px-5 py-10 text-center" role="alert">
      <span className="icon-tile-soft !rounded-full">
        <TriangleAlert size={18} />
      </span>
      <p className="text-[15px] font-semibold text-fg">{title}</p>
      <p className="max-w-sm text-[13px] leading-relaxed text-fg-3">{tr(til, SECTION_ERROR.text)}</p>
      {error.digest && (
        <p className="text-[12px] text-fg-4">
          {tr(til, SECTION_ERROR.code)}: {error.digest}
        </p>
      )}
      <Button type="button" variant="outline" size="sm" onClick={reset} className="mt-1">
        <RotateCcw size={14} /> {tr(til, SECTION_ERROR.retry)}
      </Button>
    </div>
  );
}
