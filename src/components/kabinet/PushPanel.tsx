"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Send, Smartphone } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { BILDIRISHNOMA } from "@/lib/i18n/dict/kabinet-pages";
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
const P = BILDIRISHNOMA.push;

export function PushPanel() {
  const til = useLocale();
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
      if (perm !== "granted") throw new Error(tr(til, perm === "denied" ? P.blocked : P.denied));
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
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error || tr(til, P.notSaved));
      setOn(true);
      showToast(tr(til, P.enabled), "success");
      void refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr(til, P.enableFailed), "error");
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
      showToast(tr(til, P.disabled), "success");
      void refresh();
    } catch {
      showToast(tr(til, P.disableFailed), "error");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const r = await fetch("/api/push/sinov", { method: "POST" });
      const j = (await r.json()) as { data?: { sent: number }; error?: string };
      if (!r.ok) throw new Error(j.error || tr(til, P.sendFailed));
      showToast(j.data?.sent ? P.sentTo[til](j.data.sent) : tr(til, P.noDevices), j.data?.sent ? "success" : "info");
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr(til, P.sendFailed), "error");
    } finally {
      setBusy(false);
    }
  }

  if (!info) return null;
  if (!info.enabled) return null;

  return (
    <section className="card p-4 m-flat max-sm:px-0 max-sm:py-3" aria-label={tr(til, P.title)}>
      <div className="flex items-start gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", on ? "bg-accent text-white" : "bg-fg/6 text-fg-2")}>{on ? <Bell size={16} /> : <BellOff size={16} />}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-bold text-fg">{tr(til, P.title)}</h3>
          {/* Telefonda tavsif yashirin — bitta qator + tugma (ixcham) */}
          <p className="mt-0.5 text-[12.5px] text-fg-3 max-sm:hidden">
            {tr(til, P.description)}
            {info.devices > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 align-middle">
                <Smartphone size={11} /> {P.devices[til](info.devices)}
              </span>
            )}
          </p>
        </div>
      </div>
      {!supported ? (
        <p className="mt-3 rounded-xl bg-fg/5 p-3 text-[12.5px] text-fg-3">{tr(til, P.unsupported)}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2 max-sm:mt-2.5">
          <button type="button" disabled={busy} onClick={() => void (on ? disable() : enable())} className={cn("inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold transition disabled:opacity-60", on ? "border border-line-2 text-fg-2 hover:text-fg" : "btn-accent")}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : on ? <BellOff size={14} /> : <Bell size={14} />}
            {tr(til, on ? P.disableHere : P.enableHere)}
          </button>
          {info.devices > 0 && (
            <button type="button" disabled={busy} onClick={() => void test()} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13.5px] font-semibold text-fg-2 transition hover:text-fg disabled:opacity-60">
              <Send size={14} /> {tr(til, P.test)}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
