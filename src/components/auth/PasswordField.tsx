"use client";

import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { AUTH } from "@/lib/i18n/dict/auth";
import { cn } from "@/lib/utils";

interface PasswordFieldProps {
  id: string;
  name?: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  /** Kuch ko'rsatkichi (yangi parol uchun) */
  meter?: boolean;
  disabled?: boolean;
  /** O'ng tomonda, label qatorida (masalan, "Parolni unutdingizmi?") */
  labelAside?: ReactNode;
}

/** Parol maydoni: ko'rsat/yashir tugmasi fokuslanadi (A78), 44px bosish maydoni */
export function PasswordField({ id, name = "password", label, value, onChange, autoComplete, placeholder, error, hint, meter = false, disabled, labelAside }: PasswordFieldProps) {
  const til = useLocale();
  const [show, setShow] = useState(false);
  const describedBy = [error ? `${id}-error` : null, meter ? `${id}-meter` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {labelAside && <span className="mb-1.5 text-[12px]">{labelAside}</span>}
      </div>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("field !pr-14", error && "!border-ios-red/60")}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          maxLength={100}
          disabled={disabled}
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg"
          aria-label={tr(til, show ? AUTH.password.hide : AUTH.password.show)}
          aria-pressed={show}
          aria-controls={id}
          disabled={disabled}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
      {meter && <PasswordStrengthMeter password={value} id={`${id}-meter`} />}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-[12px] text-fg-4">
          {hint}
        </p>
      )}
    </div>
  );
}
