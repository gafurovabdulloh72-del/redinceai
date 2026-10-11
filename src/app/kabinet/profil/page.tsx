import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Clock3, PartyPopper, ShieldCheck, UserRound } from "lucide-react";
import { AccountForm } from "@/components/kabinet/AccountForm";
import { PrivacySettings } from "@/components/kabinet/PrivacySettings";
import { ProfileForm, type ProfileInitial } from "@/components/kabinet/ProfileForm";
import { ScheduleEditor } from "@/components/kabinet/ScheduleEditor";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { resolveVisibility } from "@/lib/privacy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profil" };

export default async function ProfilPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/profil"));

  const s = user.specialist;
  const visibility = s ? resolveVisibility(s.visibility) : null;
  const initial: ProfileInitial | null = s
    ? {
        slug: s.slug,
        title: s.title,
        category: s.category,
        regionSlug: s.regionSlug,
        city: s.city,
        bio: s.bio,
        priceFrom: s.priceFrom,
        priceTo: s.priceTo,
        experience: s.experience,
        skills: s.skills,
        languages: s.languages,
        telegram: s.telegram ?? "",
        instagram: s.instagram ?? "",
        youtube: s.youtube ?? "",
        website: s.website ?? "",
        coverUrl: s.coverUrl ?? "",
        isAvailable: s.isAvailable,
      }
    : null;

  const welcome = sp.welcome === "1";
  const firstName = user.name.split(" ")[0] || user.name;
  const ctaFirst = !s && user.role === "client";

  const sections = [
    { href: "#akkaunt", label: "Akkaunt", icon: UserRound },
    { href: "#mutaxassis", label: s ? "Mutaxassis profili" : "Mutaxassis bo'lish", icon: Briefcase },
    ...(s
      ? [
          { href: "#maxfiylik", label: "Maxfiylik", icon: ShieldCheck },
          { href: "#ish-vaqti", label: "Ish vaqti", icon: Clock3 },
        ]
      : []),
  ];

  return (
    <div className="animate-fade-up">
      {/* Xush kelibsiz */}
      {welcome && (
        <div className="card-elevated relative mb-5 overflow-hidden p-5 sm:p-6">
          <span className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-accent-soft text-accent">
              <PartyPopper size={20} />
            </span>
            <div>
              <p className="font-display text-[18px] font-semibold leading-tight text-fg">Xush kelibsiz, {firstName}!</p>
              <p className="mt-1 text-[14px] leading-snug text-fg-2">
                {user.role === "specialist" && !s
                  ? "Quyida mutaxassis profilingizni to'ldiring — shunda mijozlar sizni xaritadan topadi."
                  : user.role === "client"
                    ? "Akkaunt ma'lumotlarini tekshiring. Mutaxassis topish uchun xaritaga o'ting yoki o'zingiz profil oching."
                    : "Akkaunt ma'lumotlaringizni tekshirib chiqing."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sarlavha */}
      <div className="mb-5 sm:mb-6">
        <span className="eyebrow">Sozlamalar</span>
        <h1 className="display-xl mt-4 text-[32px] text-fg sm:text-[40px]">
          Profil va <span className="accent-serif text-accent">maxfiylik</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] text-fg-2">
          {s
            ? "Akkaunt, mutaxassis profili, kim nimani ko'rishi va ish vaqtingiz — hammasi shu yerda."
            : user.role === "specialist"
              ? "Avval akkaunt, keyin mutaxassis profilini to'ldiring."
              : "Akkaunt ma'lumotlaringiz. Xohlasangiz, mutaxassis profilini ham ochishingiz mumkin."}
        </p>
      </div>

      {/* Bo'limlar bo'ylab tez o'tish */}
      <nav aria-label="Bo'limlar" className="no-scrollbar -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1.5">
          {sections.map((x) => (
            <li key={x.href}>
              <Link href={x.href} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                <x.icon size={14} className="text-accent" /> {x.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-5">
        <AccountForm initial={{ name: user.name, phone: user.phone ?? "", avatarUrl: user.avatarUrl ?? "", email: user.email, gender: user.gender ?? null }} visibility={visibility} />

        <ProfileForm initial={initial} mode={s ? "edit" : "create"} ctaFirst={ctaFirst} visibility={visibility} />

        {s && (
          <>
            <PrivacySettings
              initial={visibility ?? resolveVisibility(s.visibility)}
              slug={s.slug}
              present={{
                phone: Boolean(user.phone),
                telegram: Boolean(s.telegram),
                instagram: Boolean(s.instagram),
                youtube: Boolean(s.youtube),
                website: Boolean(s.website),
                email: true,
                schedule: Boolean(s.schedule),
                gender: Boolean(user.gender),
                city: true,
              }}
            />
            <ScheduleEditor initial={s.schedule ?? null} vacationUntil={s.vacationUntil ?? null} />
          </>
        )}
      </div>
    </div>
  );
}
