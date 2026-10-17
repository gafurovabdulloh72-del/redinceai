"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
const KEY = "pwa-taklif-yopildi";

/** PWA o'rnatish taklifi: brauzer ruxsat berganda (beforeinstallprompt) kabinetda bir qatorlik karta; yopilsa 30 kun chiqmaydi */
export function InstallPrompt() {
  const [ev, setEv] = useState<BIPEvent | null>(null);
  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(KEY) || 0);
      if (until > Date.now()) return;
    } catch {
      /* ignore */
    }
    const on = (e: Event) => {
      e.preventDefault();
      setEv(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  if (!ev) return null;
  const dismiss = () => {
    setEv(null);
    try {
      localStorage.setItem(KEY, String(Date.now() + 30 * 86_400_000));
    } catch {
      /* ignore */
    }
  };
  return (
    <div role="status" className="mb-5 flex min-h-12 items-center gap-3 rounded-[16px] border border-line-2 bg-surface px-4 py-2.5 animate-slide-up">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-ink-fg">
        <Download size={15} />
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-fg">
        <strong className="font-bold">Ilova sifatida o&apos;rnating.</strong> <span className="text-fg-2">Bosh ekrandan bir bosishda ochiladi, tezroq ishlaydi.</span>
      </p>
      <button
        type="button"
        onClick={async () => {
          await ev.prompt();
          const r = await ev.userChoice;
          if (r.outcome === "accepted") setEv(null);
          else dismiss();
        }}
        className="btn-ink inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold"
      >
        O&apos;rnatish
      </button>
      <button type="button" aria-label="Yopish" onClick={dismiss} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 hover:bg-fg/6 hover:text-fg">
        <X size={15} />
      </button>
    </div>
  );
}
