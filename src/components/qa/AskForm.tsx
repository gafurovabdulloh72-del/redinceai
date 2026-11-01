"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_GROUPS } from "@/lib/categories";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SAVOL } from "@/lib/i18n/dict/community";

/** Savol berish formasi (/savollar/yangi) — sarlavha + tafsilot + yo'nalish */
export function AskForm() {
  const router = useRouter();
  const til = useLocale();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/savollar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body, category }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j?.error ?? tr(til, SAVOL.submitFail));
        return;
      }
      toast(tr(til, SAVOL.submitted), "success");
      router.push(`/savollar/${j.data.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-[13px] font-semibold text-fg-2">{tr(til, SAVOL.qLabel)}</span>
        <input
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tr(til, SAVOL.qPh)}
          maxLength={150}
          required
          minLength={10}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-[13px] font-semibold text-fg-2">
          {tr(til, SAVOL.detail)} <span className="font-normal text-fg-3">{tr(til, SAVOL.optional)}</span>
        </span>
        <textarea
          className="field min-h-32 resize-y"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={tr(til, SAVOL.detailPh)}
          maxLength={4000}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-[13px] font-semibold text-fg-2">
          {tr(til, SAVOL.catLabel)} <span className="font-normal text-fg-3">{tr(til, SAVOL.optional)}</span>
        </span>
        <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{tr(til, SAVOL.catAll)}</option>
          {CATEGORY_GROUPS.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      {err && <p className="text-[13px] font-semibold text-danger">{err}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || title.trim().length < 10}>
          {busy ? tr(til, SAVOL.sending) : tr(til, SAVOL.submit)}
        </Button>
        <span className="text-[12.5px] text-fg-3">{tr(til, SAVOL.notifyHint)}</span>
      </div>
    </form>
  );
}
