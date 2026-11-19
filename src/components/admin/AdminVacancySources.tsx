"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, Play, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PROFESSIONS } from "@/lib/vacancies/format";
import { cn, formatDateTime } from "@/lib/utils";

type Source = {
  id: string;
  username: string;
  title: string;
  enabled: boolean;
  mode: "auto" | "review";
  professions: string[];
  lastCheckedAt: number | null;
  lastError: string | null;
  importedCount: number;
  skippedCount: number;
  pending: number;
};
type Imp = {
  id: string;
  status: string;
  reason: string;
  text: string;
  url: string;
  username: string;
  title: string;
  createdAt: number;
  postedAt: number | null;
  vacancyId: string | null;
  profession: string | null;
  jobTitle: string | null;
};
type Tab = "pending" | "published" | "skipped";

const API = "/api/admin/vakansiya-manbalari";
const PROF = Object.fromEntries(PROFESSIONS.map((p) => [p.slug, p.short]));

async function call<T>(method: string, body?: unknown, query = ""): Promise<T> {
  const r = await fetch(API + query, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = (await r.json().catch(() => null)) as { ok: boolean; error?: string; fields?: Record<string, string>; data?: T } | null;
  if (!r.ok || !j?.ok) throw new Error((j?.fields && Object.values(j.fields)[0]) || j?.error || "Xatolik");
  return j.data as T;
}

/**
 * Vakansiya manbalari: ochiq Telegram kanallari → AI saralaydi → vakansiya (matn o'zgarishsiz, manba bilan).
 * Har 15 daqiqada avtomatik (GitHub Actions) + «Hozir tekshirish».
 */
export function AdminVacancySources() {
  const confirm = useConfirm();
  const [sources, setSources] = useState<Source[] | null>(null);
  const [imports, setImports] = useState<Imp[]>([]);
  const [ai, setAi] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [channels, setChannels] = useState("");
  const [mode, setMode] = useState<"review" | "auto">("review");
  const [busy, setBusy] = useState<string>("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async (t: Tab = tab) => {
    try {
      const d = await call<{ sources: Source[]; imports: Imp[]; aiEnabled: boolean }>("GET", undefined, `?imports=${t}`);
      setSources(d.sources);
      setImports(d.imports);
      setAi(d.aiEnabled);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuklab bo'lmadi", "error");
    }
  }, [tab]);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  async function add() {
    setBusy("add");
    try {
      const r = await call<{ added: string[]; invalid: string[]; existing: string[] }>("POST", { action: "add", channels, mode });
      showToast(`${r.added.length} ta kanal qo'shildi${r.existing.length ? ` · ${r.existing.length} tasi avval bor edi` : ""}${r.invalid.length ? ` · yaroqsiz: ${r.invalid.join(", ")}` : ""}`, r.invalid.length ? "error" : "success");
      setChannels("");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy("");
    }
  }

  async function run(sourceId?: string) {
    setBusy(sourceId ? `run:${sourceId}` : "run");
    try {
      const r = await call<{ checked: number; published: number; pending: number; skipped: number; errors: Array<{ channel: string; error: string }> }>("POST", { action: "run", ...(sourceId ? { sourceId } : {}) });
      showToast(
        `Ko'rildi: ${r.checked} · joylandi: ${r.published} · tasdiq kutmoqda: ${r.pending} · o'tkazildi: ${r.skipped}${r.errors.length ? ` · xato: ${r.errors.map((e) => `@${e.channel}`).join(", ")}` : ""}`,
        r.errors.length ? "error" : "success",
      );
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy("");
    }
  }

  async function patch(s: Source, p: Partial<Pick<Source, "enabled" | "mode" | "professions">>) {
    setSources((list) => list?.map((x) => (x.id === s.id ? { ...x, ...p } : x)) ?? list);
    try {
      await call("PATCH", { id: s.id, ...p });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Saqlab bo'lmadi", "error");
      await load();
    }
  }

  async function remove(s: Source) {
    const withVac = await confirm({ title: `@${s.username} o'chirilsinmi?`, text: "Kanal ro'yxatdan olib tashlanadi. Undan olingan vakansiyalar ham o'chirilsinmi? («Bekor qilish» — faqat kanal o'chadi, vakansiyalar qoladi)", confirmLabel: "Vakansiyalari bilan o'chirish", cancelLabel: "Faqat kanalni", danger: true });
    setBusy(`del:${s.id}`);
    try {
      const r = await call<{ closed: number }>("DELETE", { id: s.id, removeVacancies: withVac });
      showToast(withVac ? `Kanal va ${r.closed} ta vakansiya o'chirildi` : "Kanal o'chirildi");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy("");
    }
  }

  async function decide(i: Imp, decision: "publish" | "reject") {
    setBusy(`imp:${i.id}`);
    try {
      await call("POST", { action: "decide", id: i.id, decision });
      setImports((list) => list.filter((x) => x.id !== i.id));
      showToast(decision === "publish" ? "Vakansiya joylandi" : "Rad etildi");
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5">
      {!ai && (
        <p className="rounded-[var(--r-sm)] border border-warning-text/30 bg-warning-soft px-4 py-3 text-[13px] text-fg">
          AI kaliti (<code>GEMINI_API_KEY</code>) yo'q — postlar kalit so'zlar bo'yicha saralanmoqda. Aniqroq bo'lishi uchun Vercel'ga kalit qo'shing.
        </p>
      )}

      {/* Kanal qo'shish */}
      <div className="rounded-[var(--r-md)] border border-line p-4">
        <label className="block">
          <span className="field-label">Ochiq kanallar — har qatorga bittadan (@kanal yoki t.me/kanal)</span>
          <textarea value={channels} onChange={(e) => setChannels(e.target.value)} rows={3} placeholder={"@montaj_vakansiya\nt.me/dizayn_ish"} className="field w-full resize-y py-2.5 font-mono text-[13px] max-md:text-[16px]" />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="segment" role="radiogroup" aria-label="Rejim">
            {(["review", "auto"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className="segment-item" data-active={mode === m}>
                {m === "review" ? "Admin tasdiqlaydi" : "Darhol joylash"}
              </button>
            ))}
          </div>
          <button type="button" disabled={busy === "add" || channels.trim().length < 3} onClick={() => void add()} className="btn-ink inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold disabled:opacity-50">
            {busy === "add" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Qo'shish
          </button>
          <button type="button" disabled={!!busy || !sources?.length} onClick={() => void run()} className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 hover:text-fg disabled:opacity-50">
            {busy === "run" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Hozir tekshirish
          </button>
        </div>
        <p className="mt-2 text-[11.5px] text-fg-4">Yangi kanalda faqat oxirgi 3 kunlik postlar olinadi. Har kanal ~15 daqiqada bir marta avtomatik tekshiriladi. Matn o'zgarmaydi, har vakansiyada «Manba» va asl postga havola turadi.</p>
      </div>

      {/* Manbalar ro'yxati */}
      {sources === null ? (
        <p className="text-[13px] text-fg-3">Yuklanmoqda…</p>
      ) : sources.length === 0 ? (
        <p className="text-[13px] text-fg-3">Hali kanal qo'shilmagan.</p>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--r-md)] border border-line">
          {sources.map((s) => (
            <li key={s.id} className={cn("p-3.5", !s.enabled && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <a href={`https://t.me/s/${s.username}`} target="_blank" rel="noopener noreferrer" className="min-w-0 font-semibold text-fg hover:underline">
                  <span className="truncate" data-no-auto>{s.title || `@${s.username}`}</span> <span className="font-normal text-fg-3">@{s.username}</span>
                </a>
                {s.pending > 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-text">{s.pending} tasdiq kutmoqda</span>}
                <span className="text-[12px] text-fg-3">
                  olindi {s.importedCount} · o'tkazildi {s.skippedCount}
                  {s.lastCheckedAt ? ` · ${formatDateTime(s.lastCheckedAt)}` : " · hali tekshirilmagan"}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <select value={s.mode} onChange={(e) => void patch(s, { mode: e.target.value as Source["mode"] })} className="field h-8 py-0 text-[12px]" aria-label="Rejim">
                    <option value="review">Tasdiq bilan</option>
                    <option value="auto">Darhol</option>
                  </select>
                  <button type="button" role="switch" aria-checked={s.enabled} aria-label="Yoqilgan" onClick={() => void patch(s, { enabled: !s.enabled })} className="switch" />
                  <button type="button" disabled={!!busy} onClick={() => void run(s.id)} className="grid h-8 w-8 place-items-center rounded-full text-fg-3 hover:bg-fg/5 hover:text-fg" aria-label="Hozir tekshirish">
                    {busy === `run:${s.id}` ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </button>
                  <button type="button" disabled={!!busy} onClick={() => void remove(s)} className="grid h-8 w-8 place-items-center rounded-full text-fg-3 hover:bg-danger-soft hover:text-danger-text" aria-label="O'chirish">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {s.lastError && <p className="mt-1 text-[12px] text-danger-text">Xato: {s.lastError}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {PROFESSIONS.filter((p) => p.slug !== "boshqa").map((p) => {
                  const on = s.professions.length === 0 || s.professions.includes(p.slug);
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => {
                        const all = PROFESSIONS.filter((x) => x.slug !== "boshqa").map((x) => x.slug as string);
                        const cur = s.professions.length ? s.professions : all;
                        const next = on ? cur.filter((x) => x !== p.slug) : [...cur, p.slug];
                        if (next.length) void patch(s, { professions: next.length === all.length ? [] : next });
                      }}
                      className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors", on ? "border-fg bg-fg text-bg" : "border-line text-fg-3 hover:border-line-2")}
                    >
                      {p.short}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Importlar */}
      <div>
        <div className="segment mb-3" role="tablist">
          {(
            [
              ["pending", "Tasdiq kutmoqda"],
              ["published", "Joylangan"],
              ["skipped", "O'tkazilgan"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="segment-item" data-active={tab === k}>
              {l}
            </button>
          ))}
        </div>
        {imports.length === 0 ? (
          <p className="text-[13px] text-fg-3">Bo'sh.</p>
        ) : (
          <ul className="divide-y divide-line rounded-[var(--r-md)] border border-line">
            {imports.map((i) => (
              <li key={i.id} className="p-3.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-3">
                  <span className="font-semibold text-fg-2" data-no-auto>@{i.username}</span>
                  {i.jobTitle && <span className="font-semibold text-fg">{i.jobTitle}</span>}
                  {i.profession && <span className="rounded bg-fg/5 px-1.5 py-px">{PROF[i.profession] ?? i.profession}</span>}
                  <span>· {formatDateTime(i.postedAt ?? i.createdAt)}</span>
                  <span>· {i.reason}</span>
                  <a href={i.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 font-semibold text-fg-2 hover:text-fg">
                    Post <ExternalLink size={12} />
                  </a>
                  {i.vacancyId && (
                    <a href={`/vakansiyalar/${i.vacancyId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent-text">
                      Saytda <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <button type="button" onClick={() => setOpen(open === i.id ? null : i.id)} className="mt-1.5 block w-full text-left">
                  <p className={cn("whitespace-pre-wrap text-[13px] leading-relaxed text-fg-2", open !== i.id && "line-clamp-3")} data-no-auto>
                    {i.text}
                  </p>
                </button>
                {i.status !== "published" && (
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busy === `imp:${i.id}`} onClick={() => void decide(i, "publish")} className="btn-ink inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold disabled:opacity-50">
                      <Check size={13} /> Joylash
                    </button>
                    {i.status === "pending" && (
                      <button type="button" disabled={busy === `imp:${i.id}`} onClick={() => void decide(i, "reject")} className="inline-flex h-8 items-center gap-1 rounded-full border border-line-2 px-3 text-[12px] font-semibold text-fg-2 disabled:opacity-50">
                        <X size={13} /> Rad etish
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
