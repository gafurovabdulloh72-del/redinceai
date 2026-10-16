import type { Metadata } from "next";
import { ArrowRight, Clapperboard } from "lucide-react";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { LentaFeed } from "@/components/lenta/LentaFeed";
import { tr } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { LENTA } from "@/lib/i18n/dict/lenta";
import { getLentaItems } from "@/lib/lenta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lenta — ishlar videoda",
  description:
    "Mutaxassislarning video ishlari — Reels uslubidagi lenta. Videograf va montajchilarning ishlarini jonli ko'ring, yoqqaniga to'g'ridan-to'g'ri buyurtma bering.",
  alternates: { canonical: "/lenta" },
};

export default async function LentaPage() {
  const til = await getLocale();
  const { items, nextCursor } = await getLentaItems(8);

  /* Bo'sh holat — oddiy sahifa oqimida (to'liq ekran lenta emas) */
  if (!items.length) {
    return (
      <div className="container-x">
        <PageHeader
          eyebrow={tr(til, LENTA.eyebrow)}
          title={
            <>
              {tr(til, LENTA.titleStart)} <span className="accent-serif text-accent">{tr(til, LENTA.titleAccent)}</span>
            </>
          }
          description={tr(til, LENTA.description)}
        />
        <div className="mt-10">
          <EmptyState
            icon={Clapperboard}
            title={tr(til, LENTA.emptyTitle)}
            description={tr(til, LENTA.emptyDesc)}
            action={
              <ButtonLink href="/mutaxassislar" variant="accent" size="md">
                {tr(til, LENTA.openCatalog)} <ArrowRight size={16} />
              </ButtonLink>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="sr-only">{tr(til, LENTA.srTitle)}</h1>
      {/* Layout'dagi main padding'lari bekor qilinadi — lenta ekranni to'liq egallaydi (navbar shisha, ustidan ko'rinadi) */}
      <div className="-mb-28 -mt-24 sm:-mt-28 md:mb-0">
        <LentaFeed initialItems={items} initialCursor={nextCursor} />
      </div>
    </>
  );
}
