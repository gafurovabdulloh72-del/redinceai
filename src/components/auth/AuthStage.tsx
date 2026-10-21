"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, MapPinned, MessageSquareText } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CountUp } from "@/components/motion/useCountUp";
import { CATEGORIES, CATEGORY_BY_SLUG } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Suzuvchi kasb belgilari: [slug, top%, left%, o'lcham, kechikish(s), burilish(deg)] */
const BUBBLES: Array<[string, number, number, number, number, number]> = [
  ["videograf", 6, 60, 54, 0, -8],
  ["dizayner", 4, 84, 40, 2.2, -4],
  ["montajor", 44, 74, 44, 1.1, 10],
  ["fotograf", 52, 88, 38, 0.6, 6],
  ["frontend", 14, 70, 34, 2.8, 8],
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
    <aside className="card relative hidden overflow-hidden p-10 lg:sticky lg:top-28 lg:flex lg:flex-col lg:self-start" aria-hidden="true">
      {/* Nur sharlari */}
      <span className="animate-orb pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, #ff5a36, transparent 68%)" }} />
      <span className="animate-orb pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle, #8b7fd1, transparent 68%)", animationDelay: "-7s" }} />

      {/* Suzuvchi kasb belgilari */}
      <div className="pointer-events-none absolute inset-x-0 top-6 h-[22%]">
        {BUBBLES.map(([slug, top, left, size, delay, rot]) => {
          const c = CATEGORY_BY_SLUG[slug] ?? CATEGORIES[0];
          return (
            <span
              key={slug}
              className="animate-float absolute flex items-center justify-center rounded-[28%] text-white shadow-[0_14px_30px_-12px_var(--b)]"
              style={{
                top: `${top}%`,
                left: `${left}%`,
                width: size,
                height: size,
                background: `linear-gradient(145deg, ${c.accent}, ${c.accent}aa)`,
                animationDelay: `${delay}s`,
                ["--b" as string]: c.accent,
                ["--float-rot" as string]: `${rot}deg`,
                opacity: 0.92,
              }}
            >
              <CategoryIcon icon={c.icon} size={Math.round(size * 0.46)} />
            </span>
          );
        })}
      </div>

      <div className="relative flex-1">
        <div>
          <Logo />
        </div>
        <span className="eyebrow mt-12">{eyebrow}</span>
        <h2 className="display-xl mt-5 max-w-md text-[40px] text-fg xl:text-[46px]">
          {titleA}
          <span className="accent-serif text-accent">{titleAccent}</span>
        </h2>
        <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold text-fg-2">
          <span className="text-fg-3">{pickerLabel}</span>
          <RotatingWord />
        </p>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-fg-2">{lead}</p>
      </div>

      <ul className="stagger relative mb-8 mt-10 divide-y divide-line border-y border-line">
        {benefits.map((b) => {
          const Icon = icons[b.icon];
          return (
            <li key={b.title} className={cn("animate-fade-up flex items-start gap-4 py-4")}>
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

      <div className="relative flex items-end gap-8">
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
