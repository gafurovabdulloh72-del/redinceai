import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, UsersRound } from "lucide-react";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { GroupCard } from "@/components/groups/GroupCard";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { listGroups, myGroupsCount } from "@/lib/groups/service";
import { groupListQuerySchema } from "@/lib/groups/validators";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jamoalar — ijodkorlar hamjamiyati",
  description: "Videograf, montajchi va dizaynerlar jamoalari: yo'nalish va hudud bo'yicha guruhlar, lenta, chat. Tajriba almashing, savol bering, birga loyiha qiling.",
  alternates: { canonical: "/jamoalar" },
};

type Raw = Record<string, string | string[] | undefined>;

function flat(raw: Raw): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (typeof s === "string" && s !== "") out[k] = s;
  }
  return out;
}

function href(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const q = sp.toString();
  return q ? `/jamoalar?${q}` : "/jamoalar";
}

/** Jamoalar katalogi: qidiruv, yo'nalish chiplari, hudud, "mening jamoalarim" */
export default async function GroupsPage({ searchParams }: { searchParams: Promise<Raw> }) {
  const parsed = groupListQuerySchema.safeParse(flat(await searchParams));
  const f = parsed.success ? parsed.data : groupListQuerySchema.parse({});
  const user = await getCurrentUser();
  const viewer = user ? { id: user.id, role: user.role } : null;
  const mine = f.mine === "1" && Boolean(user);
  const [items, mineCount] = await Promise.all([
    listGroups({ q: f.q, category: f.category, region: f.region, mine, limit: f.limit }, viewer),
    user ? myGroupsCount(user.id) : Promise.resolve(0),
  ]);
  const base = { q: f.q || undefined, category: f.category || undefined, region: f.region || undefined, mine: mine ? "1" : undefined };
  const hasFilters = Boolean(f.q || f.category || f.region);

  return (
    <div className="container-x animate-fade-up">
      <PageHeader
        size="lg"
        eyebrow="Hamjamiyat"
        title={
          <>
            Ijodkorlar <span className="accent-serif text-accent">jamoalari</span>
          </>
        }
        description="Yo'nalish va hudud bo'yicha guruhlar: tajriba almashing, savol bering, birga loyiha qiling. Lenta, chat va a'zolar — bir joyda."
        action={
          <ButtonLink href="/jamoalar/yangi" variant="accent" size="lg">
            <Plus size={18} /> Jamoa ochish
          </ButtonLink>
        }
      />

      {/* Qidiruv + hudud (GET forma — JS'siz ishlaydi) */}
      <form action="/jamoalar" method="get" className="card mt-8 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        {mine && <input type="hidden" name="mine" value="1" />}
        {f.category && <input type="hidden" name="category" value={f.category} />}
        <label className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
          <input name="q" defaultValue={f.q} maxLength={80} placeholder="Jamoa nomi yoki tavsifi bo'yicha qidirish…" aria-label="Qidirish" className="field h-11 w-full pl-10 text-[14px]" />
        </label>
        <select name="region" defaultValue={f.region} aria-label="Hudud" className="field h-11 text-[14px] sm:w-56">
          <option value="">Butun O&apos;zbekiston</option>
          {REGIONS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-ink inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-semibold">
          Qidirish
        </button>
      </form>

      {/* Yo'nalish chiplari + "Mening jamoalarim" */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {user && (
          <div className="mr-2 inline-flex rounded-full border border-line p-0.5 text-[13px] font-semibold" role="tablist" aria-label="Ko'rinish">
            <Link href={href({ ...base, mine: undefined })} role="tab" aria-selected={!mine} className={cn("inline-flex h-9 items-center rounded-full px-3.5 transition", !mine ? "btn-ink" : "text-fg-2 hover:text-fg")}>
              Hammasi
            </Link>
            <Link href={href({ ...base, mine: "1" })} role="tab" aria-selected={mine} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 transition", mine ? "btn-ink" : "text-fg-2 hover:text-fg")}>
              Mening jamoalarim <span className={mine ? "opacity-70" : "text-fg-4"}>{mineCount}</span>
            </Link>
          </div>
        )}
        <Link
          href={href({ ...base, category: undefined })}
          className={cn("inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold transition", !f.category ? "border-transparent bg-ink text-ink-fg" : "border-line-2 text-fg-2 hover:border-fg hover:text-fg")}
        >
          Barchasi
        </Link>
        {CATEGORIES.map((c) => {
          const active = f.category === c.slug;
          return (
            <Link
              key={c.slug}
              href={href({ ...base, category: active ? undefined : c.slug })}
              className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition", active ? "border-transparent bg-ink text-ink-fg" : "border-line-2 text-fg-2 hover:border-fg hover:text-fg")}
            >
              <CategoryIcon icon={c.icon} size={14} /> {c.plural}
            </Link>
          );
        })}
      </div>

      <section className="mt-6" aria-live="polite">
        {items.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title={mine ? "Siz hali hech qaysi jamoaga qo'shilmagansiz" : hasFilters ? "Bunday jamoa topilmadi" : "Hali jamoalar yo'q"}
            description={
              mine
                ? "Katalogdan o'zingizga mos jamoani toping yoki yangisini oching — do'stlaringizni taklif qiling."
                : hasFilters
                  ? "Filtrlarni o'zgartiring yoki shu mavzuda birinchi jamoani o'zingiz oching."
                  : "Birinchi jamoani siz oching: hududingiz montajchilari, dizaynerlar klubi yoki texnika almashish guruhi."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {(mine || hasFilters) && (
                  <ButtonLink href="/jamoalar" variant="outline" size="md">
                    Barcha jamoalar
                  </ButtonLink>
                )}
                <ButtonLink href="/jamoalar/yangi" variant="accent" size="md">
                  <Plus size={16} /> Jamoa ochish
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <>
            <p className="mb-3 text-[13px] text-fg-3">
              {items.length} ta jamoa{hasFilters ? " (filtr bo'yicha)" : ""}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((g) => (
                <li key={g.id} className="min-w-0">
                  <GroupCard g={g} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
