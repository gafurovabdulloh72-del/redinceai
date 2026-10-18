"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Paperclip, Send, X } from "lucide-react";
import { Avatar } from "@/components/ui";
import { MAX_ATTACHMENTS, UPLOAD_ACCEPT_DOCS, formatBytes, uploadAttachment, type Attachment } from "@/components/chat/attachments";
import { AttachmentList, QuoteBlock, ReplyBar, ReplyButton, TypingDots, typingLabel } from "@/components/chat/MessageParts";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import type { QuoteView } from "@/lib/chat/quote";
import { GROUP_MSG_MAX } from "@/lib/groups/limits";
import type { GroupMessageView, UserBrief } from "@/lib/groups/service";
import { cn } from "@/lib/utils";
import { MentionField } from "./MentionInput";
import { RichText } from "./RichText";

/** Xabardan iqtibos (javob paneli uchun) — server bilan bir xil qoida */
function quoteOf(m: GroupMessageView): QuoteView {
  const a = m.attachments;
  const kind = a.some((x) => x.type.startsWith("audio/")) ? "voice" : a.some((x) => x.type.startsWith("video/")) ? "video" : a.some((x) => x.type.startsWith("image/")) ? "image" : a.length ? "file" : "text";
  const label = { voice: "Ovozli xabar", image: "Rasm", video: "Video", file: "Fayl", text: "" }[kind];
  const text = m.body.replace(/\s+/g, " ").trim();
  return { id: m.id, body: text ? (text.length > 140 ? `${text.slice(0, 139)}…` : text) : label, senderName: m.mine ? "Siz" : m.sender.name, kind };
}

/** Polling oralig'i — 2-bosqichda (real-time qatlam) WebSocket/SSE bilan almashtiriladi */
const POLL_MS = 4000;

function dayOf(ms: number) {
  return new Date(ms).toLocaleDateString("uz-UZ", { day: "numeric", month: "long" });
}
function timeOf(ms: number) {
  return new Date(ms).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

function SenderName({ u }: { u: UserBrief }) {
  const cls = "mb-0.5 block truncate text-[12px] font-bold text-accent-text";
  return u.slug ? (
    <Link href={`/mutaxassislar/${u.slug}`} className={cn(cls, "underline-offset-2 hover:underline")}>
      {u.name}
    </Link>
  ) : (
    <span className={cls}>{u.name}</span>
  );
}

type ApiResp = { ok: boolean; data?: { items: GroupMessageView[]; seen?: { messageId: string; count: number } | null; typing?: string[] }; error?: string; fields?: Record<string, string> };

/**
 * Jamoa chati (faqat faol a'zolar). Birinchi yuklashda butun tarix, keyin har 4 soniyada `?after=<oxirgiId>`.
 * Foydalanuvchi pastda tursa yangi xabarda avtomatik tushadi; yuqoriga chiqib o'qiyotgan bo'lsa — tegilmaydi.
 */
export function GroupChat({ slug, membersCount }: { slug: string; membersCount: number }) {
  const base = `/api/groups/${encodeURIComponent(slug)}/chat`;
  const [msgs, setMsgs] = useState<GroupMessageView[] | null>(null);
  const [seen, setSeen] = useState<{ messageId: string; count: number } | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<GroupMessageView | null>(null);
  const [typing, setTyping] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const typingSentAt = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastId = useRef<string | null>(null);
  const stick = useRef(true);

  const fetchNew = useCallback(async () => {
    const url = lastId.current ? `${base}?after=${encodeURIComponent(lastId.current)}` : base;
    let j: ApiResp;
    try {
      const res = await fetch(url, { cache: "no-store" });
      j = (await res.json()) as ApiResp;
    } catch {
      return;
    }
    if (!j.ok || !j.data) return;
    if (j.data.seen !== undefined) setSeen(j.data.seen ?? null);
    if (j.data.typing) setTyping(j.data.typing);
    const items = j.data.items;
    if (lastId.current === null) {
      setMsgs(items);
    } else if (items.length) {
      setMsgs((prev) => {
        const seen = new Set((prev ?? []).map((m) => m.id));
        return [...(prev ?? []), ...items.filter((m) => !seen.has(m.id))];
      });
    }
    if (items.length) lastId.current = items[items.length - 1].id;
  }, [base]);

  useEffect(() => {
    void fetchNew();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchNew();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [fetchNew]);

  useEffect(() => {
    if (stick.current) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [msgs]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    const room = MAX_ATTACHMENTS - files.length;
    if (room <= 0) {
      setError(`Ko'pi bilan ${MAX_ATTACHMENTS} ta fayl`);
      return;
    }
    const picked = Array.from(list).slice(0, room);
    setUploading(true);
    setError(null);
    try {
      const added: Attachment[] = [];
      for (const f of picked) added.push(await uploadAttachment(f, { docs: true }));
      setFiles((p) => [...p, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fayl yuklanmadi");
    } finally {
      setUploading(false);
    }
  }

  async function deliver(body: string, attachments: Attachment[]) {
    const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, attachments, replyToId: replyTo?.id ?? null }) });
    const j = (await res.json()) as ApiResp;
    if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Yuborilmadi");
    setReplyTo(null);
    stick.current = true;
    await fetchNew();
  }

  async function send() {
    const body = text.trim();
    if ((!body && files.length === 0) || busy || uploading) return;
    setBusy(true);
    setError(null);
    try {
      await deliver(body, files);
      setText("");
      setFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yuborilmadi");
    } finally {
      setBusy(false);
    }
  }

  async function sendVoice(a: Attachment) {
    setError(null);
    try {
      await deliver("", [a]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ovozli xabar yuborilmadi");
    }
  }

  /** "Yozmoqda…" signali — 2.5 soniyada bir martadan ko'p emas */
  function pingTyping(v: string) {
    if (!v.trim()) return;
    const now = Date.now();
    if (now - typingSentAt.current < 2500) return;
    typingSentAt.current = now;
    void fetch(`${base}/typing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typing: true }) }).catch(() => undefined);
  }

  const canSend = (text.trim().length > 0 || files.length > 0) && !busy && !uploading;

  return (
    <div className="card flex flex-col overflow-hidden" style={{ height: "min(70vh, 640px)" }}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-[12.5px] text-fg-3">
        <span className="font-semibold text-fg-2">Jamoa chati · {membersCount} a&apos;zo</span>
        <span className="hidden sm:inline">Faqat a&apos;zolar ko&apos;radi</span>
      </div>

      <div ref={listRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        {!msgs ? (
          <div className="space-y-2.5">
            <span className="block h-10 w-2/3 rounded-2xl skeleton" />
            <span className="ml-auto block h-10 w-1/2 rounded-2xl skeleton" />
            <span className="block h-10 w-1/2 rounded-2xl skeleton" />
          </div>
        ) : msgs.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-fg-3">Birinchi xabarni yozing — jamoa suhbati shu yerda boshlanadi.</p>
        ) : (
          msgs.map((m, i) => {
            const prev = i > 0 ? msgs[i - 1] : null;
            const newDay = !prev || dayOf(prev.at) !== dayOf(m.at);
            const sameSender = Boolean(prev && !newDay && prev.sender.id === m.sender.id);
            return (
              <div key={m.id} className={cn("animate-msg-in", sameSender ? "mt-1" : "mt-3")}>
                {newDay && <p className="my-3 text-center text-[11px] font-semibold uppercase tracking-wide text-fg-4">{dayOf(m.at)}</p>}
                <div className={cn("group flex items-end gap-1.5", m.mine ? "justify-end" : "justify-start")}>
                  {!m.mine && <span className="w-7 shrink-0">{!sameSender && <Avatar name={m.sender.name} src={m.sender.avatarUrl} size={28} decorative />}</span>}
                  <div id={`msg-${m.id}`} className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 transition-shadow", m.mine ? "rounded-br-md bg-ink text-ink-fg" : "rounded-bl-md border border-line bg-surface text-fg")}>
                    {!m.mine && !sameSender && <SenderName u={m.sender} />}
                    {m.replyTo && <QuoteBlock q={m.replyTo} mine={m.mine} />}
                    <AttachmentList attachments={m.attachments} mine={m.mine} />
                    {m.body && (
                      <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">
                        <RichText text={m.body} />
                      </p>
                    )}
                    <p className={cn("mt-0.5 text-right text-[11px]", m.mine ? "text-ink-fg/55" : "text-fg-4")}>
                      {timeOf(m.at)}
                      {m.mine && seen?.messageId === m.id && seen.count > 0 && <span className="ml-1.5">· {seen.count} kishi ko&apos;rdi</span>}
                    </p>
                  </div>
                  <ReplyButton mine={m.mine} onClick={() => setReplyTo(m)} />
                </div>
              </div>
            );
          })
        )}
        {typing.length > 0 && (
          <div className="mt-2">
            <TypingDots label={typingLabel(typing)} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line p-2.5 sm:p-3">
        {replyTo && <ReplyBar q={quoteOf(replyTo)} onCancel={() => setReplyTo(null)} />}
        {files.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {files.map((a, i) => (
              <li key={a.url} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] text-fg-2">
                <Paperclip size={12} className="shrink-0" />
                <span className="truncate">{a.name}</span>
                <span className="shrink-0 text-fg-4">{formatBytes(a.size)}</span>
                <button type="button" aria-label="Olib tashlash" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="shrink-0 text-fg-3 transition hover:text-fg">
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          {!recording && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || files.length >= MAX_ATTACHMENTS}
              aria-label="Fayl biriktirish"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-2 text-fg-2 transition hover:text-fg disabled:opacity-50"
            >
              <Paperclip size={16} />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={UPLOAD_ACCEPT_DOCS}
            className="sr-only"
            onChange={(e) => {
              void pick(e.target.files);
              e.target.value = "";
            }}
          />
          {!recording && (
            <MentionField
              multiline
              value={text}
              onChange={(v) => {
                setText(v);
                pingTyping(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
                if (e.key === "Escape" && replyTo) setReplyTo(null);
              }}
              maxLength={GROUP_MSG_MAX}
              rows={1}
              placeholder={replyTo ? "Javob yozing…" : "Xabar yozing… (Enter — yuborish, @ism — eslatish)"}
              ariaLabel="Xabar"
              wrapperClassName="min-w-0 flex-1"
              className="field max-h-32 min-h-10 w-full resize-none py-2.5 text-[14px] leading-snug"
            />
          )}
          {text.trim() || files.length > 0 ? (
            <button type="button" onClick={() => void send()} disabled={!canSend} aria-label="Yuborish" className="btn-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50">
              <Send size={16} />
            </button>
          ) : (
            <VoiceRecorder onRecorded={sendVoice} onError={setError} onPhase={setRecording} disabled={uploading} />
          )}
        </div>
        {(error || uploading) && <p className={cn("mt-1.5 text-[12px] font-semibold", error ? "text-danger-text" : "text-fg-3")}>{error ?? "Fayl yuklanmoqda…"}</p>}
      </div>
    </div>
  );
}
