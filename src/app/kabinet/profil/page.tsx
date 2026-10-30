import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PartyPopper } from "lucide-react";
import { AccountForm } from "@/components/kabinet/AccountForm";
import { PrivacySettings } from "@/components/kabinet/PrivacySettings";
import { ProfileForm, type ProfileInitial, type ProfilePrefill } from "@/components/kabinet/ProfileForm";
import { CATEGORY_BY_SLUG, EXPERIENCE_LEVELS, REGION_BY_SLUG } from "@/lib/constants";
import { getSettings } from "@/lib/payments/settings";
import { ScheduleEditor } from "@/components/kabinet/ScheduleEditor";
import { TelegramCard } from "@/components/kabinet/TelegramCard";
import { ProfilePanels } from "@/components/kabinet/ProfilePanels";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { resolveVisibility } from "@/lib/privacy";
import { isTelegramEnabled, telegramBotUsername } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profil" };

export default async function ProfilPage({ searchParams }: { searchParams: Promise<{ welcome?: string; category?: string; experience?: string; region?: string }> }) {
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
        priceCurrency: s.priceCurrency,
        priceUsdFrom: s.priceUsdFrom,
        priceUsdTo: s.priceUsdTo,
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
  // Ro'yxatdan o'tishda tanlangan kasb/tajriba/hudud — faqat hali profil yo'q bo'lganda oldindan to'ldiriladi (qiymatlar tekshiriladi)
  const prefill: ProfilePrefill | null =
    !s && (sp.category || sp.experience || sp.region)
      ? {
          category: sp.category && CATEGORY_BY_SLUG[sp.category] ? sp.category : undefined,
          experience: EXPERIENCE_LEVELS.some((e) => e.value === sp.experience) ? (sp.experience as ProfilePrefill["experience"]) : undefined,
          regionSlug: sp.region && REGION_BY_SLUG[sp.region] ? sp.region : undefined,
        }
      : null;
  const usdRate = (await getSettings()).usdRate;
  const firstName = user.name.split(" ")[0] || user.name;
  const ctaFirst = !s && user.role === "client";
  // Telegram kartasi faqat bot to'liq sozlangan bo'lsa (token + username) ko'rinadi — server'da env tekshiriladi
  const telegramEnabled = isTelegramEnabled() && Boolean(telegramBotUsername());


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

      {/* Bo'limlar: telefonda tablar (faqat tanlangani chiziladi), sm+ da chiplar + hammasi ustma-ust */}
      <ProfilePanels
        panels={[
          { key: "akkaunt", label: "Akkaunt", icon: "user", node: <AccountForm initial={{ name: user.name, phone: user.phone ?? "", avatarUrl: user.avatarUrl ?? "", email: user.email, username: user.username ?? null, emailVerified: user.emailVerified, gender: user.gender ?? null, notifyEmail: user.notifyEmail }} visibility={visibility} /> },
          ...(telegramEnabled ? [{ key: "telegram", label: "Telegram", icon: "send" as const, node: <TelegramCard linked={Boolean(user.telegramChatId)} /> }] : []),
          { key: "mutaxassis", label: s ? "Mutaxassis profili" : "Mutaxassis bo'lish", icon: "briefcase", node: <ProfileForm initial={initial} mode={s ? "edit" : "create"} ctaFirst={ctaFirst} visibility={visibility} prefill={prefill} usdRate={usdRate} /> },
          ...(s
            ? [
                {
                  key: "maxfiylik",
                  label: "Maxfiylik",
                  icon: "shield" as const,
                  node: (
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
                  ),
                },
                { key: "ish-vaqti", label: "Ish vaqti", icon: "clock" as const, node: <ScheduleEditor initial={s.schedule ?? null} vacationUntil={s.vacationUntil ?? null} blockedDates={s.blockedDates ?? []} /> },
              ]
            : []),
        ]}
      />
    </div>
  );
}
