"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, Ban, Copy, CornerUpLeft, Flag, FolderPlus, Forward, Info, Loader2, MessageCircle, MoreVertical, Paperclip, Pencil, Pin, PinOff, RotateCcw, Search, ShieldCheck, Timer, Trash2, User, WifiOff, X } from "lucide-react";
import { CallButton } from "@/components/call/CallButton";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { usePresence } from "@/components/motion/usePresence";
import { ReportButton } from "@/components/specialists/ReportButton";
import { VerifiedBadge } from "@/components/ui";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toast";
import { DM_DELETED_TEXT, DM_EDIT_WINDOW_MS, DM_SEARCH_MIN, type ReactionSummary } from "@/lib/chat/constants";
import type { QuoteView } from "@/lib/chat/quote";
import { dayKey, dayLabel, listStamp, relativeTime } from "@/lib/chat/time";
import { chatT, type ChatKey } from "@/lib/i18n/dict/chat";
import { cn } from "@/lib/utils";
import { isAudioAttachment, withRetryAfter, type Attachment } from "./attachments";
import type { ConvRow, FolderRow, Msg, Peer } from "./chat-types";
import { DmBubble } from "./DmBubble";
import { DmComposer, type ComposerHandle } from "./DmComposer";
import { DialogHead, ForwardDialog, InfoDialog, Layer, MenuDivider, MenuItem, PeerAvatar, PrefItems, type ConvPick, type ConvPrefsView, type LayerAnchor } from "./DmPanels";
import { ReactionPicker, TypingDots, iconBtn, jumpToMessage, preloadReactions, useNowTick } from "./MessageParts";
import { useStickyBottom } from "./useStickyBottom";

/** Yo'qolish muddati variantlari (lib/chat/dm.ts DM_TTL_OPTIONS bilan bir xil) */
const TTL_CHOICES: Array<{ sec: number; short: ChatKey; within: ChatKey | null }> = [
  { sec: 0, short: "ttlOff", within: null },
  { sec: 3600, short: "ttl1h", within: "ttlIn1h" },
  { sec: 86_400, short: "ttl1d", within: "ttlIn1d" },
  { sec: 604_800, short: "ttl1w", within: "ttlIn1w" },
];

const ONLINE_MS = 3 * 60 * 1000;
const DEFAULT_PREFS: ConvPrefsView = { archived: false, muted: false, pinned: false, folderId: null };
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** `GET /api/chat/<id>` javobi */
interface ThreadData {
  peer: Peer;
  blocked?: { byMe: boolean; me: boolean };
  peerReadAt?: number;
  readAt?: number | null;
  peerTyping?: boolean;
  pinned?: QuoteView | null;
  prefs?: ConvPrefsView | null;
  ttlSeconds?: number;
  reactions?: Record<string, ReactionSummary[]>;
  rxFrom?: number;
  items: Msg[];
  updates?: Msg[];
  hasMore?: boolean;
  now?: number;
}
type ApiResp<T> = { ok?: boolean; data?: T; error?: string; fields?: Record<string, string> } | null;

/** Javobdagi xatoni (429 bo'lsa Retry-After bilan) matnga aylantirish */
async function errorOf(res: Response, fallback: string): Promise<Error> {
  const json = (await res.json().catch(() => null)) as ApiResp<unknown>;
  const msg = (json?.fields && Object.values(json.fields)[0]) || json?.error || fallback;
  return new Error(res.status === 429 ? withRetryAfter(msg, res.headers.get("Retry-After")) : msg);
}

/**
 * Ochiq shaxsiy suhbat: sarlavha, xabarlar (Telegram pufakchalari), yozish maydoni va suhbat dialoglari.
 * Ota komponent uni `key={convId}` bilan chizadi — suhbat almashganda holat to'liq yangilanadi, eski so'rovlar bekor
 * qilinadi (QA A9: ilgari tez almashtirilganda birinchi yuklash tashlab yuborilib, suhbat skeletda qotib qolardi).
 *
 *  - Yuklash: oxirgi sahifa (80 ta); yuqoriga aylantirilganda eskiroq sahifalar (`?before=`); qidiruv / qadalgan xabar /
 *    iqtibos nishoni hali yuklanmagan bo'lsa — `?from=` bilan shu xabardan eng yangisigacha (QA C1).
 *  - Yangilanish: SSE `dm` hodisasi (`pulse`) → `?after=&sync=`; zaxira polling (SSE bo'lsa 30 s).
 *  - «O'qildi» faqat oyna fokusda VA o'quvchi ro'yxat oxirida turganda belgilanadi (QA B11); pastga qaytilganda darhol.
 *  - Pastga yopishish kontent balandligi o'zgarganda ham saqlanadi (rasmlar, qadoq paneli — QA A12).
 *  - Yo'qoladigan xabarlar: sarlavhada belgi, pufakchada soat, muddati kelganda ochiq oynadan ham o'chadi (QA A10).
 */
export function DmThread({
  convId,
  viewerRole,
  row,
  folders,
  forwardTargets,
  streamOn,
  pulse,
  portaled,
  onClose,
  onListChanged,
  onRead,
  onPrefs,
  onFolders,
  onDeleteChat,
  onDraft,
}: {
  convId: string;
  viewerRole?: string | null;
  /** Ro'yxatdagi qator (bo'lsa): sozlamalar manbai; sarlavha yuklanguncha shundan chiziladi */
  row: ConvRow | null;
  folders: FolderRow[];
  forwardTargets: ConvPick[];
  /** SSE ulanganmi (zaxira polling oralig'i) */
  streamOn: boolean;
  /** Shu suhbatda o'zgarish bo'lganda ortadi (SSE `dm` hodisasi) */
  pulse: number;
  /** Telefon to'liq ekran portali ichidami — aylanish konteyneri qayta yaratiladi */
  portaled: boolean;
  onClose: () => void;
  onListChanged: () => void;
  onRead: (convId: string) => void;
  onPrefs: (convId: string, patch: Partial<ConvPrefsView>) => void;
  /** Papkalar oynasini ochish (suhbatni papkaga joylash) */
  onFolders: () => void;
  /** «Suhbatni o'chirish» — tasdiq va so'rovni ota komponent bajaradi (ro'yxat menyusi bilan bitta yo'l) */
  onDeleteChat: (convId: string) => void;
  onDraft: (convId: string, text: string) => void;
}) {
  const locale = useLocale();
  const t = useCallback((k: ChatKey, v?: Record<string, string | number>) => chatT(locale, k, v), [locale]);
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();
  const now = useNowTick(60_000);

  const [peer, setPeer] = useState<Peer | null>(row?.peer ?? null);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reachedStart, setReachedStart] = useState(false);
  const [threadErr, setThreadErr] = useState<"gone" | "net" | null>(null);
  const [peerReadAt, setPeerReadAt] = useState(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const [pinned, setPinned] = useState<QuoteView | null>(null);
  const [blocked, setBlocked] = useState<{ byMe: boolean; me: boolean }>({ byMe: false, me: false });
  const [blockBusy, setBlockBusy] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<ConvPrefsView>(row?.prefs ?? DEFAULT_PREFS);
  const [ttl, setTtl] = useState(row?.ttlSeconds ?? 0);
  const [ttlDialog, setTtlDialog] = useState(false);
  const [dividerId, setDividerId] = useState<string | null>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const [newBelow, setNewBelow] = useState(0);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [menu, setMenu] = useState<{ id: string; anchor: LayerAnchor } | null>(null);
  const [headerMenu, setHeaderMenu] = useState<HTMLElement | null>(null);
  const [forwardOf, setForwardOf] = useState<Msg | null>(null);
  const [forwardBusy, setForwardBusy] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchRes, setSearchRes] = useState<Array<{ id: string; at: number; mine: boolean; snippet: string }> | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [reportFor, setReportFor] = useState<{ type: "message" | "user"; id: string; key: number } | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const [loadRev, setLoadRev] = useState(0);
  const [purgeTick, setPurgeTick] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const reportHostRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const alive = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const fullSeq = useRef(0);
  const loadedRef = useRef(false);
  const lastIdRef = useRef<string | null>(null);
  const syncRef = useRef(0);
  const skewRef = useRef(0);
  const pollBusy = useRef(false);
  const pollAgain = useRef(false);
  const olderBusy = useRef(false);
  const hasMoreRef = useRef(false);
  hasMoreRef.current = hasMore;
  const msgsRef = useRef<Msg[] | null>(null);
  msgsRef.current = msgs;
  const ttlRef = useRef(row?.ttlSeconds ?? 0);
  /** Muddatni o'zim o'zgartirgan vaqt — «suhbatdosh o'zgartirdi» xabari o'zimga chiqmasin */
  const ttlMine = useRef(0);
  /** O'qilmagan xabar kutmoqda (fokussiz yoki yuqorida o'qilgan) — pastga/fokusga qaytilganda «o'qildi» qilinadi */
  const unreadPending = useRef(false);
  const pendingScroll = useRef<"bottom" | "divider" | { jump: string } | null>(null);
  const dragDepth = useRef(0);
  const streamRef = useRef(streamOn);
  streamRef.current = streamOn;
  const peerNameRef = useRef(peer?.name ?? "");
  peerNameRef.current = peer?.name ?? "";
  const cb = useRef({ onListChanged, onRead, onClose });
  cb.current = { onListChanged, onRead, onClose };

  const prefs = row?.prefs ?? localPrefs;
  const ttlChoice = TTL_CHOICES.find((c) => c.sec === ttl) ?? TTL_CHOICES[0];

  useStickyBottom(scrollRef, stick, true, portaled ? 1 : 0);

  useEffect(() => {
    alive.current = true;
    preloadReactions();
    return () => {
      alive.current = false;
      abortRef.current?.abort();
    };
  }, []);

  /** Xabardan iqtibos (javob paneli / optimistik xabar uchun) — server bilan bir xil qoida */
  const quoteOf = useCallback(
    (m: Msg): QuoteView => {
      const a = m.attachments;
      const kind = a.some((x) => x.type.startsWith("audio/")) ? "voice" : a.some((x) => x.type.startsWith("video/")) ? "video" : a.some((x) => x.type.startsWith("image/")) ? "image" : a.length ? "file" : "text";
      const label = kind === "text" ? "" : t(kind);
      const text = m.body.replace(/\s+/g, " ").trim();
      return { id: m.id, body: text ? (text.length > 140 ? `${text.slice(0, 139)}…` : text) : label, senderName: m.mine ? t("you") : peerNameRef.current, kind };
    },
    [t],
  );

  /* ---------------- Server javobini qo'llash ---------------- */
  const applyMeta = useCallback(
    (d: ThreadData, initial: boolean) => {
      setPeer((p) => (sameJson(p, d.peer) ? p : d.peer));
      setPeerReadAt(d.peerReadAt ?? 0);
      setPeerTyping(Boolean(d.peerTyping));
      setPinned((p) => (sameJson(p, d.pinned ?? null) ? p : (d.pinned ?? null)));
      if (d.blocked) {
        const b = d.blocked;
        setBlocked((cur) => (cur.byMe === b.byMe && cur.me === b.me ? cur : b));
      }
      if (d.prefs) {
        const p = d.prefs;
        setLocalPrefs((cur) => (sameJson(cur, p) ? cur : p));
      }
      if (typeof d.ttlSeconds === "number") {
        // Suhbatdosh yo'qolish muddatini o'zgartirdi — ochiq oynada darhol aytiladi (sozlama ikki tomon uchun umumiy)
        if (!initial && d.ttlSeconds !== ttlRef.current && Date.now() - ttlMine.current > 5000) {
          const c = TTL_CHOICES.find((x) => x.sec === d.ttlSeconds);
          toast(c?.within ? t("ttlPeerOn", { t: t(c.within) }) : t("ttlPeerOff"), "info");
        }
        ttlRef.current = d.ttlSeconds;
        setTtl(d.ttlSeconds);
      }
      if (typeof d.now === "number") {
        syncRef.current = d.now;
        skewRef.current = d.now - Date.now();
      }
    },
    [t, toast],
  );

  /** To'liq yuklash (oxirgi sahifa). Har chaqiriq avvalgisini bekor qiladi — eskirgan javob qo'llanmaydi */
  const loadFull = useCallback(async () => {
    const seq = ++fullSeq.current;
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setThreadErr(null);
    // Oyna fokussiz bo'lsa «o'qildi» qilib qo'ymaymiz (yolg'on ✓✓ bo'lmasin)
    const reading = document.hasFocus();
    try {
      const res = await fetch(`/api/chat/${convId}${reading ? "" : "?read=0"}`, { signal: ctl.signal, cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiResp<ThreadData>;
      if (!alive.current || seq !== fullSeq.current) return;
      if (!res.ok || !json?.ok || !json.data) {
        setThreadErr(res.status === 404 ? "gone" : "net");
        return;
      }
      const d = json.data;
      applyMeta(d, true);
      const items = d.items;
      lastIdRef.current = items.length ? items[items.length - 1].id : null;
      const readAt = d.readAt ?? 0;
      const first = readAt > 0 ? items.find((x) => !x.mine && x.at > readAt) : undefined;
      setDividerId(first ? first.id : null);
      pendingScroll.current = first ? "divider" : "bottom";
      loadedRef.current = true;
      unreadPending.current = !reading;
      setMsgs((prev) => [...items, ...(prev ?? []).filter((x) => x.pending)]);
      setHasMore(Boolean(d.hasMore));
      setReachedStart(false);
      setFreshIds(new Set());
      setLoadRev((n) => n + 1);
      if (reading) cb.current.onRead(convId);
    } catch (e) {
      if (alive.current && seq === fullSeq.current && !(e instanceof DOMException && e.name === "AbortError")) setThreadErr("net");
    }
  }, [convId, applyMeta]);

  /** Yangi / o'zgargan xabarlar (`?after=&sync=`); qaytaradi: yangi xabar keldimi */
  const pollRef = useRef<() => Promise<boolean>>(async () => false);
  const poll = useCallback(async (): Promise<boolean> => {
    if (!loadedRef.current) return false;
    if (pollBusy.current) {
      // So'rov ketayotganda kelgan hodisa yo'qolmasin — tugagach yana bir marta so'raladi
      pollAgain.current = true;
      return false;
    }
    pollBusy.current = true;
    try {
      const params = new URLSearchParams();
      if (lastIdRef.current) params.set("after", lastIdRef.current);
      if (lastIdRef.current && syncRef.current) params.set("sync", String(syncRef.current));
      // «O'qildi» faqat oyna fokusda va o'quvchi ro'yxat oxirida turganda (yuqorida o'qiyotganda yangi xabar o'qilgan bo'lib ketmasin)
      const reading = document.hasFocus() && stick.current;
      if (!reading) params.set("read", "0");
      const res = await fetch(`/api/chat/${convId}${params.size ? `?${params}` : ""}`, { cache: "no-store" }).catch(() => null);
      const json = res ? ((await res.json().catch(() => null)) as ApiResp<ThreadData>) : null;
      if (!alive.current || !json?.ok || !json.data) return false;
      const d = json.data;
      applyMeta(d, false);
      const items = d.items;
      const updates = d.updates ?? [];
      const rx = d.reactions;
      const rxFrom = d.rxFrom ?? 0;
      if (items.length) lastIdRef.current = items[items.length - 1].id;
      const known = new Set((msgsRef.current ?? []).map((x) => x.id));
      const added = items.filter((x) => !known.has(x.id));
      const incoming = added.filter((x) => !x.mine).length;
      const gone = new Set(updates.filter((u) => u.deleted).map((u) => u.id));
      setMsgs((prev) => {
        let next = prev ?? [];
        let changed = false;
        const have = new Set(next.map((x) => x.id));
        const add = items.filter((x) => !have.has(x.id));
        if (add.length) {
          // O'z xabarim POST javobidan oldin shu yerdan kelsa — optimistik nusxasi olib tashlanadi (ikki marta ko'rinmasin)
          for (const a of add) {
            if (!a.mine) continue;
            const i = next.findIndex((x) => x.pending === "sending" && x.body === a.body && x.attachments.length === a.attachments.length);
            if (i >= 0) next = next.filter((_, j) => j !== i);
          }
          next = [...next.filter((x) => !x.pending), ...add, ...next.filter((x) => x.pending)];
          changed = true;
        }
        if (updates.length) {
          const up = new Map(updates.map((u) => [u.id, u]));
          next = next.map((x) => {
            const u = up.get(x.id);
            // Reaksiyalar oynasidan eski xabarda (tahrirlangan) reaksiyalar saqlanadi
            return u ? { ...u, reactions: u.at >= rxFrom ? u.reactions : x.reactions } : x;
          });
          // O'chirilgan xabarga javob iqtiboslari ham yangilansin
          if (gone.size) next = next.map((x) => (x.replyTo && gone.has(x.replyTo.id) ? { ...x, replyTo: { ...x.replyTo, body: DM_DELETED_TEXT[locale], senderName: "", kind: "text" as const } } : x));
          changed = true;
        }
        if (rx) {
          let touched = false;
          const withRx = next.map((x) => {
            if (x.pending || x.deleted || x.at < rxFrom) return x;
            const r = rx[x.id] ?? [];
            if (sameJson(r, x.reactions ?? [])) return x;
            touched = true;
            return { ...x, reactions: r };
          });
          if (touched) {
            next = withRx;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      if (added.length) setFreshIds((s) => new Set([...s, ...added.map((x) => x.id)]));
      if (gone.size) {
        setReplyTo((r) => (r && gone.has(r.id) ? null : r));
        setEditing((e) => (e && gone.has(e.id) ? null : e));
      }
      if (incoming && !stick.current) setNewBelow((n) => n + incoming);
      if (reading) {
        unreadPending.current = false;
        cb.current.onRead(convId);
      } else if (incoming) unreadPending.current = true;
      return items.length > 0;
    } finally {
      pollBusy.current = false;
      if (pollAgain.current && alive.current) {
        pollAgain.current = false;
        void pollRef.current();
      }
    }
  }, [convId, applyMeta, locale]);
  pollRef.current = poll;

  /** Eskiroq sahifa (yuqoriga aylantirilganda) — aylanish o'rni saqlanadi */
  const loadOlder = useCallback(async () => {
    if (olderBusy.current || !hasMoreRef.current || !loadedRef.current) return;
    const el = scrollRef.current;
    const firstId = el?.querySelector<HTMLElement>("[data-msg-id]")?.dataset.msgId;
    if (!firstId) return;
    olderBusy.current = true;
    setLoadingOlder(true);
    try {
      const res = await fetch(`/api/chat/${convId}?before=${encodeURIComponent(firstId)}`, { cache: "no-store" }).catch(() => null);
      const json = res ? ((await res.json().catch(() => null)) as ApiResp<{ items: Msg[]; hasMore: boolean }>) : null;
      if (!alive.current || !json?.ok || !json.data) return;
      const older = json.data.items;
      const prevH = el?.scrollHeight ?? 0;
      const prevTop = el?.scrollTop ?? 0;
      stick.current = false;
      setMsgs((prev) => {
        const have = new Set((prev ?? []).map((x) => x.id));
        return [...older.filter((x) => !have.has(x.id)), ...(prev ?? [])];
      });
      setHasMore(Boolean(json.data.hasMore));
      if (!json.data.hasMore) setReachedStart(true);
      window.requestAnimationFrame(() => {
        if (el) el.scrollTop = prevTop + (el.scrollHeight - prevH);
      });
    } finally {
      olderBusy.current = false;
      setLoadingOlder(false);
    }
  }, [convId]);

  /**
   * Hali yuklanmagan xabarga sakrash (qidiruv natijasi, qadalgan xabar, iqtibos, media): nishondan eng yangisigacha
   * yuklanadi. Oraliq juda uzun bo'lsa server 422 qaytaradi — foydalanuvchiga aytiladi.
   */
  const loadFrom = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/chat/${convId}?from=${encodeURIComponent(id)}&read=0`, { cache: "no-store" }).catch(() => null);
      const json = res ? ((await res.json().catch(() => null)) as ApiResp<ThreadData>) : null;
      if (!alive.current) return;
      if (!res?.ok || !json?.ok || !json.data) {
        toast(res?.status === 422 ? t("tooOld") : res?.status === 404 ? t("msgGone") : json?.error || t("fail"), "info");
        return;
      }
      const d = json.data;
      applyMeta(d, false);
      lastIdRef.current = d.items.length ? d.items[d.items.length - 1].id : lastIdRef.current;
      stick.current = false;
      pendingScroll.current = { jump: id };
      setDividerId(null);
      setMsgs((prev) => [...d.items, ...(prev ?? []).filter((x) => x.pending)]);
      setHasMore(Boolean(d.hasMore));
      setReachedStart(false);
      setFreshIds(new Set());
      setNearBottom(false);
      setNewBelow(0);
      setLoadRev((n) => n + 1);
    },
    [convId, applyMeta, t, toast],
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

  /* ---------------- Yuklash + zaxira polling ---------------- */
  useEffect(() => {
    let timer = 0;
    let stopped = false;
    let idle = 0;
    // SSE ulangan bo'lsa polling faqat zaxira (30 s); aks holda sekinlashuvchi oraliq
    const delay = () => (streamRef.current ? 30000 : idle < 12 ? 4000 : idle < 60 ? 8000 : 15000);
    const schedule = () => {
      if (stopped) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, delay());
    };
    const tick = async () => {
      if (stopped) return;
      if (!document.hidden) {
        const got = await pollRef.current();
        idle = got ? 0 : idle + 1;
      }
      schedule();
    };
    const onVis = () => {
      if (document.hidden) return;
      idle = 0;
      window.clearTimeout(timer);
      void tick();
    };
    void loadFull().then(schedule);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [loadFull]);

  // Real-time: shu suhbatda o'zgarish (SSE) → darhol yangilarini so'raymiz
  useEffect(() => {
    if (pulse > 0) void pollRef.current();
  }, [pulse]);

  /* ---------------- Aylanish ---------------- */
  // To'liq yuklash / sakrashdan keyin: «Yangi xabarlar» chizig'iga, nishon xabarga yoki ro'yxat oxiriga
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const mode = pendingScroll.current;
    if (!el || !mode) return;
    pendingScroll.current = null;
    if (typeof mode === "object") {
      window.setTimeout(() => jumpToMessage(mode.jump), 60);
      return;
    }
    const d = mode === "divider" && dividerId ? document.getElementById(`divider-${dividerId}`) : null;
    if (d) {
      el.scrollTop = Math.max(0, d.offsetTop - 80);
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      stick.current = near;
      setNearBottom(near);
      return;
    }
    el.scrollTop = el.scrollHeight;
    stick.current = true;
    setNearBottom(true);
    // dividerId shu yuklash bilan birga o'rnatiladi (loadRev bilan bir renderda)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRev]);

  // Pastda tursa — yangi xabarda / «yozmoqda» chiqqanda / portalga ko'chganda ro'yxat oxirida qoladi
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs, peerTyping, portaled]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stick.current = near;
    setNearBottom(near);
    if (near) {
      setNewBelow(0);
      // Ro'yxat oxiriga qaytildi — kutib turgan xabarlar endi «o'qildi»
      if (unreadPending.current && document.hasFocus()) void pollRef.current();
    }
    if (el.scrollTop < 160) void loadOlder();
  };
  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setNewBelow(0);
  };

  /* ---------------- Yo'qoladigan xabarlar: muddati kelgani ochiq oynadan ham olinadi ---------------- */
  useEffect(() => {
    const list = msgsRef.current;
    const stamps = (list ?? []).flatMap((m) => (m.expiresAt ? [m.expiresAt] : []));
    if (!stamps.length) return;
    const wait = Math.max(1000, Math.min(30_000, Math.min(...stamps) - (Date.now() + skewRef.current) + 300));
    const id = window.setTimeout(() => {
      const at = Date.now() + skewRef.current;
      const dead = new Set((msgsRef.current ?? []).filter((m) => m.expiresAt && m.expiresAt <= at).map((m) => m.id));
      if (dead.size) {
        setMsgs((cur) =>
          (cur ?? [])
            .filter((m) => !dead.has(m.id))
            .map((m) => (m.replyTo && dead.has(m.replyTo.id) ? { ...m, replyTo: { ...m.replyTo, body: DM_DELETED_TEXT[locale], senderName: "", kind: "text" as const } } : m)),
        );
        setPinned((p) => (p && dead.has(p.id) ? null : p));
        setReplyTo((r) => (r && dead.has(r.id) ? null : r));
        setEditing((e) => (e && dead.has(e.id) ? null : e));
        setMenu((mm) => (mm && dead.has(mm.id) ? null : mm));
        cb.current.onListChanged();
      }
      setPurgeTick((n) => n + 1);
    }, wait);
    return () => window.clearTimeout(id);
  }, [msgs, purgeTick, locale]);

  /* ---------------- Yuborish ---------------- */
  /** Optimistik yuborish: avval «yuborilmoqda», muvaffaqiyatda almashadi, xatoda — sabab va «Qayta» pufakcha ostida */
  const deliver = useCallback(
    async (body: string, attachments: Attachment[], replyToId: string | null, retryId?: string) => {
      const tempId = retryId ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const list = msgsRef.current ?? [];
      const quoted = replyToId ? list.find((x) => x.id === replyToId) : null;
      const old = retryId ? list.find((x) => x.id === retryId) : null;
      const temp: Msg = { id: tempId, mine: true, body, attachments, at: Date.now(), replyTo: old?.replyTo ?? (quoted ? quoteOf(quoted) : null), replyToId, pending: "sending" };
      stick.current = true;
      setReplyTo((r) => (r && r.id === replyToId ? null : r));
      setMsgs((m) => [...(m ?? []).filter((x) => x.id !== tempId), temp]);
      try {
        const res = await fetch(`/api/chat/${convId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, attachments, replyToId }) });
        if (!res.ok) throw await errorOf(res, t("failed"));
        const json = (await res.json()) as { data: Msg };
        if (!alive.current) return;
        const saved = json.data;
        setMsgs((m) => {
          const cur = m ?? [];
          // Polling shu xabarni allaqachon olib kelgan bo'lsa — faqat vaqtinchalik nusxa olinadi
          if (cur.some((x) => x.id === saved.id)) return cur.filter((x) => x.id !== tempId);
          const i = cur.findIndex((x) => x.id === tempId);
          if (i < 0) return [...cur.filter((x) => !x.pending), saved, ...cur.filter((x) => x.pending)];
          const next = [...cur];
          next[i] = saved;
          return next;
        });
        if (!lastIdRef.current || saved.at >= ((msgsRef.current ?? []).find((x) => x.id === lastIdRef.current)?.at ?? 0)) lastIdRef.current = saved.id;
        setFreshIds((s) => new Set([...s, saved.id]));
        cb.current.onListChanged();
      } catch (err) {
        if (!alive.current) return;
        const reason = err instanceof TypeError ? t("netError") : err instanceof Error && err.message ? err.message : t("failed");
        setMsgs((m) => (m ?? []).map((x) => (x.id === tempId ? { ...x, pending: "failed" as const, error: reason } : x)));
      }
    },
    [convId, quoteOf, t],
  );

  const saveEdit = useCallback(
    async (m: Msg, body: string) => {
      const res = await fetch(`/api/chat/${convId}/messages/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      if (!res.ok) throw await errorOf(res, t("editFail"));
      const json = (await res.json()) as { data: Msg };
      if (!alive.current) return;
      setMsgs((cur) => (cur ?? []).map((x) => (x.id === m.id ? { ...x, ...json.data, reactions: x.reactions } : x)));
      setEditing(null);
      cb.current.onListChanged();
      // Qadalgan xabar matni ham yangilansin
      void pollRef.current();
    },
    [convId, t],
  );

  /* ---------------- Amallar ---------------- */
  const react = useCallback(
    async (m: Msg, emoji: string) => {
      if (m.pending || m.deleted) return;
      const before = m.reactions ?? [];
      const cur = before.find((r) => r.mine)?.emoji ?? null;
      const next = cur === emoji ? null : emoji;
      const apply = (list: ReactionSummary[]) => setMsgs((all) => (all ?? []).map((x) => (x.id === m.id ? { ...x, reactions: list } : x)));
      // Optimistik yangilash
      const opt = before.map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false } : { ...r })).filter((r) => r.count > 0);
      if (next) {
        const hit = opt.find((r) => r.emoji === next);
        if (hit) {
          hit.count += 1;
          hit.mine = true;
        } else opt.push({ emoji: next, count: 1, mine: true });
      }
      apply(opt);
      const res = await fetch(`/api/chat/${convId}/messages/${m.id}/reaction`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji: next }) }).catch(() => null);
      const json = res ? ((await res.json().catch(() => null)) as ApiResp<{ reactions: ReactionSummary[] }>) : null;
      if (!alive.current) return;
      if (json?.ok && json.data) apply(json.data.reactions);
      else {
        apply(before);
        toast(json?.error ?? (res ? t("fail") : t("netError")), "error");
      }
    },
    [convId, t, toast],
  );

  /** O'chirish — tasdiq bilan (qaytarib bo'lmaydi); «O'chirildi» belgisini olib tashlash ham shu yerda */
  const removeMsg = async (m: Msg, scope: "me" | "all") => {
    const okay = await confirm(
      m.deleted
        ? { title: t("deleteTombQ"), text: t("deleteTombText"), confirmLabel: t("remove"), danger: true }
        : scope === "all"
          ? { title: t("deleteAllQ"), text: t("deleteAllText"), confirmLabel: t("remove"), danger: true }
          : { title: t("deleteMeQ"), text: t("deleteMeText"), confirmLabel: t("remove"), danger: true },
    );
    if (!okay) return;
    const res = await fetch(`/api/chat/${convId}/messages/${m.id}?scope=${scope}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return toast(res ? (await errorOf(res, t("deleteFail"))).message : t("netError"), "error");
    if (!alive.current) return;
    setMsgs((cur) => (scope === "me" ? (cur ?? []).filter((x) => x.id !== m.id) : (cur ?? []).map((x) => (x.id === m.id ? { ...x, deleted: true, body: "", attachments: [], reactions: [], call: null, forwardedFrom: null } : x))));
    if (pinned?.id === m.id) setPinned(null);
    if (replyTo?.id === m.id) setReplyTo(null);
    if (editing?.id === m.id) setEditing(null);
    cb.current.onListChanged();
  };

  const dropLocal = useCallback((m: Msg) => setMsgs((cur) => (cur ?? []).filter((x) => x.id !== m.id)), []);
  const retry = useCallback((m: Msg) => void deliver(m.body, m.attachments, m.replyToId ?? null, m.id), [deliver]);

  const togglePin = async (m: Msg | null) => {
    const messageId = m && pinned?.id !== m.id ? m.id : null;
    const res = await fetch(`/api/chat/${convId}/pin`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId }) }).catch(() => null);
    const json = res ? ((await res.json().catch(() => null)) as ApiResp<{ pinned: QuoteView | null }>) : null;
    if (!alive.current) return;
    if (json?.ok && json.data) {
      setPinned(json.data.pinned);
      toast(t(messageId ? "msgPinned" : "msgUnpinned"), "info");
    } else toast(json?.error ?? (res ? t("fail") : t("netError")), "error");
  };

  const doForward = async (toId: string) => {
    if (!forwardOf || forwardBusy) return;
    setForwardBusy(true);
    try {
      const res = await fetch(`/api/chat/${convId}/forward`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: forwardOf.id, to: toId }) });
      if (!res.ok) throw await errorOf(res, t("forwardFail"));
      setForwardOf(null);
      toast(t("forwardedOk"), "success");
      cb.current.onListChanged();
    } catch (e) {
      toast(e instanceof TypeError ? t("netError") : e instanceof Error ? e.message : t("forwardFail"), "error");
    } finally {
      setForwardBusy(false);
    }
  };

  const copyText = async (m: Msg) => {
    try {
      await navigator.clipboard.writeText(m.body);
      toast(t("copied"), "success");
    } catch {
      toast(t("copyFail"), "error");
    }
  };

  const startReply = useCallback((m: Msg) => {
    setEditing(null);
    setReplyTo(m);
  }, []);
  const startEdit = (m: Msg) => {
    setReplyTo(null);
    setEditing(m);
  };
  const openMenu = useCallback((m: Msg, anchor: LayerAnchor) => setMenu({ id: m.id, anchor }), []);

  const setBlock = async (next: boolean) => {
    if (!peer?.id || blockBusy) return;
    if (next && !(await confirm({ title: t("blockTitle", { name: peer.name }), text: t("blockText"), confirmLabel: t("block"), danger: true }))) return;
    setBlockBusy(true);
    try {
      const res = await fetch(`/api/blocks/${encodeURIComponent(peer.id)}`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) throw await errorOf(res, t("fail"));
      setBlocked((b) => ({ ...b, byMe: next }));
      setReplyTo(null);
      setEditing(null);
      toast(`${peer.name} ${t(next ? "blockedToast" : "unblockedToast")}`, next ? "info" : "success");
      cb.current.onListChanged();
      void pollRef.current();
    } catch (e) {
      toast(e instanceof TypeError ? t("netError") : e instanceof Error ? e.message : t("fail"), "error");
    } finally {
      setBlockBusy(false);
    }
  };

  /** Yo'qolish muddatini o'zgartirish (ikki tomon uchun umumiy) */
  const setTtlFor = async (seconds: number) => {
    const prev = ttl;
    ttlMine.current = Date.now();
    ttlRef.current = seconds;
    setTtl(seconds);
    const res = await fetch(`/api/chat/${convId}/ttl`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seconds }) }).catch(() => null);
    if (!res?.ok) {
      ttlRef.current = prev;
      setTtl(prev);
      toast(res ? (await errorOf(res, t("saveFail"))).message : t("netError"), "error");
      return;
    }
    const c = TTL_CHOICES.find((x) => x.sec === seconds);
    toast(c?.within ? t("ttlOn", { t: t(c.within) }) : t("ttlOffToast"), "success");
  };

  const changePrefs = (patch: Partial<ConvPrefsView>) => {
    setLocalPrefs((p) => ({ ...p, ...patch }));
    onPrefs(convId, patch);
  };

  // Shikoyat: menyu yopilgach ReportButton (modal) dasturiy ravishda ochiladi
  useEffect(() => {
    if (!reportFor) return;
    const id = window.setTimeout(() => reportHostRef.current?.querySelector("button")?.click(), 30);
    return () => window.clearTimeout(id);
  }, [reportFor]);

  // Suhbat ichida qidiruv (300 ms kechikish)
  useEffect(() => {
    if (!searchOpen) return;
    const qq = searchQ.trim();
    if (qq.length < DM_SEARCH_MIN) return setSearchRes(null);
    const id = window.setTimeout(async () => {
      const res = await fetch(`/api/chat/${convId}/search?q=${encodeURIComponent(qq)}`).catch(() => null);
      const json = res ? ((await res.json().catch(() => null)) as ApiResp<{ items: Array<{ id: string; at: number; mine: boolean; snippet: string }> }>) : null;
      if (alive.current) setSearchRes(json?.ok && json.data ? json.data.items : []);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchQ, searchOpen, convId]);
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQ("");
    setSearchRes(null);
  };

  // Desktop: suhbat ochilganda fokus yozish maydoniga (telefonda klaviatura o'zi chiqib ketmasin)
  const loaded = msgs !== null;
  useEffect(() => {
    if (loaded && window.matchMedia("(min-width: 1024px)").matches) composerRef.current?.focus();
  }, [loaded]);

  // Esc: qidiruvni yopadi; telefonda — suhbatdan ro'yxatga qaytaradi (ochiq oyna/menyu bo'lmasa)
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector('[role="alertdialog"],[role="dialog"],[role="menu"]')) return;
      if (searchOpen) return closeSearch();
      const tag = document.activeElement?.tagName;
      if (!window.matchMedia("(min-width: 1024px)").matches && tag !== "TEXTAREA" && tag !== "INPUT") cb.current.onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  /* ---------------- Drag & drop ---------------- */
  const composerLocked = blocked.byMe || blocked.me || Boolean(peer?.isBanned);
  const onDragEnter = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes("Files") || composerLocked) return;
    e.preventDefault();
    dragDepth.current++;
    setDragOver(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    if (composerLocked) return;
    composerRef.current?.addFiles(Array.from(e.dataTransfer?.files ?? []));
  };

  /* ---------------- Yordamchilar ---------------- */
  const presence = (() => {
    if (!peer) return { online: false, label: "" };
    if (peer.lastSeenAt && now - peer.lastSeenAt < ONLINE_MS) return { online: true, label: t("online") };
    const seen = peer.lastActiveAt ?? peer.lastSeenAt;
    return { online: false, label: seen ? `${t("lastSeen")} ${relativeTime(seen, locale, now)}` : "" };
  })();
  const canEdit = (m: Msg) => m.mine && !m.deleted && !m.pending && !m.call && now - m.at < DM_EDIT_WINDOW_MS && !m.attachments.some((a) => isAudioAttachment(a) || a.round);
  const menuMsg = menu ? ((msgs ?? []).find((m) => m.id === menu.id) ?? null) : null;
  // Menyu yopilish animatsiyasi paytida bandlar yo'qolib qolmasin — oxirgi xabar bilan chiziladi
  const lastMenuMsg = useRef<Msg | null>(null);
  if (menuMsg) lastMenuMsg.current = menuMsg;
  const mm = menuMsg ?? lastMenuMsg.current;
  const replyQuote = replyTo ? quoteOf(replyTo) : null;

  const typingPresence = usePresence(peerTyping && Boolean(peer) && !composerLocked, 160);
  const jumpPresence = usePresence(!nearBottom && (msgs?.length ?? 0) > 0, 160);
  const pinPresence = usePresence(Boolean(pinned), 160);
  const lastPinned = useRef<QuoteView | null>(null);
  if (pinned) lastPinned.current = pinned;
  const shownPin = pinned ?? lastPinned.current;
  const searchPresence = usePresence(searchOpen, 160);
  const dragPresence = usePresence(dragOver, 160);

  const headInner = peer ? (
    <>
      <span className="relative shrink-0">
        <PeerAvatar name={peer.name} avatarUrl={peer.avatarUrl} size={38} />
        {presence.online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-success" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1 text-[14.5px] font-semibold leading-tight text-fg">
          <span className="truncate" data-no-auto>
            {peer.name}
          </span>
          {peer.isVerified && <VerifiedBadge size={13} className="shrink-0" />}
        </span>
        <span className={cn("block truncate text-[12px]", peerTyping && !composerLocked ? "italic text-accent-text" : presence.online ? "font-medium text-success-text" : "text-fg-3")}>{peerTyping && !composerLocked ? t("typing") : presence.label}</span>
      </span>
    </>
  ) : null;

  return (
    <div className="card-elevated relative flex min-h-0 flex-1 flex-col overflow-hidden max-lg:rounded-none max-lg:border-0 max-lg:shadow-none" onDragEnter={onDragEnter} onDragOver={(e) => e.preventDefault()} onDragLeave={onDragLeave} onDrop={onDrop}>
      {/* Sarlavha */}
      <div className="relative flex shrink-0 items-center gap-1 border-b border-line px-2 py-2">
        <button type="button" onClick={onClose} aria-label={t("backToChats")} className={cn(iconBtn, "lg:hidden")}>
          <ArrowLeft size={18} />
        </button>
        {peer ? (
          peer.slug ? (
            <Link href={`/mutaxassislar/${peer.slug}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[12px] px-1.5 py-1 transition hover:bg-fg/5 lg:ml-1" title={t("profile")}>
              {headInner}
            </Link>
          ) : (
            <button type="button" onClick={() => setInfoOpen(true)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[12px] px-1.5 py-1 text-left transition hover:bg-fg/5 lg:ml-1" title={t("info")}>
              {headInner}
            </button>
          )
        ) : (
          <div className="flex flex-1 items-center gap-2.5 px-1.5 py-1 lg:ml-1" aria-busy="true">
            <span className="h-[38px] w-[38px] rounded-full skeleton" />
            <span className="h-4 w-32 skeleton" />
          </div>
        )}
        {ttl > 0 && (
          <button type="button" onClick={() => setTtlDialog(true)} title={ttlChoice.within ? t("ttlOn", { t: t(ttlChoice.within) }) : t("ttlTitle")} aria-label={`${t("ttlTitle")}: ${t(ttlChoice.short)}`} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 text-[12px] font-bold text-accent-text transition hover:opacity-85">
            <Timer size={13} aria-hidden="true" /> <span className="max-sm:hidden">{t(ttlChoice.short)}</span>
          </button>
        )}
        {peer && !composerLocked && <CallButton kind="dm" id={convId} title={peer.name} />}
        <button type="button" onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))} aria-pressed={searchOpen} aria-label={t("searchMsgs")} title={t("searchMsgs")} className={cn(iconBtn, "max-sm:hidden", searchOpen && "bg-fg/6 text-fg")}>
          <Search size={16} />
        </button>
        <button type="button" onClick={(e) => setHeaderMenu(headerMenu ? null : e.currentTarget)} aria-haspopup="menu" aria-expanded={Boolean(headerMenu)} aria-label={t("menu")} className={cn(iconBtn, headerMenu && "bg-fg/6 text-fg")}>
          <MoreVertical size={17} />
        </button>
        <button type="button" onClick={onClose} aria-label={t("close")} className={cn(iconBtn, "max-lg:hidden")}>
          <X size={16} />
        </button>
      </div>

      {/* Qidiruv paneli */}
      {searchPresence.mounted && (
        <div className={cn(searchPresence.closing ? "expand-out" : "expand-in", "shrink-0 border-b border-line bg-surface-2 p-2")}>
          <label className="relative block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-4" aria-hidden="true" />
            <input autoFocus value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), e.preventDefault(), closeSearch())} maxLength={80} placeholder={t("searchPh")} aria-label={t("searchPh")} className="field h-10 w-full !rounded-full pl-8 pr-11 text-[13.5px] max-md:text-[16px]" />
            <button type="button" onClick={closeSearch} aria-label={t("searchClose")} className="absolute right-0.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-fg-4 hover:bg-fg/8 hover:text-fg">
              <X size={14} />
            </button>
          </label>
          {searchRes && (
            <ul className="mt-1.5 max-h-52 overflow-y-auto" aria-live="polite">
              {searchRes.length === 0 && <li className="px-2 py-2 text-[12.5px] text-fg-3">{t("noResults")}</li>}
              {searchRes.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => jump(r.id)} className="flex min-h-10 w-full items-baseline gap-2 rounded-[10px] px-2.5 py-2 text-left transition hover:bg-fg/6">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-fg" data-no-auto>
                      <span className="text-fg-4">{r.mine ? `${t("you")}: ` : ""}</span>
                      {r.snippet}
                    </span>
                    <span className="shrink-0 text-[11px] text-fg-4">{listStamp(r.at, locale, now)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Qadalgan xabar */}
      {pinPresence.mounted && shownPin && (
        <div className={cn(pinPresence.closing ? "expand-out" : "expand-in", "flex w-full shrink-0 items-center gap-1 border-b border-line pl-3 pr-1 sm:pl-4")}>
          <button type="button" onClick={() => jump(shownPin.id)} className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left transition hover:opacity-80" title={t("pinned")}>
            <span aria-hidden className="h-8 w-[3px] shrink-0 rounded-full bg-accent" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-accent-text">{t("pinned")}</span>
              <span className="block truncate text-[13px] text-fg" data-no-auto>
                {shownPin.body || "…"}
              </span>
            </span>
          </button>
          <button type="button" onClick={() => void togglePin(null)} aria-label={t("unpin")} title={t("unpin")} className={iconBtn}>
            <PinOff size={15} />
          </button>
        </div>
      )}

      {/* Xabarlar */}
      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className="tg-chat-bg relative h-full overflow-y-auto overscroll-contain px-2.5 py-3 sm:px-4" role="log" aria-live="polite" aria-relevant="additions" aria-busy={msgs === null && !threadErr} aria-label={peer?.name}>
          <div>
            {threadErr ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                <span className="icon-tile-soft !rounded-full">{threadErr === "gone" ? <MessageCircle size={20} /> : <WifiOff size={20} />}</span>
                <div>
                  <p className="font-display text-[15px] font-semibold text-fg">{t(threadErr === "gone" ? "convGone" : "loadErr")}</p>
                  {threadErr === "gone" && <p className="mt-1 text-[13px] text-fg-3">{t("convGoneHint")}</p>}
                </div>
                {threadErr === "gone" ? (
                  <button type="button" onClick={onClose} className="h-10 rounded-full border border-line px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                    {t("backToChats")}
                  </button>
                ) : (
                  <button type="button" onClick={() => void loadFull()} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                    <RotateCcw size={13} aria-hidden="true" /> {t("tryAgain")}
                  </button>
                )}
              </div>
            ) : !msgs ? (
              <div className="space-y-2.5" aria-hidden="true">
                <span className="block h-10 w-2/3 rounded-2xl skeleton" />
                <span className="ml-auto block h-10 w-1/2 rounded-2xl skeleton" />
                <span className="block h-10 w-1/2 rounded-2xl skeleton" />
              </div>
            ) : msgs.length === 0 ? (
              <p className="py-12 text-center">
                <span className="tg-bubble inline-block rounded-full px-3.5 py-1.5 text-[13px] text-fg-3 shadow-sm">{t("firstMsg")}</span>
              </p>
            ) : (
              <>
                {hasMore ? (
                  <p className="flex justify-center pb-2">
                    <button type="button" onClick={() => void loadOlder()} disabled={loadingOlder} className="tg-bubble inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold text-fg-3 shadow-sm transition hover:text-fg disabled:opacity-70">
                      {loadingOlder && <Loader2 size={12} className="animate-spin" aria-hidden="true" />} {t(loadingOlder ? "loadingOlder" : "loadOlder")}
                    </button>
                  </p>
                ) : reachedStart ? (
                  <p className="flex justify-center pb-2">
                    <span className="tg-bubble rounded-full px-3 py-1 text-[12px] font-semibold text-fg-3 shadow-sm">{t("historyStart")}</span>
                  </p>
                ) : null}
                {msgs.map((m, i) => {
                  const prev = i > 0 ? msgs[i - 1] : null;
                  const next = i < msgs.length - 1 ? msgs[i + 1] : null;
                  const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
                  const divider = dividerId === m.id;
                  return (
                    <DmBubble
                      key={m.id}
                      m={m}
                      locale={locale}
                      convId={convId}
                      peerName={peer?.name ?? ""}
                      day={newDay ? dayLabel(m.at, locale, now) : null}
                      divider={divider}
                      joined={Boolean(prev && !newDay && !divider && prev.mine === m.mine)}
                      tail={!next || next.mine !== m.mine || dayKey(next.at) !== dayKey(m.at) || dividerId === next.id}
                      read={m.mine && !m.pending && peerReadAt >= m.at}
                      pinned={pinned?.id === m.id}
                      menuOpen={menu?.id === m.id}
                      fresh={freshIds.has(m.id)}
                      onMenu={openMenu}
                      onReact={react}
                      onJump={jump}
                      onReply={startReply}
                      onRetry={retry}
                      onDrop={dropLocal}
                    />
                  );
                })}
              </>
            )}
            {typingPresence.mounted && peer && (
              <div className="mt-2">
                <TypingDots label={`${peer.name} ${t("typing")}`} closing={typingPresence.closing} />
              </div>
            )}
          </div>
        </div>

        {/* «Pastga» tugmasi (yuqorida o'qiyotganda kelgan yangi xabarlar soni bilan) */}
        {jumpPresence.mounted && (
          <button type="button" onClick={scrollToBottom} aria-label={newBelow > 0 ? `${t("toLatest")} — ${t("newMsgsN", { n: newBelow })}` : t("toLatest")} className={cn(jumpPresence.closing ? "pop-out" : "pop-in", "card-floating absolute bottom-3 right-3 z-[2] flex h-10 min-w-10 items-center justify-center gap-1.5 !rounded-full px-2.5 text-fg")}>
            <ArrowDown size={16} />
            {newBelow > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold leading-[18px] text-white">{newBelow}</span>}
          </button>
        )}
      </div>

      {/* Drag&drop overlay */}
      {dragPresence.mounted && (
        <div className={cn(dragPresence.closing ? "overlay-out" : "overlay-in", "pointer-events-none absolute inset-0 z-[3] flex items-center justify-center bg-surface/85")} aria-hidden="true">
          <p className="flex items-center gap-2 rounded-full border border-dashed border-fg px-4 py-2 text-[13.5px] font-semibold text-fg">
            <Paperclip size={15} /> {t("dropHere")}
          </p>
        </div>
      )}

      {/* Yozish maydoni */}
      {composerLocked ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line bg-bg px-3.5 py-3 text-[13px] text-fg-2" role="status">
          <Ban size={14} className="shrink-0 text-fg-3" aria-hidden="true" />
          <span className="min-w-0 flex-1">{peer?.isBanned ? t("banned") : blocked.byMe ? t("blockedByMe") : t("blockedMe")}</span>
          {blocked.byMe && (
            <button type="button" onClick={() => void setBlock(false)} disabled={blockBusy} className="h-10 rounded-full border border-line px-4 text-[12.5px] font-semibold text-fg transition hover:border-fg disabled:opacity-50">
              {t("unblock")}
            </button>
          )}
        </div>
      ) : (
        !threadErr && (
          <DmComposer
            ref={composerRef}
            convId={convId}
            locale={locale}
            viewerRole={viewerRole}
            replyTo={replyTo}
            replyQuote={replyQuote}
            editing={editing}
            onCancelReply={() => setReplyTo(null)}
            onCancelEdit={() => setEditing(null)}
            onSend={(body, attachments, replyToId) => void deliver(body, attachments, replyToId)}
            onSaveEdit={saveEdit}
            onDraft={(text) => onDraft(convId, text)}
          />
        )
      )}

      {/* Sarlavha menyusi */}
      <Layer open={Boolean(headerMenu)} onClose={() => setHeaderMenu(null)} label={t("menu")} anchor={headerMenu} width="w-[260px]">
        {peer?.slug && <MenuItem icon={User} label={t("profile")} onClick={() => (setHeaderMenu(null), router.push(`/mutaxassislar/${peer.slug}`))} />}
        <MenuItem icon={Search} label={t("searchMsgs")} onClick={() => (setHeaderMenu(null), setSearchOpen(true))} />
        <MenuItem icon={Info} label={t("info")} onClick={() => (setHeaderMenu(null), setInfoOpen(true))} />
        <MenuDivider />
        <PrefItems prefs={prefs} locale={locale} onChange={(p) => (setHeaderMenu(null), changePrefs(p))} />
        <MenuItem icon={Timer} label={ttl ? t("ttlMenuOn", { t: t(ttlChoice.short) }) : t("ttlTitle")} onClick={() => (setHeaderMenu(null), setTtlDialog(true))} active={ttl > 0} />
        {row && <MenuItem icon={FolderPlus} label={prefs.folderId ? `${t("folderLabel")}: ${folders.find((f) => f.id === prefs.folderId)?.name ?? "—"}` : t("toFolder")} onClick={() => (setHeaderMenu(null), onFolders())} active={Boolean(prefs.folderId)} />}
        <MenuDivider />
        <MenuItem icon={Trash2} label={t("deleteChat")} danger onClick={() => (setHeaderMenu(null), onDeleteChat(convId))} />
        {peer?.id && (
          <>
            <MenuItem icon={Flag} label={t("report")} onClick={() => (setHeaderMenu(null), setReportFor({ type: "user", id: peer.id, key: Date.now() }))} />
            <MenuItem icon={blocked.byMe ? ShieldCheck : Ban} label={t(blocked.byMe ? "unblock" : "block")} danger={!blocked.byMe} disabled={blockBusy} onClick={() => (setHeaderMenu(null), void setBlock(!blocked.byMe))} />
          </>
        )}
      </Layer>

      {/* Xabar menyusi: desktopda langarga bog'langan popover (ko'rish maydoniga sig'adi), telefonda pastki varaq */}
      <Layer open={Boolean(menu && menuMsg)} onClose={() => setMenu(null)} label={t("msgMenu")} anchor={menu?.anchor} align={mm?.mine ? "end" : "start"} width="w-[250px]">
        {mm &&
          (mm.pending === "failed" ? (
            <>
              <MenuItem icon={RotateCcw} label={t("retry")} onClick={() => (setMenu(null), retry(mm))} />
              <MenuItem icon={Trash2} label={t("remove")} danger onClick={() => (setMenu(null), dropLocal(mm))} />
            </>
          ) : mm.deleted ? (
            // «Xabar o'chirildi» belgisi: faqat o'z ro'yxatimdan olib tashlash
            <MenuItem icon={Trash2} label={t("deleteMe")} onClick={() => (setMenu(null), void removeMsg(mm, "me"))} />
          ) : (
            <>
              {!composerLocked && (
                <>
                  <ReactionPicker
                    current={mm.reactions?.find((r) => r.mine)?.emoji ?? null}
                    onPick={(e) => {
                      setMenu(null);
                      void react(mm, e);
                    }}
                  />
                  <MenuDivider />
                  <MenuItem icon={CornerUpLeft} label={t("reply")} onClick={() => (setMenu(null), startReply(mm))} />
                </>
              )}
              {mm.body && !mm.call && <MenuItem icon={Copy} label={t("copy")} onClick={() => (setMenu(null), void copyText(mm))} />}
              {!mm.call && forwardTargets.length > 0 && <MenuItem icon={Forward} label={t("forward")} onClick={() => (setMenu(null), setForwardOf(mm))} />}
              {!composerLocked && <MenuItem icon={pinned?.id === mm.id ? PinOff : Pin} label={t(pinned?.id === mm.id ? "unpin" : "pin")} onClick={() => (setMenu(null), void togglePin(mm))} />}
              {canEdit(mm) && !composerLocked && <MenuItem icon={Pencil} label={t(mm.attachments.length ? "editCaption" : "edit")} hint={t("editHint")} onClick={() => (setMenu(null), startEdit(mm))} />}
              <MenuDivider />
              <MenuItem icon={Trash2} label={t("deleteMe")} onClick={() => (setMenu(null), void removeMsg(mm, "me"))} />
              {mm.mine && <MenuItem icon={Trash2} label={t("deleteAll")} danger onClick={() => (setMenu(null), void removeMsg(mm, "all"))} />}
              {!mm.mine && <MenuItem icon={Flag} label={t("report")} danger onClick={() => (setMenu(null), setReportFor({ type: "message", id: mm.id, key: Date.now() }))} />}
            </>
          ))}
      </Layer>

      {/* Yo'naltirish */}
      <ForwardDialog open={Boolean(forwardOf)} onClose={() => setForwardOf(null)} locale={locale} busy={forwardBusy} items={forwardTargets} onPick={(id) => void doForward(id)} />

      {/* Yo'qoladigan xabarlar muddati */}
      <Layer open={ttlDialog} onClose={() => setTtlDialog(false)} variant="dialog" label={t("ttlTitle")} width="max-w-[360px]">
        <DialogHead title={t("ttlTitle")} onClose={() => setTtlDialog(false)} locale={locale} />
        <p className="px-4 pb-2 pt-1 text-[12.5px] leading-relaxed text-fg-3">{t("ttlHint")}</p>
        <div className="px-1.5 pb-2" role="group" aria-label={t("ttlTitle")}>
          {TTL_CHOICES.map((c) => (
            <MenuItem
              key={c.sec}
              icon={Timer}
              label={t(c.short)}
              hint={ttl === c.sec ? "✓" : ""}
              active={ttl === c.sec}
              onClick={() => {
                setTtlDialog(false);
                if (ttl !== c.sec) void setTtlFor(c.sec);
              }}
            />
          ))}
        </div>
      </Layer>

      {/* Ma'lumot + media */}
      {peer && (
        <InfoDialog
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          convId={convId}
          peer={peer}
          presence={presence.label}
          prefs={prefs}
          locale={locale}
          onPrefs={changePrefs}
          onJump={(id) => (setInfoOpen(false), window.setTimeout(() => jump(id), 220))}
        />
      )}

      {/* Shikoyat (modal) — menyudan dasturiy ochiladi; trigger ko'rinmas, modal esa odatdagidek */}
      {reportFor && (
        <div ref={reportHostRef} key={reportFor.key} className="absolute left-0 top-0 h-0 w-0">
          <ReportButton targetType={reportFor.type} targetId={reportFor.id} loggedIn compact modal triggerClassName="pointer-events-none absolute h-px w-px opacity-0" />
        </div>
      )}
    </div>
  );
}
