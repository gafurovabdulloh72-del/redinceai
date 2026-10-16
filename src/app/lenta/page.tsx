import type { Metadata } from "next";
import { ArrowRight, Clapperboard } from "lucide-react";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { LentaFeed } from "@/components/lenta/LentaFeed";
import { getLentaItems } from "@/lib/lenta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lenta — ishlar videoda",
  description:
    "Mutaxassislarning video ishlari — Reels uslubidagi lenta. Videograf va montajchilarning ishlarini jonli ko'ring, yoqqaniga to'g'ridan-to'g'ri buyurtma bering.",
  alternates: { canonical: "/lenta" },
};

export default async function LentaPage() {
  const { items, nextCursor } = await getLentaItems(8);

  /* Bo'sh holat — oddiy sahifa oqimida (to'liq ekran lenta emas) */
  if (!items.length) {
    return (
      <div className="container-x">
        <PageHeader
          eyebrow="Ishlar lentasi"
          title={
            <>
              Ishlar <span className="accent-serif text-accent">videoda</span>
            </>
          }
          description="Mutaxassislarning video ishlari shu yerda Reels uslubida ko'rsatiladi."
        />
        <div className="mt-10">
          <EmptyState
            icon={Clapperboard}
            title="Lentada hali video ishlar yo'q"
            description="Mutaxassislar portfoliosiga video qo'shishi bilan lenta jonlanadi. Hozircha katalogdan ijodkorlarni ko'rib chiqing."
            action={
              <ButtonLink href="/mutaxassislar" variant="accent" size="md">
                Katalogni ochish <ArrowRight size={16} />
              </ButtonLink>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="sr-only">Ishlar lentasi — mutaxassislarning video ishlari</h1>
      {/* Layout'dagi main padding'lari bekor qilinadi — lenta ekranni to'liq egallaydi (navbar shisha, ustidan ko'rinadi) */}
      <div className="-mb-28 -mt-24 sm:-mt-28 md:mb-0">
        <LentaFeed initialItems={items} initialCursor={nextCursor} />
      </div>
    </>
  );
}
