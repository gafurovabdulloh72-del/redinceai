import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import Link from "next/link";
import { BadgeCheck, ExternalLink, Plus, Radio, RadioTower, Search, UsersRound } from "lucide-react";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CoverImage } from "@/components/specialists/CoverImage";
import { GroupCard } from "@/components/groups/GroupCard";
import { OfficialCover } from "@/components/groups/OfficialCover";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { categoryCounts, listGroups, myGroupsCount, upcomingEvents, type GroupListItem, type PostView } from "@/lib/groups/service";
import { groupListQuerySchema } from "@/lib/groups/validators";
import { cn, compactCount, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return {
    title: "Jamoalar — kanallar va guruhlar",
    description: "Ijodkorlar hamjamiyati: rasmiy kanal, yo'nalish va hudud bo'yicha kanallar va guruhlar, lenta, chat, jonli efirlar.",
    alternates: { canonical: "/jamoalar" },
    other: { "m-title": tr(til, { uz: "Jamoalar", ru: "Сообщества" }) },
  };
}

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

const CHIP = "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition";
const SORTS = [
  { key: "active", label: "Faol" },
  { key: "new", label: "Yangi" },
  { key: "members", label: "Ko'p a'zoli" },
] as const;
const chip = (active: boolean) => cn(CHIP, active ? "border-transparent bg-ink text-ink-fg" : "border-line-2 text-fg-2 hover:border-fg hover:text-fg");

/**
 * Jamoalar katalogi: tepada rasmiy kanal(lar) — qadalgan; keyin kanallar va guruhlar alohida bo'limlarda.
 * Qidiruv, yo'nalish (soni bilan), hudud, tur, tartib va "mening jamoalarim".
 */
export default async function GroupsPage({ searchParams }: { searchParams: Promise<Raw> }) {
  const parsed = groupListQuerySchema.safeParse(flat(await searchParams));
  const f = parsed.success ? parsed.data : groupListQuerySchema.parse({});
  const user = await getCurrentUser();
  const viewer = user ? { id: user.id, role: user.role } : null;
  const mine = f.mine === "1" && Boolean(user);
  const kind = f.kind || undefined;
  const hasFilters = Boolean(f.q || f.category || f.region);

  const [official, items, mineCount, counts] = await Promise.all([
    // Rasmiy kanal doim tepada (faqat "guruhlar" filtri tanlanganda yashirinadi); a'zolik filtriga bog'liq emas
    kind === "group" ? Promise.resolve([] as GroupListItem[]) : listGroups({ official: true, limit: 3 }, viewer),
    listGroups({ q: f.q, category: f.category, region: f.region, mine, kind, official: false, limit: f.limit, sort: f.sort }, viewer),
    user ? myGroupsCount(user.id) : Promise.resolve(0),
    categoryCounts(),
  ]);
  const nextEvents = await Promise.all(official.map((g) => upcomingEvents(g.id, viewer, 1).then((e) => e[0] ?? null)));
  const channels = items.filter((g) => g.kind === "channel");
  const teams = items.filter((g) => g.kind === "group");
  const more = items.length >= f.limit && f.limit < 60;

  const base = { q: f.q || undefined, category: f.category || undefined, region: f.region || undefined, mine: mine ? "1" : undefined, kind: kind || undefined, sort: f.sort !== "active" ? f.sort : undefined };
  const createHref = "/jamoalar/yangi";

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
        description="Kanallar va guruhlar: tajriba almashing, savol bering, efirlarga qo'shiling."
        action={
          <ButtonLink href={createHref} variant="accent" size="md" className="icon-spin-hover">
            <Plus size={18} /> Yangi jamoa
          </ButtonLink>
        }
      />

      {/* Rasmiy kanal — qadalgan banner */}
      {official.length > 0 && (
        <section className="mt-6 grid gap-3 sm:mt-8" aria-label="Rasmiy kanal">
          {official.map((g, i) => (
            <OfficialBanner key={g.id} g={g} next={nextEvents[i]} />
          ))}
        </section>
      )}

      {/* Qidiruv + hudud (GET forma — JS'siz ishlaydi) */}
      <form action="/jamoalar" method="get" className={cn("card flex flex-col gap-2 p-3 max-sm:!border-0 max-sm:!bg-transparent max-sm:!p-0 max-sm:!shadow-none sm:flex-row sm:items-center sm:gap-3", official.length ? "mt-5 sm:mt-6" : "mt-6 sm:mt-8")}>
        {mine && <input type="hidden" name="mine" value="1" />}
        {f.category && <input type="hidden" name="category" value={f.category} />}
        {kind && <input type="hidden" name="kind" value={kind} />}
        {f.sort !== "active" && <input type="hidden" name="sort" value={f.sort} />}
        <label className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
          <input name="q" defaultValue={f.q} maxLength={80} placeholder="Kanal yoki guruh nomi…" aria-label="Qidirish" className="field h-11 w-full pl-10 text-[14px]" />
        </label>
        <select name="region" defaultValue={f.region} aria-label="Hudud" className="field h-11 text-[14px] sm:w-56">
          <option value="">Butun O&apos;zbekiston</option>
          {REGIONS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-ink inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-semibold max-sm:hidden">
          Qidirish
        </button>
      </form>

      {/* Tur + "mening jamoalarim" + yo'nalish chiplari (soni bilan) + tartib */}
      <div className="no-scrollbar -mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 max-sm:[&>*]:shrink-0 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <nav className="inline-flex rounded-full border border-line p-0.5 text-[13px] font-semibold" aria-label="Turi">
          {(
            [
              { key: undefined, label: "Hammasi" },
              { key: "channel", label: "Kanallar" },
              { key: "group", label: "Guruhlar" },
            ] as const
          ).map((o) => (
            <Link key={o.label} href={href({ ...base, kind: o.key })} aria-current={kind === o.key ? "true" : undefined} className={cn("inline-flex h-9 items-center rounded-full px-3.5 transition", kind === o.key ? "btn-ink" : "text-fg-2 hover:text-fg")}>
              {o.label}
            </Link>
          ))}
        </nav>
        {user && (
          <Link href={href({ ...base, mine: mine ? undefined : "1" })} className={chip(mine)} aria-current={mine ? "true" : undefined}>
            <UsersRound size={14} /> Mening jamoalarim <span className={mine ? "opacity-70" : "text-fg-4"}>{mineCount}</span>
          </Link>
        )}
        {f.category && (
          <Link href={href({ ...base, category: undefined })} className={chip(false)}>
            Barcha yo&apos;nalishlar
          </Link>
        )}
        {CATEGORIES.map((c) => {
          const active = f.category === c.slug;
          const n = counts[c.slug] ?? 0;
          if (!n && !active) return null;
          return (
            <Link key={c.slug} href={href({ ...base, category: active ? undefined : c.slug })} className={chip(active)} aria-current={active ? "true" : undefined}>
              <CategoryIcon icon={c.icon} size={14} /> {c.plural} <span className={active ? "opacity-70" : "text-fg-4"}>{n}</span>
            </Link>
          );
        })}
        {/* Tartib — segment (rasmiy kanal baribir tepada) */}
        <div className="ml-auto inline-flex rounded-full border border-line p-0.5 text-[12.5px] font-semibold" role="group" aria-label="Tartib">
          {SORTS.map((o) => (
            <Link key={o.key} href={href({ ...base, sort: o.key === "active" ? undefined : o.key })} aria-current={f.sort === o.key ? "true" : undefined} className={cn("inline-flex h-8 items-center rounded-full px-3 transition", f.sort === o.key ? "bg-fg/8 text-fg" : "text-fg-3 hover:text-fg")}>
              {o.label}
            </Link>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <section className="mt-6">
          <EmptyState
            icon={UsersRound}
            title={mine ? "Hali hech qaysi jamoaga qo'shilmagansiz" : hasFilters || kind ? "Bunday jamoa topilmadi" : "Hali jamoalar yo'q"}
            description={mine ? "Katalogdan toping yoki yangisini oching." : hasFilters || kind ? "Filtrlarni o'zgartiring yoki birinchisini o'zingiz oching." : "Birinchi jamoani siz oching."}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {(mine || hasFilters || kind) && (
                  <ButtonLink href="/jamoalar" variant="outline" size="md">
                    Barcha jamoalar
                  </ButtonLink>
                )}
                <ButtonLink href={createHref} variant="accent" size="md">
                  <Plus size={16} /> Yangi jamoa
                </ButtonLink>
              </div>
            }
          />
        </section>
      ) : (
        <>
          {channels.length > 0 && <GroupSection icon={Radio} title="Kanallar" hint="Egasi yozadi, siz o'qiysiz va izoh qoldirasiz" items={channels} />}
          {teams.length > 0 && <GroupSection icon={UsersRound} title="Guruhlar" hint="Hamma yozadi va suhbatlashadi" items={teams} />}
          {more && (
            <div className="mt-6 flex justify-center">
              <ButtonLink href={href({ ...base, limit: "60" })} variant="outline" size="md">
                Yana ko&apos;rsatish
              </ButtonLink>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GroupSection({ icon: Icon, title, hint, items }: { icon: typeof Radio; title: string; hint: string; items: GroupListItem[] }) {
  return (
    <section className="mt-8" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 font-display text-[20px] font-semibold text-fg">
          <Icon size={18} className="text-fg-3" /> {title} <span className="text-[14px] font-semibold text-fg-3">{items.length}</span>
        </h2>
        <p className="text-[13px] text-fg-3">{hint}</p>
      </div>
      <ul className="stagger grid gap-4 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line sm:grid-cols-2 lg:grid-cols-3">
        {items.map((g) => (
          <li key={g.id} className="min-w-0">
            <GroupCard g={g} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Rasmiy kanal banneri — Telegram'dagi qadalgan kanal kabi: har doim tepada, keyingi efir; v3 tinch (ring/chip yo'q) */
function OfficialBanner({ g, next }: { g: GroupListItem; next: PostView | null }) {
  const live = next?.eventAt ? Date.now() >= next.eventAt && Date.now() < next.eventAt + 2 * 60 * 60 * 1000 : false;
  return (
    <article className="card m-plain relative overflow-hidden">
      <div className="grid grid-cols-[88px_minmax(0,1fr)] sm:grid-cols-[minmax(0,280px)_1fr]">
        <Link href={`/jamoalar/${g.slug}`} className="relative overflow-hidden bg-surface-3 sm:min-h-[150px]" aria-label={g.name}>
          {g.coverUrl ? <CoverImage src={g.coverUrl} category={g.category ?? undefined} seed={g.slug} priority /> : <OfficialCover name={g.name} compact />}
        </Link>
        <div className="flex min-w-0 flex-col gap-3 p-3.5 sm:p-5">
          <div className="min-w-0">
            <Link href={`/jamoalar/${g.slug}`} className="inline-flex items-center gap-2 font-display text-[17px] font-semibold leading-tight text-fg hover:text-accent sm:text-[24px]">
              {g.name} <BadgeCheck size={18} className="shrink-0 text-accent" aria-label="Rasmiy kanal" />
            </Link>
            <p className="mt-1 text-[12.5px] text-fg-3">Rasmiy kanal · {compactCount(g.membersCount)} a&apos;zo</p>
            {g.description && <p className="mt-1.5 line-clamp-2 text-[13.5px] max-sm:hidden leading-relaxed text-fg-2">{g.description}</p>}
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            {next?.eventAt && (
              <span className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold", live ? "bg-accent text-white" : "bg-fg/6 text-fg-2")}>
                {live ? <span className="live-dot h-2 w-2 rounded-full bg-white" aria-hidden /> : <RadioTower size={14} />} {live ? "Hozir jonli efirda" : `Keyingi efir: ${formatDateTime(next.eventAt)}`}
              </span>
            )}
            {next?.eventUrl && live && (
              <a href={next.eventUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[12.5px] font-semibold text-fg">
                Qo&apos;shilish <ExternalLink size={13} />
              </a>
            )}
            <ButtonLink href={`/jamoalar/${g.slug}`} variant="primary" size="sm" className="ml-auto">
              Ochish
            </ButtonLink>
          </div>
        </div>
      </div>
    </article>
  );
}
