"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AlertCircle, MessageSquareReply, PencilLine } from "lucide-react";
import { Button, Spinner } from "@/components/ui";

type ReplyResponse = { ok: true; data: { id: string; reply: string | null } } | { ok: false; error: string; fields?: Record<string, string> };

const MAX = 800;

/**
 * Profil egasining sharhga javobi (F43): "Javob yozish" → joyida forma.
 * Javob bor bo'lsa — "Javobni tahrirlash"; bo'sh yuborish yoki "Javobni o'chirish" javobni olib tashlaydi.
 */
export function ReviewReplyForm({ reviewId, existing }: { reviewId: string; existing?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(existing ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const uid = useId();

  useEffect(() => {
    if (open) areaRef.current?.focus();
  }, [open]);

  const save = async (value: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/reply`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: value }),
      });
      const json = (await res.json()) as ReplyResponse;
      if (!json.ok) {
        setError(json.fields?.reply ?? json.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !existing) {
      setError("Javob matnini yozing");
      return;
    }
    void save(text);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setText(existing ?? "");
          setOpen(true);
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold text-accent-text transition hover:bg-accent-soft"
        aria-expanded={false}
      >
        {existing ? <PencilLine size={13} /> : <MessageSquareReply size={13} />}
        {existing ? "Javobni tahrirlash" : "Javob yozish"}
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
      className="animate-fade-up w-full space-y-2"
      style={{ animationDuration: "0.25s" }}
      noValidate
    >
      <label htmlFor={`${uid}-reply`} className="field-label">
        Javobingiz
      </label>
      <textarea
        ref={areaRef}
        id={`${uid}-reply`}
        className="field min-h-[88px] resize-y"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX}
        placeholder="Masalan: Rahmat! Yana birga ishlashdan xursand bo'lamiz."
        aria-invalid={Boolean(error)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] tabular-nums text-fg-4">
          {text.length}/{MAX}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {existing && (
            <Button type="button" variant="ghost" size="sm" className="text-fg-3" onClick={() => void save("")} disabled={busy}>
              Javobni o'chirish
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
            Bekor qilish
          </Button>
          <Button type="submit" size="sm" disabled={busy} className="min-w-[110px]">
            {busy ? <Spinner /> : "Saqlash"}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-[12px] font-medium text-danger">
          <AlertCircle size={13} /> {error}
        </p>
      )}
    </form>
  );
}
