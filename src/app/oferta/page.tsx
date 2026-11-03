import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, type LegalSection } from "@/components/auth/LegalDocument";
import { SITE, SUBSCRIPTION_PLANS, TERMS_VERSION } from "@/lib/constants";
import { tr } from "@/lib/i18n";
import { LEGAL_SHELL, OFERTA, legalDate } from "@/lib/i18n/dict/legal";
import { getLocale } from "@/lib/i18n/server";
import { AUTO_RELEASE_DAYS } from "@/lib/payments/service";
import { getSettings } from "@/lib/payments/settings";
import { planPrice } from "@/lib/subscriptions/access";
import { formatPrice } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return {
    title: tr(til, OFERTA.metaTitle),
    description: tr(til, OFERTA.metaDescription),
    alternates: { canonical: "/oferta" },
  };
}

/** Narxlar admin sozlamalaridan olinadi — soatiga bir marta yangilanadi */
export const revalidate = 3600;

export default async function OfertaPage() {
  const til = await getLocale();
  const t = (e: { uz: string; ru: string }) => tr(til, e);
  const s = await getSettings();
  const price = formatPrice(s.subscriptionPrice);
  const trial = s.subscriptionTrialDays;
  const grace = s.subscriptionGraceDays;

  const sections: LegalSection[] = [
    {
      id: "umumiy",
      title: t(OFERTA.umumiyTitle),
      body: (
        <>
          <p>{OFERTA.umumiyP1[til](SITE.name)}</p>
          <p>{t(OFERTA.umumiyP2)}</p>
          <p>
            {t(OFERTA.umumiyP3a)}
            <Link href="/maxfiylik" className="font-semibold text-accent-text underline underline-offset-2">
              {t(OFERTA.umumiyP3link)}
            </Link>
            {t(OFERTA.umumiyP3b)}
          </p>
        </>
      ),
    },
    {
      id: "atamalar",
      title: t(OFERTA.atamalarTitle),
      body: (
        <ul>
          <li>
            <strong>{t(OFERTA.termUser)}</strong>
            {t(OFERTA.termUserDesc)}
          </li>
          <li>
            <strong>{t(OFERTA.termClient)}</strong>
            {t(OFERTA.termClientDesc)}
          </li>
          <li>
            <strong>{t(OFERTA.termSpecialist)}</strong>
            {t(OFERTA.termSpecialistDesc)}
          </li>
          <li>
            <strong>{t(OFERTA.termOrder)}</strong>
            {t(OFERTA.termOrderDesc)}
          </li>
          <li>
            <strong>{t(OFERTA.termJob)}</strong>
            {t(OFERTA.termJobDesc)}
            <strong>{t(OFERTA.termProposal)}</strong>
            {t(OFERTA.termProposalDesc)}
          </li>
          <li>
            <strong>{t(OFERTA.termEscrow)}</strong>
            {t(OFERTA.termEscrowDesc)}
          </li>
          <li>
            <strong>{t(OFERTA.termSubscription)}</strong>
            {t(OFERTA.termSubscriptionDesc)}
          </li>
        </ul>
      ),
    },
    {
      id: "platforma-roli",
      title: t(OFERTA.roliTitle),
      body: (
        <>
          <p>{t(OFERTA.roliP1)}</p>
          <ul>
            <li>{t(OFERTA.roliL1)}</li>
            <li>{t(OFERTA.roliL2)}</li>
            <li>{t(OFERTA.roliL3)}</li>
          </ul>
        </>
      ),
    },
    {
      id: "hisob",
      title: t(OFERTA.hisobTitle),
      body: (
        <>
          <ul>
            <li>{t(OFERTA.hisobL1)}</li>
            <li>{t(OFERTA.hisobL2)}</li>
            <li>{t(OFERTA.hisobL3)}</li>
            <li>{t(OFERTA.hisobL4)}</li>
          </ul>
        </>
      ),
    },
    {
      id: "obuna",
      title: t(OFERTA.obunaTitle),
      body: (
        <>
          <p>
            {t(OFERTA.obunaP1)}
            <strong>{t(OFERTA.obunaP1strong)}</strong>
          </p>
          <ul>
            <li>
              {t(OFERTA.tariffs)}
              <strong>{t(OFERTA.tariffStandard)}</strong>
              {t(OFERTA.tariffStandardDesc)}
              <strong>Pro</strong>
              {OFERTA.tariffPro[til](price)}
              <strong>Max</strong>
              {OFERTA.tariffMax[til](formatPrice(s.subscriptionPriceMax))}
              {t(OFERTA.tariffLimits)}
              <a href="/narxlar">{t(OFERTA.tariffPricesLink)}</a>
              {t(OFERTA.tariffDiscount)}
              {SUBSCRIPTION_PLANS.map((p, i) => (
                <span key={p.months}>
                  {i > 0 ? ", " : ""}
                  {OFERTA.planMonths[til](p.months, formatPrice(planPrice(p.months, s)))}
                  {p.discountPct ? ` (−${p.discountPct}%)` : ""}
                </span>
              ))}
              .
            </li>
            {trial > 0 && (
              <li>
                {t(OFERTA.trialBefore)}
                <strong>{OFERTA.trialStrong[til](trial)}</strong>
                {t(OFERTA.trialAfter)}
              </li>
            )}
            <li>{OFERTA.grace[til](grace)}</li>
            <li>{t(OFERTA.afterGrace)}</li>
            <li>{t(OFERTA.payMethods)}</li>
            <li>{t(OFERTA.renewal)}</li>
            <li>{t(OFERTA.noRefund)}</li>
          </ul>
        </>
      ),
    },
    {
      id: "eskrou",
      title: t(OFERTA.eskrouTitle),
      body: (
        <>
          <ol>
            <li>{OFERTA.eskrouS1[til](formatPrice(s.minOrderAmount))}</li>
            <li>{t(OFERTA.eskrouS2)}</li>
            <li>{t(OFERTA.eskrouS3)}</li>
            <li>{OFERTA.eskrouS4[til](AUTO_RELEASE_DAYS)}</li>
          </ol>
          <p>{OFERTA.commission[til](s.commissionPctNew, s.commissionPct, s.commissionPctTop, s.urgentPct)}</p>
          <p>{OFERTA.payout[til](formatPrice(s.minPayout))}</p>
        </>
      ),
    },
    {
      id: "qaytarish",
      title: t(OFERTA.qaytarishTitle),
      body: (
        <>
          <ul>
            <li>{t(OFERTA.qaytarishL1)}</li>
            <li>{t(OFERTA.qaytarishL2)}</li>
            <li>{t(OFERTA.qaytarishL3)}</li>
            <li>{t(OFERTA.qaytarishL4)}</li>
            <li>{t(OFERTA.qaytarishL5)}</li>
          </ul>
        </>
      ),
    },
    {
      id: "taqiqlar",
      title: t(OFERTA.taqiqlarTitle),
      body: (
        <ul>
          <li>{t(OFERTA.taqiqL1)}</li>
          <li>{t(OFERTA.taqiqL2)}</li>
          <li>{t(OFERTA.taqiqL3)}</li>
          <li>{t(OFERTA.taqiqL4)}</li>
          <li>{t(OFERTA.taqiqL5)}</li>
          <li>{t(OFERTA.taqiqL6)}</li>
          <li>{t(OFERTA.taqiqL7)}</li>
        </ul>
      ),
    },
    {
      id: "kontent",
      title: t(OFERTA.kontentTitle),
      body: (
        <>
          <p>{t(OFERTA.kontentP1)}</p>
          <p>{t(OFERTA.kontentP2)}</p>
        </>
      ),
    },
    {
      id: "javobgarlik",
      title: t(OFERTA.javobgarlikTitle),
      body: (
        <ul>
          <li>{t(OFERTA.javobL1)}</li>
          <li>{t(OFERTA.javobL2)}</li>
          <li>{t(OFERTA.javobL3)}</li>
          <li>{t(OFERTA.javobL4)}</li>
        </ul>
      ),
    },
    {
      id: "bloklash",
      title: t(OFERTA.bloklashTitle),
      body: (
        <>
          <p>{t(OFERTA.bloklashP1)}</p>
          <p>{t(OFERTA.bloklashP2)}</p>
        </>
      ),
    },
    {
      id: "ozgarishlar",
      title: t(OFERTA.ozgarishlarTitle),
      body: (
        <p>
          {t(OFERTA.ozgarishlarP1)}
          <strong>{TERMS_VERSION}</strong>.
        </p>
      ),
    },
    {
      id: "aloqa",
      title: t(OFERTA.aloqaTitle),
      body: (
        <>
          <p>{t(OFERTA.aloqaP1)}</p>
          <p>
            {t(OFERTA.aloqaP2a)}
            <a href="https://t.me/kasb_egalari" target="_blank" rel="noreferrer noopener" className="font-semibold text-accent-text underline underline-offset-2">
              @kasb_egalari
            </a>
            {t(OFERTA.aloqaP2b)}
          </p>
        </>
      ),
    },
  ];

  return (
    <LegalDocument
      eyebrow={t(LEGAL_SHELL.eyebrow)}
      title={t(OFERTA.title)}
      accent={t(OFERTA.accent)}
      version={TERMS_VERSION}
      effectiveDate={legalDate(TERMS_VERSION, til)}
      related={{ href: "/maxfiylik", label: t(LEGAL_SHELL.privacyLabel) }}
      labels={{ version: t(LEGAL_SHELL.version), effective: t(LEGAL_SHELL.effective), toc: t(LEGAL_SHELL.toc) }}
      intro={<p>{OFERTA.intro[til](SITE.name, price, formatPrice(s.subscriptionPriceMax))}</p>}
      sections={sections}
    />
  );
}
