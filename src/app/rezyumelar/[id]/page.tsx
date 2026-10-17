import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ExternalLink, MapPin, MessageCircle, Pencil, UserRound, Wallet } from "lucide-react";
import { Avatar } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { RESUME_EXPERIENCE, RESUME_FORMAT, professionLabel, salaryLabel, vacancyRegionLabel } from "@/lib/vacancies/format";
import { getResumeView } from "@/lib/vacancies/service";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const r = await getResumeView(id, null);
  if (!r) return { title: "Rezyume topilmadi", robots: { index: false } };
  return { title: `${r.title} — ${r.user.name}`, description: r.summary.slice(0, 160) || `${r.user.name}: ${professionLabel(r.profession)}`, alternates: { canonical: `/rezyumelar/${r.id}` } };
}

/** Ommaviy rezyume: kontaktsiz — "Chatda yozish" (kirgan foydalanuvchi) va mutaxassis profili havolasi */
export default async function ResumePage({ params }: { params: Params }) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  const r = await getResumeView(id, user ? { id: user.id, role: user.role } : null);
  if (!r) notFound();
  return (
    <div className="container-x animate-fade-up">
      <nav aria-label="Yo'l" className="text-[13px] text-fg-3">
        <Link href="/rezyumelar" className="transition hover:text-fg">
          Rezyumelar
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg-2">{r.user.name}</span>
      </nav>
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-5 lg:col-span-8">
          <header className="card p-5 sm:p-7">
            {!r.isPublic && <p className="mb-4 rounded-[14px] bg-warning-soft px-4 py-2.5 text-[13px] font-semibold text-warning-text">Bu rezyume katalogda ko&apos;rinmaydi — faqat siz ko&apos;ryapsiz.</p>}
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={r.user.name} src={r.user.avatarUrl} size={72} />
              <div className="min-w-0">
                <h1 className="display-xl text-[26px] text-fg sm:text-[34px]">{r.title}</h1>
                <p className="mt-1 inline-flex items-center gap-1.5 text-[15px] text-fg-2">
                  {r.user.name}
                  {r.user.emailVerified && <BadgeCheck size={15} className="text-success-text" aria-label="Email tasdiqlangan" />}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
              <span className="rounded-full bg-fg/6 px-2.5 py-1 text-fg-2">{professionLabel(r.profession)}</span>
              <span className="rounded-full border border-line px-2.5 py-1 text-fg-2">{RESUME_EXPERIENCE[r.experience]}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-fg-2">
                <MapPin size={12} /> {RESUME_FORMAT[r.format]}
                {r.format !== "remote" && ` · ${vacancyRegionLabel(r.regionSlug, true)}`}
              </span>
            </div>
            <p className="mt-5 inline-flex items-baseline gap-2 font-display text-[22px] font-semibold text-fg">
              <Wallet size={18} className="self-center text-accent" /> {salaryLabel(r.expectedSalary, null)}
              {r.expectedSalary && <span className="text-[13px] font-medium text-fg-3">so&apos;m / oy</span>}
            </p>
          </header>
          {r.summary && (
            <section className="card p-5 sm:p-6">
              <h2 className="font-display text-[18px] font-semibold text-fg">Men haqimda</h2>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-fg-2">{r.summary}</p>
            </section>
          )}
          {r.skills.length > 0 && (
            <section className="card p-5 sm:p-6">
              <h2 className="font-display text-[18px] font-semibold text-fg">Ko&apos;nikmalar</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {r.skills.map((s) => (
                  <li key={s} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-fg-2">
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {r.links.length > 0 && (
            <section className="card p-5 sm:p-6">
              <h2 className="font-display text-[18px] font-semibold text-fg">Havolalar</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {r.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center justify-between gap-2 rounded-[14px] border border-line px-4 py-3 text-[14px] font-semibold text-fg transition hover:border-fg">
                      <span className="truncate">{l.label}</span>
                      <ExternalLink size={14} className="shrink-0 text-fg-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:col-span-4">
          <div className="card p-5">
            {r.isOwner ? (
              <>
                <p className="text-[15px] font-semibold text-fg">Bu sizning rezyumeingiz</p>
                <Link href="/kabinet/rezyume" className="btn-ink mt-3 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold">
                  <Pencil size={14} /> Tahrirlash
                </Link>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-fg">Nomzod bilan bog&apos;lanish</p>
                <p className="mt-1 text-[13px] text-fg-3">Kontakt ochiq ko&apos;rsatilmaydi — sayt ichidagi chat orqali yozing yoki vakansiya joylang, nomzod o&apos;zi ariza yuboradi.</p>
                <div className="mt-3 grid gap-2">
                  {r.user.username ? (
                    <Link href={user ? `/yozish/${r.user.username}` : `/auth/kirish?next=${encodeURIComponent(`/yozish/${r.user.username}`)}`} className="btn-ink inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold">
                      <MessageCircle size={15} /> Chatda yozish
                    </Link>
                  ) : null}
                  {r.user.specialistSlug && (
                    <Link href={`/mutaxassislar/${r.user.specialistSlug}`} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-line-2 px-4 text-[14px] font-semibold text-fg">
                      <UserRound size={15} /> Mutaxassis profili
                    </Link>
                  )}
                  <Link href="/vakansiyalar/yangi" className="inline-flex h-11 items-center justify-center rounded-full border border-line-2 px-4 text-[14px] font-semibold text-fg-2 hover:text-fg">
                    Vakansiya joylash
                  </Link>
                </div>
              </>
            )}
          </div>
          <p className="px-1 text-[12px] text-fg-4">Yangilangan: {formatDateTime(r.updatedAt)}</p>
        </aside>
      </div>
    </div>
  );
}
