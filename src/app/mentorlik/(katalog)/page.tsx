import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, RadioTower, Search } from "lucide-react";
import { Avatar } from "@/components/ui";
import { CourseCard } from "@/components/mentorship/CourseCard";
import { COURSE_SORTS, CourseFilters, type FilterState } from "@/components/mentorship/CourseFilters";
import { getCurrentUser } from "@/lib/auth";
import { listCourses, listMentors, getMentorForUser } from "@/lib/mentorship/service";
import { liveAndUpcoming } from "@/lib/mentorship/growth";
import { formatDateTime } from "@/lib/utils";
import { COURSE_LEVELS, MENTOR_CATEGORIES, categoryLabel, formatSom } from "@/lib/mentorship/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Mentorlik — ustozlardan o'rganing",
  description: "Tajribali videograf, montajchi va dizaynerlardan onlayn kurslar. Haqiqiy ustozlar dars beradi.",
  alternates: { canonical: "/mentorlik" },
  other: { "m-title": "Mentorlik" },
};

/**
 * Mentorlik katalogi (v6, 2026-10-24 qayta tuzildi).
 * Ierarxiya: sarlavha → jonli efir (bo'lsa) → USTOZLAR (asosiy urg'u, ular kanal egasi) → kurslar.
 * Filtrlar bitta qatorda (`CourseFilters`) — oldingi 12 ta chip ikki qatorda edi.
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

  const [user, { items: courses }, mentors, lives] = await Promise.all([
    getCurrentUser(),
    listCourses({ category, level, q, price, sort, limit: 24 }),
    listMentors(12),
    liveAndUpcoming(6),
  ]);
  const myMentor = user ? await getMentorForUser(user.id) : null;

  return (
    <div className="container-x py-4 sm:py-6">
      {/* Sarlavha: bitta qator — nom + qidiruv + bitta amal (v6: faqat bitta accent yo'q, ink tugma) */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        {/* Telefonda yuqori panel sahifa nomini ko'rsatadi — bu yerda takrorlanmaydi */}
        <div className="min-w-0 max-sm:hidden">
          <h1 className="display-xl text-fg">Mentorlik</h1>
          <p className="mt-1 text-[14px] text-fg-3">Tajribali ustozlardan amaliy bilim — bo&apos;limlar, jonli efirlar va 1:1 darslar.</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <form action="/mentorlik" className="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
            {category && <input type="hidden" name="kasb" value={category} />}
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-4" />
            <input name="q" defaultValue={q} placeholder="Kurs qidirish…" aria-label="Kurs qidirish" className="field h-10 w-full !rounded-full pl-9 text-[13.5px]" />
          </form>
          <Link href="/kabinet/mentorlik" className="btn-ink inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[13.5px] font-semibold">
            {myMentor?.isApproved ? "Mening sahifam" : "Ustoz bo'lish"}
          </Link>
        </div>
      </header>

      {/* Hozir jonli / yaqin efirlar — faqat filtr qo'yilmaganda */}
      {lives.length > 0 && !browsing && (
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-[15px] font-bold text-fg">
            <RadioTower size={14} className="text-fg-3" /> Efirlar
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
                      <span className="inline-flex items-center gap-1 rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                        <span className="h-1.5 w-1.5 animate-ping-soft rounded-full bg-white" /> Jonli
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-[14px] font-bold leading-snug text-fg">{l.title}</span>
                  <span className="mt-auto text-[11.5px] text-fg-4">
                    {l.live ? "Hozir efirda" : formatDateTime(l.startsAt)}
                    {l.price > 0 ? ` · ${formatSom(l.price)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ustozlar — ixcham qator (oldin bitta karta 330px joy egallardi) */}
      {mentors.length > 0 && !browsing && (
        <section className="mt-5">
          <h2 className="mb-2 text-[15px] font-bold text-fg">Ustozlar</h2>
          <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-4">
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
                    <span className="mt-0.5 block truncate text-[12px] text-fg-3">{m.roleLabel || m.headline || "Ustoz"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Kurslar */}
      <section className="mt-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-bold text-fg">{q ? `«${q}» bo'yicha` : category ? categoryLabel(category) : "Bo'limlar"}</h2>
        </div>
        <CourseFilters state={state} total={courses.length} />
        {courses.length === 0 ? (
          <div className="card mt-3 grid place-items-center gap-1.5 p-10 text-center">
            <GraduationCap size={26} className="text-fg-4" />
            <p className="text-[14px] font-semibold text-fg">{browsing ? "Bu shartlarga mos kurs yo'q" : "Hozircha kurs yo'q"}</p>
            <p className="text-[13px] text-fg-3">{browsing ? "Filtrlarni tozalab ko'ring." : "Birinchi bo'lib bo'lim oching — «Ustoz bo'lish»."}</p>
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 max-sm:mt-2 max-sm:grid-cols-1 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {courses.map((c) => (
              <li key={c.id}>
                <CourseCard c={c} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
