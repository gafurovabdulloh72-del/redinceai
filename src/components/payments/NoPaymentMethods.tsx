import { SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * To'lov usuli ulanmagan holat. Ilgari faqat «administrator bilan bog'laning» degan matn chiqardi — havolasiz, ya'ni
 * foydalanuvchi uchun boshi berk ko'cha edi (sayt QA topilmasi). Endi qo'llab-quvvatlash Telegramiga havola bor.
 */
export function NoPaymentMethods({ til = "uz", className }: { til?: "uz" | "ru"; className?: string }) {
  const ru = til === "ru";
  return (
    <p className={cn("text-[13px] leading-relaxed text-warning-text", className)} data-no-auto>
      {ru ? "Способы оплаты пока не подключены." : "To'lov usullari hali ulanmagan."}{" "}
      <a href={SITE.supportTelegram} target="_blank" rel="noreferrer noopener" className="font-semibold underline underline-offset-2 hover:opacity-80">
        {ru ? "Написать в поддержку" : "Qo'llab-quvvatlashga yozish"}
      </a>
    </p>
  );
}
