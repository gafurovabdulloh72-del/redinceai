"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, CheckCheck, CheckCircle2, Flag, MessageCircle, Paperclip, Search, Send, X } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";
import { MAX_ATTACHMENTS, UPLOAD_ACCEPT_DOCS, formatBytes, isImageAttachment, isVideoAttachment, uploadAttachment, type Attachment } from "./attachments";
import { cn, timeAgo } from "@/lib/utils";

/**
 * Ichki chat (DM) — kabinetdagi "Chat" bo'limi.
 * Chapda suhbatlar ro'yxati, o'ngda tanlangan suhbat; mobil ekranda bittasi ko'rinadi.
 * Yangilanish: ochiq suhbat 5 soniyada (faqat yangi xabarlar ?after bilan), ro'yxat 20 soniyada.
 */

interface Peer {
  id?: string;
  username: string | null;
  name: string;
  avatarUrl: string | null;
  isBanned?: boolean;
  /** Mutaxassis profili slug'i (bor bo'lsa) — ism bosilganda /mutaxassislar/<slug>'ga o'tadi */
  slug?: string | null;
  /** Chatdagi real faollik (ms) — "Onlayn" (yashil) shundan */
  lastSeenAt?: number | null;
  /** Oxirgi faollik (ms) — lastSeenAt yoki tizimga kirish; "oxirgi faollik" yozuvi shundan */
  lastActiveAt?: number | null;
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

/** Shu oraliqda faollik — "onlayn" */
const ONLINE_MS = 3 * 60 * 1000;

function presenceOf(p: Peer): { online: boolean; label: string } {
  // "Onlayn" faqat real chat faolligidan (lastSeenAt) — tizimga kirish buni yoqmaydi
  if (p.lastSeenAt && Date.now() - p.lastSeenAt < ONLINE_MS) return { online: true, label: "Onlayn" };
  // Aks holda oxirgi faollik vaqti (chat yoki tizimga kirishdan)
  const seen = p.lastActiveAt ?? p.lastSeenAt;
  if (seen) return { online: false, label: `oxirgi faollik ${timeAgo(seen)}` };
  return { online: false, label: p.username ? `@${p.username}` : "" };
}

/** Suhbatdosh haqida shikoyat — /api/reports (targetType: "user") */
function ReportPanel({ peer, onClose }: { peer: Peer; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!reason) {
      setErr("Sababni tanlang");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "user", targetId: peer.id, reason, text }),
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok && res.status !== 409) throw new Error(json?.error ?? "Server javob bermadi");
      setSent(true);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Yuborilmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-line bg-surface-2 px-3.5 py-3">
      {sent ? (
        <p className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-fg-2" role="status">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-success-text" /> Shikoyat yuborildi — admin ko'rib chiqadi
          </span>
          <button type="button" onClick={onClose} className="font-semibold text-fg-3 hover:text-fg">
            Yopish
          </button>
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-2" aria-label={`${peer.name} haqida shikoyat`}>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
            <Flag size={13} className="text-fg-3" /> {peer.name} haqida shikoyat
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason | "")} className="field h-10 sm:w-56" aria-label="Shikoyat sababi">
              <option value="">Sababni tanlang…</option>
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Izoh (ixtiyoriy)" className="field h-10 flex-1 text-[13px]" />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="btn-ink h-10 rounded-full px-4 text-[13px] font-semibold disabled:opacity-50">
                {busy ? "Yuborilmoqda…" : "Yuborish"}
              </button>
              <button type="button" onClick={onClose} className="h-10 rounded-full border border-line px-3.5 text-[13px] font-semibold text-fg-2 hover:border-fg hover:text-fg">
                Bekor
              </button>
            </div>
          </div>
          {err && (
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-danger-text" role="alert">
              <AlertCircle size={13} /> {err}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

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
  /** Qarshi tomon suhbatni o'qigan vaqt (ms) — ✓✓ belgisi uchun */
  const [peerReadAt, setPeerReadAt] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  /** Xabarlar oynasi — pastga yaqinlikni o'lchash uchun */
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Foydalanuvchi pastga yaqinmi (<120px) — yangi xabarda avtomatik tushish faqat shunda */
  const nearBottomRef = useRef(true);
  /** Avvalgi xabarlar soni — birinchi yuklash (0 → n) har doim pastga tushadi */
  const prevCountRef = useRef(0);
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
    setPeerReadAt(json.data.peerReadAt ?? 0);
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
    prevCountRef.current = 0;
    nearBottomRef.current = true;
    setMsgs(null);
    setPeer(null);
    setPeerReadAt(0);
    setReportOpen(false);
    loadThread(active, false);
    const t = window.setInterval(() => {
      if (!document.hidden) loadThread(active, true);
    }, 5000);
    return () => window.clearInterval(t);
  }, [active, loadThread]);

  // Avtomatik pastga tushish: birinchi ochilishda har doim; keyin faqat foydalanuvchi
  // pastga yaqin bo'lsa (<120px) yoki yangi xabar o'ziniki bo'lsa — eski xabarlarni
  // o'qiyotganni yangi xabar pastga uloqtirmasin
  useEffect(() => {
    if (!msgs) return;
    const initial = prevCountRef.current === 0 && msgs.length > 0;
    const added = msgs.length > prevCountRef.current;
    prevCountRef.current = msgs.length;
    if (!initial && !added) return;
    const last = msgs[msgs.length - 1];
    if (initial || nearBottomRef.current || Boolean(last?.mine)) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [msgs, active]);

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
              (() => {
                const pr = presenceOf(peer);
                const inner = (
                  <>
                    <span className="relative shrink-0">
                      <Avatar p={peer} size={38} />
                      {pr.online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-success" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 truncate text-[14.5px] font-semibold leading-tight text-fg">{peer.name}</span>
                      <span className={cn("block truncate text-[12px]", pr.online ? "font-medium text-success-text" : "text-fg-3")}>{pr.label}</span>
                    </span>
                  </>
                );
                return (
                  <>
                    {peer.slug ? (
                      // Mutaxassis — ism/avatar bosilsa profilga o'tadi
                      <Link href={`/mutaxassislar/${peer.slug}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-full transition hover:opacity-80" title={`${peer.name} profilini ochish`}>
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>
                    )}
                    {peer.id && (
                  <button
                    type="button"
                    onClick={() => setReportOpen((v) => !v)}
                    aria-expanded={reportOpen}
                    aria-label={`${peer.name} haqida shikoyat qilish`}
                    title="Shikoyat qilish"
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition",
                      reportOpen ? "bg-danger-soft text-danger-text" : "text-fg-4 hover:bg-fg/6 hover:text-fg",
                    )}
                  >
                        <Flag size={15} />
                      </button>
                    )}
                  </>
                );
              })()
            ) : (
              <span className="h-5 w-32 skeleton" />
            )}
          </div>
          {reportOpen && peer?.id && <ReportPanel peer={peer} onClose={() => setReportOpen(false)} />}

          <div
            ref={scrollRef}
            onScroll={() => {
              const el = scrollRef.current;
              if (el) nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
            }}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-4"
            aria-live="polite"
          >
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
                              isVideoAttachment(a) ? (
                                // eslint-disable-next-line jsx-a11y/media-has-caption
                                <video key={a.url} src={a.url} controls preload="metadata" playsInline className="max-h-64 w-full rounded-lg bg-black/20" title={a.name} />
                              ) : isImageAttachment(a) ? (
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
                        <p className={cn("mt-1 flex items-center justify-end gap-1 text-right text-[10.5px]", m.mine ? "text-ink-fg/55" : "text-fg-4")}>
                          {timeOf(m.at)}
                          {m.mine &&
                            (peerReadAt >= m.at ? (
                              <CheckCheck size={13} className="shrink-0 text-accent" aria-label="O'qildi" />
                            ) : (
                              <Check size={13} className="shrink-0" aria-label="Yuborildi" />
                            ))}
                        </p>
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
                title="Fayl biriktirish — rasm, video (50 MB) yoki PDF/DOC"
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
