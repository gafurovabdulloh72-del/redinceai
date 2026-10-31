import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { ScheduledList } from "@/components/social/PostExtras";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { listScheduled } from "@/lib/social/instagram";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Rejalashtirilgan postlar"])  };
}

/** Rejalashtirilgan postlar: vaqti kelganda avtomatik joylanadi (cron + lenta ochilganda) */
export default async function ScheduledPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/rejalashtirilgan"));
  const items = await listScheduled(user.id);

  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <h1 className="display-xl flex items-center gap-2 text-fg">
          <CalendarClock size={22} className="text-fg-3" /> Rejalashtirilgan
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">Post yozishda vaqt belgilasangiz, u shu yerda turadi va o&apos;sha paytda avtomatik joylanadi.</p>
      </header>
      <ScheduledList initial={items.map((r) => ({ id: r.id, body: r.body, runAt: r.runAt, status: r.status, error: r.error }))} />
    </div>
  );
}
