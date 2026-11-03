import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, type LegalSection } from "@/components/auth/LegalDocument";
import { SITE, TERMS_VERSION, VISIBILITY_FIELDS, VISIBILITY_LEVELS } from "@/lib/constants";
import { tr } from "@/lib/i18n";
import { LEGAL_SHELL, MAXFIYLIK, VISIBILITY_FIELD_TR, VISIBILITY_LEVEL_TR, legalDate } from "@/lib/i18n/dict/legal";
import { getLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return {
    title: tr(til, MAXFIYLIK.metaTitle),
    description: tr(til, MAXFIYLIK.metaDescription),
    alternates: { canonical: "/maxfiylik" },
  };
}

const LINK = "font-semibold text-accent-text underline underline-offset-2";

export default async function MaxfiylikPage() {
  const til = await getLocale();
  const t = (e: { uz: string; ru: string }) => tr(til, e);
  const levelLabel = (value: string, fallback: string) => (VISIBILITY_LEVEL_TR[value] ? t(VISIBILITY_LEVEL_TR[value].label) : fallback);
  const levelDesc = (value: string, fallback: string) => (VISIBILITY_LEVEL_TR[value] ? t(VISIBILITY_LEVEL_TR[value].description) : fallback);
  const fieldLabel = (key: string, fallback: string) => (VISIBILITY_FIELD_TR[key] ? t(VISIBILITY_FIELD_TR[key]) : fallback);

  const sections: LegalSection[] = [
    {
      id: "umumiy",
      title: t(MAXFIYLIK.umumiyTitle),
      body: (
        <>
          <p>
            {MAXFIYLIK.umumiyP1a[til](SITE.name)}
            <Link href="/oferta" className={LINK}>
              {t(MAXFIYLIK.umumiyP1link)}
            </Link>
            {t(MAXFIYLIK.umumiyP1b)}
          </p>
          <p>{t(MAXFIYLIK.umumiyP2)}</p>
        </>
      ),
    },
    {
      id: "malumotlar",
      title: t(MAXFIYLIK.malumotlarTitle),
      body: (
        <ul>
          <li>
            <strong>{t(MAXFIYLIK.dAccount)}</strong>
            {t(MAXFIYLIK.dAccountDesc)}
          </li>
          <li>
            <strong>{t(MAXFIYLIK.dProfile)}</strong>
            {t(MAXFIYLIK.dProfileDesc)}
          </li>
          <li>
            <strong>{t(MAXFIYLIK.dActivity)}</strong>
            {t(MAXFIYLIK.dActivityDesc)}
          </li>
          <li>
            <strong>{t(MAXFIYLIK.dPayments)}</strong>
            {t(MAXFIYLIK.dPaymentsDesc)}
          </li>
          <li>
            <strong>{t(MAXFIYLIK.dTech)}</strong>
            {t(MAXFIYLIK.dTechDesc)}
          </li>
        </ul>
      ),
    },
    {
      id: "cookie",
      title: t(MAXFIYLIK.cookieTitle),
      body: (
        <ul>
          <li>
            <strong>redince_session</strong>
            {t(MAXFIYLIK.cookieL1)}
          </li>
          <li>{t(MAXFIYLIK.cookieL2)}</li>
          <li>{t(MAXFIYLIK.cookieL3)}</li>
        </ul>
      ),
    },
    {
      id: "maqsadlar",
      title: t(MAXFIYLIK.maqsadlarTitle),
      body: (
        <ul>
          <li>{t(MAXFIYLIK.maqsadL1)}</li>
          <li>{t(MAXFIYLIK.maqsadL2)}</li>
          <li>{t(MAXFIYLIK.maqsadL3)}</li>
          <li>{t(MAXFIYLIK.maqsadL4)}</li>
          <li>{t(MAXFIYLIK.maqsadL5)}</li>
        </ul>
      ),
    },
    {
      id: "korinish",
      title: t(MAXFIYLIK.korinishTitle),
      body: (
        <>
          <p>
            {t(MAXFIYLIK.korinishP1a)}
            {VISIBILITY_LEVELS.map((l, i) => {
              const d = levelDesc(l.value, l.description);
              return (
                <span key={l.value}>
                  {i > 0 ? "; " : ""}
                  <strong>{levelLabel(l.value, l.label)}</strong> — {d.charAt(0).toLowerCase() + d.slice(1)}
                </span>
              );
            })}
            {t(MAXFIYLIK.korinishP1b)}
          </p>
          <div className="overflow-x-auto rounded-[16px] border border-line">
            <table className="w-full min-w-[320px] text-left text-[14px]">
              <caption className="sr-only">{t(MAXFIYLIK.tableCaption)}</caption>
              <thead className="bg-surface-2 text-[12px] uppercase tracking-wide text-fg-3">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t(MAXFIYLIK.thField)}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t(MAXFIYLIK.thDefault)}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {VISIBILITY_FIELDS.map((f) => (
                  <tr key={f.key}>
                    <td className="px-4 py-2.5 text-fg">{fieldLabel(f.key, f.label)}</td>
                    <td className="px-4 py-2.5 text-fg-2">{levelLabel(f.default, f.default)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>{t(MAXFIYLIK.korinishP2)}</p>
        </>
      ),
    },
    {
      id: "uchinchi-shaxslar",
      title: t(MAXFIYLIK.uchinchiTitle),
      body: (
        <>
          <p>{t(MAXFIYLIK.uchinchiP1)}</p>
          <ul>
            <li>{t(MAXFIYLIK.uchinchiL1)}</li>
            <li>{t(MAXFIYLIK.uchinchiL2)}</li>
            <li>{t(MAXFIYLIK.uchinchiL3)}</li>
            <li>{t(MAXFIYLIK.uchinchiL4)}</li>
          </ul>
          <p>{t(MAXFIYLIK.uchinchiP2)}</p>
        </>
      ),
    },
    {
      id: "saqlash",
      title: t(MAXFIYLIK.saqlashTitle),
      body: (
        <ul>
          <li>{t(MAXFIYLIK.saqlashL1)}</li>
          <li>{t(MAXFIYLIK.saqlashL2)}</li>
          <li>{t(MAXFIYLIK.saqlashL3)}</li>
          <li>{t(MAXFIYLIK.saqlashL4)}</li>
          <li>{t(MAXFIYLIK.saqlashL5)}</li>
          <li>{t(MAXFIYLIK.saqlashL6)}</li>
        </ul>
      ),
    },
    {
      id: "xavfsizlik",
      title: t(MAXFIYLIK.xavfsizlikTitle),
      body: (
        <ul>
          <li>{t(MAXFIYLIK.xavfL1)}</li>
          <li>{t(MAXFIYLIK.xavfL2)}</li>
          <li>{t(MAXFIYLIK.xavfL3)}</li>
          <li>{t(MAXFIYLIK.xavfL4)}</li>
        </ul>
      ),
    },
    {
      id: "huquqlar",
      title: t(MAXFIYLIK.huquqlarTitle),
      body: (
        <ul>
          <li>
            <strong>{t(MAXFIYLIK.rView)}</strong>
            {t(MAXFIYLIK.rViewDesc)}
          </li>
          <li>
            <strong>{t(MAXFIYLIK.rFix)}</strong>
            {t(MAXFIYLIK.rFixDesc)}
          </li>
          <li>
            <strong>{t(MAXFIYLIK.rVisibility)}</strong>
            {t(MAXFIYLIK.rVisibilityDesc)}
          </li>
          <li>
            <strong>{t(MAXFIYLIK.rEmail)}</strong>
            {t(MAXFIYLIK.rEmailDesc)}
          </li>
          <li>
            <strong>{t(MAXFIYLIK.rDelete)}</strong>
            {t(MAXFIYLIK.rDeleteDesc)}
          </li>
        </ul>
      ),
    },
    {
      id: "bolalar",
      title: t(MAXFIYLIK.bolalarTitle),
      body: <p>{t(MAXFIYLIK.bolalarP1)}</p>,
    },
    {
      id: "ozgarishlar",
      title: t(MAXFIYLIK.ozgarishlarTitle),
      body: (
        <p>
          {t(MAXFIYLIK.ozgarishlarP1)}
          <strong>{TERMS_VERSION}</strong>.
        </p>
      ),
    },
    {
      id: "aloqa",
      title: t(MAXFIYLIK.aloqaTitle),
      body: (
        <p>
          {t(MAXFIYLIK.aloqaP1a)}
          <a href="https://t.me/kasb_egalari" target="_blank" rel="noreferrer noopener" className={LINK}>
            @kasb_egalari
          </a>
          {t(MAXFIYLIK.aloqaP1b)}
        </p>
      ),
    },
  ];

  return (
    <LegalDocument
      eyebrow={t(LEGAL_SHELL.eyebrow)}
      title={t(MAXFIYLIK.title)}
      accent={t(MAXFIYLIK.accent)}
      version={TERMS_VERSION}
      effectiveDate={legalDate(TERMS_VERSION, til)}
      related={{ href: "/oferta", label: t(LEGAL_SHELL.offerLabel) }}
      labels={{ version: t(LEGAL_SHELL.version), effective: t(LEGAL_SHELL.effective), toc: t(LEGAL_SHELL.toc) }}
      intro={<p>{t(MAXFIYLIK.intro)}</p>}
      sections={sections}
    />
  );
}
