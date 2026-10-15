import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, ChevronRight, Info } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { HELP_ARTICLES, HELP_BY_SLUG, HELP_CATEGORIES, type HelpBlock } from "../articles";
import { HelpFeedback } from "../HelpFeedback";

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = HELP_BY_SLUG[slug];
  if (!a) return { title: "Maqola topilmadi", robots: { index: false, follow: false } };
  return {
    title: `${a.title} · Yordam`,
    description: a.summary,
    alternates: { canonical: `/yordam/${a.slug}` },
    openGraph: { title: a.title, description: a.summary, type: "article", images: ["/opengraph-image"], siteName: SITE.name, locale: "uz_UZ" },
  };
}

function Block({ b }: { b: HelpBlock }) {
  switch (b.type) {
    case "h":
      return <h2 className="mt-8 font-display text-[19px] font-semibold text-fg sm:text-[21px]">{b.text}</h2>;
    case "p":
      return <p className="mt-4 text-[15px] leading-relaxed text-fg-2 sm:text-[16px]">{b.text}</p>;
    case "list":
      return (
        <ul className="mt-4 space-y-2.5">
          {b.items.map((t) => (
            <li key={t} className="flex gap-3 text-[15px] leading-relaxed text-fg-2 sm:text-[16px]">
              <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="mt-5 space-y-4">
          {b.items.map((t, i) => (
            <li key={t} className="flex gap-3.5">
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent-text tabular-nums">
                {i + 1}
              </span>
              <span className="pt-1 text-[15px] leading-relaxed text-fg-2 sm:text-[16px]">
                <span className="sr-only">{i + 1}-qadam: </span>
                {t}
              </span>
            </li>
          ))}
        </ol>
      );
    case "note": {
      const warn = b.tone === "warning";
      const Icon = warn ? AlertTriangle : Info;
      return (
        <p className={cn("mt-5 flex gap-3 rounded-[var(--r-md)] px-4 py-3.5 text-[14px] leading-relaxed", warn ? "bg-warning-soft text-fg" : "bg-info-soft text-fg")}>
          <Icon size={18} className={cn("mt-0.5 shrink-0", warn ? "text-warning-text" : "text-info-text")} aria-hidden="true" />
          <span>
            <span className="sr-only">{warn ? "Diqqat: " : "Eslatma: "}</span>
            {b.text}
          </span>
        </p>
      );
    }
  }
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = HELP_BY_SLUG[slug];
  if (!a) notFound();
  const cat = HELP_CATEGORIES.find((c) => c.key === a.category);
  const related = a.related.map((s) => HELP_BY_SLUG[s]).filter((r): r is NonNullable<typeof r> => Boolean(r));
  const sameCategory = HELP_ARTICLES.filter((x) => x.category === a.category);

  return (
    <div className="container-x animate-fade-up">
      {/* Yo'l ko'rsatkich */}
      <nav aria-label="Yo'l ko'rsatkich" className="mb-6 flex flex-wrap items-center gap-1 text-[13px] text-fg-3">
        <Link href="/yordam" className="inline-flex min-h-10 items-center gap-1.5 font-medium transition hover:text-fg">
          <ArrowLeft size={14} /> Yordam markazi
        </Link>
        <ChevronRight size={14} className="text-fg-4" aria-hidden="true" />
        <Link href={`/yordam#${a.category}`} className="inline-flex min-h-10 items-center font-medium transition hover:text-fg">
          {cat?.title}
        </Link>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <article className="min-w-0 lg:col-span-8" aria-labelledby="article-title">
          <span className="eyebrow">{cat?.title}</span>
          <h1 id="article-title" className="display-xl mt-4 text-[30px] text-fg sm:text-[40px]">
            {a.title}
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-fg sm:text-[18px]">{a.summary}</p>
          <p className="mt-2 text-[12px] text-fg-4">Yangilangan: {formatDate(`${a.updated}T12:00:00Z`)}</p>

          <div className="mt-2 border-t border-line pt-2">
            {a.body.map((b, i) => (
              <Block key={i} b={b} />
            ))}
          </div>

          {a.cta && (
            <ButtonLink href={a.cta.href} variant="accent" size="md" className="mt-8">
              {a.cta.label} <ArrowRight size={15} />
            </ButtonLink>
          )}

          <div className="mt-10">
            <HelpFeedback slug={a.slug} />
          </div>

          {related.length > 0 && (
            <section className="mt-10" aria-labelledby="related-title">
              <h2 id="related-title" className="font-display text-[18px] font-semibold text-fg">
                O&apos;xshash maqolalar
              </h2>
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/yordam/${r.slug}`} className="card card-hover group flex h-full flex-col p-4">
                      <span className="text-[14px] font-semibold text-fg">{r.title}</span>
                      <span className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-fg-3">{r.summary}</span>
                      <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-text">
                        O&apos;qish <ArrowRight size={13} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        {/* Shu bo'limdagi boshqa maqolalar */}
        <aside className="min-w-0 lg:col-span-4">
          <div className="card p-5 lg:sticky lg:top-28">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">{cat?.title}</p>
            <ul className="mt-3 space-y-1">
              {sameCategory.map((x) => {
                const current = x.slug === a.slug;
                return (
                  <li key={x.slug}>
                    <Link
                      href={`/yordam/${x.slug}`}
                      aria-current={current ? "page" : undefined}
                      className={cn("flex min-h-11 items-center rounded-[var(--r-sm)] px-3 py-2 text-[14px] font-medium transition", current ? "btn-ink" : "text-fg-2 hover:bg-fg/5 hover:text-fg")}
                    >
                      {x.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
