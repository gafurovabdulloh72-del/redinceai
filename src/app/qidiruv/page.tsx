import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Compass } from "lucide-react";
import { Avatar, EmptyState, PageHeader, Stars, VerifiedBadge } from "@/components/ui";
import { MediaTile } from "@/components/profile/MediaTile";
import { ExploreForm } from "@/components/search/ExploreForm";
import { Highlight } from "@/components/search/Highlight";
import { ResultsKeyNav } from "@/components/search/ResultsKeyNav";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { tr } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { timeAgoLabel } from "@/lib/i18n/dict/catalog";
import { PALET, QIDIRUV } from "@/lib/i18n/dict/search";
import { getSkillStats } from "@/lib/queries";
import { exploreSearch, EXPLORE_TYPES, type ExploreType } from "@/lib/search/service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Qidiruv — videolar, ishlar, postlar, ijodkorlar",
  description: "Ommaviy qidiruv: ish nomi, post matni yoki ijodkor ismi bo'yicha. Barcha ochiq kontent bir joyda.",
  alternates: { canonical: "/qidiruv" },
};

function href(q: string, type: ExploreType) {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (type !== "all") sp.set("type", type);
  const s = sp.toString();
  return s ? `/qidiruv?${s}` : "/qidiruv";
}

/** Faqat so'rov bilan ma'noli turlar — so'rovsiz "So'z kiriting" holati */
const NEEDS_QUERY: ReadonlyArray<ExploreType> = ["people", "groups", "vacancies"];

/**
 * Ommaviy qidiruv zonasi (Explore): ish nomi/tavsifi/teglari, post matnlari, ijodkor nomlari, jamoalar va vakansiyalar.
 * So'rovsiz — eng yangi videolar va postlar plitkasi. Yozish bilan qidiradi (ExploreForm), «/» va ↑/↓ klaviaturasi (ResultsKeyNav),
 * mos matn ajratib ko'rsatiladi (Highlight). Har bir plitka manbaga olib boradi (profil ?post=/?ish=, jamoa ?post=).
 */
export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const typeRaw = typeof sp.type === "string" ? sp.type : "all";
  const type: ExploreType = (EXPLORE_TYPES as readonly string[]).includes(typeRaw) ? (typeRaw as ExploreType) : "all";
  const [til, r, skills] = await Promise.all([getLocale(), exploreSearch(q, type), getSkillStats(8).catch(() => [])]);
  const nothing = r.people.length === 0 && r.media.length === 0 && r.sections.length === 0;
  const needQuery = !q && NEEDS_QUERY.includes(type);
  const resultTile = "group block rounded-[var(--r-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="container-x animate-fade-up">
      <ResultsKeyNav />
      <PageHeader
        size="lg"
        eyebrow={tr(til, QIDIRUV.eyebrow)}
        title={
          <>
            {tr(til, QIDIRUV.titleStart)} <span className="accent-serif text-accent">{tr(til, QIDIRUV.titleAccent)}</span>
          </>
        }
        description={tr(til, QIDIRUV.description)}
      />

      <ExploreForm q={q} type={type} popular={skills.map((s) => s.skill)} />

      {/* Tur chiplari */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={tr(til, QIDIRUV.typeAria)}>
        {EXPLORE_TYPES.map((k) => (
          <Link key={k} href={href(q, k)} aria-current={type === k ? "true" : undefined} className={cn("press inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold transition", type === k ? "btn-ink border-transparent" : "border-line text-fg-2 hover:border-fg hover:text-fg")}>
            {tr(til, QIDIRUV.types[k])}
          </Link>
        ))}
      </div>
      <p className="mt-2 hidden text-[11.5px] text-fg-4 sm:block">{tr(til, QIDIRUV.keyHint)}</p>

      {/* Ijodkorlar */}
      {r.people.length > 0 && (
        <section className="mt-8" aria-labelledby="people-h">
          <h2 id="people-h" className="font-display text-[20px] font-semibold text-fg">
            {tr(til, QIDIRUV.people)} <span className="text-[14px] font-semibold text-fg-3">{QIDIRUV.countShort[til](r.people.length)}</span>
          </h2>
          <ul className="stagger mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={tr(til, QIDIRUV.resultsAria)}>
            {r.people.map((p) => (
              <li key={p.slug}>
                <Link href={`/mutaxassislar/${p.slug}`} data-result className="card hover-lift press flex items-center gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <Avatar name={p.name} src={p.avatarUrl} size={48} decorative />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-[14px] font-semibold text-fg">
                      <Highlight text={p.name} q={q} /> {p.isVerified && <VerifiedBadge size={14} />}
                    </span>
                    <span className="block truncate text-[12.5px] text-fg-3">
                      <Highlight text={p.title} q={q} /> · {CATEGORY_BY_SLUG[p.category]?.name ?? p.category}
                    </span>
                    {p.reviewCount > 0 && <Stars value={p.rating} size={12} count={p.reviewCount} />}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Media plitkalari: videolar, ishlar, postlar */}
      {r.media.length > 0 && (
        <section className="mt-8" aria-labelledby="media-h">
          <h2 id="media-h" className="font-display text-[20px] font-semibold text-fg">
            {q ? (
              <>
                {tr(til, QIDIRUV.found)} <span className="text-[14px] font-semibold text-fg-3">{QIDIRUV.countShort[til](r.media.length)}</span>
              </>
            ) : (
              tr(til, QIDIRUV.fresh)
            )}
          </h2>
          <ul className="stagger mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={tr(til, QIDIRUV.resultsAria)}>
            {r.media.map((m) => (
              <li key={`${m.kind}-${m.id}`} className="min-w-0">
                <Link href={m.href} data-result className={cn(resultTile, "hover-lift")}>
                  <MediaTile til={til} d={{ thumbUrl: m.thumbUrl, videoUrl: m.videoUrl, isVideo: m.isVideo, textOnly: m.textOnly, count: m.count, caption: m.caption, likes: m.kind === "post" ? m.likes : undefined, comments: m.kind === "post" ? m.comments : undefined }} />
                  <span className="mt-2 block px-0.5">
                    {m.caption && !m.textOnly && (
                      <span className="line-clamp-2 text-[13px] leading-snug text-fg">
                        <Highlight text={m.caption} q={q} />
                      </span>
                    )}
                    <span className="mt-1 flex items-center gap-1.5 text-[12px] text-fg-3">
                      <Avatar name={m.author.name} src={m.author.avatarUrl} size={18} decorative />
                      <span className="truncate font-medium text-fg-2">{m.author.name}</span>
                      <span aria-hidden>·</span>
                      <span className="shrink-0">{tr(til, QIDIRUV.kind[m.kind])}</span>
                      <span className="ml-auto shrink-0" suppressHydrationWarning>
                        {timeAgoLabel(til, m.createdAt)}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Jamoalar, vakansiyalar, ishlar, yordam */}
      {r.sections.map((s) => (
        <section key={s.key} className="mt-8" aria-labelledby={`sec-${s.key}`}>
          <h2 id={`sec-${s.key}`} className="font-display text-[18px] font-semibold text-fg">
            {PALET.sections[s.key] ? tr(til, PALET.sections[s.key]) : s.label}
          </h2>
          <ul className="stagger mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label={tr(til, QIDIRUV.resultsAria)}>
            {s.items.map((it) => (
              <li key={it.href}>
                <Link href={it.href} data-result className="card hover-lift press icon-nudge flex items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-fg">
                      <Highlight text={it.title} q={q} />
                    </span>
                    {it.sub && (
                      <span className="block truncate text-[12.5px] text-fg-3">
                        <Highlight text={it.sub} q={q} />
                      </span>
                    )}
                  </span>
                  <ArrowUpRight size={16} className="shrink-0 text-fg-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {nothing && (
        <section className="mt-8">
          {needQuery ? (
            <EmptyState icon={Compass} title={tr(til, QIDIRUV.needQueryTitle)} description={tr(til, QIDIRUV.needQueryDesc)} />
          ) : q ? (
            <EmptyState icon={Compass} title={QIDIRUV.emptyTitle[til](q)} description={tr(til, QIDIRUV.emptyDesc)} />
          ) : (
            <EmptyState icon={Compass} title={tr(til, QIDIRUV.nothingYetTitle)} description={tr(til, QIDIRUV.nothingYetDesc)} />
          )}
        </section>
      )}
    </div>
  );
}
