"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { HeartOff, Undo2 } from "lucide-react";
import { Spinner } from "@/components/ui";
import { getFavoritesServerSnapshot, getFavoritesSnapshot, subscribeFavorites, toggleFavorite } from "@/components/specialists/favorites-store";

/**
 * /kabinet/sevimlilar kartasi o'rami: yurak qayta bosilib sevimlilardan chiqarilsa, karta o'rnida
 * «Olib tashlandi · Qaytarish» ko'rinadi (sahifani yangilash shart emas). Karta (server komponent) children orqali keladi.
 */
export function FavoriteSlot({ specialistId, name, children }: { specialistId: string; name: string; children: ReactNode }) {
  const snap = useSyncExternalStore(subscribeFavorites, getFavoritesSnapshot, getFavoritesServerSnapshot);
  const [busy, setBusy] = useState(false);
  const removed = snap.status === "ready" && !snap.ids.has(specialistId);

  if (!removed) return <>{children}</>;

  const undo = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await toggleFavorite(specialistId, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-outline flex h-full min-h-[180px] flex-col items-center justify-center gap-3 px-5 py-8 text-center animate-fade-up" style={{ animationDuration: "0.25s" }} role="status">
      <span className="icon-tile-soft !rounded-full" aria-hidden="true">
        <HeartOff size={18} />
      </span>
      <p className="text-[14px] font-semibold text-fg">
        {name} <span className="font-normal text-fg-3">sevimlilardan olib tashlandi</span>
      </p>
      <button
        type="button"
        onClick={undo}
        disabled={busy}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4 active:scale-[0.97] disabled:opacity-60"
      >
        {busy ? <Spinner /> : <Undo2 size={14} />} Qaytarish
      </button>
    </div>
  );
}
