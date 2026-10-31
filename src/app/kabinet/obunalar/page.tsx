import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { OBUNALAR } from "@/lib/i18n/dict/kabinet-pages";
import { redirect } from "next/navigation";
import { UsersRound } from "lucide-react";
import { FollowTabs } from "@/components/groups/FollowersDialog";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { followState } from "@/lib/groups/service";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Obunalar"])  };
}

/** Kabinet: menga obuna bo'lganlar va men obuna bo'lganlar (mijoz ham, ijodkor ham) */
export default async function FollowsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/obunalar"));
  const til = await getLocale();
  const st = await followState(user.id, user.id);
  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <span className="eyebrow">
          <UsersRound size={13} /> {tr(til, OBUNALAR.cabinet)}
        </span>
        <h1 className="display-xl mt-4 text-fg">
          {tr(til, OBUNALAR.titleStart)} <span className="accent-serif">{tr(til, OBUNALAR.titleAccent)}</span>
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">
          {OBUNALAR.description[til](st.followersCount, st.followingCount)}
        </p>
      </header>
      <div className="card mx-auto max-w-2xl p-3 sm:p-4">
        <FollowTabs userId={user.id} followers={st.followersCount} following={st.followingCount} loggedIn viewerId={user.id} />
      </div>
    </div>
  );
}
