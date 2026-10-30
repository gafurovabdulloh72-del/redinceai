import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { DmChat } from "@/components/chat/DmChat";

export const metadata: Metadata = { title: "Chat", other: { "m-title": "Xabarlar" } };

const TITLE = { uz: "Xabarlar", ru: "Сообщения" } as const;

/**
 * Ichki chat: suhbatlar ro'yxati + yozishmalar. ?s=<id> — ochib qo'yiladigan suhbat (bildirishnoma havolasidan),
 * ?xato=yopiq — /yozish/<user> siyosat tufayli ochilmagan (toast ko'rsatiladi).
 * Sarlavha ixcham (bir qator) — asosiy joy chatning o'ziga qoladi.
 */
export default async function ChatPage({ searchParams }: { searchParams: Promise<{ s?: string; xato?: string }> }) {
  const [{ s, xato }, user, locale] = await Promise.all([searchParams, getCurrentUser(), getLocale()]);
  return (
    <div>
      <h1 className="mb-3 font-display text-[20px] font-semibold tracking-tight text-fg max-sm:hidden">{TITLE[locale]}</h1>
      <DmChat initialId={s ?? null} viewerRole={user?.role ?? null} notice={xato ?? null} />
    </div>
  );
}
