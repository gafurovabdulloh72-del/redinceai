/**
 * «Profil to'liqligi» (faqat egasiga ko'rinadi): vaznli mezonlar bo'yicha foiz va yetishmayotgan qismlar.
 * Sof funksiya — bazaga bormaydi; kalitlar PROFIL_X.completenessItems lug'ati bilan bir xil.
 */
export type CompletenessKey = "avatar" | "cover" | "bio" | "skills" | "portfolio" | "workHistory" | "education" | "languages" | "workTypes" | "price" | "certificates" | "post";

interface Source {
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  skills: readonly string[];
  portfolioCount: number;
  workHistory: readonly unknown[];
  education: readonly unknown[];
  languages: readonly string[];
  workTypes: readonly string[];
  priceFrom: number;
  certificates: readonly unknown[];
  postsCount: number;
}

/** Vaznlar — yig'indisi 100 */
const RULES: Array<{ key: CompletenessKey; weight: number; ok: (s: Source) => boolean; href: string }> = [
  { key: "avatar", weight: 14, ok: (s) => Boolean(s.avatarUrl), href: "/kabinet/profil#rasm" },
  { key: "bio", weight: 14, ok: (s) => (s.bio?.trim().length ?? 0) >= 60, href: "/kabinet/profil#bio" },
  { key: "portfolio", weight: 16, ok: (s) => s.portfolioCount >= 3, href: "/kabinet/portfolio" },
  { key: "skills", weight: 10, ok: (s) => s.skills.length >= 3, href: "/kabinet/profil#konikmalar" },
  { key: "cover", weight: 8, ok: (s) => Boolean(s.coverUrl), href: "/kabinet/profil#muqova" },
  { key: "workHistory", weight: 8, ok: (s) => s.workHistory.length > 0, href: "/kabinet/profil#tajriba" },
  { key: "education", weight: 5, ok: (s) => s.education.length > 0, href: "/kabinet/profil#tajriba" },
  { key: "languages", weight: 5, ok: (s) => s.languages.length > 0, href: "/kabinet/profil#tillar" },
  { key: "workTypes", weight: 6, ok: (s) => s.workTypes.length > 0, href: "/kabinet/profil#ish-turlari" },
  { key: "price", weight: 6, ok: (s) => s.priceFrom > 0, href: "/kabinet/profil#narx" },
  { key: "certificates", weight: 3, ok: (s) => s.certificates.length > 0, href: "/kabinet/profil#sertifikatlar" },
  { key: "post", weight: 5, ok: (s) => s.postsCount > 0, href: "/kabinet/postlar" },
];

export interface Completeness {
  percent: number;
  /** Yetishmayotganlar — vazn bo'yicha kamayib (eng muhimi birinchi), 4 tagacha */
  missing: Array<{ key: CompletenessKey; href: string }>;
}

export function profileCompleteness(s: Source): Completeness {
  let got = 0;
  const missing: Array<{ key: CompletenessKey; href: string; weight: number }> = [];
  for (const r of RULES) {
    if (r.ok(s)) got += r.weight;
    else missing.push({ key: r.key, href: r.href, weight: r.weight });
  }
  missing.sort((a, b) => b.weight - a.weight);
  return { percent: Math.max(0, Math.min(100, got)), missing: missing.slice(0, 4).map(({ key, href }) => ({ key, href })) };
}
