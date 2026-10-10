import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PartyPopper, Settings } from "lucide-react";
import { AccountForm } from "@/components/kabinet/AccountForm";
import { ProfileForm, type ProfileInitial } from "@/components/kabinet/ProfileForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profil" };

export default async function ProfilPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/auth/kirish?next=%2Fkabinet%2Fprofil");

  const s = user.specialist;
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

  return (
    <div className="animate-fade-up">
      {/* Xush kelibsiz */}
      {welcome && (
        <div className="glass-strong relative mb-5 overflow-hidden !rounded-[24px] p-5 sm:p-6">
          <span className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-tint/25 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-ios-pink/20 blur-3xl" />
          <div className="relative flex items-start gap-3.5">
            <span className="glass-tint flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
              <PartyPopper size={20} />
            </span>
            <div>
              <p className="text-[18px] font-bold leading-tight text-fg">Xush kelibsiz, {firstName}!</p>
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
        <span className="glass-weak glass-pill inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-tint">
          <Settings size={12} /> Sozlamalar
        </span>
        <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-tight text-fg sm:text-4xl">Profil</h1>
        <p className="mt-1.5 text-[15px] text-fg-2">
          {s ? "Akkaunt va mutaxassis profilingizni shu yerda boshqarasiz." : user.role === "specialist" ? "Avval akkaunt, keyin mutaxassis profilini to'ldiring." : "Akkaunt ma'lumotlaringiz."}
        </p>
      </div>

      <div className="space-y-5">
        <AccountForm initial={{ name: user.name, phone: user.phone ?? "", avatarUrl: user.avatarUrl ?? "", email: user.email }} />

        <ProfileForm initial={initial} mode={s ? "edit" : "create"} ctaFirst={ctaFirst} />
      </div>
    </div>
  );
}
