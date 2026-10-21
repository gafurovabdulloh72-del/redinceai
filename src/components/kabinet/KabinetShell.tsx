"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Kabinet ramkasi: [yon menyu | kontent] ikki ustun. Chat sahifasida (Telegram Web kabi) kabinet yon menyusi
 * desktopda yashiriladi — suhbatlar ro'yxati va yozishma butun kenglikni oladi (global yon panel baribir chapda turadi).
 * 390px'da gorizontal siljish bo'lmasligi uchun grid bolalari min-w-0 (layout izohi bilan bir xil qoida).
 */
export function KabinetShell({ aside, children }: { aside: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const wide = pathname === "/kabinet/chat" || pathname.startsWith("/kabinet/chat/");
  return (
    <div className={cn("container-x min-w-0 max-w-full [&_img]:max-w-full [&_table]:max-w-full", wide && "lg:!max-w-[1500px]")}>
      <div className={cn("grid min-w-0 grid-cols-1 gap-0 md:gap-5 lg:gap-8", wide ? "lg:grid-cols-1" : "lg:grid-cols-12")}>
        <aside className={cn("min-w-0 print:hidden", wide ? "lg:hidden" : "lg:col-span-3")}>{aside}</aside>
        <div className={cn("min-w-0 print:col-span-12", !wide && "lg:col-span-9")}>{children}</div>
      </div>
    </div>
  );
}
