"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Paperclip, Search, Send, X } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import { MAX_ATTACHMENTS, UPLOAD_ACCEPT_DOCS, formatBytes, isImageAttachment, uploadAttachment, type Attachment } from "./attachments";
import { cn } from "@/lib/utils";

/**
 * Ichki chat (DM) — kabinetdagi "Chat" bo'limi.
 * Chapda suhbatlar ro'yxati, o'ngda tanlangan suhbat; mobil ekranda bittasi ko'rinadi.
 * Yangilanish: ochiq suhbat 5 soniyada (faqat yangi xabarlar ?after bilan), ro'yxat 20 soniyada.
 */

interface Peer {
  username: string | null;
  name: string;
  avatarUrl: string | null;
  isBanned?: boolean;
}
interface ConvRow {
  id: string;
  peer: Peer & { id: string; role: string };
  last: { body: string; mine: boolean; at: number; hasFiles: boolean } | null;
  unread: number;
}
interface Msg {
  id: string;
  mine: boolean;
  body: string;
  attachments: Attachment[];
  at: number;
}

const timeOf = (t: number) => new Date(t).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
const dayOf = (t: number) => new Date(t).toLocaleDateString("uz-UZ", { day: "numeric", month: "long" });

function Avatar({ p, size = 44 }: { p: Peer; size?: number }) {
  return p.avatarUrl ? (
    <SafeImage src={p.avatarUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-ink font-display font-semibold text-ink-fg"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {p.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function DmChat({ initialId }: { initialId?: string | null }) {
  const [convs, setConvs] = useState<ConvRow[] | null>(null);
  const [active, setActive] = useState<string | null>(initialId ?? null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const loadList = useCallback(async () => {
    const res = await fetch("/api/chat").catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    if (json?.ok) setConvs(json.data.items);
  }, []);

  /** Suhbatni (to'liq yoki faqat yangilarini) yuklash */
  const loadThread = useCallback(async (id: string, incremental: boolean) => {
    const after = incremental ? lastIdRef.current : null;
    const res = await fetch(`/api/chat/${id}${after ? `?after=${after}` : ""}`).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    if (!json?.ok || activeRef.current !== id) return;
    setPeer(json.data.peer);
    const items: Msg[] = json.data.items;
    if (items.length > 0) lastIdRef.current = items[items.length - 1].id;
    if (incremental) {
      if (items.length > 0) setMsgs((m) => [...(m ?? []), ...items.filter((x) => !(m ?? []).some((y) => y.id === x.id))]);
    } else {
      setMsgs(items);
    }
    // Ochiq suhbat o'qildi — ro'yxatdagi hisoblagichni darhol nolga tushiramiz
    setConvs((c) => c?.map((r) => (r.id === id ? { ...r, unread: 0 } : r)) ?? c);
  }, []);

  useEffect(() => {
    loadList();
    const t = window.setInterval(() => {
      if (!document.hidden) loadList();
    }, 20000);
    return () => window.clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (!active) return;
    lastIdRef.current = null;
    setMsgs(null);
    setPeer(null);
    loadThread(active, false);
    const t = window.setInterval(() => {
      if (!document.hidden) loadThread(active, true);
    }, 5000);
    return () => window.clearInterval(t);
  }, [active, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [msgs?.length, active]);

  const pickFiles = async (list: FileList | null) => {
    if (!list) return;
    setError(null);
    for (const f of Array.from(list).slice(0, MAX_ATTACHMENTS - files.length)) {
      try {
        const a = await uploadAttachment(f, { docs: true });
        setFiles((cur) => (cur.length < MAX_ATTACHMENTS ? [...cur, a] : cur));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fayl yuklanmadi");
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if ((!body && files.length === 0) || !active || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/${active}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, attachments: files }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setText("");
      setFiles([]);
      setMsgs((m) => [...(m ?? []), json.data]);
      lastIdRef.current = json.data.id;
      loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xabar yuborilmadi");
    } finally {
      setSending(false);
    }
  };

  const filtered = convs?.filter((c) => !q.trim() || c.peer.name.toLowerCase().includes(q.trim().toLowerCase()) || (c.peer.username ?? "").includes(q.trim().toLowerCase()));

  /* ---------------- Ro'yxat paneli ---------------- */
  const listPanel = (
    <div className={cn("card-elevated flex min-h-0 flex-col overflow-hidden", active && "hidden lg:flex")}>
      <div className="border-b border-line p-3">
        <label className="relative block">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-4" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suhbatlarni qidirish" className="field h-10 w-full rounded-full pl-9 text-[13.5px]" aria-label="Suhbatlarni qidirish" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {!filtered ? (
          <ul className="space-y-1 p-1">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 rounded-[var(--r-sm)] p-2.5">
                <span className="h-11 w-11 shrink-0 rounded-full skeleton" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3.5 w-1/2 skeleton" />
                  <span className="block h-3 w-3/4 skeleton" />
                </span>
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <span className="icon-tile-soft !rounded-full">
              <MessageCircle size={20} />
            </span>
            <p className="font-display text-[15px] font-semibold text-fg">{q ? "Topilmadi" : "Hali suhbat yo'q"}</p>
            {!q && (
              <p className="text-[13px] leading-relaxed text-fg-3">
                Mutaxassis profilidagi <b>«Yozish»</b> tugmasi orqali suhbat boshlang.
              </p>
            )}
            {!q && (
              <Link href="/mutaxassislar" className="btn-ink mt-1 h-10 rounded-full px-5 text-[13px] font-semibold">
                Mutaxassislarni ko'rish
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActive(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[var(--r-sm)] p-2.5 text-left transition hover:bg-fg/5",
                    active === c.id && "bg-accent-soft hover:bg-accent-soft",
                  )}
                >
                  <Avatar p={c.peer} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[14px] font-semibold text-fg">{c.peer.name}</span>
                      {c.last && <time className="shrink-0 text-[11px] text-fg-4">{timeOf(c.last.at)}</time>}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={cn("truncate text-[12.5px]", c.unread > 0 ? "font-semibold text-fg" : "text-fg-3")}>
                        {c.last ? `${c.last.mine ? "Siz: " : ""}${c.last.body || (c.last.hasFiles ? "📎 Fayl" : "")}` : `@${c.peer.username ?? ""}`}
                      </span>
                      {c.unread > 0 && (
                        <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-accent px-1 text-[10.5px] font-bold text-white">
                          {c.unread > 99 ? "99+" : c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  /* ---------------- Suhbat paneli ---------------- */
  const thread = (
    <div className={cn("card-elevated flex min-h-0 flex-col overflow-hidden", !active && "hidden lg:flex")}>
      {!active ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="icon-tile-soft !rounded-full">
            <MessageCircle size={20} />
          </span>
          <p className="font-display text-[15px] font-semibold text-fg">Suhbatni tanlang</p>
          <p className="max-w-[260px] text-[13px] leading-relaxed text-fg-3">Chapdagi ro'yxatdan suhbatni oching yoki mutaxassis profilidan yangi suhbat boshlang.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-line px-3.5 py-3">
            <button
              type="button"
              onClick={() => setActive(null)}
              aria-label="Suhbatlar ro'yxatiga qaytish"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg lg:hidden"
            >
              <ArrowLeft size={17} />
            </button>
            {peer ? (
              <>
                <Avatar p={peer} size={38} />
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-semibold leading-tight text-fg">{peer.name}</p>
                  {peer.username && <p className="truncate text-[12px] text-fg-3">@{peer.username}</p>}
                </div>
              </>
            ) : (
              <span className="h-5 w-32 skeleton" />
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-4" aria-live="polite">
            {!msgs ? (
              <div className="space-y-2.5">
                <span className="block h-10 w-2/3 rounded-2xl skeleton" />
                <span className="ml-auto block h-10 w-1/2 rounded-2xl skeleton" />
                <span className="block h-10 w-1/2 rounded-2xl skeleton" />
              </div>
            ) : msgs.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-fg-3">Birinchi xabarni yozing — suhbat shu yerda boshlanadi.</p>
            ) : (
              msgs.map((m, i) => {
                const newDay = i === 0 || dayOf(m.at) !== dayOf(msgs[i - 1].at);
                return (
                  <div key={m.id}>
                    {newDay && <p className="my-3 text-center text-[11px] font-semibold uppercase tracking-wide text-fg-4">{dayOf(m.at)}</p>}
                    <div className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[82%] rounded-2xl px-3.5 py-2.5", m.mine ? "rounded-br-md bg-ink text-ink-fg" : "rounded-bl-md border border-line bg-surface text-fg")}>
                        {m.attachments.length > 0 && (
                          <div className="mb-1.5 space-y-1.5">
                            {m.attachments.map((a) =>
                              isImageAttachment(a) ? (
                                <a key={a.url} href={a.url} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg">
                                  <SafeImage src={a.url} alt={a.name} width={360} height={240} className="h-auto max-h-56 w-full object-cover" />
                                </a>
                              ) : (
                                <a
                                  key={a.url}
                                  href={a.url}
                                  target="_blank"
                                  rel="noopener"
                                  className={cn("flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold underline-offset-2 hover:underline", m.mine ? "bg-white/10" : "bg-fg/5")}
                                >
                                  <Paperclip size={13} className="shrink-0" />
                                  <span className="truncate">{a.name}</span>
                                  <span className={cn("shrink-0 text-[11px] font-normal", m.mine ? "text-ink-fg/60" : "text-fg-4")}>{formatBytes(a.size)}</span>
                                </a>
                              ),
                            )}
                          </div>
                        )}
                        {m.body && <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{m.body}</p>}
                        <p className={cn("mt-1 text-right text-[10.5px]", m.mine ? "text-ink-fg/55" : "text-fg-4")}>{timeOf(m.at)}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="border-t border-line p-3">
            {files.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {files.map((f, i) => (
                  <li key={f.url} className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-2.5 pr-1 text-[12px] font-medium text-fg-2">
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                      aria-label={`${f.name} faylini olib tashlash`}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-fg-4 transition hover:bg-fg/10 hover:text-fg"
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {error && (
              <p className="mb-2 text-[12.5px] font-medium text-danger-text" role="alert">
                {error}
              </p>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileRef} type="file" accept={UPLOAD_ACCEPT_DOCS} multiple className="hidden" onChange={(e) => pickFiles(e.target.files)} tabIndex={-1} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={files.length >= MAX_ATTACHMENTS}
                aria-label="Fayl biriktirish"
                title="Fayl biriktirish — rasm yoki PDF/DOC"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-fg-3 transition hover:border-fg hover:text-fg disabled:opacity-40"
              >
                <Paperclip size={17} />
              </button>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Xabar yozing…"
                aria-label="Xabar matni"
                className="field max-h-32 min-h-11 flex-1 resize-none rounded-[22px] py-2.5 text-[14px] leading-relaxed"
              />
              <button
                type="submit"
                disabled={sending || (!text.trim() && files.length === 0)}
                aria-label="Yuborish"
                className="btn-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
              >
                <Send size={17} />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );

  return (
    <div className="grid h-[calc(100dvh-220px)] min-h-[420px] grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      {listPanel}
      {thread}
    </div>
  );
}
