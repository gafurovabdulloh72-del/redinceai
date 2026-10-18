"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FlaskConical, Save, ShieldAlert } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Admin: spam filtri — taqiqlangan so'zlar (har qatorda bittadan), havola siyosati va ruxsat etilgan domenlar.
 * «Sinab ko'rish» — matnni saqlamasdan joriy tahrir bilan tekshiradi (POST /api/admin/settings/spam).
 * Qo'llanish: post/izoh/chat/vakansiya validatorlari `assertNotSpam()` ni chaqiradi (lib/security/spam-filter.ts).
 */
interface Settings {
  words: string[];
  blockLinks: boolean;
  allowDomains: string[];
}
type Check = { ok: true } | { ok: false; reason: "word" | "link"; match: string };
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

const lines = (s: string) => s.split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean);

export function SpamFilterPanel() {
  const [initial, setInitial] = useState<Settings | null>(null);
  const [words, setWords] = useState("");
  const [blockLinks, setBlockLinks] = useState(false);
  const [domains, setDomains] = useState("");
  const [sample, setSample] = useState("");
  const [result, setResult] = useState<Check | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings/spam", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: ApiResponse<Settings>) => {
        if (!j.ok) throw new Error(j.error);
        setInitial(j.data);
        setWords(j.data.words.join("\n"));
        setBlockLinks(j.data.blockLinks);
        setDomains(j.data.allowDomains.join("\n"));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Yuklab bo'lmadi"));
  }, []);

  const payload = () => ({ words: lines(words), blockLinks, allowDomains: lines(domains) });
  const dirty = initial ? JSON.stringify(payload()) !== JSON.stringify({ words: initial.words, blockLinks: initial.blockLinks, allowDomains: initial.allowDomains }) : false;

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      const r = await fetch("/api/admin/settings/spam", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
      const j = (await r.json()) as ApiResponse<Settings>;
      if (!j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error);
      setInitial(j.data);
      setWords(j.data.words.join("\n"));
      setDomains(j.data.allowDomains.join("\n"));
      showToast(`Spam filtri saqlandi — ${j.data.words.length} ta so'z, ${j.data.allowDomains.length} ta domen`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Saqlab bo'lmadi";
      setError(m);
      showToast(m, "error");
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    if (!sample.trim()) return;
    setBusy("test");
    setResult(null);
    try {
      const r = await fetch("/api/admin/settings/spam", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload(), sample }) });
      const j = (await r.json()) as ApiResponse<{ result: Check }>;
      if (!j.ok) throw new Error(j.error);
      setResult(j.data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sinab bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  if (!initial && !error)
    return (
      <div className="card p-5" aria-busy="true" aria-label="Spam filtri yuklanmoqda">
        <span className="block h-4 w-40 skeleton" />
        <span className="mt-3 block h-24 w-full skeleton" />
      </div>
    );

  return (
    <div className="card p-5 sm:p-6" aria-label="Spam filtri">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-fg">
        <ShieldAlert size={16} className="text-fg-3" /> Spam filtri
      </p>
      <p className="mt-0.5 text-[12.5px] text-fg-3">Post, izoh, chat va vakansiya matnlarida tekshiriladi. So&apos;zlar registrsiz va kirill/lotin farqisiz solishtiriladi.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="spam-words" className="field-label">
            Taqiqlangan so&apos;zlar <span className="font-normal text-fg-4">(har qatorda bittadan, 200 tagacha)</span>
          </label>
          <textarea id="spam-words" value={words} onChange={(e) => setWords(e.target.value)} rows={6} spellCheck={false} placeholder={"kazino\nstavka\npul ishlash sxemasi"} className="field w-full resize-y py-2 font-mono text-[13px] leading-relaxed" />
          <p className="mt-1 text-[11px] text-fg-4 tabular-nums">{lines(words).length} ta so&apos;z</p>
        </div>
        <div>
          <button
            type="button"
            role="switch"
            aria-checked={blockLinks}
            onClick={() => setBlockLinks((v) => !v)}
            className="flex min-h-12 w-full items-center gap-3 rounded-[var(--r-sm)] border border-line px-4 py-2.5 text-left transition hover:border-line-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-fg">Havolalarni cheklash</span>
              <span className="block text-[12px] text-fg-3">{blockLinks ? "Yoqilgan — faqat ruxsat etilgan domenlar" : "O'chirilgan — barcha havolalar o'tadi"}</span>
            </span>
            <span aria-hidden="true" className="switch" aria-checked={blockLinks} />
          </button>
          <label htmlFor="spam-domains" className="field-label mt-3">
            Ruxsat etilgan domenlar
          </label>
          <textarea id="spam-domains" value={domains} onChange={(e) => setDomains(e.target.value)} rows={4} spellCheck={false} disabled={!blockLinks} placeholder={"t.me\nyoutube.com"} className={cn("field w-full resize-y py-2 font-mono text-[13px] leading-relaxed", !blockLinks && "opacity-60")} />
        </div>
      </div>

      {/* Sinov maydoni — saqlamasdan tekshirish */}
      <div className="mt-4 rounded-[var(--r-sm)] border border-line p-3">
        <label htmlFor="spam-sample" className="field-label">
          Sinab ko&apos;rish
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="spam-sample" value={sample} onChange={(e) => { setSample(e.target.value); setResult(null); }} maxLength={2000} placeholder="Namuna matn: masalan, «Kazino bonus olish uchun t.me/xxx»" className="field !h-10 !min-h-0 flex-1 text-[13px]" onKeyDown={(e) => e.key === "Enter" && void test()} />
          <Button size="sm" variant="outline" className="h-10" onClick={() => void test()} disabled={busy === "test" || !sample.trim()}>
            {busy === "test" ? <Spinner className="h-3.5 w-3.5" /> : <FlaskConical size={14} />} Tekshirish
          </Button>
        </div>
        {result && (
          <p role="status" className={cn("expand-in mt-2 flex items-center gap-1.5 text-[12.5px] font-medium", result.ok ? "text-success-text" : "text-warning-text")}>
            {result.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {result.ok ? "O'tadi — spam topilmadi" : result.reason === "word" ? `Bloklanadi: taqiqlangan so'z «${result.match}»` : `Bloklanadi: ruxsatsiz havola (${result.match})`}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-center gap-2 rounded-[14px] bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger-text">
          <AlertCircle size={15} /> {error}
        </p>
      )}
      <div className="mt-4 flex items-center justify-end gap-2">
        {dirty && <span className="text-[12px] text-fg-4">Saqlanmagan o&apos;zgarishlar</span>}
        <Button size="md" onClick={() => void save()} disabled={busy === "save" || !dirty}>
          {busy === "save" ? <Spinner /> : <Save size={15} />} Saqlash
        </Button>
      </div>
    </div>
  );
}
