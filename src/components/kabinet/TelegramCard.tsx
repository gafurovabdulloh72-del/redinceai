"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, RefreshCw, Send, Unlink } from "lucide-react";
import { Badge, Button, Spinner } from "@/components/ui";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Telegram bildirishnomalari kartasi (Kabinet → Profil). Karta faqat bot sozlangan bo'lsa render qilinadi —
 * server sahifa process.env bo'yicha hal qiladi (telegramBotUsername / isTelegramEnabled).
 * Ulanmagan: «Telegramga ulash» → POST /api/telegram/link → t.me havolasi yangi oynada ochiladi;
 * foydalanuvchi botda «Start» bosgach «Tekshirish» sahifani yangilaydi. Ulangan: «Ulangan ✓» + «Uzish».
 */
export function TelegramCard({ linked }: { linked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Havola ochildi — botda «Start» bosilishini kutyapmiz */
  const [waiting, setWaiting] = useState(false);

  const connect = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const json = (await res.json()) as ApiResponse<{ url: string }>;
      if (!json.ok) {
        setError(json.error);
        return;
      }
      window.open(json.data.url, "_blank", "noopener,noreferrer");
      setWaiting(true);
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/unlink", { method: "POST" });
      const json = (await res.json()) as ApiResponse<{ unlinked: boolean }>;
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setWaiting(false);
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card scroll-mt-28 p-5 sm:p-7" id="telegram" aria-label="Telegram bildirishnomalari">
      <div className="flex items-start gap-3">
        <span className="btn-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
          <Send size={20} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[20px] font-semibold tracking-tight text-fg">Telegram bildirishnomalari</h2>
            {linked && (
              <Badge tone="success">
                <CheckCircle2 size={12} /> Ulangan ✓
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-fg-3">
            {linked
              ? "Buyurtma, to'lov, takliflar va yangi xabarlar Telegram botga ham keladi. Uzish uchun tugmani bosing yoki botda /stop yozing."
              : "Hisobingizni Telegram botga ulang — buyurtma, to'lov va xabarlar haqida darhol xabar olasiz."}
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 inline-flex items-center gap-2 rounded-full bg-ios-red/12 px-3.5 py-2 text-[13px] font-medium text-ios-red">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {linked ? (
          <Button type="button" variant="outline" onClick={unlink} disabled={busy}>
            {busy ? <Spinner /> : <Unlink size={14} />} Uzish
          </Button>
        ) : (
          <>
            <Button type="button" onClick={connect} disabled={busy}>
              {busy ? <Spinner /> : <ExternalLink size={14} />} Telegramga ulash
            </Button>
            {waiting && (
              <Button type="button" variant="outline" onClick={() => router.refresh()} disabled={busy}>
                <RefreshCw size={14} /> Tekshirish
              </Button>
            )}
          </>
        )}
      </div>
      {!linked && waiting && <p className="mt-3 text-[12px] text-fg-4">Telegram'da ochilgan botda «Start» tugmasini bosing, so'ng bu yerda «Tekshirish»ni bosing. Havola 15 daqiqa amal qiladi.</p>}
    </section>
  );
}
