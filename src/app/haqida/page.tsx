import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Clapperboard, Handshake, HeartHandshake, Landmark, LifeBuoy, Lock, MapPinned, ScrollText, Send, ShieldCheck, Star, UserRound, type LucideIcon } from "lucide-react";
import { ButtonLink, IconTile, PageHeader } from "@/components/ui";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Biz haqimizda",
  description: "Kasb Egalari — O'zbekistonning ijodiy mutaxassislar marketpleysi. Loyiha, ishonch kafolatlari va asoschi haqida.",
};

/** Ishonch kafolatlari — platforma qoidalarining foydalanuvchiga ko'rinadigan tomoni */
const TRUST: Array<{ icon: LucideIcon; t: string; d: string }> = [
  {
    icon: Landmark,
    t: "Eskrou — pul himoyada",
    d: "Platformadagi to'lov avval eskrou hisobida turadi. Mutaxassisga faqat siz ishni qabul qilganingizdan keyin o'tadi — pul o'rtada yo'qolmaydi.",
  },
  {
    icon: Lock,
    t: "Kontaktlar maxfiy",
    d: "Mutaxassisning telefoni va ijtimoiy tarmoqlari buyurtma qabul qilingunicha yopiq — spam ham, platformadan chetlab o'tish ham yo'q.",
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
];

/** 3 qadamda qanday ishlaydi */
const STEPS: Array<{ n: string; t: string; d: string }> = [
  { n: "1", t: "Toping", d: "Katalog, xarita yoki qidiruv orqali o'zingizga mos ijodkorni tanlang — portfolio va sharhlari bilan." },
  { n: "2", t: "Kelishing", d: "Buyurtma yuboring, chatda muhokama qiling, narxni kelishib oling." },
  { n: "3", t: "Xotirjam to'lang", d: "To'lov eskrouda turadi; ish qabul qilingach mutaxassisga o'tadi." },
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
            Ijodkorlar va mijozlar <span className="accent-serif text-accent">bir joyda</span>
          </>
        }
        description={`${SITE.name} — O'zbekiston bo'ylab videograf, montajor va dizaynerlarni mijozlar bilan bog'laydigan marketpleys. 14 ta hudud, bitta xarita: portfolio, narxlar, sharhlar va xavfsiz to'lov — hammasi bir sahifada.`}
      />

      {/* Missiya */}
      <section className="card mt-8 p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <IconTile icon={Clapperboard} tone="soft" />
          <div className="min-w-0">
            <h2 className="font-display text-[20px] font-semibold text-fg">Nega bu loyiha kerak</h2>
            <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-fg-2">
              O'zbekistonda kuchli ijodkorlar ko'p, lekin ular haligacha Telegram guruhlari va tanish-bilish orqali topiladi: mijoz kimga ishonishni bilmaydi,
              ijodkor esa halol mehnatining pulini kutib qoladi. {SITE.name} shu ikki muammoni bitta tizimda hal qiladi — tekshirilgan profillar, ochiq narxlar va
              eskrou orqali kafolatlangan to'lov.
            </p>
          </div>
        </div>
      </section>

      {/* Ishonch kafolatlari */}
      <section aria-labelledby="trust-title" className="mt-8">
        <h2 id="trust-title" className="font-display text-[20px] font-semibold text-fg">
          Nimaga ishonsa bo'ladi
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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

      {/* Qanday ishlaydi */}
      <section aria-labelledby="steps-title" className="card mt-8 p-5 sm:p-7">
        <h2 id="steps-title" className="font-display text-[20px] font-semibold text-fg">
          Qanday ishlaydi
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="card-outline !rounded-[18px] p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-[15px] font-semibold text-ink-fg" aria-hidden="true">
                {s.n}
              </span>
              <h3 className="mt-3 text-[15px] font-semibold text-fg">{s.t}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-5">
          <ButtonLink href="/mutaxassislar" variant="accent" size="md">
            Ijodkorlarni ko'rish <ArrowRight size={14} />
          </ButtonLink>
          <ButtonLink href="/auth/royxat?role=specialist" variant="outline" size="md">
            Mutaxassis bo'lish
          </ButtonLink>
        </div>
      </section>

      {/* Asoschi */}
      <section aria-labelledby="founder-title" className="card mt-8 p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <IconTile icon={UserRound} tone="soft" />
          <div className="min-w-0 flex-1">
            <h2 id="founder-title" className="font-display text-[20px] font-semibold text-fg">
              Asoschi haqida
            </h2>
            <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-fg-2">
              Loyiha asoschisi — <span className="font-semibold text-fg">{SITE.owner}</span>, buxorolik video montajor. Bir necha yildan beri ta'lim va shaxsiy
              brend loyihalari uchun video montaj qiladi, ya'ni platformani «tashqaridan» emas, sohaning ichidan turib qurgan: ijodkor buyurtmani qayerdan
              topishini, mijoz esa kimga ishonishni bilmasligini o'z tajribasidan biladi.
            </p>
            <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-fg-2">
              Savol, taklif yoki hamkorlik bo'yicha to'g'ridan-to'g'ri yozishingiz mumkin — har bir xabar o'qiladi.
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
            </div>
          </div>
        </div>
      </section>

      {/* Aloqa + hujjatlar */}
      <section aria-labelledby="contact-title" className="mt-8 grid gap-4 lg:grid-cols-2">
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
                . Rasmiy kanal:{" "}
                <a href={SITE.supportTelegram} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-text" dir="ltr">
                  t.me/kasb_egalari
                </a>
                , telefon: <span className="font-semibold text-fg" dir="ltr">{SITE.supportPhone}</span>.
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
                . Ma'lumotlaringiz uchinchi shaxslarga sotilmaydi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Qamrov */}
      <section className="card-outline mt-8 flex flex-col items-start gap-4 !rounded-card-lg p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <IconTile icon={MapPinned} tone="soft" />
          <div>
            <p className="font-display text-[17px] font-semibold text-fg">14 hudud — bitta xarita</p>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-2">Toshkentdan Xorazmgacha: o'z hududingizdagi ijodkorlarni xaritadan toping.</p>
          </div>
        </div>
        <ButtonLink href="/xarita" variant="outline" size="md" className="shrink-0">
          <Handshake size={14} /> Xaritani ochish
        </ButtonLink>
      </section>

      {/* Ishonch belgisi */}
      <p className="mt-8 flex items-center justify-center gap-2 text-center text-[12.5px] text-fg-3">
        <ShieldCheck size={14} className="text-success" aria-hidden="true" /> {SITE.name} — ro'yxatdan o'tish mijozlar uchun bepul, to'lovlar eskrou himoyasida.
      </p>
    </div>
  );
}
