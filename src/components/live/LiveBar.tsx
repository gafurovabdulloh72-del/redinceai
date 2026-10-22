"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RadioTower } from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/toast";
import { LiveRoomOverlay } from "./LiveRoom";
import { BuyButton } from "@/components/mentorship/PurchaseDialog";

type Live = { id: string; title: string; startedAt: number; price?: number; access?: boolean };

/**
 * Jamoa/kanal tepasidagi jonli efir paneli: efir bor bo'lsa «Tomosha qilish», egasi/moderatorda
 * «Efir boshlash». Efirning o'zi LiveKit orqali platforma ichida (to'liq ekranli qatlam).
 */
export function LiveBar({ slug, canHost, loggedIn }: { slug: string; canHost: boolean; loggedIn: boolean }) {
  const enabled = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const [live, setLive] = useState<Live | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/live?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      const j = (await r.json()) as { data?: { live: Live | null } };
      setLive(j.data?.live ?? null);
    } catch {
      /* tarmoq xatosi — keyingi urinish */
    }
  }, [slug]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 20_000);
    return () => clearInterval(t);
  }, [enabled, load]);

  // ?efir=1 — bildirishnomadan kelganda avtomatik ochish
  useEffect(() => {
    if (live && loggedIn && new URLSearchParams(window.location.search).get("efir") === "1") setOpen(live.id);
  }, [live, loggedIn]);

  if (!enabled || (!live && !canHost)) return null;

  async function start() {
    setBusy(true);
    try {
      const r = await fetch("/api/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, title, price: price ? Number(price) : 0 }) });
      const j = (await r.json()) as { data?: { id: string }; error?: string };
      if (!r.ok || !j.data) throw new Error(j.error || "Efirni boshlab bo'lmadi");
      setAsking(false);
      setTitle("");
      setPrice("");
      setOpen(j.data.id);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className={cn("card mb-4 flex flex-wrap items-center gap-3 p-3.5", live && "border-danger/40")} aria-label="Jonli efir">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", live ? "bg-danger text-white" : "bg-fg/6 text-fg-2")}>
          <RadioTower size={16} />
        </span>
        <div className="min-w-0 flex-1">
          {live ? (
            <>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-danger">
                <span className="h-1.5 w-1.5 animate-ping-soft rounded-full bg-danger" /> Hozir jonli
              </p>
              <p className="truncate text-[14px] font-semibold text-fg">{live.title}{(live.price ?? 0) > 0 && <span className="ml-1.5 rounded bg-fg/8 px-1.5 py-0.5 text-[11px] font-bold">pullik</span>}</p>
            </>
          ) : asking ? (
            <div className="flex gap-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Efir mavzusi" aria-label="Efir mavzusi" className="field h-10 min-w-0 flex-1" autoFocus />
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Chipta, so'm (ixtiyoriy)" aria-label="Chipta narxi" className="field h-10 w-[150px]" />
            </div>
          ) : (
            <p className="text-[14px] font-semibold text-fg">Jonli efir</p>
          )}
        </div>
        {live ? (
          loggedIn ? (
            (live.price ?? 0) > 0 && !live.access && !canHost ? (
              <BuyButton type="ticket" id={live.id} loggedIn className="btn-accent h-10 px-4 text-[13.5px]">
                🎟 Chipta — {(live.price ?? 0).toLocaleString("ru-RU")} so&apos;m
              </BuyButton>
            ) : (
              <button type="button" className="btn-accent h-10 px-4 text-[13.5px]" onClick={() => setOpen(live.id)}>
                {canHost ? "Efirga qaytish" : "Tomosha qilish"}
              </button>
            )
          ) : (
            <a href="/auth/kirish" className="btn-accent inline-flex h-10 items-center px-4 text-[13.5px]">Kirish</a>
          )
        ) : asking ? (
          <div className="flex gap-2">
            <button type="button" className="h-10 rounded-full px-3 text-[13px] font-semibold text-fg-3" onClick={() => setAsking(false)}>Bekor</button>
            <button type="button" disabled={busy} className="btn-accent inline-flex h-10 items-center gap-1.5 px-4 text-[13.5px]" onClick={start}>
              {busy && <Loader2 size={14} className="animate-spin" />} Boshlash
            </button>
          </div>
        ) : (
          <button type="button" className="btn-accent h-10 px-4 text-[13.5px]" onClick={() => setAsking(true)}>
            Efir boshlash
          </button>
        )}
      </section>
      {open && (
        <LiveRoomOverlay
          streamId={open}
          onClose={() => {
            setOpen(null);
            void load();
          }}
        />
      )}
    </>
  );
}
