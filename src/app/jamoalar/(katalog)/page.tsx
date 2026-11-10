import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import Link from "next/link";
import { BadgeCheck, Plus, Radio, Search, UsersRound } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { GroupCard } from "@/components/groups/GroupCard";
import { OfficialCover } from "@/components/groups/OfficialCover";
import { getCurrentUser } from "@/lib/auth";
import { listGroups, myGroupsCount, upcomingEvents, type GroupListItem, type PostView } from "@/lib/groups/service";
import { groupListQuerySchema } from "@/lib/groups/validators";
import { cn, compactCount, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return {
    title: "Jamoalar — kanallar va guruhlar",
    description: "Ijodkorlar hamjamiyati: rasmiy kanal, kanallar va guruhlar, lenta, chat, jonli efirlar.",
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

/**
 * Jamoalar katalogi (2026-11-01 soddalashtirildi, mentorlik kabi).
 * Bitta aniq tartib: sarlavha → qidiruv (bitta maydon) + «Yangi jamoa» → rasmiy kanal (ixcham qator)
 * → tur tablari (Hammasi · Kanallar · Guruhlar · Meniki) → ro'yxat.
 * OLDIN sahifada 7 xil boshqaruv bor edi (hudud menyusi, «Qidirish» tugmasi, kasb chiplari, tartib
 * segmenti, katta banner) — hammasi 4 ta jamoa uchun. Hudud/kasb/tartib query-param sifatida
 * ISHLAYVERADI (server filtrlari o'chirilmagan), faqat UI'dan olib tashlandi.
 */
export default async function GroupsPage({ searchParams }: { searchParams: Promise<Raw> }) {
  const parsed = groupListQuerySchema.safeParse(flat(await searchParams));
  const f = parsed.success ? parsed.data : groupListQuerySchema.parse({});
  const user = await getCurrentUser();
  const viewer = user ? { id: user.id, role: user.role } : null;
  const mine = f.mine === "1" && Boolean(user);
  const kind = f.kind || undefined;
  const hasFilters = Boolean(f.q || f.category || f.region);

  const [official, items, mineCount] = await Promise.all([
    // Rasmiy kanal doim tepada (faqat "guruhlar" filtri tanlanganda yashirinadi); a'zolik filtriga bog'liq emas
    kind === "group" ? Promise.resolve([] as GroupListItem[]) : listGroups({ official: true, limit: 3 }, viewer),
    listGroups({ q: f.q, category: f.category, region: f.region, mine, kind, official: false, limit: f.limit, sort: f.sort }, viewer),
    user ? myGroupsCount(user.id) : Promise.resolve(0),
  ]);
  const nextEvents = await Promise.all(official.map((g) => upcomingEvents(g.id, viewer, 1).then((e) => e[0] ?? null)));
  const channels = items.filter((g) => g.kind === "channel");
  const teams = items.filter((g) => g.kind === "group");
  const more = items.length >= f.limit && f.limit < 60;

  const base = { q: f.q || undefined, mine: mine ? "1" : undefined, kind: kind || undefined };

  return (
    <div className="container-x animate-fade-up py-4 sm:py-6">
      {/* Sarlavha — telefonda yuqori panel nomni ko'rsatadi */}
      <header className="mb-4 max-sm:hidden">
        <h1 className="display-xl text-fg">Jamoalar</h1>
        <p className="mt-1 text-[14px] text-fg-3">Kanallar va guruhlar: tajriba almashing, savol bering, efirlarga qo&apos;shiling.</p>
      </header>

      {/* Qidiruv (bitta maydon, Enter bilan) + «Yangi jamoa» — bitta qator */}
      <div className="flex items-center gap-2">
        <form action="/jamoalar" method="get" className="relative min-w-0 flex-1">
          {mine && <input type="hidden" name="mine" value="1" />}
          {kind && <input type="hidden" name="kind" value={kind} />}
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
          <input name="q" defaultValue={f.q} maxLength={80} placeholder="Kanal yoki guruh qidirish…" aria-label="Qidirish" className="field h-11 w-full !rounded-full pl-10 text-[14px]" />
        </form>
        <ButtonLink href="/jamoalar/yangi" variant="primary" size="md" className="shrink-0">
          <Plus size={16} /> <span className="max-sm:hidden">Yangi jamoa</span>
          <span className="sm:hidden">Yangi</span>
        </ButtonLink>
      </div>

      {/* Rasmiy kanal — ixcham qator (oldin katta banner edi) */}
      {official.length > 0 && (
        <section className="mt-4 grid gap-2" aria-label="Rasmiy kanal">
          {official.map((g, i) => (
            <OfficialRow key={g.id} g={g} next={nextEvents[i]} />
          ))}
        </section>
      )}

      {/* Tur tablari + «Meniki» */}
      <div className="no-scrollbar -mx-4 mt-4 flex items-center gap-1.5 overflow-x-auto px-4 max-sm:[&>*]:shrink-0 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {(
          [
            { key: undefined, label: "Hammasi" },
            { key: "channel", label: "Kanallar" },
            { key: "group", label: "Guruhlar" },
          ] as const
        ).map((o) => (
          <Link key={o.label} href={href({ ...base, kind: o.key })} className="chip text-[12.5px]" data-active={kind === o.key}>
            {o.label}
          </Link>
        ))}
        {user && (
          <Link href={href({ ...base, mine: mine ? undefined : "1" })} className="chip text-[12.5px]" data-active={mine}>
            Mening jamoalarim{mineCount ? ` · ${mineCount}` : ""}
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <section className="mt-6">
          <EmptyState
            icon={UsersRound}
            title={mine ? "Hali hech qaysi jamoaga qo'shilmagansiz" : hasFilters || kind ? "Bunday jamoa topilmadi" : "Hali jamoalar yo'q"}
            description={mine ? "Katalogdan toping yoki yangisini oching." : hasFilters || kind ? "Qidiruvni o'zgartiring yoki birinchisini o'zingiz oching." : "Birinchi jamoani siz oching."}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {(mine || hasFilters || kind) && (
                  <ButtonLink href="/jamoalar" variant="outline" size="md">
                    Barcha jamoalar
                  </ButtonLink>
                )}
                <ButtonLink href="/jamoalar/yangi" variant="accent" size="md">
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
    <section className="mt-6" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-fg">
          <Icon size={15} className="text-fg-3" /> {title} <span className="font-semibold text-fg-4">{items.length}</span>
        </h2>
        <p className="text-[12.5px] text-fg-3">{hint}</p>
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

/** Rasmiy kanal — ixcham qadalgan qator: belgi + nom + a'zo soni (+ jonli efir bo'lsa chip) */
function OfficialRow({ g, next }: { g: GroupListItem; next: PostView | null }) {
  const live = next?.eventAt ? Date.now() >= next.eventAt && Date.now() < next.eventAt + 2 * 60 * 60 * 1000 : false;
  return (
    <Link href={`/jamoalar/${g.slug}`} className="card m-plain flex items-center gap-3 p-3 transition hover:border-fg/25 max-sm:px-4">
      <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-ink">
        {g.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={g.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <OfficialCover name={g.name} compact />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[14.5px] font-bold text-fg">
          <span className="truncate">{g.name}</span>
          <BadgeCheck size={16} className="shrink-0 text-accent" aria-label="Rasmiy kanal" />
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-fg-3">
          Rasmiy kanal · {compactCount(g.membersCount)} a&apos;zo
          {next?.eventAt && !live ? ` · keyingi efir ${formatDateTime(next.eventAt)}` : ""}
        </span>
      </span>
      {live ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-white">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" aria-hidden /> Jonli
        </span>
      ) : (
        <span className={cn("shrink-0 rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-fg-2")}>Ochish</span>
      )}
    </Link>
  );
}
