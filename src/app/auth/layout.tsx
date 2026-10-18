import { BadgeCheck, MapPinned, MessageSquareText } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { AUTH } from "@/lib/i18n/dict/auth";
import { getSiteStats } from "@/lib/queries";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const til = await getLocale();
  const site = await getSiteStats().catch(() => ({ specialists: 0, orders: 0, reviews: 0, regions: 0 }));

  const benefits = [
    { icon: MapPinned, title: tr(til, AUTH.panel.b1Title), text: AUTH.panel.b1Text[til](REGIONS.length) },
    { icon: BadgeCheck, title: tr(til, AUTH.panel.b2Title), text: tr(til, AUTH.panel.b2Text) },
    { icon: MessageSquareText, title: tr(til, AUTH.panel.b3Title), text: tr(til, AUTH.panel.b3Text) },
  ];
  const stats = [
    { value: `${site.specialists}+`, label: tr(til, AUTH.panel.statSpecialists) },
    { value: String(REGIONS.length), label: tr(til, AUTH.panel.statRegions) },
    { value: String(CATEGORIES.length), label: tr(til, AUTH.panel.statCategories) },
  ];

  return (
    <div className="container-x">
      <div className="flex min-h-[70vh] items-center justify-center">
        {/* items-stretch: qisqa forma (kirish) panel balandligiga cho'ziladi; panel self-start — o'z balandligida, sticky */}
        <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[1.05fr_1fr] lg:items-stretch">
          {/* ---------- Chap: editorial brend paneli (faqat desktop) ---------- */}
          <aside className="card relative hidden overflow-hidden p-10 lg:sticky lg:top-28 lg:flex lg:flex-col lg:self-start" aria-hidden="true">
            <div className="flex-1">
              {/* Logo ham, eyebrow ham inline-flex — alohida qatorga tushishi uchun blok o'ram */}
              <div>
                <Logo />
              </div>
              <span className="eyebrow mt-12">{tr(til, AUTH.panel.eyebrow)}</span>
              <h2 className="display-xl mt-5 max-w-md text-[40px] text-fg xl:text-[46px]">
                {tr(til, AUTH.panel.titleA)}
                <span className="accent-serif text-accent">{tr(til, AUTH.panel.titleAccent)}</span>
              </h2>
              <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-fg-2">{tr(til, AUTH.panel.lead)}</p>
            </div>

            <ul className="mb-8 mt-10 divide-y divide-line border-y border-line">
              {benefits.map((b) => (
                <li key={b.title} className="flex items-start gap-4 py-4">
                  <span className="icon-tile-outline icon-tile-sm shrink-0" aria-hidden="true">
                    <b.icon size={16} />
                  </span>
                  <span>
                    <span className="block font-display text-[15px] font-semibold text-fg">{b.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-fg-3">{b.text}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-end gap-8">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="font-display text-[26px] font-semibold leading-none tracking-tight text-fg">{s.value}</div>
                  <div className="mt-1.5 text-[12px] font-medium text-fg-3">{s.label}</div>
                </div>
              ))}
              <div className="ml-auto text-[12px] text-fg-4">{tr(til, AUTH.panel.freeSignup)}</div>
            </div>
          </aside>

          {/* ---------- O'ng: forma kartasi ---------- */}
          <section className="card-elevated flex flex-col justify-center p-5 sm:p-8" aria-label={tr(til, AUTH.panel.sectionAria)}>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
