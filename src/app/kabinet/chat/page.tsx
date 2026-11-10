import type { Metadata } from "next";
import { Suspense } from "react";
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
 * Ichki chat: yagona ro'yxat (shaxsiy suhbatlar, guruh/kanallar, buyurtma chatlari) + ochiq chat.
 * Ochiq chat MANZILDA — klient shu parametrlarni o'zi o'qiydi (`useChatRoute`), sahifa ularni faqat kirish
 * yo'naltiruvida ishlatadi:
 *   ?s=<id>            — shaxsiy suhbat (bildirishnoma / «Yozish» havolasidan)
 *   ?guruh=<slug>      — guruh/kanal (&gtab=chat — muhokama, &gtab=azolar — a'zolar va so'rovlar, &post=, &invite=)
 *   ?xato=yopiq|topilmadi|blok|ozim — /yozish/<taxallus> ochilmadi (sababi sahifa tepasida ko'rsatiladi)
 * Sarlavha ixcham (bir qator) — asosiy joy chatning o'ziga qoladi.
 */
export default async function ChatPage({ searchParams }: { searchParams: Promise<{ s?: string; guruh?: string; gtab?: string; post?: string; invite?: string }> }) {
  const [{ s, guruh, gtab, post, invite }, user, locale] = await Promise.all([searchParams, getCurrentUser(), getLocale()]);
  // /jamoalar/[slug] redirect'lari (Telegram uslubi) mehmonni login'ga olib boradi — kirgach aynan shu chatga qaytadi
  if (!user) {
    const q = new URLSearchParams();
    if (s) q.set("s", s);
    if (guruh) q.set("guruh", guruh);
    if (gtab) q.set("gtab", gtab);
    if (post) q.set("post", post);
    if (invite) q.set("invite", invite);
    redirect(await loginRedirectPath(`/kabinet/chat${q.size ? `?${q.toString()}` : ""}`));
  }
  return (
    <div>
      <h1 className="mb-3 font-display text-[20px] font-semibold tracking-tight text-fg max-sm:hidden">{TITLE[locale]}</h1>
      <Suspense fallback={null}>
        <DmChat viewerId={user.id} viewerRole={user.role ?? null} />
      </Suspense>
    </div>
  );
}
