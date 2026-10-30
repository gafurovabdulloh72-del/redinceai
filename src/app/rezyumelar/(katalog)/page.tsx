import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileUser, Search } from "lucide-react";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { ResumeCard } from "@/components/vacancies/ResumeCard";
import { Pagination, buildHref } from "@/components/specialists/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { REGIONS } from "@/lib/constants";
import { PROFESSIONS, REMOTE_REGION, RESUME_EXPERIENCE, RESUME_FORMAT } from "@/lib/vacancies/format";
import { getResume, listResumes } from "@/lib/vacancies/service";
import { resumeFilterSchema, type ResumeFilter } from "@/lib/vacancies/validators";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Rezyumelar — nomzodlar katalogi",
  other: { "m-title": "Rezyumelar" },
  description: "Onlayn kasblar bo'yicha nomzodlar: IT, dizayn, video, marketing, kontent, sotuv, moliya, ta'lim. Rezyumeni ko'ring va sayt ichidagi chat orqali yozing.",
  alternates: { canonical: "/rezyumelar" },
};

const BASE = "/rezyumelar";
type Raw = Record<string, string | string[] | undefined>;

function flat(raw: Raw): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (typeof s === "string" && s !== "") out[k] = s;
  }
  return out;
}
function parseFilter(flatQ: Record<string, string>): ResumeFilter {
  let res = resumeFilterSchema.safeParse(flatQ);
  if (!res.success) {
    const bad = new Set(res.error.issues.map((i) => String(i.path[0])));
    res = resumeFilterSchema.safeParse(Object.fromEntries(Object.entries(flatQ).filter(([k]) => !bad.has(k))));
  }
  return res.success ? res.data : resumeFilterSchema.parse({});
}
const chip = (active: boolean) =>
  cn("press inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition", active ? "border-transparent bg-ink text-ink-fg" : "border-line-2 text-fg-2 hover:border-fg hover:text-fg");

/** Rezyumelar katalogi — ish beruvchilar uchun; kontaktsiz, aloqa sayt ichidagi chat orqali */
export default async function ResumesPage({ searchParams }: { searchParams: Promise<Raw> }) {
  const f = parseFilter(flat(await searchParams));
  const user = await getCurrentUser();
  const [result, mine] = await Promise.all([listResumes(f), user ? getResume(user.id) : Promise.resolve(null)]);
  const query = { q: f.q || undefined, profession: f.profession || undefined, experience: f.experience || undefined, format: f.format || undefined, region: f.region || undefined, page: f.page > 1 ? String(f.page) : undefined };
  const hasFilters = Boolean(f.q || f.profession || f.experience || f.format || f.region);
  // Sahifa diapazondan tashqarida — oxirgi sahifaga
  if (result.total > 0 && f.page > result.pages) redirect(buildHref(BASE, { ...query, page: result.pages > 1 ? String(result.pages) : undefined }));

  return (
    <div className="container-x animate-fade-up">
      <PageHeader
        size="lg"
        eyebrow={`${result.total} ta nomzod`}
        title={
          <>
            Nomzodlar <span className="accent-serif text-accent">rezyumelari</span>
          </>
        }
        description="Onlayn kasblar bo'yicha nomzodlar — tajriba, ko'nikma va kutilayotgan maosh bilan. Mos nomzodga chat orqali yozing."
        action={
          <>
            <ButtonLink href={user ? "/kabinet/rezyume" : "/auth/royxat?next=/kabinet/rezyume"} variant="accent" size="lg">
              <FileUser size={18} /> {mine ? "Rezyumemni yangilash" : "Rezyume yaratish"}
            </ButtonLink>
            <ButtonLink href="/vakansiyalar" variant="outline" size="lg">
              Vakansiyalar
            </ButtonLink>
          </>
        }
      />

      <form action={BASE} method="get" className="card mt-8 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(3,minmax(0,170px))_auto]">
        {f.profession && <input type="hidden" name="profession" value={f.profession} />}
        <label className="relative min-w-0 sm:col-span-2 lg:col-span-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
          <input name="q" defaultValue={f.q} maxLength={80} placeholder="Lavozim, ko'nikma, ism…" aria-label="Qidirish" className="field h-11 w-full pl-10 text-[14px]" />
        </label>
        <select name="experience" defaultValue={f.experience} aria-label="Tajriba" className="field h-11 text-[14px]">
          <option value="">Har qanday tajriba</option>
          {(Object.keys(RESUME_EXPERIENCE) as Array<keyof typeof RESUME_EXPERIENCE>).map((k) => (
            <option key={k} value={k}>
              {RESUME_EXPERIENCE[k]}
            </option>
          ))}
        </select>
        <select name="format" defaultValue={f.format} aria-label="Ish formati" className="field h-11 text-[14px]">
          <option value="">Har qanday format</option>
          {(Object.keys(RESUME_FORMAT) as Array<keyof typeof RESUME_FORMAT>).map((k) => (
            <option key={k} value={k}>
              {RESUME_FORMAT[k]}
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
        <button type="submit" className="btn-ink inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-semibold sm:col-span-2 lg:col-span-1">
          Qidirish
        </button>
      </form>

      <nav aria-label="Kasblar" className="-mx-4 mt-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          <li>
            <Link href={buildHref(BASE, { ...query, profession: undefined, page: undefined })} className={chip(!f.profession)} aria-current={!f.profession ? "page" : undefined}>
              Barcha kasblar
            </Link>
          </li>
          {PROFESSIONS.map((p) => (
            <li key={p.slug}>
              <Link href={buildHref(BASE, { ...query, profession: f.profession === p.slug ? undefined : p.slug, page: undefined })} className={chip(f.profession === p.slug)} aria-current={f.profession === p.slug ? "page" : undefined}>
                {p.short}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mt-6" aria-live="polite">
        {result.items.length === 0 ? (
          <EmptyState
            icon={FileUser}
            title={hasFilters ? "Bunday nomzod topilmadi" : "Hali ommaviy rezyumelar yo'q"}
            description={hasFilters ? "Filtrlarni kengaytiring yoki vakansiya joylang — nomzodlar o'zlari ariza yuboradi." : "Birinchi rezyumeni siz qo'ying — ish beruvchilar katalogdan topadi."}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {hasFilters && (
                  <ButtonLink href={BASE} variant="outline" size="md">
                    Barcha rezyumelar
                  </ButtonLink>
                )}
                <ButtonLink href={user ? "/kabinet/rezyume" : "/auth/royxat?next=/kabinet/rezyume"} variant="accent" size="md">
                  Rezyume yaratish
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <>
            <p className="mb-3 text-[13px] text-fg-3">
              {result.total} ta nomzod{hasFilters ? " (filtr bo'yicha)" : ""}
              {result.pages > 1 ? ` · ${result.page}/${result.pages}-sahifa` : ""}
            </p>
            <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((r) => (
                <li key={r.id} className="min-w-0">
                  <ResumeCard r={r} />
                </li>
              ))}
            </ul>
            <Pagination page={result.page} pages={result.pages} query={query} basePath={BASE} className="mt-8" />
          </>
        )}
      </section>
    </div>
  );
}
