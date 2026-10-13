import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness, Map, RotateCw, Users, WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Internet aloqasi yo'q",
  robots: { index: false, follow: false },
};

/**
 * Oflayn sahifa (F97): service worker tarmoq bo'lmaganda shu sahifani ko'rsatadi (sw.js oldindan keshlaydi).
 * JS'siz ishlaydi: "Qayta urinish" — oddiy GET forma (joriy manzilni qayta yuklaydi).
 */
export default function OfflinePage() {
  return (
    <div className="container-x">
      <div className="card-outline mx-auto flex max-w-2xl flex-col items-center !rounded-card-lg px-6 py-14 text-center sm:px-12 sm:py-20">
        <span className="icon-tile-soft icon-tile-lg" aria-hidden="true">
          <WifiOff size={24} />
        </span>
        <h1 className="mt-6 font-display text-[26px] font-semibold text-fg sm:text-[34px]">Internet aloqasi yo&apos;q</h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-fg-2">
          Sahifani yuklab bo&apos;lmadi. Wi-Fi yoki mobil internetni tekshiring — aloqa tiklangach qayta urinib ko&apos;ring. Avval ochilgan ommaviy sahifalar oflayn ham ochilishi mumkin.
        </p>
        <form method="get" className="mt-8 w-full sm:w-auto">
          <button type="submit" className="btn-accent inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 text-[15px] font-semibold sm:w-auto">
            <RotateCw size={17} /> Qayta urinish
          </button>
        </form>
        <nav aria-label="Asosiy sahifalar" className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-fg-3">
          <Link href="/xarita" className="inline-flex min-h-10 items-center gap-1.5 transition hover:text-fg">
            <Map size={15} /> Xarita
          </Link>
          <Link href="/mutaxassislar" className="inline-flex min-h-10 items-center gap-1.5 transition hover:text-fg">
            <Users size={15} /> Mutaxassislar
          </Link>
          <Link href="/ishlar" className="inline-flex min-h-10 items-center gap-1.5 transition hover:text-fg">
            <BriefcaseBusiness size={15} /> Ishlar
          </Link>
        </nav>
        <p className="mt-6 text-[12px] text-fg-4">To&apos;lov, kabinet va admin sahifalari xavfsizlik uchun oflayn saqlanmaydi.</p>
      </div>
    </div>
  );
}
