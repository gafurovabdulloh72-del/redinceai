import { AuthStage, ProfessionMarquee } from "@/components/auth/AuthStage";
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

  const stats = [
    { value: site.specialists, suffix: "+", label: tr(til, AUTH.panel.statSpecialists) },
    { value: REGIONS.length, label: tr(til, AUTH.panel.statRegions) },
    { value: CATEGORIES.length, label: tr(til, AUTH.panel.statCategories) },
  ];

  return (
    // data-auth-screen: globals.css ilova qobig'ini (yon menyu, telefon panellari, kapsula, main paddinglari) yashiradi —
    // auth to'liq ekranli va BITTA ekranga sig'adi. lg+: chapda qorong'u brend paneli, o'ngda forma; telefonda kasblar lentasi + forma
    <div data-auth-screen className="grid min-h-dvh lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      <AuthStage
        eyebrow={tr(til, AUTH.panel.eyebrow)}
        titleA={tr(til, AUTH.panel.titleA)}
        titleAccent={tr(til, AUTH.panel.titleAccent)}
        lead={tr(til, AUTH.panel.lead)}
        stats={stats}
        freeSignup={tr(til, AUTH.panel.freeSignup)}
        pickerLabel={tr(til, AUTH.panel.needLabel)}
      />

      <div className="flex min-h-dvh min-w-0 flex-col bg-bg" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <header className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-8 short:h-14">
          <Logo className="lg:invisible" />
          <div className="flex items-center gap-1">
            <LocaleSwitch />
            <ThemeToggle />
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center px-4 py-5 sm:px-8 short:py-3" aria-label={tr(til, AUTH.panel.sectionAria)}>
          <div className="animate-fade-up w-full max-w-[420px]">{children}</div>
        </section>

        {/* Telefon/planshet: brend paneli o'rniga ekran pastida kasblar lentasi — bo'sh joyni to'ldiradi, platforma ko'lamini ko'rsatadi */}
        <ProfessionMarquee rows={2} className="mb-4 lg:hidden short:[&>div:nth-child(2)]:hidden tiny:hidden" />
      </div>
    </div>
  );
}
