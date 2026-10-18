"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Clock3, Database, HardDrive, Mail, RefreshCw, Send, Users } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

/** Admin: tizim holati — DB kechikishi, saqlash, cron, rate-limit, Telegram/email, faol sessiyalar (GET /api/admin/health) */
interface Health {
  ts: number;
  db: { ok: boolean; ms: number };
  storage: { backend: "r2" | "blob" | "disk" | "none"; onVercel: boolean };
  cron: { lastRunAt: number | null; errors: number; stale: boolean };
  rateLimit: { active: number; top: Array<{ prefix: string; keys: number; hits: number }> };
  telegram: { enabled: boolean; username: string | null };
  email: { configured: boolean };
  sessions: { active: number };
  users: { total: number };
}
const BACKEND: Record<Health["storage"]["backend"], string> = { r2: "Cloudflare R2", blob: "Vercel Blob", disk: "Server diski", none: "Sozlanmagan" };

function Metric({ icon: Icon, label, value, hint, tone = "neutral" }: { icon: typeof Database; label: string; value: string; hint?: string; tone?: "neutral" | "ok" | "warn" | "bad" }) {
  return (
    <div className="min-w-0 rounded-[var(--r-sm)] border border-line px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-fg-3">
        <Icon size={13} className="shrink-0 text-fg-4" aria-hidden="true" /> {label}
      </p>
      <p className={cn("mt-1 flex items-center gap-1.5 text-[15px] font-semibold tabular-nums", tone === "ok" ? "text-success-text" : tone === "warn" ? "text-warning-text" : tone === "bad" ? "text-danger-text" : "text-fg")}>
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone === "ok" ? "bg-success" : tone === "warn" ? "bg-warning" : tone === "bad" ? "bg-danger" : "bg-line-2")} />
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-[11.5px] text-fg-4">{hint}</p>}
    </div>
  );
}

export function AdminHealthCard() {
  const [h, setH] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/health", { cache: "no-store" });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error ?? "Yuklab bo'lmadi");
      setH(j.data as Health);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tarmoq xatosi");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-fg-3" aria-live="polite">
          {h ? (
            <>
              Yangilandi <time dateTime={new Date(h.ts).toISOString()} suppressHydrationWarning>{timeAgo(h.ts)}</time>
            </>
          ) : (
            "Holat yuklanmoqda…"
          )}
        </p>
        <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[12px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50" aria-label="Holatni yangilash">
          <RefreshCw size={13} className={cn(busy && "animate-spin")} /> Yangilash
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-[12px] bg-danger-soft px-3 py-2 text-[12.5px] font-medium text-danger-text">
          {error}
        </p>
      )}
      {!h ? (
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[74px] skeleton !rounded-[var(--r-sm)]" />
          ))}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metric icon={Database} label="Baza" value={h.db.ok ? `${h.db.ms} ms` : "Javob yo'q"} hint={h.db.ok ? (h.db.ms > 300 ? "Sekin — Turso hududini tekshiring" : "select 1") : "Ulanish xatosi"} tone={!h.db.ok ? "bad" : h.db.ms > 300 ? "warn" : "ok"} />
          <Metric icon={HardDrive} label="Fayl saqlash" value={BACKEND[h.storage.backend]} hint={h.storage.backend === "none" ? "Yuklash ishlamaydi" : h.storage.onVercel ? "Vercel" : "Lokal/VPS"} tone={h.storage.backend === "none" ? "bad" : "ok"} />
          <Metric icon={Clock3} label="Kunlik cron" value={h.cron.lastRunAt ? timeAgo(h.cron.lastRunAt) : "Hali ishlamagan"} hint={h.cron.errors ? `${h.cron.errors} ta xato (audit)` : h.cron.stale ? "36 soatdan ko'p o'tdi" : "Xatosiz"} tone={!h.cron.lastRunAt || h.cron.stale ? "warn" : h.cron.errors ? "warn" : "ok"} />
          <Metric icon={Activity} label="Rate-limit" value={`${h.rateLimit.active} faol kalit`} hint={h.rateLimit.top.length ? h.rateLimit.top.map((t) => `${t.prefix} ${t.keys}`).join(" · ") : "Bosim yo'q"} tone={h.rateLimit.active > 200 ? "warn" : "neutral"} />
          <Metric icon={Send} label="Telegram bot" value={h.telegram.enabled ? (h.telegram.username ? `@${h.telegram.username}` : "Yoqilgan") : "O'chiq"} tone={h.telegram.enabled ? "ok" : "neutral"} />
          <Metric icon={Mail} label="Email (Resend)" value={h.email.configured ? "Sozlangan" : "Sozlanmagan"} tone={h.email.configured ? "ok" : "neutral"} />
          <Metric icon={Users} label="Faol sessiyalar" value={String(h.sessions.active)} hint={`${h.users.total} ta foydalanuvchi`} />
          <Metric icon={Activity} label="Health endpoint" value="/api/health" hint="Railway/Vercel tekshiruvi" tone="neutral" />
        </div>
      )}
    </div>
  );
}
