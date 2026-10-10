import { BadgeCheck, MapPinned, MessageSquareText, Sparkles } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CATEGORIES, REGIONS, SITE } from "@/lib/constants";

const FEATURES = [
  { icon: MapPinned, title: "Xaritadan toping", text: `${REGIONS.length} ta hudud — viloyatni bosing, ijodkorlar chiqadi.` },
  { icon: BadgeCheck, title: "Tasdiqlangan profillar", text: "Portfolio, narxlar va haqiqiy mijozlar sharhlari ochiq." },
  { icon: MessageSquareText, title: "To'g'ridan-to'g'ri buyurtma", text: "Loyihani yozing — mutaxassis kabinetida darhol ko'radi." },
];

/* Dekorativ suzuvchi chiplar: o'z zonasida, matn bilan to'qnashmaydi */
const FLOATING = CATEGORIES.slice(0, 4).map((c, i) => ({
  ...c,
  pos: [
    { left: "0%", top: "4%" },
    { right: "6%", top: "0%" },
    { left: "24%", bottom: "6%" },
    { right: "0%", bottom: "14%" },
  ][i],
  slow: i % 2 === 1,
}));

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-x">
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[1.05fr_1fr] lg:items-stretch">
          {/* ---------- Chap: brend paneli (faqat desktop) ---------- */}
          <aside className="glass relative hidden overflow-hidden !rounded-[36px] p-10 lg:flex lg:flex-col lg:justify-between" aria-hidden="true">
            {/* Yumshoq rangli dog'lar */}
            <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-tint/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-ios-purple/25 blur-3xl" />
            <div className="pointer-events-none absolute right-10 top-1/3 h-40 w-40 rounded-full bg-ios-pink/20 blur-3xl" />

            <div className="relative">
              <Logo />
              <span className="glass-weak glass-pill mt-8 inline-flex items-center gap-2 px-3.5 py-1.5 text-[12px] font-semibold text-tint">
                <Sparkles size={14} /> {SITE.tagline}
              </span>
              <h2 className="mt-5 max-w-sm text-[34px] font-bold leading-[1.08] tracking-tight text-fg">
                Ijodkorlar va mijozlar <span className="text-gradient">bir xaritada</span>
              </h2>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-fg-2">
                Videograf, montajor, dizayner — O'zbekistonning har bir hududida. Ro'yxatdan o'ting va to'g'ridan-to'g'ri bog'laning.
              </p>
            </div>

            {/* Suzuvchi yo'nalish chiplari — matn va ro'yxat orasidagi bo'sh zonada */}
            <div className="pointer-events-none relative my-6 max-h-56 min-h-[112px] flex-1">
              {FLOATING.map((c, i) => (
                <span
                  key={c.slug}
                  className={`glass-strong absolute flex items-center gap-2 !rounded-full py-1.5 pl-1.5 pr-3.5 text-[12px] font-semibold text-fg ${c.slow ? "animate-float-slow" : "animate-float"}`}
                  style={{ ...c.pos, animationDelay: `${i * 0.9}s` }}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: c.accent }}>
                    <CategoryIcon icon={c.icon} size={13} />
                  </span>
                  {c.name}
                </span>
              ))}
            </div>

            <ul className="relative space-y-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="glass-weak flex items-start gap-3 !rounded-[20px] px-4 py-3">
                  <span className="glass-tint flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]">
                    <f.icon size={17} />
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold text-fg">{f.title}</span>
                    <span className="block text-[12px] leading-snug text-fg-3">{f.text}</span>
                  </span>
                </li>
              ))}
            </ul>

            <p className="relative mt-6 text-[12px] text-fg-4">
              {REGIONS.length} hudud · {CATEGORIES.length} yo'nalish · Bepul ro'yxatdan o'tish
            </p>
          </aside>

          {/* ---------- O'ng: forma kartasi ---------- */}
          <section className="glass-strong flex flex-col justify-center !rounded-[28px] p-5 sm:p-8" aria-label="Autentifikatsiya">
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
