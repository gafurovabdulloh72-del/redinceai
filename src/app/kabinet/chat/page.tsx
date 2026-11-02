import type { Metadata } from "next";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { redirect } from "next/navigation";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { DmChat } from "@/components/chat/DmChat";

export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Chat"]), other: { "m-title": tr(til, KABINET_NAV.titles["Chat"]) }  };
}

const TITLE = { uz: "Chat", ru: "Чат" } as const;

/**
 * Ichki chat: suhbatlar ro'yxati + yozishmalar. ?s=<id> — ochib qo'yiladigan suhbat (bildirishnoma havolasidan),
 * ?xato=yopiq — /yozish/<user> siyosat tufayli ochilmagan (toast ko'rsatiladi).
 * Sarlavha ixcham (bir qator) — asosiy joy chatning o'ziga qoladi.
 */
export default async function ChatPage({ searchParams }: { searchParams: Promise<{ s?: string; xato?: string; guruh?: string; gtab?: string; post?: string; invite?: string }> }) {
  const [{ s, xato, guruh, gtab, post, invite }, user, locale] = await Promise.all([searchParams, getCurrentUser(), getLocale()]);
  // /jamoalar/[slug] redirect'lari (Telegram uslubi) mehmonni login'ga olib boradi
  if (!user) {
    const q = new URLSearchParams();
    if (s) q.set("s", s);
    if (guruh) q.set("guruh", guruh);
    if (gtab) q.set("gtab", gtab);
    redirect(await loginRedirectPath(`/kabinet/chat${q.size ? `?${q.toString()}` : ""}`));
  }
  return (
    <div>
      <h1 className="mb-3 font-display text-[20px] font-semibold tracking-tight text-fg max-sm:hidden">{TITLE[locale]}</h1>
      <DmChat initialId={s ?? null} viewerRole={user?.role ?? null} notice={xato ?? null} initialGroup={guruh ?? null} initialGroupTab={gtab === "chat" ? "chat" : "posts"} initialPost={post ?? null} initialInvite={invite ?? null} />
    </div>
  );
}
