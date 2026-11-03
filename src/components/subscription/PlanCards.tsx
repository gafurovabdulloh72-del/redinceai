import Link from "next/link";
import { Check, Crown, Minus, Sparkles } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { TIER_LIMITS, VIEWERS_LIST, type Tier } from "@/lib/subscriptions/pro";
import { cn, formatPrice } from "@/lib/utils";

/**
 * TARIF KARTALARI (2026-11-03, professional SaaS uslubi): doim QORONG'U panel (`data-theme="dark"` subtree),
 * uchta karta — Standart (0) · Pro · Max (ajratilgan, accent ramka, telefonda birinchi).
 * Har kartada: nom + belgi, tavsif, katta narx, izoh, CTA, kunlik taklif limiti (segmentli chiziq),
 * ✦ asosiy imkoniyatlar va ✓/— ro'yxat. Server komponent — JS'siz.
 * Batafsil taqqoslash — `PlanCompare` (pastda, yig'ilgan). Ma'lumot — lib/subscriptions/pro.ts bilan mos.
 */

type Feature = { t: string; on: boolean };

interface Card {
  key: "free" | "pro" | "max";
  name: string;
  badge?: string;
  tagline: string;
  price: string;
  per: string;
  note: string;
  cta: { label: string; href: string; tone: "muted" | "solid" | "accent" };
  meter: number;
  offer?: { title: string; items: string[] };
  features: Feature[];
  featured?: boolean;
}

const SEGMENTS = 25;

function Meter({ value, label, featured }: { value: number; label: string; featured?: boolean }) {
  const filled = Math.max(1, Math.round((value / TIER_LIMITS.max.proposals) * SEGMENTS));
  return (
    <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.035] px-4 py-3.5">
      <p className="text-[13.5px] text-white/85">
        <span className={cn("font-semibold", featured ? "text-[#ff8a6b]" : "text-white")}>{value}</span> {label}
      </p>
      <div className="mt-2.5 flex gap-[3px]" aria-hidden>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className={cn("h-[10px] flex-1 rounded-[2px]", i < filled ? (featured ? "bg-[#ff6a45]" : "bg-white/85") : "bg-white/[0.09]")} />
        ))}
      </div>
    </div>
  );
}

export function PlanCards({
  til,
  proPrice,
  maxPrice,
  trialDays,
  freeHref = "/auth/royxat?role=specialist",
  proHref = "/kabinet/obuna?tarif=pro#rejalar",
  maxHref = "/kabinet/obuna?tarif=max#rejalar",
}: {
  til: Locale;
  proPrice: number;
  maxPrice: number;
  trialDays: number;
  freeHref?: string;
  proHref?: string;
  maxHref?: string;
}) {
  const ru = til === "ru";
  const som = (n: number) => formatPrice(n).replace(/\s*so'm$/, "");
  const perMonth = ru ? "сум / мес" : "so'm / oy";
  const proposalsLabel = ru ? "предложений в день" : "ta taklif kuniga";

  // Raqamli chegaralar (TIER_LIMITS) — har tarifda aniq son
  const limits = (t: Tier): Feature[] => {
    const L = TIER_LIMITS[t];
    return ru
      ? [
          { t: `${L.posts} постов и ${L.stories} сторис в неделю`, on: true },
          { t: `До ${L.portfolio} работ в портфолио`, on: true },
        ]
      : [
          { t: `Haftasiga ${L.posts} ta post va ${L.stories} ta story`, on: true },
          { t: `Portfolioda ${L.portfolio} tagacha ish`, on: true },
        ];
  };

  const cards: Card[] = [
    {
      key: "free",
      name: ru ? "Стандарт" : "Standart",
      tagline: ru ? "Чтобы начать и попробовать платформу" : "Boshlash va platformani sinash uchun",
      price: "0",
      per: perMonth,
      note: trialDays > 0 ? (ru ? `Первые ${trialDays} дн. профиль виден в каталоге` : `Birinchi ${trialDays} kun profil katalogda ko'rinadi`) : ru ? "Без оплаты" : "To'lovsiz",
      cta: { label: ru ? "Начать бесплатно" : "Bepul boshlash", href: freeHref, tone: "muted" },
      meter: TIER_LIMITS.free.proposals,
      features: ru
        ? [
            ...limits("free"),
            { t: "Отзывы, чат, сообщества", on: true },
            { t: "Просмотры профиля по дням", on: true },
            { t: "Выше в каталоге", on: false },
            { t: "Мгновенные уведомления о заказах", on: false },
            { t: "Кто смотрел профиль", on: false },
          ]
        : [
            ...limits("free"),
            { t: "Sharhlar, chat, jamoalar", on: true },
            { t: "Profil ko'rishlari (kunlik)", on: true },
            { t: "Katalogda yuqorida", on: false },
            { t: "E'lonlar haqida darhol xabar", on: false },
            { t: "Profilni kim ko'rdi", on: false },
          ],
    },
    {
      key: "pro",
      name: "Pro",
      tagline: ru ? "Для активных специалистов" : "Faol ijodkorlar uchun",
      price: som(proPrice),
      per: perMonth,
      note: ru ? "Оплата помесячно, без автосписания" : "Oylik to'lov, avtomatik yechib olinmaydi",
      cta: { label: ru ? "Подключить Pro" : "Pro'ga o'tish", href: proHref, tone: "solid" },
      meter: TIER_LIMITS.pro.proposals,
      offer: {
        title: ru ? "Главное в Pro" : "Pro'ning asosiysi",
        items: ru
          ? ["Выше обычных профилей в каталоге", "Новые заказы — сразу в Telegram", `Кто смотрел профиль (последние ${VIEWERS_LIST.pro})`]
          : ["Katalogda oddiy profillardan oldin", "Yangi e'lonlar — darhol Telegramga", `Profilni kim ko'rdi (oxirgi ${VIEWERS_LIST.pro} kishi)`],
      },
      features: ru
        ? [
            { t: "Значок «PRO» в профиле и карточке", on: true },
            ...limits("pro"),
            { t: "Топ постов и проданные контакты", on: true },
            { t: "Всё из Стандарта", on: true },
          ]
        : [
            { t: "Profil va kartada «PRO» belgisi", on: true },
            ...limits("pro"),
            { t: "Top postlar va sotilgan kontaktlar", on: true },
            { t: "Standart'dagi hamma narsa", on: true },
          ],
    },
    {
      key: "max",
      name: "Max",
      badge: ru ? "Максимум клиентов" : "Eng ko'p mijoz",
      tagline: ru ? "Для студий и топ-специалистов" : "Studiyalar va top ijodkorlar uchun",
      price: som(maxPrice),
      per: perMonth,
      note: ru ? "Всё из Pro + максимальная видимость" : "Pro'dagi hamma narsa + eng yuqori ko'rinish",
      cta: { label: ru ? "Подключить Max" : "Max'ga o'tish", href: maxHref, tone: "accent" },
      meter: TIER_LIMITS.max.proposals,
      offer: {
        title: ru ? "Только в Max" : "Faqat Max'da",
        items: ru
          ? ["Самое верхнее место в каталоге и поиске", "Новые заказы приходят первым — раньше Pro", "В «Рекомендуемых авторах» в ленте", `Кто смотрел профиль — последние ${VIEWERS_LIST.max}`]
          : ["Katalog va qidiruvda eng tepada", "Yangi e'lon sizga birinchi keladi — Pro'dan oldin", "Lentadagi «Tavsiya etilgan ijodkorlar»da", `Profilni kim ko'rdi — oxirgi ${VIEWERS_LIST.max} kishi`],
      },
      features: ru
        ? [
            { t: "Значок «MAX» в профиле и карточке", on: true },
            ...limits("max"),
            { t: "Топ постов и проданные контакты", on: true },
            { t: "Всё из Pro", on: true },
          ]
        : [
            { t: "Profil va kartada «MAX» belgisi", on: true },
            ...limits("max"),
            { t: "Top postlar va sotilgan kontaktlar", on: true },
            { t: "Pro'dagi hamma narsa", on: true },
          ],
      featured: true,
    },
  ];

  return (
    <div data-theme="dark" className="rounded-[28px] bg-[#0b0b0d] p-3 text-white sm:p-4 max-sm:-mx-4 max-sm:rounded-none">
      <div className="grid gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <article
            key={c.key}
            className={cn(
              "relative flex flex-col rounded-[22px] border p-5 sm:p-6",
              c.featured
                ? "border-[#ff6a45]/60 bg-gradient-to-b from-[#ff5a36]/[0.14] to-[#141416] shadow-[0_0_0_1px_rgba(255,106,69,0.25),0_20px_60px_-20px_rgba(255,90,54,0.45)] max-lg:order-first"
                : "border-white/[0.08] bg-[#141416]",
            )}
          >
            <header className="min-h-[72px]">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={cn("inline-flex items-center gap-1.5 font-display text-[24px] font-semibold tracking-tight", c.featured ? "text-[#ff8a6b]" : "text-white")}>
                  {c.featured && <Crown size={19} aria-hidden />}
                  {c.name}
                </h3>
                {c.badge && <span className="rounded-[7px] border border-[#ff8a6b]/50 px-1.5 py-0.5 text-[11.5px] font-bold italic text-[#ff8a6b]">{c.badge}</span>}
              </div>
              <p className="mt-1 text-[13px] text-white/50">{c.tagline}</p>
            </header>
            <div className="my-5 h-px bg-white/[0.08]" />
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="font-display text-[46px] font-semibold leading-none tracking-tight tabular-nums">{c.price}</span>
              <span className="text-[14px] text-white/45">{c.per}</span>
            </p>
            <p className="mt-2 min-h-[20px] text-[13px] text-white/75">{c.note}</p>
            <Link
              href={c.cta.href}
              className={cn(
                "mt-5 flex h-12 items-center justify-center rounded-[13px] text-[14.5px] font-semibold transition-[background-color,transform] active:scale-[0.98]",
                c.cta.tone === "muted" && "bg-white/[0.07] text-white/70 hover:bg-white/[0.11]",
                c.cta.tone === "solid" && "bg-white/[0.12] text-white hover:bg-white/[0.18]",
                c.cta.tone === "accent" && "bg-[#ff5a36] text-white hover:bg-[#ff6d4d]",
              )}
            >
              {c.cta.label}
            </Link>
            <div className="mt-5">
              <Meter value={c.meter} label={proposalsLabel} featured={c.featured} />
            </div>
            {c.offer && (
              <div className="mt-3 rounded-[14px] border border-white/[0.07] bg-white/[0.035] px-4 py-3.5">
                <p className="mb-2.5 inline-flex items-center gap-1.5 rounded-[8px] bg-white/[0.07] px-2 py-1 text-[12.5px] font-medium text-white/80">
                  <Sparkles size={12} aria-hidden /> {c.offer.title}
                </p>
                <ul className="space-y-2">
                  {c.offer.items.map((it) => (
                    <li key={it} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-white/90">
                      <span className={cn("mt-px text-[13px]", c.featured ? "text-[#ff8a6b]" : "text-white")} aria-hidden>
                        ✦
                      </span>
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="my-5 h-px bg-white/[0.08]" />
            <ul className="space-y-2.5">
              {c.features.map((f) => (
                <li key={f.t} className={cn("flex items-start gap-2.5 text-[13.5px] leading-snug", f.on ? "text-white/85" : "text-white/30")}>
                  {f.on ? <Check size={15} className="mt-px shrink-0 text-white/60" aria-hidden /> : <Minus size={15} className="mt-px shrink-0" aria-hidden />}
                  <span>
                    {f.t}
                    {!f.on && <span className="sr-only"> — {ru ? "нет" : "yo'q"}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
