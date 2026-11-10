import type { Metadata } from "next";
import { SHELL } from "@/lib/i18n/dict/shell";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { UsdHint } from "@/components/subscription/UsdHint";
import { SITE } from "@/lib/constants";
import { PlanCompare } from "@/components/subscription/PlanCompare";
import { PlanCards } from "@/components/subscription/PlanCards";
import { tr } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { localizePrice } from "@/lib/i18n/dict/catalog";
import { NARX } from "@/lib/i18n/dict/narxlar";
import { getSettings, NEW_TIER_MAX_COMPLETED, TOP_RATED_MIN_RATING, TOP_RATED_MIN_REVIEWS } from "@/lib/payments/settings";
import { plansFor } from "@/lib/subscriptions/billing";
import { cn, formatPrice } from "@/lib/utils";

import { jsonLdHtml } from "@/lib/seo/json-ld";
/** Narxlar admin sozlamalaridan olinadi — 10 daqiqada bir yangilanadi */
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const [s, til] = await Promise.all([getSettings(), getLocale()]);
  const price = formatPrice(s.subscriptionPrice);
  return {
    title: "Narxlar",
    other: { "m-title": tr(til, SHELL.nav.prices) },
    description: `${SITE.name} narxlari: mijozlar uchun bepul — buyurtma, e'lon va eskrou himoyasi. Mutaxassislar uchun obuna ${price} / oy${s.subscriptionTrialDays > 0 ? `, birinchi ${s.subscriptionTrialDays} kun bepul` : ""}. Uzoq muddatga chegirmalar va eskrou komissiyasi.`,
    alternates: { canonical: "/narxlar" },
    openGraph: {
      title: `Narxlar · ${SITE.name}`,
      description: `Mijozlar uchun bepul. Mutaxassislar uchun ${price} / oy.`,
      images: ["/opengraph-image"],
      siteName: SITE.name,
      locale: "uz_UZ",
    },
  };
}

export default async function PricingPage() {
  const til = await getLocale();
  const s = await getSettings();
  const plans = plansFor(s);
  const maxPlans = plansFor(s, "max");
  const price = formatPrice(s.subscriptionPrice);
  const priceUi = localizePrice(til, price);
  const trial = s.subscriptionTrialDays;
  const grace = s.subscriptionGraceDays;

  const tiers: Array<{ name: string; pct: number; rule: string; emphasis?: boolean }> = [
    { name: tr(til, NARX.tiers.newSpec.name), pct: s.commissionPctNew, rule: NARX.tiers.newSpec.rule[til](NEW_TIER_MAX_COMPLETED) },
    { name: tr(til, NARX.tiers.regular.name), pct: s.commissionPct, rule: NARX.tiers.regular.rule[til](NEW_TIER_MAX_COMPLETED) },
    { name: tr(til, NARX.tiers.top.name), pct: s.commissionPctTop, rule: NARX.tiers.top.rule[til](TOP_RATED_MIN_RATING, TOP_RATED_MIN_REVIEWS), emphasis: true },
  ];

  /** FAQ bitta joydan ikki til uchun tuziladi: UI — joriy til, JSON-LD (SEO) — doim uz */
  const buildFaq = (t: "uz" | "ru"): Array<{ q: string; a: string }> => [
    { q: tr(t, NARX.faq.whySubQ), a: NARX.faq.whySubA[t](SITE.name) },
    { q: tr(t, NARX.faq.expireQ), a: NARX.faq.expireA[t](grace) },
    { q: tr(t, NARX.faq.payQ), a: tr(t, NARX.faq.payA) },
    { q: tr(t, NARX.faq.refundQ), a: tr(t, NARX.faq.refundA) },
    { q: tr(t, NARX.faq.trialQ), a: NARX.faq.trialA[t](trial) },
    { q: tr(t, NARX.faq.clientsPayQ), a: tr(t, NARX.faq.clientsPayA) },
  ];
  const faq = buildFaq(til);
  // JSON-LD (SEO) o'zgarmaydi — uz matnlardan
  const faqJsonLd = jsonLdHtml({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: buildFaq("uz").map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  });

  return (
    <div className="container-x animate-fade-up">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />

      {/* ---------- Sarlavha ---------- */}
      <header className="mx-auto max-w-3xl text-center">
        <span className="eyebrow justify-center max-sm:hidden">{tr(til, NARX.eyebrow)}</span>
        <h1 className="display-xl mt-5 text-[34px] text-fg sm:text-[48px] lg:text-[56px]">
          {tr(til, NARX.titleStart)} <span className="accent-serif text-accent">{tr(til, NARX.titleAccent)}</span> {tr(til, NARX.titleEnd)}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-fg-2 sm:text-[17px]">{NARX.intro[til](SITE.name)}</p>
      </header>

      {/* ---------- Tarif kartalari (Oddiy · Pro · Pro yillik) ---------- */}
      <section aria-label={tr(til, NARX.plansAria)} className="mx-auto mt-10 max-w-6xl">
        <PlanCards til={til} proPrice={s.subscriptionPrice} maxPrice={s.subscriptionPriceMax} trialDays={trial} />
        <p className="mt-3 text-center text-[12.5px] text-fg-3">
          <UsdHint amount={s.subscriptionPrice} usdRate={s.usdRate} til={til} />
        </p>
      </section>

      {/* ---------- Mijozlar uchun — ixcham qator ---------- */}
      <section aria-label={tr(til, NARX.clients)} className="card mx-auto mt-6 flex max-w-6xl flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[17px] font-semibold text-fg">
            {tr(til, NARX.clients)} — <span className="text-accent-text">{tr(til, NARX.free)}</span>
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
            {NARX.clientBullets[til].slice(0, 4).map((b) => (
              <li key={b} className="flex items-center gap-1.5 text-[13px] text-fg-2">
                <Check size={13} className="shrink-0 text-success-text" aria-hidden />
                {b}
              </li>
            ))}
          </ul>
        </div>
        <ButtonLink href="/mutaxassislar" variant="outline" size="md" className="shrink-0">
          {tr(til, NARX.findSpecialist)} <ArrowRight size={15} />
        </ButtonLink>
      </section>

      {/* ---------- Batafsil taqqoslash (yig'ilgan) ---------- */}
      <details className="group mx-auto mt-10 max-w-6xl">
        <summary className="flex cursor-pointer list-none items-center justify-center gap-2 text-[14px] font-semibold text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
          {tr(til, NARX.compareTitle)}
          <span className="text-fg-4 transition-transform group-open:rotate-180" aria-hidden>▾</span>
        </summary>
        <div className="expand-in mt-5 max-sm:-mx-4">
          <PlanCompare til={til} trialDays={trial} proPrice={`${priceUi} ${tr(til, NARX.perMonth)}`} maxPrice={`${localizePrice(til, formatPrice(s.subscriptionPriceMax))} ${tr(til, NARX.perMonth)}`} />
        </div>
      </details>

      {/* ---------- Rejalar jadvali ---------- */}
      <section aria-labelledby="plans-title" className="mx-auto mt-14 max-w-5xl">
        <div className="mb-5 max-w-2xl">
          <h2 id="plans-title" className="font-display text-[24px] font-semibold text-fg sm:text-[28px]">
            {tr(til, NARX.plansTitle)}
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">{tr(til, NARX.plansDesc)}</p>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-left text-[14px]">
            <caption className="sr-only">{tr(til, NARX.tableCaption)}</caption>
            <thead className="border-b border-line bg-surface-2 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">
              <tr>
                <th scope="col" className="px-4 py-3 sm:px-6">
                  {tr(til, NARX.colDuration)}
                </th>
                <th scope="col" className="px-2 py-3 text-right sm:px-6">
                  Pro · {tr(til, NARX.colTotal)}
                </th>
                <th scope="col" className="px-4 py-3 text-right sm:px-6">
                  Max · {tr(til, NARX.colTotal)}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {plans.map((p) => (
                <tr key={p.months}>
                  <th scope="row" className="px-4 py-3.5 font-semibold text-fg sm:px-6">
                    <span className="flex flex-wrap items-center gap-2">
                      {NARX.months[til](p.months)}
                      {p.discountPct > 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-text">−{p.discountPct}%</span>}
                    </span>
                  </th>
                  <td className="px-2 py-3.5 text-right sm:px-6">
                    <span className="block whitespace-nowrap font-semibold text-fg tabular-nums">{localizePrice(til, formatPrice(p.price))}</span>
                    {p.savings > 0 && <span className="block whitespace-nowrap text-[12px] text-success-text">{NARX.savings[til](formatPrice(p.savings))}</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right sm:px-6">
                    {(() => {
                      const m = maxPlans.find((x) => x.months === p.months);
                      return m ? (
                        <>
                          <span className="block whitespace-nowrap font-semibold text-fg tabular-nums">{localizePrice(til, formatPrice(m.price))}</span>
                          {m.savings > 0 && <span className="block whitespace-nowrap text-[12px] text-success-text">{NARX.savings[til](formatPrice(m.savings))}</span>}
                        </>
                      ) : null;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- Eskrou komissiyasi ---------- */}
      <section aria-labelledby="commission-title" className="mx-auto mt-14 max-w-5xl">
        <div className="mb-5 max-w-2xl">
          <span className="eyebrow">{tr(til, NARX.escrowEyebrow)}</span>
          <h2 id="commission-title" className="mt-4 font-display text-[24px] font-semibold text-fg sm:text-[28px]">
            {tr(til, NARX.commissionTitle)}
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">{tr(til, NARX.commissionDesc)}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {tiers.map((t) => (
            <div key={t.name} className={cn("card flex items-center gap-4 p-4 sm:block sm:p-5", t.emphasis && "border-fg")}>
              <p className="w-[88px] shrink-0 font-display text-[30px] font-semibold leading-none tracking-tight text-fg tabular-nums sm:w-auto sm:text-[34px]">{t.pct}%</p>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-fg sm:mt-2">{t.name}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-fg-3">{t.rule}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Boshqa to'lovlar jadvali (kamchilik #58) ---------- */}
      <section aria-labelledby="fees-title" className="mx-auto mt-10 max-w-5xl">
        <h2 id="fees-title" className="font-display text-[20px] font-semibold text-fg">
          {til === "ru" ? "Прочие комиссии и цены" : "Boshqa komissiya va narxlar"}
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-[13.5px]">
            <tbody className="divide-y divide-line">
              <tr>
                <td className="py-2.5 pr-4 font-semibold text-fg">{til === "ru" ? "Курсы и консультации (менторство)" : "Kurs va konsultatsiyalar (mentorlik)"}</td>
                <td className="py-2.5 text-fg-2">{til === "ru" ? "Комиссия платформы" : "Platforma komissiyasi"} — 15% · {til === "ru" ? "выплата через 7 дней" : "daromad 7 kundan keyin yechiladi"}</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-semibold text-fg">{til === "ru" ? "Открытие контакта специалиста" : "Mutaxassis kontaktini ochish"}</td>
                <td className="py-2.5 text-fg-2">{formatPrice(s.contactPriceJunior)} — {formatPrice(s.contactPriceExpert)} ({til === "ru" ? "по уровню специалиста, разово" : "darajaga qarab, bir martalik"})</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-semibold text-fg">{til === "ru" ? "Вакансии, резюме, сообщества" : "Vakansiyalar, rezyumelar, jamoalar"}</td>
                <td className="py-2.5 text-fg-2">{til === "ru" ? "Бесплатно" : "Bepul"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- Savollar ---------- */}
      <section aria-labelledby="faq-title" className="mx-auto mt-14 max-w-3xl">
        <span className="eyebrow">{tr(til, NARX.faqEyebrow)}</span>
        <h2 id="faq-title" className="mt-4 font-display text-[24px] font-semibold text-fg sm:text-[28px]">
          {tr(til, NARX.faqTitle)}
        </h2>
        <div className="mt-5 divide-y divide-line rounded-[var(--r-md)] border border-line bg-surface">
          {faq.map((f, i) => (
            <details key={f.q} className="group px-4 sm:px-6" open={i === 0}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 text-[15px] font-semibold text-fg [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fg/6 text-fg-2 transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="accordion-body pb-4 text-[14px] leading-relaxed text-fg-2">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-fg-3">
          {tr(til, NARX.termsNote)}{" "}
          <Link href="/oferta#obuna" className="font-semibold text-accent-text underline underline-offset-2">
            {tr(til, NARX.termsLink)}
          </Link>
          .
        </p>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto mt-14 max-w-5xl">
        <div className="card flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-xl">
            <h2 className="font-display text-[22px] font-semibold text-fg sm:text-[26px]">{tr(til, NARX.ctaTitle)}</h2>
            <p className="mt-1.5 text-[14px] text-fg-2">{trial > 0 ? NARX.ctaTrial[til](trial, price) : NARX.ctaNoTrial[til](price)}</p>
          </div>
          <ButtonLink href="/auth/royxat?role=specialist" variant="accent" size="lg" className="w-full shrink-0 sm:w-auto">
            {tr(til, NARX.startAsSpecialist)} <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
