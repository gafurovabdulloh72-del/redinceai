"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/layout/Logo";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CountUp } from "@/components/motion/useCountUp";
import { CATEGORIES, CATEGORY_BY_SLUG } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Lentadagi kasblar: har qator boshqa guruhlardan aralash (bir xil rang ketma-ket kelmasin) */
const ROWS: string[][] = (() => {
  const rows: string[][] = [[], [], []];
  CATEGORIES.forEach((c, i) => rows[i % 3].push(c.slug));
  return rows;
})();

/**
 * Kasblar lentasi: chiplar cheksiz suriladi (CSS, JS'siz), chetlari niqob bilan so'nadi. Ro'yxat ikki marta chiziladi —
 * `--animate-marquee` -50% ga suradi, uzilish ko'rinmaydi. Reduced-motion'da to'xtaydi. `rows` — nechta qator.
 */
export function ProfessionMarquee({ rows = 3, className, tone = "auto" }: { rows?: 1 | 2 | 3; className?: string; tone?: "auto" | "dark" }) {
  return (
    <div className={cn("pointer-events-none select-none space-y-2.5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]", className)} aria-hidden="true">
      {ROWS.slice(0, rows).map((row, r) => (
        <div key={r} className={cn("flex w-max gap-2.5", r % 2 ? "animate-marquee-rev" : "animate-marquee")}>
          {[...row, ...row].map((slug, i) => {
            const c = CATEGORY_BY_SLUG[slug];
            if (!c) return null;
            return (
              <span
                key={`${slug}-${i}`}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border pl-1.5 pr-4 text-[13.5px] font-semibold",
                  tone === "dark" ? "border-white/10 bg-white/[0.04] text-white/85" : "border-line bg-surface text-fg-2",
                )}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: c.accent }}>
                  <CategoryIcon icon={c.icon} size={14} />
                </span>
                {c.name}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Aylanib turuvchi kasb nomi: so'z almashganda yengil «swap» animatsiyasi */
function RotatingWord() {
  const [i, setI] = useState(0);
  const words = ["videograf", "montajor", "dizayner", "fotograf", "frontend", "kopirayter", "targetolog", "ovoz"].map((w) => CATEGORY_BY_SLUG[w]?.name ?? w);
  useEffect(() => {
    const t = window.setInterval(() => setI((v) => (v + 1) % words.length), 2400);
    return () => window.clearInterval(t);
  }, [words.length]);
  return (
    <span key={i} className="animate-swap inline-block text-accent">
      {words[i]}
    </span>
  );
}

/**
 * Auth chap paneli (faqat lg+): har doim QORONG'U brend paneli (`data-theme="dark"` — ichidagi tokenlar qorong'u temaga o'tadi).
 * Tarkib: belgi → sarlavha + aylanuvchi kasb → kasblar lentasi → sonlar. Balandlik = ekran (h-dvh, sticky) — sahifani hech qachon uzaytirmaydi;
 * past ekranda ikkinchi darajali qismlar (izoh, lenta qatorlari) yashirinadi.
 */
export function AuthStage({
  eyebrow,
  titleA,
  titleAccent,
  lead,
  stats,
  freeSignup,
  pickerLabel,
}: {
  eyebrow: string;
  titleA: string;
  titleAccent: string;
  lead: string;
  stats: Array<{ value: number; suffix?: string; label: string }>;
  freeSignup: string;
  pickerLabel: string;
}) {
  return (
    <aside data-theme="dark" className="relative hidden h-dvh flex-col overflow-hidden bg-[#0e0e10] text-fg lg:sticky lg:top-0 lg:flex" aria-hidden="true">
      {/* Fon: nozik nuqtali to'r + bitta iliq nur pastki burchakda (matn ostida emas) */}
      <span className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(180deg,#000,transparent_75%)]" />
      <span className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, #ff5a36, transparent 65%)" }} />

      <div className="relative flex h-full flex-col px-12 py-10 xl:px-16 short:py-7">
        <Logo />

        <div className="mt-auto">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
          <h2 className="mt-5 max-w-[30rem] font-display text-[44px] font-extrabold leading-[1.04] tracking-[-0.03em] text-white xl:text-[52px] short:text-[38px]">
            {titleA}
            <span className="text-white/45">{titleAccent}</span>
          </h2>
          <p className="mt-5 text-[17px] font-semibold text-white/60">
            {pickerLabel} <RotatingWord />
          </p>
          <p className="mt-3 max-w-[27rem] text-[15px] leading-relaxed text-white/55 cozy:hidden">{lead}</p>
        </div>

        {/* Lenta panel chetidan chetigacha (padding'dan chiqadi) */}
        <ProfessionMarquee tone="dark" rows={3} className="-mx-12 mt-10 xl:-mx-16 short:mt-7 tiny:hidden [&>div:nth-child(3)]:short:hidden" />

        <div className="mt-auto flex items-end gap-10 border-t border-white/10 pt-6">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="font-display text-[28px] font-extrabold leading-none tracking-tight text-white tabular-nums">
                <CountUp value={s.value} />
                {s.suffix}
              </div>
              <div className="mt-1.5 text-[12.5px] font-medium text-white/50">{s.label}</div>
            </div>
          ))}
          <div className="ml-auto pb-0.5 text-[12.5px] text-white/45">{freeSignup}</div>
        </div>
      </div>
    </aside>
  );
}
