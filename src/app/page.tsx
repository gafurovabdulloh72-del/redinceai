import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPinned, MessageSquareText, Search, Sparkles, Star } from "lucide-react";
import { Hero3D } from "@/components/three/Hero3D";
import { HomeMapSection } from "@/components/map/HomeMapSection";
import { SpecialistCard } from "@/components/specialists/SpecialistCard";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { getCategoryStats, getFeaturedSpecialists, getRegionStats, getSiteStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [regionStats, categoryStats, featured, site] = await Promise.all([
    getRegionStats(),
    getCategoryStats(),
    getFeaturedSpecialists(6),
    getSiteStats(),
  ]);

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="container-x relative">
        <div className="glass relative overflow-hidden !rounded-[36px] px-5 pb-10 pt-12 sm:px-10 sm:pb-14 sm:pt-16 lg:px-14">
          {/* 3D sahna — o'ng tomonda, kartaning ichida */}
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] lg:block">
            <Hero3D className="h-full w-full" />
          </div>
          <div className="relative max-w-2xl">
            <span className="glass-weak glass-pill inline-flex items-center gap-2 px-3.5 py-1.5 text-[12px] font-semibold text-tint">
              <Sparkles size={14} /> O'zbekiston bo'ylab {site.specialists}+ ijodkor bir platformada
            </span>

            <h1 className="mt-6 text-[40px] font-bold leading-[1.02] tracking-tight text-fg sm:text-[56px] lg:text-[68px]">
              Videograf, montajor va dizaynerlarni{" "}
              <span className="text-gradient">xaritadan toping</span>
            </h1>

            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-fg-2 sm:text-[18px]">
              Viloyatni bosing — o'sha hududdagi tasdiqlangan mutaxassislar, portfoliolari, narxlari va sharhlari bir zumda. Buyurtma bering, to'g'ridan-to'g'ri bog'laning.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/xarita" size="lg" className="sm:min-w-[200px]">
                <MapPinned size={18} /> Xaritani ochish
              </ButtonLink>
              <ButtonLink href="/mutaxassislar" variant="glass" size="lg">
                <Search size={18} /> Mutaxassislar ro'yxati
              </ButtonLink>
            </div>

            {/* Statistika — kichik shisha chiplar */}
            <dl className="mt-10 grid grid-cols-3 gap-3 sm:max-w-md">
              {[
                { v: site.specialists, l: "Mutaxassis" },
                { v: site.regions, l: "Hudud" },
                { v: site.reviews, l: "Sharh" },
              ].map((s) => (
                <div key={s.l} className="glass-weak px-4 py-3 !rounded-[18px]">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-fg-3">{s.l}</dt>
                  <dd className="text-[24px] font-bold leading-tight text-fg">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Mobil/planshet: 3D sahna alohida blok sifatida, matn ustiga chiqmaydi */}
          <div className="relative -mx-5 -mb-10 mt-6 h-64 sm:-mx-10 sm:-mb-14 sm:h-72 lg:hidden">
            <Hero3D className="h-full w-full" />
          </div>
        </div>
      </section>

      {/* ================= XARITA ================= */}
      <section id="xarita" className="container-x mt-20 sm:mt-28">
        <SectionHeading
          eyebrow="Interaktiv xarita"
          title={
            <>
              Hududni tanlang — <span className="text-gradient">mutaxassislar chiqadi</span>
            </>
          }
          description="O'zbekistonning 14 ta hududi. Rang qancha to'q bo'lsa, u yerda shuncha ko'p ijodkor bor."
        />
        <HomeMapSection stats={regionStats} total={site.specialists} />
      </section>

      {/* ================= YO'NALISHLAR ================= */}
      <section className="container-x mt-20 sm:mt-28">
        <SectionHeading
          eyebrow="Yo'nalishlar"
          title="Kim kerak?"
          description="Har bir yo'nalish bo'yicha mutaxassislar soni jonli hisoblanadi."
          action={
            <ButtonLink href="/mutaxassislar" variant="glass" size="sm">
              Barchasi <ArrowRight size={14} />
            </ButtonLink>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} href={`/mutaxassislar?category=${c.slug}`} className="glass glass-hover group p-4 sm:p-5">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-[16px] text-white shadow-lg transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105"
                style={{ background: `linear-gradient(145deg, ${c.accent}, ${c.accent}aa)`, boxShadow: `0 10px 24px -10px ${c.accent}` }}
              >
                <CategoryIcon icon={c.icon} size={22} />
              </span>
              <h3 className="mt-4 text-[16px] font-semibold text-fg">{c.name}</h3>
              <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-fg-3">{c.description}</p>
              <p className="mt-3 text-[13px] font-semibold text-tint">{categoryStats[c.slug] ?? 0} ta mutaxassis</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= TAVSIYA ETILGANLAR ================= */}
      <section className="container-x mt-20 sm:mt-28">
        <SectionHeading
          eyebrow="Tavsiya etiladi"
          title="Eng yuqori reytingli ijodkorlar"
          description="Tasdiqlangan profil, haqiqiy sharhlar va ochiq narxlar."
          action={
            <ButtonLink href="/mutaxassislar?sort=rating" variant="glass" size="sm">
              Hammasini ko'rish <ArrowRight size={14} />
            </ButtonLink>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((sp, i) => (
            <SpecialistCard key={sp.id} sp={sp} priority={i < 3} />
          ))}
        </div>
      </section>

      {/* ================= QANDAY ISHLAYDI ================= */}
      <section className="container-x mt-20 sm:mt-28">
        <SectionHeading eyebrow="Qanday ishlaydi" title="Uch qadamda mutaxassis toping" align="center" />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: MapPinned, title: "Hududni tanlang", text: "Xaritada viloyatni bosing yoki shaharni qidiring. Yaqin atrofdagi ijodkorlar chiqadi." },
            { icon: BadgeCheck, title: "Profilni o'rganing", text: "Portfolio, narxlar, tajriba va haqiqiy mijozlar sharhlari — hammasi ochiq." },
            { icon: MessageSquareText, title: "Buyurtma bering", text: "Loyihangizni yozing, mutaxassis qabul qiladi va to'g'ridan-to'g'ri bog'lanadi." },
          ].map((s, i) => (
            <div key={s.title} className="glass relative p-6">
              <span className="absolute right-5 top-5 text-[48px] font-bold leading-none text-fg/6">{i + 1}</span>
              <span className="glass-tint flex h-12 w-12 items-center justify-center rounded-[16px]">
                <s.icon size={22} />
              </span>
              <h3 className="mt-5 text-[18px] font-semibold text-fg">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-fg-2">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= HUDUDLAR CHIPLARI ================= */}
      <section className="container-x mt-20 sm:mt-28">
        <SectionHeading eyebrow="Hududlar" title="Shahringiz bo'yicha qidiring" />
        <div className="flex flex-wrap gap-2.5">
          {REGIONS.map((r) => (
            <Link
              key={r.slug}
              href={`/mutaxassislar?region=${r.slug}`}
              className="glass glass-pill glass-hover inline-flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-fg"
            >
              {r.short}
              <span className="rounded-full bg-tint-soft px-2 py-0.5 text-[11px] font-bold text-tint">{regionStats[r.slug]?.total ?? 0}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="container-x mt-20 sm:mt-28">
        <div className="glass-strong relative overflow-hidden !rounded-[36px] px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-tint/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-ios-purple/25 blur-3xl" />
          <span className="glass-weak glass-pill inline-flex items-center gap-2 px-3.5 py-1.5 text-[12px] font-semibold text-tint">
            <Star size={14} /> Mutaxassislar uchun
          </span>
          <h2 className="mx-auto mt-5 max-w-2xl text-[30px] font-bold leading-tight tracking-tight text-fg sm:text-[44px]">
            Siz ijodkormisiz? Profil oching — mijozlar sizni xaritadan topsin
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-fg-2 sm:text-[17px]">
            Bepul ro'yxatdan o'ting, portfolio joylang, narxlaringizni belgilang. Buyurtmalar to'g'ridan-to'g'ri kabinetingizga keladi.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/auth/royxat?role=specialist" size="lg">
              Mutaxassis sifatida qo'shilish <ArrowRight size={18} />
            </ButtonLink>
            <ButtonLink href="/auth/royxat" variant="glass" size="lg">
              Mijoz sifatida boshlash
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
