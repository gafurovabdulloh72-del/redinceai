import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, FileText, Hash } from "lucide-react";

export interface LegalSection {
  /** Langar (#id) */
  id: string;
  title: string;
  body: ReactNode;
}

interface LegalDocumentProps {
  eyebrow: string;
  /** Sarlavha: oddiy qism + serif urg'u qismi */
  title: string;
  accent: string;
  intro: ReactNode;
  version: string;
  /** "13-oktabr 2026" */
  effectiveDate: string;
  sections: LegalSection[];
  /** Boshqa hujjatga havola (oferta ↔ maxfiylik) */
  related: { href: string; label: string };
}

/**
 * Huquqiy hujjat sahifasi (oferta, maxfiylik siyosati): sarlavha, versiya va sana, langarli mundarija
 * (desktopda yopishqoq), raqamlangan bo'limlar. Server komponenti — JavaScript'siz ishlaydi.
 */
export function LegalDocument({ eyebrow, title, accent, intro, version, effectiveDate, sections, related }: LegalDocumentProps) {
  return (
    <div className="container-x min-w-0">
      <header className="max-w-3xl">
        <span className="eyebrow">
          <FileText size={13} className="text-accent" /> {eyebrow}
        </span>
        <h1 className="display-xl mt-5 text-[32px] text-fg sm:text-[46px]">
          {title} <span className="accent-serif text-accent">{accent}</span>
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-fg-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 font-medium">
            <Hash size={13} aria-hidden="true" /> Versiya {version}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 font-medium">
            <CalendarDays size={13} aria-hidden="true" /> Kuchga kirgan sana: <time dateTime={version}>{effectiveDate}</time>
          </span>
        </div>
        <div className="mt-5 text-[15px] leading-relaxed text-fg-2">{intro}</div>
      </header>

      <div className="mt-8 grid min-w-0 grid-cols-1 gap-5 lg:mt-10 lg:grid-cols-12 lg:gap-8">
        <nav aria-label="Mundarija" className="min-w-0 lg:col-span-4 xl:col-span-3">
          <div className="card p-4 sm:p-5 lg:sticky lg:top-28">
            <p className="eyebrow">Mundarija</p>
            <ol className="mt-3 space-y-0.5">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex min-h-10 items-center gap-3 rounded-[12px] px-2.5 py-1.5 text-[14px] text-fg-2 transition hover:bg-fg/5 hover:text-fg">
                    <span className="w-5 shrink-0 text-right font-mono text-[12px] text-fg-4">{i + 1}.</span>
                    <span className="min-w-0">{s.title}</span>
                  </a>
                </li>
              ))}
            </ol>
            <div className="mt-3 border-t border-line pt-3">
              <Link href={related.href} className="flex min-h-10 items-center gap-2 rounded-[12px] px-2.5 text-[13px] font-semibold text-accent-text transition hover:bg-accent-soft">
                <FileText size={14} aria-hidden="true" /> {related.label}
              </Link>
            </div>
          </div>
        </nav>

        <article className="card min-w-0 p-5 sm:p-8 lg:col-span-8 xl:col-span-9">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-28 border-b border-line pb-7 pt-7 first:pt-0 last:border-b-0 last:pb-0">
              <h2 id={`${s.id}-h`} className="flex items-baseline gap-3 font-display text-[20px] font-semibold tracking-tight text-fg sm:text-[22px]">
                <span className="font-mono text-[14px] font-medium text-accent-text">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">{s.title}</span>
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-fg-2 [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-fg [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
                {s.body}
              </div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}

/** "2026-10-13" → "13-oktabr 2026" */
export function uzDate(iso: string): string {
  const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d}-${MONTHS[m - 1]} ${y}`;
}
