"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { usePresence } from "@/components/motion/usePresence";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { cn } from "@/lib/utils";

type Net = "online" | "offline" | "restored";

/**
 * Tarmoq banneri: internet uzilganda tepada «Internet yo'q» (turadi), qaytganda «Aloqa tiklandi» (2.5 s).
 * navigator.onLine + online/offline hodisalari; server DOM'iga tegmaydi (faqat montajdan keyin chiziladi).
 */
export function NetworkBanner() {
  const til = useLocale();
  const [net, setNet] = useState<Net>("online");
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) setNet("offline");
    let t = 0;
    const off = () => {
      window.clearTimeout(t);
      setNet("offline");
      document.documentElement.dataset.offline = "true";
    };
    const on = () => {
      delete document.documentElement.dataset.offline;
      setNet((s) => (s === "offline" ? "restored" : s));
      window.clearTimeout(t);
      t = window.setTimeout(() => setNet("online"), 2500);
    };
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, []);
  const { mounted, closing } = usePresence(net !== "online", 200);
  if (!mounted) return null;
  const offline = net === "offline";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[160] flex justify-center px-3" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
      <div
        role="status"
        className={cn(
          "pointer-events-auto flex h-10 max-w-[min(94vw,520px)] items-center gap-2 rounded-full border px-4 text-[13px] font-semibold shadow-[var(--shadow-2)]",
          offline ? "border-warning/40 bg-surface text-fg" : "border-success/40 bg-surface text-fg",
          closing ? "expand-out" : "expand-in",
        )}
      >
        {offline ? <WifiOff size={16} className="shrink-0 text-warning" aria-hidden /> : <Wifi size={16} className="shrink-0 text-success" aria-hidden />}
        <span className="truncate">{tr(til, offline ? SHELL.network.offline : SHELL.network.online)}</span>
      </div>
    </div>
  );
}
