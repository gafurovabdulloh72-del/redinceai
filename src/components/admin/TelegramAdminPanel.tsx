"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, RefreshCw, Send } from "lucide-react";

interface TgStatus {
  tokenSet: boolean;
  tokenValid: boolean;
  botUsername: string | null;
  usernameEnv: string | null;
  expectedUrl: string;
  webhookUrl: string | null;
  webhookOk: boolean;
  pendingUpdates: number | null;
  lastError: string | null;
  secretSource: "env" | "auto";
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail?: string | null }) {
  return (
    <li className="flex min-h-10 items-start gap-2.5 py-2">
      {ok ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success-text" /> : <CircleAlert size={17} className="mt-0.5 shrink-0 text-warning-text" />}
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-fg">{label}</p>
        {detail && <p className="break-all text-[12px] leading-snug text-fg-3" dir="ltr">{detail}</p>}
      </div>
    </li>
  );
}

/**
 * Telegram bot sozlash kartasi: token/webhook holatini ko'rsatadi, webhook'ni bitta tugmada
 * o'rnatadi (server o'zi setWebhook chaqiradi — qo'lda curl/maxfiy kalit shart emas).
 */
export function TelegramAdminPanel() {
  const [st, setSt] = useState<TgStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/telegram");
      const j = (await r.json()) as { ok: boolean; data?: TgStatus };
      if (j.ok && j.data) setSt(j.data);
    } catch {
      /* tarmoq xatosi — karta holatsiz qoladi */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function setWebhook() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/telegram", { method: "POST" });
      const j = (await r.json()) as { ok: boolean; data?: TgStatus; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || "O'rnatib bo'lmadi");
      setSt(j.data ?? null);
      setMsg("Webhook o'rnatildi — bot tayyor ✓");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "O'rnatib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  if (!st) {
    return <div className="card p-5 text-[13px] text-fg-3">Telegram holati yuklanmoqda…</div>;
  }

  return (
    <div className="card p-5 sm:p-6">
      {!st.tokenSet ? (
        <div className="text-[13.5px] leading-relaxed text-fg-2">
          <p className="font-semibold text-fg">Bot hali ulanmagan — 3 qadam:</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              Vercel → Settings → Environment Variables (Production): <code className="rounded bg-fg/6 px-1.5 py-0.5 text-[12px]">TELEGRAM_BOT_TOKEN</code> (BotFather bergan token) va{" "}
              <code className="rounded bg-fg/6 px-1.5 py-0.5 text-[12px]">TELEGRAM_BOT_USERNAME</code> (@belgisisiz).
            </li>
            <li>Deployments → so'nggi deploy → ⋯ → Redeploy.</li>
            <li>Shu sahifaga qaytib «Webhookni o'rnatish» tugmasini bosing — bo'ldi.</li>
          </ol>
          <p className="mt-2 text-[12px] text-fg-3">Maxfiy kalit (webhook secret) avtomatik — alohida sozlash shart emas.</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line">
            <Row ok={st.tokenValid} label={st.tokenValid ? `Token to'g'ri — @${st.botUsername}` : "Token noto'g'ri yoki Telegram'ga ulanib bo'lmadi"} />
            <Row
              ok={Boolean(st.usernameEnv) && (!st.botUsername || st.usernameEnv === st.botUsername)}
              label={st.usernameEnv ? `TELEGRAM_BOT_USERNAME: @${st.usernameEnv}` : "TELEGRAM_BOT_USERNAME sozlanmagan — kabinetdagi «Ulash» tugmasi ishlamaydi"}
              detail={st.botUsername && st.usernameEnv && st.usernameEnv !== st.botUsername ? `Botning haqiqiy username'i: @${st.botUsername} — env'ni shunga moslang` : null}
            />
            <Row
              ok={st.webhookOk}
              label={st.webhookOk ? "Webhook o'rnatilgan" : st.webhookUrl ? "Webhook boshqa manzilga qarab turibdi" : "Webhook hali o'rnatilmagan"}
              detail={st.webhookOk ? st.webhookUrl : `Kerakli manzil: ${st.expectedUrl}${st.webhookUrl ? ` · hozirgisi: ${st.webhookUrl}` : ""}`}
            />
            {st.lastError && <Row ok={false} label="Oxirgi webhook xatosi" detail={st.lastError} />}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button type="button" disabled={busy || !st.tokenValid} onClick={setWebhook} className="btn-ink inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold disabled:opacity-50">
              <Send size={14} /> {busy ? "O'rnatilmoqda…" : st.webhookOk ? "Webhookni yangilash" : "Webhookni o'rnatish"}
            </button>
            <button type="button" disabled={busy} onClick={() => void load()} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 transition hover:text-fg">
              <RefreshCw size={13} /> Holatni yangilash
            </button>
            {msg && <span className="text-[13px] font-semibold text-success-text">{msg}</span>}
            {err && <span className="text-[13px] font-semibold text-danger-text">{err}</span>}
          </div>
        </>
      )}
    </div>
  );
}
