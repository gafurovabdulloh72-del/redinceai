"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, FileText, Loader2, MessageSquareText, Paperclip, Send, Sparkles, Video, X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Avatar } from "@/components/ui";
import { UPLOAD_ACCEPT_DOCS, isImageAttachment, isVideoAttachment, uploadAttachment, type Attachment } from "@/components/chat/attachments";
import { PurchaseDialog } from "@/components/mentorship/PurchaseDialog";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { WR, formatSomTr } from "@/lib/i18n/dict/mentorship";
import { WORK_REVIEW } from "@/lib/mentorship/format";
import type { WorkReviewView } from "@/lib/mentorship/work-review";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * «Ishimni baholang» (2026-11-12) UI: ustoz sahifasidagi karta + so'rov varag'i, ustoz sozlamasi, ustozning kutish ro'yxati
 * va talabaning «Ish sharhlarim» bloki. Fayllar faqat `/api/media/review/…` himoyalangan manzili orqali ko'rsatiladi.
 */

type ApiJson<T = unknown> = { ok?: boolean; data?: T; error?: string; fields?: Record<string, string> };
const errOf = (j: ApiJson, fallback: string) => (j.fields && Object.values(j.fields)[0]) || j.error || fallback;

async function postJson<T>(url: string, method: string, body?: unknown): Promise<{ ok: boolean; j: ApiJson<T> }> {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as ApiJson<T>;
  return { ok: r.ok, j };
}

const isHttps = (v: string) => {
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" && /\.[a-z]{2,}$/i.test(u.hostname);
  } catch {
    return false;
  }
};

/* ------------------------------------------------------------------ */
/* Fayl ko'rinishi (himoyalangan manzil)                               */
/* ------------------------------------------------------------------ */
function ProtectedFile({ file }: { file: Attachment }) {
  const til = useLocale();
  if (isImageAttachment(file)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={file.url} alt={file.name} className="max-h-72 w-full rounded-[12px] bg-surface-2 object-contain" />;
  }
  if (isVideoAttachment(file)) {
    return <video src={file.url} poster={file.poster} controls controlsList="nodownload noremoteplayback" disablePictureInPicture playsInline preload="metadata" className="aspect-video w-full rounded-[12px] bg-black" />;
  }
  return (
    <a href={file.url} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-[12px] border border-line px-3 py-2 text-[13.5px] font-semibold text-fg-2 hover:border-fg hover:text-fg">
      <FileText size={15} /> <span className="max-w-[16rem] truncate">{file.name || tr(til, WR.openWork)}</span>
    </a>
  );
}

function WorkLink({ url }: { url: string }) {
  const til = useLocale();
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* noop */
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow ugc" className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-fg-2 hover:border-fg hover:text-fg" title={url}>
      <ExternalLink size={14} className="shrink-0" /> <span className="truncate">{tr(til, WR.openLink)} · {host}</span>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Ustoz sahifasidagi karta + so'rov varag'i                            */
/* ------------------------------------------------------------------ */
export function WorkReviewCard({ mentorId, price, days, about, loggedIn, isOwner, settingsHref }: { mentorId: string; price: number; days: number; about: string; loggedIn: boolean; isOwner: boolean; settingsHref: string }) {
  const til = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);

  function start() {
    if (!loggedIn) {
      router.push(`/auth/kirish?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    setOpen(true);
  }

  return (
    <section className="card mt-3 flex flex-col gap-4 rounded-[18px] p-4 sm:flex-row sm:items-center sm:p-5" data-work-review>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent max-sm:hidden">
        <MessageSquareText size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[16px] font-bold text-fg">{tr(til, WR.title)}</h2>
        <p className="mt-0.5 text-[14px] font-semibold text-accent-text">{WR.offer[til](formatSomTr(til, price), days)}</p>
        <p data-no-auto className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-fg-3">{about || tr(til, WR.cardLead)}</p>
        {isOwner && <p className="mt-1.5 text-[12.5px] text-fg-4">{tr(til, WR.ownerNote)}</p>}
      </div>
      {isOwner ? (
        <Link href={settingsHref} className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-line-2 px-5 text-[14px] font-semibold text-fg-2 hover:border-fg hover:text-fg">
          {tr(til, WR.configure)}
        </Link>
      ) : (
        <button type="button" onClick={start} className="btn-accent inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-[14.5px] font-semibold">
          <Send size={15} /> {tr(til, WR.send)}
        </button>
      )}
      {!isOwner && (
        <RequestSheet
          open={open}
          onClose={() => setOpen(false)}
          mentorId={mentorId}
          price={price}
          onCreated={(id, free) => {
            setOpen(false);
            if (free) {
              showToast(tr(til, WR.sent), "success");
              router.push("/kabinet/mentorlik#ish-sharhlari");
            } else setPayId(id);
          }}
        />
      )}
      {payId && <PurchaseDialog open onClose={() => { setPayId(null); router.push("/kabinet/mentorlik#ish-sharhlari"); }} type="review" id={payId} loggedIn />}
    </section>
  );
}

function RequestSheet({ open, onClose, mentorId, price, onCreated }: { open: boolean; onClose: () => void; mentorId: string; price: number; onCreated: (id: string, free: boolean) => void }) {
  const til = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const [workUrl, setWorkUrl] = useState("");
  const [file, setFile] = useState<Attachment | null>(null);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pick(f: File) {
    setUploading(true);
    setErr("");
    try {
      setFile(await uploadAttachment(f, { docs: true }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr(til, WR.failed));
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    const url = workUrl.trim();
    if (!url && !file) return setErr(tr(til, WR.needWork));
    if (url && !isHttps(url)) return setErr(tr(til, WR.httpsOnly));
    setBusy(true);
    setErr("");
    try {
      const { ok, j } = await postJson<{ id: string; free: boolean }>("/api/mentorlik/ish-sharh", "POST", { mentorId, ...(url ? { workUrl: url } : {}), ...(file ? { workFile: file } : {}), note: note.trim() });
      if (!ok || !j.data) throw new Error(errOf(j, tr(til, WR.failed)));
      setWorkUrl("");
      setFile(null);
      setNote("");
      onCreated(j.data.id, j.data.free);
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr(til, WR.failed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={tr(til, WR.title)} size="sm">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">{tr(til, WR.workLink)}</span>
          <input value={workUrl} onChange={(e) => setWorkUrl(e.target.value)} type="url" inputMode="url" maxLength={500} placeholder={tr(til, WR.workLinkPh)} className="field h-11 w-full text-[14px] max-md:text-[16px]" />
        </label>
        <div className="flex items-center gap-3 text-[12px] text-fg-4">
          <span className="h-px flex-1 bg-line" /> {tr(til, WR.or)} <span className="h-px flex-1 bg-line" />
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={UPLOAD_ACCEPT_DOCS}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void pick(f);
            }}
          />
          {file ? (
            <div className="flex items-center gap-2 rounded-[12px] border border-line px-3 py-2.5">
              {isVideoAttachment(file) ? <Video size={16} className="shrink-0 text-fg-3" /> : <Paperclip size={16} className="shrink-0 text-fg-3" />}
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-fg">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} aria-label={tr(til, WR.removeFile)} className="grid h-8 w-8 place-items-center rounded-full text-fg-3 hover:bg-fg/8">
                <X size={15} />
              </button>
            </div>
          ) : (
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-line-2 px-3 py-4 text-[14px] font-semibold text-fg-2 hover:border-fg hover:text-fg disabled:opacity-60">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />} {uploading ? tr(til, WR.uploading) : tr(til, WR.uploadFile)}
              {!uploading && <span className="font-normal text-fg-4">· {tr(til, WR.fileHint)}</span>}
            </button>
          )}
        </div>
        <label className="block">
          <span className="mb-1 flex justify-between text-[12.5px] font-semibold text-fg-2">
            {tr(til, WR.note)} <span className="font-normal text-fg-4 tabular-nums">{note.length}/{WORK_REVIEW.noteMax}</span>
          </span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={WORK_REVIEW.noteMax} rows={4} placeholder={tr(til, WR.notePh)} className="field w-full resize-y py-2.5 text-[14px] leading-relaxed max-md:text-[16px]" />
        </label>
        {err && <p className="text-[13px] text-danger">{err}</p>}
        <button type="submit" disabled={busy || uploading} className="btn-accent inline-flex h-12 w-full items-center justify-center gap-2 text-[15px] font-semibold disabled:opacity-50">
          {busy && <Loader2 size={16} className="animate-spin" />} {price > 0 ? tr(til, WR.next) : tr(til, WR.sendFree)}
        </button>
      </form>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Ustoz sozlamasi (kabinet «Sahifam» va admin studiyasi)               */
/* ------------------------------------------------------------------ */
export function WorkReviewSettings({ mentorId, initial }: { mentorId: string; initial: { enabled: boolean; price: number; about: string; days: number } }) {
  const til = useLocale();
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [price, setPrice] = useState(String(initial.price));
  const [days, setDays] = useState(String(initial.days));
  const [about, setAbout] = useState(initial.about);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const { ok, j } = await postJson(`/api/mentorlik/ustoz/${mentorId}/ish-sharh`, "PUT", { enabled, price: Number(price.replace(/\s/g, "") || 0), days: Number(days || 0), about: about.trim() });
      if (!ok) throw new Error(errOf(j, tr(til, WR.notSaved)));
      showToast(tr(til, WR.saved), "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr(til, WR.notSaved), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-4 p-4 sm:p-5" id="ish-sharhi-sozlama">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><MessageSquareText size={16} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-fg">{tr(til, WR.settingsTitle)}</h2>
          <p className="mt-0.5 text-[13px] text-fg-3">{tr(til, WR.settingsLead)}</p>
        </div>
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-[13px] font-semibold text-fg-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" aria-label={tr(til, WR.enable)} />
          <span className="max-sm:sr-only">{tr(til, WR.enable)}</span>
        </label>
      </div>
      <div className={cn("grid gap-3 sm:grid-cols-2", !enabled && "opacity-60")}>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">{tr(til, WR.price)}</span>
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d\s]/g, ""))} inputMode="numeric" className="field h-11 w-full text-[14px] tabular-nums max-md:text-[16px]" />
          <span className="mt-1 block text-[11.5px] text-fg-4">{tr(til, WR.priceHint)}</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">{tr(til, WR.days)}</span>
          <input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 2))} type="number" min={WORK_REVIEW.daysMin} max={WORK_REVIEW.daysMax} inputMode="numeric" className="field h-11 w-full text-[14px] tabular-nums max-md:text-[16px]" />
        </label>
      </div>
      <label className={cn("block", !enabled && "opacity-60")}>
        <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">{tr(til, WR.about)}</span>
        <textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={WORK_REVIEW.aboutMax} rows={3} placeholder={tr(til, WR.aboutPh)} className="field w-full resize-y py-2.5 text-[14px] leading-relaxed max-md:text-[16px]" />
      </label>
      <button type="button" onClick={() => void save()} disabled={busy} className="btn-accent inline-flex h-11 items-center gap-2 rounded-full px-6 text-[14.5px] font-semibold disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />} {tr(til, WR.save)}
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Ustozning kutish ro'yxati (kabinet → Vazifalar)                      */
/* ------------------------------------------------------------------ */
export function WorkReviewInbox({ waiting, done }: { waiting: WorkReviewView[]; done: WorkReviewView[] }) {
  const til = useLocale();
  return (
    <section id="ish-sharhlari" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-bold text-fg">
          {tr(til, WR.inboxTitle)} {waiting.length > 0 && <span className="ml-1 rounded-full bg-accent px-2 py-0.5 align-middle text-[12px] font-bold text-white">{waiting.length}</span>}
        </h2>
        <p className="text-[12.5px] text-fg-3">{waiting.length ? WR.waitingN[til](waiting.length) : tr(til, WR.inboxLead)}</p>
      </div>
      {waiting.length === 0 ? (
        <p className="card p-5 text-center text-[13.5px] text-fg-3 m-flat">{tr(til, WR.noWaiting)}</p>
      ) : (
        <ul className="space-y-3">
          {waiting.map((r) => (
            <InboxItem key={r.id} r={r} />
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none text-[13px] font-semibold text-fg-3 hover:text-fg [&::-webkit-details-marker]:hidden">
            {tr(til, WR.recentDone)} · {done.length}
          </summary>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {done.map((r) => (
              <li key={r.id} className="py-3">
                <p className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
                  <Avatar name={r.student.name} src={r.student.avatarUrl} size={22} decorative /> {r.student.name}
                  <span className="ml-auto text-[12px] font-normal text-fg-4">{r.answeredAt ? formatDateTime(r.answeredAt, til) : ""}</span>
                </p>
                <p data-no-auto className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] text-fg-3">{r.response}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function InboxItem({ r }: { r: WorkReviewView }) {
  const til = useLocale();
  const router = useRouter();
  const vRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [video, setVideo] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const overdue = r.dueAt != null && r.dueAt < Date.now();

  async function pickVideo(f: File) {
    if (!/^video\//.test(f.type) && !/\.(?:mp4|webm|mov)$/i.test(f.name)) return showToast(tr(til, WR.videoOnly), "error");
    setUploading(true);
    try {
      setVideo(await uploadAttachment(f, { docs: true }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr(til, WR.failed), "error");
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    if (text.trim().length < WORK_REVIEW.responseMin) return showToast(WR.minChars[til](WORK_REVIEW.responseMin), "error");
    setBusy(true);
    try {
      const { ok, j } = await postJson(`/api/mentorlik/ish-sharh/${r.id}/javob`, "POST", { response: text.trim(), ...(video ? { responseVideo: video } : {}) });
      if (!ok) throw new Error(errOf(j, tr(til, WR.failed)));
      showToast(tr(til, WR.answered), "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr(til, WR.failed), "error");
      setBusy(false);
    }
  }

  return (
    <li className="card space-y-3 p-4 sm:p-5 m-flat" data-review-id={r.id}>
      <div className="flex flex-wrap items-center gap-2">
        <Avatar name={r.student.name} src={r.student.avatarUrl} size={30} decorative />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold text-fg">{r.student.name}</span>
          <span className="block text-[12px] text-fg-3">{formatSomTr(til, r.price)}</span>
        </span>
        {r.dueAt != null && (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold", overdue ? "bg-danger/10 text-danger" : "bg-fg/6 text-fg-2")}>
            {overdue ? <AlertTriangle size={13} /> : <Clock size={13} />} {overdue ? tr(til, WR.overdue) : WR.due[til](formatDateTime(r.dueAt, til))}
          </span>
        )}
      </div>
      {(r.workUrl || r.workFile) && (
        <div className="space-y-2">
          {r.workUrl && <WorkLink url={r.workUrl} />}
          {r.workFile && <ProtectedFile file={r.workFile} />}
        </div>
      )}
      {r.note && (
        <div className="rounded-[12px] bg-fg/[0.04] p-3">
          <p className="text-[11.5px] font-semibold text-fg-3">{tr(til, WR.studentNote)}</p>
          <p data-no-auto className="mt-0.5 whitespace-pre-line text-[13.5px] text-fg-2">{r.note}</p>
        </div>
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={WORK_REVIEW.responseMax} rows={5} placeholder={tr(til, WR.answerPh)} aria-label={tr(til, WR.answerPh)} className="field w-full resize-y py-2.5 text-[14px] leading-relaxed max-md:text-[16px]" />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={vRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void pickVideo(f);
          }}
        />
        {video ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-fg-2">
            <Video size={14} /> <span className="max-w-[12rem] truncate">{video.name}</span>
            <button type="button" onClick={() => setVideo(null)} aria-label={tr(til, WR.removeFile)} className="text-fg-3 hover:text-fg"><X size={14} /></button>
          </span>
        ) : (
          <button type="button" disabled={uploading} onClick={() => vRef.current?.click()} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 hover:border-fg hover:text-fg disabled:opacity-60">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />} {uploading ? tr(til, WR.uploading) : tr(til, WR.addVideo)}
          </button>
        )}
        <button type="button" disabled={busy || uploading} onClick={() => void send()} className="btn-accent ml-auto inline-flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-semibold disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />} {tr(til, WR.sendAnswer)}
        </button>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Talabaning «Ish sharhlarim» bloki (kabinet → Mentorlik)              */
/* ------------------------------------------------------------------ */
export function MyWorkReviews({ items }: { items: WorkReviewView[] }) {
  const til = useLocale();
  const router = useRouter();
  const confirm = useConfirm();
  const [payId, setPayId] = useState<string | null>(null);
  if (!items.length) return null;

  async function cancel(id: string) {
    if (!(await confirm({ title: tr(til, WR.cancelQ), danger: true }))) return;
    const { ok, j } = await postJson(`/api/mentorlik/ish-sharh/${id}`, "DELETE");
    if (!ok) return showToast(errOf(j, tr(til, WR.error)), "error");
    showToast(tr(til, WR.cancelled), "success");
    router.refresh();
  }

  /** Muddati o'tgan so'rov: pullik — qaytarishni so'rash (admin hal qiladi), bepul — bekor qilish */
  async function askRefund(r: WorkReviewView) {
    if (!(await confirm({ title: r.price > 0 ? tr(til, WR.askRefundQ) : tr(til, WR.cancelQ), danger: r.price <= 0 }))) return;
    const { ok, j } = await postJson(`/api/mentorlik/ish-sharh/${r.id}/qaytarish`, "POST");
    if (!ok) return showToast(errOf(j, tr(til, WR.error)), "error");
    showToast(r.price > 0 ? tr(til, WR.refundAsked) : tr(til, WR.cancelled), "success");
    router.refresh();
  }

  return (
    <section id="ish-sharhlari" className="space-y-3">
      <h2 className="flex items-center gap-2 text-[16px] font-bold text-fg">
        <Sparkles size={16} className="text-accent" /> {tr(til, WR.myTitle)}
      </h2>
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id} className="card space-y-3 p-4 sm:p-5 m-flat" data-review-id={r.id}>
            <div className="flex flex-wrap items-center gap-2">
              <Avatar name={r.mentor.name} src={r.mentor.avatarUrl} size={30} decorative />
              <span className="min-w-0 flex-1">
                {r.mentor.slug ? (
                  <Link href={`/mentorlik/ustoz/${r.mentor.slug}`} className="block truncate text-[14.5px] font-semibold text-fg hover:underline">{r.mentor.name}</Link>
                ) : (
                  <span className="block truncate text-[14.5px] font-semibold text-fg">{r.mentor.name}</span>
                )}
                <span className="block text-[12px] text-fg-3">
                  {formatSomTr(til, r.price)} · {formatDateTime(r.createdAt, til)}
                </span>
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold",
                  r.status === "done" ? "bg-success-soft text-success-text" : r.status === "waiting" ? "bg-fg/6 text-fg-2" : r.status === "pending_payment" ? "bg-accent-soft text-accent-text" : "bg-fg/6 text-fg-3",
                )}
              >
                {r.status === "done" && <CheckCircle2 size={13} />} {tr(til, WR.status[r.status])}
              </span>
            </div>
            {r.status === "waiting" && r.dueAt != null && !r.overdue && <p className="text-[12.5px] text-fg-3">{WR.expectedBy[til](formatDateTime(r.dueAt, til))}</p>}
            {r.overdue && (
              <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-danger/[0.06] p-3">
                <p className="min-w-0 flex-1 text-[13px] font-medium text-danger">{tr(til, WR.overdueNote)}</p>
                {r.refundRequestedAt ? (
                  <span className="text-[12.5px] font-semibold text-fg-3">{tr(til, WR.refundAsked)}</span>
                ) : (
                  <button type="button" onClick={() => void askRefund(r)} className="inline-flex h-9 items-center rounded-full border border-danger/40 px-4 text-[13px] font-semibold text-danger hover:bg-danger/10">
                    {r.price > 0 ? tr(til, WR.askRefund) : tr(til, WR.cancelOverdue)}
                  </button>
                )}
              </div>
            )}
            {(r.workUrl || r.workFile || r.note) && (
              <details className="group rounded-[12px] bg-fg/[0.03] p-3" open={r.status !== "done"}>
                <summary className="cursor-pointer list-none text-[12.5px] font-semibold text-fg-3 [&::-webkit-details-marker]:hidden">{tr(til, WR.yourWork)}</summary>
                <div className="mt-2 space-y-2">
                  {r.workUrl && <WorkLink url={r.workUrl} />}
                  {r.workFile && <ProtectedFile file={r.workFile} />}
                  {r.note && <p data-no-auto className="whitespace-pre-line text-[13.5px] text-fg-2">{r.note}</p>}
                </div>
              </details>
            )}
            {(r.status === "done" || r.status === "refunded") && r.response && (
              <div className="rounded-[12px] border border-line p-3 sm:p-4">
                <p className="text-[12px] font-bold text-fg-3">{tr(til, WR.mentorResponse)}{r.answeredAt ? ` · ${formatDateTime(r.answeredAt, til)}` : ""}</p>
                <p data-no-auto className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-fg">{r.response}</p>
                {r.responseVideo && (
                  <div className="mt-3">
                    <ProtectedFile file={r.responseVideo} />
                  </div>
                )}
              </div>
            )}
            {r.status === "pending_payment" && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPayId(r.id)} className="btn-accent inline-flex h-10 items-center rounded-full px-5 text-[14px] font-semibold">
                  {tr(til, WR.pay)} · {formatSomTr(til, r.price)}
                </button>
                <button type="button" onClick={() => void cancel(r.id)} className="inline-flex h-10 items-center rounded-full border border-line-2 px-4 text-[13.5px] font-semibold text-fg-2 hover:border-fg hover:text-fg">
                  {tr(til, WR.cancel)}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {payId && <PurchaseDialog open onClose={() => setPayId(null)} type="review" id={payId} loggedIn />}
    </section>
  );
}
