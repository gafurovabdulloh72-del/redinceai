import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgePercent, BriefcaseBusiness, Check, CreditCard, Crown, Gift, HelpCircle, ShieldCheck, Sprout, Users, type LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { PROPOSAL_DAILY_LIMIT, SITE } from "@/lib/constants";
import { getSettings, NEW_TIER_MAX_COMPLETED, TOP_RATED_MIN_RATING, TOP_RATED_MIN_REVIEWS } from "@/lib/payments/settings";
import { plansFor } from "@/lib/subscriptions/billing";
import { cn, formatPrice } from "@/lib/utils";

/** Narxlar admin sozlamalaridan olinadi — 10 daqiqada bir yangilanadi */
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const price = formatPrice(s.subscriptionPrice);
  return {
    title: "Narxlar",
    description: `${SITE.name} narxlari: mijozlar uchun bepul — buyurtma, e'lon va eskrou himoyasi. Mutaxassislar uchun obuna ${price} / oy${s.subscriptionTrialDays > 0 ? `, birinchi ${s.subscriptionTrialDays} kun bepul` : ""}. Uzoq muddatga chegirmalar va eskrou komissiyasi.`,
    alternates: { canonical: "/narxlar" },
    openGraph: {
      title: `Narxlar · ${SITE.name}`,
      description: `Mijozlar uchun bepul. Mutaxassislar uchun ${price} / oy.`,
      images: ["/opengraph-image"],
      siteName: SITE.name,
      locale: "uz_UZ",
    },
  };
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-snug text-fg-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-text" aria-hidden="true">
        <Check size={12} strokeWidth={3} />
      </span>
      <span>{children}</span>
    </li>
  );
}

export default async function PricingPage() {
  const s = await getSettings();
  const plans = plansFor(s);
  const price = formatPrice(s.subscriptionPrice);
  const trial = s.subscriptionTrialDays;
  const grace = s.subscriptionGraceDays;

  const tiers: Array<{ icon: LucideIcon; name: string; pct: number; rule: string; emphasis?: boolean }> = [
    { icon: Sprout, name: "Yangi mutaxassis", pct: s.commissionPctNew, rule: `Birinchi ${NEW_TIER_MAX_COMPLETED} ta bajarilgan buyurtmagacha` },
    { icon: BriefcaseBusiness, name: "Oddiy daraja", pct: s.commissionPct, rule: `${NEW_TIER_MAX_COMPLETED} va undan ko'p bajarilgan buyurtma` },
    { icon: Crown, name: "Top mutaxassis", pct: s.commissionPctTop, rule: `Reyting ${TOP_RATED_MIN_RATING}+ va kamida ${TOP_RATED_MIN_REVIEWS} ta sharh`, emphasis: true },
  ];

  const faq: Array<{ q: string; a: string }> = [
    {
      q: "Nega obuna?",
      a: `Mijozlar mutaxassisni ${SITE.name}'da topadi, lekin ko'pincha keyin Telegram yoki telefon orqali kelishib, ishni platformadan tashqarida davom ettiradi. Platformadan tashqarida kelishilgan ishlar ham bizning mijozlarimizdan keladi — obuna katalog, xarita, qidiruv va reklama orqali sizga mijoz olib kelish xizmati uchun adolatli to'lov. Komissiya faqat eskrou orqali to'langan buyurtmalardan olinadi.`,
    },
    {
      q: "Obuna tugasa nima bo'ladi?",
      a: `${grace > 0 ? `Avval ${grace} kunlik muhlat beriladi — bu vaqtda profil odatdagidek ishlaydi. ` : ""}Keyin profil katalog, xarita, qidiruv va yo'nalish sahifalaridan yashiriladi, aloqa ma'lumotlari yopiladi, yangi buyurtma va takliflar to'xtaydi. Mavjud buyurtmalar va eskroudagi to'lovlar odatdagidek davom etadi. To'lashingiz bilan profil darhol qaytadi.`,
    },
    {
      q: "Qanday to'lash mumkin?",
      a: "Payme yoki Click (karta yoki ilova orqali) yoki bank kartasiga o'tkazma — o'tkazmani administrator odatda 1 ish kuni ichida tasdiqlaydi. Avtomatik yechib olish yo'q: har bir davr Kabinet → Obuna bo'limidan alohida to'lanadi. Har bir to'lov uchun elektron chek beriladi.",
    },
    {
      q: "Pulni qaytarish mumkinmi?",
      a: "Hali boshlanmagan davr (oldindan to'langan oylar) uchun qo'llab-quvvatlashga yozing — qaytarilgan summaga mos ravishda obuna muddati qisqartiriladi. Boshlangan davr uchun to'lov qaytarilmaydi, platforma aybi bilan xizmat ko'rsatilmagan holatlar bundan mustasno (Ommaviy oferta).",
    },
    {
      q: "Sinov muddati qanday ishlaydi?",
      a: trial > 0 ? `Mutaxassis sifatida ro'yxatdan o'tgan kundan boshlab ${trial} kun barcha imkoniyatlar bepul — karta talab qilinmaydi. Sinov tugashidan 3 va 1 kun oldin eslatma keladi.` : "Hozircha sinov muddati yo'q — obuna ro'yxatdan o'tgandan keyin faollashtiriladi.",
    },
    {
      q: "Mijozlar biror narsa to'laydimi?",
      a: "Yo'q. Mutaxassis qidirish, buyurtma berish, e'lon joylash va takliflar olish mijozlar uchun bepul. Eskrou orqali to'lasangiz, xizmat haqi kelishilgan narx ichida — siz ustiga hech narsa qo'shib to'lamaysiz.",
    },
  ];
  const faqJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  }).replace(/</g, "\\u003c");

  return (
    <div className="container-x animate-fade-up">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />

      {/* ---------- Sarlavha ---------- */}
      <header className="mx-auto max-w-3xl text-center">
        <span className="eyebrow justify-center">
          <CreditCard size={13} className="text-accent" /> Narxlar
        </span>
        <h1 className="display-xl mt-5 text-[34px] text-fg sm:text-[48px] lg:text-[56px]">
          Oddiy va <span className="accent-serif text-accent">shaffof</span> narxlar
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-fg-2 sm:text-[17px]">
          Mijozlar {SITE.name}&apos;dan bepul foydalanadi. Mutaxassislar oylik obuna to&apos;laydi — profil katalog va xaritada ko&apos;rinadi, buyurtmalar cheklanmaydi.
        </p>
      </header>

      {/* ---------- Ikki ustun ---------- */}
      <section aria-label="Tariflar" className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2 md:gap-5">
        <div className="card flex flex-col p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="icon-tile-outline" aria-hidden="true">
              <Users size={20} />
            </span>
            <h2 className="font-display text-[20px] font-semibold text-fg">Mijozlar</h2>
          </div>
          <p className="mt-6 font-display text-[44px] font-semibold leading-none tracking-tight text-fg">Bepul</p>
          <p className="mt-2 text-[14px] text-fg-3">Hech qanday obuna yoki yashirin to&apos;lov yo&apos;q</p>
          <ul className="mt-6 space-y-3">
            <Bullet>Xarita va katalog orqali mutaxassis qidirish, solishtirish</Bullet>
            <Bullet>To&apos;g&apos;ridan-to&apos;g&apos;ri buyurtma berish va chat</Bullet>
            <Bullet>E&apos;lon joylash va mutaxassislardan takliflar olish</Bullet>
            <Bullet>Eskrou himoyasi — pul ishni qabul qilguningizcha platformada saqlanadi</Bullet>
            <Bullet>Nizo bo&apos;lsa — administrator ko&apos;rib chiqadi</Bullet>
          </ul>
          <ButtonLink href="/mutaxassislar" variant="outline" size="lg" className="mt-8 w-full">
            Mutaxassis topish <ArrowRight size={16} />
          </ButtonLink>
        </div>

        <div className="card-elevated relative flex flex-col p-6 sm:p-8">
          {trial > 0 && (
            <span className="absolute -top-3 right-6 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-fg">
              <Gift size={12} aria-hidden="true" /> {trial} kun bepul
            </span>
          )}
          <div className="flex items-center gap-3">
            <span className="icon-tile" aria-hidden="true">
              <BriefcaseBusiness size={20} />
            </span>
            <h2 className="font-display text-[20px] font-semibold text-fg">Mutaxassislar</h2>
          </div>
          <p className="mt-6 flex flex-wrap items-baseline gap-x-2 font-display font-semibold tracking-tight text-fg">
            <span className="whitespace-nowrap text-[38px] leading-none tabular-nums sm:text-[44px]">{price}</span>
            <span className="text-[16px] font-medium text-fg-3">/ oy</span>
          </p>
          <p className="mt-2 text-[14px] text-fg-3">{trial > 0 ? `Birinchi ${trial} kun bepul — karta talab qilinmaydi` : "Uzoq muddatga to'lasangiz — chegirma"}</p>
          <ul className="mt-6 space-y-3">
            <Bullet>Katalog, xarita, qidiruv va yo&apos;nalish sahifalarida ko&apos;rinish</Bullet>
            <Bullet>Cheklanmagan buyurtmalar, aloqa ma&apos;lumotlari mijozlarga ochiq</Bullet>
            <Bullet>E&apos;lonlarga taklif yuborish — kuniga {PROPOSAL_DAILY_LIMIT} tagacha</Bullet>
            <Bullet>Portfolio, xizmat paketlari, sharhlar va qisqa havola</Bullet>
            <Bullet>Eskrou to&apos;lovlar va balansdan pul chiqarish</Bullet>
          </ul>
          <ButtonLink href="/auth/royxat?role=specialist" variant="accent" size="lg" className="mt-8 w-full">
            Mutaxassis sifatida boshlash <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </section>

      {/* ---------- Rejalar jadvali ---------- */}
      <section aria-labelledby="plans-title" className="mx-auto mt-14 max-w-5xl">
        <div className="mb-5 max-w-2xl">
          <h2 id="plans-title" className="font-display text-[24px] font-semibold text-fg sm:text-[28px]">
            Uzoqroq muddat — kattaroq chegirma
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">Yangi davr joriy obuna yoki sinov tugagan kundan boshlanadi — qolgan kunlar yo&apos;qolmaydi.</p>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-left text-[14px]">
            <caption className="sr-only">Obuna rejalari va narxlari</caption>
            <thead className="border-b border-line bg-surface-2 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">
              <tr>
                <th scope="col" className="px-4 py-3 sm:px-6">
                  Muddat
                </th>
                <th scope="col" className="px-2 py-3 sm:px-6">
                  Oyiga
                </th>
                <th scope="col" className="px-4 py-3 text-right sm:px-6">
                  Jami
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {plans.map((p) => (
                <tr key={p.months}>
                  <th scope="row" className="px-4 py-3.5 font-semibold text-fg sm:px-6">
                    <span className="flex flex-wrap items-center gap-2">
                      {p.months} oy
                      {p.discountPct > 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-text">−{p.discountPct}%</span>}
                    </span>
                  </th>
                  <td className="whitespace-nowrap px-2 py-3.5 text-fg-2 tabular-nums sm:px-6">{formatPrice(p.monthly)}</td>
                  <td className="px-4 py-3.5 text-right sm:px-6">
                    <span className="block whitespace-nowrap font-semibold text-fg tabular-nums">{formatPrice(p.price)}</span>
                    {p.savings > 0 && <span className="block whitespace-nowrap text-[12px] text-success-text">{formatPrice(p.savings)} tejash</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- Eskrou komissiyasi ---------- */}
      <section aria-labelledby="commission-title" className="mx-auto mt-14 max-w-5xl">
        <div className="mb-5 max-w-2xl">
          <span className="eyebrow">
            <ShieldCheck size={13} className="text-accent" /> Eskrou
          </span>
          <h2 id="commission-title" className="mt-4 font-display text-[24px] font-semibold text-fg sm:text-[28px]">
            Platforma orqali to&apos;lovlar uchun xizmat haqi
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">
            Mijoz eskrou orqali to&apos;lasa, pul ish qabul qilinguncha platformada turadi. Ish qabul qilingach mutaxassisga o&apos;tadi, xizmat haqi shu summa ichidan ushlanadi — mijoz ustiga to&apos;lamaydi.
            Platformadan tashqaridagi kelishuvlardan komissiya olinmaydi.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {tiers.map((t) => (
            <div key={t.name} className={cn("flex items-center gap-4 p-4 sm:block sm:p-5", t.emphasis ? "card-elevated" : "card")}>
              <div className="hidden items-center justify-between gap-3 sm:flex">
                <span className={t.emphasis ? "icon-tile-soft icon-tile-sm" : "icon-tile-outline icon-tile-sm"} aria-hidden="true">
                  <t.icon size={16} />
                </span>
                <BadgePercent size={16} className="text-fg-4" aria-hidden="true" />
              </div>
              <p className="w-[88px] shrink-0 font-display text-[30px] font-semibold leading-none tracking-tight text-fg tabular-nums sm:mt-4 sm:w-auto sm:text-[34px]">{t.pct}%</p>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-fg sm:mt-2">{t.name}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-fg-3">{t.rule}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Savollar ---------- */}
      <section aria-labelledby="faq-title" className="mx-auto mt-14 max-w-3xl">
        <span className="eyebrow">
          <HelpCircle size={13} className="text-accent" /> Savollar
        </span>
        <h2 id="faq-title" className="mt-4 font-display text-[24px] font-semibold text-fg sm:text-[28px]">
          Ko&apos;p so&apos;raladigan savollar
        </h2>
        <div className="mt-5 divide-y divide-line rounded-[var(--r-md)] border border-line bg-surface">
          {faq.map((f, i) => (
            <details key={f.q} className="group px-4 sm:px-6" open={i === 0}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 text-[15px] font-semibold text-fg [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fg/6 text-fg-2 transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="pb-4 text-[14px] leading-relaxed text-fg-2">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-fg-3">
          Batafsil shartlar —{" "}
          <Link href="/oferta#obuna" className="font-semibold text-accent-text underline underline-offset-2">
            Ommaviy oferta
          </Link>
          .
        </p>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto mt-14 max-w-5xl">
        <div className="card-elevated flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-xl">
            <h2 className="font-display text-[22px] font-semibold text-fg sm:text-[26px]">Ijodkormisiz? Mijozlar sizni xaritada qidirmoqda</h2>
            <p className="mt-1.5 text-[14px] text-fg-2">{trial > 0 ? `${trial} kun bepul sinab ko'ring — keyin ${price} / oy.` : `${price} / oy.`}</p>
          </div>
          <ButtonLink href="/auth/royxat?role=specialist" variant="accent" size="lg" className="w-full shrink-0 sm:w-auto">
            Mutaxassis sifatida boshlash <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
