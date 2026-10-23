"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Send, Smartphone } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Info = { enabled: boolean; key: string | null; devices: number };

/** base64url → Uint8Array (VAPID ochiq kaliti `applicationServerKey` uchun) */
function urlB64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
const b64u = (buf: ArrayBuffer | null) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "");

/**
 * Brauzer bildirishnomalari (Web Push): shu qurilmada yoqish/o'chirish va sinov xabari.
 * Service worker faqat productionda ro'yxatdan o'tadi — dev'da panel «qo'llab-quvvatlanmaydi» deydi.
 */
export function PushPanel() {
  const [info, setInfo] = useState<Info | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/push", { cache: "no-store" });
      const j = (await r.json()) as { data?: Info };
      setInfo(j.data ?? { enabled: false, key: null, devices: 0 });
    } catch {
      setInfo({ enabled: false, key: null, devices: 0 });
    }
  }, []);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    void refresh();
    if (!ok) return;
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((s) => setOn(Boolean(s)))
      .catch(() => undefined);
  }, [refresh]);

  async function enable() {
    if (!info?.key) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error(perm === "denied" ? "Brauzer bildirishnomani bloklagan — sayt sozlamalaridan ruxsat bering" : "Ruxsat berilmadi");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(info.key) });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const r = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint ?? sub.endpoint,
          keys: { p256dh: json.keys?.p256dh ?? b64u(sub.getKey("p256dh")), auth: json.keys?.auth ?? b64u(sub.getKey("auth")) },
        }),
      });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error || "Saqlanmadi");
      setOn(true);
      showToast("Bildirishnomalar yoqildi", "success");
      void refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yoqilmadi", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setOn(false);
      showToast("Bu qurilmada o'chirildi", "success");
      void refresh();
    } catch {
      showToast("O'chirilmadi", "error");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const r = await fetch("/api/push/sinov", { method: "POST" });
      const j = (await r.json()) as { data?: { sent: number }; error?: string };
      if (!r.ok) throw new Error(j.error || "Yuborilmadi");
      showToast(j.data?.sent ? `${j.data.sent} qurilmaga yuborildi` : "Faol qurilma topilmadi", j.data?.sent ? "success" : "info");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuborilmadi", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!info) return null;
  if (!info.enabled) return null;

  return (
    <section className="card p-4" aria-label="Brauzer bildirishnomalari">
      <div className="flex items-start gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", on ? "bg-accent text-white" : "bg-fg/6 text-fg-2")}>{on ? <Bell size={16} /> : <BellOff size={16} />}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-bold text-fg">Brauzer bildirishnomalari</h3>
          <p className="mt-0.5 text-[12.5px] text-fg-3">
            Sayt yopiq bo'lsa ham xabar, buyurtma va efir haqida darhol xabar beradi.
            {info.devices > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 align-middle">
                <Smartphone size={11} /> {info.devices} qurilma
              </span>
            )}
          </p>
        </div>
      </div>
      {!supported ? (
        <p className="mt-3 rounded-xl bg-fg/5 p-3 text-[12.5px] text-fg-3">Bu brauzer push bildirishnomani qo&apos;llab-quvvatlamaydi. iPhone&apos;da saytni «Asosiy ekranga qo&apos;shish» orqali ilova sifatida o&apos;rnatsangiz ishlaydi.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void (on ? disable() : enable())} className={cn("inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold transition disabled:opacity-60", on ? "border border-line-2 text-fg-2 hover:text-fg" : "btn-accent")}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : on ? <BellOff size={14} /> : <Bell size={14} />}
            {on ? "Bu qurilmada o'chirish" : "Shu qurilmada yoqish"}
          </button>
          {info.devices > 0 && (
            <button type="button" disabled={busy} onClick={() => void test()} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13.5px] font-semibold text-fg-2 transition hover:text-fg disabled:opacity-60">
              <Send size={14} /> Sinov xabari
            </button>
          )}
        </div>
      )}
    </section>
  );
}
