import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, MapPinned, MessageSquareText, Play, Sparkles } from "lucide-react";
import { UzbekistanMap } from "@/components/map/UzbekistanMap";
import { HomeMapSection } from "@/components/map/HomeMapSection";
import { SpecialistCard } from "@/components/specialists/SpecialistCard";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Avatar, ButtonLink, SectionHeading } from "@/components/ui";
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
  const counts = Object.fromEntries(Object.values(regionStats).map((s) => [s.slug, s.total]));

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="container-x">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-6">
            <span className="eyebrow">O'zbekiston ijodkorlar xaritasi</span>
            <h1 className="display-xl mt-6 text-[36px] text-fg min-[420px]:text-[40px] sm:text-[58px] lg:text-[64px] xl:text-[76px]">
              Hududingizdagi
              <br />
              eng zo'r <span className="accent-serif text-accent">ijodkorlarni</span>
              <br />
              toping
            </h1>
            <p className="mt-7 max-w-lg text-[16px] leading-relaxed text-fg-2 sm:text-[18px]">
              Videograf, montajor, dizayner va boshqa ijodkorlar — 14 ta hudud bo'ylab. Xaritada viloyatni bosing, portfolio va narxlarni ko'ring, to'g'ridan-to'g'ri buyurtma bering.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/xarita" variant="accent" size="lg" className="sm:min-w-[210px]">
                <MapPinned size={18} /> Xaritani ochish
              </ButtonLink>
              <ButtonLink href="/mutaxassislar" variant="outline" size="lg">
                Mutaxassislar ro'yxati <ArrowRight size={16} />
              </ButtonLink>
            </div>

            {/* Ishonch qatori */}
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
              <div className="flex items-center">
                <div className="flex -space-x-2.5">
                  {featured.slice(0, 4).map((sp) => (
                    <Avatar key={sp.id} name={sp.user.name} src={sp.user.avatarUrl} size={36} className="!ring-bg" />
                  ))}
                </div>
                <div className="ml-3 leading-tight">
                  <p className="font-display text-[15px] font-semibold text-fg">{site.specialists}+ mutaxassis</p>
                  <p className="text-[12px] text-fg-3">{site.regions} ta hududda</p>
                </div>
              </div>
              <div className="hidden h-8 w-px bg-line sm:block" />
              <div className="flex items-center gap-2 text-[13px] text-fg-2">
                <BadgeCheck size={16} className="text-accent" /> Tasdiqlangan profillar
              </div>
              <div className="flex items-center gap-2 text-[13px] text-fg-2">
                <Sparkles size={16} className="text-accent-2" /> {site.reviews} ta haqiqiy sharh
              </div>
            </div>
          </div>

          {/* Xarita */}
          <div className="relative lg:col-span-6">
            <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[70%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[90px] dark:bg-accent/20" />
            <UzbekistanMap counts={counts} variant="hero" linkTo="mutaxassislar" showLabels={false} className="w-full py-4 lg:-mr-6 lg:w-[112%] lg:max-w-none" />
            <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-2 sm:bottom-4 sm:left-4">
              <span className="card flex items-center gap-2 !rounded-full px-3 py-1.5 text-[11px] font-semibold text-fg-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-70 animate-pulse-ring" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                Jonli xarita — hududni bosing
              </span>
            </div>
            <div className="pointer-events-none absolute right-2 top-2 hidden items-center gap-1.5 sm:flex">
              <span className="text-[11px] font-semibold text-fg-3">kam</span>
              <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(90deg, var(--surface-3), var(--accent))" }} />
              <span className="text-[11px] font-semibold text-fg-3">ko'p</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= KATEGORIYA LENTASI ================= */}
      <section className="mt-16 overflow-hidden border-y border-line py-4 sm:mt-24">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
          {[...CATEGORIES, ...CATEGORIES].map((c, i) => (
            <Link key={`${c.slug}-${i}`} href={`/mutaxassislar?category=${c.slug}`} className="group flex items-center gap-3 text-fg-3 transition hover:text-fg">
              <CategoryIcon icon={c.icon} size={18} style={{ color: c.accent }} />
              <span className="font-display text-[15px] font-medium tracking-tight">{c.plural}</span>
              <span className="rounded-full bg-fg/6 px-2 py-0.5 text-[11px] font-bold text-fg-2">{categoryStats[c.slug] ?? 0}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= INTERAKTIV XARITA ================= */}
      <section id="xarita" className="container-x mt-20 sm:mt-28">
        <SectionHeading
          eyebrow="Interaktiv xarita"
          title={
            <>
              Hududni tanlang — <span className="accent-serif text-accent">mutaxassislar</span> chiqadi
            </>
          }
          description="14 ta hudud. Rang qancha to'q bo'lsa, u yerda shuncha ko'p ijodkor bor. Bosing — yo'nalishlar bo'yicha taqsimot va ro'yxat ochiladi."
        />
        <HomeMapSection stats={regionStats} total={site.specialists} />
      </section>

      {/* ================= YO'NALISHLAR (bento) ================= */}
      <section className="container-x mt-20 sm:mt-28">
        <SectionHeading
          eyebrow="Yo'nalishlar"
          title="Kim kerak?"
          description="Har bir yo'nalish bo'yicha mutaxassislar soni jonli hisoblanadi."
          action={
            <ButtonLink href="/mutaxassislar" variant="outline" size="sm">
              Barchasi <ArrowRight size={14} />
            </ButtonLink>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {CATEGORIES.map((c, i) => (
            <Link
              key={c.slug}
              href={`/mutaxassislar?category=${c.slug}`}
              className={`card card-hover group relative overflow-hidden p-5 sm:p-6 ${i === 0 ? "col-span-2 lg:row-span-2" : ""}`}
            >
              <span
                className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-[0.14] blur-3xl transition-opacity duration-500 group-hover:opacity-30"
                style={{ background: c.accent }}
              />
              <span
                className="flex h-12 w-12 items-center justify-center rounded-[14px] text-white transition-transform duration-500 group-hover:-rotate-6"
                style={{ background: c.accent, boxShadow: `0 12px 28px -12px ${c.accent}` }}
              >
                <CategoryIcon icon={c.icon} size={22} />
              </span>
              <h3 className={`mt-5 font-display font-semibold text-fg ${i === 0 ? "text-[24px] sm:text-[30px]" : "text-[17px]"}`}>{c.name}</h3>
              <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-fg-3">{c.description}</p>
              <div className="mt-5 flex items-center justify-between">
                <span className="font-display text-[22px] font-semibold text-fg">
                  {categoryStats[c.slug] ?? 0}
                  <span className="ml-1 text-[12px] font-medium text-fg-3">mutaxassis</span>
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-fg-3 transition group-hover:border-fg group-hover:text-fg">
                  <ArrowUpRight size={15} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= TAVSIYA ETILGANLAR ================= */}
      <section className="container-x mt-20 sm:mt-28">
        <SectionHeading
          eyebrow="Tavsiya etiladi"
          title={
            <>
              Eng yuqori <span className="accent-serif text-accent">reytingli</span> ijodkorlar
            </>
          }
          description="Tasdiqlangan profil, haqiqiy sharhlar va ochiq narxlar."
          action={
            <ButtonLink href="/mutaxassislar?sort=rating" variant="outline" size="sm">
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
        <SectionHeading eyebrow="Qanday ishlaydi" title="Uch qadam — va mutaxassis topildi" />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: MapPinned, n: "01", title: "Hududni tanlang", text: "Xaritada viloyatni bosing yoki shaharni qidiring. Yaqin atrofdagi ijodkorlar chiqadi." },
            { icon: Play, n: "02", title: "Portfolioni ko'ring", text: "Ishlar, narxlar, tajriba va haqiqiy mijozlar sharhlari — hammasi bitta sahifada." },
            { icon: MessageSquareText, n: "03", title: "Buyurtma bering", text: "Loyihani yozing — mutaxassis qabul qiladi va to'g'ridan-to'g'ri bog'lanadi." },
          ].map((s) => (
            <div key={s.n} className="card-outline relative p-6 sm:p-7">
              <span className="font-display text-[13px] font-semibold text-accent">{s.n}</span>
              <span className="btn-ink mt-6 flex h-12 w-12 items-center justify-center rounded-[14px]">
                <s.icon size={22} />
              </span>
              <h3 className="mt-5 font-display text-[19px] font-semibold text-fg">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-fg-2">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= HUDUDLAR ================= */}
      <section className="container-x mt-20 sm:mt-28">
        <SectionHeading eyebrow="Hududlar" title="Shahringiz bo'yicha qidiring" />
        <div className="flex flex-wrap gap-2.5">
          {REGIONS.map((r) => (
            <Link
              key={r.slug}
              href={`/mutaxassislar?region=${r.slug}`}
              className="card card-hover inline-flex items-center gap-2 !rounded-full px-4 py-2 text-[14px] font-medium text-fg"
            >
              {r.short}
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">{regionStats[r.slug]?.total ?? 0}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="container-x mt-20 sm:mt-28">
        <div className="grain relative overflow-hidden rounded-[32px] bg-ink px-6 py-14 text-ink-fg sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/50 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-accent-2/50 blur-[110px]" />
          <div className="relative grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <span className="eyebrow !text-ink-fg/60">Mutaxassislar uchun</span>
              <h2 className="display-xl mt-5 text-[34px] sm:text-[48px] lg:text-[56px]">
                Siz ijodkormisiz? <span className="accent-serif text-accent">Xaritada</span> paydo bo'ling.
              </h2>
              <p className="mt-5 max-w-xl text-[15px] text-ink-fg/70 sm:text-[17px]">
                Bepul ro'yxatdan o'ting, portfolio joylang, narxlaringizni belgilang. Buyurtmalar to'g'ridan-to'g'ri kabinetingizga keladi.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
              <ButtonLink href="/auth/royxat?role=specialist" variant="accent" size="lg" className="w-full sm:w-auto">
                Mutaxassis sifatida qo'shilish <ArrowRight size={18} />
              </ButtonLink>
              <Link href="/auth/royxat" className="inline-flex h-13 items-center justify-center rounded-full border border-ink-fg/20 px-7 text-[15px] font-semibold text-ink-fg transition hover:bg-ink-fg/10">
                Mijoz sifatida boshlash
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
