import Link from "next/link";
import { ArrowRight, BadgeCheck, Compass, MessageSquareText, Play, Sparkles } from "lucide-react";
import { HeroShowcase } from "@/components/home/HeroShowcase";
import { RegionGrid } from "@/components/home/RegionGrid";
import { CategoryBento } from "@/components/home/CategoryBento";
import { SpecialistCard } from "@/components/specialists/SpecialistCard";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Avatar, ButtonLink, SectionHeading } from "@/components/ui";
import { CATEGORIES } from "@/lib/constants";
import { getCategoryStats, getFeaturedSpecialists, getRegionStats, getSiteStats, listSpecialists } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [regionStats, categoryStats, featured, site, leadTop] = await Promise.all([
    getRegionStats(),
    getCategoryStats(),
    getFeaturedSpecialists(6),
    getSiteStats(),
    listSpecialists({ category: CATEGORIES[0].slug, sort: "rating", page: 1, limit: 3 }),
  ]);

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="container-x">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-6">
            <span className="eyebrow">O'zbekiston ijodkorlar platformasi</span>
            <h1 className="display-xl mt-6 text-[36px] text-fg min-[420px]:text-[40px] sm:text-[58px] lg:text-[64px] xl:text-[76px]">
              Hududingizdagi
              <br />
              eng zo'r <span className="accent-serif text-accent">ijodkorlarni</span>
              <br />
              toping
            </h1>
            <p className="mt-7 max-w-lg text-[16px] leading-relaxed text-fg-2 sm:text-[18px]">
              Videograf, montajor, dizayner va boshqa ijodkorlar — 14 ta hudud bo'ylab. Hududingizni tanlang, portfolio va narxlarni solishtiring, to'g'ridan-to'g'ri buyurtma bering.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/mutaxassislar" variant="accent" size="lg" className="sm:min-w-[210px]">
                Mutaxassis topish <ArrowRight size={18} />
              </ButtonLink>
              <ButtonLink href="#hududlar" variant="outline" size="lg">
                <Compass size={17} /> Hududlar bo'yicha
              </ButtonLink>
            </div>

            {/* Ishonch qatori */}
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
              <div className="flex items-center">
                <div className="flex -space-x-2">
                  {featured.slice(0, 3).map((sp) => (
                    <Avatar key={sp.id} name={sp.user.name} src={sp.user.avatarUrl} size={28} decorative className="!ring-bg" />
                  ))}
                  <span className="flex h-7 items-center rounded-full bg-ink px-2 text-[11px] font-bold text-ink-fg ring-2 ring-bg">+{Math.max(0, site.specialists - 3)}</span>
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

          {/* Ijodkorlar kollaji */}
          <div className="relative pb-5 lg:col-span-6">
            <HeroShowcase items={featured.slice(0, 3)} total={site.specialists} />
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

      {/* ================= HUDUDLAR ================= */}
      <section id="hududlar" className="container-x mt-20 scroll-mt-28 sm:mt-28">
        <SectionHeading
          eyebrow="Hududlar"
          title={
            <>
              Shahringiz bo'yicha <span className="accent-serif text-accent">qidiring</span>
            </>
          }
          description="14 ta hudud — har birida nechta ijodkor borligi jonli hisoblanadi. Hududni bosing, ro'yxat shu hudud bo'yicha ochiladi."
          action={
            <ButtonLink href="/mutaxassislar" variant="outline" size="sm">
              Butun O'zbekiston <ArrowRight size={14} />
            </ButtonLink>
          }
        />
        <RegionGrid stats={regionStats} />
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
        <CategoryBento categoryStats={categoryStats} regionStats={regionStats} leadTop={leadTop.items} />
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
            { icon: Compass, n: "01", title: "Hududni tanlang", text: "Shahringizni tanlang yoki ro'yxatda yo'nalish va narx bo'yicha filtrlang. Yaqin atrofdagi ijodkorlar chiqadi." },
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

      {/* ================= CTA ================= */}
      <section className="container-x mt-20 sm:mt-28">
        <div className="grain relative overflow-hidden rounded-[32px] bg-ink px-6 py-14 text-ink-fg sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/50 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-accent-2/50 blur-[110px]" />
          <div className="relative grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <span className="eyebrow !text-ink-fg/60">Mutaxassislar uchun</span>
              <h2 className="display-xl mt-5 text-[34px] sm:text-[48px] lg:text-[56px]">
                Siz ijodkormisiz? <span className="accent-serif text-accent">Ro'yxatda</span> paydo bo'ling.
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
