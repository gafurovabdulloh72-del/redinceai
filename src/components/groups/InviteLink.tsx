"use client";

import { useState } from "react";
import { Link2, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/** Boshqaruvchi uchun taklif havolasi: nusxalaydi; ↻ — eski havolani bekor qilib yangisini beradi */
export function InviteLink({ slug, initialCode }: { slug: string; initialCode: string | null }) {
  const { toast } = useToast();
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);

  async function get(rotate: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(slug)}/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rotate }) });
      const j = (await res.json()) as { ok: boolean; data?: { code: string; path: string }; error?: string };
      if (!j.ok || !j.data) throw new Error(j.error || "Bo'lmadi");
      setCode(j.data.code);
      const url = `${window.location.origin}${j.data.path}`;
      try {
        await navigator.clipboard.writeText(url);
        toast(rotate ? "Yangi taklif havolasi nusxalandi — eskisi bekor" : "Taklif havolasi nusxalandi");
      } catch {
        toast(url, "info");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={() => void get(false)} disabled={busy} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[14px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50">
        <Link2 size={15} /> Taklif havolasi
      </button>
      {code && (
        <button type="button" onClick={() => void get(true)} disabled={busy} aria-label="Taklif havolasini yangilash (eskisi bekor bo'ladi)" title="Yangilash — eski havola ishlamay qoladi" className="flex h-11 w-11 items-center justify-center rounded-full border border-line-2 text-fg-3 transition hover:text-fg disabled:opacity-50">
          <RefreshCw size={15} />
        </button>
      )}
    </span>
  );
}
