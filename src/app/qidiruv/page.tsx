import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Compass, Search, Sparkles } from "lucide-react";
import { Avatar, EmptyState, PageHeader, Stars, VerifiedBadge } from "@/components/ui";
import { MediaTile } from "@/components/profile/MediaTile";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { exploreSearch, EXPLORE_TYPES, type ExploreType } from "@/lib/search/service";
import { cn, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Qidiruv — videolar, ishlar, postlar, ijodkorlar",
  description: "Ommaviy qidiruv: video ostidagi matn, ish nomi, post yoki ijodkor ismi bo'yicha. Barcha ochiq kontent bir joyda — Instagram uslubidagi plitkalar.",
  alternates: { canonical: "/qidiruv" },
};

const TYPE_LABEL: Record<ExploreType, string> = { all: "Hammasi", video: "Videolar", work: "Ishlar", post: "Postlar", people: "Ijodkorlar" };
const KIND_LABEL = { work: "Ish", post: "Post" } as const;

function href(q: string, type: ExploreType) {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (type !== "all") sp.set("type", type);
  const s = sp.toString();
  return s ? `/qidiruv?${s}` : "/qidiruv";
}

/**
 * Ommaviy qidiruv zonasi (Explore): video ostidagi matnlar (sarlavha/tavsif/teglar), post matnlari va ijodkor nomlari bo'yicha.
 * So'rovsiz — eng yangi videolar va postlar plitkasi. Har bir plitka manbaga olib boradi (profil ?post=, jamoa ?post=, portfolio).
 */
export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const typeRaw = typeof sp.type === "string" ? sp.type : "all";
  const type: ExploreType = (EXPLORE_TYPES as readonly string[]).includes(typeRaw) ? (typeRaw as ExploreType) : "all";
  const r = await exploreSearch(q, type);
  const nothing = r.people.length === 0 && r.media.length === 0 && r.sections.length === 0;

  return (
    <div className="container-x animate-fade-up">
      <PageHeader
        size="lg"
        eyebrow="Ommaviy qidiruv"
        title={
          <>
            Nimani <span className="accent-serif text-accent">qidiryapsiz?</span>
          </>
        }
        description="Video ostidagi matn, ish nomi, post yoki ijodkor ismi bo'yicha qidiring — barcha ochiq kontent bir joyda."
      />

      {/* Qidiruv formasi — GET, JS'siz ishlaydi */}
      <form action="/qidiruv" method="get" role="search" className="card mt-8 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        {type !== "all" && <input type="hidden" name="type" value={type} />}
        <label className="relative min-w-0 flex-1">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
          <input name="q" defaultValue={q} maxLength={80} autoFocus={!q} placeholder="Masalan: to'y montaj, logo animatsiya, Zarina…" aria-label="Qidiruv so'zi" className="field h-13 w-full pl-12 text-[15px]" />
        </label>
        <button type="submit" className="btn-ink inline-flex h-13 items-center justify-center rounded-full px-6 text-[15px] font-semibold">
          Qidirish
        </button>
      </form>

      {/* Tur chiplari */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Natija turi">
        {EXPLORE_TYPES.map((k) => (
          <Link key={k} href={href(q, k)} aria-current={type === k ? "true" : undefined} className={cn("inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold transition", type === k ? "border-transparent bg-ink text-ink-fg" : "border-line-2 text-fg-2 hover:border-fg hover:text-fg")}>
            {TYPE_LABEL[k]}
          </Link>
        ))}
      </div>

      {/* Ijodkorlar */}
      {r.people.length > 0 && (
        <section className="mt-8" aria-labelledby="people-h">
          <h2 id="people-h" className="font-display text-[20px] font-semibold text-fg">
            Ijodkorlar <span className="text-[14px] font-semibold text-fg-3">{r.people.length}</span>
          </h2>
          <ul className="stagger mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {r.people.map((p) => (
              <li key={p.slug}>
                <Link href={`/mutaxassislar/${p.slug}`} className="card card-hover flex items-center gap-3 p-3">
                  <Avatar name={p.name} src={p.avatarUrl} size={48} decorative />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-[14px] font-semibold text-fg">
                      {p.name} {p.isVerified && <VerifiedBadge size={14} />}
                    </span>
                    <span className="block truncate text-[12.5px] text-fg-3">
                      {p.title} · {CATEGORY_BY_SLUG[p.category]?.name ?? p.category}
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
          <h2 id="media-h" className="flex items-center gap-2 font-display text-[20px] font-semibold text-fg">
            {q ? (
              <>
                <Search size={18} className="text-accent" /> Topildi <span className="text-[14px] font-semibold text-fg-3">{r.media.length}</span>
              </>
            ) : (
              <>
                <Sparkles size={18} className="text-accent" /> Yangi videolar va postlar
              </>
            )}
          </h2>
          <ul className="stagger mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {r.media.map((m) => (
              <li key={`${m.kind}-${m.id}`} className="min-w-0">
                <Link href={m.href} className="group block rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <MediaTile d={{ thumbUrl: m.thumbUrl, videoUrl: m.videoUrl, isVideo: m.isVideo, textOnly: m.textOnly, count: m.count, caption: m.caption, likes: m.kind === "post" ? m.likes : undefined, comments: m.kind === "post" ? m.comments : undefined }} />
                  <span className="mt-2 block px-0.5">
                    {m.caption && !m.textOnly && <span className="line-clamp-2 text-[13px] leading-snug text-fg">{m.caption}</span>}
                    <span className="mt-1 flex items-center gap-1.5 text-[12px] text-fg-3">
                      <Avatar name={m.author.name} src={m.author.avatarUrl} size={18} decorative />
                      <span className="truncate font-medium text-fg-2">{m.author.name}</span>
                      <span aria-hidden>·</span>
                      <span className="shrink-0">{KIND_LABEL[m.kind]}</span>
                      <span className="ml-auto shrink-0" suppressHydrationWarning>
                        {timeAgo(m.createdAt)}
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
            {s.label}
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {s.items.map((it) => (
              <li key={it.href}>
                <Link href={it.href} className="card card-hover icon-nudge flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-fg">{it.title}</span>
                    {it.sub && <span className="block truncate text-[12.5px] text-fg-3">{it.sub}</span>}
                  </span>
                  <ArrowUpRight size={16} className="shrink-0 text-fg-3" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {nothing && (
        <section className="mt-8">
          <EmptyState icon={Compass} title={q ? `«${q}» bo'yicha hech narsa topilmadi` : "Hali ommaviy kontent yo'q"} description={q ? "Boshqa so'z bilan urinib ko'ring: ish turi (montaj, logo), shahar yoki ijodkor ismi." : "Ijodkorlar video va postlar joylashi bilan ular shu yerda chiqadi."} />
        </section>
      )}
    </div>
  );
}
