import { BadgeCheck, MapPinned, MessageSquareText } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { getSiteStats } from "@/lib/queries";

const BENEFITS = [
  { icon: MapPinned, title: "Xaritadan toping", text: `${REGIONS.length} ta hudud — viloyatni bosing, ijodkorlar chiqadi.` },
  { icon: BadgeCheck, title: "Tasdiqlangan profillar", text: "Portfolio, narxlar va haqiqiy mijozlar sharhlari ochiq." },
  { icon: MessageSquareText, title: "To'g'ridan-to'g'ri buyurtma", text: "Loyihani yozing — mutaxassis kabinetida darhol ko'radi." },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteStats().catch(() => ({ specialists: 0, orders: 0, reviews: 0, regions: 0 }));
  const stats = [
    { value: `${site.specialists}+`, label: "mutaxassis" },
    { value: String(REGIONS.length), label: "hudud" },
    { value: String(CATEGORIES.length), label: "yo'nalish" },
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
              <span className="eyebrow mt-12">O'zbekiston ijodkorlar xaritasi</span>
              <h2 className="display-xl mt-5 max-w-md text-[40px] text-fg xl:text-[46px]">
                Ijodkorlar va mijozlar <span className="accent-serif text-accent">bir xaritada</span>
              </h2>
              <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-fg-2">
                Videograf, montajor, dizayner — O'zbekistonning har bir hududida. Ro'yxatdan o'ting va to'g'ridan-to'g'ri bog'laning.
              </p>
            </div>

            <ul className="mb-8 mt-10 divide-y divide-line border-y border-line">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex items-start gap-4 py-4">
                  <span className="btn-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]">
                    <b.icon size={17} />
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
              <div className="ml-auto text-[12px] text-fg-4">Ro'yxatdan o'tish bepul</div>
            </div>
          </aside>

          {/* ---------- O'ng: forma kartasi ---------- */}
          <section className="card-elevated flex flex-col justify-center p-5 sm:p-8" aria-label="Autentifikatsiya">
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
