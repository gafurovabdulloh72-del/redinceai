import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Award, GitCompareArrows, Search } from "lucide-react";
import { Avatar, ButtonLink, EmptyState, PageHeader, Stars, VerifiedBadge } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { CATEGORY_BY_SLUG, EXPERIENCE_LEVELS, PACKAGE_TIERS, RATING_CRITERIA, REGION_BY_SLUG, TOP_RATED_RULE, WORK_TYPE_BY_SLUG } from "@/lib/constants";
import { getSettings } from "@/lib/payments/settings";
import { getCompareSpecialists, responseTimeLabel, type CompareSpecialist } from "@/lib/queries";
import { cn, formatPrice, formatPriceRange, formatUsd } from "@/lib/utils";
import { CompareRemove, CompareSync } from "./CompareControls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Taqqoslash",
  description: "2–3 mutaxassisni narx, paketlar, reyting va tajriba bo'yicha yonma-yon solishtiring.",
  robots: { index: false, follow: true },
};

const ID_RE = /^[\w-]{1,64}$/;

/** Taqqoslash (F54): /taqqoslash?ids=a,b,c — faqat mehmonga ham ochiq ma'lumot (toListItem + ommaviy paket/tarif) */
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  const raw = (await searchParams).ids;
  const hasIds = raw !== undefined;
  const ids = (Array.isArray(raw) ? raw.join(",") : (raw ?? ""))
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ID_RE.test(s))
    .slice(0, 3);

  const [session, settings] = await Promise.all([getSession(), getSettings()]);
  const items = ids.length ? await getCompareSpecialists(ids, { userId: session?.sub ?? null, role: session?.role ?? null }) : [];
  const sync = items.map((s) => ({ id: s.id, name: s.user.name, avatarUrl: s.user.avatarUrl }));

  const header = (
    <PageHeader
      eyebrow="Yonma-yon"
      title={
        <>
          Mutaxassislarni <span className="accent-serif text-accent">taqqoslash</span>
        </>
      }
      description="Narx, paketlar, reyting, tajriba va javob tezligi — bir jadvalda. Ro'yxatdan 3 tagacha mutaxassis tanlang."
    />
  );

  if (items.length === 0) {
    return (
      <div className="container-x">
        <CompareSync items={sync} hasIds={hasIds && ids.length > 0} />
        {header}
        <div className="mt-8">
          <EmptyState
            icon={GitCompareArrows}
            title="Taqqoslash uchun mutaxassis tanlanmagan"
            description="Ro'yxatdagi kartalarda «Taqqoslash» belgisini bosing — 3 tagacha mutaxassisni shu yerda solishtirasiz."
            action={
              <ButtonLink href="/mutaxassislar">
                <Search size={15} /> Mutaxassislarni ko'rish
              </ButtonLink>
            }
          />
        </div>
      </div>
    );
  }

  // Eng yaxshi qiymatlar — kichik belgi bilan (kamida 2 ta ustun bo'lsa)
  const priced = items.filter((s) => s.priceFrom > 0);
  const minPrice = items.length > 1 && priced.length > 1 ? Math.min(...priced.map((s) => s.priceFrom)) : null;
  const rated = items.filter((s) => s.reviewCount > 0);
  const maxRating = items.length > 1 && rated.length > 1 ? Math.max(...rated.map((s) => s.rating)) : null;
  const ids3 = items.map((s) => s.id);

  const rows: Array<{ label: string; cell: (s: CompareSpecialist) => ReactNode }> = [
    {
      label: "Narx",
      cell: (s) => (
        <>
          <p className="font-display text-[15px] font-semibold text-fg">{formatPriceRange(s.priceFrom, s.priceTo)}</p>
          {s.priceFrom > 0 && <p className="text-[12px] text-fg-3">{formatUsd(s.priceFrom, settings.usdRate)}</p>}
          {minPrice != null && s.priceFrom === minPrice && <Best>Eng arzon</Best>}
        </>
      ),
    },
    {
      label: "Paketlar",
      cell: (s) =>
        s.packages.length ? (
          <ul className="space-y-1">
            {PACKAGE_TIERS.map((t) => {
              const p = s.packages.find((x) => x.key === t.key);
              return (
                <li key={t.key} className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="text-fg-3">{t.label}</span>
                  <span className={cn("whitespace-nowrap font-semibold", p ? "text-fg" : "text-fg-4")}>{p ? `${formatPrice(p.price, { compact: true })} · ${p.deliveryDays} kun` : "—"}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <Dash />
        ),
    },
    {
      label: "Reyting",
      cell: (s) => (
        <>
          {s.reviewCount > 0 ? <Stars value={s.rating} count={s.reviewCount} size={13} /> : <span className="text-[13px] text-fg-3">Hali sharh yo'q</span>}
          {maxRating != null && s.reviewCount > 0 && s.rating === maxRating && <Best>Eng yuqori</Best>}
          {RATING_CRITERIA.some((c) => s.criteria[c.key] != null) && (
            <ul className="mt-2 space-y-0.5">
              {RATING_CRITERIA.map((c) => (
                <li key={c.key} className="flex justify-between gap-2 text-[12.5px]">
                  <span className="text-fg-3">{c.label}</span>
                  <span className="font-semibold tabular-nums text-fg">{s.criteria[c.key]?.toFixed(1) ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ),
    },
    { label: "Bajarilgan buyurtmalar", cell: (s) => <span className="font-display text-[15px] font-semibold tabular-nums text-fg">{s.completed}</span> },
    { label: "Tajriba", cell: (s) => <span className="text-[13.5px] text-fg">{EXPERIENCE_LEVELS.find((e) => e.value === s.experience)?.label ?? s.experience}</span> },
    {
      label: "Hudud",
      cell: (s) => (
        <span className="text-[13.5px] text-fg">
          {s.city}
          {REGION_BY_SLUG[s.regionSlug] && <span className="block text-[12px] text-fg-3">{REGION_BY_SLUG[s.regionSlug].name}</span>}
        </span>
      ),
    },
    {
      label: "Ish turlari",
      cell: (s) =>
        s.workTypes.length ? (
          <ul className="flex flex-wrap gap-1">
            {s.workTypes.map((w) => (
              <li key={w} className="rounded-full bg-surface-3 px-2 py-0.5 text-[12px] font-medium text-fg-2">
                {WORK_TYPE_BY_SLUG[w]?.label ?? w}
              </li>
            ))}
          </ul>
        ) : (
          <Dash />
        ),
    },
    { label: "Javob vaqti", cell: (s) => <span className="text-[13px] text-fg">{responseTimeLabel(s.responseHours)?.replace("Odatda ", "") ?? "—"}</span> },
    {
      label: "Nishonlar",
      cell: (s) =>
        s.topRated || s.isVerified ? (
          <span className="flex flex-col items-start gap-1">
            {s.topRated && (
              <span title={`Reyting ${TOP_RATED_RULE.minRating}+ va kamida ${TOP_RATED_RULE.minReviews} ta sharh`} className="inline-flex h-7 items-center gap-1 rounded-full border border-line px-2.5 text-[12px] font-semibold text-fg">
                <Award size={12} className="text-accent" /> Top mutaxassis
              </span>
            )}
            {s.isVerified && (
              <span className="inline-flex h-7 items-center gap-1 text-[12px] font-semibold text-fg-2">
                <VerifiedBadge size={14} /> Tasdiqlangan
              </span>
            )}
          </span>
        ) : (
          <Dash />
        ),
    },
  ];

  return (
    <div className="container-x">
      <CompareSync items={sync} hasIds />
      {header}

      {items.length < 2 && (
        <p className="mt-6 rounded-[var(--r-sm)] bg-surface-3 px-4 py-3 text-[13.5px] text-fg-2">
          Solishtirish uchun yana 1–2 ta mutaxassis tanlang.{" "}
          <Link href="/mutaxassislar" className="font-semibold text-accent-text hover:opacity-80">
            Ro'yxatga qaytish
          </Link>
        </p>
      )}

      {/* Telefonda jadval o'z ichida gorizontal suriladi (sahifa emas); birinchi ustun yopishqoq */}
      <div className="card mt-6 overflow-x-auto sm:mt-8">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left">
          <caption className="sr-only">Tanlangan mutaxassislarni taqqoslash jadvali</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-[120px] border-b border-line bg-surface p-3 align-bottom text-[11px] font-bold uppercase tracking-[0.14em] text-fg-4 sm:w-[170px] sm:p-4">
                {items.length} ta
              </th>
              {items.map((s) => {
                const cat = CATEGORY_BY_SLUG[s.category];
                return (
                  <th key={s.id} scope="col" className="border-b border-line p-3 align-top font-normal sm:p-4">
                    <div className="flex items-start gap-2">
                      <Link href={`/mutaxassislar/${s.slug}`} className="group flex min-w-0 flex-1 items-start gap-2.5">
                        <Avatar name={s.user.name} src={s.user.avatarUrl} size={44} decorative />
                        <span className="min-w-0">
                          <span className="block font-display text-[15px] font-semibold leading-tight text-fg group-hover:underline">{s.user.name}</span>
                          <span className="mt-0.5 block text-[12px] text-fg-3">{cat?.name ?? s.title}</span>
                        </span>
                      </Link>
                      <CompareRemove id={s.id} name={s.user.name} rest={ids3.filter((x) => x !== s.id)} />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="sticky left-0 z-10 border-b border-line bg-surface p-3 align-top text-[12.5px] font-semibold text-fg-2 sm:p-4">
                  {r.label}
                </th>
                {items.map((s) => (
                  <td key={s.id} className="border-b border-line p-3 align-top sm:p-4">
                    {r.cell(s)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className="sticky left-0 z-10 bg-surface p-3 sm:p-4">
                <span className="sr-only">Amallar</span>
              </th>
              {items.map((s) => (
                <td key={s.id} className="p-3 sm:p-4">
                  <ButtonLink href={`/buyurtma/${s.id}`} variant="accent" size="md" className="w-full">
                    Buyurtma berish <ArrowRight size={15} />
                  </ButtonLink>
                  <Link href={`/mutaxassislar/${s.slug}`} className="mt-1 flex min-h-10 items-center justify-center text-[13px] font-semibold text-fg-2 hover:text-fg">
                    Profilni ko'rish
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-fg-3">Narxlar taxminiy; yakuniy narx buyurtmada mutaxassis bilan kelishiladi. Dollar kursi: 1 $ ≈ {formatPrice(settings.usdRate)}.</p>
    </div>
  );
}

function Dash() {
  return <span className="text-[13px] text-fg-4">—</span>;
}

function Best({ children }: { children: ReactNode }) {
  return <span className="mt-1.5 inline-flex rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success-text">{children}</span>;
}
