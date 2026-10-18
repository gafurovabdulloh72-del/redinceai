import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Briefcase } from "lucide-react";
import { Avatar, ButtonLink, EmptyState } from "@/components/ui";
import { VacancyCard } from "@/components/vacancies/VacancyCard";
import { employerProfile } from "@/lib/vacancies/service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
type Params = Promise<{ key: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { key } = await params;
  const e = await employerProfile(key);
  if (!e) return { title: "Ish beruvchi topilmadi", robots: { index: false } };
  const name = e.company || e.user.name;
  return { title: `${name} — vakansiyalar`, description: `${name}: ${e.open.length} ta ochiq vakansiya. Kasb Egalari'da ariza berish bepul.`, alternates: { canonical: `/vakansiyalar/kompaniya/${e.user.username ?? e.user.id}` }, robots: e.open.length ? undefined : { index: false, follow: true } };
}

/** Ish beruvchi sahifasi: vakansiya muallifi (username yoki id) — nomi, kompaniyasi, barcha ochiq vakansiyalari. Kontakt yo'q. */
export default async function EmployerPage({ params }: { params: Params }) {
  const { key } = await params;
  const e = await employerProfile(key);
  if (!e) notFound();
  const name = e.company || e.user.name;
  return (
    <div className="container-x animate-fade-up">
      <nav aria-label="Yo'l" className="text-[13px] text-fg-3">
        <Link href="/vakansiyalar" className="transition hover:text-fg">
          Vakansiyalar
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg-2">{name}</span>
      </nav>
      <header className="card mt-4 flex flex-wrap items-center gap-4 p-5 sm:p-6">
        <Avatar name={e.user.name} src={e.user.avatarUrl} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="display-xl text-[26px] text-fg sm:text-[32px]">{name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-fg-2">
            {e.company && (
              <span className="inline-flex items-center gap-1">
                {e.user.name}
                {e.user.emailVerified && <BadgeCheck size={14} className="text-success-text" aria-label="Email tasdiqlangan" />}
              </span>
            )}
            {!e.company && e.user.emailVerified && (
              <span className="inline-flex items-center gap-1 text-success-text">
                <BadgeCheck size={14} aria-hidden /> Email tasdiqlangan
              </span>
            )}
            <span className="text-fg-3">· {formatDate(e.memberSince)} dan beri</span>
            <span className="text-fg-3">
              · {e.open.length} ta ochiq{e.closedCount > 0 ? `, ${e.closedCount} ta yopilgan` : ""}
            </span>
          </p>
        </div>
        {e.user.specialistSlug && (
          <ButtonLink href={`/mutaxassislar/${e.user.specialistSlug}`} variant="outline" size="md">
            Profil
          </ButtonLink>
        )}
      </header>

      <section className="mt-8" aria-labelledby="open-h">
        <h2 id="open-h" className="font-display text-[20px] font-semibold text-fg">
          Ochiq vakansiyalar
        </h2>
        {e.open.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={Briefcase} title="Hozir ochiq vakansiya yo'q" description="Yangi vakansiya joylansa shu yerda chiqadi." action={<ButtonLink href="/vakansiyalar" variant="outline" size="md">Barcha vakansiyalar</ButtonLink>} />
          </div>
        ) : (
          <ul className="stagger mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {e.open.map((v) => (
              <li key={v.id} className="min-w-0">
                <VacancyCard v={v} headingLevel="h3" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
