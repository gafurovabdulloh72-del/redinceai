import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Clock3, PartyPopper, Send, ShieldCheck, UserRound } from "lucide-react";
import { AccountForm } from "@/components/kabinet/AccountForm";
import { PrivacySettings } from "@/components/kabinet/PrivacySettings";
import { ProfileForm, type ProfileInitial } from "@/components/kabinet/ProfileForm";
import { ScheduleEditor } from "@/components/kabinet/ScheduleEditor";
import { TelegramCard } from "@/components/kabinet/TelegramCard";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { resolveVisibility } from "@/lib/privacy";
import { isTelegramEnabled, telegramBotUsername } from "@/lib/telegram";

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
        equipment: s.equipment ?? [],
        languages: s.languages,
        telegram: s.telegram ?? "",
        instagram: s.instagram ?? "",
        youtube: s.youtube ?? "",
        website: s.website ?? "",
        coverUrl: s.coverUrl ?? "",
        isAvailable: s.isAvailable,
        packages: s.packages ?? [],
        certificates: s.certificates ?? [],
        workHistory: s.workHistory ?? [],
        education: s.education ?? [],
        workTypes: s.workTypes ?? [],
        rates: s.rates ?? {},
      }
    : null;

  const welcome = sp.welcome === "1";
  const firstName = user.name.split(" ")[0] || user.name;
  const ctaFirst = !s && user.role === "client";
  // Telegram kartasi faqat bot to'liq sozlangan bo'lsa (token + username) ko'rinadi — server'da env tekshiriladi
  const telegramEnabled = isTelegramEnabled() && Boolean(telegramBotUsername());

  const sections = [
    { href: "#akkaunt", label: "Akkaunt", icon: UserRound },
    ...(telegramEnabled ? [{ href: "#telegram", label: "Telegram", icon: Send }] : []),
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
        <div className="card mb-5 p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent-text">
              <PartyPopper size={18} />
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
        <span className="eyebrow">Kabinet</span>
        <h1 className="display-xl mt-4 text-fg">
          Profil va <span className="accent-serif">maxfiylik</span>
        </h1>
        <p className="mt-2 max-w-xl text-[14px] text-fg-2">
          {s ? "Akkaunt, mutaxassis profili, ko'rinish va ish vaqti." : user.role === "specialist" ? "Avval akkaunt, keyin mutaxassis profilini to'ldiring." : "Akkaunt ma'lumotlari. Xohlasangiz, mutaxassis profilini ham ochasiz."}
        </p>
      </div>

      {/* Bo'limlar bo'ylab tez o'tish */}
      <nav aria-label="Bo'limlar" className="no-scrollbar -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1.5">
          {sections.map((x) => (
            <li key={x.href}>
              <Link href={x.href} className="press inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                <x.icon size={14} className="text-fg-3" /> {x.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="stagger space-y-5 [&>*]:animate-fade-up">
        <AccountForm initial={{ name: user.name, phone: user.phone ?? "", avatarUrl: user.avatarUrl ?? "", email: user.email, username: user.username ?? null, emailVerified: user.emailVerified, gender: user.gender ?? null, notifyEmail: user.notifyEmail }} visibility={visibility} />

        {telegramEnabled && <TelegramCard linked={Boolean(user.telegramChatId)} />}

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
            <ScheduleEditor initial={s.schedule ?? null} vacationUntil={s.vacationUntil ?? null} blockedDates={s.blockedDates ?? []} />
          </>
        )}
      </div>
    </div>
  );
}
