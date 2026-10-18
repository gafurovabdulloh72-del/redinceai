import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";
import { HomeFeed } from "@/components/feed/HomeFeed";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { listSavedPosts } from "@/lib/feed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saqlanganlar" };

/** Saqlangan postlar (bookmark) — faqat egasiga ko'rinadi; lenta kartalari bilan bir xil (reaksiya, izoh, ulashish) */
export default async function SavedPostsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/saqlanganlar"));
  const page = await listSavedPosts({ id: user.id, role: user.role }, { limit: 10 });

  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <span className="eyebrow">
          <Bookmark size={13} /> Kabinet
        </span>
        <h1 className="display-xl mt-4 text-fg">
          Saqlangan <span className="accent-serif">postlar</span>
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">Lentada belgilab qo&apos;ygan postlaringiz — faqat sizga ko&apos;rinadi.</p>
      </header>
      <div className="mx-auto max-w-2xl">
        <HomeFeed initial={page} loggedIn source="/api/posts/saved" emptyTitle="Hali saqlangan post yo'q — lentada postning belgi tugmasini bosing" />
      </div>
    </div>
  );
}
