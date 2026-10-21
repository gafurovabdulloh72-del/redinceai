"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, MapPinned, MessageSquareText } from "lucide-react";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CountUp } from "@/components/motion/useCountUp";
import { CATEGORIES, CATEGORY_BY_SLUG } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Suzuvchi kasb belgilari: [slug, top(px), left%, o'lcham, kechikish(s), burilish(deg)] — faqat bezak zonasi ichida (matn ustiga TUSHMAYDI) */
const BUBBLES: Array<[string, number, number, number, number, number]> = [
  ["videograf", 22, 3, 52, 0, -8],
  ["dizayner", 0, 19, 40, 2.2, -4],
  ["montajor", 46, 35, 44, 1.1, 10],
  ["fotograf", 4, 52, 46, 0.6, 6],
  ["frontend", 50, 69, 38, 2.8, 8],
  ["ovoz", 6, 85, 40, 1.7, -6],
];

/** Aylanib turuvchi kasb nomi: so'z almashganda yengil «swap» animatsiyasi */
function RotatingWord() {
  const [i, setI] = useState(0);
  const words = ["videograf", "montajor", "dizayner", "fotograf", "dasturchi", "kopirayter", "targetolog", "ovoz rejissyori"].map((w) => (CATEGORY_BY_SLUG[w]?.name ?? w));
  useEffect(() => {
    const t = window.setInterval(() => setI((v) => (v + 1) % words.length), 2200);
    return () => window.clearInterval(t);
  }, [words.length]);
  return (
    <span key={i} className="animate-swap inline-block bg-[image:var(--brand-grad)] bg-clip-text text-transparent">
      {words[i]}
    </span>
  );
}

/**
 * Auth chap paneli (faqat desktop): jonli sahna — sekin siljiydigan nur sharlari, suzuvchi kasb belgilari, aylanuvchi kasb nomi,
 * sonlar sanagichi. Barcha harakat `--animate-*` tokenlari orqali (reduced-motion'da o'chadi).
 */
export function AuthStage({
  eyebrow,
  titleA,
  titleAccent,
  lead,
  benefits,
  stats,
  freeSignup,
  pickerLabel,
}: {
  eyebrow: string;
  titleA: string;
  titleAccent: string;
  lead: string;
  benefits: Array<{ icon: "map" | "badge" | "chat"; title: string; text: string }>;
  stats: Array<{ value: number; suffix?: string; label: string }>;
  freeSignup: string;
  pickerLabel: string;
}) {
  const icons = { map: MapPinned, badge: BadgeCheck, chat: MessageSquareText } as const;
  return (
    <aside className="card relative hidden overflow-hidden p-8 lg:flex lg:flex-col" aria-hidden="true">
      {/* Nur sharlari — kichik, xira va faqat chekkalarda (matn ostiga tushmaydi, ustidan blur/tus yo'q) */}
      <span className="animate-orb pointer-events-none absolute -right-10 -top-20 h-48 w-48 rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle, #ff5a36, transparent 68%)" }} />
      <span className="animate-orb pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, #8b7fd1, transparent 68%)", animationDelay: "-7s" }} />

      {/* Bezak zonasi: oqimdagi alohida qator — belgilar faqat shu ichida suzadi, matn ostida joy band (juda past (≤600px) ekranda yashirinadi) */}
      <div className="pointer-events-none relative mb-5 h-[104px] shrink-0 tiny:hidden">
        {BUBBLES.map(([slug, top, left, size, delay, rot]) => {
          const c = CATEGORY_BY_SLUG[slug] ?? CATEGORIES[0];
          return (
            <span
              key={slug}
              className="animate-float absolute flex items-center justify-center rounded-[28%] text-white shadow-[0_12px_24px_-12px_var(--b)]"
              style={{
                top,
                left: `${left}%`,
                width: size,
                height: size,
                background: `linear-gradient(145deg, ${c.accent}, ${c.accent}aa)`,
                animationDelay: `${delay}s`,
                ["--b" as string]: c.accent,
                ["--float-rot" as string]: `${rot}deg`,
              }}
            >
              <CategoryIcon icon={c.icon} size={Math.round(size * 0.46)} />
            </span>
          );
        })}
      </div>

      <div className="relative">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="display-xl mt-4 max-w-md text-fg">
          {titleA}
          <span className="accent-serif text-accent">{titleAccent}</span>
        </h2>
        <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold text-fg-2">
          <span className="text-fg-3">{pickerLabel}</span>
          <RotatingWord />
        </p>
        <p className="mt-3 max-w-sm text-[14.5px] leading-relaxed text-fg-2 tiny:hidden">{lead}</p>
      </div>

      {/* Afzalliklar — faqat yetarli balandlikda (≥ 860px); past ekranda yashirinadi, shunda forma bilan birga bitta ekranga sig'adi */}
      <ul className="stagger relative mt-6 divide-y divide-line border-y border-line cozy:hidden">
        {benefits.map((b) => {
          const Icon = icons[b.icon];
          return (
            <li key={b.title} className={cn("animate-fade-up flex items-start gap-4 py-3.5")}>
              <span className="icon-tile-outline icon-tile-sm shrink-0">
                <Icon size={16} />
              </span>
              <span>
                <span className="block font-display text-[15px] font-semibold text-fg">{b.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-fg-3">{b.text}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="relative mt-auto flex items-end gap-8 pt-6">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="stat-num font-display text-[26px] leading-none tracking-tight text-fg">
              <CountUp value={s.value} />
              {s.suffix}
            </div>
            <div className="mt-1.5 text-[12px] font-medium text-fg-3">{s.label}</div>
          </div>
        ))}
        <div className="ml-auto text-[12px] text-fg-4">{freeSignup}</div>
      </div>
    </aside>
  );
}
