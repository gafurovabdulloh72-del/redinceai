"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, ShieldAlert, ShieldX } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { cn, formatDateTime } from "@/lib/utils";

interface Hit {
  id: string;
  ip: string;
  kind: string;
  /** Brauzerda ochilgan havola yoki qidiruv boti — blokka sanalmaydi */
  soft?: boolean;
  method: string;
  path: string;
  userAgent: string;
  note: string;
  createdAt: number;
}
interface Blocked {
  ip: string;
  reason: string;
  hits: number;
  until: number | null;
  manual: boolean;
  createdAt: number;
}
interface Stats {
  recent: Hit[];
  topIps: Array<{ ip: string; n: number }>;
  blocked: Blocked[];
  total24h: number;
}

const KIND_LABEL: Record<string, string> = { scan: "Skaner", fakeLogin: "Soxta login", canary: "Canary 🚨", probe: "Hujum imzosi" };

/** Admin «Tizim» tabi: honeypot (tuzoq) — tuzoqqa tushgan urinishlar, eng faol IP'lar, bloklangan IP'lar. */
export function AdminHoneypot() {
  const confirm = useConfirm();
  const [data, setData] = useState<Stats | null>(null);
  const [ipInput, setIpInput] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/tuzoq");
      const j = (await r.json()) as { data?: Stats };
      setData(j.data ?? null);
    } catch {
      setData(null);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: "block" | "unblock", ip: string, reason?: string) {
    const res = await fetch("/api/admin/tuzoq", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ip, reason }) });
    if (!res.ok) return showToast("Bajarilmadi", "error");
    showToast(action === "block" ? "IP bloklandi" : "Blokdan chiqarildi", "success");
    void load();
  }

  async function blockManual() {
    const ip = ipInput.trim();
    if (ip.length < 3) return;
    if (!(await confirm({ title: "IP'ni bloklash?", text: `${ip} — barcha API so'rovlari 403 oladi (doimiy).`, confirmLabel: "Bloklash", danger: true }))) return;
    setIpInput("");
    await act("block", ip);
  }

  if (!data) return <p className="px-1 py-4 text-[13px] text-fg-3">Yuklanmoqda…</p>;

  return (
    <div className="space-y-4">
      {/* Qisqa ko'rsatkichlar */}
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-fg/6 px-3 py-1 font-semibold text-fg-2">
          <ShieldAlert size={14} /> 24 soatda {data.total24h} urinish
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1 font-semibold text-danger-text">
          <Ban size={14} /> {data.blocked.length} ta bloklangan IP
        </span>
      </div>

      {/* Qo'lda bloklash */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={ipInput} onChange={(e) => setIpInput(e.target.value)} placeholder="IP manzil (masalan 1.2.3.4)" className="field h-9 max-w-[220px] flex-1 text-[13px]" inputMode="numeric" />
        <button type="button" onClick={() => void blockManual()} disabled={ipInput.trim().length < 3} className="btn-ink h-9 rounded-full px-3 text-[12.5px] font-semibold disabled:opacity-40">
          <ShieldX size={14} /> Bloklash
        </button>
      </div>

      {/* Bloklangan IP'lar */}
      {data.blocked.length > 0 && (
        <div className="card overflow-hidden">
          <p className="border-b border-line px-3 py-2 text-[12.5px] font-semibold text-fg-2">Bloklangan IP'lar</p>
          <ul className="divide-y divide-line">
            {data.blocked.map((b) => (
              <li key={b.ip} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                <code className="font-mono text-[12px] text-fg">{b.ip}</code>
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold", b.manual ? "bg-ink text-bg" : "bg-warning-soft text-warning-text")}>{b.manual ? "qo'lda" : `${b.hits} urinish`}</span>
                <span className="min-w-0 flex-1 truncate text-fg-3" title={b.reason}>{b.reason}</span>
                <span className="shrink-0 text-fg-4">{b.until ? "muddatli" : "doimiy"}</span>
                <button type="button" onClick={() => void act("unblock", b.ip)} className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                  Chiqarish
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Eng faol IP'lar */}
      {data.topIps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.topIps.map((t) => (
            <span key={t.ip} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px]">
              <code className="font-mono text-fg">{t.ip}</code>
              <span className="text-fg-3">{t.n}×</span>
              {!data.blocked.some((b) => b.ip === t.ip) && (
                <button type="button" onClick={() => void act("block", t.ip, `Eng faol skaner (${t.n} urinish)`)} className="text-danger-text hover:underline" title="Bloklash">
                  <Ban size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* So'nggi urinishlar */}
      <div className="card overflow-hidden">
        <p className="border-b border-line px-3 py-2 text-[12.5px] font-semibold text-fg-2">So'nggi urinishlar</p>
        {data.recent.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-fg-3">Hali urinish yo'q — tuzoq jim turibdi.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.recent.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-[12px]">
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold", h.kind === "canary" ? "bg-danger-soft text-danger-text" : h.kind === "fakeLogin" || h.kind === "probe" ? "bg-warning-soft text-warning-text" : "bg-fg/6 text-fg-2")}>{KIND_LABEL[h.kind] ?? h.kind}</span>
                {h.soft && (
                  <span className="rounded-full border border-line px-1.5 py-0.5 text-[10.5px] font-medium text-fg-3" title="Brauzerda ochilgan havola yoki qidiruv boti — kimdir aldab yuborgan bo'lishi mumkin, shuning uchun blokka sanalmaydi">
                    yumshoq
                  </span>
                )}
                <code className="font-mono text-[11.5px] text-fg">{h.ip}</code>
                <span className="font-mono text-fg-2">{h.method}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-fg-3" title={h.path}>{h.path}</span>
                {h.note && <span className="truncate text-coral" title={h.note}>{h.note}</span>}
                <span className="shrink-0 text-fg-4">{formatDateTime(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
