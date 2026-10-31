import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { HomeFeed } from "@/components/feed/HomeFeed";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { listWatchLater } from "@/lib/social/library";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Keyinroq ko'rish"])  };
}

/** «Keyinroq ko'rish» navbati — post menyusidagi «Keyinroq ko'rish» orqali to'ldiriladi */
export default async function WatchLaterPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/keyinroq"));
  const page = await listWatchLater({ id: user.id, role: user.role }, { limit: 10 });

  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <h1 className="display-xl flex items-center gap-2 text-fg">
          <Clock size={22} className="text-fg-3" /> Keyinroq ko&apos;rish
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">Vaqtingiz bo&apos;lmaganda belgilab qo&apos;ygan videolaringiz. Faqat sizga ko&apos;rinadi.</p>
      </header>
      <div className="mx-auto max-w-2xl">
        <HomeFeed initial={page} loggedIn source="/api/library/keyinroq" emptyTitle="Navbat bo'sh — postning «…» menyusida «Keyinroq ko'rish»ni tanlang" />
      </div>
    </div>
  );
}
