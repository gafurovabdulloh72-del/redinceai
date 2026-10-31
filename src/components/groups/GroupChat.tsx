"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useIsPhone } from "@/components/motion/useMediaQuery";
import { useVisualViewport } from "@/components/motion/useVisualViewport";
import { haptic } from "@/components/motion/haptics";
import { ArrowDown, ArrowLeft, Check, Copy, CornerUpLeft, Maximize2, MoreHorizontal, Paperclip, Pencil, Pin, PinOff, Plus, Search, Send, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { usePresence } from "@/components/motion/usePresence";
import { MAX_ATTACHMENTS, UPLOAD_ACCEPT_DOCS, formatBytes, uploadAttachment, type Attachment } from "@/components/chat/attachments";
import { AttachmentList, QuoteBlock, ReactionChips, ReactionPicker, ReplyBar, TypingDots, jumpToMessage, typingLabel } from "@/components/chat/MessageParts";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { useChatStream } from "@/components/chat/useChatStream";
import { ReportButton } from "@/components/specialists/ReportButton";
import { CallButton } from "@/components/call/CallButton";
import type { QuoteView } from "@/lib/chat/quote";
import type { ReactionSummary } from "@/lib/chat/constants";
import { GROUP_MSG_MAX } from "@/lib/groups/limits";
import type { GroupMessageView, UserBrief } from "@/lib/groups/service";
import { cn, compactCount } from "@/lib/utils";
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

/** Polling oralig'i (xatoda 2× oshadi, 30 s gacha) — 2-bosqichda real-time qatlam bilan almashtiriladi */
const POLL_MS = 4000;
const POLL_MAX_MS = 30000;

/* Sana/soat: Intl'siz (brauzerga bog'liq emas), til bo'yicha oy nomlari */
const MONTHS: Record<"uz" | "ru", string[]> = {
  uz: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
};
const pad = (n: number) => String(n).padStart(2, "0");
function dayKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayLabel(ms: number, til: "uz" | "ru") {
  const d = new Date(ms);
  const now = new Date();
  if (dayKey(ms) === dayKey(now.getTime())) return til === "ru" ? "Сегодня" : "Bugun";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (dayKey(ms) === dayKey(y.getTime())) return til === "ru" ? "Вчера" : "Kecha";
  return `${d.getDate()} ${MONTHS[til][d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ""}`;
}
function timeOf(ms: number) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

/** Guruh mavzusi (Telegram «forum topics») */
interface TopicRow {
  id: string;
  name: string;
  position: number;
  isClosed: boolean;
  messages: number;
  lastAt: number | null;
}

type ApiResp = {
  ok: boolean;
  data?: { items: GroupMessageView[]; seen?: { messageId: string; count: number } | null; typing?: string[]; changed?: GroupMessageView[]; pinned?: GroupMessageView | null; reactions?: Record<string, ReactionSummary[]>; topics?: TopicRow[]; topicId?: string | null; now?: number };
  error?: string;
  fields?: Record<string, string>;
};

/**
 * Jamoa chati (faqat faol a'zolar). Birinchi yuklashda butun tarix, keyin polling `?after=<oxirgiId>&changedSince=`
 * (yangi + tahrirlangan/o'chirilgan). Tab ko'rinmasa so'rov yo'q, qaytganda darhol yangilanadi; xatoda oraliq 2× oshadi.
 * Foydalanuvchi pastda tursa yangi xabarda avtomatik tushadi; yuqoriga chiqib o'qiyotgan bo'lsa — «↓ N yangi» tugmasi.
 */
export function GroupChat({ slug, membersCount, kind = "group", canManage = false }: { slug: string; membersCount: number; kind?: "group" | "channel"; canManage?: boolean }) {
  const base = `/api/groups/${encodeURIComponent(slug)}/chat`;
  const topicsBase = `/api/groups/${encodeURIComponent(slug)}/mavzular`;
  const til = useLocale();
  const { toast } = useToast();
  const [msgs, setMsgs] = useState<GroupMessageView[] | null>(null);
  const [seen, setSeen] = useState<{ messageId: string; count: number } | null>(null);
  const [pinned, setPinned] = useState<GroupMessageView | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<GroupMessageView | null>(null);
  // Telegram odati: xabarni o'ngga surib javob berish (sensorli ekran)
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null);
  const swipeStart = useRef<{ id: string; x: number; y: number; locked: boolean | null } | null>(null);
  const SWIPE_REPLY = 56;
  const swipeHandlers = (m: GroupMessageView) =>
    m.deleted
      ? {}
      : {
          onTouchStart: (e: React.TouchEvent) => {
            const t0 = e.touches[0];
            swipeStart.current = { id: m.id, x: t0.clientX, y: t0.clientY, locked: null };
          },
          onTouchMove: (e: React.TouchEvent) => {
            const st = swipeStart.current;
            if (!st || st.id !== m.id) return;
            const t0 = e.touches[0];
            const dx = t0.clientX - st.x;
            const dy = t0.clientY - st.y;
            if (st.locked === null) {
              if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
              st.locked = Math.abs(dx) > Math.abs(dy) && dx > 0;
            }
            if (!st.locked) return;
            setSwipe({ id: m.id, dx: Math.min(80, Math.max(0, dx * 0.7)) });
          },
          onTouchEnd: () => {
            const st = swipeStart.current;
            swipeStart.current = null;
            if (st && swipe && swipe.id === st.id && swipe.dx >= SWIPE_REPLY) {
              haptic("light");
              setReplyTo(m);
            }
            setSwipe(null);
          },
          onTouchCancel: () => {
            swipeStart.current = null;
            setSwipe(null);
          },
        };
  /** Xabar menyusining gorizontal siljishi (px, «⋯» tugmasiga nisbatan): menyu chat ramkasidan chiqib kesilib ketmasin (telefonda ham) */
  const [menuShift, setMenuShift] = useState(0);
  const [editing, setEditing] = useState<GroupMessageView | null>(null);
  const [typing, setTyping] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GroupMessageView[] | null>(null);
  // Mavzular: null — «Umumiy» oqim
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [topic, setTopic] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState("");
  const [topicForm, setTopicForm] = useState(false);
  const typingSentAt = useRef(0);
  const typingOn = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastId = useRef<string | null>(null);
  const lastSync = useRef<number | null>(null);
  const stick = useRef(true);
  const loaded = useRef(false);
  /** Polling orqali kelgan xabarlar — faqat shular animatsiyalanadi (dastlabki 200 ta emas) */
  const fresh = useRef(new Set<string>());
  const pinnedPresence = usePresence(pinned !== null, 180);
  const newBtn = usePresence(newCount > 0 && !atBottom, 180);
  const chatLabel = kind === "channel" ? "Muhokama" : "Chat";

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    stick.current = true;
    setAtBottom(true);
    setNewCount(0);
  }, []);

  // Mavzu almashganda: ro'yxat tozalanadi va shu mavzu oqimi qaytadan yuklanadi
  useEffect(() => {
    loaded.current = false;
    lastId.current = null;
    lastSync.current = null;
    fresh.current.clear();
    setMsgs(null);
    setSeen(null);
    setNewCount(0);
  }, [topic]);

  /** Mavzu yaratish (boshqaruvchi) */
  const addTopic = async () => {
    const name = newTopic.trim();
    if (!name) return;
    const res = await fetch(topicsBase, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    const j = res ? ((await res.json().catch(() => null)) as { ok?: boolean; data?: TopicRow; error?: string } | null) : null;
    if (!res?.ok || !j?.data) {
      setError(j?.error ?? "Mavzu yaratilmadi");
      return;
    }
    setTopics((l) => [...l, j.data!]);
    setNewTopic("");
    setTopicForm(false);
    setTopic(j.data.id);
  };

  /** Mavzuni o'chirish — xabarlar «Umumiy» oqimga qaytadi */
  const removeTopic = async (id: string) => {
    const res = await fetch(`${topicsBase}/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setError("Mavzu o'chirilmadi");
      return;
    }
    setTopics((l) => l.filter((x) => x.id !== id));
    if (topic === id) setTopic(null);
  };

  /** Yangi/o'zgargan xabarlarni olish; muvaffaqiyat — true (backoff uchun) */
  const fetchNew = useCallback(async (): Promise<boolean> => {
    const sp = new URLSearchParams();
    if (lastId.current) sp.set("after", lastId.current);
    if (lastSync.current) sp.set("changedSince", String(lastSync.current));
    if (topic) sp.set("topic", topic);
    const qs = sp.toString();
    let j: ApiResp;
    try {
      const res = await fetch(qs ? `${base}?${qs}` : base, { cache: "no-store" });
      j = (await res.json()) as ApiResp;
    } catch {
      return false;
    }
    if (!j.ok || !j.data) return false;
    const d = j.data;
    if (d.seen !== undefined) setSeen(d.seen ?? null);
    if (d.typing) setTyping(d.typing);
    if (d.pinned !== undefined) setPinned(d.pinned ?? null);
    if (d.topics) setTopics(d.topics);
    if (d.now) lastSync.current = d.now;
    // Boshqalar qo'ygan reaksiyalar: oxirgi xabarlar yig'indisi bilan almashtiriladi (o'zgarmaganlar tegilmaydi)
    if (d.reactions) {
      const rx = d.reactions;
      setMsgs((prev) => {
        if (!prev) return prev;
        let changedAny = false;
        const next = prev.map((m) => {
          const r = rx[m.id];
          if (!r || JSON.stringify(r) === JSON.stringify(m.reactions ?? [])) return m;
          changedAny = true;
          return { ...m, reactions: r };
        });
        return changedAny ? next : prev;
      });
    }
    const items = d.items;
    const changed = d.changed ?? [];
    if (!loaded.current) {
      loaded.current = true;
      setMsgs(items);
    } else if (items.length || changed.length) {
      const changedMap = new Map(changed.map((m) => [m.id, m]));
      setMsgs((prev) => {
        const have = new Set((prev ?? []).map((m) => m.id));
        const add = items.filter((m) => !have.has(m.id));
        for (const m of add) fresh.current.add(m.id);
        const merged = [...(prev ?? []).map((m) => changedMap.get(m.id) ?? m), ...add];
        // O'chirilgan xabarga javob iqtiboslari ham yangilansin
        if (changed.some((c) => c.deleted)) {
          const gone = new Set(changed.filter((c) => c.deleted).map((c) => c.id));
          return merged.map((m) => (m.replyTo && gone.has(m.replyTo.id) ? { ...m, replyTo: { ...m.replyTo, body: "Xabar o'chirilgan", senderName: "", kind: "text" as const } } : m));
        }
        return merged;
      });
      if (add(items).length && !stick.current) setNewCount((n) => n + items.filter((m) => !m.mine).length);
    }
    if (items.length) lastId.current = items[items.length - 1].id;
    return true;
    function add(list: GroupMessageView[]) {
      return list.filter((m) => !m.mine);
    }
  }, [base, topic]);

  // Real-time (SSE): jamoa chatida o'zgarish → darhol fetchNew; polling faqat zaxira (30 s)
  const streamConnected = useChatStream({ group: slug, onGroup: () => void fetchNew() });
  const streamRef = useRef(false);
  streamRef.current = streamConnected;

  // Polling: visible bo'lmaganda to'xtaydi, qaytganda darhol; xatoda oraliq 2× (30 s gacha); SSE ulangan bo'lsa 30 s
  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let failures = 0;
    const schedule = () => {
      if (stopped) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, streamRef.current ? POLL_MAX_MS : Math.min(POLL_MS * 2 ** failures, POLL_MAX_MS));
    };
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") {
        const okRes = await fetchNew();
        failures = okRes ? 0 : Math.min(failures + 1, 4);
      }
      schedule();
    };
    void fetchNew().then(schedule);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchNew]);

  // Pastda tursa — yangi xabarda tushadi (konteyner ichida, sahifa sakramaydi)
  useEffect(() => {
    if (stick.current) {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [msgs, typing]);

  // Tahrir yoki javob tanlanganda fokus kompozitorga o'tadi (klaviatura bilan ham, sichqoncha bilan ham darhol yozish mumkin)
  useEffect(() => {
    if (!editing && !replyTo) return;
    const t = window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Xabarni tahrirlash"], textarea[aria-label="Xabar"]');
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 40);
    return () => window.clearTimeout(t);
  }, [editing, replyTo]);

  // Menyu: tashqi bosish / Esc yopadi (shikoyat oynasi ochiq bo'lsa tegilmaydi)
  useEffect(() => {
    if (!menuFor) return;
    const close = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("[data-msg-menu]") || t?.closest?.('[role="dialog"]')) return;
      setMenuFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) setMenuFor(null);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuFor]);

  // Qidiruv: 350 ms kechikish, kamida 2 belgi
  useEffect(() => {
    if (!searchOpen) return;
    const needle = q.trim();
    if (needle.length < 2) {
      setResults(null);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`${base}?q=${encodeURIComponent(needle)}`, { cache: "no-store" });
        const j = (await res.json()) as ApiResp;
        setResults(j.ok && j.data ? j.data.items : []);
      } catch {
        setResults([]);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [q, searchOpen, base]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stick.current = bottom;
    setAtBottom(bottom);
    if (bottom) setNewCount(0);
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
    const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, attachments, replyToId: replyTo?.id ?? null, topicId: topic }) });
    const j = (await res.json()) as ApiResp;
    if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Yuborilmadi");
    setReplyTo(null);
    stick.current = true;
    await fetchNew();
  }

  async function saveEdit(body: string) {
    if (!editing) return;
    const res = await fetch(`${base}/${encodeURIComponent(editing.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
    const j = (await res.json()) as ApiResp;
    if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Saqlanmadi");
    const id = editing.id;
    const editedAt = Date.now();
    setMsgs((prev) => (prev ?? []).map((m) => (m.id === id ? { ...m, body, edited: true, editedAt } : m)));
    if (pinned?.id === id) setPinned({ ...pinned, body, edited: true, editedAt });
    setEditing(null);
  }

  async function send() {
    const body = text.trim();
    if ((!body && files.length === 0) || busy || uploading) return;
    setBusy(true);
    setError(null);
    try {
      if (editing) await saveEdit(body);
      else await deliver(body, files);
      setText("");
      setFiles([]);
      if (typingOn.current) pingTyping("");
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

  /** "Yozmoqda…" signali — 2.5 soniyada bir martadan ko'p emas; matn tozalansa darhol o'chiriladi */
  function pingTyping(v: string) {
    const on = v.trim().length > 0;
    if (!on) {
      if (!typingOn.current) return;
      typingOn.current = false;
      typingSentAt.current = 0;
      void fetch(`${base}/typing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typing: false }) }).catch(() => undefined);
      return;
    }
    const now = Date.now();
    if (now - typingSentAt.current < 2500) return;
    typingSentAt.current = now;
    typingOn.current = true;
    void fetch(`${base}/typing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typing: true }) }).catch(() => undefined);
  }

  async function remove(m: GroupMessageView) {
    setMenuFor(null);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(m.id)}`, { method: "DELETE" });
      const j = (await res.json()) as ApiResp;
      if (!res.ok || !j.ok) throw new Error(j.error || "O'chirilmadi");
      setMsgs((prev) => (prev ?? []).map((x) => (x.id === m.id ? { ...x, body: "", attachments: [], deleted: true, canDelete: false, canEdit: false } : x)));
      if (pinned?.id === m.id) setPinned(null);
      if (replyTo?.id === m.id) setReplyTo(null);
      toast("Xabar o'chirildi", "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "O'chirilmadi", "error");
    }
  }

  /** Emoji reaksiya: darhol almashadi (optimistik), server yig'indisi bilan aniqlanadi, xatoda qaytadi */
  async function react(m: GroupMessageView, emoji: string) {
    if (m.deleted) return;
    const cur = m.reactions?.find((r) => r.mine)?.emoji ?? null;
    const next = cur === emoji ? null : emoji;
    const apply = (list: ReactionSummary[]) => setMsgs((prev) => prev?.map((x) => (x.id === m.id ? { ...x, reactions: list } : x)) ?? prev);
    const before = m.reactions ?? [];
    const opt = before
      .map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false } : r))
      .filter((r) => r.count > 0);
    if (next) {
      const hit = opt.find((r) => r.emoji === next);
      if (hit) {
        hit.count += 1;
        hit.mine = true;
      } else opt.push({ emoji: next, count: 1, mine: true });
    }
    apply(opt);
    try {
      const res = await fetch(`${base}/${m.id}/reaction`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji: next }) });
      const j = (await res.json()) as { ok: boolean; data?: { reactions: ReactionSummary[] }; error?: string };
      if (!res.ok || !j.ok || !j.data) throw new Error(j.error || "Bo'lmadi");
      apply(j.data.reactions);
    } catch (err) {
      apply(before);
      toast(err instanceof Error ? err.message : "Bo'lmadi", "error");
    }
  }

  async function togglePin(m: GroupMessageView) {
    setMenuFor(null);
    const next = pinned?.id !== m.id;
    try {
      const res = await fetch(`${base}/${encodeURIComponent(m.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: next }) });
      const j = (await res.json()) as ApiResp;
      if (!res.ok || !j.ok) throw new Error(j.error || "Bo'lmadi");
      setPinned(next ? m : null);
      toast(next ? "Xabar qadaldi" : "Qadoqdan olindi", "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    }
  }

  async function copyText(m: GroupMessageView) {
    setMenuFor(null);
    try {
      await navigator.clipboard.writeText(m.body);
      toast("Nusxalandi", "info");
    } catch {
      toast("Nusxalab bo'lmadi", "error");
    }
  }

  function startEdit(m: GroupMessageView) {
    setMenuFor(null);
    setReplyTo(null);
    setEditing(m);
    setText(m.body);
  }

  function cancelEdit() {
    setEditing(null);
    setText("");
  }

  function jump(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) {
      toast("Xabar eski — ro'yxatda yuklanmagan", "info");
      return;
    }
    stick.current = false;
    jumpToMessage(id);
  }

  const canSend = (text.trim().length > 0 || (files.length > 0 && !editing)) && !busy && !uploading;
  const nearLimit = text.length > GROUP_MSG_MAX - 200;

  // Telefon: Telegram kabi TO'LIQ EKRAN (DmChat naqshi — portal + data-chat-open; `fixed` sahifa ichida emas, body'da)
  const phone = useIsPhone();
  const [full, setFull] = useState(true);
  const fullscreen = phone && full;
  const vv = useVisualViewport(fullscreen);
  useEffect(() => {
    const el = document.documentElement;
    if (fullscreen) el.setAttribute("data-chat-open", "1");
    else el.removeAttribute("data-chat-open");
    return () => el.removeAttribute("data-chat-open");
  }, [fullscreen]);

  const root = (
    <div
      className={cn(fullscreen ? "fixed inset-0 z-[60] flex flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" : "card flex flex-col overflow-hidden")}
      style={fullscreen ? (vv ? { height: vv.height, top: vv.offsetTop, paddingBottom: 0 } : undefined) : { height: "min(70vh, 640px)" }}
    >
      {/* Sarlavha: nom · a'zolar · qidiruv (to'liq ekranda — orqaga tugmasi, kattaroq) */}
      <div className={cn("flex items-center justify-between gap-2 border-b border-line px-3 text-[12.5px] text-fg-3 sm:px-4", fullscreen ? "min-h-14 py-2" : "py-2")}>
        <span className="flex min-w-0 items-center gap-1">
          {fullscreen && (
            <button type="button" onClick={() => setFull(false)} aria-label="Orqaga" className="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg transition hover:bg-fg/6">
              <ArrowLeft size={20} />
            </button>
          )}
          <span className={cn("truncate font-semibold", fullscreen ? "text-[15px] text-fg" : "text-fg-2")}>
            {chatLabel} · {compactCount(membersCount)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {phone && !fullscreen && (
            <button type="button" onClick={() => setFull(true)} aria-label="To'liq ekran" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
              <Maximize2 size={15} />
            </button>
          )}
          <CallButton kind="group" id={slug} title={chatLabel} className="h-8 w-8" />
          <button
            type="button"
            onClick={() => {
              setSearchOpen((v) => !v);
              setQ("");
              setResults(null);
            }}
            aria-pressed={searchOpen}
            aria-label={searchOpen ? "Qidiruvni yopish" : "Xabarlardan qidirish"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
          >
            {searchOpen ? <X size={15} /> : <Search size={15} />}
          </button>
        </span>
      </div>

      {searchOpen && (
        <div className="expand-in relative border-b border-line px-3 py-2 sm:px-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus maxLength={80} placeholder="Xabar matni…" aria-label="Xabarlardan qidirish" className="field h-9 w-full text-[13.5px]" />
          {results && (
            <ul className="pop-in absolute inset-x-3 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-[14px] bg-surface p-1 shadow-[var(--shadow-3)] sm:inset-x-4" role="listbox" aria-label="Topilgan xabarlar">
              {results.length === 0 ? (
                <li className="px-3 py-3 text-center text-[12.5px] text-fg-3">Hech narsa topilmadi</li>
              ) : (
                results.map((r) => (
                  <li key={r.id}>
                    <button type="button" role="option" aria-selected={false} onClick={() => jump(r.id)} className="flex w-full flex-col items-start gap-0.5 rounded-[10px] px-3 py-2 text-left transition hover:bg-fg/6">
                      <span className="text-[11.5px] font-bold text-fg-3">
                        {r.mine ? "Siz" : r.sender.name} · {dayLabel(r.at, til)}, {timeOf(r.at)}
                      </span>
                      <span className="line-clamp-2 text-[13px] text-fg">{r.body}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      {/* Mavzular (Telegram forum naqshi): «Umumiy» + mavzular; boshqaruvchi yangi mavzu qo'shadi */}
      {(topics.length > 0 || canManage) && (
        <div className="border-b border-line px-3 py-2 sm:px-4">
          <nav aria-label="Mavzular" className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            <button type="button" onClick={() => setTopic(null)} aria-pressed={!topic} className={cn("h-8 shrink-0 rounded-full border px-3 text-[12px] font-semibold transition", !topic ? "border-fg bg-fg text-ink-fg" : "border-line text-fg-2 hover:border-fg hover:text-fg")}>
              Umumiy
            </button>
            {topics.map((tp) => (
              <span key={tp.id} className="relative shrink-0">
                <button type="button" onClick={() => setTopic(tp.id)} aria-pressed={topic === tp.id} className={cn("h-8 rounded-full border px-3 text-[12px] font-semibold transition", topic === tp.id ? "border-fg bg-fg text-ink-fg" : "border-line text-fg-2 hover:border-fg hover:text-fg")}>
                  {tp.isClosed && "🔒 "}
                  {tp.name}
                  {tp.messages > 0 && <span className="ml-1 opacity-60">{tp.messages}</span>}
                </button>
                {canManage && topic === tp.id && (
                  <button type="button" onClick={() => void removeTopic(tp.id)} aria-label={`${tp.name} — o'chirish`} title="Mavzuni o'chirish" className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-surface text-fg-3 shadow-[var(--shadow-3)] transition hover:text-danger-text">
                    <X size={11} />
                  </button>
                )}
              </span>
            ))}
            {canManage && !topicForm && (
              <button type="button" onClick={() => setTopicForm(true)} aria-label="Yangi mavzu" title="Yangi mavzu" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-line-2 text-fg-3 transition hover:border-fg hover:text-fg">
                <Plus size={14} />
              </button>
            )}
          </nav>
          {canManage && topicForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void addTopic();
              }}
              className="mt-2 flex gap-2"
            >
              <input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} maxLength={40} autoFocus placeholder="Mavzu nomi" aria-label="Mavzu nomi" className="field h-9 min-w-0 flex-1 text-[13px]" />
              <button type="submit" disabled={!newTopic.trim()} className="btn-accent h-9 shrink-0 px-3 text-[12.5px] disabled:opacity-50">
                Qo&apos;shish
              </button>
              <button type="button" onClick={() => (setTopicForm(false), setNewTopic(""))} className="h-9 shrink-0 px-2 text-[12.5px] font-semibold text-fg-3 hover:text-fg">
                Bekor
              </button>
            </form>
          )}
        </div>
      )}

      {/* Qadalgan xabar */}
      {pinnedPresence.mounted && pinned && (
        <button type="button" onClick={() => jump(pinned.id)} className={cn("flex w-full items-center gap-2.5 border-b border-line px-3 py-2 text-left transition hover:bg-fg/4 sm:px-4", pinnedPresence.closing ? "expand-out" : "expand-in")} title="Qadalgan xabarga o'tish">
          <Pin size={14} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-fg-3">Qadalgan · {pinned.mine ? "Siz" : pinned.sender.name}</span>
            <span className="block truncate text-[13px] text-fg">{pinned.body || (pinned.attachments.length ? "Fayl" : "…")}</span>
          </span>
          {canManage && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Qadoqdan olish"
              onClick={(e) => {
                e.stopPropagation();
                void togglePin(pinned);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  void togglePin(pinned);
                }
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-fg"
            >
              <PinOff size={14} />
            </span>
          )}
        </button>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions" aria-label={`${chatLabel} xabarlari`} className="h-full overflow-y-auto px-3 py-3 sm:px-4">
          {!msgs ? (
            <div className="space-y-2.5" aria-busy="true">
              <span className="block h-10 w-2/3 rounded-2xl skeleton" />
              <span className="ml-auto block h-10 w-1/2 rounded-2xl skeleton" />
            </div>
          ) : msgs.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-fg-3">{kind === "channel" ? "Muhokama hali boshlanmagan — birinchi bo'lib yozing." : "Birinchi xabarni yozing — suhbat shu yerda boshlanadi."}</p>
          ) : (
            msgs.map((m, i) => {
              const prev = i > 0 ? msgs[i - 1] : null;
              const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
              const sameSender = Boolean(prev && !newDay && prev.sender.id === m.sender.id);
              const isPinned = pinned?.id === m.id;
              const menuOpen = menuFor === m.id;
              return (
                <div key={m.id} className={cn(fresh.current.has(m.id) && "animate-msg-in", sameSender ? "mt-1" : "mt-3")}>
                  {newDay && (
                    <p className="my-3 text-center">
                      <span className="inline-block rounded-full bg-fg/6 px-2.5 py-0.5 text-[11px] font-semibold text-fg-3">{dayLabel(m.at, til)}</span>
                    </p>
                  )}
                  <div
                    {...swipeHandlers(m)}
                    style={swipe?.id === m.id ? { transform: `translateX(${swipe.dx}px)`, transition: "none" } : undefined}
                    className={cn("group relative flex items-end gap-1.5 transition-transform duration-200", m.mine ? "justify-end" : "justify-start")}
                  >
                    {swipe?.id === m.id && (
                      <span aria-hidden className="pointer-events-none absolute top-1/2 -left-10 grid h-8 w-8 place-items-center rounded-full bg-fg/10 text-fg" style={{ opacity: Math.min(1, swipe.dx / SWIPE_REPLY), transform: `translateY(-50%) scale(${swipe.dx >= SWIPE_REPLY ? 1 : 0.8})` }}>
                        <CornerUpLeft size={15} />
                      </span>
                    )}
                    {!m.mine && <span className="w-7 shrink-0">{!sameSender && <Avatar name={m.sender.name} src={m.sender.avatarUrl} size={28} decorative />}</span>}
                    <div className={cn("flex min-w-0 max-w-[80%] flex-col", m.mine ? "items-end" : "items-start")}>
                    <div id={`msg-${m.id}`} className={cn("max-w-full rounded-2xl px-3.5 py-2 transition-shadow", m.mine ? "rounded-br-md bg-ink text-ink-fg" : "rounded-bl-md bg-surface-2 text-fg", m.deleted && "opacity-70")}>
                      {!m.mine && !sameSender && <SenderName u={m.sender} />}
                      {m.replyTo && !m.deleted && <QuoteBlock q={m.replyTo} mine={m.mine} />}
                      {m.deleted ? (
                        <p className={cn("flex items-center gap-1.5 text-[13px] italic", m.mine ? "text-ink-fg/70" : "text-fg-3")}>
                          <Trash2 size={12} /> Xabar o&apos;chirilgan
                        </p>
                      ) : (
                        <>
                          <AttachmentList attachments={m.attachments} mine={m.mine} />
                          {m.body && (
                            <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">
                              <RichText text={m.body} />
                            </p>
                          )}
                        </>
                      )}
                      <p className={cn("mt-0.5 flex items-center justify-end gap-1.5 text-[11px]", m.mine ? "text-ink-fg/55" : "text-fg-4")}>
                        {isPinned && <Pin size={10} aria-label="Qadalgan" />}
                        {m.edited && <span title={m.editedAt ? `Tahrirlangan: ${timeOf(m.editedAt)}` : undefined}>tahrirlangan{m.editedAt ? ` ${timeOf(m.editedAt)}` : ""} ·</span>}
                        <span>{timeOf(m.at)}</span>
                        {m.mine && seen?.messageId === m.id && seen.count > 0 && <span>· {seen.count} kishi ko&apos;rdi</span>}
                      </p>
                    </div>
                    {!m.deleted && <ReactionChips reactions={m.reactions ?? []} mine={m.mine} onToggle={(e) => void react(m, e)} />}
                    </div>

                    {/* Amallar: bitta «⋯» menyu (javob, nusxa, tahrir, qadash, o'chirish) + boshqalarniki uchun shikoyat */}
                    {!m.deleted && (
                      <div className={cn("relative flex shrink-0 items-center self-center", m.mine && "order-first")} data-msg-menu>
                        <button
                          type="button"
                          aria-label="Xabar amallari"
                          aria-haspopup="menu"
                          aria-expanded={menuOpen}
                          onClick={(e) => {
                            const btn = e.currentTarget.getBoundingClientRect();
                            const box = listRef.current?.getBoundingClientRect();
                            if (box) {
                              // Menyu kengligi ≈ 256px: chap chetini ramka ichida ushlab turamiz
                              const lo = box.left + 8;
                              const hi = box.right - 256 - 8;
                              setMenuShift(Math.max(lo, Math.min(btn.left, hi)) - btn.left);
                            }
                            setMenuFor(menuOpen ? null : m.id);
                          }}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-fg-4 transition hover:bg-fg/8 hover:text-fg focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg group-hover:opacity-100 [@media(hover:none)]:opacity-60",
                            menuOpen ? "opacity-100" : "opacity-0",
                          )}
                        >
                          <MoreHorizontal size={15} />
                        </button>
                        {menuOpen && (
                          <div role="menu" aria-label="Xabar amallari" className={cn("pop-in absolute bottom-full z-20 mb-1 min-w-[168px] rounded-[14px] bg-surface p-1 shadow-[var(--shadow-3)]")} style={{ left: menuShift }}>
                            <ReactionPicker
                              current={m.reactions?.find((r) => r.mine)?.emoji ?? null}
                              onPick={(e) => {
                                setMenuFor(null);
                                void react(m, e);
                              }}
                            />
                            <div className="my-1 border-t border-line" />
                            <MenuItem icon={CornerUpLeft} onClick={() => { setMenuFor(null); setEditing(null); setReplyTo(m); }}>
                              Javob berish
                            </MenuItem>
                            {m.body && (
                              <MenuItem icon={Copy} onClick={() => void copyText(m)}>
                                Nusxalash
                              </MenuItem>
                            )}
                            {m.canEdit && (
                              <MenuItem icon={Pencil} onClick={() => startEdit(m)}>
                                Tahrirlash
                              </MenuItem>
                            )}
                            {canManage && (
                              <MenuItem icon={isPinned ? PinOff : Pin} onClick={() => void togglePin(m)}>
                                {isPinned ? "Qadoqdan olish" : "Qadash"}
                              </MenuItem>
                            )}
                            {m.canDelete && (
                              <MenuItem icon={Trash2} tone="danger" onClick={() => void remove(m)}>
                                O&apos;chirish
                              </MenuItem>
                            )}
                            {!m.mine && (
                              <div className="mt-1 border-t border-line pt-1">
                                <ReportButton targetType="message" targetId={m.id} loggedIn modal align="start" triggerClassName="flex h-9 w-full items-center justify-start gap-2 rounded-[10px] px-2.5 text-[13px] font-semibold text-fg-2 hover:bg-fg/6 hover:text-fg" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
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
        </div>

        {/* Yuqorida o'qiyotganda yangi xabar kelsa */}
        {newBtn.mounted && (
          <button type="button" onClick={scrollToBottom} className={cn("btn-ink absolute bottom-3 left-1/2 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold", newBtn.closing ? "pop-out" : "pop-in")}>
            <ArrowDown size={14} /> {newCount} yangi xabar
          </button>
        )}
      </div>

      {/* Kompozitor: hairline faqat ro'yxat yuqoriga surilganda */}
      <div className={cn("border-t p-2.5 transition-colors sm:p-3", atBottom ? "border-transparent" : "border-line")}>
        {editing && (
          <div className="expand-in mb-2 flex items-center gap-2 rounded-[12px] border-l-[3px] border-accent bg-accent-soft/60 py-1.5 pl-3 pr-1" role="status">
            <Pencil size={14} className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] font-bold text-accent-text">Tahrirlash</span>
              <span className="block truncate text-[12.5px] text-fg-2">{editing.body}</span>
            </span>
            <button type="button" onClick={cancelEdit} aria-label="Tahrirni bekor qilish" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-fg">
              <X size={14} />
            </button>
          </div>
        )}
        {replyTo && !editing && <ReplyBar q={quoteOf(replyTo)} onCancel={() => setReplyTo(null)} />}
        {files.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {files.map((a, i) => (
              <li key={a.url} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-fg/6 px-2.5 py-1 text-[12px] text-fg-2">
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
          {!recording && !editing && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || files.length >= MAX_ATTACHMENTS}
              aria-label="Fayl biriktirish"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-2 transition hover:bg-fg/6 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-50"
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
                if (!editing) pingTyping(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
                if (e.key === "Escape") {
                  if (editing) cancelEdit();
                  else if (replyTo) setReplyTo(null);
                }
              }}
              maxLength={GROUP_MSG_MAX}
              rows={1}
              placeholder={editing ? "Yangi matn…" : replyTo ? "Javob yozing…" : "Xabar yozing…"}
              ariaLabel={editing ? "Xabarni tahrirlash" : "Xabar"}
              wrapperClassName="min-w-0 flex-1"
              className="field max-h-32 min-h-10 w-full resize-none py-2.5 text-[14px] leading-snug"
              trailing={nearLimit ? <span className={cn("text-[11px] tabular-nums", text.length >= GROUP_MSG_MAX ? "text-danger-text" : "text-fg-4")}>{GROUP_MSG_MAX - text.length}</span> : undefined}
            />
          )}
          {editing ? (
            <button type="button" onClick={() => void send()} disabled={!canSend} aria-label="Saqlash" className="btn-ink press flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50">
              <Check size={16} />
            </button>
          ) : text.trim() || files.length > 0 ? (
            <button type="button" onClick={() => void send()} disabled={!canSend} aria-label="Yuborish" className="btn-ink press flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50">
              <Send size={16} />
            </button>
          ) : (
            <VoiceRecorder onRecorded={sendVoice} onError={setError} onPhase={setRecording} disabled={uploading} />
          )}
        </div>
        {(error || uploading) && (
          <p role={error ? "alert" : "status"} className={cn("mt-1.5 text-[12px] font-semibold", error ? "text-danger-text" : "text-fg-3")}>
            {error ?? "Fayl yuklanmoqda…"}
          </p>
        )}
      </div>
    </div>
  );
  return fullscreen ? createPortal(root, document.body) : root;
}

function MenuItem({ icon: Icon, tone = "default", onClick, children }: { icon: typeof Pin; tone?: "default" | "danger"; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={cn("flex h-9 w-full items-center gap-2 rounded-[10px] px-2.5 text-left text-[13px] font-semibold transition hover:bg-fg/6", tone === "danger" ? "text-danger-text" : "text-fg-2 hover:text-fg")}>
      <Icon size={14} className="shrink-0" /> {children}
    </button>
  );
}
