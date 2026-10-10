import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, MapPinned, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { MAP_VIEWBOX, REGION_SHAPES } from "@/components/map/regions-geo";

export const metadata: Metadata = {
  title: "Sahifa topilmadi",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="container-x">
      <div className="card-outline relative mx-auto flex max-w-4xl flex-col items-center overflow-hidden !rounded-card-lg px-6 py-16 text-center sm:px-12 sm:py-24">
        {/* Nur + dekorativ xarita silueti */}
        <span className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/20 blur-[90px]" />
        <svg
          viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
          className="pointer-events-none absolute -bottom-10 -right-16 h-auto w-[60%] text-fg opacity-[0.05] dark:opacity-[0.07]"
          aria-hidden="true"
        >
          {REGION_SHAPES.map((r) => (
            <path key={r.slug} d={r.d} fill="currentColor" stroke="var(--surface-2)" strokeWidth={6} strokeLinejoin="round" />
          ))}
        </svg>

        <span className="eyebrow relative">
          <Compass size={13} className="text-accent" /> Xato 404
        </span>

        <p className="display-xl relative mt-6 text-[104px] leading-none text-fg sm:text-[168px]" aria-hidden="true">
          4<span className="accent-serif text-accent">0</span>4
        </p>

        <h1 className="relative mt-6 font-display text-[26px] font-semibold text-fg sm:text-[34px]">Sahifa topilmadi</h1>
        <p className="relative mt-3 max-w-md text-[15px] leading-relaxed text-fg-2 sm:text-[16px]">
          Bu manzil ko'chib ketgan yoki umuman bo'lmagan. Yo'qolib qolmang — ijodkorlar xaritada, bir bosishda.
        </p>

        <div className="relative mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <ButtonLink href="/" variant="accent" size="lg" className="w-full sm:w-auto sm:min-w-[190px]">
            Bosh sahifaga <ArrowRight size={16} />
          </ButtonLink>
          <ButtonLink href="/xarita" variant="outline" size="lg" className="w-full sm:w-auto">
            <MapPinned size={16} /> Xaritani ochish
          </ButtonLink>
        </div>

        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-fg-3">
          <Link href="/mutaxassislar" className="inline-flex min-h-10 items-center gap-1.5 transition hover:text-fg">
            <Users size={14} /> Mutaxassislar ro'yxati
          </Link>
          <Link href="/kabinet" className="inline-flex min-h-10 items-center gap-1.5 transition hover:text-fg">
            <Compass size={14} /> Kabinet
          </Link>
        </div>
      </div>
    </div>
  );
}
