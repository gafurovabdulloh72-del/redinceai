import { AuthStage } from "@/components/auth/AuthStage";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { AUTH } from "@/lib/i18n/dict/auth";
import { getSiteStats } from "@/lib/queries";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const til = await getLocale();
  const site = await getSiteStats().catch(() => ({ specialists: 0, orders: 0, reviews: 0, regions: 0 }));

  const benefits = [
    { icon: "map" as const, title: tr(til, AUTH.panel.b1Title), text: AUTH.panel.b1Text[til](REGIONS.length) },
    { icon: "badge" as const, title: tr(til, AUTH.panel.b2Title), text: tr(til, AUTH.panel.b2Text) },
    { icon: "chat" as const, title: tr(til, AUTH.panel.b3Title), text: tr(til, AUTH.panel.b3Text) },
  ];
  const stats = [
    { value: site.specialists, suffix: "+", label: tr(til, AUTH.panel.statSpecialists) },
    { value: REGIONS.length, label: tr(til, AUTH.panel.statRegions) },
    { value: CATEGORIES.length, label: tr(til, AUTH.panel.statCategories) },
  ];

  return (
    // data-auth-screen: globals.css telefonda yuqori panel/pastki tabni yashiradi va main paddingini olib tashlaydi — sahifa BITTA ekranga sig'adi.
    // Telefonda forma tepadan boshlanadi (qadamlar almashganda ko'rsatkich joyidan siljimaydi). Desktopda balandlik = ko'rinish oynasi − main paddinglari (pt-8 + pb-12 = 5rem) − 2rem (yuqori o'ng til/tema kapsulasi ostida qolmasin)
    <div data-auth-screen className="container-x flex min-h-dvh flex-col md:min-h-[calc(100dvh-7rem)] md:pt-8">
      {/* Telefon: o'z ixcham sarlavhamiz (umumiy yuqori panel yashirin) — belgi, til, tema */}
      <header className="flex h-14 shrink-0 items-center justify-between short:h-12 md:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <LocaleSwitch />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 items-start justify-center pb-3 pt-2 md:items-center md:pb-0 md:pt-0">
        <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[1.05fr_1fr] lg:items-stretch">
          {/* ---------- Chap: jonli brend sahnasi (faqat desktop) ---------- */}
          <AuthStage
            eyebrow={tr(til, AUTH.panel.eyebrow)}
            titleA={tr(til, AUTH.panel.titleA)}
            titleAccent={tr(til, AUTH.panel.titleAccent)}
            lead={tr(til, AUTH.panel.lead)}
            benefits={benefits}
            stats={stats}
            freeSignup={tr(til, AUTH.panel.freeSignup)}
            pickerLabel={tr(til, AUTH.panel.needLabel)}
          />

          {/* ---------- O'ng: forma kartasi. Telefonda ramkasiz (kenglik tejaladi); md+ da balandlik oynadan oshsa karta ichida aylanadi, sahifa emas ---------- */}
          <section
            className="card-elevated animate-tilt-in flex flex-col justify-center p-5 max-sm:!border-0 max-sm:!bg-transparent max-sm:!p-0 max-sm:!shadow-none sm:p-8 short:sm:p-6 tiny:sm:!p-4 md:max-h-[calc(100dvh-7rem)] md:overflow-y-auto"
            aria-label={tr(til, AUTH.panel.sectionAria)}
          >
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
