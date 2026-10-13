import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowRight, Sparkles } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { PortfolioManager, type PortfolioItemDTO } from "@/components/kabinet/PortfolioManager";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { portfolioItems, specialists } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portfolio" };

const MAX_ITEMS = 30;

export default async function PortfolioPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/portfolio"));

  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.userId, user.id),
    with: { portfolio: { orderBy: [asc(portfolioItems.sortOrder), asc(portfolioItems.createdAt)] } },
  });

  const items: PortfolioItemDTO[] = (sp?.portfolio ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    type: p.type,
    url: p.url,
    thumbnailUrl: p.thumbnailUrl,
    description: p.description,
    tags: p.tags ?? [],
    beforeUrl: p.beforeUrl,
    createdAt: p.createdAt.getTime(),
  }));

  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <span className="eyebrow">Kabinet · Portfolio</span>
        <h1 className="display-xl mt-4 text-[32px] text-fg sm:text-[40px] lg:text-[44px]">
          Portfolio <span className="accent-serif text-accent">ishlari</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2 sm:text-[16px]">
          {sp
            ? `Eng yaxshi ishlaringizni ko'rsating — ${MAX_ITEMS} tagacha rasm, video yoki havola. Mijozlar portfolioga qarab tanlaydi.`
            : "Portfolio qo'shish uchun avval mutaxassis profilini yarating."}
        </p>
      </header>

      {sp ? (
        <PortfolioManager items={items} max={MAX_ITEMS} publicHref={`/mutaxassislar/${sp.slug}#portfolio`} />
      ) : (
        <EmptyState
          icon={Sparkles}
          title="Avval mutaxassis profilini to'ldiring"
          description="Yo'nalish, hudud va narxlarni kiriting — shundan so'ng portfolio bo'limi ochiladi."
          action={
            <ButtonLink href="/kabinet/profil#mutaxassis" size="md">
              Profilni to'ldirish <ArrowRight size={16} />
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
