"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight, BookmarkCheck, BookmarkPlus, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

/**
 * "Qidiruvni saqlash" (F53): joriy filtrlarni nom bilan saqlaydi (POST /api/saved-searches).
 * Nom so'rovi — tugma ostida ochiladigan ixcham forma (window.prompt emas). Mehmon — kirish sahifasiga.
 */
export function SaveSearchButton({
  query,
  defaultName,
  loggedIn,
  loginHref,
  className,
}: {
  /** Joriy /mutaxassislar querystring'i */
  query: string;
  defaultName: string;
  loggedIn: boolean;
  loginHref: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName.slice(0, 60));
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  // Filtrlar o'zgarsa — holat yangilanadi (boshqa qidiruv)
  useEffect(() => {
    setName(defaultName.slice(0, 60));
    setSaved(null);
    setError(null);
  }, [query, defaultName]);

  useEffect(() => {
    if (open) inputRef.current?.select();
  }, [open]);

  if (!loggedIn) {
    return (
      <Link
        href={loginHref}
        className={cn("inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[13px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4", className)}
        title="Saqlash uchun tizimga kiring"
      >
        <BookmarkPlus size={15} aria-hidden="true" /> Qidiruvni saqlash
      </Link>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), query, notify }),
      });
      const json = (await res.json()) as ApiResponse<{ id: string; name: string }>;
      if (!json.ok) {
        setError(json.fields?.name ?? json.error);
        return;
      }
      setSaved(json.data.name);
      setOpen(false);
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <p className={cn("inline-flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-success-text", className)} role="status">
        <BookmarkCheck size={15} aria-hidden="true" /> Saqlandi
        <Link href="/kabinet/qidiruvlar" className="inline-flex min-h-10 items-center gap-1 text-accent-text hover:opacity-80">
          Saqlangan qidiruvlar <ArrowRight size={13} />
        </Link>
      </p>
    );
  }

  return (
    <div className={cn("min-w-0", open && "basis-full", className)}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls={`${id}-form`}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[13px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4"
        >
          <BookmarkPlus size={15} aria-hidden="true" /> Qidiruvni saqlash
        </button>
      ) : (
        <form
          id={`${id}-form`}
          onSubmit={submit}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className="card-elevated flex flex-col gap-3 p-4 animate-fade-up sm:flex-row sm:items-end"
          style={{ animationDuration: "0.2s" }}
          aria-label="Qidiruvni saqlash"
        >
          <div className="min-w-0 flex-1">
            <label htmlFor={`${id}-name`} className="field-label">
              Qidiruv nomi
            </label>
            <input
              ref={inputRef}
              id={`${id}-name`}
              className="field !h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Masalan: Samarqand to'y videograflari"
              aria-invalid={Boolean(error)}
            />
            <label className="mt-2 inline-flex min-h-10 cursor-pointer items-center gap-2 text-[13px] text-fg-2">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              Yangi mos mutaxassislar haqida xabar berish
            </label>
            {error && (
              <p role="alert" className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-danger-text">
                <AlertCircle size={14} /> {error}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 sm:pb-12">
            <Button type="submit" variant="accent" size="md" className="flex-1 sm:flex-none" disabled={busy || name.trim().length < 2}>
              {busy ? <Spinner /> : "Saqlash"}
            </Button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Yopish" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
              <X size={17} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
