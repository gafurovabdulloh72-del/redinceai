import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { PORTFOLIO_SAHIFA as PF } from "@/lib/i18n/dict/kabinet-forms";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowRight, Sparkles } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { PortfolioManager, type PortfolioItemDTO } from "@/components/kabinet/PortfolioManager";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { portfolioItems, specialists } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Portfolio"])  };
}

const MAX_ITEMS = 30;

export default async function PortfolioPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/portfolio"));
  const til = await getLocale();

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
        <span className="eyebrow">{tr(til, PF.eyebrow)}</span>
        <h1 className="display-xl mt-4 text-fg">
          {tr(til, PF.titleStart)} <span className="accent-serif">{tr(til, PF.titleAccent)}</span>
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">{sp ? PF.desc[til](MAX_ITEMS) : tr(til, PF.descNoProfile)}</p>
      </header>

      {sp ? (
        <PortfolioManager items={items} max={MAX_ITEMS} publicHref={`/mutaxassislar/${sp.slug}#portfolio`} />
      ) : (
        <EmptyState
          icon={Sparkles}
          title={tr(til, PF.emptyTitle)}
          description={tr(til, PF.emptyDesc)}
          action={
            <ButtonLink href="/kabinet/profil#mutaxassis" size="md">
              {tr(til, PF.fillProfile)} <ArrowRight size={16} />
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
