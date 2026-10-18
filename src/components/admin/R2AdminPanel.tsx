"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Database, RefreshCw, TriangleAlert } from "lucide-react";

type Backend = "r2" | "blob" | "disk" | "none";

interface StorageStatus {
  backend: Backend;
  onVercel: boolean;
  blobTokenSet: boolean;
  r2Missing: string[];
  bucket: string | null;
  endpointHost: string | null;
  publicBase: string | null;
  uploadOk?: boolean;
  uploadError?: string | null;
  publicOk?: boolean;
  publicError?: string | null;
  publicUrl?: string;
}

const BACKEND_LABEL: Record<Backend, string> = {
  r2: "Cloudflare R2 (arzon, trafik bepul)",
  blob: "Vercel Blob",
  disk: "Server diski (dev/VPS rejimi)",
  none: "SOZLANMAGAN — yuklash ishlamaydi",
};

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

/** R2 ulash qadamlar ro'yxati (ixtiyoriy, arzon variant) */
function R2Guide({ missing }: { missing: string[] }) {
  return (
    <details className="mt-4 rounded-[14px] border border-line px-4 py-3 text-[13px] leading-relaxed text-fg-2">
      <summary className="cursor-pointer font-semibold text-fg">Arzon variant: Cloudflare R2 ulash (ixtiyoriy)</summary>
      {missing.length > 0 && missing.length < 5 && (
        <p className="mt-2 rounded-[10px] bg-warning-soft px-3 py-1.5 text-[12.5px] text-warning-text">
          Yetishmayotgan: <code className="font-semibold">{missing.join(", ")}</code>
        </p>
      )}
      <ol className="mt-2 list-decimal space-y-1.5 pl-5">
        <li>
          dash.cloudflare.com → <strong>R2 Object Storage</strong> → Create bucket → <code className="rounded bg-fg/6 px-1 text-[12px]">kasbegalari-media</code> (birinchi marta karta so'raydi — 10 GB bepul).
        </li>
        <li>
          Bucket → <strong>Settings → Public Development URL → Enable</strong> → <code className="rounded bg-fg/6 px-1 text-[12px]">https://pub-….r2.dev</code> ni nusxalang.
        </li>
        <li>
          R2 → <strong>Manage API tokens → Create API token</strong> (Object Read &amp; Write, bucket: kasbegalari-media) → Access Key ID, Secret va endpoint'ni nusxalang.
        </li>
        <li>
          Vercel → Environment Variables (Production): <code className="rounded bg-fg/6 px-1 text-[12px]">R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_BASE</code> → Redeploy.
        </li>
        <li>Shu yerga qaytib «Sinab ko'rish»ni bosing.</li>
      </ol>
    </details>
  );
}

/**
 * Fayl saqlash kartasi: qaysi usul faolligini ko'rsatadi va "Sinab ko'rish" tugmasi
 * aynan shu usul orqali test fayl yuklab-o'qib, saqlash chindan ishlashini tasdiqlaydi.
 */
export function R2AdminPanel() {
  const [st, setSt] = useState<StorageStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/r2");
      const j = (await r.json()) as { ok: boolean; data?: StorageStatus };
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
      const j = (await r.json()) as { ok: boolean; data?: StorageStatus; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || "Sinab bo'lmadi");
      setSt(j.data ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sinab bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  if (!st)
    return (
      <div className="card p-5 sm:p-6" aria-busy="true" aria-label="Saqlash holati yuklanmoqda">
        <div className="flex items-center gap-2.5 py-2.5">
          <span className="h-4 w-4 shrink-0 rounded-full skeleton" />
          <span className="h-3.5 w-2/5 skeleton" />
        </div>
        <div className="mt-3 flex gap-3 border-t border-line pt-4">
          <span className="h-10 w-32 skeleton !rounded-full" />
          <span className="h-10 w-36 skeleton !rounded-full" />
        </div>
      </div>
    );

  const tested = st.uploadOk !== undefined;
  const broken = st.backend === "none";

  return (
    <div className="card p-5 sm:p-6">
      {broken ? (
        <div className="rounded-[14px] bg-danger-soft px-4 py-3">
          <p className="flex items-start gap-2 text-[14px] font-bold text-danger-text">
            <TriangleAlert size={17} className="mt-0.5 shrink-0" /> Hozir rasm/fayl yuklash ISHLAMAYDI — Vercel'da disk yozib bo'lmaydi.
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-fg">
            <strong>Eng oson yechim (3 bosish, hech narsa nusxalanmaydi):</strong> Vercel → loyiha → <strong>Storage</strong> tab → <strong>Create Database</strong> →{" "}
            <strong>Blob</strong> → Access tanlovida albatta <strong>Public</strong> ni belgilang (Private tanlansa yuklash ishlamaydi va keyin o'zgartirib bo'lmaydi) → Connect
            (loyihani tanlang) → keyin <strong>Deployments → ⋯ → Redeploy</strong>. Token avtomatik qo'shiladi.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          <Row ok label={`Faol usul: ${BACKEND_LABEL[st.backend]}`} detail={st.backend === "r2" ? `${st.bucket} · ${st.endpointHost}` : null} />
          {st.backend === "r2" && <Row ok label="Ommaviy manzil (R2_PUBLIC_BASE)" detail={st.publicBase} />}
          {tested && <Row ok={Boolean(st.uploadOk)} label={st.uploadOk ? "Yuklash ishlaydi" : "Yuklash xatosi"} detail={st.uploadError} />}
          {tested && (
            <Row
              ok={Boolean(st.publicOk)}
              label={st.publicOk ? "O'qish ishlaydi — saqlash to'liq tayyor ✓" : "Yuklangan faylni o'qib bo'lmadi"}
              detail={st.publicOk ? st.publicUrl : st.publicError}
            />
          )}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button type="button" disabled={busy || broken} onClick={selftest} className="btn-ink inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold disabled:opacity-50">
          <Database size={14} /> {busy ? "Tekshirilmoqda…" : "Sinab ko'rish"}
        </button>
        <button type="button" disabled={busy} onClick={() => void load()} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 transition hover:text-fg">
          <RefreshCw size={13} /> Holatni yangilash
        </button>
        {err && (
          <span role="alert" className="text-[13px] font-semibold text-danger-text">
            {err}
          </span>
        )}
      </div>

      {st.backend !== "r2" && <R2Guide missing={st.r2Missing} />}
    </div>
  );
}
