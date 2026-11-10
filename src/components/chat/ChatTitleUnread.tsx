"use client";

import { useEffect, useState } from "react";
import { NOTIFICATIONS_UNREAD_EVENT } from "@/components/layout/notification-meta";
import { TitleUnread } from "@/components/layout/TitleUnread";
import { useChatUnread } from "./unread-store";

/**
 * Brauzer sarlavhasidagi «(n)» — JONLI: o'qilmagan bildirishnomalar + chat (DM, guruh/kanal, buyurtma chati).
 * Ilgari son sahifa yuklanganda bir marta hisoblanardi va yangi xabar kelganda o'zgarmasdi (QA A2). PWA ilova
 * nishoni (setAppBadge) ham shu yerda — foydalanuvchi qaysi sahifada bo'lishidan qat'i nazar yangilanadi.
 */
export function ChatTitleUnread({ notifications, chat }: { notifications: number; chat: number }) {
  const live = useChatUnread(chat, true);
  const [notif, setNotif] = useState(notifications);
  useEffect(() => setNotif(notifications), [notifications]);
  useEffect(() => {
    const on = (e: Event) => {
      const n = (e as CustomEvent<unknown>).detail;
      if (typeof n === "number") setNotif(n);
    };
    window.addEventListener(NOTIFICATIONS_UNREAD_EVENT, on);
    return () => window.removeEventListener(NOTIFICATIONS_UNREAD_EVENT, on);
  }, []);
  const total = notif + live.total;
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (total > 0) void nav.setAppBadge?.(total).catch(() => undefined);
    else void nav.clearAppBadge?.().catch(() => undefined);
  }, [total]);
  return <TitleUnread count={total} />;
}
