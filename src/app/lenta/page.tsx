import type { Metadata } from "next";
import { ReelsFeed } from "@/components/reels/ReelsFeed";
import { getCurrentUser } from "@/lib/auth";
import { getReelByPostId, getReels, type ReelsMode } from "@/lib/reels";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reels — ijodkorlar ishlari",
  description: "Kasb Egalari Reels: ijodkorlarning video va rasmli postlari, trend va haftalik TOP. Yoqqan ijodkorga darhol yozing.",
  alternates: { canonical: "/lenta" },
};

/**
 * Reels (/lenta): saytdagi barcha media-postlar + portfolio videolari. `?tab=new|top`, `?post=<id>` — ulashilgan post boshida.
 * `data-reels-screen` — globals.css telefonda yuqori panelni yashiradi (to'liq ekran), pastki tab qoladi.
 */
export default async function LentaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const viewer = user ? { id: user.id, role: user.role } : null;
  const tab = typeof sp.tab === "string" ? sp.tab : "";
  const mode: ReelsMode = tab === "new" || tab === "top" ? tab : "foryou";
  const postId = typeof sp.post === "string" && sp.post.length <= 64 ? sp.post : null;
  const [page, pinned] = await Promise.all([getReels(viewer, mode, null, 6), postId ? getReelByPostId(postId, viewer) : Promise.resolve(null)]);
  const items = pinned ? [pinned, ...page.items.filter((i) => i.key !== pinned.key)] : page.items;
  return (
    <div data-reels-screen>
      <h1 className="sr-only">Reels — ijodkorlar ishlari</h1>
      <ReelsFeed initial={items} initialCursor={page.nextCursor} initialMode={mode} me={user ? { id: user.id, username: user.username ?? null } : null} pinnedKey={pinned?.key ?? null} />
    </div>
  );
}
