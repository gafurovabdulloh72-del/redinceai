"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, RefreshCw, Send, SendHorizontal, Unlink } from "lucide-react";
import { Badge, Button, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

/** Botda «Start» bosilishini kutish: 3 soniyada bir so'rov, ko'pi bilan 2 daqiqa */
const POLL_MS = 3000;
const POLL_MAX = 40;

/**
 * Telegram bildirishnomalari kartasi (Kabinet → Profil). Karta faqat bot sozlangan bo'lsa render qilinadi —
 * server sahifa process.env bo'yicha hal qiladi (telegramBotUsername / isTelegramEnabled).
 * Ulanmagan: «Telegramga ulash» → POST /api/telegram/link → t.me havolasi (popup bloklanmasligi uchun oyna bosish paytida sinxron ochiladi);
 * so'ng GET /api/telegram/link bilan holat 3 s'da bir so'raladi, ulangach sahifa yangilanadi. Ulangan: «Sinov xabari», «Uzish».
 */
export function TelegramCard({ linked }: { linked: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"link" | "unlink" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Havola ochildi — botda «Start» bosilishini kutyapmiz */
  const [waiting, setWaiting] = useState(false);
  const polls = useRef(0);

  // Kutish rejimida ulanish holatini so'rab turish — foydalanuvchi qo'lda «Tekshirish» bosmasa ham karta o'zi yangilanadi
  useEffect(() => {
    if (!waiting || linked) return;
    polls.current = 0;
    const id = window.setInterval(async () => {
      polls.current += 1;
      if (polls.current > POLL_MAX) {
        window.clearInterval(id);
        setWaiting(false);
        return;
      }
      try {
        const res = await fetch("/api/telegram/link", { cache: "no-store" });
        const json = (await res.json()) as ApiResponse<{ linked: boolean }>;
        if (json.ok && json.data.linked) {
          window.clearInterval(id);
          setWaiting(false);
          toast("Telegram ulandi");
          router.refresh();
        }
      } catch {
        /* keyingi urinishda */
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [waiting, linked, router, toast]);

  const connect = async () => {
    if (busy) return;
    setError(null);
    setBusy("link");
    // Popup bloklovchilar: oyna bosish hodisasi ichida (await'dan OLDIN) ochilishi shart
    const win = window.open("", "_blank", "noopener,noreferrer");
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const json = (await res.json()) as ApiResponse<{ url: string }>;
      if (!json.ok) {
        win?.close();
        setError(json.error);
        return;
      }
      if (win) win.location.href = json.data.url;
      else window.location.assign(json.data.url);
      setWaiting(true);
    } catch {
      win?.close();
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(null);
    }
  };

  const check = async () => {
    try {
      const res = await fetch("/api/telegram/link", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ linked: boolean }>;
      if (json.ok && json.data.linked) {
        toast("Telegram ulandi");
        router.refresh();
      } else toast("Hali ulanmagan — botda «Start» tugmasini bosing", "info");
    } catch {
      toast("Tekshirib bo'lmadi", "error");
    }
  };

  const unlink = async () => {
    if (busy) return;
    setError(null);
    setBusy("unlink");
    try {
      const res = await fetch("/api/telegram/unlink", { method: "POST" });
      const json = (await res.json()) as ApiResponse<{ unlinked: boolean }>;
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setWaiting(false);
      toast("Telegram uzildi");
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    if (busy) return;
    setError(null);
    setBusy("test");
    try {
      const res = await fetch("/api/telegram/test", { method: "POST" });
      const json = (await res.json()) as ApiResponse<{ sent: boolean }>;
      if (!json.ok) {
        setError(json.error);
        return;
      }
      toast("Sinov xabari yuborildi — Telegramni tekshiring");
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card scroll-mt-28 p-5 sm:p-6" id="telegram" aria-label="Telegram bildirishnomalari">
      <div className="flex items-start gap-3">
        <span className="btn-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]">
          <Send size={18} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[19px] font-semibold tracking-tight text-fg">Telegram</h2>
            {linked && (
              <Badge tone="success">
                <CheckCircle2 size={12} /> Ulangan
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-fg-3">{linked ? "Buyurtma, to'lov, takliflar va xabarlar botga ham keladi. Uzish — tugma yoki botda /stop." : "Hisobni botga ulang — muhim xabarlar Telegramga darhol keladi."}</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 inline-flex items-center gap-2 rounded-full bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-danger-text">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {linked ? (
          <>
            <Button type="button" variant="outline" onClick={sendTest} disabled={busy !== null}>
              {busy === "test" ? <Spinner /> : <SendHorizontal size={14} />} Sinov xabari
            </Button>
            <Button type="button" variant="ghost" onClick={unlink} disabled={busy !== null}>
              {busy === "unlink" ? <Spinner /> : <Unlink size={14} />} Uzish
            </Button>
          </>
        ) : (
          <>
            <Button type="button" onClick={connect} disabled={busy !== null}>
              {busy === "link" ? <Spinner /> : <ExternalLink size={14} />} Telegramga ulash
            </Button>
            {waiting && (
              <Button type="button" variant="outline" onClick={check} disabled={busy !== null} className="expand-in">
                <RefreshCw size={14} /> Tekshirish
              </Button>
            )}
          </>
        )}
      </div>
      {!linked && waiting && (
        <p className="expand-in mt-3 flex items-center gap-2 text-[12px] text-fg-4" role="status">
          <Spinner className="!h-3 !w-3" /> Botda «Start» bosilishini kutyapmiz — ulangach bu karta o&apos;zi yangilanadi. Havola 15 daqiqa amal qiladi.
        </p>
      )}
    </section>
  );
}
