"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, MapPin, Users } from "lucide-react";
import { UzbekistanMap } from "./UzbekistanMap";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CATEGORIES, REGIONS, REGION_BY_SLUG } from "@/lib/constants";
import type { RegionStat } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function HomeMapSection({ stats, total }: { stats: Record<string, RegionStat>; total: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  const region = selected ? REGION_BY_SLUG[selected] : null;
  const stat = selected ? stats[selected] : null;

  const topRegions = [...REGIONS].sort((a, b) => (stats[b.slug]?.total ?? 0) - (stats[a.slug]?.total ?? 0)).slice(0, 5);

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Xarita paneli */}
      <div className="glass p-3 sm:p-5 lg:col-span-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-fg-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-tint opacity-70 animate-pulse-ring" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-tint" />
            </span>
            Jonli: {total} ta mutaxassis, 14 hudud
          </div>
          <div className="segment">
            {["Barchasi", "Tanlangan"].map((l, i) => (
              <button key={l} type="button" className="segment-item" data-active={i === 0 ? !selected : !!selected} onClick={() => i === 0 && setSelected(null)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <UzbekistanMap stats={stats} selected={selected} onSelect={setSelected} />
      </div>

      {/* Yon panel */}
      <div className="flex flex-col gap-4 lg:col-span-4">
        <div className={cn("glass-strong flex-1 p-5 transition-all duration-500", selected && "ring-2 ring-tint/40")}>
          {region && stat ? (
            <div className="animate-fade-up" key={region.slug} style={{ animationDuration: "0.35s" }}>
              <div className="flex items-start gap-3">
                <span className="glass-tint flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
                  <MapPin size={20} />
                </span>
                <div>
                  <h3 className="text-[20px] font-bold leading-tight text-fg">{region.name}</h3>
                  <p className="text-[13px] text-fg-3">Markaz: {region.capital}</p>
                </div>
              </div>

              <div className="mt-5 flex items-end gap-2">
                <span className="text-[44px] font-bold leading-none tracking-tight text-fg">{stat.total}</span>
                <span className="pb-1.5 text-[14px] text-fg-2">ta mutaxassis</span>
              </div>

              <ul className="mt-4 space-y-2">
                {CATEGORIES.filter((c) => stat.byCategory[c.slug]).map((c) => {
                  const n = stat.byCategory[c.slug];
                  const pct = Math.round((n / stat.total) * 100);
                  return (
                    <li key={c.slug}>
                      <Link
                        href={`/mutaxassislar?region=${region.slug}&category=${c.slug}`}
                        className="group flex items-center gap-3 rounded-[14px] px-2 py-1.5 transition hover:bg-fg/5"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ background: `${c.accent}22`, color: c.accent }}>
                          <CategoryIcon icon={c.icon} size={14} />
                        </span>
                        <span className="flex-1">
                          <span className="flex justify-between text-[13px]">
                            <span className="font-medium text-fg">{c.plural}</span>
                            <span className="text-fg-3">{n}</span>
                          </span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-fg/8">
                            <span className="block h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c.accent }} />
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
                {stat.total === 0 && <li className="text-[14px] text-fg-3">Bu hududda hali mutaxassislar yo'q — birinchi bo'ling!</li>}
              </ul>

              <Link
                href={`/mutaxassislar?region=${region.slug}`}
                className="glass-tint mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold"
              >
                Barchasini ko'rish <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex items-start gap-3">
                <span className="glass-tint flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
                  <Users size={20} />
                </span>
                <div>
                  <h3 className="text-[20px] font-bold leading-tight text-fg">Hududni tanlang</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-fg-2">Xaritadagi istalgan viloyatni bosing — o'sha yerdagi mutaxassislar va yo'nalishlar chiqadi.</p>
                </div>
              </div>

              <p className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-wide text-fg-3">Eng faol hududlar</p>
              <ul className="space-y-1">
                {topRegions.map((r, i) => (
                  <li key={r.slug}>
                    <button
                      type="button"
                      onClick={() => setSelected(r.slug)}
                      className="flex w-full items-center gap-3 rounded-[14px] px-2 py-2 text-left transition hover:bg-fg/5"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-tint-soft text-[12px] font-bold text-tint">{i + 1}</span>
                      <span className="flex-1 text-[14px] font-medium text-fg">{r.name}</span>
                      <span className="text-[13px] font-semibold text-fg-2">{stats[r.slug]?.total ?? 0}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <Link href="/xarita" className="glass glass-hover flex items-center justify-between px-5 py-4">
          <span>
            <span className="block text-[15px] font-semibold text-fg">To'liq xarita rejimi</span>
            <span className="block text-[13px] text-fg-3">Filtrlar bilan batafsil qidiruv</span>
          </span>
          <ArrowRight size={18} className="text-tint" />
        </Link>
      </div>
    </div>
  );
}
