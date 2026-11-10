"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, UsersRound } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useToast } from "@/components/ui/toast";
import { chatT, type ChatKey } from "@/lib/i18n/dict/chat";
import { DialogHead, Layer, PeerAvatar } from "./DmPanels";

interface Found {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

/**
 * «Yangi chat» (QA C2): chat ro'yxatidan chiqmasdan odam topib yozish. Ilgari suhbatni faqat profil sahifasidagi
 * «Yozish» yoki `/yozish/<taxallus>` orqali boshlash mumkin edi; ro'yxatdagi qidiruv faqat mavjud qatorlarni filtrlardi.
 * Qidiruv: `/api/users/mention` (taxallus prefiksi yoki ism, 8 tagacha; bloklangan/taxallussiz hisoblar chiqmaydi).
 * Tanlanganda `POST /api/chat { to }` suhbatni topadi yoki ochadi (blok / «kim yozishi mumkin» siyosati serverda) —
 * suhbat ro'yxatga birinchi xabardan keyin tushadi.
 */
export function NewChatDialog({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: (conversationId: string) => void }) {
  const til = useLocale();
  const t = (k: ChatKey, v?: Record<string, string | number>) => chatT(til, k, v);
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setItems(null);
    setBusy(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const needle = q.trim().replace(/^@/, "");
    if (needle.length < 1) {
      setItems(null);
      return;
    }
    const id = ++seq.current;
    const timer = window.setTimeout(async () => {
      const res = await fetch(`/api/users/mention?q=${encodeURIComponent(needle.slice(0, 32))}`).catch(() => null);
      const j = res ? ((await res.json().catch(() => null)) as { ok?: boolean; data?: { items: Found[] } } | null) : null;
      if (seq.current === id) setItems(j?.ok && j.data ? j.data.items : []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [q, open]);

  const pick = async (u: Found) => {
    if (busy) return;
    setBusy(u.id);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: u.username }) });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; data?: { conversationId: string }; error?: string } | null;
      if (!res.ok || !j?.ok || !j.data) throw new Error(j?.error || t("fail"));
      onOpen(j.data.conversationId);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("fail"), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Layer open={open} onClose={onClose} label={t("newChat")} variant="dialog">
      <DialogHead title={t("newChat")} onClose={onClose} locale={til} />
      <div className="p-2">
        <label className="relative block">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-4" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={40} placeholder={t("newChatPh")} aria-label={t("newChatPh")} autoComplete="off" autoCapitalize="none" spellCheck={false} className="field h-11 w-full !rounded-full pl-10 text-[14px] max-md:text-[16px]" />
        </label>
      </div>
      <div className="min-h-[180px] flex-1 overflow-y-auto px-1 pb-1" aria-live="polite" aria-busy={Boolean(q.trim()) && items === null}>
        {!q.trim() ? (
          <p className="px-4 py-8 text-center text-[13px] leading-relaxed text-fg-3">{t("newChatHint")}</p>
        ) : items === null ? (
          <p className="flex items-center justify-center gap-2 py-8 text-[13px] text-fg-3">
            <Loader2 size={15} className="animate-spin" aria-hidden="true" /> {t("loading")}…
          </p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-fg-3">{t("newChatEmpty")}</p>
        ) : (
          <ul>
            {items.map((u) => (
              <li key={u.id}>
                <button type="button" disabled={busy !== null} onClick={() => void pick(u)} className="flex min-h-14 w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition hover:bg-fg/6 focus-visible:bg-fg/6 focus-visible:outline-none disabled:opacity-60">
                  <PeerAvatar name={u.name} avatarUrl={u.avatarUrl} size={40} />
                  <span className="min-w-0 flex-1" data-no-auto>
                    <span className="block truncate text-[14px] font-semibold text-fg">{u.name}</span>
                    <span className="block truncate text-[12.5px] text-fg-4">@{u.username}</span>
                  </span>
                  {busy === u.id && <Loader2 size={15} className="shrink-0 animate-spin text-fg-3" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Guruh yoki kanal ochish — shu yerdan (Telegram «Yangi guruh / Yangi kanal») */}
      <div className="border-t border-line p-1.5">
        <Link href="/jamoalar/yangi" className="flex min-h-11 items-center gap-2.5 rounded-[10px] px-3 text-[13.5px] font-medium text-fg transition hover:bg-fg/6">
          <UsersRound size={16} className="shrink-0 text-fg-3" aria-hidden="true" /> {t("newGroup")}
        </Link>
      </div>
    </Layer>
  );
}
