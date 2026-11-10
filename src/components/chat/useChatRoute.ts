"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Ochiq chat — MANZILDA (QA B2). Ilgari qaysi suhbat ochiqligi faqat komponent holatida turardi: brauzer / Android
 * «Orqaga» tugmasi ochiq suhbatdan butun chat bo'limini tark etar, sahifani yangilash esa eskirgan `?s=` ni qayta ochardi.
 *
 *   /kabinet/chat                 — ro'yxat
 *   /kabinet/chat?s=<id>          — shaxsiy suhbat
 *   /kabinet/chat?guruh=<slug>    — guruh/kanal (&gtab=chat|azolar, &post=<id>, &invite=<kod>)
 *
 * Ro'yxatdan chat ochilganda tarixga YANGI yozuv qo'shiladi (`pushState`) — «Orqaga» ro'yxatga qaytaradi; bir chatdan
 * boshqasiga o'tish yozuvni almashtiradi (`replaceState`) — «Orqaga» baribir ro'yxatga. Next.js `pushState`/`replaceState`
 * ni o'z routeriga ulaydi: `useSearchParams` yangilanadi, sahifa serverdan qayta so'ralmaydi.
 * Holat obyektiga faqat o'z belgimiz (`chatOpen`) beriladi — Next ichki maydonlarini o'zi ko'chiradi (ularni o'zimiz
 * ko'chirsak, Next chaqiruvni «ichki» deb o'ylab manzilni routerga yetkazmaydi).
 */
export interface ChatRoute {
  conv: string | null;
  group: string | null;
  /** Guruh paneli tabi: "chat" (kanal muhokamasi) | "azolar" (a'zolar varag'i) | null */
  gtab: string | null;
  post: string | null;
  invite: string | null;
  openConv: (id: string) => void;
  openGroup: (slug: string, extra?: { gtab?: string }) => void;
  /** Chatni yopish: ro'yxatdan ochilgan bo'lsa tarixda orqaga, to'g'ridan havola bilan kirilgan bo'lsa manzil tozalanadi */
  close: () => void;
  /** Joriy guruh manzilidan bir martalik parametrlarni (gtab/post/invite) olib tashlash — varaq yopilgach qayta ochilmasin */
  clearGroupExtras: () => void;
}

export function useChatRoute(): ChatRoute {
  const sp = useSearchParams();
  // Bosilgan zahoti ko'rinishi uchun: Next manzilni transition ichida yangilaydi — ungacha shu qiymat ishlatiladi
  const [override, setOverride] = useState<{ conv: string | null; group: string | null } | null>(null);
  useEffect(() => setOverride(null), [sp]);

  const conv = override ? override.conv : sp.get("s");
  const group = override ? override.group : sp.get("guruh");
  const open = Boolean(conv || group);

  const go = useCallback((params: Record<string, string>, push: boolean) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    const wasOpen = Boolean((window.history.state as { chatOpen?: boolean } | null)?.chatOpen);
    if (push) window.history.pushState({ chatOpen: true }, "", url);
    else window.history.replaceState({ chatOpen: wasOpen }, "", url);
  }, []);

  const openConv = useCallback(
    (id: string) => {
      setOverride({ conv: id, group: null });
      go({ s: id }, !open);
    },
    [go, open],
  );
  const openGroup = useCallback(
    (slug: string, extra?: { gtab?: string }) => {
      setOverride({ conv: null, group: slug });
      go({ guruh: slug, ...(extra?.gtab ? { gtab: extra.gtab } : {}) }, !open);
    },
    [go, open],
  );
  const close = useCallback(() => {
    setOverride({ conv: null, group: null });
    if ((window.history.state as { chatOpen?: boolean } | null)?.chatOpen) window.history.back();
    else go({}, false);
  }, [go]);
  const clearGroupExtras = useCallback(() => {
    const g = new URLSearchParams(window.location.search).get("guruh");
    if (g) go({ guruh: g }, false);
  }, [go]);

  return useMemo(
    () => ({ conv, group, gtab: override ? null : sp.get("gtab"), post: override ? null : sp.get("post"), invite: override ? null : sp.get("invite"), openConv, openGroup, close, clearGroupExtras }),
    [conv, group, override, sp, openConv, openGroup, close, clearGroupExtras],
  );
}
