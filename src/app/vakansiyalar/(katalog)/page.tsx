import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Plus, Search, SlidersHorizontal } from "lucide-react";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { VacancyAlertButton } from "@/components/vacancies/VacancyAlertButton";
import { VacancyCard } from "@/components/vacancies/VacancyCard";
import { Pagination, buildHref } from "@/components/specialists/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { REGIONS } from "@/lib/constants";
import { EMPLOYMENT, EXPERIENCE, PAY_FILTER, PROFESSIONS, REMOTE_REGION, SALARY_CHIPS, WORK_FORMAT, professionLabel } from "@/lib/vacancies/format";
import { listVacancies, vacancyCountsByProfession } from "@/lib/vacancies/service";
import type { VacancyFilter } from "@/lib/vacancies/validators";
import { cn } from "@/lib/utils";
import { filterChip as chip, flatSearch as flat, parseVacancyFilter as parseFilter, toQueryString, vacancyQuery as toQuery, type RawSearch as Raw } from "../_shared";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vakansiyalar — onlayn ish o'rinlari",
  description: "Masofaviy va ofis vakansiyalari: IT, dizayn, video, marketing, kontent, sotuv, moliya, ta'lim. Joylash ham, ariza berish ham bepul.",
  alternates: { canonical: "/vakansiyalar" },
};

const BASE = "/vakansiyalar";

/** Faol filtrlardan saqlanadigan qidiruv nomi: "Video · Masofaviy" */
function alertName(f: VacancyFilter): string {
  const parts = [f.profession && professionLabel(f.profession, true), f.format && WORK_FORMAT[f.format], f.q && `«${f.q}»`].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : "Barcha vakansiyalar";
}

/** Vakansiyalar katalogi — barcha onlayn kasblar; filtr GET forma (JS'siz ishlaydi) + kasb va tez chiplar */
export default async function VacanciesPage({ searchParams }: { searchParams: Promise<Raw> }) {
  const f = parseFilter(flat(await searchParams));
  const [result, counts, user] = await Promise.all([listVacancies(f), vacancyCountsByProfession(), getCurrentUser()]);
  const query = toQuery(f);
  // Sahifa diapazondan tashqarida — oxirgi sahifaga (bo'sh «topilmadi» o'rniga)
  if (result.total > 0 && f.page > result.pages) redirect(buildHref(BASE, { ...query, page: result.pages > 1 ? String(result.pages) : undefined }));
  const totalOpen = Object.values(counts).reduce((a, b) => a + b, 0);
  const hasFilters = Boolean(f.q || f.profession || f.format || f.employment || f.experience || f.region || f.min || f.pay || f.fresh);
  const advancedActive = Boolean(f.employment || f.experience || f.region);
  const alertQuery = toQueryString({ ...query, page: undefined, sort: undefined, fresh: undefined });

  return (
    <div className="container-x animate-fade-up">
      <PageHeader
        size="lg"
        eyebrow={`${totalOpen} ta ochiq vakansiya · bepul`}
        title={
          <>
            Onlayn <span className="accent-serif text-accent">vakansiyalar</span>
          </>
        }
        description="Masofaviy va ofis ish o'rinlari — IT, dizayn, video, marketing, kontent va boshqa onlayn kasblar. Rezyume bilan bir bosishda ariza yuboring."
        action={
          <>
            <ButtonLink href="/vakansiyalar/yangi" variant="accent" size="lg">
              <Plus size={18} /> Vakansiya joylash
            </ButtonLink>
            <ButtonLink href="/rezyumelar" variant="outline" size="lg">
              Rezyumelar
            </ButtonLink>
          </>
        }
      />

      <form action={BASE} method="get" className="card mt-8 grid gap-3 p-3 lg:grid-cols-[1fr_minmax(0,160px)_auto]">
        {f.profession && <input type="hidden" name="profession" value={f.profession} />}
        {f.min > 0 && <input type="hidden" name="min" value={f.min} />}
        {f.pay && <input type="hidden" name="pay" value={f.pay} />}
        <label className="relative min-w-0">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
          <input name="q" defaultValue={f.q} maxLength={80} placeholder="Lavozim, kompaniya, ko'nikma…" aria-label="Qidirish" className="field h-11 w-full pl-10 text-[14px]" />
        </label>
        <select name="format" defaultValue={f.format} aria-label="Ish formati" className="field h-11 text-[14px]">
          <option value="">Har qanday format</option>
          {(Object.keys(WORK_FORMAT) as Array<keyof typeof WORK_FORMAT>).map((k) => (
            <option key={k} value={k}>
              {WORK_FORMAT[k]}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-ink press inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-semibold">
          Qidirish
        </button>
        {/* Qo'shimcha filtrlar — telefonda yig'ilgan (details), faol bo'lsa ochiq */}
        <details className="group min-w-0 lg:col-span-3" open={advancedActive}>
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal size={14} aria-hidden /> Qo&apos;shimcha filtrlar
            {advancedActive && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
          </summary>
          <div className="expand-in mt-2 grid gap-3 sm:grid-cols-3">
            <select name="employment" defaultValue={f.employment} aria-label="Bandlik" className="field h-11 text-[14px]">
              <option value="">Har qanday bandlik</option>
              {(Object.keys(EMPLOYMENT) as Array<keyof typeof EMPLOYMENT>).map((k) => (
                <option key={k} value={k}>
                  {EMPLOYMENT[k]}
                </option>
              ))}
            </select>
            <select name="experience" defaultValue={f.experience} aria-label="Tajriba" className="field h-11 text-[14px]">
              <option value="">Har qanday tajriba</option>
              {(Object.keys(EXPERIENCE) as Array<keyof typeof EXPERIENCE>).map((k) => (
                <option key={k} value={k}>
                  {EXPERIENCE[k]}
                </option>
              ))}
            </select>
            <select name="region" defaultValue={f.region} aria-label="Hudud" className="field h-11 text-[14px]">
              <option value="">Butun O&apos;zbekiston</option>
              <option value={REMOTE_REGION}>Faqat masofaviy</option>
              {REGIONS.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </details>
      </form>

      {/* Kasb chiplari */}
      <nav aria-label="Kasblar" className="-mx-4 mt-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          <li>
            <Link href={buildHref(BASE, { ...query, profession: undefined, page: undefined })} className={chip(!f.profession)} aria-current={!f.profession ? "page" : undefined}>
              Barcha kasblar <span className={!f.profession ? "opacity-70" : "text-fg-4"}>{totalOpen}</span>
            </Link>
          </li>
          {PROFESSIONS.map((p) => {
            const active = f.profession === p.slug;
            const n = counts[p.slug] ?? 0;
            return (
              <li key={p.slug}>
                <Link href={buildHref(BASE, { ...query, profession: active ? undefined : p.slug, page: undefined })} className={chip(active)} aria-current={active ? "page" : undefined}>
                  {p.short} {n > 0 && <span className={active ? "opacity-70" : "text-fg-4"}>{n}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Tez filtrlar: masofaviy, yangi, maosh, kelishiladi */}
      <div className="-mx-4 mt-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <div className="flex w-max items-center gap-2 sm:w-auto sm:flex-wrap" role="group" aria-label="Tez filtrlar">
          <Link href={buildHref(BASE, { ...query, format: f.format === "remote" ? undefined : "remote", page: undefined })} className={chip(f.format === "remote")} aria-pressed={f.format === "remote"}>
            Masofaviy
          </Link>
          <Link href={buildHref(BASE, { ...query, fresh: f.fresh ? undefined : "1", page: undefined })} className={chip(f.fresh === "1")} aria-pressed={f.fresh === "1"}>
            Yangi (48 soat)
          </Link>
          {SALARY_CHIPS.map((c) => {
            const on = f.min === c.min;
            return (
              <Link key={c.min} href={buildHref(BASE, { ...query, min: on ? undefined : String(c.min), pay: undefined, page: undefined })} className={chip(on)} aria-pressed={on}>
                {c.label}
              </Link>
            );
          })}
          {(Object.keys(PAY_FILTER) as Array<keyof typeof PAY_FILTER>).map((k) => {
            const on = f.pay === k;
            return (
              <Link key={k} href={buildHref(BASE, { ...query, pay: on ? undefined : k, min: k === "neg" ? undefined : query.min, page: undefined })} className={chip(on)} aria-pressed={on}>
                {PAY_FILTER[k]}
              </Link>
            );
          })}
        </div>
      </div>

      <section className="mt-6" aria-live="polite">
        {result.items.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={hasFilters ? "Bunday vakansiya topilmadi" : "Hali vakansiyalar yo'q"}
            description={hasFilters ? "Filtrlarni kengaytiring yoki qidiruvni saqlang — mos vakansiya chiqsa xabar beramiz." : "Birinchi vakansiyani siz joylang — bepul, 30 kun ro'yxatda turadi."}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {hasFilters && (
                  <ButtonLink href={BASE} variant="outline" size="md">
                    Barcha vakansiyalar
                  </ButtonLink>
                )}
                {hasFilters && <VacancyAlertButton query={alertQuery} defaultName={alertName(f)} loggedIn={Boolean(user)} />}
                {!hasFilters && (
                  <ButtonLink href="/vakansiyalar/yangi" variant="accent" size="md">
                    <Plus size={16} /> Vakansiya joylash
                  </ButtonLink>
                )}
              </div>
            }
          />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-fg-3">
              <p>
                {result.total} ta vakansiya{hasFilters ? " (filtr bo'yicha)" : ""}
                {result.pages > 1 ? ` · ${result.page}/${result.pages}-sahifa` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2">
                  Saralash:
                  {(
                    [
                      ["newest", "Yangi"],
                      ["salary_high", "Maosh"],
                      ["applications", "Ko'p ariza"],
                    ] as const
                  ).map(([k, label]) => (
                    <Link key={k} href={buildHref(BASE, { ...query, sort: k === "newest" ? undefined : k, page: undefined })} className={cn("font-semibold", f.sort === k ? "text-fg underline underline-offset-4" : "hover:text-fg")} aria-current={f.sort === k ? "true" : undefined}>
                      {label}
                    </Link>
                  ))}
                </span>
                <VacancyAlertButton query={alertQuery} defaultName={alertName(f)} loggedIn={Boolean(user)} />
              </div>
            </div>
            <ul className="stagger grid gap-4 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((v) => (
                <li key={v.id} className="min-w-0">
                  <VacancyCard v={v} />
                </li>
              ))}
            </ul>
            <Pagination page={result.page} pages={result.pages} query={query} basePath={BASE} className="mt-8" />
          </>
        )}
      </section>

      {/* Ikki tomon uchun CTA */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="card flex flex-col gap-2 p-5">
          <h2 className="font-display text-[18px] font-semibold text-fg">Ish qidiryapsizmi?</h2>
          <p className="text-[13.5px] leading-relaxed text-fg-2">Rezyume to&apos;ldiring — har vakansiyaga bir bosishda ariza yuborasiz. Kontaktingiz ochiq ko&apos;rsatilmaydi.</p>
          <ButtonLink href={user ? "/kabinet/rezyume" : "/auth/royxat?next=/kabinet/rezyume"} variant="primary" size="md" className="mt-2 w-fit">
            Rezyume yaratish
          </ButtonLink>
        </div>
        <div className="card flex flex-col gap-2 p-5">
          <h2 className="font-display text-[18px] font-semibold text-fg">Xodim kerakmi?</h2>
          <p className="text-[13.5px] leading-relaxed text-fg-2">Vakansiyani 2 daqiqada joylang — bepul. Arizalar rezyume va kontakt bilan kabinetingizga keladi.</p>
          <ButtonLink href="/vakansiyalar/yangi" variant="accent" size="md" className="mt-2 w-fit">
            Vakansiya joylash
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
