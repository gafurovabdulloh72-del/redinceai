"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Trash2 } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Rm = { id: string; title: string; description: string; courseIds: string[] };
type Course = { id: string; title: string };

/** Yo'l xaritasi yaratish: kurslarni ketma-ketlikka yig'ish («Boshlovchidan professionalgacha») */
export function RoadmapManager({ roadmaps, courses }: { roadmaps: Rm[]; courses: Course[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const name = (id: string) => courses.find((c) => c.id === id)?.title ?? "—";

  function open(r?: Rm) {
    setEditing(r ? r.id : "new");
    setTitle(r?.title ?? "");
    setDescription(r?.description ?? "");
    setIds(r?.courseIds ?? []);
  }
  const move = (i: number, d: number) => setIds((a) => { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return a; [b[i], b[j]] = [b[j], b[i]]; return b; });

  async function save() {
    setBusy(true);
    try {
      const r = await fetch("/api/mentorlik/yol-xaritasi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: editing === "new" ? undefined : editing, title, description, courseIds: ids }) });
      const j = (await r.json()) as { error?: string; fields?: Record<string, string> };
      if (!r.ok) throw new Error(Object.values(j.fields ?? {})[0] || j.error || "Xatolik");
      showToast("Saqlandi", "success");
      setEditing(null);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    await fetch(`/api/mentorlik/yol-xaritasi?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {roadmaps.map((r) => (
          <li key={r.id} className="card flex items-center gap-3 p-3.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-bold text-fg">{r.title}</p>
              <p className="truncate text-[12.5px] text-fg-3">{r.courseIds.length} bosqich</p>
            </div>
            <button type="button" onClick={() => open(r)} className="text-[13px] font-semibold text-fg-2 hover:text-fg">Tahrirlash</button>
            <button type="button" aria-label="O'chirish" onClick={() => void remove(r.id)} className="text-fg-3 hover:text-danger"><Trash2 size={15} /></button>
          </li>
        ))}
        {roadmaps.length === 0 && <li className="card p-5 text-center text-[13.5px] text-fg-3">Hali yo&apos;l xaritasi yo&apos;q.</li>}
      </ul>
      {!editing && courses.length > 0 && roadmaps.length < 6 && (
        <button type="button" onClick={() => open()} className="h-11 rounded-full bg-fg px-6 text-[14px] font-semibold text-bg">Yangi yo&apos;l xaritasi</button>
      )}
      {courses.length === 0 && <p className="text-[13.5px] text-fg-3">Avval kamida bitta bo&apos;lim (kurs) yarating.</p>}
      {editing && (
        <div className="card space-y-3 p-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Nomi: Boshlovchidan professionalgacha" className="field h-11 w-full text-[14px]" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Qisqa tavsif (ixtiyoriy)" className="field h-11 w-full text-[14px]" />
          <div>
            <p className="mb-1.5 text-[12.5px] font-semibold text-fg-3">Kurslar (tartib bilan)</p>
            <ol className="space-y-1">
              {ids.map((id, i) => (
                <li key={id} className="flex items-center gap-2 rounded-lg bg-fg/[0.04] px-2.5 py-1.5 text-[13.5px]">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-fg text-[11.5px] font-bold text-bg">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-fg">{name(id)}</span>
                  <button type="button" aria-label="Yuqoriga" onClick={() => move(i, -1)} className="text-fg-3 hover:text-fg"><ArrowUp size={14} /></button>
                  <button type="button" aria-label="Pastga" onClick={() => move(i, 1)} className="text-fg-3 hover:text-fg"><ArrowDown size={14} /></button>
                  <button type="button" aria-label="Olib tashlash" onClick={() => setIds((a) => a.filter((x) => x !== id))} className="text-fg-3 hover:text-danger"><Trash2 size={13} /></button>
                </li>
              ))}
            </ol>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {courses.filter((c) => !ids.includes(c.id)).map((c) => (
                <button key={c.id} type="button" onClick={() => setIds((a) => [...a, c.id].slice(0, 12))} className={cn("rounded-full border border-line px-3 py-1 text-[12.5px] font-semibold text-fg-2 hover:border-fg hover:text-fg")}>+ {c.title}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy || title.trim().length < 3 || ids.length === 0} onClick={() => void save()} className="btn-accent inline-flex h-10 items-center gap-2 px-5 text-[14px] font-semibold disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} Saqlash</button>
            <button type="button" onClick={() => setEditing(null)} className="h-10 rounded-full px-4 text-[13.5px] font-semibold text-fg-3">Bekor</button>
          </div>
        </div>
      )}
    </div>
  );
}
