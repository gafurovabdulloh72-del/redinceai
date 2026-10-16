"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Spinner } from "@/components/ui";

/**
 * O'tkazma cheki (skrinshot) biriktirish — ixtiyoriy, lekin admin tasdiqlashini tezlashtiradi.
 * Rasm /api/upload orqali yuklanadi, URL ota-komponentga qaytadi («To'ladim» so'rovi bilan ketadi).
 */
export function ReceiptUpload({ value, onChange, disabled }: { value: string; onChange: (url: string) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const j = (await res.json().catch(() => null)) as { ok: boolean; data?: { url: string }; error?: string } | null;
      if (!j?.ok || !j.data?.url) throw new Error(j?.error || "Yuklab bo'lmadi");
      onChange(j.data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yuklab bo'lmadi");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-[14px] border border-line bg-surface-2 px-3 py-2.5">
          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[8px] bg-fg/6">
            <Image src={value} alt="O'tkazma cheki" fill sizes="40px" className="object-cover" unoptimized />
          </span>
          <span className="min-w-0 flex-1 text-[13px] font-semibold text-fg">Chek biriktirildi ✓</span>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => onChange("")}
            aria-label="Chekni olib tashlash"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-dashed border-line-2 px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50"
        >
          {busy ? <Spinner /> : <Paperclip size={14} />} {busy ? "Yuklanmoqda…" : "Chek skrinshotini biriktirish (tavsiya)"}
        </button>
      )}
      {error && <p className="mt-1.5 text-[12.5px] font-semibold text-danger-text">{error}</p>}
    </div>
  );
}
