import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, LifeBuoy, Phone, Send, ShieldCheck, Users, type LucideIcon, UsersRound, Briefcase } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { HELP_ARTICLES, HELP_CATEGORIES, articleText, type HelpCategoryKey } from "./articles";
import { HelpSearch, type HelpIndexItem } from "./HelpSearch";

export const metadata: Metadata = {
  title: "Yordam markazi",
  description: "Kasb Egalari bo'yicha savollarga javoblar: buyurtma berish, eskrou orqali xavfsiz to'lov, nizo, mutaxassis obunasi, komissiya, pul chiqarish va xavfsizlik.",
  alternates: { canonical: "/yordam" },
};

const CATEGORY_ICON: Record<HelpCategoryKey, LucideIcon> = {
  mijozlar: Users,
  mutaxassislar: BriefcaseBusiness,
  xavfsizlik: ShieldCheck,
  hamjamiyat: UsersRound,
  vakansiyalar: Briefcase,
};

export default async function HelpCenterPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.slice(0, 80) ?? "";
  const catTitle = Object.fromEntries(HELP_CATEGORIES.map((c) => [c.key, c.title])) as Record<HelpCategoryKey, string>;
  const index: HelpIndexItem[] = HELP_ARTICLES.map((a) => ({ slug: a.slug, title: a.title, summary: a.summary, category: catTitle[a.category], text: articleText(a) }));

  return (
    <div className="container-x animate-fade-up">
      {/* ---------- Sarlavha + qidiruv ---------- */}
      <header className="mx-auto max-w-3xl text-center">
        <span className="eyebrow justify-center max-sm:hidden">
          <LifeBuoy size={13} className="text-accent" /> Yordam markazi
        </span>
        <h1 className="display-xl mt-5 text-[34px] text-fg sm:text-[48px]">
          Qanday <span className="accent-serif text-accent">yordam</span> beraylik?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-fg-2 sm:text-[17px]">Buyurtma va eskrou, obuna, jamoalar va kanallar, vakansiyalar, pul chiqarish va xavfsizlik bo&apos;yicha qisqa va aniq javoblar.</p>
        <div className="mx-auto mt-7 max-w-2xl text-left">
          <HelpSearch index={index} initialQuery={q} />
        </div>
      </header>

      {/* ---------- Bo'limlar ---------- */}
      <section className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Bo'limlar">
        {HELP_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICON[c.key];
          const list = HELP_ARTICLES.filter((a) => a.category === c.key);
          return (
            <div key={c.key} id={c.key} className="card flex min-w-0 scroll-mt-28 flex-col p-5 sm:p-6">
              <span className="icon-tile" aria-hidden="true">
                <Icon size={20} />
              </span>
              <h2 className="mt-4 font-display text-[19px] font-semibold text-fg">{c.title}</h2>
              <p className="mt-1 text-[13px] leading-snug text-fg-3">{c.description}</p>
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {list.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/yordam/${a.slug}`} className="group flex min-h-12 items-center gap-2 py-2.5 text-[14px] font-medium text-fg transition hover:text-accent-text">
                      <span className="min-w-0 flex-1">{a.title}</span>
                      <ArrowRight size={14} className="shrink-0 text-fg-4 transition group-hover:translate-x-0.5 group-hover:text-accent-text" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {/* ---------- Aloqa ---------- */}
      <section className="card-elevated mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-labelledby="help-contact">
        <div className="min-w-0">
          <h2 id="help-contact" className="font-display text-[18px] font-semibold text-fg">
            Javob topmadingizmi?
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-fg-2">
            To&apos;g&apos;ridan-to&apos;g&apos;ri loyiha rahbari {SITE.owner} bilan bog&apos;laning — Telegram orqali yozing yoki qo&apos;ng&apos;iroq qiling. Ish kunlari odatda bir necha soat ichida javob beramiz. Buyurtma bo&apos;yicha muammo bo&apos;lsa, buyurtma sahifasidan nizo oching.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ButtonLink href={SITE.supportTelegram} target="_blank" rel="noreferrer noopener" variant="accent" size="md">
            <Send size={15} /> Telegram&apos;da yozish
          </ButtonLink>
          <ButtonLink href={`tel:${SITE.supportPhone.replace(/\s/g, "")}`} variant="outline" size="md">
            <Phone size={15} /> {SITE.supportPhone}
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
