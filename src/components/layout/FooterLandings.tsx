import Link from "next/link";
import { unstable_cache } from "next/cache";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { getLandingIndex } from "@/lib/queries";
import { tr, type Locale } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";

/**
 * SEO: yo'nalish sahifalariga ichki havolalar (2026-10-24).
 * `/yonalish/<kasb>` va `/yonalish/<kasb>/<hudud>` sahifalari aynan mijoz qidiradigan
 * so'rovlar uchun yozilgan («Toshkentdagi videograflar — narxlar, reyting va portfolio»),
 * lekin ularga sayt ichidan HECH QAYERDAN havola yo'q edi — faqat sitemap'da.
 * Google bunday «yetim» sahifalarni oxirgi navbatda oladi. Footer har ommaviy sahifada
 * chizilgani uchun bu bloklar butun saytdan o'sha sahifalarga yo'l ochadi.
 *
 * Faqat kamida 1 ta ko'rinadigan mutaxassisi bor juftliklar chiqadi (bo'sh sahifaga havola yo'q).
 */
const landings = unstable_cache(
  async () => {
    const rows = await getLandingIndex().catch(() => []);
    // Kasb bo'yicha jami
    const byCraft = new Map<string, number>();
    for (const r of rows) byCraft.set(r.category, (byCraft.get(r.category) ?? 0) + r.n);
    const crafts = [...byCraft.entries()]
      .filter(([slug]) => CATEGORY_BY_SLUG[slug])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([slug]) => slug);
    // Eng ko'p mutaxassisli kasb×hudud juftliklari
    const pairs = rows
      .filter((r) => r.n > 0 && CATEGORY_BY_SLUG[r.category] && REGION_BY_SLUG[r.region])
      .sort((a, b) => b.n - a.n)
      .slice(0, 8)
      .map((r) => ({ category: r.category, region: r.region }));
    return { crafts, pairs };
  },
  ["footer-landings"],
  { revalidate: 3600 },
);

export async function FooterLandings({ til }: { til: Locale }) {
  const { crafts, pairs } = await landings();
  if (crafts.length === 0) return null;
  const link = "inline-flex min-h-8 items-center text-[12.5px] text-fg-3 transition hover:text-fg";
  return (
    <nav aria-label={tr(til, SHELL.footer.craftsAria)} className="mt-6 space-y-2 border-t border-line pt-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
        <span className="text-[12.5px] font-semibold text-fg-2">{tr(til, SHELL.footer.byCraft)}</span>
        {crafts.map((slug) => (
          <Link key={slug} href={`/yonalish/${slug}`} className={link}>
            {CATEGORY_BY_SLUG[slug].plural}
          </Link>
        ))}
      </div>
      {pairs.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
          <span className="text-[12.5px] font-semibold text-fg-2">{tr(til, SHELL.footer.byCity)}</span>
          {pairs.map((p) => (
            <Link key={`${p.category}/${p.region}`} href={`/yonalish/${p.category}/${p.region}`} className={link}>
              {SHELL.footer.inRegion[til](CATEGORY_BY_SLUG[p.category].plural.toLowerCase(), REGION_BY_SLUG[p.region].short)}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
