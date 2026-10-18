import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Clapperboard,
  Handshake,
  HeartHandshake,
  Landmark,
  LifeBuoy,
  Lock,
  MapPinned,
  MessageCircle,
  Radio,
  RadioTower,
  ScrollText,
  Send,
  ShieldCheck,
  Star,
  UserRound,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ButtonLink, IconTile, PageHeader } from "@/components/ui";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Biz haqimizda",
  alternates: { canonical: "/haqida" },
  description:
    "Kasb Egalari — ijodkorlar va barcha onlayn kasb egalari uchun platforma: buyurtmalar, jamoalar va kanallar, jonli efirlar, vakansiyalar. Loyiha, ishonch kafolatlari va asoschi haqida.",
};

/** Platformaning asosiy bo'limlari — foydalanuvchi bir qarashda nimalar borligini ko'radi */
const FEATURES: Array<{ icon: LucideIcon; t: string; d: string; href: string; cta: string }> = [
  {
    icon: MapPinned,
    t: "Ijodkorlar katalogi va xarita",
    d: "Videograf, montajchi, dizayner, fotograf, motion va 3D — 14 ta hudud bo'yicha. Portfolio, narxlar, haqiqiy sharhlar, taqqoslash.",
    href: "/mutaxassislar",
    cta: "Katalog",
  },
  {
    icon: Wallet,
    t: "Buyurtma va xavfsiz to'lov",
    d: "Buyurtma yuboring, chatda kelishing, to'lovni eskrouga qo'ying — pul ish qabul qilingach o'tadi. Mijoz ham, ijodkor ham himoyada.",
    href: "/buyurtma-berish",
    cta: "Buyurtma berish",
  },
  {
    icon: UsersRound,
    t: "Jamoalar va kanallar",
    d: "Yo'nalish va hudud bo'yicha guruhlar: lenta, chat, a'zolar. Kanallar — e'lonlar va tajriba ulashish. Rasmiy kanalda platforma yangiliklari.",
    href: "/jamoalar",
    cta: "Jamoalar",
  },
  {
    icon: RadioTower,
    t: "Jonli efirlar va yig'ilishlar",
    d: "Haftasiga bir necha marta: portfolio tahlili, savol-javob, mehmonlar. E'lon kanalda chiqadi, eslatma Telegramga keladi.",
    href: "/jamoalar",
    cta: "Efirlar",
  },
  {
    icon: Briefcase,
    t: "Vakansiyalar va rezyumelar",
    d: "IT, dizayn, video, marketing, kontent, sotuv, moliya, ta'lim va boshqa onlayn kasblar. Joylash ham, ariza berish ham bepul.",
    href: "/vakansiyalar",
    cta: "Vakansiyalar",
  },
  {
    icon: MessageCircle,
    t: "Chat va Telegram bildirishnomalari",
    d: "Shaxsiy chat, fayl va video almashish, buyurtma bo'yicha muloqot. Muhim xabarlar Telegram botga ham boradi.",
    href: "/kabinet/chat",
    cta: "Chat",
  },
];

/** Ishonch kafolatlari — platforma qoidalarining foydalanuvchiga ko'rinadigan tomoni */
const TRUST: Array<{ icon: LucideIcon; t: string; d: string }> = [
  {
    icon: Landmark,
    t: "Eskrou — pul himoyada",
    d: "Buyurtma to'lovi avval eskrou hisobida turadi. Ijodkorga faqat siz ishni qabul qilganingizdan keyin o'tadi — pul o'rtada yo'qolmaydi.",
  },
  {
    icon: Lock,
    t: "Kontaktlar maxfiy",
    d: "Ijodkorning telefoni va ijtimoiy tarmoqlari buyurtma qabul qilingunicha yopiq. Nomzodning kontakti faqat o'zi ariza yuborgan ish beruvchiga ochiladi.",
  },
  {
    icon: Star,
    t: "Sharhlar faqat haqiqiy",
    d: "Baho va sharhni faqat buyurtmasi yakunlangan mijoz qoldira oladi. Soxta sharh yozib bo'lmaydi.",
  },
  {
    icon: HeartHandshake,
    t: "Nizolarni platforma hal qiladi",
    d: "Kelishmovchilik bo'lsa, administratsiya yozishmalar va ish natijasini ko'rib chiqib, adolatli qaror qabul qiladi — pul qaytarilishi ham mumkin.",
  },
  {
    icon: Radio,
    t: "Jamoalarda tartib",
    d: "Har bir guruh va kanalning egasi va adminlari bor; platforma admini ham a'zo — spam va haqoratga joy yo'q, qoidalar ochiq yozilgan.",
  },
  {
    icon: Briefcase,
    t: "Vakansiyalar — to'lovsiz va tekshiriladi",
    d: "Ish joylash va ariza berish uchun pul olinmaydi. Oldindan to'lov so'raydigan yoki shubhali e'lonlar olib tashlanadi.",
  },
];

/** Kim uchun — uch auditoriya, har biriga o'z yo'li */
const PATHS: Array<{ icon: LucideIcon; t: string; items: string[]; href: string; cta: string }> = [
  {
    icon: UserRound,
    t: "Buyurtmachiga",
    items: ["Katalog yoki xaritadan ijodkorni tanlang", "Buyurtma yuboring, chatda kelishing", "Eskrou orqali xotirjam to'lang, sharh qoldiring"],
    href: "/mutaxassislar",
    cta: "Ijodkorlarni ko'rish",
  },
  {
    icon: Clapperboard,
    t: "Ijodkorga",
    items: ["Profil, portfolio va narxlaringizni kiriting", "Buyurtmalar va ochiq e'lonlarga takliflar oling", "Jamoalarda tajriba ulashing, kanal oching"],
    href: "/auth/royxat?intent=service",
    cta: "Mutaxassis bo'lish",
  },
  {
    icon: Briefcase,
    t: "Ish qidiruvchi va ish beruvchiga",
    items: ["2 daqiqalik rezyume — bir bosishda ariza", "Vakansiyani bepul joylang, arizalar kabinetga keladi", "Kontakt faqat ariza bilan ochiladi"],
    href: "/vakansiyalar",
    cta: "Vakansiyalar",
  },
];

export default function AboutPage() {
  return (
    <div className="container-x animate-fade-up">
      <PageHeader
        eyebrow={
          <>
            <BadgeCheck size={13} className="text-accent" /> Biz haqimizda
          </>
        }
        title={
          <>
            Ish, buyurtma va hamjamiyat — <span className="accent-serif text-accent">bir joyda</span>
          </>
        }
        description={`${SITE.name} — O'zbekiston ijodkorlari va barcha onlayn kasb egalari uchun platforma: ijodkorlar katalogi va xavfsiz buyurtma, jamoalar va kanallar, jonli efirlar, vakansiyalar va rezyumelar. 14 ta hudud, bitta tizim.`}
      />

      {/* Missiya */}
      <section data-reveal className="card mt-8 p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <IconTile icon={Clapperboard} tone="soft" />
          <div className="min-w-0">
            <h2 className="font-display text-[20px] font-semibold text-fg">Nega bu loyiha kerak</h2>
            <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-fg-2">
              O'zbekistonda kuchli ijodkorlar va onlayn mutaxassislar ko'p, lekin ular haligacha tarqoq Telegram guruhlari va tanish-bilish orqali topiladi: mijoz
              kimga ishonishni bilmaydi, ijodkor halol mehnatining pulini kutib qoladi, ish qidirgan odam esa yuzlab chatni titkilaydi. {SITE.name} shu uch
              muammoni bitta tizimda hal qiladi — tekshirilgan profillar va eskrou to'lov, tartibli jamoalar va kanallar, to'lovsiz vakansiyalar.
            </p>
            <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-fg-2">
              Bu shunchaki katalog emas — ijodkorlarning ijtimoiy tarmog'i: bir joyda ishlaysiz, o'rganasiz, tajriba ulashasiz va yangi imkoniyat topasiz.
            </p>
          </div>
        </div>
      </section>

      {/* Nimalar bor */}
      <section data-reveal aria-labelledby="features-title" className="mt-8">
        <h2 id="features-title" className="font-display text-[20px] font-semibold text-fg">
          Platformada nimalar bor
        </h2>
        <div className="stagger mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link key={f.t} href={f.href} className="card card-hover group flex flex-col p-5">
              <span className="icon-tile-soft shrink-0">
                <f.icon size={18} aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-[15.5px] font-semibold text-fg group-hover:text-accent">{f.t}</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">{f.d}</p>
              <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] font-semibold text-accent-text">
                {f.cta} <ArrowRight size={13} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Kim uchun — yo'llar */}
      <section data-reveal aria-labelledby="paths-title" className="card mt-8 p-5 sm:p-7">
        <h2 id="paths-title" className="font-display text-[20px] font-semibold text-fg">
          Qanday ishlaydi
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {PATHS.map((p) => (
            <div key={p.t} className="card-outline flex flex-col !rounded-[18px] p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-ink-fg" aria-hidden="true">
                  <p.icon size={16} />
                </span>
                <h3 className="text-[15px] font-semibold text-fg">{p.t}</h3>
              </div>
              <ol className="mt-3 grid gap-2 text-[13px] leading-relaxed text-fg-2">
                {p.items.map((it, i) => (
                  <li key={it} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent-text">{i + 1}</span>
                    {it}
                  </li>
                ))}
              </ol>
              <ButtonLink href={p.href} variant="outline" size="sm" className="mt-4 w-fit">
                {p.cta} <ArrowRight size={13} />
              </ButtonLink>
            </div>
          ))}
        </div>
      </section>

      {/* Ishonch kafolatlari */}
      <section data-reveal aria-labelledby="trust-title" className="mt-8">
        <h2 id="trust-title" className="font-display text-[20px] font-semibold text-fg">
          Nimaga ishonsa bo'ladi
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST.map((x) => (
            <div key={x.t} className="card p-5">
              <div className="flex items-start gap-3">
                <span className="icon-tile-soft shrink-0">
                  <x.icon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-fg">{x.t}</h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">{x.d}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Nima bepul, nima pullik — ochiq */}
      <section data-reveal aria-labelledby="pricing-title" className="card mt-8 p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <IconTile icon={Wallet} tone="soft" />
          <div className="min-w-0 flex-1">
            <h2 id="pricing-title" className="font-display text-[20px] font-semibold text-fg">
              Nima bepul, nima pullik
            </h2>
            <ul className="mt-3 grid gap-2 text-[14px] leading-relaxed text-fg-2 sm:grid-cols-2">
              <li className="flex gap-2">
                <BadgeCheck size={16} className="mt-0.5 shrink-0 text-success" /> Ro'yxatdan o'tish, buyurtma berish, chat — bepul
              </li>
              <li className="flex gap-2">
                <BadgeCheck size={16} className="mt-0.5 shrink-0 text-success" /> Jamoalar, kanallar, jonli efirlar — bepul
              </li>
              <li className="flex gap-2">
                <BadgeCheck size={16} className="mt-0.5 shrink-0 text-success" /> Vakansiya joylash, rezyume, ariza — bepul
              </li>
              <li className="flex gap-2">
                <Star size={16} className="mt-0.5 shrink-0 text-accent" /> Ijodkor profili katalogda ko'rinishi — obuna (sinov muddati bor, narxlar ochiq)
              </li>
            </ul>
            <ButtonLink href="/narxlar" variant="outline" size="sm" className="mt-4">
              Narxlarni ko'rish <ArrowRight size={13} />
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Asoschi */}
      <section data-reveal aria-labelledby="founder-title" className="card mt-8 p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <IconTile icon={UserRound} tone="soft" />
          <div className="min-w-0 flex-1">
            <h2 id="founder-title" className="font-display text-[20px] font-semibold text-fg">
              Asoschi haqida
            </h2>
            <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-fg-2">
              Loyiha asoschisi — <span className="font-semibold text-fg">{SITE.owner}</span>, buxorolik video montajor. Bir necha yildan beri ta'lim va shaxsiy
              brend loyihalari uchun video montaj qiladi, ya'ni platformani «tashqaridan» emas, sohaning ichidan turib qurgan: ijodkor buyurtmani qayerdan topishini,
              mijoz esa kimga ishonishni bilmasligini o'z tajribasidan biladi.
            </p>
            <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-fg-2">
              Rasmiy kanalda haftasiga bir necha marta jonli efirlar o'tkazadi — portfolio tahlili, savol-javob, soha yangiliklari. Savol, taklif yoki hamkorlik
              bo'yicha to'g'ridan-to'g'ri yozishingiz mumkin — har bir xabar o'qiladi.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <a
                href="https://t.me/montajor_man"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg"
              >
                <Send size={14} aria-hidden="true" /> Telegram: @montajor_man
              </a>
              <Link
                href="/mutaxassislar/kasb-egalari-admin"
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg"
              >
                <Clapperboard size={14} aria-hidden="true" /> Saytdagi profili
              </Link>
              <Link
                href="/jamoalar"
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg"
              >
                <RadioTower size={14} aria-hidden="true" /> Rasmiy kanal va efirlar
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Aloqa + hujjatlar */}
      <section data-reveal aria-labelledby="contact-title" className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <IconTile icon={LifeBuoy} tone="soft" />
            <div className="min-w-0">
              <h2 id="contact-title" className="font-display text-[17px] font-semibold text-fg">
                Yordam va aloqa
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">
                Ko'p beriladigan savollarga javoblar{" "}
                <Link href="/yordam" className="font-semibold text-accent-text">
                  Yordam markazida
                </Link>
                . Telegram kanal:{" "}
                <a href={SITE.supportTelegram} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-text" dir="ltr">
                  t.me/kasb_egalari
                </a>
                , telefon: <span className="font-semibold text-fg" dir="ltr">{SITE.supportPhone}</span>. Shubhali vakansiya yoki foydalanuvchi haqida ham shu yerga yozing.
              </p>
            </div>
          </div>
        </div>
        <div className="card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <IconTile icon={ScrollText} tone="soft" />
            <div className="min-w-0">
              <h2 className="font-display text-[17px] font-semibold text-fg">Ochiq qoidalar</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">
                Platforma qanday ishlashi hujjatlarda ochiq yozilgan:{" "}
                <Link href="/oferta" className="font-semibold text-accent-text">
                  Foydalanish shartlari
                </Link>{" "}
                va{" "}
                <Link href="/maxfiylik" className="font-semibold text-accent-text">
                  Maxfiylik siyosati
                </Link>
                . Ma'lumotlaringiz uchinchi shaxslarga sotilmaydi; kontaktlar faqat siz ruxsat bergan holatlarda ochiladi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Qamrov + CTA */}
      <section data-reveal className="card-outline mt-8 flex flex-col items-start gap-4 !rounded-card-lg p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <IconTile icon={MapPinned} tone="soft" />
          <div>
            <p className="font-display text-[17px] font-semibold text-fg">14 hudud — bitta tizim</p>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-2">Toshkentdan Xorazmgacha: ijodkorlar xaritada, jamoalar va vakansiyalar — butun O'zbekiston bo'ylab.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/xarita" variant="outline" size="md" className="shrink-0">
            <Handshake size={14} /> Xarita
          </ButtonLink>
          <ButtonLink href="/auth/royxat" variant="accent" size="md" className="shrink-0">
            Boshlash <ArrowRight size={14} />
          </ButtonLink>
        </div>
      </section>

      {/* Ishonch belgisi */}
      <p className="mt-8 flex items-center justify-center gap-2 text-center text-[12.5px] text-fg-3">
        <ShieldCheck size={14} className="text-success" aria-hidden="true" /> {SITE.name} — ro'yxatdan o'tish, jamoalar va vakansiyalar bepul; buyurtma to'lovlari eskrou himoyasida.
      </p>
    </div>
  );
}
