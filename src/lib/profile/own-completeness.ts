import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { portfolioItems, type Specialist } from "@/lib/db/schema";
import { profileCompleteness, type Completeness } from "@/lib/profile/completeness";
import { profilePostCounts } from "@/lib/profile/posts";

/**
 * Kirgan mutaxassisning «profil to'liqligi» (profil sahifasidagi bilan AYNAN bir xil qoida): bosh sahifada
 * progress kartasi uchun. Faqat 2 ta yengil sanash so'rovi. Mutaxassis bo'lmasa yoki 100% bo'lsa — null.
 */
export async function ownCompleteness(user: { id: string; avatarUrl: string | null; specialist?: Specialist | null }): Promise<Completeness | null> {
  const sp = user.specialist;
  if (!sp) return null;
  const [pf, pc] = await Promise.all([
    db.select({ n: count() }).from(portfolioItems).where(eq(portfolioItems.specialistId, sp.id)).then((r) => r[0]?.n ?? 0),
    profilePostCounts(user.id).catch(() => ({ posts: 0 })),
  ]);
  const c = profileCompleteness({
    avatarUrl: user.avatarUrl,
    coverUrl: sp.coverUrl,
    bio: sp.bio,
    skills: sp.skills,
    portfolioCount: pf,
    workHistory: sp.workHistory ?? [],
    education: sp.education ?? [],
    languages: sp.languages ?? [],
    workTypes: sp.workTypes ?? [],
    priceFrom: sp.priceFrom,
    certificates: sp.certificates ?? [],
    postsCount: pc.posts,
  });
  return c.percent >= 100 ? null : c;
}
