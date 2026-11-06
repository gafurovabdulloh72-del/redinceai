"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";

type Live = { id: string; title: string };

/**
 * Chat panelidagi ixcham «🔴 Jonli efir» chizig'i (2026-11-06). Ilgari guruh/kanal chatda ochilganda jonli efir
 * umuman ko'rinmasdi (LiveBar faqat ustoz sahifasida edi) — bildirishnomani o'tkazib yuborgan a'zo efirni topolmasdi.
 * Bosilganda doimiy `/efir/<id>` sahifasi ochiladi (kirish/chipta/kod tekshiruvi o'sha yerda).
 */
export function LiveStrip({ slug }: { slug: string }) {
  const til = useLocale();
  const [live, setLive] = useState<Live | null>(null);
  const enabled = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/live?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { data?: { live: Live | null } };
      setLive(j.data?.live ?? null);
    } catch {
      /* tarmoq xatosi — keyingi urinishda */
    }
  }, [slug]);

  useEffect(() => {
    if (!enabled) return;
    setLive(null);
    void load();
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 30_000);
    return () => clearInterval(t);
  }, [enabled, load]);

  if (!live) return null;
  return (
    <Link
      href={`/efir/${encodeURIComponent(live.id)}`}
      className="flex shrink-0 items-center gap-2 border-b border-line bg-danger/8 px-3 py-2 text-[13px] hover:bg-danger/12"
    >
      <span className="h-2 w-2 shrink-0 animate-ping-soft rounded-full bg-danger" aria-hidden />
      <span className="shrink-0 font-bold text-danger">{til === "ru" ? "В эфире" : "Jonli efir"}</span>
      <span className="min-w-0 flex-1 truncate font-semibold text-fg" data-no-auto>
        {live.title}
      </span>
      <span className="inline-flex shrink-0 items-center text-[12.5px] font-semibold text-fg-2">
        {til === "ru" ? "Смотреть" : "Ko'rish"} <ChevronRight size={14} />
      </span>
    </Link>
  );
}
