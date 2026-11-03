import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, RadioTower, Search } from "lucide-react";
import { Avatar } from "@/components/ui";
import { CATEGORY_ICON, CourseCard } from "@/components/mentorship/CourseCard";
import { COURSE_SORTS, CourseFilters, type FilterState } from "@/components/mentorship/CourseFilters";
import { getCurrentUser } from "@/lib/auth";
import { listCourses, listMentors, getMentorForUser } from "@/lib/mentorship/service";
import { liveAndUpcoming } from "@/lib/mentorship/growth";
import { formatDateTime } from "@/lib/utils";
import { COURSE_LEVELS, MENTOR_CATEGORIES } from "@/lib/mentorship/format";
import { cn } from "@/lib/utils";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { MS, categoryLabelTr, formatSomTr } from "@/lib/i18n/dict/mentorship";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return {
    title: tr(til, MS.catalogTitle),
    description: tr(til, MS.catalogDesc),
    alternates: { canonical: "/mentorlik" },
    other: { "m-title": tr(til, MS.catalogH1) },
  };
}

/**
 * Mentorlik katalogi (2026-11-01 soddalashtirildi).
 * Ierarxiya: sarlavha+qidiruv → jonli efir (bo'lsa) → yo'nalish chiplari → KURSLAR (yagona ro'yxat) → ustozlar.
 * «Mashhur kurslar» karuseli OLIB TASHLANGAN — asosiy ro'yxat bilan bir xil kurslarni takrorlab,
 * sahifani chalkash qilardi; saralash filtrdagi «Mashhur» bilan o'sha natijani beradi.
 */
export default async function MentorlikPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const category = sp.kasb && MENTOR_CATEGORIES.some((c) => c.key === sp.kasb) ? sp.kasb : undefined;
  const level = sp.daraja && COURSE_LEVELS.some((l) => l.key === sp.daraja) ? sp.daraja : undefined;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const price = sp.narx === "bepul" ? "free" : sp.narx === "pulli" ? "paid" : undefined;
  const sort = COURSE_SORTS.find(([k]) => k === sp.tartib)?.[0] ?? "new";
  const state: FilterState = { category, level, price, sort, q };
  const browsing = Boolean(q || category || level || price || sort !== "new");

  const [user, { items: courses }, mentors, lives, til] = await Promise.all([
    getCurrentUser(),
    listCourses({ category, level, q, price, sort, limit: 24 }),
    listMentors(12),
    liveAndUpcoming(6),
    getLocale(),
  ]);
  const myMentor = user ? await getMentorForUser(user.id) : null;

  return (
    <div className="container-x py-4 sm:py-6">
      {/* Sarlavha: bitta qator — nom + qidiruv + bitta amal (v6: faqat bitta accent yo'q, ink tugma) */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        {/* Telefonda yuqori panel sahifa nomini ko'rsatadi — bu yerda takrorlanmaydi */}
        <div className="min-w-0 max-sm:hidden">
          <h1 className="display-xl text-fg">{tr(til, MS.catalogH1)}</h1>
          <p className="mt-1 text-[14px] text-fg-3">{tr(til, MS.catalogLead)}</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <form action="/mentorlik" className="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
            {category && <input type="hidden" name="kasb" value={category} />}
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-4" />
            <input name="q" defaultValue={q} placeholder={tr(til, MS.searchPh)} aria-label={tr(til, MS.searchAria)} className="field h-10 w-full !rounded-full pl-9 text-[13.5px]" />
          </form>
          <Link href="/kabinet/mentorlik" className="btn-ink inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[13.5px] font-semibold">
            {myMentor?.isApproved ? tr(til, MS.myPage) : tr(til, MS.becomeMentor)}
          </Link>
        </div>
      </header>

      {/* Hozir jonli / yaqin efirlar — faqat filtr qo'yilmaganda */}
      {lives.length > 0 && !browsing && (
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-[15px] font-bold text-fg">
            <RadioTower size={14} className="text-fg-3" /> {tr(til, MS.lives)}
          </h2>
          <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {lives.map((l) => (
              <li key={l.key} className="w-[250px] shrink-0">
                <Link
                  href={l.mentorSlug ? `/mentorlik/ustoz/${l.mentorSlug}?tab=efirlar${l.live ? "&efir=1" : ""}` : "/mentorlik"}
                  className={cn("card card-hover flex h-full flex-col gap-2 p-3", l.live && "border-danger/50")}
                >
                  <span className="flex items-center gap-2">
                    <Avatar name={l.mentorName} src={l.avatarUrl} size={22} decorative />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-fg-2">{l.mentorName}</span>
                    {l.live && (
                      <span className="inline-flex items-center gap-1 rounded bg-danger px-1.5 py-0.5 text-[11px] font-bold uppercase text-white">
                        <span className="h-1.5 w-1.5 animate-ping-soft rounded-full bg-white" /> {tr(til, MS.liveChip)}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-[14px] font-bold leading-snug text-fg">{l.title}</span>
                  <span className="mt-auto text-[11.5px] text-fg-4">
                    {l.live ? tr(til, MS.liveNow) : formatDateTime(l.startsAt)}
                    {l.price > 0 ? ` · ${formatSomTr(til, l.price)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Yo'nalishlar — ikonkali chiplar (Udemy kategoriya qatori), faqat filtr yo'q bo'lganda */}
      {!browsing && (
        <nav className="mt-4" aria-label={tr(til, MS.directions)}>
          <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {MENTOR_CATEGORIES.filter((c) => c.key !== "boshqa").map((c) => {
              const Icon = CATEGORY_ICON[c.key] ?? GraduationCap;
              return (
                <li key={c.key} className="shrink-0">
                  <Link href={`/mentorlik?kasb=${c.key}`} className="chip inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-fg-2 transition hover:text-fg">
                    <Icon size={14} className="text-fg-3" aria-hidden /> {categoryLabelTr(til, c.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {/* Kurslar — sahifaning yagona asosiy ro'yxati (oldin «Mashhur» karuseli bir xil kurslarni takrorlab turardi) */}
      <section className="mt-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-bold text-fg">{q ? MS.byQuery[til](q) : category ? categoryLabelTr(til, category) : tr(til, MS.courses)}</h2>
        </div>
        <CourseFilters state={state} total={courses.length} til={til} />
        {courses.length === 0 ? (
          <div className="card mt-3 grid place-items-center gap-1.5 p-10 text-center">
            <GraduationCap size={26} className="text-fg-4" />
            <p className="text-[14px] font-semibold text-fg">{browsing ? tr(til, MS.noMatch) : tr(til, MS.noCourses)}</p>
            <p className="text-[13px] text-fg-3">{browsing ? tr(til, MS.clearFilters) : tr(til, MS.beFirst)}</p>
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 max-sm:mt-2 max-sm:grid-cols-1 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {courses.map((c) => (
              <li key={c.id}>
                <CourseCard c={c} til={til} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ustozlar — kurslardan keyin (asosiy kontent — kurslar); telefonda story-doira qatori, sm+ da kartalar */}
      {mentors.length > 0 && !browsing && (
        <section className="mt-5">
          <h2 className="mb-2 text-[15px] font-bold text-fg">{tr(til, MS.mentors)}</h2>
          <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:hidden">
            {mentors.map((m) => (
              <li key={m.id} className="w-[72px] shrink-0">
                <Link href={`/mentorlik/ustoz/${m.slug}`} className="press flex flex-col items-center gap-1.5 text-center">
                  <span className="story-ring-seen block">
                    <span className="story-gap block">
                      <span className="relative block h-[58px] w-[58px] overflow-hidden rounded-full bg-surface-2">
                        {m.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.photoUrl} alt="" className="h-full w-full object-cover object-top" />
                        ) : (
                          <Avatar name={m.name} src={m.avatarUrl} size={58} decorative className="!ring-0 !shadow-none" />
                        )}
                      </span>
                    </span>
                  </span>
                  <span className="w-full truncate text-[11.5px] font-semibold text-fg">{m.name.split(" ")[0]}</span>
                </Link>
              </li>
            ))}
          </ul>
          <ul className="no-scrollbar -mx-4 hidden gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-4">
            {mentors.map((m) => (
              <li key={m.id} className="w-[230px] shrink-0 sm:w-auto">
                <Link href={`/mentorlik/ustoz/${m.slug}`} className="card card-hover flex items-center gap-3 p-3">
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-surface-2">
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photoUrl} alt="" className="h-full w-full object-cover object-top" />
                    ) : (
                      <Avatar name={m.name} src={m.avatarUrl} size={48} decorative />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-fg">{m.name}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-fg-3">{m.roleLabel || m.headline || tr(til, MS.mentor)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}
