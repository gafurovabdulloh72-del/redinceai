import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UsersRound } from "lucide-react";
import { FollowTabs } from "@/components/groups/FollowersDialog";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { followState } from "@/lib/groups/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Obunalar" };

/** Kabinet: menga obuna bo'lganlar va men obuna bo'lganlar (mijoz ham, ijodkor ham) */
export default async function FollowsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/obunalar"));
  const st = await followState(user.id, user.id);
  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <span className="eyebrow">
          <UsersRound size={13} className="text-accent" /> Kabinet
        </span>
        <h1 className="mt-2 font-display text-[26px] font-semibold tracking-tight text-fg sm:text-[30px]">
          Obunachilar va <span className="accent-serif text-accent">obunalar</span>
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">Sizga obuna bo&apos;lganlar yangi postlaringizdan xabar oladi; siz obuna bo&apos;lganlarning postlari bosh sahifadagi «Obunalarim» lentasida.</p>
      </header>
      <div className="card mx-auto max-w-2xl p-3 sm:p-4">
        <FollowTabs userId={user.id} followers={st.followersCount} following={st.followingCount} loggedIn viewerId={user.id} />
      </div>
    </div>
  );
}
