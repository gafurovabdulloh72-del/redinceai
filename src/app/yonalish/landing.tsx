import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, ChevronDown, ChevronRight, Map as MapIcon, Star, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { SpecialistCard } from "@/components/specialists/SpecialistCard";
import { CompareTray } from "@/components/specialists/CompareTray";
import { CATEGORIES, CATEGORY_BY_SLUG, REGIONS, REGION_BY_SLUG, SITE, TOP_RATED_RULE, type Category, type Region } from "@/lib/constants";
import { GUEST_VIEWER } from "@/lib/privacy";
import { getLandingIndex, getLandingStats, listSpecialists } from "@/lib/queries";
import { specialistFilterSchema } from "@/lib/validators";
import { formatPrice } from "@/lib/utils";

/*
 * SEO landing sahifalari (F59/F60): /yonalish/[category] va /yonalish/[category]/[region].
 * Faqat MEHMON ma'lumoti (toListItem + GUEST_VIEWER) — sahifa keshlanishi mumkin, ko'ruvchiga bog'liq emas.
 */

/** "Videograflar" → "videograflar"; "UI/UX dizaynerlar", "3D artistlar" — o'zgarmaydi */
function lowerFirst(s: string) {
  return /^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** Joy kelishigi: "Toshkentdagi" / "Samarqand viloyatidagi" / "O'zbekistondagi" (+ "-da" shakli FAQ uchun) */
function placeForms(region: Region | null) {
  if (!region) return { dagi: "O'zbekistondagi", da: "O'zbekistonda", label: "O'zbekiston" };
  const base = region.slug === "toshkent-shahri" ? "Toshkent" : region.name;
  return { dagi: `${base}dagi`, da: `${base}da`, label: region.name };
}

export function resolveLanding(categorySlug: string, regionSlug?: string) {
  const cat = CATEGORY_BY_SLUG[categorySlug];
  const region = regionSlug ? REGION_BY_SLUG[regionSlug] : null;
  if (!cat || (regionSlug && !region)) notFound();
  return { cat, region: region ?? null };
}

function landingPath(cat: Category, region: Region | null) {
  return region ? `/yonalish/${cat.slug}/${region.slug}` : `/yonalish/${cat.slug}`;
}

export async function landingMetadata(cat: Category, region: Region | null): Promise<Metadata> {
  const stats = await getLandingStats(cat.slug, region?.slug).catch(() => null);
  const place = placeForms(region);
  const plural = lowerFirst(cat.plural);
  const title = `${place.dagi} ${plural} — narxlar, reyting va portfolio`;
  const n = stats?.n ?? 0;
  const description =
    n > 0
      ? `${place.dagi} ${n} ta ${lowerFirst(cat.name)}: portfolio, narx${stats?.minPrice ? ` (${formatPrice(stats.minPrice, { compact: true })} dan)` : ""} va haqiqiy mijozlar sharhlari. ${SITE.name} orqali xavfsiz buyurtma bering.`
      : `${place.dagi} ${plural} — ${SITE.name}'da ${cat.description.toLowerCase()} bo'yicha mutaxassislarni toping.`;
  const path = landingPath(cat, region);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} · ${SITE.name}`, description, url: path, images: ["/opengraph-image"], siteName: SITE.name, locale: "uz_UZ" },
    // Bo'sh sahifa (hali mutaxassis yo'q) — indekslanmasin (yupqa kontent)
    ...(n === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export async function LandingPage({ cat, region }: { cat: Category; region: Region | null }) {
  const filter = specialistFilterSchema.parse({ category: cat.slug, region: region?.slug, limit: 12 });
  const [list, stats, index] = await Promise.all([listSpecialists(filter, GUEST_VIEWER), getLandingStats(cat.slug, region?.slug), getLandingIndex()]);

  const place = placeForms(region);
  const plural = lowerFirst(cat.plural);
  const singular = lowerFirst(cat.name);
  const qs = new URLSearchParams({ category: cat.slug, ...(region ? { region: region.slug } : {}) }).toString();
  const listingHref = `/mutaxassislar?${qs}`;
  const mapHref = `/xarita?${qs}`;

  // Ichki havolalar: shu yo'nalish boshqa hududlarda, shu hududda boshqa yo'nalishlar
  const countFor = (c: string, r?: string) => index.filter((x) => x.category === c && (!r || x.region === r)).reduce((a, x) => a + x.n, 0);
  const regionLinks = REGIONS.map((r) => ({ r, n: countFor(cat.slug, r.slug) }));
  const categoryLinks = region ? CATEGORIES.filter((c) => c.slug !== cat.slug).map((c) => ({ c, n: countFor(c.slug, region.slug) })) : [];

  const intro =
    stats.n > 0
      ? `${cat.description}. ${place.label} bo'ylab ${stats.n} ta ${singular} ${SITE.name}'da — portfolio, narx va faqat buyurtmasi qabul qilingan mijozlar qoldirgan sharhlar bilan. To'lov eskrou orqali himoyalangan.`
      : `Hozircha ${place.da} ${plural} ro'yxatdan o'tmagan. Qo'shni hududlarni yoki butun O'zbekiston bo'yicha ro'yxatni ko'ring.`;

  const faq: Array<{ q: string; a: string }> = [
    {
      q: `${place.da} ${singular} xizmati qancha turadi?`,
      a: stats.minPrice
        ? `${SITE.name}'dagi ${plural} narxi ${formatPrice(stats.minPrice, { compact: true })} dan boshlanadi. Yakuniy narx loyiha hajmi, muddat va jihozlarga qarab mutaxassis bilan kelishiladi.`
        : `Narx loyiha hajmi, muddat va jihozlarga qarab mutaxassis bilan kelishiladi. Buyurtmada byudjetingizni ko'rsating — mutaxassis narxni belgilaydi.`,
    },
    {
      q: `Ishonchli ${singular}ni qanday tanlash mumkin?`,
      a: `"Tasdiqlangan" belgisi, portfolio va sharhlarga qarang: sharhni faqat buyurtmasi qabul qilingan mijozlar qoldira oladi. "Top mutaxassis" nishoni reyting ${TOP_RATED_RULE.minRating}+ va kamida ${TOP_RATED_RULE.minReviews} ta sharhga ega profillarga beriladi.`,
    },
    {
      q: "To'lov qanday amalga oshiriladi?",
      a: "Payme, Click yoki karta o'tkazmasi orqali. Pul eskrouda saqlanadi va siz ishni qabul qilganingizdan keyingina mutaxassisga o'tkaziladi.",
    },
    {
      q: "Buyurtma berish uchun nima kerak?",
      a: `Ro'yxatdan o'ting, ${singular} profilida "Buyurtma berish" tugmasini bosing va loyihani qisqacha yozing. Mutaxassis buyurtmani qabul qilib narxni belgilaydi, siz esa to'lovni tasdiqlaysiz.`,
    },
  ];
  // FAQPage strukturaviy ma'lumoti ("<" ekranlanadi — skript ichidan chiqib ketib bo'lmasin)
  const faqJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  }).replace(/</g, "\\u003c");

  const statTiles: Array<{ icon: ReactNode; text: string }> = [{ icon: <CategoryIcon icon={cat.icon} size={14} className="text-fg-3" />, text: `${stats.n} ta mutaxassis` }];
  if (stats.avgRating) statTiles.push({ icon: <Star size={14} className="text-fg-3" />, text: `O'rtacha reyting ${stats.avgRating.toFixed(1)}` });
  if (stats.minPrice) statTiles.push({ icon: <Wallet size={14} className="text-fg-3" />, text: `${formatPrice(stats.minPrice, { compact: true })} dan` });
  if (stats.verified > 0) statTiles.push({ icon: <BadgeCheck size={14} className="text-fg-3" />, text: `${stats.verified} ta tasdiqlangan` });

  return (
    <div className="container-x">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />

      {/* Yo'l */}
      <nav aria-label="Yo'l" className="no-scrollbar mb-6 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-[14px] font-medium text-fg-3">
        <Link href="/mutaxassislar" className="inline-flex min-h-8 shrink-0 items-center transition hover:text-fg">
          Mutaxassislar
        </Link>
        <ChevronRight size={14} aria-hidden className="shrink-0 text-fg-4" />
        {region ? (
          <>
            <Link href={`/yonalish/${cat.slug}`} className="inline-flex min-h-8 shrink-0 items-center transition hover:text-fg">
              {cat.plural}
            </Link>
            <ChevronRight size={14} aria-hidden className="shrink-0 text-fg-4" />
            <span className="min-w-0 truncate text-fg" aria-current="page">
              {region.short}
            </span>
          </>
        ) : (
          <span className="min-w-0 truncate text-fg" aria-current="page">
            {cat.plural}
          </span>
        )}
      </nav>

      <PageHeader
        size="lg"
        eyebrow={`${cat.name} · ${region ? region.name : "O'zbekiston bo'ylab"}`}
        title={
          <>
            {place.dagi} <span className="accent-serif text-accent">{plural}</span>
          </>
        }
        description={intro}
        action={
          <>
            <ButtonLink href={listingHref} variant="accent" size="md">
              Barchasini ko&apos;rish <ArrowRight size={16} />
            </ButtonLink>
            <ButtonLink href={mapHref} variant="outline" size="md">
              <MapIcon size={16} /> Xaritada
            </ButtonLink>
          </>
        }
      />

      {stats.n > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Qisqacha">
          {statTiles.map((t) => (
            <li key={t.text} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-fg-2">
              {t.icon}
              {t.text}
            </li>
          ))}
        </ul>
      )}

      {/* Eng yaxshi 12 ta */}
      <section className="mt-10" aria-labelledby="landing-top">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 id="landing-top" className="font-display text-[22px] font-semibold tracking-tight text-fg sm:text-[26px]">
            Reyting bo&apos;yicha <span className="accent-serif text-accent">eng yaxshilari</span>
          </h2>
          {list.total > list.items.length && (
            <Link href={listingHref} className="inline-flex min-h-9 shrink-0 items-center gap-1 text-[14px] font-semibold text-accent-text hover:underline">
              Yana {list.total - list.items.length} ta <ArrowRight size={14} />
            </Link>
          )}
        </div>
        {list.items.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.items.map((sp, i) => (
              <SpecialistCard key={sp.id} sp={sp} priority={i < 4} showCompare />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Bu yerda hali mutaxassis yo'q"
            description="Boshqa hududlarni ko'ring yoki birinchi bo'lib profil oching."
            action={
              <ButtonLink href={`/yonalish/${cat.slug}`} variant="outline" size="md">
                Butun O&apos;zbekiston bo&apos;ylab
              </ButtonLink>
            }
          />
        )}
      </section>

      {/* Hududlar bo'yicha (shu yo'nalish) */}
      <section className="mt-14" aria-labelledby="landing-regions">
        <h2 id="landing-regions" className="font-display text-[20px] font-semibold tracking-tight text-fg">
          {cat.plural} <span className="accent-serif text-accent">hududlar</span> bo&apos;yicha
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {region && (
            <li>
              <Link href={`/yonalish/${cat.slug}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-semibold text-fg transition hover:border-fg">
                Butun O&apos;zbekiston
              </Link>
            </li>
          )}
          {regionLinks.map(({ r, n }) => {
            const current = region?.slug === r.slug;
            const cls = "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition";
            if (current)
              return (
                <li key={r.slug}>
                  <span aria-current="page" className={`${cls} bg-ink text-ink-fg`}>
                    {r.short} <span className="opacity-70">{n}</span>
                  </span>
                </li>
              );
            return (
              <li key={r.slug}>
                {n > 0 ? (
                  <Link href={`/yonalish/${cat.slug}/${r.slug}`} className={`${cls} border border-line text-fg-2 hover:border-fg hover:text-fg`}>
                    {r.short} <span className="text-fg-4">{n}</span>
                  </Link>
                ) : (
                  <span className={`${cls} border border-dashed border-line text-fg-4`}>{r.short}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Shu hududdagi boshqa yo'nalishlar */}
      {region && (
        <section className="mt-10" aria-labelledby="landing-cats">
          <h2 id="landing-cats" className="font-display text-[20px] font-semibold tracking-tight text-fg">
            {place.dagi} <span className="accent-serif text-accent">boshqa</span> yo&apos;nalishlar
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {categoryLinks.map(({ c, n }) => (
              <li key={c.slug}>
                {n > 0 ? (
                  <Link
                    href={`/yonalish/${c.slug}/${region.slug}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-medium text-fg-2 transition hover:border-fg hover:text-fg"
                  >
                    <CategoryIcon icon={c.icon} size={13} className="text-fg-3" />
                    {c.plural} <span className="text-fg-4">{n}</span>
                  </Link>
                ) : (
                  <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-line px-3.5 text-[13px] font-medium text-fg-4">
                    <CategoryIcon icon={c.icon} size={13} />
                    {c.plural}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ko'p so'raladigan savollar */}
      <section className="mt-14 grid gap-6 lg:grid-cols-12" aria-labelledby="landing-faq">
        <div className="lg:col-span-4">
          <span className="eyebrow">Savollar</span>
          <h2 id="landing-faq" className="mt-3 font-display text-[24px] font-semibold leading-tight tracking-tight text-fg sm:text-[28px]">
            Ko&apos;p so&apos;raladigan <span className="accent-serif text-accent">savollar</span>
          </h2>
        </div>
        <div className="space-y-2.5 lg:col-span-8">
          {faq.map((f, i) => (
            <details key={f.q} className="card group p-0" open={i === 0}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-semibold text-fg [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown size={18} className="shrink-0 text-fg-3 transition group-open:rotate-180" aria-hidden />
              </summary>
              <p className="px-5 pb-5 text-[14px] leading-relaxed text-fg-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
      <CompareTray />
    </div>
  );
}
