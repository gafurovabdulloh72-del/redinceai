"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useIsPhone } from "@/components/motion/useMediaQuery";
import { useVisualViewport } from "@/components/motion/useVisualViewport";
import { haptic } from "@/components/motion/haptics";
import { AlertCircle, ArrowDown, ArrowLeft, Check, CheckCheck, Copy, CornerUpLeft, Flag, Loader2, Lock, Maximize2, MoreHorizontal, Paperclip, Pencil, Pin, PinOff, Plus, Search, Send, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/ui";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { usePresence } from "@/components/motion/usePresence";
import { MAX_ATTACHMENTS, UPLOAD_ACCEPT_DOCS, formatBytes, uploadAttachment, type Attachment } from "@/components/chat/attachments";
import { Layer, MenuDivider, MenuItem, type LayerAnchor } from "@/components/chat/DmPanels";
import { AttachmentList, Linkified, QuoteBlock, ReactionChips, ReactionPicker, ReplyBar, TypingDots, jumpToMessage, preloadReactions, typingLabel, useLongPress, useNowTick } from "@/components/chat/MessageParts";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { useChatStream } from "@/components/chat/useChatStream";
import { useStickyBottom } from "@/components/chat/useStickyBottom";
import { ReportButton } from "@/components/specialists/ReportButton";
import { CallButton } from "@/components/call/CallButton";
import type { QuoteView } from "@/lib/chat/quote";
import type { ReactionSummary } from "@/lib/chat/constants";
import { clock, dayKey, dayLabel, fullStamp } from "@/lib/chat/time";
import { GROUP_MSG_MAX } from "@/lib/groups/limits";
import type { GroupMessageView, UserBrief } from "@/lib/groups/service";
import { chatT, type ChatKey } from "@/lib/i18n/dict/chat";
import { cn, compactCount } from "@/lib/utils";
import { MentionField } from "./MentionInput";

/** Polling oralig'i (xatoda 2× oshadi, 30 s gacha); SSE ulangan bo'lsa faqat zaxira (30 s) */
const POLL_MS = 4000;
const POLL_MAX_MS = 30000;

function SenderName({ u }: { u: UserBrief }) {
  const cls = "mb-0.5 block truncate px-1 text-[12px] font-bold text-accent-text";
  return u.slug ? (
    <Link href={`/mutaxassislar/${u.slug}`} className={cn(cls, "underline-offset-2 hover:underline")} data-no-auto>
      {u.name}
    </Link>
  ) : (
    <span className={cls} data-no-auto>
      {u.name}
    </span>
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
  /** Ko'ruvchi hali ko'rmagan xabarlar */
  unread?: number;
}

type ApiData = {
  items: GroupMessageView[];
  hasMore?: boolean;
  seen?: { messageId: string; count: number } | null;
  readUpTo?: number;
  typing?: string[];
  changed?: GroupMessageView[];
  pinned?: GroupMessageView | null;
  reactions?: Record<string, ReactionSummary[]>;
  topics?: TopicRow[];
  generalUnread?: number;
  topicId?: string | null;
  now?: number;
};
type ApiResp = { ok: boolean; data?: ApiData; error?: string; fields?: Record<string, string> };

const errText = (j: ApiResp | null, fallback: string) => (j?.fields && Object.values(j.fields)[0]) || j?.error || fallback;

/**
 * Jamoa chati (faqat faol a'zolar). Birinchi ochilishda OXIRGI sahifa (80 ta), yuqoriga aylantirilganda eskiroq sahifalar
 * (`?before=`); yangilanish — SSE `group` hodisasi (+30 s zaxira polling `?after=&changedSince=`).
 * Foydalanuvchi pastda tursa yangi xabarda avtomatik tushadi; yuqorida o'qiyotgan bo'lsa — «↓ N yangi xabar» tugmasi.
 *
 * 2026-11-10 (QA A6, A8, A12, A17, A20, A22, B3, B5, B7, C1, C6):
 *  - xabar menyusi `Layer` orqali (portal: desktopda ko'rish maydoniga sig'adigan popover, telefonda pastki varaq);
 *    sensorli ekranda bosib turish bilan ochiladi; o'chirish — tasdiq bilan;
 *  - ✓✓ va «N kishi ko'rdi» server har so'rovda beradigan `readUpTo`/`seen` dan (yolg'on ✓✓ yo'q, polling'da yo'qolmaydi);
 *  - mavzular jonli (yangi mavzu/yopilish ochiq chatga keladi), yorliqda o'qilmaganlar soni, boshqa mavzudagi qidiruv
 *    natijasi / qadalgan xabarga o'tiladi, mavzu o'chirish — tasdiq bilan, qadoq paneli faqat o'z mavzusida;
 *  - vaqtlar Toshkent vaqti bilan (lib/chat/time — DM va kanal bilan bir xil); Enter sensorli klaviaturada yangi qator.
 */
export function GroupChat({
  slug,
  membersCount,
  kind = "group",
  canManage = false,
  embedded = false,
  onActivity,
}: {
  slug: string;
  membersCount: number;
  kind?: "group" | "channel";
  canManage?: boolean;
  embedded?: boolean;
  /** Yangi xabar keldi / o'qildi / yuborildi — chat ro'yxati (nishon, parcha) yangilansin */
  onActivity?: () => void;
}) {
  const base = `/api/groups/${encodeURIComponent(slug)}/chat`;
  const topicsBase = `/api/groups/${encodeURIComponent(slug)}/mavzular`;
  const til = useLocale();
  const t = useCallback((k: ChatKey, v?: Record<string, string | number>) => chatT(til, k, v), [til]);
  const { toast } = useToast();
  const confirm = useConfirm();
  const now = useNowTick(60_000);
  const [msgs, setMsgs] = useState<GroupMessageView[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [seen, setSeen] = useState<{ messageId: string; count: number } | null>(null);
  const [readUpTo, setReadUpTo] = useState(0);
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
              setEditing(null);
              setReplyTo(m);
            }
            setSwipe(null);
          },
          onTouchCancel: () => {
            swipeStart.current = null;
            setSwipe(null);
          },
        };
  const [editing, setEditing] = useState<GroupMessageView | null>(null);
  const [typing, setTyping] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [menu, setMenu] = useState<{ id: string; anchor: LayerAnchor } | null>(null);
  const [reportFor, setReportFor] = useState<{ id: string; key: number } | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GroupMessageView[] | null>(null);
  // Mavzular: null — «Umumiy» oqim
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [generalUnread, setGeneralUnread] = useState(0);
  const [topic, setTopic] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState("");
  const [topicForm, setTopicForm] = useState(false);
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
    preloadReactions();
  }, []);

  const typingSentAt = useRef(0);
  const typingOn = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputEl = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const reportHost = useRef<HTMLDivElement>(null);
  const lastId = useRef<string | null>(null);
  const lastSync = useRef<number | null>(null);
  const stick = useRef(true);
  const loaded = useRef(false);
  const topicRef = useRef<string | null>(null);
  topicRef.current = topic;
  /** Mavzu holati sakrash (loadFrom) orqali almashtirilganda ro'yxat tozalanmasin */
  const skipReset = useRef(false);
  const hasMoreRef = useRef(false);
  hasMoreRef.current = hasMore;
  const olderBusy = useRef(false);
  /** Shu sessiyada ko'rilgan oqimlar: kalit — mavzu id'si yoki "" («Umumiy»), qiymat — server vaqti (ms) */
  const seenMap = useRef<Record<string, number>>({});
  /** Polling orqali kelgan xabarlar — faqat shular animatsiyalanadi (dastlabki sahifa emas) */
  const fresh = useRef(new Set<string>());
  const activityRef = useRef(onActivity);
  activityRef.current = onActivity;
  const pinnedHere = pinned && (pinned.topicId ?? null) === topic ? pinned : null;
  const pinnedPresence = usePresence(pinnedHere !== null, 180);
  const newBtn = usePresence(newCount > 0 && !atBottom, 180);
  const chatLabel = t(kind === "channel" ? "discussion" : "chatLabel");
  const press = useLongPress();

  useStickyBottom(listRef, stick, true, msgs === null ? 0 : 1);

  // Ko'rilgan oqimlar sessiya davomida saqlanadi (panel yopilib ochilsa ham boshqa mavzudagi «arvoh» o'qilmaganlar qolmasin)
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(`chat:gseen:${slug}`);
      if (raw) seenMap.current = JSON.parse(raw) as Record<string, number>;
    } catch {
      /* sessiya xotirasi yo'q — faqat joriy oqim hisobga olinadi */
    }
  }, [slug]);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    stick.current = true;
    setAtBottom(true);
    setNewCount(0);
  }, []);

  // Mavzu almashganda: ro'yxat tozalanadi va shu mavzu oqimi qaytadan yuklanadi (sakrash bilan almashganda — tozalanmaydi)
  useEffect(() => {
    if (skipReset.current) {
      skipReset.current = false;
      return;
    }
    loaded.current = false;
    lastId.current = null;
    lastSync.current = null;
    fresh.current.clear();
    stick.current = true;
    setMsgs(null);
    setHasMore(false);
    setSeen(null);
    setNewCount(0);
    setAtBottom(true);
    setReplyTo(null);
    setEditing(null);
  }, [topic]);

  /** Mavzu yaratish (boshqaruvchi) */
  const addTopic = async () => {
    const name = newTopic.trim();
    if (!name) return;
    const res = await fetch(topicsBase, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    const j = res ? ((await res.json().catch(() => null)) as { ok?: boolean; data?: TopicRow; error?: string; fields?: Record<string, string> } | null) : null;
    if (!res?.ok || !j?.data) {
      toast((j?.fields && Object.values(j.fields)[0]) || j?.error || t("topicFail"), "error");
      return;
    }
    setTopics((l) => [...l.filter((x) => x.id !== j.data!.id), j.data!]);
    setNewTopic("");
    setTopicForm(false);
    setTopic(j.data.id);
  };

  /** Mavzuni o'chirish — tasdiq bilan; xabarlar «Umumiy» oqimga qaytadi */
  const removeTopic = async (tp: TopicRow) => {
    if (!(await confirm({ title: t("topicDeleteQ", { name: tp.name }), text: t("topicDeleteText"), confirmLabel: t("remove"), danger: true }))) return;
    const res = await fetch(`${topicsBase}/${encodeURIComponent(tp.id)}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      toast(t("deleteFail"), "error");
      return;
    }
    setTopics((l) => l.filter((x) => x.id !== tp.id));
    if (topicRef.current === tp.id) setTopic(null);
    toast(t("topicDeleted"), "info");
  };

  /** Server javobidagi umumiy holatni qo'llash (o'qilganlik, yozmoqda, qadoq, mavzular) */
  const applyMeta = useCallback((d: ApiData) => {
    if (d.seen !== undefined) setSeen(d.seen ?? null);
    if (typeof d.readUpTo === "number") setReadUpTo(d.readUpTo);
    if (d.typing) setTyping(d.typing);
    if (d.pinned !== undefined) setPinned(d.pinned ?? null);
    if (d.topics) {
      setTopics(d.topics);
      // Joriy mavzu o'chirilgan bo'lsa — «Umumiy»ga qaytamiz
      if (topicRef.current && !d.topics.some((x) => x.id === topicRef.current)) setTopic(null);
    }
    if (typeof d.generalUnread === "number") setGeneralUnread(d.generalUnread);
    if (d.now) lastSync.current = d.now;
  }, []);

  /** Yangi/o'zgargan xabarlarni olish; muvaffaqiyat — true (backoff uchun) */
  const fetchNew = useCallback(async (): Promise<boolean> => {
    const stream = topicRef.current;
    const sp = new URLSearchParams();
    const incremental = loaded.current && Boolean(lastId.current);
    if (incremental && lastId.current) sp.set("after", lastId.current);
    if (incremental && lastSync.current) sp.set("changedSince", String(lastSync.current));
    if (stream) sp.set("topic", stream);
    // O'qildi faqat oyna fokusda va o'quvchi ro'yxat oxirida turganda (yuqorida o'qiyotganda yangi xabar «o'qilgan» bo'lib ketmasin)
    const reading = document.hasFocus() && stick.current;
    if (!reading) sp.set("read", "0");
    const seenStr = Object.entries(seenMap.current)
      .map(([k, v]) => `${k}:${v}`)
      .join(",");
    if (seenStr) sp.set("seen", seenStr.slice(0, 1100));
    let j: ApiResp;
    try {
      const res = await fetch(`${base}?${sp.toString()}`, { cache: "no-store" });
      j = (await res.json()) as ApiResp;
    } catch {
      return false;
    }
    if (!j.ok || !j.data) return false;
    // Javob kelguncha mavzu almashgan bo'lsa — eskirgan javob tashlanadi
    if (topicRef.current !== stream) return true;
    const d = j.data;
    applyMeta(d);
    if (reading && d.now) {
      seenMap.current[stream ?? ""] = d.now;
      try {
        window.sessionStorage.setItem(`chat:gseen:${slug}`, JSON.stringify(seenMap.current));
      } catch {
        /* saqlanmasa ham ishlaydi */
      }
    }
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
    if (!incremental) {
      loaded.current = true;
      setMsgs(items);
      setHasMore(Boolean(d.hasMore));
      activityRef.current?.();
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
          return merged.map((m) => (m.replyTo && gone.has(m.replyTo.id) ? { ...m, replyTo: { ...m.replyTo, body: t("msgDeleted"), senderName: "", kind: "text" as const } } : m));
        }
        return merged;
      });
      const incoming = items.filter((m) => !m.mine).length;
      if (incoming && !stick.current) setNewCount((n) => n + incoming);
      if (items.length) activityRef.current?.();
    }
    if (items.length) lastId.current = items[items.length - 1].id;
    return true;
  }, [base, slug, applyMeta, t]);

  /** Eskiroq sahifa (yuqoriga aylantirilganda) — scroll o'rni saqlanadi */
  const loadOlder = useCallback(async () => {
    if (olderBusy.current || !hasMoreRef.current) return;
    const stream = topicRef.current;
    const el = listRef.current;
    const firstId = el?.querySelector<HTMLElement>("[data-msg-id]")?.dataset.msgId;
    if (!firstId) return;
    olderBusy.current = true;
    setLoadingOlder(true);
    try {
      const sp = new URLSearchParams({ before: firstId });
      if (stream) sp.set("topic", stream);
      const j = (await fetch(`${base}?${sp.toString()}`, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null)) as ApiResp | null;
      if (!j?.ok || !j.data || topicRef.current !== stream) return;
      const older = j.data.items;
      const prevH = el?.scrollHeight ?? 0;
      const prevTop = el?.scrollTop ?? 0;
      stick.current = false;
      setMsgs((prev) => {
        const have = new Set((prev ?? []).map((m) => m.id));
        return [...older.filter((m) => !have.has(m.id)), ...(prev ?? [])];
      });
      setHasMore(Boolean(j.data.hasMore));
      window.requestAnimationFrame(() => {
        if (el) el.scrollTop = prevTop + (el.scrollHeight - prevH);
      });
    } finally {
      olderBusy.current = false;
      setLoadingOlder(false);
    }
  }, [base]);

  /**
   * Hali yuklanmagan xabarga sakrash (qidiruv natijasi, qadalgan xabar, iqtibos): nishon o'z mavzusi oqimida,
   * undan eng yangisigacha yuklanadi; oraliq juda uzun bo'lsa server 422 qaytaradi — foydalanuvchiga aytiladi.
   */
  const loadFrom = useCallback(
    async (id: string) => {
      const res = await fetch(`${base}?from=${encodeURIComponent(id)}&read=0`, { cache: "no-store" }).catch(() => null);
      const j = res ? ((await res.json().catch(() => null)) as ApiResp | null) : null;
      if (!res?.ok || !j?.ok || !j.data) {
        toast(res?.status === 422 ? t("tooOld") : res?.status === 404 ? t("msgGone") : errText(j, t("fail")), "info");
        return;
      }
      const d = j.data;
      const stream = d.topicId ?? null;
      if (stream !== topicRef.current) {
        skipReset.current = true;
        topicRef.current = stream;
        setTopic(stream);
      }
      fresh.current.clear();
      stick.current = false;
      loaded.current = true;
      lastId.current = d.items.length ? d.items[d.items.length - 1].id : null;
      setMsgs(d.items);
      setHasMore(Boolean(d.hasMore));
      setAtBottom(false);
      setNewCount(0);
      applyMeta(d);
      window.setTimeout(() => jumpToMessage(id), 80);
    },
    [base, applyMeta, t, toast],
  );

  const jump = useCallback(
    (id: string) => {
      if (document.getElementById(`msg-${id}`)) {
        stick.current = false;
        jumpToMessage(id);
      } else void loadFrom(id);
    },
    [loadFrom],
  );

  // Real-time (SSE): jamoa chatida o'zgarish → darhol fetchNew; polling faqat zaxira (30 s)
  const streamConnected = useChatStream({ group: slug, only: "group", onGroup: () => void fetchNew() });
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
    window.addEventListener("focus", onVis);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
    // topic: mavzu almashganda yangi oqim darhol yuklanadi
  }, [fetchNew, topic]);

  // Pastda tursa — yangi xabarda / «yozmoqda» chiqqanda tushadi (konteyner ichida, sahifa sakramaydi)
  useEffect(() => {
    if (stick.current) {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [msgs, typing]);

  // Tahrir yoki javob tanlanganda fokus kompozitorga o'tadi
  useEffect(() => {
    if (!editing && !replyTo) return;
    const id = window.setTimeout(() => {
      const el = inputEl.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 40);
    return () => window.clearTimeout(id);
  }, [editing, replyTo]);

  // Yozish maydoni matnga qarab o'sadi (128px gacha)
  useEffect(() => {
    const el = inputEl.current;
    if (!el || !(el instanceof HTMLTextAreaElement)) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [text, editing, recording]);

  // Shikoyat: menyu yopilgach ReportButton (modal) dasturiy ravishda ochiladi
  useEffect(() => {
    if (!reportFor) return;
    const id = window.setTimeout(() => reportHost.current?.querySelector("button")?.click(), 30);
    return () => window.clearTimeout(id);
  }, [reportFor]);

  // Qidiruv: 350 ms kechikish, kamida 2 belgi
  useEffect(() => {
    if (!searchOpen) return;
    const needle = q.trim();
    if (needle.length < 2) {
      setResults(null);
      return;
    }
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`${base}?q=${encodeURIComponent(needle)}`, { cache: "no-store" });
        const j = (await res.json()) as ApiResp;
        setResults(j.ok && j.data ? j.data.items : []);
      } catch {
        setResults([]);
      }
    }, 350);
    return () => window.clearTimeout(id);
  }, [q, searchOpen, base]);

  const closeSearch = () => {
    setSearchOpen(false);
    setQ("");
    setResults(null);
  };

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    const was = stick.current;
    stick.current = bottom;
    setAtBottom(bottom);
    if (bottom) {
      setNewCount(0);
      // Ro'yxat oxiriga qaytildi — kutib turgan xabarlar endi «o'qildi»
      if (!was) void fetchNew();
    }
    if (el.scrollTop < 140) void loadOlder();
  }

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    const room = MAX_ATTACHMENTS - files.length;
    if (room <= 0) {
      setError(t("maxFiles", { n: MAX_ATTACHMENTS }));
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
      setError(e instanceof Error ? e.message : t("uploadFail"));
    } finally {
      setUploading(false);
    }
  }

  const failText = (e: unknown, fallback: string) => (e instanceof TypeError ? t("netError") : e instanceof Error && e.message ? e.message : fallback);

  async function deliver(body: string, attachments: Attachment[]) {
    const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, attachments, replyToId: replyTo?.id ?? null, topicId: topic }) });
    const j = (await res.json().catch(() => null)) as ApiResp | null;
    if (!res.ok || !j?.ok) throw new Error(errText(j, t("failed")));
    setReplyTo(null);
    stick.current = true;
    await fetchNew();
    activityRef.current?.();
  }

  async function saveEdit(body: string) {
    if (!editing) return;
    const res = await fetch(`${base}/${encodeURIComponent(editing.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
    const j = (await res.json().catch(() => null)) as ApiResp | null;
    if (!res.ok || !j?.ok) throw new Error(errText(j, t("saveFail")));
    const id = editing.id;
    const editedAt = Date.now();
    setMsgs((prev) => (prev ?? []).map((m) => (m.id === id ? { ...m, body, edited: true, editedAt } : m)));
    if (pinned?.id === id) setPinned({ ...pinned, body, edited: true, editedAt });
    setEditing(null);
  }

  const over = text.length - GROUP_MSG_MAX;
  async function send() {
    const body = text.trim();
    if (busy || uploading || over > 0) return;
    // Tahrirda: biriktirmali xabar izohi bo'sh qolishi mumkin; yangi xabarda matn yoki fayl kerak
    if (editing ? !body && editing.attachments.length === 0 : !body && files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      if (editing) await saveEdit(body);
      else await deliver(body, files);
      setText("");
      setFiles([]);
      if (typingOn.current) pingTyping("");
    } catch (e) {
      setError(failText(e, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  async function sendVoice(a: Attachment) {
    setError(null);
    try {
      await deliver("", [a]);
    } catch (e) {
      setError(failText(e, t("failed")));
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
    const at = Date.now();
    if (at - typingSentAt.current < 2500) return;
    typingSentAt.current = at;
    typingOn.current = true;
    void fetch(`${base}/typing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typing: true }) }).catch(() => undefined);
  }

  /** O'chirish — tasdiq bilan (hamma a'zolar uchun o'chadi, qaytarib bo'lmaydi) */
  async function remove(m: GroupMessageView) {
    if (!(await confirm({ title: t("deleteGroupMsgQ"), text: t("deleteGroupMsgText"), confirmLabel: t("remove"), danger: true }))) return;
    try {
      const res = await fetch(`${base}/${encodeURIComponent(m.id)}`, { method: "DELETE" });
      const j = (await res.json().catch(() => null)) as ApiResp | null;
      if (!res.ok || !j?.ok) throw new Error(errText(j, t("deleteFail")));
      setMsgs((prev) => (prev ?? []).map((x) => (x.id === m.id ? { ...x, body: "", attachments: [], deleted: true, canDelete: false, canEdit: false, reactions: [] } : x)));
      if (pinned?.id === m.id) setPinned(null);
      if (replyTo?.id === m.id) setReplyTo(null);
      if (editing?.id === m.id) (setEditing(null), setText(""));
      toast(t("deleted"), "info");
      activityRef.current?.();
    } catch (e) {
      toast(failText(e, t("deleteFail")), "error");
    }
  }

  /** Emoji reaksiya: darhol almashadi (optimistik), server yig'indisi bilan aniqlanadi, xatoda qaytadi */
  async function react(m: GroupMessageView, emoji: string) {
    if (m.deleted) return;
    const cur = m.reactions?.find((r) => r.mine)?.emoji ?? null;
    const next = cur === emoji ? null : emoji;
    const apply = (list: ReactionSummary[]) => setMsgs((prev) => prev?.map((x) => (x.id === m.id ? { ...x, reactions: list } : x)) ?? prev);
    const before = m.reactions ?? [];
    const opt = before.map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false } : { ...r })).filter((r) => r.count > 0);
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
      if (!res.ok || !j.ok || !j.data) throw new Error(j.error || t("fail"));
      apply(j.data.reactions);
    } catch (err) {
      apply(before);
      toast(failText(err, t("fail")), "error");
    }
  }

  async function togglePin(m: GroupMessageView) {
    const next = pinned?.id !== m.id;
    try {
      const res = await fetch(`${base}/${encodeURIComponent(m.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: next }) });
      const j = (await res.json().catch(() => null)) as ApiResp | null;
      if (!res.ok || !j?.ok) throw new Error(errText(j, t("fail")));
      setPinned(next ? m : null);
      toast(t(next ? "msgPinned" : "msgUnpinned"), "info");
    } catch (e) {
      toast(failText(e, t("fail")), "error");
    }
  }

  async function copyText(m: GroupMessageView) {
    try {
      await navigator.clipboard.writeText(m.body);
      toast(t("copied"), "info");
    } catch {
      toast(t("copyFail"), "error");
    }
  }

  function startEdit(m: GroupMessageView) {
    setReplyTo(null);
    setEditing(m);
    setText(m.body);
  }

  function cancelEdit() {
    setEditing(null);
    setText("");
  }

  /** Xabardan iqtibos (javob paneli uchun) — server bilan bir xil qoida */
  const quoteOf = (m: GroupMessageView): QuoteView => {
    const a = m.attachments;
    const k = a.some((x) => x.type.startsWith("audio/")) ? "voice" : a.some((x) => x.type.startsWith("video/")) ? "video" : a.some((x) => x.type.startsWith("image/")) ? "image" : a.length ? "file" : "text";
    const label = k === "text" ? "" : t(k);
    const body = m.body.replace(/\s+/g, " ").trim();
    return { id: m.id, body: body ? (body.length > 140 ? `${body.slice(0, 139)}…` : body) : label, senderName: m.mine ? t("you") : m.sender.name, kind: k };
  };

  const canSend = !busy && !uploading && over <= 0 && (editing ? text.trim().length > 0 || editing.attachments.length > 0 : text.trim().length > 0 || files.length > 0);
  const nearLimit = text.length > GROUP_MSG_MAX - 200;
  const closedTopic = Boolean(topic && topics.find((x) => x.id === topic)?.isClosed && !canManage);

  // Telefon: Telegram kabi TO'LIQ EKRAN (DmChat naqshi — portal + data-chat-open; `fixed` sahifa ichida emas, body'da)
  const phone = useIsPhone();
  const [full, setFull] = useState(true);
  // embedded — chat paneli ichida (Telegram inbox): karta emas, ota konteynerni to'ldiradi; to'liq ekranni panelning o'zi beradi
  const fullscreen = phone && full && !embedded;
  const vv = useVisualViewport(fullscreen);
  useEffect(() => {
    if (!fullscreen) return;
    const el = document.documentElement;
    el.setAttribute("data-chat-open", "1");
    return () => el.removeAttribute("data-chat-open");
  }, [fullscreen]);

  // Panel ichida (chat paneli o'z sarlavhasini chizadi): tugmalar mavzular qatorida
  const compactHead = embedded && !fullscreen;
  const headBtn = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg lg:h-9 lg:w-9";
  const headerActions = (
    <span className="flex shrink-0 items-center gap-0.5">
      {/* «To'liq ekran» faqat mustaqil (panel ichida bo'lmagan) chatda — panelda chat allaqachon to'liq ekran */}
      {phone && !fullscreen && !embedded && (
        <button type="button" onClick={() => setFull(true)} aria-label={t("fullScreen")} className={headBtn}>
          <Maximize2 size={15} />
        </button>
      )}
      <CallButton kind="group" id={slug} title={chatLabel} className="h-10 w-10 lg:h-9 lg:w-9" />
      <button type="button" onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))} aria-pressed={searchOpen} aria-label={t(searchOpen ? "searchClose" : "searchInChat")} className={cn(headBtn, searchOpen && "bg-fg/6 text-fg")}>
        <Search size={16} />
      </button>
    </span>
  );

  const menuMsg = menu ? ((msgs ?? []).find((x) => x.id === menu.id) ?? null) : null;
  // Menyu yopilish animatsiyasi paytida bandlar yo'qolib qolmasin — oxirgi ochilgan xabar bilan chiziladi
  const lastMenuMsg = useRef<GroupMessageView | null>(null);
  if (menuMsg) lastMenuMsg.current = menuMsg;
  const mm = menuMsg ?? lastMenuMsg.current;
  const topicPill = (on: boolean) => cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition", on ? "border-fg bg-fg text-ink-fg" : "border-line text-fg-2 hover:border-fg hover:text-fg");
  const unreadDot = (n: number, on: boolean) =>
    n > 0 && !on ? (
      <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent px-1 text-[10.5px] font-bold leading-none text-white" aria-label={t("newMsgsN", { n })}>
        {n > 99 ? "99+" : n}
      </span>
    ) : null;

  const root = (
    <div
      className={cn(fullscreen ? "fixed inset-0 z-[60] flex flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" : embedded ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "card flex flex-col overflow-hidden")}
      style={fullscreen ? (vv ? { height: vv.height, top: vv.offsetTop, paddingBottom: 0 } : undefined) : embedded ? undefined : { height: "min(70vh, 640px)" }}
    >
      {/* Sarlavha: nom · a'zolar · qidiruv (to'liq ekranda — orqaga tugmasi, kattaroq).
          Panel ichida (compactHead) alohida qator yo'q — tugmalar mavzular qatoriga ko'chadi */}
      {!compactHead && (
        <div className={cn("flex items-center justify-between gap-2 border-b border-line px-3 text-[12.5px] text-fg-3 sm:px-4", fullscreen ? "min-h-14 py-2" : "py-2")}>
          <span className="flex min-w-0 items-center gap-1">
            {fullscreen && (
              <button type="button" onClick={() => setFull(false)} aria-label={t("back")} className="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg transition hover:bg-fg/6">
                <ArrowLeft size={20} />
              </button>
            )}
            <span className={cn("truncate font-semibold", fullscreen ? "text-[15px] text-fg" : "text-fg-2")}>
              {chatLabel} · {compactCount(membersCount)}
            </span>
          </span>
          {headerActions}
        </div>
      )}

      {/* Mavzular (Telegram forum naqshi): «Umumiy» + mavzular (o'qilmaganlar soni bilan); boshqaruvchi yangi mavzu qo'shadi */}
      {(topics.length > 0 || canManage || compactHead) && (
        <div className="border-b border-line px-2.5 py-1.5 sm:px-3">
          <div className="flex items-center gap-1.5">
            {compactHead && (
              <span className="sr-only">
                {chatLabel} · {compactCount(membersCount)}
              </span>
            )}
            <nav aria-label={t("topicsAria")} className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
              {(topics.length > 0 || canManage) && (
                <button type="button" onClick={() => setTopic(null)} aria-pressed={!topic} className={topicPill(!topic)}>
                  {t("general")}
                  {unreadDot(generalUnread, !topic)}
                </button>
              )}
              {topics.map((tp) => {
                const on = topic === tp.id;
                return (
                  <span key={tp.id} className={cn("inline-flex shrink-0 items-center", on && canManage && "gap-0.5")}>
                    <button type="button" onClick={() => setTopic(tp.id)} aria-pressed={on} className={topicPill(on)}>
                      {tp.isClosed && <Lock size={11} aria-label={t("topicClosed")} />}
                      <span data-no-auto>{tp.name}</span>
                      {unreadDot(tp.unread ?? 0, on)}
                    </button>
                    {canManage && on && (
                      <button type="button" onClick={() => void removeTopic(tp)} aria-label={`${tp.name} — ${t("topicDelete")}`} title={t("topicDelete")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg-3 transition hover:bg-danger-soft hover:text-danger-text">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </span>
                );
              })}
              {canManage && !topicForm && (
                <button type="button" onClick={() => setTopicForm(true)} aria-label={t("newTopic")} title={t("newTopic")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-line-2 text-fg-3 transition hover:border-fg hover:text-fg">
                  <Plus size={15} />
                </button>
              )}
            </nav>
            {compactHead && headerActions}
          </div>
          {canManage && topicForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void addTopic();
              }}
              className="expand-in mt-1.5 flex gap-2"
            >
              <input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} onKeyDown={(e) => e.key === "Escape" && (setTopicForm(false), setNewTopic(""))} maxLength={40} autoFocus placeholder={t("topicName")} aria-label={t("topicName")} className="field h-10 min-w-0 flex-1 !rounded-[10px] text-[13.5px] max-md:text-[16px]" />
              <button type="submit" disabled={!newTopic.trim()} className="btn-accent h-10 shrink-0 px-3.5 text-[12.5px] disabled:opacity-50">
                {t("add")}
              </button>
              <button type="button" onClick={() => (setTopicForm(false), setNewTopic(""))} className="h-10 shrink-0 px-2 text-[12.5px] font-semibold text-fg-3 hover:text-fg">
                {t("cancel")}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Qidiruv: natijalar maydon ostida oddiy oqimda (tugmalarni to'smaydi), Esc yopadi */}
      {searchOpen && (
        <div className="expand-in border-b border-line bg-surface-2 p-2">
          <label className="relative block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-4" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), closeSearch())} autoFocus maxLength={80} placeholder={t("searchTextPh")} aria-label={t("searchInChat")} className="field h-10 w-full !rounded-full pl-8 pr-11 text-[13.5px] max-md:text-[16px]" />
            <button type="button" onClick={closeSearch} aria-label={t("searchClose")} className="absolute right-0.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-fg-4 hover:bg-fg/8 hover:text-fg">
              <X size={14} />
            </button>
          </label>
          {results && (
            <ul className="mt-1.5 max-h-52 overflow-y-auto" aria-live="polite">
              {results.length === 0 ? (
                <li className="px-2 py-2 text-[12.5px] text-fg-3">{t("noResults")}</li>
              ) : (
                results.map((r) => {
                  const where = r.topicId ? topics.find((x) => x.id === r.topicId)?.name : null;
                  return (
                    <li key={r.id}>
                      <button type="button" onClick={() => jump(r.id)} className="flex w-full flex-col items-start gap-0.5 rounded-[10px] px-2.5 py-2 text-left transition hover:bg-fg/6">
                        <span className="text-[11.5px] font-bold text-fg-3" data-no-auto>
                          {r.mine ? t("you") : r.sender.name} · {dayLabel(r.at, til, now)}, {clock(r.at)}
                          {where ? ` · ${where}` : ""}
                        </span>
                        <span className="line-clamp-2 text-[13px] text-fg [overflow-wrap:anywhere]" data-no-auto>
                          {r.body}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>
      )}

      {/* Qadalgan xabar — faqat o'z mavzusi oqimida */}
      {pinnedPresence.mounted && pinnedHere && (
        <div className={cn("flex w-full items-center gap-1 border-b border-line pl-3 pr-1 sm:pl-4", pinnedPresence.closing ? "expand-out" : "expand-in")}>
          <button type="button" onClick={() => jump(pinnedHere.id)} className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left transition hover:opacity-80" title={t("pinnedBy")}>
            <span aria-hidden className="h-8 w-[3px] shrink-0 rounded-full bg-accent" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-accent-text">
                {t("pinnedBy")} · <span data-no-auto>{pinnedHere.mine ? t("you") : pinnedHere.sender.name}</span>
              </span>
              <span className="block truncate text-[13px] text-fg" data-no-auto>
                {pinnedHere.body || (pinnedHere.attachments.length ? quoteOf(pinnedHere).body : "…")}
              </span>
            </span>
          </button>
          {canManage && (
            <button type="button" onClick={() => void togglePin(pinnedHere)} aria-label={t("unpin")} title={t("unpin")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-fg">
              <PinOff size={15} />
            </button>
          )}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions" aria-label={chatLabel} aria-busy={msgs === null} className="tg-chat-bg h-full overflow-y-auto overscroll-contain px-2.5 py-3 sm:px-4">
          <div>
            {!msgs ? (
              <div className="space-y-2.5" aria-hidden="true">
                <span className="block h-10 w-2/3 rounded-2xl skeleton" />
                <span className="ml-auto block h-10 w-1/2 rounded-2xl skeleton" />
                <span className="block h-10 w-1/2 rounded-2xl skeleton" />
              </div>
            ) : msgs.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-fg-3">{t(topic ? "topicEmpty" : kind === "channel" ? "discussionFirst" : "groupFirst")}</p>
            ) : (
              <>
                {hasMore ? (
                  <p className="flex justify-center pb-2">
                    <button type="button" onClick={() => void loadOlder()} disabled={loadingOlder} className="tg-bubble inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold text-fg-3 shadow-sm transition hover:text-fg disabled:opacity-70">
                      {loadingOlder && <Loader2 size={12} className="animate-spin" aria-hidden="true" />} {t(loadingOlder ? "loadingOlder" : "loadOlder")}
                    </button>
                  </p>
                ) : null}
                {msgs.map((m, i) => {
                  const prev = i > 0 ? msgs[i - 1] : null;
                  const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
                  const sameSender = Boolean(prev && !newDay && prev.sender.id === m.sender.id);
                  const next = i < msgs.length - 1 ? msgs[i + 1] : null;
                  // Telegram: avatar va «dum» faqat ketma-ket xabarlar guruhining OXIRGISIDA
                  const lastOfRun = !next || next.sender.id !== m.sender.id || dayKey(next.at) !== dayKey(m.at);
                  // ✓✓ — boshqa a'zolardan kimdir shu xabardan keyin chatni o'qigan (server `readUpTo`)
                  const read = m.mine && readUpTo >= m.at;
                  const isPinned = pinned?.id === m.id;
                  const menuOpen = menu?.id === m.id;
                  const openAt = (anchor: LayerAnchor) => !m.deleted && setMenu({ id: m.id, anchor });
                  return (
                    <div key={m.id} data-msg-id={m.id} className={cn(fresh.current.has(m.id) && "animate-msg-in", sameSender ? "mt-0.5" : "mt-2.5")}>
                      {newDay && (
                        <p className="my-3 text-center">
                          <span className="tg-bubble inline-block rounded-full px-3 py-1 text-[12px] font-semibold text-fg-2 shadow-sm">{dayLabel(m.at, til, now)}</span>
                        </p>
                      )}
                      <div
                        {...swipeHandlers(m)}
                        style={swipe?.id === m.id ? { transform: `translateX(${swipe.dx}px)`, transition: "none" } : undefined}
                        className={cn("group relative flex items-end gap-1.5 transition-transform duration-200", m.mine ? "justify-end" : "justify-start")}
                      >
                        {swipe?.id === m.id && (
                          <span aria-hidden className="pointer-events-none absolute -left-10 top-1/2 grid h-8 w-8 place-items-center rounded-full bg-fg/10 text-fg" style={{ opacity: Math.min(1, swipe.dx / SWIPE_REPLY), transform: `translateY(-50%) scale(${swipe.dx >= SWIPE_REPLY ? 1 : 0.8})` }}>
                            <CornerUpLeft size={15} />
                          </span>
                        )}
                        {/* Avatar pufakcha pastiga tekis turadi — ostida reaksiya chiplari bo'lsa ularga emas (chip qatori balandligicha ko'tariladi) */}
                        {!m.mine && <span className={cn("w-8 shrink-0", !m.deleted && (m.reactions?.length ?? 0) > 0 && "mb-7")}>{lastOfRun && <Avatar name={m.sender.name} src={m.sender.avatarUrl} size={32} decorative className="!ring-0" />}</span>}
                        <div className={cn("flex min-w-0 max-w-[min(82%,520px)] flex-col", m.mine ? "items-end" : "items-start")}>
                          <div
                            id={`msg-${m.id}`}
                            {...(m.deleted ? {} : press((pt) => openAt(pt)))}
                            onContextMenu={(e) => {
                              if (m.deleted) return;
                              e.preventDefault();
                              openAt({ x: e.clientX, y: e.clientY });
                            }}
                            className={cn(
                              "relative max-w-full rounded-[16px] px-2.5 pb-1.5 pt-1.5 shadow-sm transition-shadow",
                              m.mine ? "tg-bubble-out text-ink-fg" : "tg-bubble text-fg",
                              lastOfRun && (m.mine ? "tg-tail-out rounded-br-[4px]" : "tg-tail-in rounded-bl-[4px]"),
                              m.deleted && "opacity-70",
                            )}
                          >
                            {!m.mine && !sameSender && <SenderName u={m.sender} />}
                            {m.replyTo && !m.deleted && <QuoteBlock q={m.replyTo} mine={m.mine} onJump={jump} locale={til} />}
                            {m.deleted ? (
                              <p className={cn("flex items-center gap-1.5 px-1 text-[13px] italic", m.mine ? "text-ink-fg/75" : "text-fg-3")}>
                                <Trash2 size={12} aria-hidden="true" /> {t("msgDeleted")}
                              </p>
                            ) : (
                              <>
                                <AttachmentList attachments={m.attachments} mine={m.mine} locale={til} />
                                {m.body && (
                                  <p className="whitespace-pre-wrap px-1 text-[14.5px] leading-[1.4] [overflow-wrap:anywhere]">
                                    <Linkified text={m.body} mine={m.mine} mentions />
                                    {/* Vaqt uchun joy: oxirgi qator vaqt bilan ustma-ust tushmasin */}
                                    <span aria-hidden className={cn("inline-block h-px align-bottom", m.edited ? "w-[124px]" : m.mine ? "w-[62px]" : "w-[42px]")} />
                                  </p>
                                )}
                              </>
                            )}
                            <span className={cn("flex items-center justify-end gap-1 text-[11px] tabular-nums", m.body && !m.deleted ? "absolute bottom-1 right-2.5" : "mt-0.5 px-1", m.mine ? "text-ink-fg/80" : "text-fg-4")}>
                              {isPinned && <Pin size={10} aria-label={t("pinnedBy")} />}
                              {m.edited && <span title={m.editedAt ? fullStamp(m.editedAt, til, now) : undefined}>{t("edited")}</span>}
                              <time dateTime={new Date(m.at).toISOString()} title={fullStamp(m.at, til, now)}>
                                {clock(m.at)}
                              </time>
                              {m.mine && !m.deleted && (read ? <CheckCheck size={15} strokeWidth={2.4} className="text-white" aria-label={t("seenShort")} /> : <Check size={15} strokeWidth={2.4} aria-label={t("sent")} />)}
                            </span>
                          </div>
                          {!m.deleted && <ReactionChips reactions={m.reactions ?? []} mine={m.mine} overlap={false} onToggle={(e) => void react(m, e)} />}
                          {m.mine && seen?.messageId === m.id && seen.count > 0 && <span className="mt-0.5 px-1 text-[11px] text-fg-3">{t("seenBy", { n: seen.count })}</span>}
                        </div>

                        {/* Amallar: «⋯» menyu (sichqonchada hover; sensorli ekranda — xabarni bosib turish) */}
                        {!m.deleted && (
                          <button
                            type="button"
                            aria-label={t("msgMenu")}
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            onClick={(e) => (menuOpen ? setMenu(null) : openAt(e.currentTarget))}
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-fg focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg group-hover:opacity-100 [@media(hover:none)]:hidden",
                              m.mine && "order-first",
                              menuOpen ? "opacity-100" : "opacity-0",
                            )}
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            {typing.length > 0 && (
              <div className="mt-2">
                <TypingDots label={typingLabel(typing, til)} />
              </div>
            )}
          </div>
        </div>

        {/* Yuqorida o'qiyotganda yangi xabar kelsa */}
        {newBtn.mounted && (
          <button type="button" onClick={() => (scrollToBottom(), void fetchNew())} className={cn("btn-ink absolute bottom-3 left-1/2 flex h-10 -translate-x-1/2 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-semibold", newBtn.closing ? "pop-out" : "pop-in")}>
            <ArrowDown size={14} /> {t("newMsgsN", { n: newCount })}
          </button>
        )}
      </div>

      {/* Kompozitor */}
      {closedTopic ? (
        <p className="flex items-center gap-2 border-t border-line px-4 py-3 text-[13px] text-fg-3" role="status">
          <Lock size={14} aria-hidden="true" /> {t("topicClosed")}
        </p>
      ) : (
        <div className="border-t border-line bg-bg p-2 sm:p-2.5">
          {editing && (
            <div className="expand-in mb-2 flex items-center gap-2 rounded-[12px] border-l-[3px] border-accent bg-accent-soft/60 py-1.5 pl-3 pr-1" role="status">
              <Pencil size={14} className="shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-bold text-accent-text">{t(editing.attachments.length ? "editCaption" : "edit")}</span>
                <span className="block truncate text-[12.5px] text-fg-2" data-no-auto>
                  {editing.body || quoteOf(editing).body}
                </span>
              </span>
              <button type="button" onClick={cancelEdit} aria-label={t("cancel")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-fg">
                <X size={14} />
              </button>
            </div>
          )}
          {replyTo && !editing && <ReplyBar q={quoteOf(replyTo)} onCancel={() => setReplyTo(null)} locale={til} />}
          {files.length > 0 && !editing && (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {files.map((a, i) => (
                <li key={a.url} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-fg/6 py-0.5 pl-2.5 pr-0.5 text-[12px] text-fg-2">
                  <Paperclip size={12} className="shrink-0" aria-hidden="true" />
                  <span className="max-w-[160px] truncate">{a.name}</span>
                  <span className="shrink-0 text-fg-4">{formatBytes(a.size)}</span>
                  <button type="button" aria-label={`${a.name} — ${t("removeFile")}`} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/10 hover:text-fg">
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-1.5">
            {!recording && !editing && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || files.length >= MAX_ATTACHMENTS}
                aria-label={t("attach")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-2 transition hover:bg-fg/6 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-50"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={17} />}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={UPLOAD_ACCEPT_DOCS}
              className="sr-only"
              tabIndex={-1}
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
                  if (e.key === "Escape") {
                    if (editing) cancelEdit();
                    else if (replyTo) setReplyTo(null);
                    return;
                  }
                  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                  // Sensorli klaviaturada Enter — yangi qator (yuborish tugma bilan); desktopda Enter yuboradi, Shift+Enter — yangi qator
                  if (coarse ? e.ctrlKey || e.metaKey : !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder={t(editing ? (editing.attachments.length ? "captionPh" : "editNewPh") : replyTo ? "replyPh" : "write")}
                ariaLabel={t(editing ? "editField" : "msgField")}
                wrapperClassName="min-w-0 flex-1"
                className="field max-h-32 min-h-10 w-full resize-none !rounded-[20px] !py-2.5 text-[14px] leading-snug max-md:text-[16px]"
                inputRef={(el) => {
                  inputEl.current = el;
                }}
              />
            )}
            {!recording && nearLimit && <span className={cn("self-center text-[11px] tabular-nums", over > 0 ? "font-semibold text-danger-text" : "text-fg-4")}>{GROUP_MSG_MAX - text.length}</span>}
            {editing ? (
              <button type="button" onClick={() => void send()} disabled={!canSend} aria-label={t("save")} className="btn-accent press flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40">
                <Check size={17} />
              </button>
            ) : text.trim() || files.length > 0 ? (
              <button type="button" onClick={() => void send()} disabled={!canSend} aria-label={t("send")} className="btn-accent press flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40">
                <Send size={17} />
              </button>
            ) : (
              <VoiceRecorder onRecorded={sendVoice} onError={setError} onPhase={setRecording} disabled={uploading} />
            )}
          </div>
          {(error || (over > 0 && !error)) && (
            <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-danger-text">
              <AlertCircle size={13} aria-hidden="true" /> {error ?? t("tooLong", { n: GROUP_MSG_MAX, over })}
            </p>
          )}
        </div>
      )}

      {/* Xabar menyusi: desktopda langarga bog'langan popover (ko'rish maydoniga sig'adi), telefonda pastki varaq */}
      <Layer open={Boolean(menu && menuMsg)} onClose={() => setMenu(null)} label={t("msgMenu")} anchor={menu?.anchor} align={mm?.mine ? "end" : "start"} width="w-[250px]">
        {mm && (
          <>
            <ReactionPicker
              current={mm.reactions?.find((r) => r.mine)?.emoji ?? null}
              onPick={(e) => {
                setMenu(null);
                void react(mm, e);
              }}
            />
            <MenuDivider />
            <MenuItem icon={CornerUpLeft} label={t("reply")} onClick={() => (setMenu(null), setEditing(null), setReplyTo(mm))} />
            {mm.body && <MenuItem icon={Copy} label={t("copy")} onClick={() => (setMenu(null), void copyText(mm))} />}
            {mm.canEdit && <MenuItem icon={Pencil} label={t(mm.attachments.length ? "editCaption" : "edit")} hint={t("editHint")} onClick={() => (setMenu(null), startEdit(mm))} />}
            {canManage && <MenuItem icon={pinned?.id === mm.id ? PinOff : Pin} label={t(pinned?.id === mm.id ? "unpin" : "pin")} onClick={() => (setMenu(null), void togglePin(mm))} />}
            {(mm.canDelete || !mm.mine) && <MenuDivider />}
            {mm.canDelete && <MenuItem icon={Trash2} label={t("remove")} danger onClick={() => (setMenu(null), void remove(mm))} />}
            {!mm.mine && <MenuItem icon={Flag} label={t("report")} danger onClick={() => (setMenu(null), setReportFor({ id: mm.id, key: Date.now() }))} />}
          </>
        )}
      </Layer>
      {/* Shikoyat (modal) — menyudan dasturiy ochiladi; trigger ko'rinmas */}
      {reportFor && (
        <div ref={reportHost} key={reportFor.key} className="absolute left-0 top-0 h-0 w-0">
          <ReportButton targetType="message" targetId={reportFor.id} loggedIn compact modal triggerClassName="pointer-events-none absolute h-px w-px opacity-0" />
        </div>
      )}
    </div>
  );
  return fullscreen ? createPortal(root, document.body) : root;
}
