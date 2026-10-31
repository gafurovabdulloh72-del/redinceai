import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { SAQLANGANLAR } from "@/lib/i18n/dict/kabinet-pages";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bookmark, GraduationCap } from "lucide-react";
import { HomeFeed } from "@/components/feed/HomeFeed";
import { CourseCard } from "@/components/mentorship/CourseCard";
import { EmptyState } from "@/components/ui";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { listSavedPosts } from "@/lib/feed";
import { listSavedCourses } from "@/lib/mentorship/service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Saqlanganlar"])  };
}

/** Saqlangan postlar (bookmark) — faqat egasiga ko'rinadi; lenta kartalari bilan bir xil (reaksiya, izoh, ulashish) */
export default async function SavedPostsPage({ searchParams }: { searchParams: Promise<{ tur?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/saqlanganlar"));
  const til = await getLocale();
  const { tur } = await searchParams;
  const kurslar = tur === "kurslar";
  const [page, courses] = await Promise.all([kurslar ? null : listSavedPosts({ id: user.id, role: user.role }, { limit: 10 }), kurslar ? listSavedCourses(user.id) : Promise.resolve([])]);
  const seg = "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold transition";

  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <span className="eyebrow">
          <Bookmark size={13} /> {tr(til, SAQLANGANLAR.cabinet)}
        </span>
        <h1 className="display-xl mt-4 text-fg">
          {tr(til, SAQLANGANLAR.titleStart)} <span className="accent-serif">{tr(til, SAQLANGANLAR.titleAccent)}</span>
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">{tr(til, SAQLANGANLAR.description)}</p>
      </header>
      {/* Postlar · Kurslar (Udemy wishlist shu yerda) */}
      <nav className="mb-5 flex gap-1 border-b border-line pb-3" aria-label={tr(til, SAQLANGANLAR.navAria)}>
        <Link href="/kabinet/saqlanganlar" aria-current={!kurslar ? "page" : undefined} className={cn(seg, !kurslar ? "bg-fg text-bg" : "text-fg-3 hover:text-fg")}>
          <Bookmark size={14} /> {tr(til, SAQLANGANLAR.posts)}
        </Link>
        <Link href="/kabinet/saqlanganlar?tur=kurslar" aria-current={kurslar ? "page" : undefined} className={cn(seg, kurslar ? "bg-fg text-bg" : "text-fg-3 hover:text-fg")}>
          <GraduationCap size={14} /> {tr(til, SAQLANGANLAR.courses)}{courses.length ? ` · ${courses.length}` : ""}
        </Link>
      </nav>
      {kurslar ? (
        courses.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line">
            {courses.map((c) => (
              <CourseCard key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <EmptyState title={tr(til, SAQLANGANLAR.noCourses)} description={tr(til, SAQLANGANLAR.noCoursesText)} />
        )
      ) : (
        page && (
          <div className="mx-auto max-w-2xl">
            <HomeFeed initial={page} loggedIn source="/api/posts/saved" emptyTitle={tr(til, SAQLANGANLAR.noPosts)} />
          </div>
        )
      )}
    </div>
  );
}
