"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePresence } from "@/components/motion/usePresence";
import { useScrollLock } from "@/components/motion/useScrollLock";
import { useFocusTrap } from "@/components/motion/useFocusTrap";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { cn } from "@/lib/utils";
import { Button, Spinner } from "./index";

export interface ConfirmOptions {
  title: ReactNode;
  text?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Xavfli amal (o'chirish): qizil tugma, boshlang'ich fokus «Bekor qilish»da */
  danger?: boolean;
}

/**
 * Umumiy tasdiq oynasi — `window.confirm` o'rniga: role="alertdialog", modal-in/out, fokus tuzog'i, Escape = bekor.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Postni o'chirasizmi?", text: "Qaytarib bo'lmaydi.", danger: true })) { … }
 *
 * Yoki boshqariladigan: <ConfirmDialog open={open} title=… onConfirm={…} onCancel={…} busy={pending} />
 */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  cancelLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmOptions & { open: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const til = useLocale();
  const { mounted, closing } = usePresence(open, 180);
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const textId = useId();
  useEffect(() => setReady(true), []);
  useScrollLock(open);
  useFocusTrap(ref, open && mounted && ready);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, busy, onCancel]);

  if (!mounted || !ready) return null;
  return createPortal(
    <div className={cn("fixed inset-0 z-[130] flex items-end justify-center bg-ink/55 p-3 sm:items-center sm:p-6", closing ? "overlay-out" : "overlay-in")} role="presentation" onClick={busy ? undefined : onCancel}>
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={text ? textId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn("card-elevated w-full max-w-sm !rounded-card-lg p-5 outline-none sm:p-6", closing ? "animate-modal-out" : "animate-modal-in")}
      >
        <h2 id={titleId} className="font-display text-[17px] font-semibold text-fg">
          {title}
        </h2>
        {text && (
          <p id={textId} className="mt-2 text-[14px] leading-relaxed text-fg-2">
            {text}
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy} data-autofocus-skip={danger ? undefined : true}>
            {cancelLabel ?? tr(til, SHELL.common.cancel)}
          </Button>
          <Button type="button" variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy} aria-busy={busy} data-autofocus-skip={danger ? true : undefined}>
            {busy && <Spinner className="h-3.5 w-3.5" />}
            {confirmLabel ?? (danger ? tr(til, SHELL.common.delete) : tr(til, SHELL.common.confirm))}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type Ask = (opts: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<Ask | null>(null);

/** Root layout'da bir marta; keyin istalgan klient komponentda useConfirm() */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const ask = useCallback<Ask>((opts) => new Promise<boolean>((resolve) => setState({ opts, resolve })), []);
  const finish = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <ConfirmDialog open={state !== null} title={state?.opts.title ?? ""} text={state?.opts.text} confirmLabel={state?.opts.confirmLabel} cancelLabel={state?.opts.cancelLabel} danger={state?.opts.danger} onConfirm={() => finish(true)} onCancel={() => finish(false)} />
    </ConfirmCtx.Provider>
  );
}

export function useConfirm(): Ask {
  const ctx = useContext(ConfirmCtx);
  // Provider'siz (test/izolyatsiya) — brauzer dialogi
  return ctx ?? (async (o) => (typeof window !== "undefined" ? window.confirm([o.title, o.text].filter(Boolean).map(String).join("\n")) : false));
}
