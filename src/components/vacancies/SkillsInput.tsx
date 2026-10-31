"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { VAK_SKILLS as T } from "@/lib/i18n/dict/vacancies-forms";

/** Ko'nikmalar teg-kiritgichi: Enter yoki vergul — qo'shadi; × — olib tashlaydi. `placeholder` berilmasa — tilga mos standart */
export function SkillsInput({ value, onChange, max, placeholder, id }: { value: string[]; onChange: (v: string[]) => void; max: number; placeholder?: string; id?: string }) {
  const til = useLocale();
  const [draft, setDraft] = useState("");
  const ph = placeholder ?? tr(til, T.placeholder);
  function commit() {
    const parts = draft
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const seen = new Set(value.map((v) => v.toLowerCase()));
    const next = [...value];
    for (const p of parts) {
      if (next.length >= max) break;
      if (seen.has(p.toLowerCase())) continue;
      seen.add(p.toLowerCase());
      next.push(p.slice(0, 40));
    }
    onChange(next);
    setDraft("");
  }
  return (
    <div className="field flex min-h-11 flex-wrap items-center gap-1.5 py-1.5">
      {value.map((s, i) => (
        <span key={s} className="inline-flex h-7 items-center gap-1 rounded-full bg-fg/6 pl-2.5 pr-1.5 text-[12.5px] font-semibold text-fg">
          {s}
          <button type="button" aria-label={T.remove[til](s)} onClick={() => onChange(value.filter((_, j) => j !== i))} className="-my-1 -mr-1.5 flex h-7 w-7 items-center justify-center rounded-full text-fg-3 hover:bg-fg/10 hover:text-fg">
            <X size={11} />
          </button>
        </span>
      ))}
      {value.length < max && (
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={commit}
          placeholder={value.length ? "" : ph}
          className="min-w-[140px] flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-4"
        />
      )}
      <span className="ml-auto pr-1 text-[11px] text-fg-4">
        {value.length}/{max}
      </span>
    </div>
  );
}
