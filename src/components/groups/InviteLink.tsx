"use client";

import { useState } from "react";
import { Link2, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { INVITE_EXPIRY_OPTIONS, INVITE_USES_OPTIONS } from "@/lib/groups/limits";
import { formatDateTime } from "@/lib/utils";

type Info = { expiresAt: number | null; maxUses: number | null; uses: number } | null;
type Resp = { ok: boolean; data?: { code: string; path: string; expiresAt: number | null; maxUses: number | null; uses: number }; error?: string };

/**
 * Boshqaruvchi uchun taklif havolasi: nusxalaydi; ↻ — eskisini bekor qilib yangisini beradi (hisob 0 dan).
 * `options` — muddat (24 soat / 7 kun / cheksiz) va limit (10 / 50 / cheksiz); ishlatilgan soni ko'rinadi.
 */
export function InviteLink({ slug, initialCode, initialInfo = null, options = false }: { slug: string; initialCode: string | null; initialInfo?: Info; options?: boolean }) {
  const { toast } = useToast();
  const [code, setCode] = useState(initialCode);
  const [info, setInfo] = useState<Info>(initialInfo);
  const [busy, setBusy] = useState(false);

  async function post(body: Record<string, unknown>, copy: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(slug)}/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json()) as Resp;
      if (!j.ok || !j.data) throw new Error(j.error || "Bo'lmadi");
      setCode(j.data.code);
      setInfo({ expiresAt: j.data.expiresAt, maxUses: j.data.maxUses, uses: j.data.uses });
      if (copy) {
        const url = `${window.location.origin}${j.data.path}`;
        try {
          await navigator.clipboard.writeText(url);
          toast(body.rotate ? "Yangi havola nusxalandi — eskisi bekor" : "Taklif havolasi nusxalandi");
        } catch {
          toast(url, "info");
        }
      } else toast("Saqlandi", "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    } finally {
      setBusy(false);
    }
  }

  const expired = Boolean(info?.expiresAt && info.expiresAt < Date.now());
  const exhausted = Boolean(info && info.maxUses !== null && info.uses >= info.maxUses);
  const expiryKey = !info?.expiresAt ? "never" : info.expiresAt - Date.now() > 2 * 24 * 60 * 60 * 1000 ? "7d" : "1d";

  return (
    <div className="grid gap-3">
      <span className="inline-flex items-center gap-1">
        <button type="button" onClick={() => void post({}, true)} disabled={busy} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[14px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50">
          <Link2 size={15} /> {code ? "Havolani nusxalash" : "Havola yaratish"}
        </button>
        {code && (
          <button type="button" onClick={() => void post({ rotate: true }, true)} disabled={busy} aria-label="Havolani yangilash (eskisi bekor bo'ladi)" title="Yangilash — eski havola ishlamay qoladi" className="flex h-11 w-11 items-center justify-center rounded-full border border-line-2 text-fg-3 transition hover:text-fg disabled:opacity-50">
            <RefreshCw size={15} />
          </button>
        )}
      </span>
      {options && code && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-[12px] font-semibold text-fg-3">
            Amal qilish muddati
            <select value={expiryKey} onChange={(e) => void post({ expiresIn: e.target.value }, false)} disabled={busy} className="field h-10 text-[13.5px] font-normal text-fg">
              {INVITE_EXPIRY_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[12px] font-semibold text-fg-3">
            Necha marta ishlaydi
            <select value={info?.maxUses === null || info?.maxUses === undefined ? "" : String(info.maxUses)} onChange={(e) => void post({ maxUses: e.target.value ? Number(e.target.value) : null }, false)} disabled={busy} className="field h-10 text-[13.5px] font-normal text-fg">
              {INVITE_USES_OPTIONS.map((n) => (
                <option key={String(n)} value={n === null ? "" : String(n)}>
                  {n === null ? "Cheksiz" : `${n} marta`}
                </option>
              ))}
            </select>
          </label>
          <p className={`text-[12.5px] sm:col-span-2 ${expired || exhausted ? "font-semibold text-danger-text" : "text-fg-3"}`} role="status">
            {expired ? "Muddati tugagan — yangilang" : exhausted ? "Limit tugagan — yangilang yoki limitni oshiring" : `Ishlatilgan: ${info?.uses ?? 0}${info?.maxUses ? ` / ${info.maxUses}` : ""}${info?.expiresAt ? ` · ${formatDateTime(info.expiresAt)} gacha` : ""}`}
          </p>
        </div>
      )}
    </div>
  );
}
