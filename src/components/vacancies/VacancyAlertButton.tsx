"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { BellPlus, BellRing, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

type ApiResponse = { ok: true; data: { id: string; name: string } } | { ok: false; error: string; fields?: Record<string, string> };

/**
 * «Yangi vakansiyadan xabardor qil»: joriy /vakansiyalar filtrlarini nom bilan saqlaydi (POST /api/vakansiyalar/obuna);
 * kunlik tekshiruvda mos yangi vakansiya chiqsa bildirishnoma keladi. Mehmon — kirish sahifasiga.
 */
export function VacancyAlertButton({ query, defaultName, loggedIn, className }: { query: string; defaultName: string; loggedIn: boolean; className?: string }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName.slice(0, 60));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(defaultName.slice(0, 60));
    setSaved(false);
    setError(null);
  }, [query, defaultName]);
  useEffect(() => {
    if (open) inputRef.current?.select();
  }, [open]);

  const base = "press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition";
  if (!loggedIn) {
    return (
      <Link href={`/auth/kirish?next=${encodeURIComponent(`/vakansiyalar${query ? `?${query}` : ""}`)}`} className={cn(base, "border-line-2 text-fg-2 hover:border-fg hover:text-fg", className)}>
        <BellPlus size={14} aria-hidden /> Xabardor qil
      </Link>
    );
  }
  if (saved) {
    return (
      <p role="status" className={cn("inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold text-success-text", className)}>
        <BellRing size={14} aria-hidden /> Saqlandi — yangi mos vakansiya chiqsa xabar beramiz
      </p>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vakansiyalar/obuna", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), query, notify: true }) });
      const j = (await res.json()) as ApiResponse;
      if (!j.ok) {
        setError(j.fields?.name ?? j.fields?.query ?? j.error);
        return;
      }
      setSaved(true);
      setOpen(false);
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("min-w-0", open && "basis-full", className)}>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} aria-expanded={false} aria-controls={`${id}-form`} className={cn(base, "border-line-2 text-fg-2 hover:border-fg hover:text-fg")}>
          <BellPlus size={14} aria-hidden /> Xabardor qil
        </button>
      ) : (
        <form id={`${id}-form`} onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && setOpen(false)} className="expand-in card flex flex-col gap-2 p-3 sm:flex-row sm:items-center" aria-label="Qidiruvni saqlash">
          <label htmlFor={`${id}-name`} className="sr-only">
            Qidiruv nomi
          </label>
          <input ref={inputRef} id={`${id}-name`} className="field h-10 min-w-0 flex-1 text-[14px]" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Masalan: Masofaviy dizayn" aria-invalid={Boolean(error)} />
          <div className="flex items-center gap-1.5">
            <Button type="submit" variant="accent" size="sm" className="!h-10" disabled={busy || name.trim().length < 2}>
              {busy ? <Spinner /> : "Saqlash"}
            </Button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Yopish" className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-3 hover:bg-fg/6 hover:text-fg">
              <X size={16} />
            </button>
          </div>
          {error && (
            <p role="alert" className="basis-full text-[12.5px] font-medium text-danger-text">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
