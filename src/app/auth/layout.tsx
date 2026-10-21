import { AuthStage } from "@/components/auth/AuthStage";
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
    <div className="container-x">
      <div className="flex min-h-[70vh] items-center justify-center">
        {/* items-stretch: qisqa forma (kirish) panel balandligiga cho'ziladi; panel self-start — o'z balandligida, sticky */}
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

          {/* ---------- O'ng: forma kartasi ---------- */}
          <section className="card-elevated animate-tilt-in flex flex-col justify-center p-5 sm:p-8" aria-label={tr(til, AUTH.panel.sectionAria)}>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
