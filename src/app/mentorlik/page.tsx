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
    <div className="container-x py-4 sm:py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight text-fg sm:text-[34px]">Mentorlik</h1>
          <p className="mt-1 max-w-lg text-[14.5px] leading-relaxed text-fg-3">Tajribali ustozlardan amaliy bilim: kanallarini kuzating, darslarga yoziling, jonli efirlarda qatnashing.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <form action="/mentorlik" className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            {category && <input type="hidden" name="kasb" value={category} />}
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-4" />
            <input name="q" defaultValue={q} placeholder="Kurs qidirish…" aria-label="Kurs qidirish" className="field h-11 w-full !rounded-full pl-10 text-[14px]" />
          </form>
          <Link href="/kabinet/mentorlik" className="btn-accent inline-flex h-11 shrink-0 items-center rounded-full px-5 text-[14px] font-semibold">
            {myMentor?.isApproved ? "Mening sahifam" : "Ustoz bo'lish"}
          </Link>
        </div>
      </header>

      {/* Ustozlar — portret kartalari (har biri — o'z kanali) */}
      {mentors.length > 0 && !q && !category && (
        <section className="mt-6">
          <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(200px,250px))] sm:overflow-visible sm:px-0">
            {mentors.map((m) => (
              <li key={m.id} className="w-[200px] shrink-0 sm:w-auto">
                <Link href={`/mentorlik/ustoz/${m.slug}`} className="group relative block aspect-[3/4] overflow-hidden rounded-[24px] bg-surface-2">
                  {m.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photoUrl} alt={m.name} className="img-zoom absolute inset-0 h-full w-full object-cover object-top" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-fg/[0.04] to-fg/[0.14]">
                      <Avatar name={m.name} src={m.avatarUrl} size={88} decorative />
                    </div>
                  )}
                  <div className="absolute inset-x-2.5 bottom-2.5 rounded-[16px] bg-[#1b1b1d]/92 px-3.5 py-2.5 text-white ring-1 ring-white/12 backdrop-blur">
                    <p className="truncate font-display text-[15px] font-extrabold leading-tight">{m.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-[12px] text-white/65">{m.roleLabel || m.headline}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Yo'nalishlar */}
      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        {chip("kasb-all", withParam("kasb", undefined), "Barchasi", !category)}
        {MENTOR_CATEGORIES.filter((c) => c.key !== "boshqa").map((c) => chip(`kasb-${c.key}`, withParam("kasb", c.key), c.label, category === c.key))}
      </div>

      {/* Kurslar */}
      <section className="mt-5">
        <h2 className="mb-3 text-[15px] font-bold text-fg">{q ? `«${q}» bo'yicha` : category ? categoryLabel(category) : "Kurslar"} <span className="font-medium text-fg-4">· {courses.length}</span></h2>
        {courses.length === 0 ? (
          <div className="card grid place-items-center gap-2 p-10 text-center">
            <GraduationCap size={28} className="text-fg-4" />
            <p className="text-[14px] font-semibold text-fg">Hozircha kurs yo&apos;q</p>
            <p className="text-[13px] text-fg-3">Birinchi bo&apos;lib kurs oching — «Mentor bo&apos;lish».</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
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
