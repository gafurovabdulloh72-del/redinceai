import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, MapPinned, MessageSquareText, Play, Star } from "lucide-react";
import { UzbekistanMap } from "@/components/map/UzbekistanMap";
import { HomeMapSection } from "@/components/map/HomeMapSection";
import { MAP_VIEWBOX, REGION_SHAPES } from "@/components/map/regions-geo";
import { SpecialistCard } from "@/components/specialists/SpecialistCard";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { AvatarImage } from "@/components/ui/AvatarImage";
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
  const withAvatar = featured.filter((s) => !!s.user.avatarUrl).slice(0, 3);
  const topCategory = CATEGORIES.map((c) => ({ c, n: categoryStats[c.slug] ?? 0 })).sort((a, b) => b.n - a.n)[0];
  const regionsSorted = [...REGIONS].sort((a, b) => a.short.localeCompare(b.short, "uz"));

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="container-x">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-6">
            <span className="eyebrow">O'zbekiston ijodkorlar xaritasi</span>
            <h1 className="display-xl mt-6 text-[40px] text-fg min-[420px]:text-[44px] sm:text-[56px] lg:text-[56px] xl:text-[72px]">
              Ijodkorlarni
              <br />
              <span className="accent-serif text-accent">xaritada</span>
              <br />
              toping
            </h1>
            <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-fg-2 sm:text-[18px]">
              Videograf, montajor, dizayner va boshqa ijodkorlar — hududingizda. Viloyatni bosing, portfolio va narxlarni ko'ring, to'g'ridan-to'g'ri buyurtma bering.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/xarita" variant="accent" size="lg" className="sm:min-w-[210px]">
                <MapPinned size={18} /> Xaritani ochish
              </ButtonLink>
              <ButtonLink href="/mutaxassislar" variant="outline" size="lg">
                Mutaxassislar ro'yxati <ArrowRight size={16} />
              </ButtonLink>
            </div>

            {/* Ishonch qatori */}
            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
              {withAvatar.length >= 3 ? (
                <div className="flex items-center">
                  <div className="flex -space-x-2.5">
                    {withAvatar.map((sp) => (
                      <span key={sp.id} className="relative h-8 w-8 overflow-hidden rounded-full bg-surface-3 ring-2 ring-bg" aria-hidden="true">
                        <AvatarImage src={sp.user.avatarUrl!} size={32} />
                      </span>
                    ))}
                  </div>
                  <p className="ml-3 text-[13px] leading-tight text-fg-2">
                    <span className="font-display font-semibold text-fg">{site.specialists}+ mutaxassis</span>
                    <span className="text-fg-3"> · {site.regions} ta hudud</span>
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <StatChip value={`${site.specialists}+`} label="mutaxassis" />
                  <StatChip value={String(site.regions)} label="hudud" />
                </div>
              )}
              <div className="flex items-center gap-x-4 gap-y-2 text-[13px] text-fg-2">
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck size={15} className="text-accent" /> Tasdiqlangan profillar
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Star size={14} className="fill-accent-3 text-accent-3" /> {site.reviews} ta sharh
                </span>
              </div>
            </div>
          </div>

          {/* Xarita — matn bloki bilan vertikal markazda */}
          <div className="relative flex flex-col justify-center self-center lg:col-span-6">
            <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[70%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[90px] dark:bg-accent/20" />
            <UzbekistanMap counts={counts} variant="hero" linkTo="mutaxassislar" showLabels={false} className="w-full py-2 lg:-mr-4 lg:w-[110%] lg:max-w-none" />
            {/* Legenda + ishora — xaritaga biriktirilgan bitta qator */}
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 sm:px-2">
              <span className="card inline-flex h-8 items-center gap-2 !rounded-full px-3 text-[11.5px] font-semibold text-fg-2">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-70 animate-pulse-ring" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                Interaktiv — hududni bosing
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-3">
                kam
                <span className="h-2 w-20 rounded-full" style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--accent) 8%, var(--map-fill-0)), var(--accent))" }} aria-hidden="true" />
                ko'p
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= KATEGORIYA LENTASI ================= */}
      <section className="mt-16 border-y border-line py-4 sm:mt-24" aria-label="Yo'nalishlar lentasi">
        <div className="container-x mb-3 flex items-center justify-between">
          <span className="eyebrow">Yo'nalishlar</span>
          <span className="text-[12px] text-fg-3">{CATEGORIES.length} ta yo'nalish · {site.specialists} ta mutaxassis</span>
        </div>
        <div className="edge-fade overflow-hidden">
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap [animation-play-state:running] hover:[animation-play-state:paused]">
            {[...CATEGORIES, ...CATEGORIES].map((c, i) => (
              <Link
                key={`${c.slug}-${i}`}
                href={`/mutaxassislar?category=${c.slug}`}
                className="group flex min-h-10 items-center gap-3 text-fg-3 transition hover:text-fg"
                aria-hidden={i >= CATEGORIES.length || undefined}
                tabIndex={i >= CATEGORIES.length ? -1 : undefined}
              >
                <CategoryIcon icon={c.icon} size={18} style={{ color: c.accent }} />
                <span className="font-display text-[15px] font-medium tracking-tight">{c.plural}</span>
                <span className="rounded-full bg-fg/6 px-2 py-0.5 text-[11px] font-bold text-fg-2">{categoryStats[c.slug] ?? 0}</span>
              </Link>
            ))}
          </div>
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
          {CATEGORIES.map((c, i) => {
            const n = categoryStats[c.slug] ?? 0;
            const isHero = i === 0;
            return (
              <Link
                key={c.slug}
                href={`/mutaxassislar?category=${c.slug}`}
                className={`card card-hover group relative flex flex-col overflow-hidden p-5 sm:p-6 ${isHero ? "col-span-2 lg:row-span-2" : ""}`}
              >
                {isHero && <MapSilhouette />}
                <span className="icon-tile-outline transition-transform duration-500 group-hover:-rotate-6" style={{ color: c.accent }}>
                  <CategoryIcon icon={c.icon} size={20} />
                </span>
                <h3 className={`mt-5 font-display font-semibold text-fg ${isHero ? "text-[24px] sm:text-[30px]" : "text-[16px] sm:text-[17px]"}`}>{c.name}</h3>
                <p className={`mt-1.5 text-[13px] leading-snug text-fg-3 ${isHero ? "max-w-sm" : "line-clamp-2"}`}>{c.description}</p>

                {isHero && (
                  <>
                    <p className="relative mt-4 max-w-sm text-[14px] leading-relaxed text-fg-2">
                      Eng ko'p so'raladigan yo'nalish: to'y va event suratga olish, reklama roliklari, korporativ video. Portfolio, narx va sharhlar — bitta sahifada.
                    </p>
                    <div className="relative mt-6 grid max-w-sm grid-cols-3 gap-2">
                      <MiniStat value={String(n)} label="videograf" />
                      <MiniStat value={String(Object.values(regionStats).filter((r) => (r.byCategory[c.slug] ?? 0) > 0).length)} label="hududda" />
                      <MiniStat value={`${topCategory?.n ?? 0}`} label={`${topCategory?.c.name.toLowerCase() ?? ""} (top)`} />
                    </div>
                  </>
                )}

                <div className={`flex items-center justify-between ${isHero ? "mt-auto pt-8" : "mt-5"}`}>
                  <span className="font-display text-[22px] font-semibold text-fg">
                    {n}
                    <span className="ml-1 text-[12px] font-medium text-fg-3">mutaxassis</span>
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-fg-3 transition group-hover:border-fg group-hover:text-fg">
                    <ArrowUpRight size={15} />
                  </span>
                </div>
              </Link>
            );
          })}
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
        <ol className="grid gap-4 md:grid-cols-3 md:gap-8">
          {[
            { icon: MapPinned, n: "01", title: "Hududni tanlang", text: "Xaritada viloyatni bosing yoki shaharni qidiring. Yaqin atrofdagi ijodkorlar chiqadi." },
            { icon: Play, n: "02", title: "Portfolioni ko'ring", text: "Ishlar, narxlar, tajriba va haqiqiy mijozlar sharhlari — hammasi bitta sahifada." },
            { icon: MessageSquareText, n: "03", title: "Buyurtma bering", text: "Loyihani yozing — mutaxassis qabul qiladi va to'g'ridan-to'g'ri bog'lanadi." },
          ].map((s, i) => (
            <li key={s.n} className={`card relative p-6 sm:p-7 ${i < 2 ? "md:step-line" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="icon-tile">
                  <s.icon size={20} />
                </span>
                <span className="font-display text-[13px] font-semibold text-accent">{s.n}</span>
              </div>
              <h3 className="mt-5 font-display text-[19px] font-semibold text-fg">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-fg-2">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ================= HUDUDLAR ================= */}
      <section className="container-x mt-20 sm:mt-28">
        <SectionHeading eyebrow="Hududlar" title="Shahringiz bo'yicha qidiring" description="Alifbo tartibida. Qatorni yon tomonga suring." />
        <div className="-mx-4 overflow-x-auto px-4 pb-2 no-scrollbar scroll-fade sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="grid w-max grid-flow-col grid-rows-2 gap-2.5">
            {regionsSorted.map((r) => (
              <Link
                key={r.slug}
                href={`/mutaxassislar?region=${r.slug}`}
                className="card card-hover inline-flex h-11 snap-start items-center gap-2 !rounded-full px-4 text-[14px] font-medium text-fg"
              >
                {r.short}
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">{regionStats[r.slug]?.total ?? 0}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA (ikkala rejimda ham qorong'u) ================= */}
      <section className="container-x mt-20 sm:mt-28">
        <div className="cta-dark grain relative overflow-hidden rounded-card-lg bg-[#121213] px-6 py-14 text-white sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/40 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-accent-2/35 blur-[110px]" />
          <div className="relative grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <span className="eyebrow !text-white/60">Mutaxassislar uchun</span>
              <h2 className="display-xl mt-5 text-[34px] text-white sm:text-[48px] lg:text-[56px]">
                Siz ijodkormisiz? <span className="accent-serif text-accent">Xaritada</span> paydo bo'ling.
              </h2>
              <p className="mt-5 max-w-xl text-[15px] text-white/70 sm:text-[17px]">
                Bepul ro'yxatdan o'ting, portfolio joylang, narxlaringizni belgilang. Buyurtmalar to'g'ridan-to'g'ri kabinetingizga keladi.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
              <ButtonLink href="/auth/royxat?role=specialist" variant="accent" size="lg" className="w-full sm:w-auto">
                Mutaxassis sifatida qo'shilish <ArrowRight size={18} />
              </ButtonLink>
              <Link
                href="/auth/royxat"
                className="inline-flex h-13 w-full items-center justify-center rounded-full border border-white/35 bg-white/5 px-7 text-[15px] font-semibold text-white transition hover:border-white hover:bg-white/10 sm:w-auto"
              >
                Mijoz sifatida boshlash
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <span className="card inline-flex h-9 items-center gap-1.5 !rounded-full px-3.5 text-[13px]">
      <span className="font-display font-semibold text-fg">{value}</span>
      <span className="text-fg-3">{label}</span>
    </span>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <span className="card-outline flex flex-col px-3 py-2.5">
      <span className="font-display text-[18px] font-semibold leading-none text-fg">{value}</span>
      <span className="mt-1 truncate text-[11px] text-fg-3">{label}</span>
    </span>
  );
}

/** Bento katta plitkasi uchun dekorativ xarita silueti */
function MapSilhouette() {
  return (
    <svg
      viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
      className="pointer-events-none absolute -bottom-6 -right-10 h-auto w-[72%] text-fg opacity-[0.06] transition-opacity duration-500 group-hover:opacity-10 dark:opacity-[0.08]"
      aria-hidden="true"
    >
      {REGION_SHAPES.map((r) => (
        <path key={r.slug} d={r.d} fill="currentColor" stroke="var(--surface)" strokeWidth={6} strokeLinejoin="round" />
      ))}
    </svg>
  );
}
