import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { CloseFriendsPanel } from "@/components/social/CloseFriendsPanel";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { listCloseFriends } from "@/lib/social/instagram";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Yaqin do'stlar"])  };
}

/** Yaqin do'stlar: «close» auditoriyali post va story faqat shu ro'yxatdagilarga ko'rinadi */
export default async function CloseFriendsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/yaqin-doslar"));
  const items = await listCloseFriends(user.id);

  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <h1 className="display-xl flex items-center gap-2 text-fg">
          <Users size={22} className="text-fg-3" /> Yaqin do&apos;stlar
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">Ro&apos;yxat faqat sizga ko&apos;rinadi — kimni qo&apos;shganingizni hech kim bilmaydi.</p>
      </header>
      <CloseFriendsPanel initial={items.map((u) => ({ id: u.id, name: u.name, username: u.username, avatarUrl: u.avatarUrl }))} />
    </div>
  );
}
