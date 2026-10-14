import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, ArrowUpRight, MapPinned, MessageSquareText, Play, ShieldCheck } from "lucide-react";
import { UzbekistanMap } from "@/components/map/UzbekistanMap";
import { HomeMapSection } from "@/components/map/HomeMapSection";
import { SpecialistCard } from "@/components/specialists/SpecialistCard";
import { CoverPattern } from "@/components/ui/CoverPattern";
import { Avatar, ButtonLink, SectionHeading } from "@/components/ui";
import { CATEGORIES } from "@/lib/constants";
import { getSettings } from "@/lib/payments/settings";
import { getCategoryStats, getFeaturedSpecialists, getRegionStats, getSiteStats } from "@/lib/queries";
import { cn, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

/*
 * Bosh sahifa — minimalistik: hero → interaktiv xarita → yo'nalishlar → tavsiya etilganlar → uch qadam → CTA.
 * "So'nggi e'lonlar" tasmasi olib tashlandi (sahifa yengillashdi, /ishlar o'z sahifasida) va hero'dagi
 * takroriy ishonch chiplar qisqartirildi. Bo'limlar oralig'i — yagona mt-section.
 */

const STEPS = [
  { icon: MapPinned, title: "Hududni tanlang", text: "Xaritada viloyatni bosing yoki yo'nalish bo'yicha qidiring — yaqin atrofdagi ijodkorlar chiqadi." },
  { icon: Play, title: "Portfolioni ko'ring", text: "Ishlar, narxlar, tajriba va haqiqiy mijozlar sharhlari — hammasi bitta sahifada." },
  { icon: MessageSquareText, title: "Buyurtma bering", text: "Loyihani yozing, narxni kelishing va xavfsiz to'lang — pul ishni qabul qilganingizdan keyin o'tkaziladi." },
] as const;

export default async function HomePage() {
  const [regionStats, categoryStats, featured, site, settings] = await Promise.all([getRegionStats(), getCategoryStats(), getFeaturedSpecialists(4), getSiteStats(), getSettings()]);
  /* Mutaxassis CTA: obuna shartlari /narxlar bilan bir xil (admin sozlamasidan) */
  const trialDays = settings.subscriptionTrialDays;
  const subPrice = formatPrice(settings.subscriptionPrice);
  const counts = Object.fromEntries(Object.values(regionStats).map((s) => [s.slug, s.total]));
  /* E83: avatar stack — rasm bo'lmasa ham <Avatar> bosh harflarni ko'rsatadi (bo'sh doira yo'q) */
  const stack = featured.slice(0, 3);

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="container-x">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-6">
            {/* Ustki yorliq — chiziq bilan (editorial) */}
            <div className="flex items-center gap-4">
              <span className="eyebrow !m-0 shrink-0">O'zbekiston ijodkorlar xaritasi</span>
              <span className="hidden h-px flex-1 bg-line sm:block" aria-hidden="true" />
            </div>
            <h1 className="display-xl mt-7 text-[44px] text-fg min-[420px]:text-[50px] sm:text-[64px] lg:text-[66px] xl:text-[82px]">
              Ijodkorlarni
              <br />
              <span className="accent-serif text-accent">xaritada</span> toping
            </h1>
            <p className="mt-7 max-w-md text-[16px] leading-relaxed text-fg-2 sm:text-[18px]">
              Videograf, montajor, dizayner va boshqa ijodkorlar — hududingizda. Viloyatni bosing, portfolio va narxlarni ko'ring, to'g'ridan-to'g'ri buyurtma bering.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/xarita" variant="accent" size="lg" className="sm:min-w-[210px]">
                <MapPinned size={20} /> Xaritani ochish
              </ButtonLink>
              <ButtonLink href="/mutaxassislar" variant="outline" size="lg">
                Mutaxassislar ro'yxati <ArrowRight size={16} />
              </ButtonLink>
            </div>

            {/* Ishonch bari — ustki nozik chiziq bilan ajratilgan (editorial "stat bar") */}
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-line pt-6">
              {stack.length >= 3 && (
                <div className="flex -space-x-2" aria-hidden="true">
                  {stack.map((sp) => (
                    <Avatar key={sp.id} name={sp.user.name} src={sp.user.avatarUrl} size={34} decorative singleInitial className="!ring-bg" />
                  ))}
                </div>
              )}
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[26px] font-semibold leading-none text-fg tabular-nums">{site.specialists}+</span>
                <span className="text-[13px] leading-tight text-fg-3">mutaxassis</span>
              </div>
              <span className="h-8 w-px bg-line" aria-hidden="true" />
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[26px] font-semibold leading-none text-fg tabular-nums">{site.regions}</span>
                <span className="text-[13px] leading-tight text-fg-3">ta hudud</span>
              </div>
            </div>
          </div>

          {/* Xarita — matn bloki bilan vertikal markazda */}
          <div className="relative flex flex-col justify-center self-center lg:col-span-6">
            {/* Och fonda qizil nur tuman bo'lib ko'rinmasin — kunduzgi rejimda ancha yumshoq */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[70%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/8 blur-[90px] dark:bg-accent/20" />
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
                <span className="map-legend-ramp h-2 w-20 rounded-full" aria-hidden="true" />
                ko'p
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= INTERAKTIV XARITA ================= */}
      <section id="xarita" className="container-x mt-section scroll-mt-24">
        <SectionHeading
          eyebrow="Interaktiv xarita"
          title={
            <>
              Hududni tanlang — <span className="accent-serif text-accent">mutaxassislar</span> chiqadi
            </>
          }
          description="14 ta hudud. Rang qancha to'q bo'lsa, u yerda shuncha ko'p ijodkor bor. Bosing — yo'nalishlar bo'yicha taqsimot va ro'yxat ochiladi."
        />
        {/* useSearchParams (tanlov URL'da) — Suspense chegarasi ichida */}
        <Suspense fallback={<HomeMapFallback />}>
          <HomeMapSection stats={regionStats} total={site.specialists} />
        </Suspense>
      </section>

      {/* ================= YO'NALISHLAR — har biri o'z naqshi + ikonka plitkasi + son ================= */}
      <section className="container-x mt-section">
        <SectionHeading
          eyebrow="Yo'nalishlar"
          title="Kim kerak?"
          description="Har bir yo'nalish bo'yicha mutaxassislar soni jonli hisoblanadi."
          action={
            <ButtonLink href="/mutaxassislar" variant="outline" size="sm">
              Barchasi <ArrowRight size={16} />
            </ButtonLink>
          }
        />
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {CATEGORIES.map((c) => {
            const n = categoryStats[c.slug] ?? 0;
            const regionsWith = Object.values(regionStats).filter((r) => (r.byCategory[c.slug] ?? 0) > 0).length;
            return (
              <li key={c.slug}>
                <Link href={`/yonalish/${c.slug}`} className="card card-hover group flex h-full flex-col overflow-hidden">
                  <span className="relative block h-20 sm:h-24">
                    <CoverPattern category={c.slug} iconSize={20} className="transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                  </span>
                  <span className="flex flex-1 flex-col p-4 sm:p-5">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block font-display text-[15px] font-semibold leading-tight text-fg sm:text-[17px]">{c.name}</span>
                        <span className="mt-1 line-clamp-2 block text-[12.5px] leading-snug text-fg-3">{c.description}</span>
                      </span>
                      <span className="hover-reveal hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-fg-3 transition sm:flex">
                        <ArrowUpRight size={16} />
                      </span>
                    </span>
                    <span className="mt-auto flex items-baseline gap-1.5 pt-4">
                      <span className="font-display text-[22px] font-semibold leading-none text-fg tabular-nums">{n}</span>
                      <span className="text-[12px] font-medium text-fg-3">mutaxassis · {regionsWith} hudud</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ================= TAVSIYA ETILGANLAR ================= */}
      <section className="container-x mt-section">
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
              Hammasini ko'rish <ArrowRight size={16} />
            </ButtonLink>
          }
        />
        {/* Bitta qator: telefonda 3, planshetda 2×2, desktopda 3 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.slice(0, 4).map((sp, i) => (
            <div key={sp.id} className={cn("min-w-0", i === 3 && "hidden sm:block lg:hidden")}>
              <SpecialistCard sp={sp} priority={i < 3} />
            </div>
          ))}
        </div>
      </section>

      {/* ================= QANDAY ISHLAYDI — raqamli plitkalar + bog'lovchi chiziq ================= */}
      <section className="container-x mt-section">
        <SectionHeading eyebrow="Qanday ishlaydi" title="Uch qadam — va mutaxassis topildi" />
        <div className="card relative overflow-hidden p-6 sm:p-8">
          <ol className="relative grid gap-9 md:grid-cols-3 md:gap-10">
            {/* Bog'lovchi chiziq: telefonda vertikal (plitkalar markazidan), md+ da gorizontal (1- va 3-plitka markazlari orasida) */}
            <span aria-hidden="true" className="absolute bottom-12 left-[22px] top-12 border-l-2 border-dashed border-accent/35 md:hidden" />
            <span
              aria-hidden="true"
              className="absolute left-[22px] right-[calc((100%-5rem)/3-22px)] top-[22px] hidden border-t-2 border-dashed border-accent/35 md:block"
            />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 md:flex-col md:gap-0">
                <span className="icon-tile step-tile relative z-[1] shadow-[0_0_0_8px_var(--surface)]" data-step={i + 1}>
                  <s.icon size={20} />
                </span>
                <span className="min-w-0 md:mt-6">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-accent-text">{i + 1}-qadam</span>
                  <h3 className="mt-1.5 font-display text-[20px] font-semibold leading-tight text-fg sm:text-[22px]">{s.title}</h3>
                  <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-fg-2">{s.text}</p>
                </span>
              </li>
            ))}
          </ol>
          <p className="relative mt-7 flex items-center gap-2 border-t border-line pt-5 text-[13px] text-fg-2">
            <ShieldCheck size={16} className="shrink-0 text-accent" />
            To'lov eskrou orqali: pul mutaxassisga ish qabul qilingandan keyingina o'tadi.
          </p>
        </div>
      </section>

      {/* ================= CTA (ikkala rejimda ham qorong'u; Noir'da inversiya yo'q — faqat nozik chegara) ================= */}
      <section className="container-x mt-section">
        <div className="cta-dark grain relative overflow-hidden rounded-card-lg border border-white/10 bg-[#121213] px-6 py-12 text-white sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/40 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-accent-2/35 blur-[110px]" />
          <div className="relative grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <span className="eyebrow !text-white/60">Mutaxassislar uchun</span>
              <h2 className="display-xl mt-5 text-[34px] text-white sm:text-[48px] lg:text-[56px]">
                Siz ijodkormisiz? <span className="accent-serif text-accent">Xaritada</span> paydo bo'ling.
              </h2>
              <p className="mt-5 max-w-xl text-[15px] text-white/70 sm:text-[17px]">
                {trialDays > 0 ? `${trialDays} kun bepul sinab ko'ring, keyin ${subPrice} / oy.` : `Obuna — ${subPrice} / oy.`} Portfolio joylang, narxlaringizni belgilang — buyurtmalar
                to'g'ridan-to'g'ri kabinetingizga keladi.{" "}
                <Link href="/narxlar" className="font-semibold text-white underline decoration-white/40 underline-offset-4 transition hover:decoration-white">
                  Narxlar va shartlar
                </Link>
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
              <ButtonLink href="/auth/royxat?role=specialist" variant="accent" size="lg" className="w-full sm:w-auto">
                Mutaxassis sifatida qo'shilish <ArrowRight size={20} />
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

/** HomeMapSection yuklanguncha (Suspense) — xuddi shu o'lchamdagi tinch skelet */
function HomeMapFallback() {
  return (
    <div className="grid gap-5 lg:grid-cols-12" aria-hidden="true">
      <div className="card p-5 lg:col-span-8">
        <span className="skeleton block h-4 w-48" />
        <span className="skeleton mt-4 block aspect-[1048/728] w-full !rounded-card" />
      </div>
      <div className="card-elevated p-5 lg:col-span-4">
        <span className="skeleton block h-11 w-11" />
        <span className="skeleton mt-4 block h-4 w-2/3" />
        <span className="skeleton mt-6 block h-40 w-full" />
      </div>
    </div>
  );
}
