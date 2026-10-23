import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { HomeFeed } from "@/components/feed/HomeFeed";
import { ClearHistoryButton } from "@/components/social/ClearHistoryButton";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { listHistory } from "@/lib/social/library";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ko'rish tarixi" };

/** Ko'rish tarixi: oxirgi ko'rilgan videolar, har biri to'xtagan joyidan davom etadi */
export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/tarix"));
  const page = await listHistory({ id: user.id, role: user.role }, { limit: 10 });

  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
        <div>
          <h1 className="display-xl flex items-center gap-2 text-fg">
            <History size={22} className="text-fg-3" /> Ko&apos;rish tarixi
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">So&apos;nggi ko&apos;rgan videolaringiz — qaysi joyda to&apos;xtaganingizdan davom ettirasiz. 90 kundan eskisi avtomatik o&apos;chadi.</p>
        </div>
        {page.items.length > 0 && <ClearHistoryButton />}
      </header>
      <div className="mx-auto max-w-2xl">
        <HomeFeed initial={page} loggedIn source="/api/library/tarix" emptyTitle="Hali ko'rilgan video yo'q" />
      </div>
    </div>
  );
}
