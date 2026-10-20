import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Search, Star, Users } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import { Avatar } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { listCourses, listMentors, getMentorForUser } from "@/lib/mentorship/service";
import { MENTOR_CATEGORIES, COURSE_LEVELS, categoryLabel, levelLabel, formatSom } from "@/lib/mentorship/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Mentorlik — ustozlardan o'rganing",
  description: "Tajribali videograf, montajchi va dizaynerlardan onlayn kurslar. Haqiqiy ustozlar dars beradi.",
  alternates: { canonical: "/mentorlik" },
};

/**
 * Mentorlik katalogi: tajribali ustozlar kurslar beradi. Kurslar grid + top mentorlar + kategoriya/daraja filtri.
 * SEO uchun server-rendered. Mentor bo'lish / kabinet CTA.
 */
export default async function MentorlikPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const category = sp.kasb && MENTOR_CATEGORIES.some((c) => c.key === sp.kasb) ? sp.kasb : undefined;
  const level = sp.daraja && COURSE_LEVELS.some((l) => l.key === sp.daraja) ? sp.daraja : undefined;
  const q = sp.q?.trim().slice(0, 80) || undefined;

  const [user, { items: courses }, mentors] = await Promise.all([getCurrentUser(), listCourses({ category, level, q, limit: 24 }), listMentors(10)]);
  const myMentor = user ? await getMentorForUser(user.id) : null;

  const chip = (k: string, href: string, label: string, active: boolean) => (
    <Link
      key={k}
      href={href}
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-[13px] font-semibold transition",
        active ? "btn-ink border-transparent" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
  const withParam = (key: string, val: string | undefined) => {
    const p = new URLSearchParams();
    if (category && key !== "kasb") p.set("kasb", category);
    if (level && key !== "daraja") p.set("daraja", level);
    if (q) p.set("q", q);
    if (val) p.set(key, val);
    const s = p.toString();
    return `/mentorlik${s ? `?${s}` : ""}`;
  };

  return (
    <div className="container-x py-6 sm:py-8">
      {/* Hero */}
      <div className="card-elevated relative overflow-hidden p-6 sm:p-8">
        <span className="eyebrow mb-2 inline-flex items-center gap-1.5">
          <GraduationCap size={14} className="text-accent" /> Mentorlik
        </span>
        <h1 className="display-xl text-fg">Ustozlardan o&apos;rganing</h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-fg-2">
          Tajribali videograf, montajchi, dizayner va motion-ustalar onlayn dars beradi. Amaliy kurslar, qadam-ma-qadam darslar, o&apos;z sur&apos;atingizda.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {myMentor?.isApproved ? (
            <Link href="/kabinet/mentorlik" className="btn-accent inline-flex h-11 items-center gap-2 rounded-[14px] px-5 text-[14.5px] font-semibold">
              Kurslarimni boshqarish
            </Link>
          ) : (
            <Link href="/kabinet/mentorlik" className="btn-accent inline-flex h-11 items-center gap-2 rounded-[14px] px-5 text-[14.5px] font-semibold">
              Mentor bo&apos;lish
            </Link>
          )}
          <form action="/mentorlik" className="relative flex-1 sm:max-w-xs">
            {category && <input type="hidden" name="kasb" value={category} />}
            {level && <input type="hidden" name="daraja" value={level} />}
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-4" />
            <input name="q" defaultValue={q} placeholder="Kurs qidirish…" aria-label="Kurs qidirish" className="field h-11 w-full !rounded-[14px] pl-9 text-[14px]" />
          </form>
        </div>
      </div>

      {/* Filtrlar */}
      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
        {chip("kasb-all", withParam("kasb", undefined), "Barcha yo'nalishlar", !category)}
        {MENTOR_CATEGORIES.filter((c) => c.key !== "boshqa").map((c) => chip(`kasb-${c.key}`, withParam("kasb", c.key), c.label, category === c.key))}
      </div>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
        {chip("daraja-all", withParam("daraja", undefined), "Har daraja", !level)}
        {COURSE_LEVELS.map((l) => chip(`daraja-${l.key}`, withParam("daraja", l.key), l.label, level === l.key))}
      </div>

      {/* Top mentorlar */}
      {mentors.length > 0 && !q && !category && !level && (
        <section className="mt-7">
          <h2 className="mb-3 text-[15px] font-bold text-fg">Tanilgan ustozlar</h2>
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {mentors.map((m) => (
              <Link key={m.id} href={`/mutaxassislar`} className="card card-hover flex w-48 shrink-0 flex-col items-center p-4 text-center">
                <Avatar name={m.name} src={m.avatarUrl} size={56} decorative />
                <p className="mt-2 truncate text-[14px] font-semibold text-fg">{m.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-fg-3">{m.headline}</p>
                <p className="mt-2 flex items-center gap-2 text-[11.5px] text-fg-4">
                  <span className="inline-flex items-center gap-0.5"><Star size={11} className="fill-accent text-accent" /> {m.rating || "—"}</span>
                  <span className="inline-flex items-center gap-0.5"><Users size={11} /> {m.studentsCount}</span>
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Kurslar */}
      <section className="mt-7">
        <h2 className="mb-3 text-[15px] font-bold text-fg">{q ? `«${q}» bo'yicha` : category ? categoryLabel(category) : "Barcha kurslar"} <span className="font-medium text-fg-4">· {courses.length}</span></h2>
        {courses.length === 0 ? (
          <div className="card grid place-items-center gap-2 p-10 text-center">
            <GraduationCap size={28} className="text-fg-4" />
            <p className="text-[14px] font-semibold text-fg">Hozircha kurs yo&apos;q</p>
            <p className="text-[13px] text-fg-3">Birinchi bo&apos;lib kurs oching — «Mentor bo&apos;lish».</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <li key={c.id}>
                <Link href={`/mentorlik/${c.slug}`} className="card card-hover group flex h-full flex-col overflow-hidden">
                  <div className="relative aspect-video overflow-hidden bg-surface-2">
                    {c.coverUrl ? (
                      <SafeImage src={c.coverUrl} alt={c.title} width={480} height={270} className="img-zoom h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-fg/5">
                        <GraduationCap size={30} className="text-fg-4" />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-[11px] font-bold text-white">{levelLabel(c.level)}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-3.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-accent-text">{categoryLabel(c.category)}</span>
                    <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-fg">{c.title}</h3>
                    <p className="mt-1 line-clamp-2 flex-1 text-[13px] leading-snug text-fg-3">{c.summary}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Avatar name={c.mentor.name} src={c.mentor.avatarUrl} size={24} decorative />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-fg-2">{c.mentor.name}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[12px] text-fg-4">
                      <span className="flex items-center gap-2.5">
                        <span>{c.lessonsCount} dars</span>
                        <span className="inline-flex items-center gap-0.5"><Users size={12} /> {c.studentsCount}</span>
                        {c.rating > 0 && <span className="inline-flex items-center gap-0.5"><Star size={12} className="fill-accent text-accent" /> {c.rating}</span>}
                      </span>
                      <span className={cn("font-bold", c.priceFrom ? "text-fg" : "text-success-text")}>{formatSom(c.priceFrom)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
