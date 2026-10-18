"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { AlertCircle, Check, CheckCheck, ChevronDown, FileText, ImageOff, ImagePlus, Lock, MessageCircle, Plus, RotateCcw, Send, ShieldAlert, X, Zap } from "lucide-react";
import { Spinner } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { usePresence } from "@/components/motion/usePresence";
import { clock, dayKey, dayLabel, relativeTime } from "@/lib/chat/time";
import { cn } from "@/lib/utils";
import { MAX_ATTACHMENTS, UPLOAD_ACCEPT_DOCS, formatBytes, isImageAttachment, isVideoAttachment, uploadAttachment, type Attachment } from "./attachments";
import { DayPill, claimMedia, useNowTick } from "./MessageParts";

/* ------------------------------------------------------------------ */
/* Turlar (GET/POST /api/orders/[id]/messages bilan bir xil)           */
/* ------------------------------------------------------------------ */
export interface ChatMessage {
  id: string;
  body: string;
  attachments: Attachment[];
  mine: boolean;
  sender: "client" | "specialist" | "system";
  senderName: string | null;
  readAt: number | null;
  createdAt: number;
  /** Faqat klientda: optimistik yuborish holati */
  pending?: "sending" | "failed";
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };
type ListData = { messages: ChatMessage[]; readUpTo: number | null; role: "client" | "specialist" | "admin"; canWrite: boolean };

const POLL_MS = 5000;
const MAX_BODY = 4000;
const QUICK_KEY = "redince:quick-replies";

/** Mutaxassis uchun tayyor javoblar (F39) */
const DEFAULT_QUICK_REPLIES = [
  "Assalomu alaykum! Buyurtmangizni oldim, tafsilotlarni ko'rib chiqyapman.",
  "Narx va muddatni aniqlashtirsak: qachongacha kerak va qanday formatda?",
  "Ish jarayonda — oraliq natijani tez orada yuboraman.",
  "Ish tayyor, tekshirib ko'ring. Tuzatishlar bo'lsa shu yerga yozing.",
  "Rahmat! Hamkorlikdan xursandman — sharh qoldirsangiz minnatdor bo'lardim.",
];

/** Matndagi http(s) havolalarni bosiladigan qilish (boshqa hech qanday HTML yo'q) */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-medium underline decoration-1 underline-offset-2">
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function readQuickReplies(): string[] {
  try {
    const raw = window.localStorage.getItem(QUICK_KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 12) : [];
  } catch {
    return [];
  }
}
function writeQuickReplies(list: string[]) {
  try {
    window.localStorage.setItem(QUICK_KEY, JSON.stringify(list));
  } catch {
    /* saqlanmasa ham ishlayveradi */
  }
}

/** Rasm yuklanmasa (o'chirilgan fayl, tarmoq) — buzilgan rasm o'rniga ikonka */
function Thumb({ a }: { a: Attachment }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-fg-4">
        <ImageOff size={16} />
        <span className="w-full truncate text-center text-[11px]">{a.name}</span>
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={a.url} alt={a.name} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />;
}

/** Biriktirmalar: rasmlar — kichik ko'rinish, video — pleyer, qolganlari — fayl chipi */
export function AttachmentList({ items, className, compact = false }: { items: Attachment[]; className?: string; compact?: boolean }) {
  if (!items.length) return null;
  const images = items.filter((a) => isImageAttachment(a));
  const videos = items.filter((a) => !isImageAttachment(a) && isVideoAttachment(a));
  const files = items.filter((a) => !isImageAttachment(a) && !isVideoAttachment(a));
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {videos.map((a) => (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video key={a.url} src={a.url} controls preload="metadata" playsInline onPlay={(e) => claimMedia(e.currentTarget)} title={a.name} className={cn("w-full rounded-[10px] bg-black/20", compact ? "max-h-56" : "max-h-72")} />
      ))}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((a) => (
            <a
              key={a.url}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn("relative block overflow-hidden rounded-[10px] bg-surface-3", compact ? "h-16 w-16" : "h-20 w-20 sm:h-24 sm:w-24")}
              title={a.name}
            >
              <Thumb a={a} />
            </a>
          ))}
        </div>
      )}
      {files.map((a) => (
        <a
          key={a.url}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-fg-2 transition hover:border-fg"
        >
          <FileText size={14} className="shrink-0 text-fg-3" />
          <span className="truncate">{a.name}</span>
          {a.size > 0 && <span className="shrink-0 text-fg-4">{formatBytes(a.size)}</span>}
        </a>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */
export function OrderChat({
  orderId,
  role,
  counterpartName,
  initialCount = 0,
  initialUnread = 0,
  defaultOpen = false,
}: {
  orderId: string;
  /** Ko'ruvchining roli shu buyurtmada (admin — faqat o'qiydi) */
  role: "client" | "specialist" | "admin";
  counterpartName: string;
  initialCount?: number;
  initialUnread?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [items, setItems] = useState<ChatMessage[] | null>(null);
  const [count, setCount] = useState(initialCount);
  const [unread, setUnread] = useState(initialUnread);
  const [readUpTo, setReadUpTo] = useState<number | null>(null);
  const [canWrite, setCanWrite] = useState(role !== "admin");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [custom, setCustom] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draftTpl, setDraftTpl] = useState("");
  /** Tez javoblar qatori yig'iladigan (doimiy chip qatori shovqin qilmasin) */
  const [quickOpen, setQuickOpen] = useState(false);
  /** Sensorli ekran: Enter — yangi qator */
  const [coarse, setCoarse] = useState(false);
  const locale = useLocale();
  const now = useNowTick(60_000);
  const panel = usePresence(open, 160);
  useEffect(() => setCoarse(window.matchMedia("(pointer: coarse)").matches), []);

  const scroller = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lastAt = useRef<number>(0);
  const busy = useRef(false);
  const stickBottom = useRef(true);
  const panelId = `chat-${orderId}`;

  useEffect(() => {
    if (role === "specialist") setCustom(readQuickReplies());
  }, [role]);

  const merge = useCallback((incoming: ChatMessage[], replace = false) => {
    setItems((cur) => {
      const base = replace || !cur ? [] : cur;
      const map = new Map(base.map((m) => [m.id, m] as const));
      for (const m of incoming) map.set(m.id, m);
      const next = [...map.values()].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
      const real = next.filter((m) => !m.pending);
      if (real.length) lastAt.current = Math.max(lastAt.current, real[real.length - 1].createdAt);
      setCount(real.length);
      return next;
    });
  }, []);

  /** Birinchi yuklash (to'liq) yoki polling (?after= — 2 soniya ustma-ust, id bo'yicha birlashtiriladi) */
  const load = useCallback(
    async (full: boolean) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const q = !full && lastAt.current ? `?after=${Math.max(0, lastAt.current - 2000)}` : "";
        const res = await fetch(`/api/orders/${orderId}/messages${q}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiResponse<ListData> | null;
        if (!json) throw new Error("Server javob bermadi");
        if (!json.ok) throw new Error(json.error);
        merge(json.data.messages, full);
        setReadUpTo(json.data.readUpTo);
        setCanWrite(json.data.canWrite);
        setUnread(0);
        setLoadErr(null);
      } catch (e) {
        setLoadErr(e instanceof Error ? e.message : "Xabarlarni yuklab bo'lmadi");
      } finally {
        busy.current = false;
      }
    },
    [orderId, merge],
  );

  // Ochilganda yuklash + har 5 soniyada (sahifa ko'rinib turganda) yangilash
  useEffect(() => {
    if (!open) return;
    void load(items == null);
    let timer: number | null = null;
    const tick = () => {
      if (document.visibilityState === "visible") void load(false);
    };
    const start = () => {
      if (timer == null) timer = window.setInterval(tick, POLL_MS);
    };
    const stop = () => {
      if (timer != null) window.clearInterval(timer);
      timer = null;
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void load(false);
        start();
      } else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
    // items atayin kuzatilmaydi — faqat ochish/yopishda qayta ulanadi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, load]);

  // Yangi xabar kelganda pastga (foydalanuvchi yuqoriga aylantirmagan bo'lsa)
  useEffect(() => {
    const el = scroller.current;
    if (el && stickBottom.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const pickFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!list.length) return;
    const room = MAX_ATTACHMENTS - files.length;
    if (room <= 0) {
      setSendErr(`Bitta xabarga ko'pi bilan ${MAX_ATTACHMENTS} ta fayl`);
      return;
    }
    setSendErr(null);
    for (const f of list.slice(0, room)) {
      setUploading((n) => n + 1);
      try {
        const a = await uploadAttachment(f, { docs: true });
        setFiles((cur) => (cur.some((x) => x.url === a.url) ? cur : [...cur, a]));
      } catch (err) {
        setSendErr(err instanceof Error ? err.message : "Faylni yuklab bo'lmadi");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (list.length > room) setSendErr(`Bitta xabarga ko'pi bilan ${MAX_ATTACHMENTS} ta fayl`);
  };

  const sendNow = async (body: string, attachments: Attachment[], retryId?: string) => {
    const tempId = retryId ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const temp: ChatMessage = { id: tempId, body, attachments, mine: true, sender: role === "client" ? "client" : "specialist", senderName: null, readAt: null, createdAt: Date.now(), pending: "sending" };
    stickBottom.current = true;
    setItems((cur) => [...(cur ?? []).filter((m) => m.id !== tempId), temp]);
    try {
      const res = await fetch(`/api/orders/${orderId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, attachments }) });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ message: ChatMessage }> | null;
      if (!json) throw new Error("Server javob bermadi");
      if (!json.ok) throw new Error(json.fields ? Object.values(json.fields)[0] || json.error : json.error);
      setItems((cur) => (cur ?? []).filter((m) => m.id !== tempId));
      merge([json.data.message]);
      setSendErr(null);
    } catch (e) {
      setItems((cur) => (cur ?? []).map((m) => (m.id === tempId ? { ...m, pending: "failed" as const } : m)));
      setSendErr(e instanceof Error ? e.message : "Xabar yuborilmadi");
    }
  };

  const submit = () => {
    const body = text.trim();
    if ((!body && !files.length) || uploading > 0) return;
    if (body.length > MAX_BODY) {
      setSendErr(`Xabar ${MAX_BODY} belgidan oshmasin`);
      return;
    }
    const atts = files;
    setText("");
    setFiles([]);
    window.requestAnimationFrame(() => autoGrow(textRef.current));
    void sendNow(body, atts);
  };

  // Sensorli ekranda Enter — yangi qator (yuborish tugma yoki Ctrl/Cmd+Enter bilan); desktopda Enter yuboradi, Shift+Enter — yangi qator
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    if (coarse ? e.ctrlKey || e.metaKey : !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const applyTemplate = (t: string) => {
    setText((cur) => (cur.trim() ? `${cur.trimEnd()}\n${t}` : t));
    window.requestAnimationFrame(() => {
      autoGrow(textRef.current);
      textRef.current?.focus();
    });
  };
  const saveTemplate = () => {
    const t = draftTpl.trim().slice(0, 300);
    if (!t) return setAdding(false);
    const next = [...custom.filter((x) => x !== t), t].slice(-12);
    setCustom(next);
    writeQuickReplies(next);
    setDraftTpl("");
    setAdding(false);
  };
  const removeTemplate = (t: string) => {
    const next = custom.filter((x) => x !== t);
    setCustom(next);
    writeQuickReplies(next);
  };

  const rows = useMemo(() => {
    const out: Array<{ day: string; label: string; list: ChatMessage[] }> = [];
    for (const m of items ?? []) {
      const k = dayKey(m.createdAt);
      const last = out[out.length - 1];
      if (last && last.day === k) last.list.push(m);
      else out.push({ day: k, label: dayLabel(m.createdAt, locale, now), list: [m] });
    }
    return out;
  }, [items, locale, now]);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition",
          open ? "border-fg bg-fg/4 text-fg" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
        )}
      >
        <MessageCircle size={15} className={unread > 0 ? "text-accent" : undefined} />
        Chat{count > 0 ? ` (${count})` : ""}
        {unread > 0 && (
          <span className="rounded-full bg-accent-strong px-1.5 py-0.5 text-[11px] font-bold leading-none text-white tabular-nums" aria-label={`${unread} ta o'qilmagan xabar`}>
            {unread}
          </span>
        )}
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {panel.mounted && (
        <div id={panelId} className={cn(panel.closing ? "expand-out" : "expand-in", "mt-2 overflow-hidden rounded-[16px] border border-line bg-surface-2")}>
          <div ref={scroller} onScroll={onScroll} className="max-h-[420px] min-h-[160px] space-y-2 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4" role="log" aria-live="polite" aria-label={`${counterpartName} bilan yozishma`}>
            {/* Xavfsizlik eslatmasi — har bir yozishmada bir marta, eng tepada */}
            <p className="mx-auto flex max-w-md items-start gap-2 rounded-[12px] bg-warning-soft px-3 py-2 text-[12px] leading-snug text-warning-text">
              <ShieldAlert size={14} className="mt-px shrink-0" />
              <span>To'lovni faqat shu buyurtma ichida kelishing — tashqarida eskrou himoyasi yo'q.</span>
            </p>

            {items == null ? (
              loadErr ? (
                <p className="flex items-center justify-center gap-2 py-6 text-[13px] text-danger-text">
                  <AlertCircle size={14} /> {loadErr}
                </p>
              ) : (
                <p className="flex items-center justify-center gap-2 py-6 text-[13px] text-fg-3">
                  <Spinner className="h-4 w-4" /> Yuklanmoqda…
                </p>
              )
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-fg-3">Hali xabarlar yo'q. {canWrite ? `${counterpartName}ga birinchi bo'lib yozing.` : ""}</p>
            ) : (
              rows.map((g) => (
                <div key={g.day} className="space-y-2">
                  <DayPill label={g.label} />
                  {g.list.map((m) =>
                    m.sender === "system" ? (
                      <p key={m.id} className="mx-auto w-fit max-w-[92%] break-words rounded-[12px] bg-fg/6 px-3 py-1 text-center text-[11.5px] leading-snug text-fg-3">
                        <Linkified text={m.body} /> · {clock(m.createdAt)}
                      </p>
                    ) : (
                      <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[85%] sm:max-w-[75%]")}>
                          {!m.mine && role === "admin" && m.senderName && <p className="mb-0.5 px-1 text-[11px] font-semibold text-fg-3">{m.senderName}</p>}
                          <div
                            className={cn(
                              "rounded-[14px] px-3.5 py-2 text-[14px] leading-relaxed [overflow-wrap:anywhere]",
                              m.mine ? "rounded-br-[4px] bg-ink text-ink-fg" : "rounded-bl-[4px] bg-surface text-fg",
                              m.pending === "failed" && "ring-1 ring-danger",
                            )}
                          >
                            {m.body && (
                              <p className="whitespace-pre-wrap break-words">
                                <Linkified text={m.body} />
                              </p>
                            )}
                            <AttachmentList items={m.attachments} compact className={m.body ? "mt-2" : undefined} />
                          </div>
                          <p className={cn("mt-0.5 flex items-center gap-1 px-1 text-[11px] text-fg-4", m.mine ? "justify-end" : "justify-start")}>
                            <time dateTime={new Date(m.createdAt).toISOString()} title={`${dayLabel(m.createdAt, locale, now)}, ${clock(m.createdAt)}`} suppressHydrationWarning>
                              {now - m.createdAt < 3_600_000 ? relativeTime(m.createdAt, locale, now) : clock(m.createdAt)}
                            </time>
                            {m.mine &&
                              (m.pending === "sending" ? (
                                <Spinner className="h-3 w-3" />
                              ) : m.pending === "failed" ? (
                                <button
                                  type="button"
                                  onClick={() => void sendNow(m.body, m.attachments, m.id)}
                                  className="-my-2 inline-flex min-h-8 items-center gap-1 font-semibold text-danger-text"
                                >
                                  <RotateCcw size={11} /> Qayta yuborish
                                </button>
                              ) : m.readAt || (readUpTo != null && readUpTo >= m.createdAt) ? (
                                <CheckCheck size={13} className="text-accent-text" aria-label="O'qildi" />
                              ) : (
                                <Check size={13} aria-label="Yuborildi" />
                              ))}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ))
            )}
          </div>

          {canWrite ? (
            <div className="border-t border-line bg-surface px-3 py-2.5 sm:px-4">
              {/* Tez javob shablonlari (F39) — faqat mutaxassis */}
              {role === "specialist" && (
                <div className="mb-2">
                  <button type="button" onClick={() => setQuickOpen((v) => !v)} aria-expanded={quickOpen} className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg">
                    <Zap size={12} aria-hidden="true" /> Tez javoblar <ChevronDown size={12} className={cn("transition-transform", quickOpen && "rotate-180")} aria-hidden="true" />
                  </button>
                  {quickOpen && (
                <div className="no-scrollbar expand-in -mx-3 mt-1.5 flex gap-1.5 overflow-x-auto px-3 sm:-mx-4 sm:px-4" role="group" aria-label="Tez javoblar">
                  {[...DEFAULT_QUICK_REPLIES, ...custom].map((t, i) => {
                    const own = i >= DEFAULT_QUICK_REPLIES.length;
                    return (
                      <span key={`${i}-${t}`} className="inline-flex shrink-0 items-center rounded-full border border-line bg-surface-2">
                        <button type="button" onClick={() => applyTemplate(t)} className="inline-flex min-h-10 max-w-[220px] items-center px-3 text-[12px] font-medium text-fg-2 hover:text-fg" title={t}>
                          <span className="truncate">{t}</span>
                        </button>
                        {own && (
                          <button type="button" onClick={() => removeTemplate(t)} className="-ml-1 mr-1 flex h-8 w-8 items-center justify-center rounded-full text-fg-4 hover:bg-fg/6 hover:text-fg" aria-label="Shablonni o'chirish">
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {adding ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-fg bg-surface pl-3 pr-1">
                      <input
                        autoFocus
                        value={draftTpl}
                        onChange={(e) => setDraftTpl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.preventDefault(), saveTemplate());
                          if (e.key === "Escape") setAdding(false);
                        }}
                        maxLength={300}
                        placeholder="Shablon matni"
                        aria-label="Yangi shablon matni"
                        className="h-9 w-44 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-4"
                      />
                      <button type="button" onClick={saveTemplate} className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-ink-fg" aria-label="Shablonni saqlash">
                        <Check size={13} />
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftTpl(text.trim().slice(0, 300));
                        setAdding(true);
                      }}
                      className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-dashed border-line-2 px-3 text-[12px] font-semibold text-fg-2 hover:border-fg hover:text-fg"
                    >
                      <Plus size={13} /> Shablon qo'shish
                    </button>
                  )}
                </div>
                  )}
                </div>
              )}

              {(files.length > 0 || uploading > 0) && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {files.map((f) => (
                    <span key={f.url} className="inline-flex min-h-9 max-w-[220px] items-center gap-1.5 rounded-full border border-line bg-surface-2 pl-1 pr-1 text-[12px] text-fg-2">
                      {isImageAttachment(f) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.url} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <FileText size={14} className="ml-1.5 text-fg-3" />
                      )}
                      <span className="truncate">{f.name}</span>
                      <button type="button" onClick={() => setFiles((cur) => cur.filter((x) => x.url !== f.url))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-fg/6" aria-label={`${f.name} — olib tashlash`}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {uploading > 0 && (
                    <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-fg/6 px-3 text-[12px] text-fg-3">
                      <Spinner className="h-3.5 w-3.5" /> Yuklanmoqda…
                    </span>
                  )}
                </div>
              )}

              {sendErr && (
                <p role="alert" className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-danger-text">
                  <AlertCircle size={13} /> {sendErr}
                </p>
              )}

              <div className="flex items-end gap-2">
                <input ref={fileRef} type="file" accept={UPLOAD_ACCEPT_DOCS} multiple className="hidden" onChange={pickFiles} tabIndex={-1} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={files.length >= MAX_ATTACHMENTS}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-40"
                  aria-label="Fayl biriktirish"
                  title="Fayl biriktirish — rasm, video yoki PDF/DOC (5 tagacha)"
                >
                  <ImagePlus size={17} />
                </button>
                <label htmlFor={`${panelId}-input`} className="sr-only">
                  Xabar
                </label>
                <textarea
                  id={`${panelId}-input`}
                  ref={textRef}
                  rows={1}
                  value={text}
                  maxLength={MAX_BODY}
                  onChange={(e) => {
                    setText(e.target.value);
                    autoGrow(e.target);
                  }}
                  onKeyDown={onKey}
                  placeholder="Xabar yozing…"
                  className="field min-h-10 flex-1 resize-none !py-2 text-[14px] leading-snug"
                  style={{ height: 40 }}
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={(!text.trim() && !files.length) || uploading > 0}
                  className="btn-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
                  aria-label="Yuborish"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 border-t border-line bg-surface px-4 py-2.5 text-[12px] text-fg-3">
              <Lock size={13} /> Faqat ko'rish (admin)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
