"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Send, X } from "lucide-react";
import { showToast } from "@/components/ui/toast";

type Start = { code: string; link: string; expiresAt: number };
type Poll = { status: "pending" | "denied" | "expired" | "ok"; next?: string };

/**
 * «Telegram bilan kirish» (bot orqali): tugma bosilganda 6 xonali kod olinadi va bot ochiladi,
 * botda tasdiqlangach sayt o'zi kiradi. Login Widget ishlatilmaydi — BotFather'da domen
 * sozlash va CSP'ga tashqi skript qo'shish shart emas.
 */
export function TelegramLogin({ next }: { next?: string }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [start, setStart] = useState<Start | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    void fetch("/api/auth/telegram")
      .then((r) => r.json())
      .then((j: { data?: { enabled: boolean } }) => setEnabled(Boolean(j.data?.enabled)))
      .catch(() => undefined);
  }, []);

  const stop = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  // Qolgan vaqt
  useEffect(() => {
    if (!start) return;
    const t = window.setInterval(() => setLeft(Math.max(0, Math.round((start.expiresAt - Date.now()) / 1000))), 500);
    return () => window.clearInterval(t);
  }, [start]);

  async function begin() {
    setBusy(true);
    try {
      const r = await fetch("/api/auth/telegram", { method: "POST" });
      const j = (await r.json()) as { data?: Start; error?: string };
      if (!r.ok || !j.data) throw new Error(j.error || "Boshlanmadi");
      setStart(j.data);
      window.open(j.data.link, "_blank", "noopener,noreferrer");
      stop();
      timer.current = window.setInterval(() => void poll(), 2000);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Boshlanmadi", "error");
    } finally {
      setBusy(false);
    }
  }

  async function poll() {
    try {
      const r = await fetch("/api/auth/telegram", { method: "PUT" });
      const j = (await r.json()) as { data?: Poll; error?: string };
      const st = j.data?.status;
      if (st === "ok") {
        stop();
        showToast("Xush kelibsiz!", "success");
        router.replace(j.data?.next === "/kabinet" && next ? next : (j.data?.next ?? "/kabinet"));
        router.refresh();
        return;
      }
      if (st === "denied" || st === "expired") {
        stop();
        setStart(null);
        showToast(st === "denied" ? "Kirish rad etildi" : "Kod eskirdi — qayta urinib ko'ring", "info");
      }
    } catch {
      /* tarmoq — keyingi urinishda */
    }
  }

  if (!enabled) return null;

  if (start)
    return (
      <div className="card p-3.5 text-center">
        <p className="text-[12.5px] text-fg-3">Botda shu kodni tasdiqlang</p>
        <p className="mt-1 text-[26px] font-bold tracking-[0.18em] tabular-nums text-fg">{start.code}</p>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-[12.5px] text-fg-3">
          <Loader2 size={12} className="animate-spin" /> Kutilmoqda{left > 0 ? ` · ${left} s` : ""}
        </p>
        <div className="mt-2.5 flex justify-center gap-2">
          <a href={start.link} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[13px] font-semibold text-fg-2 hover:text-fg">
            <Send size={13} /> Botni ochish
          </a>
          <button
            type="button"
            onClick={() => {
              stop();
              setStart(null);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-fg-3 hover:text-fg"
          >
            <X size={13} /> Bekor
          </button>
        </div>
      </div>
    );

  return (
    <button type="button" onClick={() => void begin()} disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-line-2 text-[14px] font-semibold text-fg transition hover:bg-fg/4 disabled:opacity-60">
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} className="text-[#2aabee]" />}
      Telegram bilan kirish
      <Check size={0} aria-hidden />
    </button>
  );
}
