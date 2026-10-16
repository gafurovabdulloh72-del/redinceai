"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Database, RefreshCw } from "lucide-react";

interface R2Status {
  enabled: boolean;
  missing: string[];
  bucket: string | null;
  endpointHost: string | null;
  publicBase: string | null;
  uploadOk?: boolean;
  uploadError?: string | null;
  publicOk?: boolean;
  publicError?: string | null;
  publicUrl?: string;
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
 * R2 saqlash kartasi: sozlanmagan bo'lsa — qadam-baqadam ko'rsatma; sozlangan bo'lsa —
 * "Sinab ko'rish" tugmasi butun zanjirni (kalitlar → yuklash → ommaviy o'qish) tekshiradi.
 */
export function R2AdminPanel() {
  const [st, setSt] = useState<R2Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/r2");
      const j = (await r.json()) as { ok: boolean; data?: R2Status };
      if (j.ok && j.data) setSt(j.data);
    } catch {
      /* tarmoq xatosi — karta holatsiz qoladi */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function selftest() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/r2", { method: "POST" });
      const j = (await r.json()) as { ok: boolean; data?: R2Status; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || "Sinab bo'lmadi");
      setSt(j.data ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sinab bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  if (!st) return <div className="card p-5 text-[13px] text-fg-3">R2 holati yuklanmoqda…</div>;

  if (!st.enabled) {
    return (
      <div className="card p-5 text-[13.5px] leading-relaxed text-fg-2 sm:p-6">
        <p className="font-semibold text-fg">R2 hali ulanmagan — sayt fayllarni hozirgi usulda saqlashda davom etyapti (hech narsa buzilmagan).</p>
        {st.missing.length > 0 && st.missing.length < 5 && (
          <p className="mt-2 rounded-[12px] bg-warning-soft px-3 py-2 text-[13px] text-warning-text">
            Yetishmayotgan qiymatlar: <code className="font-semibold">{st.missing.join(", ")}</code> — Vercel'ga qo'shib redeploy qiling.
          </p>
        )}
        <p className="mt-3 font-semibold text-fg">Ulash qadamlari (Cloudflare → dash.cloudflare.com):</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>
            <strong>R2 Object Storage</strong> → Create bucket → nomi <code className="rounded bg-fg/6 px-1.5 py-0.5 text-[12px]">kasbegalari-media</code> (birinchi marta karta so'raydi — 10 GB gacha bepul).
          </li>
          <li>
            Bucket → <strong>Settings → Public Development URL → Enable</strong> → berilgan <code className="rounded bg-fg/6 px-1.5 py-0.5 text-[12px]">https://pub-….r2.dev</code> manzilini nusxalang.
          </li>
          <li>
            R2 bosh sahifasi → <strong>Manage API tokens → Create API token</strong> → ruxsat: Object Read &amp; Write, bucket: kasbegalari-media → yaratilganda ko'rsatiladigan{" "}
            <strong>Access Key ID</strong>, <strong>Secret Access Key</strong> va <strong>endpoint</strong>ni nusxalang (Secret faqat bir marta ko'rinadi).
          </li>
          <li>
            Vercel → Settings → Environment Variables (Production) → 5 ta qiymat:{" "}
            <code className="rounded bg-fg/6 px-1.5 py-0.5 text-[12px]">R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_BASE</code> → Redeploy.
          </li>
          <li>Shu sahifaga qaytib «Sinab ko'rish» tugmasini bosing — karta hammasini o'zi tekshiradi.</li>
        </ol>
      </div>
    );
  }

  const tested = st.uploadOk !== undefined;
  return (
    <div className="card p-5 sm:p-6">
      <ul className="divide-y divide-line">
        <Row ok label={`Kalitlar sozlangan — bucket: ${st.bucket}`} detail={st.endpointHost} />
        <Row ok label="Ommaviy manzil (R2_PUBLIC_BASE)" detail={st.publicBase} />
        {tested && <Row ok={Boolean(st.uploadOk)} label={st.uploadOk ? "Yuklash ishlaydi (S3 PUT)" : "Yuklash xatosi"} detail={st.uploadError} />}
        {tested && (
          <Row
            ok={Boolean(st.publicOk)}
            label={st.publicOk ? "Ommaviy o'qish ishlaydi — R2 to'liq tayyor ✓" : "Ommaviy o'qish ishlamadi"}
            detail={st.publicOk ? st.publicUrl : st.publicError}
          />
        )}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button type="button" disabled={busy} onClick={selftest} className="btn-ink inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold disabled:opacity-50">
          <Database size={14} /> {busy ? "Tekshirilmoqda…" : "Sinab ko'rish"}
        </button>
        <button type="button" disabled={busy} onClick={() => void load()} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 transition hover:text-fg">
          <RefreshCw size={13} /> Holatni yangilash
        </button>
        {err && <span className="text-[13px] font-semibold text-danger-text">{err}</span>}
      </div>
    </div>
  );
}
