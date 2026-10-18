import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExternalLink, LayoutGrid } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { GroupFeed } from "@/components/groups/GroupFeed";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { listProfilePosts, profilePostCounts } from "@/lib/profile/posts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Postlarim" };

/** Ijodkor kabineti: shaxsiy profil lentasi — post joylash (matn, rasm, video), tahrirlash, o'chirish */
export default async function MyPostsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/postlar"));
  if (!user.specialist) {
    return (
      <div className="animate-fade-up">
        <EmptyState icon={LayoutGrid} title="Postlar ijodkor profili bilan ishlaydi" description="Profil lentasi (postlar, videolar, ishlar) ommaviy ijodkor sahifasida ko'rinadi. Avval ijodkor profilini yarating." action={<ButtonLink href="/kabinet/profil#mutaxassis" variant="accent" size="md">Profilni yaratish</ButtonLink>} />
      </div>
    );
  }
  const viewer = { id: user.id, role: user.role };
  const [page, counts] = await Promise.all([listProfilePosts(user.id, viewer, { limit: 20 }), profilePostCounts(user.id)]);
  const profileHref = `/mutaxassislar/${user.specialist.slug}?tab=postlar`;

  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">
            <LayoutGrid size={13} /> Kabinet
          </span>
          <h1 className="display-xl mt-4 text-fg">
            Mening <span className="accent-serif">postlarim</span>
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">
            Profil lentangiz — matn, rasm yoki video. <span className="text-fg-3">{counts.posts} ta post · {counts.videos} ta video · {counts.views} ta ko&apos;rish</span>
          </p>
        </div>
        <ButtonLink href={profileHref} variant="outline" size="md" className="shrink-0">
          Profilda ko&apos;rish <ExternalLink size={14} />
        </ButtonLink>
      </header>
      <GroupFeed slug="" apiBase="/api/profil/postlar" kind="channel" canPost canInteract loggedIn initial={page} composerPlaceholder="Nima yangilik? Ish jarayoni, natija, fikr…" />
    </div>
  );
}
