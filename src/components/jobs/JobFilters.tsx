"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { REGIONS } from "@/lib/constants";
import { tr } from "@/lib/i18n";
import { ISHLAR } from "@/lib/i18n/dict/jobs";
import { REMOTE_REGION } from "@/lib/jobs/format";

export interface JobFilterValues {
  q?: string;
  category?: string;
  region?: string;
  min?: number;
  max?: number;
  sort: "newest" | "budget_high" | "budget_low";
}

const SORTS: JobFilterValues["sort"][] = ["newest", "budget_high", "budget_low"];

/** Faqat raqamlar ("1 500 000" → "1500000") */
const digits = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.replace(/\D/g, "") : "");

/**
 * /ishlar filtrlari: qidiruv, hudud (shu jumladan «Masofaviy»), byudjet oralig'i va saralash.
 * Yo'nalish chiplari sahifada havola sifatida; bu forma JS'siz ham oddiy GET bilan yuboriladi.
 * Mobil (2 ustun): qidiruv · hudud | saralash · dan | gacha · tugma. Desktop: bitta qator.
 */
export function JobFilters({ values, basePath = "/ishlar" }: { values: JobFilterValues; basePath?: string }) {
  const til = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  // Telefonda hudud/saralash/byudjet maydonlari yig'ilgan — filtr qo'yilgan bo'lsa ochiq turadi
  const hasExtra = Boolean(values.region || values.min || values.max || (values.sort && values.sort !== "newest"));
  const [more, setMore] = useState(hasExtra);
  const extra = cn("min-w-0", !more && "max-sm:hidden");

  const go = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const sp = new URLSearchParams();
    const q = String(fd.get("q") ?? "").trim();
    if (q) sp.set("q", q.slice(0, 80));
    if (values.category) sp.set("category", values.category);
    const region = String(fd.get("region") ?? "");
    if (region) sp.set("region", region);
    const min = digits(fd.get("min"));
    const max = digits(fd.get("max"));
    if (min && Number(min) > 0) sp.set("min", min);
    if (max && Number(max) > 0) sp.set("max", max);
    const sort = String(fd.get("sort") ?? "newest");
    if (sort !== "newest") sp.set("sort", sort);
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false }));
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    go(e.currentTarget);
  };
  const submitNow = () => {
    if (formRef.current) go(formRef.current);
  };

  return (
    <form
      ref={formRef}
      method="get"
      action={basePath}
      onSubmit={onSubmit}
      role="search"
      aria-label={tr(til, ISHLAR.f.formAria)}
      aria-busy={pending}
      className="card grid min-w-0 grid-cols-2 gap-2.5 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_190px_120px_120px_175px_auto]"
    >
      {values.category && <input type="hidden" name="category" value={values.category} />}

      <div className="relative col-span-2 min-w-0 lg:order-1 lg:col-span-1">
        <label htmlFor="job-q" className="sr-only">
          {tr(til, ISHLAR.f.search)}
        </label>
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
        <input
          id="job-q"
          name="q"
          type="search"
          defaultValue={values.q ?? ""}
          maxLength={80}
          placeholder={tr(til, ISHLAR.f.searchPlaceholder)}
          className="field h-11 pl-10"
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>

      <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className={cn("chip col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold sm:hidden", more ? "bg-fg text-bg" : "text-fg-2")}>
        <SlidersHorizontal size={14} aria-hidden /> {tr(til, more ? ISHLAR.f.less : hasExtra ? ISHLAR.f.moreActive : ISHLAR.f.more)}
      </button>

      <div className={cn(extra, "lg:order-2")}>
        <label htmlFor="job-region" className="sr-only">
          {tr(til, ISHLAR.f.region)}
        </label>
        <select id="job-region" name="region" defaultValue={values.region ?? ""} onChange={submitNow} className="field h-11 truncate">
          <option value="">{tr(til, ISHLAR.f.allRegions)}</option>
          <option value={REMOTE_REGION}>{tr(til, ISHLAR.f.remote)}</option>
          {REGIONS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className={cn(extra, "lg:order-5")}>
        <label htmlFor="job-sort" className="sr-only">
          {tr(til, ISHLAR.f.sort)}
        </label>
        <select id="job-sort" name="sort" defaultValue={values.sort} onChange={submitNow} className="field h-11 truncate">
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {tr(til, ISHLAR.f.sorts[s])}
            </option>
          ))}
        </select>
      </div>

      <div className={cn(extra, "lg:order-3")}>
        <label htmlFor="job-min" className="sr-only">
          {tr(til, ISHLAR.f.minLabel)}
        </label>
        <input id="job-min" name="min" inputMode="numeric" defaultValue={values.min ? String(values.min) : ""} placeholder={tr(til, ISHLAR.f.minPlaceholder)} className="field h-11 px-3.5 text-[14px]" />
      </div>
      <div className={cn(extra, "lg:order-4")}>
        <label htmlFor="job-max" className="sr-only">
          {tr(til, ISHLAR.f.maxLabel)}
        </label>
        <input id="job-max" name="max" inputMode="numeric" defaultValue={values.max ? String(values.max) : ""} placeholder={tr(til, ISHLAR.f.maxPlaceholder)} className="field h-11 px-3.5 text-[14px]" />
      </div>

      <button type="submit" className="btn-ink col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold lg:order-6 lg:col-span-1">
        {pending ? <Spinner /> : <Search size={16} aria-hidden="true" />}
        {tr(til, ISHLAR.f.submit)}
      </button>
    </form>
  );
}
