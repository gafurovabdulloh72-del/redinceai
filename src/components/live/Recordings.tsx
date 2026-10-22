"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Pencil, Play, Video } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { showToast as toast } from "@/components/ui/toast";
import { uploadAttachment } from "@/components/chat/attachments";
import { BuyButton } from "@/components/mentorship/PurchaseDialog";
import { ImageCropper } from "@/components/kabinet/ImageCropper";

export type RecItem = { id: string; title: string; startedAt: number; seconds: number; url: string | null; coverUrl: string | null; status: "none" | "recording" | "processing" | "ready" | "failed"; hidden: boolean; price?: number; locked?: boolean };

const dur = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} s ${m} daq` : `${Math.max(1, m)} daq`;
};

/** Mentor bo'limidagi efir yozuvlari: muqova + nom, bosilsa o'ynaydi; ustoz nom, muqova va ko'rinishni tahrirlaydi */
export function Recordings({ items, canManage, courses = [] }: { items: RecItem[]; canManage: boolean; courses?: Array<{ id: string; title: string }> }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  if (!items.length) return null;
  return (
    <section className="card mt-4 p-4 sm:p-5" aria-labelledby="rec-h">
      <h2 id="rec-h" className="flex items-center gap-2 text-[15px] font-bold text-fg">
        <Video size={16} className="text-fg-3" /> Efir yozuvlari <span className="font-semibold text-fg-3">{items.length}</span>
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {items.map((r) => (
          <li key={r.id} className={cn("overflow-hidden rounded-[14px] border border-line bg-surface", r.hidden && "opacity-60")}>
            {editing === r.id ? (
              <Editor r={r} courses={courses} onDone={() => setEditing(null)} />
            ) : (
              <>
                <div className="relative aspect-video bg-black">
                  {playing === r.id && r.url ? (
                    <video src={r.url} poster={r.coverUrl ?? undefined} controls autoPlay playsInline className="h-full w-full object-contain" />
                  ) : (
                    r.locked ? (
                      <div className="absolute inset-0 grid place-items-center">
                        {r.coverUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
                        <BuyButton type="ticket" id={r.id} loggedIn className="relative inline-flex h-9 items-center rounded-full bg-white px-4 text-[13px] font-bold text-black">
                          🔒 Chipta — {r.price?.toLocaleString("ru-RU")} so&apos;m
                        </BuyButton>
                      </div>
                    ) : (
                    <button type="button" disabled={r.status !== "ready"} onClick={() => setPlaying(r.id)} aria-label={`${r.title} — ko'rish`} className="group absolute inset-0 grid place-items-center">
                      {r.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <span className="absolute inset-0 bg-gradient-to-br from-fg/[0.06] to-fg/[0.16]" />
                      )}
                      {r.status === "ready" ? (
                        <span className="relative grid h-11 w-11 place-items-center rounded-full bg-black/65 text-white transition group-hover:scale-105">
                          <Play size={18} fill="currentColor" />
                        </span>
                      ) : (
                        <span className="relative rounded-full bg-black/65 px-3 py-1 text-[12px] font-semibold text-white">{r.status === "failed" ? "Yozilmadi" : "Tayyorlanmoqda…"}</span>
                      )}
                    </button>
                    )
                  )}
                  {r.status === "ready" && playing !== r.id && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">{dur(r.seconds)}</span>}
                </div>
                <div className="flex items-start gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-fg">{r.title}</h3>
                    <p className="mt-0.5 text-[12px] text-fg-3">{formatDateTime(r.startedAt)}{r.hidden ? " · yashirin" : ""}</p>
                  </div>
                  {canManage && (
                    <button type="button" aria-label="Tahrirlash" onClick={() => setEditing(r.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-3 hover:bg-fg/5 hover:text-fg">
                      <Pencil size={15} />
                    </button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Editor({ r, courses, onDone }: { r: RecItem; courses: Array<{ id: string; title: string }>; onDone: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(r.title);
  const [cover, setCover] = useState<string | null>(r.coverUrl);
  const [hidden, setHidden] = useState(r.hidden);
  const [crop, setCrop] = useState<File | null>(null);
  const [upBusy, setUpBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [course, setCourse] = useState("");
  const [toLesson, setToLesson] = useState(false);

  async function addToCourse() {
    setToLesson(true);
    try {
      const res = await fetch(`/api/live/${r.id}/darsga`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseId: course }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Xatolik");
      toast("Kursga dars qo'shildi", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setToLesson(false);
    }
  }

  async function upload(file: File) {
    setUpBusy(true);
    try {
      setCover((await uploadAttachment(file)).url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Yuklanmadi", "error");
    } finally {
      setUpBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/live/${r.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, coverUrl: cover, hidden }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Saqlanmadi");
      toast("Saqlandi", "success");
      onDone();
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2.5 p-3">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-[12px] text-fg-3">Muqova yo&apos;q</span>}
        {upBusy && <span className="absolute inset-0 grid place-items-center bg-black/40"><Loader2 className="animate-spin text-white" /></span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-line-2 px-3 text-[12.5px] font-semibold text-fg-2 hover:text-fg">
          Muqovani almashtirish
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCrop(f); e.target.value = ""; }} />
        </label>
        {cover && (
          <button type="button" onClick={() => setCover(null)} className="h-8 rounded-lg px-2 text-[12.5px] font-semibold text-fg-3 hover:text-danger">
            Olib tashlash
          </button>
        )}
      </div>
      {crop && <ImageCropper file={crop} aspect={16 / 9} outWidth={1280} title="Muqovani moslang (16:9)" onCancel={() => setCrop(null)} onDone={(f) => { setCrop(null); void upload(f); }} />}
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} aria-label="Yozuv nomi" className="field h-10 w-full text-[14px]" />
      <button type="button" onClick={() => setHidden(!hidden)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-2 hover:text-fg">
        {hidden ? <EyeOff size={14} /> : <Eye size={14} />} {hidden ? "Yashirin — ko'rsatish" : "Ommaga ko'rinadi — yashirish"}
      </button>
      {r.status === "ready" && courses.length > 0 && (
        <div className="flex gap-2">
          <select value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Kurs" className="field h-9 min-w-0 flex-1 text-[12.5px]">
            <option value="">Kursga dars qilish…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <button type="button" disabled={!course || toLesson} onClick={() => void addToCourse()} className="h-9 rounded-lg border border-line-2 px-3 text-[12.5px] font-semibold text-fg-2 hover:text-fg disabled:opacity-50">
            {toLesson ? <Loader2 size={13} className="animate-spin" /> : "Qo'shish"}
          </button>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="h-9 rounded-full px-3 text-[13px] font-semibold text-fg-3">Bekor</button>
        <button type="button" disabled={busy || upBusy || !title.trim()} onClick={() => void save()} className="btn-accent inline-flex h-9 items-center gap-1.5 px-4 text-[13px]">
          {busy && <Loader2 size={14} className="animate-spin" />} Saqlash
        </button>
      </div>
    </div>
  );
}
