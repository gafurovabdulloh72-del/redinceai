import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowRight, Images, Sparkles } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { PortfolioManager, type PortfolioItemDTO } from "@/components/kabinet/PortfolioManager";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { portfolioItems, specialists } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portfolio" };

const MAX_ITEMS = 30;

export default async function PortfolioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/kirish?next=%2Fkabinet%2Fportfolio");

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
    createdAt: p.createdAt.getTime(),
  }));

  return (
    <div className="animate-fade-up">
      <div className="mb-5 sm:mb-6">
        <span className="glass-weak glass-pill inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-tint">
          <Images size={12} /> Kabinet
        </span>
        <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-tight text-fg sm:text-4xl">Portfolio</h1>
        <p className="mt-1.5 text-[15px] text-fg-2">
          {sp ? `Eng yaxshi ishlaringizni ko'rsating — ${MAX_ITEMS} tagacha rasm, video yoki havola.` : "Portfolio qo'shish uchun avval mutaxassis profilini yarating."}
        </p>
      </div>

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
