"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, ExternalLink, FileText, Film, ImageIcon, Music, RefreshCw, TriangleAlert } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface R2File {
  key: string;
  size: number;
  lastModified: number;
  url: string;
}
interface Usage {
  totalBytes: number;
  count: number;
  byPrefix: Array<{ prefix: string; bytes: number; count: number }>;
  recent: R2File[];
  truncated: boolean;
  scannedAt: number;
  dashboardUrl: string | null;
  devUrl: boolean;
  freeBytes: number;
}
interface Data {
  usage: Usage | null;
  db: { bytes: number | null; dashboardUrl: string | null };
}

const KIND_RE = {
  video: /\.(?:mp4|webm|mov|m4v)$/i,
  image: /\.(?:jpe?g|png|webp|gif|avif|svg)$/i,
  audio: /\.(?:mp3|m4a|ogg|weba|wav)$/i,
};
type Kind = "all" | keyof typeof KIND_RE | "other";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function kindOf(key: string): Exclude<Kind, "all"> {
  if (KIND_RE.video.test(key)) return "video";
  if (KIND_RE.image.test(key)) return "image";
  if (KIND_RE.audio.test(key)) return "audio";
  return "other";
}

const KIND_ICON = { video: Film, image: ImageIcon, audio: Music, other: FileText } as const;
const KIND_LABEL: Record<Kind, string> = { all: "Hammasi", video: "Video", image: "Rasm", audio: "Audio", other: "Boshqa" };

/** Saqlash hisobi: R2 hajmi, papkalar, so'nggi fayllar va Cloudflare/Turso panellariga havolalar */
export function StorageUsagePanel() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [prefix, setPrefix] = useState("all");
  const [kind, setKind] = useState<Kind>("all");
  const [shown, setShown] = useState(30);

  const load = useCallback(async (force = false) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/r2/hisob${force ? "?force=1" : ""}`);
      const j = (await r.json()) as { ok: boolean; data?: Data; error?: string };
      if (!j.ok || !j.data) throw new Error(j.error ?? "Yuklab bo'lmadi");
      setData(j.data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const files = useMemo(() => {
    const list = data?.usage?.recent ?? [];
    return list.filter((f) => (prefix === "all" || f.key.startsWith(`${prefix}/`) || (prefix === "(ildiz)" && !f.key.includes("/"))) && (kind === "all" || kindOf(f.key) === kind));
  }, [data, prefix, kind]);

  const u = data?.usage;
  const pct = u ? Math.min(100, (u.totalBytes / u.freeBytes) * 100) : 0;

  return (
    <div className="card mt-4 p-5 sm:p-6" id="saqlash-hisobi">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-fg">Saqlash hisobi</h3>
        <div className="flex flex-wrap gap-2">
          {u?.dashboardUrl && (
            <a href={u.dashboardUrl} target="_blank" rel="noreferrer noopener" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-fg-2 hover:text-fg">
              Cloudflare'da fayllar <ExternalLink size={12} />
            </a>
          )}
          {data?.db.dashboardUrl && (
            <a href={data.db.dashboardUrl} target="_blank" rel="noreferrer noopener" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-fg-2 hover:text-fg">
              Baza (Turso) <ExternalLink size={12} />
            </a>
          )}
          <button type="button" disabled={busy} onClick={() => void load(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-fg-2 hover:text-fg disabled:opacity-50">
            <RefreshCw size={12} className={busy ? "animate-spin" : ""} /> Qayta hisoblash
          </button>
        </div>
      </div>

      {err && <p role="alert" className="mt-3 text-[13px] font-semibold text-danger-text">{err}</p>}
      {!data && !err && <div className="mt-4 h-24 skeleton" aria-busy="true" />}

      {data && !u && <p className="mt-3 text-[13px] text-fg-3">Fayl hisobi faqat Cloudflare R2 ulanganida ko'rsatiladi.</p>}

      {u?.devUrl && (
        <div className="mt-4 rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] leading-relaxed text-fg">
          <p className="flex items-start gap-2 font-bold text-warning-text">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" /> Videolar sekin ochiladi: fayllar «r2.dev» sinov manzilidan berilyapti
          </p>
          <p className="mt-1.5">
            Cloudflare bu manzilni faqat sinov uchun beradi — tezligi cheklangan va keshlanmaydi. Tezlatish uchun bucket'ga o'z domeningizni ulang (bepul):
          </p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5">
            <li>Domeningiz Cloudflare'da bo'lishi kerak (masalan kasbegalari.uz — DNS Cloudflare'ga ko'chiriladi).</li>
            <li>R2 → bucket → <strong>Settings → Custom Domains → Connect Domain</strong> → <code className="rounded bg-fg/6 px-1">media.kasbegalari.uz</code>.</li>
            <li>Vercel → Environment Variables → <code className="rounded bg-fg/6 px-1">R2_PUBLIC_BASE=https://media.kasbegalari.uz</code> → Redeploy.</li>
            <li>Eski fayllar ham yangi manzilda ochiladi; bazadagi eski havolalar r2.dev'da ishlashda davom etadi.</li>
          </ol>
        </div>
      )}

      {u && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[14px] border border-line px-4 py-3">
              <p className="text-[12px] text-fg-3">Fayllar (R2)</p>
              <p className="text-[20px] font-bold tabular-nums text-fg">
                {u.truncated ? "≥ " : ""}
                {fmtBytes(u.totalBytes)}
              </p>
              <p className="text-[12px] text-fg-3">{u.count.toLocaleString("ru-RU")} ta fayl</p>
            </div>
            <div className="rounded-[14px] border border-line px-4 py-3">
              <p className="text-[12px] text-fg-3">Bepul chegara (10 GB)</p>
              <p className="text-[20px] font-bold tabular-nums text-fg">{pct.toFixed(1)}%</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fg/8">
                <div className={pct >= 90 ? "h-full bg-danger" : pct >= 70 ? "h-full bg-warning" : "h-full bg-success"} style={{ width: `${Math.max(2, pct)}%` }} />
              </div>
            </div>
            <div className="rounded-[14px] border border-line px-4 py-3">
              <p className="flex items-center gap-1 text-[12px] text-fg-3">
                <Database size={12} /> Ma'lumotlar bazasi
              </p>
              <p className="text-[20px] font-bold tabular-nums text-fg">{data?.db.bytes ? fmtBytes(data.db.bytes) : "—"}</p>
              <p className="text-[12px] text-fg-3">Hisoblandi: {formatDateTime(u.scannedAt)}</p>
            </div>
          </div>

          {u.byPrefix.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setPrefix("all")} className="chip" data-active={prefix === "all"}>
                Hammasi
              </button>
              {u.byPrefix.map((p) => (
                <button key={p.prefix} type="button" onClick={() => setPrefix(p.prefix)} className="chip" data-active={prefix === p.prefix}>
                  {p.prefix} · {fmtBytes(p.bytes)} · {p.count}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-fg">So'nggi yuklanganlar</p>
            <div className="segment" role="radiogroup" aria-label="Fayl turi">
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} data-active={kind === k} className="segment-item" onClick={() => setKind(k)}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-2 divide-y divide-line rounded-[14px] border border-line">
            {files.slice(0, shown).map((f) => {
              const k = kindOf(f.key);
              const Icon = KIND_ICON[k];
              return (
                <li key={f.key} className="flex items-center gap-3 px-3 py-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-fg/6 text-fg-3">
                    {k === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <Icon size={16} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12px] text-fg" title={f.key}>
                      {f.key}
                    </p>
                    <p className="text-[11.5px] text-fg-3">
                      {fmtBytes(f.size)} · {formatDateTime(f.lastModified)}
                    </p>
                  </div>
                  <a href={f.url} target="_blank" rel="noreferrer noopener" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-line-2 px-3 text-[12px] font-semibold text-fg-2 hover:text-fg">
                    Ochish <ExternalLink size={11} />
                  </a>
                </li>
              );
            })}
            {files.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-fg-3">Fayl topilmadi</li>}
          </ul>
          {files.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + 30)} className="mt-2 inline-flex h-9 items-center rounded-full border border-line-2 px-4 text-[12.5px] font-semibold text-fg-2 hover:text-fg">
              Yana ko'rsatish ({files.length - shown})
            </button>
          )}
          <p className="mt-2 text-[11.5px] text-fg-4">Bu yerda eng yangi 300 ta fayl. Hammasini Cloudflare panelida ko'rasiz.</p>
        </>
      )}
    </div>
  );
}
