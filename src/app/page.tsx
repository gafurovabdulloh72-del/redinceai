import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, ArrowUpRight, MapPinned, MessageSquareText, Play, ShieldCheck } from "lucide-react";
import { UzbekistanMap } from "@/components/map/UzbekistanMap";
import { HomeMapSection } from "@/components/map/HomeMapSection";
import { HomeLentaStrip } from "@/components/lenta/HomeLentaStrip";
import { SpecialistCard } from "@/components/specialists/SpecialistCard";
import { CoverPattern } from "@/components/ui/CoverPattern";
import { Avatar, ButtonLink, SectionHeading } from "@/components/ui";
import { CATEGORIES } from "@/lib/constants";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { HOME } from "@/lib/i18n/dict/home";
import { isProviderConfigured, paymentsEnv } from "@/lib/payments/config";
import { getSettings } from "@/lib/payments/settings";
import { getLentaItems } from "@/lib/lenta";
import { getCategoryStats, getFeaturedSpecialists, getRegionStats, getSiteStats } from "@/lib/queries";
import { cn, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

/*
 * Bosh sahifa — minimalistik: hero → interaktiv xarita → yo'nalishlar → tavsiya etilganlar → uch qadam → CTA.
 * "So'nggi e'lonlar" tasmasi olib tashlandi (sahifa yengillashdi, /ishlar o'z sahifasida) va hero'dagi
 * takroriy ishonch chiplar qisqartirildi. Bo'limlar oralig'i — yagona mt-section.
 */

const STEPS = [
  { icon: MapPinned, title: HOME.steps.s1Title, text: HOME.steps.s1Text },
  { icon: Play, title: HOME.steps.s2Title, text: HOME.steps.s2Text },
  { icon: MessageSquareText, title: HOME.steps.s3Title, text: HOME.steps.s3Text },
] as const;

export default async function HomePage() {
  const til = await getLocale();
  const [regionStats, categoryStats, featured, site, settings, lenta] = await Promise.all([
    getRegionStats(),
    getCategoryStats(),
    getFeaturedSpecialists(4),
    getSiteStats(),
    getSettings(),
    getLentaItems(8),
  ]);
  /* Mutaxassis CTA: obuna shartlari /narxlar bilan bir xil (admin sozlamasidan) */
  const trialDays = settings.subscriptionTrialDays;
  const subPrice = formatPrice(settings.subscriptionPrice);
  const counts = Object.fromEntries(Object.values(regionStats).map((s) => [s.slug, s.total]));
  /* E83: avatar stack — rasm bo'lmasa ham <Avatar> bosh harflarni ko'rsatadi (bo'sh doira yo'q) */
  const stack = featured.slice(0, 3);
  /* Hali birorta sharh yo'q bo'lsa "reytingli" deb va'da qilmaymiz — "yangi qo'shilgan" deb ko'rsatamiz */
  const hasRated = featured.some((sp) => sp.reviewCount > 0);
  /* Eskrou va'dasi faqat onlayn to'lov (Payme/Click) real sozlanganda ko'rsatiladi */
  const payEnv = paymentsEnv();
  const escrowReady = (await isProviderConfigured("payme", payEnv)) || (await isProviderConfigured("click", payEnv));

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="container-x">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-6">
            {/* Ustki yorliq — chiziq bilan (editorial) */}
            <div className="flex items-center gap-4">
              <span className="eyebrow !m-0 shrink-0">{tr(til, HOME.hero.eyebrow)}</span>
              <span className="hidden h-px flex-1 bg-line sm:block" aria-hidden="true" />
            </div>
            <h1 className="display-xl mt-7 text-[44px] text-fg min-[420px]:text-[50px] sm:text-[64px] lg:text-[66px] xl:text-[82px]">
              {tr(til, HOME.hero.titleA)}
              <br />
              <span className="accent-serif text-accent">{tr(til, HOME.hero.titleAccent)}</span>
              {tr(til, HOME.hero.titleB)}
            </h1>
            <p className="mt-7 max-w-md text-[16px] leading-relaxed text-fg-2 sm:text-[18px]">{tr(til, HOME.hero.lead)}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/xarita" variant="accent" size="lg" className="sm:min-w-[210px]">
                <MapPinned size={20} /> {tr(til, HOME.hero.openMap)}
              </ButtonLink>
              <ButtonLink href="/mutaxassislar" variant="outline" size="lg">
                {tr(til, HOME.hero.specialistsList)} <ArrowRight size={16} />
              </ButtonLink>
            </div>

            {/* Ishonch bari — ustki nozik chiziq bilan ajratilgan (editorial "stat bar") */}
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-line pt-6 sm:gap-x-8">
              {stack.length >= 3 && (
                <div className="hidden -space-x-2 sm:flex" aria-hidden="true">
                  {stack.map((sp) => (
                    <Avatar key={sp.id} name={sp.user.name} src={sp.user.avatarUrl} size={34} decorative singleInitial className="!ring-bg" />
                  ))}
                </div>
              )}
              <div className="flex items-baseline gap-2">
                {/* 10 tadan kam bo'lsa "+" yolg'on taassurot beradi — aniq sonni ko'rsatamiz */}
                <span className="font-display text-[26px] font-semibold leading-none text-fg tabular-nums">{site.specialists >= 10 ? `${site.specialists}+` : site.specialists}</span>
                <span className="text-[13px] leading-tight text-fg-3">{HOME.hero.statSpecialists[til](site.specialists)}</span>
              </div>
              <span className="h-8 w-px bg-line" aria-hidden="true" />
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[26px] font-semibold leading-none text-fg tabular-nums">{site.regions}</span>
                <span className="text-[13px] leading-tight text-fg-3">{HOME.hero.statRegions[til](site.regions)}</span>
              </div>
            </div>
          </div>

          {/* Xarita — matn bloki bilan vertikal markazda */}
          <div className="relative flex flex-col justify-center self-center lg:col-span-6">
            {/* Och fonda qizil nur tuman bo'lib ko'rinmasin — kunduzgi rejimda ancha yumshoq */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[70%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/8 blur-[90px] dark:bg-accent/20" />
            <UzbekistanMap counts={counts} variant="hero" linkTo="mutaxassislar" showLabels={false} className="w-full py-2 lg:-mr-4 lg:w-[110%] lg:max-w-none" />
            {/* Legenda + ishora — xaritaga biriktirilgan bitta qator */}
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 sm:px-2">
              <span className="card inline-flex h-8 items-center gap-2 !rounded-full px-3 text-[11.5px] font-semibold text-fg-2">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-70 animate-pulse-ring" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                {tr(til, HOME.hero.interactiveHint)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-3">
                {tr(til, HOME.hero.legendLess)}
                <span className="map-legend-ramp h-2 w-20 rounded-full" aria-hidden="true" />
                {tr(til, HOME.hero.legendMore)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= INTERAKTIV XARITA ================= */}
      <section id="xarita" className="container-x mt-section scroll-mt-24">
        <SectionHeading
          eyebrow={tr(til, HOME.mapSection.eyebrow)}
          title={
            <>
              {tr(til, HOME.mapSection.titleA)}
              <span className="accent-serif text-accent">{tr(til, HOME.mapSection.titleAccent)}</span>
              {tr(til, HOME.mapSection.titleB)}
            </>
          }
          description={tr(til, HOME.mapSection.description)}
        />
        {/* useSearchParams (tanlov URL'da) — Suspense chegarasi ichida */}
        <Suspense fallback={<HomeMapFallback />}>
          <HomeMapSection stats={regionStats} total={site.specialists} />
        </Suspense>
      </section>

      {/* ================= YO'NALISHLAR — har biri o'z naqshi + ikonka plitkasi + son ================= */}
      <section className="container-x mt-section">
        <SectionHeading
          eyebrow={tr(til, HOME.categories.eyebrow)}
          title={tr(til, HOME.categories.title)}
          description={tr(til, HOME.categories.description)}
          action={
            <ButtonLink href="/mutaxassislar" variant="outline" size="sm">
              {tr(til, HOME.categories.all)} <ArrowRight size={16} />
            </ButtonLink>
          }
        />
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {CATEGORIES.map((c) => {
            const n = categoryStats[c.slug] ?? 0;
            const regionsWith = Object.values(regionStats).filter((r) => (r.byCategory[c.slug] ?? 0) > 0).length;
            return (
              <li key={c.slug}>
                <Link href={`/yonalish/${c.slug}`} className="card card-hover group flex h-full flex-col overflow-hidden">
                  <span className="relative block h-20 sm:h-24">
                    <CoverPattern category={c.slug} iconSize={20} className="transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                  </span>
                  <span className="flex flex-1 flex-col p-4 sm:p-5">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block font-display text-[15px] font-semibold leading-tight text-fg sm:text-[17px]">{c.name}</span>
                        <span className="mt-1 line-clamp-2 block text-[12.5px] leading-snug text-fg-3">{c.description}</span>
                      </span>
                      <span className="hover-reveal hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-fg-3 transition sm:flex">
                        <ArrowUpRight size={16} />
                      </span>
                    </span>
                    {/* Bo'sh yo'nalish: "0 mutaxassis · 0 hudud" o'rniga taklif */}
                    {n > 0 ? (
                      <span className="mt-auto flex items-baseline gap-1.5 pt-4">
                        <span className="font-display text-[22px] font-semibold leading-none text-fg tabular-nums">{n}</span>
                        <span className="text-[12px] font-medium text-fg-3">{HOME.categories.countLine[til](n, regionsWith)}</span>
                      </span>
                    ) : (
                      <span className="mt-auto flex items-center pt-4 text-[13px] font-semibold text-accent-text">{tr(til, HOME.categories.beFirst)}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ================= ISHLAR LENTASI — video ishlar tasmasi (video bo'lmasa umuman chiqmaydi) ================= */}
      {lenta.items.length > 0 && (
        <section className="container-x mt-section">
          <SectionHeading
            eyebrow={tr(til, HOME.lenta.eyebrow)}
            title={
              <>
                {tr(til, HOME.lenta.titleA)}
                <span className="accent-serif text-accent">{tr(til, HOME.lenta.titleAccent)}</span>
                {tr(til, HOME.lenta.titleB)}
              </>
            }
            description={tr(til, HOME.lenta.description)}
            action={
              <ButtonLink href="/lenta" variant="outline" size="sm">
                {tr(til, HOME.lenta.all)} <ArrowRight size={16} />
              </ButtonLink>
            }
          />
          <HomeLentaStrip items={lenta.items} />
        </section>
      )}

      {/* ================= TAVSIYA ETILGANLAR ================= */}
      <section className="container-x mt-section">
        <SectionHeading
          eyebrow={tr(til, HOME.featured.eyebrow)}
          title={
            hasRated ? (
              <>
                {tr(til, HOME.featured.ratedA)}
                <span className="accent-serif text-accent">{tr(til, HOME.featured.ratedAccent)}</span>
                {tr(til, HOME.featured.ratedB)}
              </>
            ) : (
              <>
                {tr(til, HOME.featured.newA)}
                <span className="accent-serif text-accent">{tr(til, HOME.featured.newAccent)}</span>
                {tr(til, HOME.featured.newB)}
              </>
            )
          }
          description={tr(til, hasRated ? HOME.featured.ratedDescription : HOME.featured.newDescription)}
          action={
            <ButtonLink href="/mutaxassislar?sort=rating" variant="outline" size="sm">
              {tr(til, HOME.featured.viewAll)} <ArrowRight size={16} />
            </ButtonLink>
          }
        />
        {/* Bitta qator: telefonda 3, planshetda 2×2, desktopda 3 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.slice(0, 4).map((sp, i) => (
            <div key={sp.id} className={cn("min-w-0", i === 3 && "hidden sm:block lg:hidden")}>
              <SpecialistCard sp={sp} priority={i < 3} />
            </div>
          ))}
        </div>
      </section>

      {/* ================= QANDAY ISHLAYDI — raqamli plitkalar + bog'lovchi chiziq ================= */}
      <section className="container-x mt-section">
        <SectionHeading eyebrow={tr(til, HOME.steps.eyebrow)} title={tr(til, HOME.steps.title)} />
        <div className="card relative overflow-hidden p-6 sm:p-8">
          <ol className="relative grid gap-9 md:grid-cols-3 md:gap-10">
            {/* Bog'lovchi chiziq: telefonda vertikal (plitkalar markazidan), md+ da gorizontal (1- va 3-plitka markazlari orasida) */}
            <span aria-hidden="true" className="absolute bottom-12 left-[22px] top-12 border-l-2 border-dashed border-accent/35 md:hidden" />
            <span
              aria-hidden="true"
              className="absolute left-[22px] right-[calc((100%-5rem)/3-22px)] top-[22px] hidden border-t-2 border-dashed border-accent/35 md:block"
            />
            {STEPS.map((s, i) => (
              <li key={s.title.uz} className="relative flex gap-4 md:flex-col md:gap-0">
                <span className="icon-tile step-tile relative z-[1] shadow-[0_0_0_8px_var(--surface)]" data-step={i + 1}>
                  <s.icon size={20} />
                </span>
                <span className="min-w-0 md:mt-6">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-accent-text">{HOME.steps.stepN[til](i + 1)}</span>
                  <h3 className="mt-1.5 font-display text-[20px] font-semibold leading-tight text-fg sm:text-[22px]">{tr(til, s.title)}</h3>
                  <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-fg-2">{tr(til, s.text)}</p>
                </span>
              </li>
            ))}
          </ol>
          <p className="relative mt-7 flex items-center gap-2 border-t border-line pt-5 text-[13px] text-fg-2">
            <ShieldCheck size={16} className="shrink-0 text-accent" />
            {/* Payme/Click sozlanmagan bo'lsa eskrou va'dasi berilmaydi — yumshoqroq matn */}
            {tr(til, escrowReady ? HOME.steps.escrowOn : HOME.steps.escrowOff)}
          </p>
        </div>
      </section>

      {/* ================= CTA (ikkala rejimda ham qorong'u; Noir'da inversiya yo'q — faqat nozik chegara) ================= */}
      <section className="container-x mt-section">
        <div className="cta-dark grain relative overflow-hidden rounded-card-lg border border-white/10 bg-[#121213] px-6 py-12 text-white sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/40 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-accent-2/35 blur-[110px]" />
          <div className="relative grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <span className="eyebrow !text-white/60">{tr(til, HOME.cta.eyebrow)}</span>
              <h2 className="display-xl mt-5 text-[34px] text-white sm:text-[48px] lg:text-[56px]">
                {tr(til, HOME.cta.titleA)}
                <span className="accent-serif text-accent">{tr(til, HOME.cta.titleAccent)}</span>
                {tr(til, HOME.cta.titleB)}
              </h2>
              <p className="mt-5 max-w-xl text-[15px] text-white/70 sm:text-[17px]">
                {HOME.cta.subscription[til](trialDays, subPrice)} {tr(til, HOME.cta.rest)}{" "}
                <Link href="/narxlar" className="font-semibold text-white underline decoration-white/40 underline-offset-4 transition hover:decoration-white">
                  {tr(til, HOME.cta.pricesLink)}
                </Link>
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
              <ButtonLink href="/auth/royxat?role=specialist" variant="accent" size="lg" className="w-full sm:w-auto">
                {tr(til, HOME.cta.joinSpecialist)} <ArrowRight size={20} />
              </ButtonLink>
              <Link
                href="/auth/royxat"
                className="inline-flex h-13 w-full items-center justify-center rounded-full border border-white/35 bg-white/5 px-7 text-[15px] font-semibold text-white transition hover:border-white hover:bg-white/10 sm:w-auto"
              >
                {tr(til, HOME.cta.startClient)}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** HomeMapSection yuklanguncha (Suspense) — xuddi shu o'lchamdagi tinch skelet */
function HomeMapFallback() {
  return (
    <div className="grid gap-5 lg:grid-cols-12" aria-hidden="true">
      <div className="card p-5 lg:col-span-8">
        <span className="skeleton block h-4 w-48" />
        <span className="skeleton mt-4 block aspect-[1048/728] w-full !rounded-card" />
      </div>
      <div className="card-elevated p-5 lg:col-span-4">
        <span className="skeleton block h-11 w-11" />
        <span className="skeleton mt-4 block h-4 w-2/3" />
        <span className="skeleton mt-6 block h-40 w-full" />
      </div>
    </div>
  );
}
