"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowDown, ArrowLeft, Ban, BellOff, Check, CheckCheck, Copy, CornerUpLeft, Flag, Folder, FolderPlus, Forward, Info, Loader2, MessageCircle, Mic, MoreHorizontal, Paperclip, Pencil, Pin, PinOff, Plus, RotateCcw, Search, Send, ShieldCheck, Timer, Trash2, User, X, Zap } from "lucide-react";
import { ReportButton } from "@/components/specialists/ReportButton";
import { CallButton } from "@/components/call/CallButton";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { usePresence } from "@/components/motion/usePresence";
import { haptic } from "@/components/motion/haptics";
import { DM_BODY_MAX, DM_DELETED_TEXT, DM_EDIT_WINDOW_MS, DM_SEARCH_MIN, type ReactionSummary } from "@/lib/chat/constants";
import type { QuoteView } from "@/lib/chat/quote";
import { clock, dayKey, dayLabel, fullStamp, listStamp, relativeTime } from "@/lib/chat/time";
import { cn } from "@/lib/utils";
import { MAX_ATTACHMENTS, UPLOAD_ACCEPT_DOCS, uploadAttachment, withRetryAfter, type Attachment } from "./attachments";
import { CallBubble } from "@/components/call/CallBubble";
import type { CallInfo } from "@/lib/call/format";
import { AttachmentList, DayPill, LinkCard, Linkified, QuoteBlock, ReactionChips, ReactionPicker, ReplyBar, TypingDots, iconBtn, jumpToMessage, useNowTick } from "./MessageParts";
import { DialogHead, ForwardDialog, InfoDialog, Layer, MenuDivider, MenuItem, PeerAvatar, PrefItems, type ConvPrefsView } from "./DmPanels";
import { VoiceRecorder } from "./VoiceRecorder";
import { VideoNoteRecorder, videoNoteSupported } from "./VideoNoteRecorder";

/**
 * Ichki chat (DM) — kabinetdagi "Chat" bo'limi.
 * Chapda suhbatlar ro'yxati, o'ngda tanlangan suhbat; mobil ekranda bittasi ko'rinadi.
 * Yangilanish: ochiq suhbat 4 soniyada (faqat yangi xabarlar ?after bilan; yangilik bo'lmasa sekinlashadi, yashirin tabda to'xtaydi),
 * ro'yxat 20 soniyada. Qo'shimcha: tahrirlash/o'chirish, reaksiya, qadash, yo'naltirish, qidiruv, media, qoralama, drag&drop, paste.
 */

interface Peer {
  id?: string;
  username: string | null;
  name: string;
  avatarUrl: string | null;
  isBanned?: boolean;
  slug?: string | null;
  lastSeenAt?: number | null;
  lastActiveAt?: number | null;
}
interface ConvRow {
  id: string;
  peer: Peer & { id: string; role: string };
  last: { body: string; mine: boolean; at: number; hasFiles: boolean; voice?: boolean; deleted?: boolean } | null;
  unread: number;
  prefs: ConvPrefsView;
  peerTyping?: boolean;
}
/** Yo'qolish muddati variantlari va yorliqlari (lib/chat/dm.ts DM_TTL_OPTIONS bilan bir xil) */
const TTL_CHOICES: Array<{ sec: number; label: string }> = [
  { sec: 0, label: "O'chiq" },
  { sec: 3600, label: "1 soat" },
  { sec: 86_400, label: "1 kun" },
  { sec: 604_800, label: "1 hafta" },
];
const ttlLabel = (sec: number) => TTL_CHOICES.find((c) => c.sec === sec)?.label ?? "O'chiq";

interface Msg {
  id: string;
  mine: boolean;
  body: string;
  attachments: Attachment[];
  at: number;
  replyTo: QuoteView | null;
  editedAt?: number | null;
  deleted?: boolean;
  forwardedFrom?: string | null;
  /** Qo'ng'iroq yozuvi (oddiy xabar emas) */
  call?: CallInfo | null;
  reactions?: ReactionSummary[];
  /** Faqat klientda: optimistik yuborish holati */
  pending?: "sending" | "failed";
  /** Qayta yuborish uchun saqlanadi */
  replyToId?: string | null;
}

/* Lug'at (uz/ru) */
const T = {
  searchConvs: { uz: "Qidirish", ru: "Поиск" },
  noConvs: { uz: "Hali suhbat yo'q", ru: "Пока нет чатов" },
  noConvsHint: { uz: "Profil sahifasidagi «Yozish» orqali boshlang.", ru: "Начните через «Написать» в профиле." },
  browse: { uz: "Mutaxassislar", ru: "Специалисты" },
  notFound: { uz: "Topilmadi", ru: "Не найдено" },
  pickConv: { uz: "Suhbatni tanlang", ru: "Выберите чат" },
  firstMsg: { uz: "Birinchi xabarni yozing.", ru: "Напишите первое сообщение." },
  you: { uz: "Siz", ru: "Вы" },
  voice: { uz: "Ovozli xabar", ru: "Голосовое" },
  file: { uz: "Fayl", ru: "Файл" },
  typing: { uz: "yozmoqda…", ru: "печатает…" },
  online: { uz: "Onlayn", ru: "В сети" },
  lastSeen: { uz: "oxirgi faollik", ru: "был(а)" },
  write: { uz: "Xabar yozing…", ru: "Сообщение…" },
  replyPh: { uz: "Javob yozing…", ru: "Ответ…" },
  editPh: { uz: "Tahrirlash…", ru: "Редактирование…" },
  send: { uz: "Yuborish", ru: "Отправить" },
  edited: { uz: "tahrirlangan", ru: "изменено" },
  forwarded: { uz: "Yo'naltirilgan", ru: "Переслано" },
  newMessages: { uz: "Yangi xabarlar", ru: "Новые сообщения" },
  read: { uz: "O'qildi", ru: "Прочитано" },
  sent: { uz: "Yuborildi", ru: "Отправлено" },
  sending: { uz: "Yuborilmoqda…", ru: "Отправка…" },
  failed: { uz: "Yuborilmadi", ru: "Не отправлено" },
  retry: { uz: "Qayta", ru: "Повторить" },
  remove: { uz: "O'chirish", ru: "Удалить" },
  archived: { uz: "Arxiv", ru: "Архив" },
  back: { uz: "Orqaga", ru: "Назад" },
  reply: { uz: "Javob", ru: "Ответить" },
  copy: { uz: "Nusxalash", ru: "Копировать" },
  forward: { uz: "Yo'naltirish", ru: "Переслать" },
  edit: { uz: "Tahrirlash", ru: "Изменить" },
  pin: { uz: "Qadash", ru: "Закрепить" },
  unpin: { uz: "Yechish", ru: "Открепить" },
  deleteMe: { uz: "Men uchun o'chirish", ru: "Удалить у меня" },
  deleteAll: { uz: "Hamma uchun o'chirish", ru: "Удалить у всех" },
  report: { uz: "Shikoyat", ru: "Пожаловаться" },
  block: { uz: "Bloklash", ru: "Заблокировать" },
  unblock: { uz: "Blokdan chiqarish", ru: "Разблокировать" },
  blockQ: { uz: "Bloklaysizmi? U sizga yoza olmaydi.", ru: "Заблокировать? Он(а) не сможет вам писать." },
  yes: { uz: "Ha", ru: "Да" },
  cancel: { uz: "Bekor", ru: "Отмена" },
  blockedByMe: { uz: "Siz bloklagansiz — yozib bo'lmaydi.", ru: "Вы заблокировали — писать нельзя." },
  blockedMe: { uz: "Bu foydalanuvchiga yozib bo'lmaydi.", ru: "Этому пользователю нельзя писать." },
  banned: { uz: "Hisob bloklangan — yozib bo'lmaydi.", ru: "Аккаунт заблокирован — писать нельзя." },
  profile: { uz: "Profil", ru: "Профиль" },
  searchMsgs: { uz: "Xabarlarni qidirish", ru: "Поиск сообщений" },
  info: { uz: "Ma'lumot va media", ru: "Информация и медиа" },
  attach: { uz: "Fayl", ru: "Файл" },
  quick: { uz: "Tez javoblar", ru: "Быстрые ответы" },
  ctrlEnter: { uz: "Ctrl+Enter bilan yuborish", ru: "Отправлять по Ctrl+Enter" },
  copied: { uz: "Nusxalandi", ru: "Скопировано" },
  forwardedOk: { uz: "Yo'naltirildi", ru: "Переслано" },
  open: { uz: "Ochish", ru: "Открыть" },
  dropHere: { uz: "Faylni shu yerga tashlang", ru: "Перетащите файл сюда" },
  toLatest: { uz: "Pastga", ru: "Вниз" },
  closedDm: { uz: "Bu foydalanuvchi shaxsiy xabarlarni yopib qo'ygan", ru: "Пользователь закрыл личные сообщения" },
  searchPh: { uz: "Suhbatda qidirish…", ru: "Поиск в чате…" },
  noResults: { uz: "Hech narsa topilmadi", ru: "Ничего не найдено" },
  notLoaded: { uz: "Eski xabar — bu oynada yuklanmagan", ru: "Старое сообщение — не загружено" },
  uploading: { uz: "Yuklanmoqda", ru: "Загрузка" },
  menu: { uz: "Menyu", ru: "Меню" },
  msgMenu: { uz: "Xabar amallari", ru: "Действия" },
  more: { uz: "Yana", ru: "Ещё" },
  pinned: { uz: "Qadalgan", ru: "Закреплено" },
  muted: { uz: "Ovozsiz", ru: "Без звука" },
} as const;

/** Mutaxassis uchun tayyor javoblar (OrderChat bilan bir xil saqlash kaliti — bitta ro'yxat) */
const QUICK_KEY = "redince:quick-replies";
const DEFAULT_QUICK = ["Assalomu alaykum! Xabaringizni oldim, tez orada javob beraman.", "Narx va muddatni aniqlashtirsak: qachongacha kerak va qanday formatda?", "Ish jarayonda — oraliq natijani tez orada yuboraman.", "Rahmat! Hamkorlikdan xursandman."];
const CTRL_ENTER_KEY = "chat:ctrlEnter";
const draftKey = (id: string) => `chat:draft:${id}`;
const store = {
  get(k: string): string | null {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null) {
    try {
      if (v === null || v === "") window.localStorage.removeItem(k);
      else window.localStorage.setItem(k, v);
    } catch {
      /* saqlanmasa ham ishlaydi */
    }
  },
};

const ONLINE_MS = 3 * 60 * 1000;
const firstUrl = (t: string) => /https?:\/\/[^\s<>"'()]+/i.exec(t)?.[0]?.replace(/[.,;:!?…]+$/, "") ?? null;

/** Xabardan iqtibos (javob paneli uchun) — server bilan bir xil qoida */
function quoteOf(m: Msg, peerName: string, you: string): QuoteView {
  const a = m.attachments;
  const kind = a.some((x) => x.type.startsWith("audio/")) ? "voice" : a.some((x) => x.type.startsWith("video/")) ? "video" : a.some((x) => x.type.startsWith("image/")) ? "image" : a.length ? "file" : "text";
  const label = { voice: "Ovozli xabar", image: "Rasm", video: "Video", file: "Fayl", text: "" }[kind];
  const text = m.body.replace(/\s+/g, " ").trim();
  return { id: m.id, body: text ? (text.length > 140 ? `${text.slice(0, 139)}…` : text) : label, senderName: m.mine ? you : peerName, kind };
}

/** Javobdagi xatoni (429 bo'lsa Retry-After bilan) matnga aylantirish */
async function errorOf(res: Response, fallback: string): Promise<Error> {
  const json = await res.json().catch(() => null);
  const msg = (json?.fields && (Object.values(json.fields)[0] as string)) || json?.error || fallback;
  return new Error(res.status === 429 ? withRetryAfter(msg, res.headers.get("Retry-After")) : msg);
}

export function DmChat({ initialId, viewerRole, notice }: { initialId?: string | null; viewerRole?: string | null; notice?: string | null }) {
  const locale = useLocale();
  const t = useCallback(<K extends keyof typeof T>(k: K): string => T[k][locale], [locale]);
  const router = useRouter();
  const { toast } = useToast();
  const now = useNowTick(60_000);

  const [convs, setConvs] = useState<ConvRow[] | null>(null);
  const [active, setActive] = useState<string | null>(initialId ?? null);
  // Suhbat ochiq bo'lsa telefon qobig'i (yuqori panel + pastki tab) yashiriladi — chat to'liq ekran (globals.css)
  useEffect(() => {
    const el = document.documentElement;
    if (active) el.setAttribute("data-chat-open", "1");
    else el.removeAttribute("data-chat-open");
    return () => el.removeAttribute("data-chat-open");
  }, [active]);
  // Telefon (<lg): ochiq suhbat document.body'ga portal bilan chiziladi — sahifa o'tish animatsiyasi (transform) `fixed`ni qamab qo'ymasin
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const on = () => setIsPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploads, setUploads] = useState<Array<{ key: string; name: string; progress: number; ctl: AbortController }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [peerReadAt, setPeerReadAt] = useState(0);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  // Telegram odati: xabarni o'ngga surib javob berish (sensorli ekran). swipe — hozir surilayotgan xabar va masofa
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null);
  const swipeStart = useRef<{ id: string; x: number; y: number; locked: boolean | null } | null>(null);
  const SWIPE_REPLY = 56;
  const swipeHandlers = (m: Msg) =>
    m.deleted || m.pending
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
              st.locked = Math.abs(dx) > Math.abs(dy) && dx > 0; // faqat o'ngga gorizontal
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
              textRef.current?.focus();
            }
            setSwipe(null);
          },
          onTouchCancel: () => {
            swipeStart.current = null;
            setSwipe(null);
          },
        };
  const [editing, setEditing] = useState<Msg | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [blocked, setBlocked] = useState<{ byMe: boolean; me: boolean }>({ byMe: false, me: false });
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [prefs, setPrefs] = useState<ConvPrefsView>({ archived: false, muted: false, pinned: false, folderId: null });
  // Papkalar (Telegram naqshi) va o'z-o'zidan yo'qoladigan xabarlar
  const [folders, setFolders] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [folderMgr, setFolderMgr] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [ttl, setTtl] = useState(0);
  const [ttlMenu, setTtlMenu] = useState(false);
  const [pinned, setPinned] = useState<QuoteView | null>(null);
  const [dividerId, setDividerId] = useState<string | null>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const [newBelow, setNewBelow] = useState(0);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [plusMenu, setPlusMenu] = useState(false);
  const [msgMenu, setMsgMenu] = useState<{ id: string; mine: boolean; up?: boolean; side?: "left-0" | "right-0" } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ id: string; up: boolean } | null>(null);
  const [forwardOf, setForwardOf] = useState<Msg | null>(null);
  const [forwardBusy, setForwardBusy] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchRes, setSearchRes] = useState<Array<{ id: string; at: number; mine: boolean; snippet: string }> | null>(null);
  const [ctrlEnter, setCtrlEnter] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [quick, setQuick] = useState<string[]>([]);
  const [flying, setFlying] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [reportFor, setReportFor] = useState<{ type: "message" | "user"; id: string; key: number } | null>(null);
  const [animIds, setAnimIds] = useState<Set<string>>(() => new Set());

  const typingSentAt = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const reportHostRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const lastIdRef = useRef<string | null>(null);
  const syncRef = useRef(0);
  const inflightRef = useRef(false);
  /** Faol suhbat to'liq yuklandi — shundan keyingina incremental polling */
  const loadedRef = useRef(false);
  const dragDepth = useRef(0);
  const longPress = useRef<number | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const prevActiveRef = useRef<string | null>(null);

  /* ---------------- Sozlamalar (localStorage) ---------------- */
  useEffect(() => {
    setCtrlEnter(store.get(CTRL_ENTER_KEY) === "1");
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
    try {
      const raw = store.get(QUICK_KEY);
      const v: unknown = raw ? JSON.parse(raw) : [];
      setQuick(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 12) : []);
    } catch {
      setQuick([]);
    }
  }, []);
  useEffect(() => {
    if (notice === "yopiq") toast(t("closedDm"), "info");
    // faqat bir marta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice]);

  /* ---------------- Ro'yxat ---------------- */
  const loadList = useCallback(async () => {
    const res = await fetch("/api/chat").catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    if (json?.ok) {
      setConvs(json.data.items);
      setFolders(json.data.folders ?? []);
    }
  }, []);

  useEffect(() => {
    void loadList();
    const t2 = window.setInterval(() => {
      if (!document.hidden) void loadList();
    }, 20000);
    const onVis = () => {
      if (!document.hidden) void loadList();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(t2);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadList]);

  // PWA badge: o'qilmaganlar (ovozsiz suhbatlar hisobga olinmaydi)
  useEffect(() => {
    if (!convs) return;
    const total = convs.filter((c) => !c.prefs.muted).reduce((s, c) => s + c.unread, 0);
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (total > 0) void nav.setAppBadge?.(total).catch(() => undefined);
    else void nav.clearAppBadge?.().catch(() => undefined);
  }, [convs]);

  /* ---------------- Suhbat ---------------- */
  const applyRows = useCallback((items: Msg[], updates: Msg[], reactions: Record<string, ReactionSummary[]> | undefined, incremental: boolean) => {
    setMsgs((m) => {
      const base = incremental ? (m ?? []) : [];
      const seen = new Set(base.map((x) => x.id));
      const fresh = items.filter((x) => !seen.has(x.id));
      let next = [...base, ...fresh];
      if (incremental && fresh.length) setAnimIds((s) => new Set([...s, ...fresh.map((x) => x.id)]));
      if (updates.length) {
        const up = new Map(updates.map((u) => [u.id, u]));
        next = next.map((x) => up.get(x.id) ?? x);
      }
      if (reactions) next = next.map((x) => (x.pending ? x : { ...x, reactions: reactions[x.id] ?? [] }));
      return next;
    });
  }, []);

  /** Suhbatni (to'liq yoki faqat yangilarini) yuklash; qaytaradi: yangilik bo'ldimi */
  const loadThread = useCallback(
    async (id: string, incremental: boolean): Promise<boolean> => {
      if (inflightRef.current) return false;
      // Birinchi to'liq yuklash tugamaguncha polling boshlanmasin (dev StrictMode poygasi: hammasi «yangi» bo'lib animatsiya qilmasin)
      if (incremental && !loadedRef.current) return false;
      inflightRef.current = true;
      try {
        const params = new URLSearchParams();
        if (incremental && lastIdRef.current) params.set("after", lastIdRef.current);
        if (incremental && syncRef.current) params.set("sync", String(syncRef.current));
        // Oyna fokussiz bo'lsa «o'qildi» qilib qo'ymaymiz (yolg'on ✓✓ bo'lmasin)
        if (!document.hasFocus()) params.set("read", "0");
        const res = await fetch(`/api/chat/${id}${params.size ? `?${params}` : ""}`).catch(() => null);
        const json = res ? await res.json().catch(() => null) : null;
        if (!json?.ok || activeRef.current !== id) return false;
        const d = json.data;
        setPeer(d.peer);
        setPeerReadAt(d.peerReadAt ?? 0);
        setPeerTyping(Boolean(d.peerTyping));
        setPinned(d.pinned ?? null);
        if (d.blocked) setBlocked(d.blocked);
        if (d.prefs) setPrefs(d.prefs);
        if (typeof d.ttlSeconds === "number") setTtl(d.ttlSeconds);
        const items: Msg[] = d.items;
        const updates: Msg[] = d.updates ?? [];
        if (items.length > 0) lastIdRef.current = items[items.length - 1].id;
        if (!incremental && items.length === 0) lastIdRef.current = null;
        syncRef.current = d.now ?? Date.now();
        if (!incremental) {
          const readAt: number = d.readAt ?? 0;
          const first = items.find((x) => !x.mine && x.at > readAt);
          setDividerId(first && readAt > 0 ? first.id : null);
          loadedRef.current = true;
        }
        applyRows(items, updates, d.reactions, incremental);
        if (incremental && items.some((x) => !x.mine) && !nearBottomRef.current) setNewBelow((n) => n + items.filter((x) => !x.mine).length);
        if (document.hasFocus()) setConvs((c) => c?.map((r) => (r.id === id ? { ...r, unread: 0 } : r)) ?? c);
        return items.length > 0;
      } finally {
        inflightRef.current = false;
      }
    },
    [applyRows],
  );

  // Suhbat almashganda: holatni tozalash, qoralamani tiklash, polling (ko'rinish + sekinlashish bilan)
  useEffect(() => {
    if (!active) return;
    lastIdRef.current = null;
    loadedRef.current = false;
    syncRef.current = 0;
    prevCountRef.current = 0;
    nearBottomRef.current = true;
    setNearBottom(true);
    setNewBelow(0);
    setMsgs(null);
    setPeer(null);
    setPeerReadAt(0);
    setReplyTo(null);
    setEditing(null);
    setPeerTyping(false);
    setBlocked({ byMe: false, me: false });
    setBlockConfirm(false);
    setPinned(null);
    setDividerId(null);
    setSearchOpen(false);
    setSearchQ("");
    setSearchRes(null);
    setAnimIds(new Set());
    setMsgMenu(null);
    setHeaderMenu(false);
    setError(null);
    setText(store.get(draftKey(active)) ?? "");
    setFiles([]);

    let timer: number | null = null;
    let idle = 0;
    let stopped = false;
    const delay = () => (idle < 12 ? 4000 : idle < 60 ? 8000 : 15000);
    const schedule = () => {
      if (stopped) return;
      timer = window.setTimeout(tick, delay());
    };
    const tick = async () => {
      if (stopped) return;
      if (document.hidden) return; // yashirin tab: to'xtaydi, ko'ringanda davom etadi
      const got = await loadThread(active, true);
      idle = got ? 0 : idle + 1;
      schedule();
    };
    const onVis = () => {
      if (document.hidden) return;
      if (timer) window.clearTimeout(timer);
      idle = 0;
      void tick();
    };
    void loadThread(active, false).then(schedule);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [active, loadThread]);

  // Ochilgan suhbatda o'qilmagan bo'lsa — yon panel badge'ini yangilash (server komponent)
  useEffect(() => {
    if (!active || !convs) return;
    const row = convs.find((c) => c.id === active);
    if (row && row.unread > 0) {
      const id = window.setTimeout(() => router.refresh(), 1200);
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Qoralama: matn o'zgarganda (300 ms) saqlanadi
  useEffect(() => {
    if (!active || editing) return;
    const id = window.setTimeout(() => store.set(draftKey(active), text.trim() ? text : null), 300);
    return () => window.clearTimeout(id);
  }, [text, active, editing]);

  // Fokus: suhbat ochilganda kompozitorga (desktop) yoki «orqaga» tugmasiga (telefon); yopilganda ro'yxat elementiga
  useEffect(() => {
    if (active && msgs) {
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      window.setTimeout(() => desktop && textRef.current?.focus({ preventScroll: true }), 50);
      prevActiveRef.current = active;
    } else if (!active && prevActiveRef.current) {
      const btn = listRef.current?.querySelector<HTMLButtonElement>(`[data-conv="${prevActiveRef.current}"]`);
      window.setTimeout(() => btn?.focus({ preventScroll: true }), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, msgs === null]);

  // Avtomatik pastga tushish: birinchi ochilishda (yangi xabarlar chizig'i bo'lsa — unga); keyin faqat pastda bo'lsa yoki o'z xabarim
  useEffect(() => {
    if (!msgs) return;
    const el = scrollRef.current;
    const initial = prevCountRef.current === 0 && msgs.length > 0;
    const added = msgs.length > prevCountRef.current;
    prevCountRef.current = msgs.length;
    if (!el || (!initial && !added)) return;
    const last = msgs[msgs.length - 1];
    if (initial && dividerId) {
      const d = document.getElementById(`divider-${dividerId}`);
      if (d) {
        el.scrollTop = Math.max(0, d.offsetTop - 80);
        return;
      }
    }
    if (initial || nearBottomRef.current || Boolean(last?.mine)) el.scrollTop = el.scrollHeight;
  }, [msgs, dividerId]);

  // Textarea autosize
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };
  useEffect(() => {
    autoGrow(textRef.current);
  }, [text, active]);

  /* ---------------- Fayllar ---------------- */
  const addFiles = useCallback(
    async (list: File[]) => {
      if (!list.length) return;
      setError(null);
      for (const f of list) {
        const key = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const ctl = new AbortController();
        // Chegara: tanlangan + yuklanayotganlar birga sanaladi (poyga bo'lmasin)
        let room = true;
        setUploads((u) => {
          if (files.length + u.length >= MAX_ATTACHMENTS) {
            room = false;
            return u;
          }
          return [...u, { key, name: f.name, progress: 0, ctl }];
        });
        if (!room) {
          setError(`Ko'pi bilan ${MAX_ATTACHMENTS} ta fayl`);
          break;
        }
        try {
          const a = await uploadAttachment(f, { docs: true, signal: ctl.signal, onProgress: (p) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x))) });
          setFiles((cur) => (cur.length < MAX_ATTACHMENTS && !cur.some((x) => x.url === a.url) ? [...cur, a] : cur));
        } catch (e) {
          if (!(e instanceof Error && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Fayl yuklanmadi");
        } finally {
          setUploads((u) => u.filter((x) => x.key !== key));
        }
      }
      if (fileRef.current) fileRef.current.value = "";
    },
    [files.length],
  );

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []).filter((i) => i.kind === "file" && i.type.startsWith("image/"));
    if (!items.length) return;
    e.preventDefault();
    void addFiles(items.map((i) => i.getAsFile()).filter((f): f is File => Boolean(f)));
  };
  const onDragEnter = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
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
    if (blocked.byMe || blocked.me || peer?.isBanned) return;
    void addFiles(Array.from(e.dataTransfer?.files ?? []).slice(0, MAX_ATTACHMENTS));
  };

  /* ---------------- Yuborish ---------------- */
  const commitSent = (tempId: string | null, saved: Msg) => {
    setMsgs((m) => {
      const base = (m ?? []).filter((x) => x.id !== tempId && x.id !== saved.id);
      return [...base, saved];
    });
    lastIdRef.current = saved.id;
    setAnimIds((s) => new Set([...s, saved.id]));
  };

  /** Optimistik yuborish: avval «yuborilmoqda», muvaffaqiyatda almashadi, xatoda «yuborilmadi» + qayta yuborish */
  const deliver = async (body: string, attachments: Attachment[], replyToId: string | null, retryId?: string) => {
    if (!active) return;
    const conv = active;
    const tempId = retryId ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const temp: Msg = { id: tempId, mine: true, body, attachments, at: Date.now(), replyTo: replyTo && replyTo.id === replyToId && peer ? quoteOf(replyTo, peer.name, t("you")) : null, replyToId, pending: "sending" };
    nearBottomRef.current = true;
    setMsgs((m) => [...(m ?? []).filter((x) => x.id !== tempId), temp]);
    setFlying(true);
    window.setTimeout(() => setFlying(false), 420);
    try {
      const res = await fetch(`/api/chat/${conv}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, attachments, replyToId }) });
      if (!res.ok) throw await errorOf(res, t("failed"));
      const json = await res.json();
      if (activeRef.current !== conv) return;
      commitSent(tempId, json.data);
      void loadList();
    } catch (err) {
      if (activeRef.current !== conv) return;
      setMsgs((m) => (m ?? []).map((x) => (x.id === tempId ? { ...x, pending: "failed" as const } : x)));
      setError(err instanceof Error ? err.message : t("failed"));
    }
  };

  const saveEdit = async (m: Msg, body: string) => {
    if (!active) return;
    const res = await fetch(`/api/chat/${active}/messages/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
    if (!res.ok) throw await errorOf(res, "Tahrirlanmadi");
    const json = await res.json();
    setMsgs((cur) => (cur ?? []).map((x) => (x.id === m.id ? { ...x, ...json.data } : x)));
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!active || uploads.length > 0) return;
    if (editing) {
      if (!body && editing.attachments.length === 0) return;
      setError(null);
      try {
        await saveEdit(editing, body);
        setEditing(null);
        setText("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Tahrirlanmadi");
      }
      return;
    }
    if (!body && files.length === 0) return;
    if (body.length > DM_BODY_MAX) return setError(`Xabar ${DM_BODY_MAX} belgidan oshmasin`);
    const atts = files;
    const rid = replyTo?.id ?? null;
    setText("");
    setFiles([]);
    setReplyTo(null);
    setError(null);
    store.set(draftKey(active), null);
    window.requestAnimationFrame(() => autoGrow(textRef.current));
    void deliver(body, atts, rid);
  };

  const sendVoice = async (a: Attachment) => {
    setError(null);
    await deliver("", [a], replyTo?.id ?? null);
    setReplyTo(null);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      if (editing) (setEditing(null), setText(store.get(draftKey(active ?? "")) ?? ""));
      else if (replyTo) setReplyTo(null);
      return;
    }
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    const mod = e.ctrlKey || e.metaKey;
    // Sensorli ekran yoki Ctrl+Enter rejimi: Enter — yangi qator; aks holda Enter yuboradi (Shift+Enter — yangi qator)
    if (ctrlEnter || coarse) {
      if (mod) (e.preventDefault(), void send());
      return;
    }
    if (!e.shiftKey) (e.preventDefault(), void send());
  };

  /* ---------------- Amallar ---------------- */
  const setBlock = async (next: boolean) => {
    if (!peer?.id || blockBusy) return;
    setBlockBusy(true);
    try {
      const res = await fetch(`/api/blocks/${encodeURIComponent(peer.id)}`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) throw await errorOf(res, "Bo'lmadi");
      setBlocked((b) => ({ ...b, byMe: next }));
      setBlockConfirm(false);
      setReplyTo(null);
      toast(next ? `${peer.name} — ${t("block").toLowerCase()}` : `${peer.name} — ${t("unblock").toLowerCase()}`, next ? "info" : "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    } finally {
      setBlockBusy(false);
    }
  };

  /** Yo'qolish muddatini o'zgartirish (ikki tomon uchun umumiy) */
  const setTtlFor = async (convId: string, seconds: number) => {
    const prev = ttl;
    setTtl(seconds);
    const res = await fetch(`/api/chat/${convId}/ttl`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seconds }) }).catch(() => null);
    if (!res?.ok) {
      setTtl(prev);
      toast("Saqlanmadi", "error");
      return;
    }
    toast(seconds ? `Xabarlar ${ttlLabel(seconds).toLowerCase()}dan keyin o'chadi` : "Yo'qolish o'chirildi", "success");
  };

  /** Yangi papka */
  const addFolder = async () => {
    const name = newFolder.trim();
    if (!name) return;
    const res = await fetch("/api/chat/papkalar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    if (!res?.ok || !json?.data) {
      toast(json?.error ?? "Yaratilmadi", "error");
      return;
    }
    setFolders((l) => [...l, { id: json.data.id, name: json.data.name, count: 0 }]);
    setNewFolder("");
  };

  /** Papkani o'chirish (suhbatlar «Hammasi»ga qaytadi) */
  const removeFolder = async (id: string) => {
    setFolders((l) => l.filter((f) => f.id !== id));
    if (folder === id) setFolder(null);
    const res = await fetch(`/api/chat/papkalar/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      toast("O'chirilmadi", "error");
      void loadList();
      return;
    }
    setConvs((c) => c?.map((r) => (r.prefs.folderId === id ? { ...r, prefs: { ...r.prefs, folderId: null } } : r)) ?? c);
    if (prefs.folderId === id) setPrefs((p) => ({ ...p, folderId: null }));
  };

  const updatePrefs = async (convId: string, patch: Partial<ConvPrefsView>) => {
    setConvs((c) => c?.map((r) => (r.id === convId ? { ...r, prefs: { ...r.prefs, ...patch } } : r)) ?? c);
    if (convId === active) setPrefs((p) => ({ ...p, ...patch }));
    const res = await fetch(`/api/chat/${convId}/prefs`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => null);
    if (!res?.ok) toast("Saqlanmadi", "error");
    void loadList();
  };

  const react = async (m: Msg, emoji: string) => {
    if (!active || m.pending || m.deleted) return;
    const cur = m.reactions?.find((r) => r.mine)?.emoji ?? null;
    const next = cur === emoji ? null : emoji;
    // Optimistik yangilash
    setMsgs((cur2) =>
      (cur2 ?? []).map((x) => {
        if (x.id !== m.id) return x;
        const list = (x.reactions ?? []).map((r) => ({ ...r })).filter((r) => !(r.mine && (r.count -= 1) <= 0)).map((r) => (r.mine ? { ...r, mine: false } : r));
        if (next) {
          const hit = list.find((r) => r.emoji === next);
          if (hit) (hit.count += 1), (hit.mine = true);
          else list.push({ emoji: next, count: 1, mine: true });
        }
        return { ...x, reactions: list };
      }),
    );
    const res = await fetch(`/api/chat/${active}/messages/${m.id}/reaction`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji: next }) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    if (json?.ok) setMsgs((cur2) => (cur2 ?? []).map((x) => (x.id === m.id ? { ...x, reactions: json.data.reactions } : x)));
    else toast(json?.error ?? "Bo'lmadi", "error");
  };

  const removeMsg = async (m: Msg, scope: "me" | "all") => {
    if (!active) return;
    if (m.pending) return setMsgs((cur) => (cur ?? []).filter((x) => x.id !== m.id));
    const res = await fetch(`/api/chat/${active}/messages/${m.id}?scope=${scope}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return toast(res ? (await errorOf(res, "O'chirilmadi")).message : "O'chirilmadi", "error");
    setMsgs((cur) => (scope === "me" ? (cur ?? []).filter((x) => x.id !== m.id) : (cur ?? []).map((x) => (x.id === m.id ? { ...x, deleted: true, body: "", attachments: [], reactions: [] } : x))));
    if (pinned?.id === m.id) setPinned(null);
    void loadList();
  };

  const togglePin = async (m: Msg | null) => {
    if (!active) return;
    const messageId = m && pinned?.id !== m.id ? m.id : null;
    const res = await fetch(`/api/chat/${active}/pin`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId }) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    if (json?.ok) setPinned(json.data.pinned);
    else toast(json?.error ?? "Bo'lmadi", "error");
  };

  const doForward = async (toId: string) => {
    if (!active || !forwardOf || forwardBusy) return;
    setForwardBusy(true);
    try {
      const res = await fetch(`/api/chat/${active}/forward`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: forwardOf.id, to: toId }) });
      if (!res.ok) throw await errorOf(res, "Yo'naltirilmadi");
      setForwardOf(null);
      toast(t("forwardedOk"), "success");
      void loadList();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Yo'naltirilmadi", "error");
    } finally {
      setForwardBusy(false);
    }
  };

  const copyText = async (m: Msg) => {
    try {
      await navigator.clipboard.writeText(m.body);
      toast(t("copied"), "success");
    } catch {
      toast("Nusxalanmadi", "error");
    }
  };

  const startEdit = (m: Msg) => {
    setReplyTo(null);
    setEditing(m);
    setText(m.body);
    window.setTimeout(() => textRef.current?.focus(), 30);
  };

  // Shikoyat: menyu yopilgach ReportButton (modal) dasturiy ravishda ochiladi
  useEffect(() => {
    if (!reportFor) return;
    const id = window.setTimeout(() => reportHostRef.current?.querySelector("button")?.click(), 30);
    return () => window.clearTimeout(id);
  }, [reportFor]);

  // Suhbat ichida qidiruv (300 ms kechikish)
  useEffect(() => {
    if (!searchOpen || !active) return;
    const qq = searchQ.trim();
    if (qq.length < DM_SEARCH_MIN) return setSearchRes(null);
    const id = window.setTimeout(async () => {
      const res = await fetch(`/api/chat/${active}/search?q=${encodeURIComponent(qq)}`).catch(() => null);
      const json = res ? await res.json().catch(() => null) : null;
      if (json?.ok) setSearchRes(json.data.items);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchQ, searchOpen, active]);

  const jump = (id: string) => {
    if (document.getElementById(`msg-${id}`)) jumpToMessage(id);
    else toast(t("notLoaded"), "info");
  };

  /** "Yozmoqda…" signali — 2.5 soniyada bir martadan ko'p emas; yuborilganda server o'zi o'chiradi */
  const pingTyping = (v: string) => {
    if (!active || !v.trim() || editing) return;
    const n = Date.now();
    if (n - typingSentAt.current < 2500) return;
    typingSentAt.current = n;
    void fetch(`/api/chat/${active}/typing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typing: true }) }).catch(() => undefined);
  };

  /* ---------------- Klaviatura: suhbatlar orasida (Alt+↑/↓), Esc ---------------- */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (convs ?? []).filter(
      (c) =>
        c.prefs.archived === showArchived &&
        (!folder || c.prefs.folderId === folder) &&
        (!needle || c.peer.name.toLowerCase().includes(needle) || (c.peer.username ?? "").includes(needle) || (c.last?.body ?? "").toLowerCase().includes(needle)),
    );
  }, [convs, q, showArchived, folder]);
  const archivedCount = useMemo(() => (convs ?? []).filter((c) => c.prefs.archived).length, [convs]);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp") && filtered.length) {
        e.preventDefault();
        const i = filtered.findIndex((c) => c.id === active);
        const n = e.key === "ArrowDown" ? Math.min(filtered.length - 1, i + 1) : Math.max(0, i - 1);
        setActive(filtered[n].id);
      } else if (e.key === "Escape" && !headerMenu && !msgMenu && !plusMenu && !forwardOf && !infoOpen && !rowMenu) {
        if (searchOpen) setSearchOpen(false);
        else if (active && !window.matchMedia("(min-width: 1024px)").matches && document.activeElement?.tagName !== "TEXTAREA") setActive(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [filtered, active, headerMenu, msgMenu, plusMenu, forwardOf, infoOpen, rowMenu, searchOpen]);

  /* ---------------- Yordamchilar ---------------- */
  const presenceOf = (p: Peer): { online: boolean; label: string } => {
    if (p.lastSeenAt && now - p.lastSeenAt < ONLINE_MS) return { online: true, label: t("online") };
    const seen = p.lastActiveAt ?? p.lastSeenAt;
    if (seen) return { online: false, label: `${t("lastSeen")} ${relativeTime(seen, locale, now)}` };
    return { online: false, label: "" };
  };
  const lastPreview = (c: ConvRow): string => {
    if (c.peerTyping) return t("typing");
    if (!c.last) return "";
    const who = c.last.mine ? `${t("you")}: ` : "";
    if (c.last.deleted) return `${who}${DM_DELETED_TEXT[locale]}`;
    return `${who}${c.last.body || (c.last.voice ? t("voice") : c.last.hasFiles ? t("file") : "")}`;
  };
  const composerLocked = blocked.byMe || blocked.me || Boolean(peer?.isBanned);
  const myReaction = (m: Msg) => m.reactions?.find((r) => r.mine)?.emoji ?? null;
  const replyPresence = usePresence(Boolean(replyTo || editing), 160);
  const typingPresence = usePresence(peerTyping && Boolean(peer), 160);
  const jumpPresence = usePresence(!nearBottom && (msgs?.length ?? 0) > 0, 160);
  const pinPresence = usePresence(Boolean(pinned), 160);
  const searchPresence = usePresence(searchOpen, 160);
  const blockPresence = usePresence(blockConfirm && Boolean(peer?.id) && !blocked.byMe, 160);
  const dragPresence = usePresence(dragOver, 160);

  /** Menyu yo'nalishi: element scroll konteynerining pastki yarmida bo'lsa — yuqoriga ochiladi (kesilmasin) */
  const menuUp = (el: HTMLElement, container: HTMLElement | null) => {
    const r = el.getBoundingClientRect();
    const c = container?.getBoundingClientRect();
    return c ? r.top - c.top > c.height / 2 : false;
  };

  /**
   * Menyu gorizontal tomoni: «⋯» tugmasi x koordinatasidan o'ngga 258px (menyu kengligi) sig'sa — o'ngga (left-0), aks holda chapga (right-0).
   * Ildiz karta `overflow-hidden` — sig'maydigan tomonga ochilgan menyu va reaksiya qatori kesilib ko'rinmay qolardi.
   */
  const menuSide = (btnX: number, container: HTMLElement | null): "left-0" | "right-0" => {
    const c = container?.getBoundingClientRect();
    return c && c.right - btnX < 258 ? "right-0" : "left-0";
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    nearBottomRef.current = near;
    setNearBottom(near);
    if (near) setNewBelow(0);
  };
  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setNewBelow(0);
  };

  // Bubble'ni bosib turish (sensorli) → menyu; sichqonchada o'ng tugma ham
  const pressStart = (m: Msg) => (e: ReactPointerEvent) => {
    if (e.pointerType !== "touch" || m.pending || m.deleted) return;
    const up = menuUp(e.currentTarget as HTMLElement, scrollRef.current);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const side = menuSide(m.mine ? r.left - 32 : r.right + 4, scrollRef.current);
    longPress.current = window.setTimeout(() => setMsgMenu({ id: m.id, mine: m.mine, up, side }), 450);
  };
  const pressEnd = () => {
    if (longPress.current) window.clearTimeout(longPress.current);
    longPress.current = null;
  };

  /* ---------------- Ro'yxat paneli ---------------- */
  const listPanel = (
    <div ref={listRef} className={cn("card-elevated flex min-h-0 flex-col overflow-hidden max-lg:!rounded-none max-lg:!border-0 max-lg:!bg-transparent max-lg:!shadow-none", active && "hidden lg:flex")}>
      <div className="flex items-center gap-2 border-b border-line p-2.5 max-lg:border-0 max-lg:px-0 max-lg:pt-0">
        <label className="relative block min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-4 max-lg:left-3.5 max-lg:size-4" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchConvs")} className="field h-9 w-full rounded-full pl-8 text-[13px] max-lg:h-11 max-lg:pl-10 max-lg:text-[15px]" aria-label={t("searchConvs")} />
        </label>
        {archivedCount > 0 && (
          <button type="button" onClick={() => setShowArchived((v) => !v)} aria-pressed={showArchived} className={cn("h-9 shrink-0 rounded-full border px-3 text-[12px] font-semibold transition", showArchived ? "border-fg bg-fg text-ink-fg" : "border-line text-fg-2 hover:border-fg hover:text-fg")}>
            {t("archived")} {archivedCount}
          </button>
        )}
        <button type="button" onClick={() => setFolderMgr(true)} aria-label="Papkalar" title="Papkalar" className={cn(iconBtn, "h-9 w-9 shrink-0")}>
          <Folder size={16} />
        </button>
      </div>
      {/* Papka tanlovi (telefonda gorizontal aylanadi) */}
      {folders.length > 0 && (
        <nav aria-label="Papkalar" className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-line px-2.5 pb-2 max-lg:border-0 max-lg:px-0">
          <button type="button" onClick={() => setFolder(null)} aria-pressed={!folder} className={cn("h-8 shrink-0 rounded-full border px-3 text-[12px] font-semibold transition", !folder ? "border-fg bg-fg text-ink-fg" : "border-line text-fg-2 hover:border-fg hover:text-fg")}>
            Hammasi
          </button>
          {folders.map((f) => (
            <button key={f.id} type="button" onClick={() => setFolder(folder === f.id ? null : f.id)} aria-pressed={folder === f.id} className={cn("h-8 shrink-0 rounded-full border px-3 text-[12px] font-semibold transition", folder === f.id ? "border-fg bg-fg text-ink-fg" : "border-line text-fg-2 hover:border-fg hover:text-fg")}>
              {f.name}
              {f.count > 0 && <span className="ml-1 opacity-60">{f.count}</span>}
            </button>
          ))}
        </nav>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!convs ? (
          <ul className="stagger divide-y divide-line" aria-busy="true" aria-label="Yuklanmoqda">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="animate-fade-in flex items-center gap-3 px-3 py-2.5">
                <span className="h-10 w-10 shrink-0 rounded-full skeleton" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3 w-1/2 skeleton" />
                  <span className="block h-2.5 w-3/4 skeleton" />
                </span>
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2.5 px-6 py-12 text-center">
            <span className="icon-tile-soft !rounded-full">
              <MessageCircle size={20} />
            </span>
            <p className="font-display text-[15px] font-semibold text-fg">{q || showArchived ? t("notFound") : t("noConvs")}</p>
            {!q && !showArchived && (
              <p className="text-[13px] leading-relaxed text-fg-3">
                {t("noConvsHint")}{" "}
                <Link href="/mutaxassislar" className="font-semibold text-fg underline underline-offset-2">
                  {t("browse")}
                </Link>
              </p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-line max-lg:divide-y-0">
            {filtered.map((c) => (
              <li key={c.id} className="group/row relative">
                <button
                  type="button"
                  data-conv={c.id}
                  onClick={() => setActive(c.id)}
                  aria-current={active === c.id ? "true" : undefined}
                  className={cn(
                    "press flex w-full items-center gap-3 border-l-2 px-3 py-2.5 pr-10 text-left transition hover:bg-fg/4 focus-visible:bg-fg/4 focus-visible:outline-none max-lg:gap-3.5 max-lg:rounded-[var(--r-md)] max-lg:border-l-0 max-lg:px-2 max-lg:py-3",
                    active === c.id ? "border-fg bg-surface-2" : "border-transparent",
                  )}
                >
                  <span className="relative shrink-0">
                    <PeerAvatar name={c.peer.name} avatarUrl={c.peer.avatarUrl} size={isPhone ? 52 : 40} />
                    {presenceOf(c.peer).online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-bg bg-success" aria-label={t("online")} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("flex min-w-0 items-center gap-1 truncate text-[13.5px] text-fg max-lg:text-[16px]", c.unread > 0 ? "font-bold" : "font-semibold")}>
                        <span className="truncate">{c.peer.name}</span>
                        {c.prefs.muted && <BellOff size={11} className="shrink-0 text-fg-4" aria-label={t("muted")} />}
                        {c.prefs.pinned && <Pin size={11} className="shrink-0 text-fg-4" aria-label={t("pin")} />}
                      </span>
                      {c.last && <time className={cn("shrink-0 text-[11px] max-lg:text-[12px]", c.unread > 0 && !c.prefs.muted ? "font-semibold text-accent" : "text-fg-4")} dateTime={new Date(c.last.at).toISOString()}>{listStamp(c.last.at, locale, now)}</time>}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={cn("flex min-w-0 items-center gap-1 truncate text-[12.5px] max-lg:text-[14.5px]", c.peerTyping ? "text-fg-2 italic" : c.unread > 0 ? "font-semibold text-fg" : "text-fg-3")}>
                        {c.last?.voice && !c.peerTyping && <Mic size={11} className="shrink-0" aria-hidden="true" />}
                        {c.last?.hasFiles && !c.last.voice && !c.peerTyping && <Paperclip size={11} className="shrink-0" aria-hidden="true" />}
                        <span className="truncate">{lastPreview(c)}</span>
                      </span>
                      {c.unread > 0 && (
                        <span className={cn("flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-bold", c.prefs.muted ? "bg-fg/15 text-fg" : "bg-accent text-white")} aria-label={`${c.unread} yangi`}>
                          {c.unread > 99 ? "99+" : c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <button
                    type="button"
                    onClick={(e) => setRowMenu(rowMenu?.id === c.id ? null : { id: c.id, up: menuUp(e.currentTarget, listRef.current) })}
                    aria-haspopup="menu"
                    aria-expanded={rowMenu?.id === c.id}
                    aria-label={`${c.peer.name} — ${t("menu")}`}
                    className={cn(iconBtn, "h-8 w-8 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-60", rowMenu?.id === c.id && "opacity-100")}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                  <Layer open={rowMenu?.id === c.id} onClose={() => setRowMenu(null)} label={`${c.peer.name} — ${t("menu")}`} anchorClass={rowMenu?.up ? "right-0 bottom-full mb-0.5" : "right-0 top-full mt-0.5"}>
                    <PrefItems
                      prefs={c.prefs}
                      locale={locale}
                      onChange={(p) => {
                        setRowMenu(null);
                        void updatePrefs(c.id, p);
                      }}
                    />
                  </Layer>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  /* ---------------- Xabar menyusi ---------------- */
  const menuMsg = msgMenu ? (msgs ?? []).find((m) => m.id === msgMenu.id) ?? null : null;
  const canEdit = (m: Msg) => m.mine && !m.deleted && !m.pending && !m.call && now - m.at < DM_EDIT_WINDOW_MS && m.attachments.length === 0;
  const messageMenu = menuMsg && (
    <Layer open={Boolean(msgMenu)} onClose={() => setMsgMenu(null)} label={t("msgMenu")} anchorClass={cn(msgMenu?.up ? "bottom-full mb-1" : "top-full mt-1", msgMenu?.side ?? (menuMsg.mine ? "left-0" : "right-0"))} width="w-[250px]">
      {!menuMsg.deleted && !menuMsg.pending && (
        <>
          <ReactionPicker
            current={myReaction(menuMsg)}
            onPick={(e) => {
              setMsgMenu(null);
              void react(menuMsg, e);
            }}
          />
          <MenuDivider />
        </>
      )}
      {!menuMsg.deleted && !menuMsg.pending && <MenuItem icon={CornerUpLeft} label={t("reply")} onClick={() => (setMsgMenu(null), setEditing(null), setReplyTo(menuMsg), textRef.current?.focus())} />}
      {menuMsg.body && !menuMsg.deleted && <MenuItem icon={Copy} label={t("copy")} onClick={() => (setMsgMenu(null), void copyText(menuMsg))} />}
      {!menuMsg.deleted && !menuMsg.pending && (convs?.length ?? 0) > 1 && <MenuItem icon={Forward} label={t("forward")} onClick={() => (setMsgMenu(null), setForwardOf(menuMsg))} />}
      {!menuMsg.deleted && !menuMsg.pending && <MenuItem icon={pinned?.id === menuMsg.id ? PinOff : Pin} label={pinned?.id === menuMsg.id ? t("unpin") : t("pin")} onClick={() => (setMsgMenu(null), void togglePin(menuMsg))} />}
      {canEdit(menuMsg) && <MenuItem icon={Pencil} label={t("edit")} hint="3 soat" onClick={() => (setMsgMenu(null), startEdit(menuMsg))} />}
      {(menuMsg.mine || !menuMsg.deleted || menuMsg.pending) && <MenuDivider />}
      <MenuItem icon={Trash2} label={t("deleteMe")} onClick={() => (setMsgMenu(null), void removeMsg(menuMsg, "me"))} />
      {menuMsg.mine && !menuMsg.deleted && !menuMsg.pending && <MenuItem icon={Trash2} label={t("deleteAll")} danger onClick={() => (setMsgMenu(null), void removeMsg(menuMsg, "all"))} />}
      {!menuMsg.mine && !menuMsg.deleted && <MenuItem icon={Flag} label={t("report")} danger onClick={() => (setMsgMenu(null), setReportFor({ type: "message", id: menuMsg.id, key: Date.now() }))} />}
    </Layer>
  );

  /* ---------------- Suhbat paneli ---------------- */
  const thread = (
    <div className={cn("card-elevated relative flex min-h-0 flex-col overflow-hidden max-lg:rounded-none max-lg:border-0 max-lg:shadow-none", !active && "hidden lg:flex")} onDragEnter={onDragEnter} onDragOver={(e) => e.preventDefault()} onDragLeave={onDragLeave} onDrop={onDrop}>
      {!active ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-6 text-center">
          <span className="icon-tile-soft !rounded-full">
            <MessageCircle size={20} />
          </span>
          <p className="font-display text-[15px] font-semibold text-fg">{t("pickConv")}</p>
        </div>
      ) : (
        <>
          {/* Sarlavha */}
          <div className="relative flex items-center gap-2 border-b border-line px-2.5 py-2">
            <button ref={backRef} type="button" onClick={() => setActive(null)} aria-label={t("back")} className={cn(iconBtn, "lg:hidden")}>
              <ArrowLeft size={17} />
            </button>
            {peer ? (
              (() => {
                const pr = presenceOf(peer);
                const inner = (
                  <>
                    <span className="relative shrink-0">
                      <PeerAvatar name={peer.name} avatarUrl={peer.avatarUrl} size={36} />
                      {pr.online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-success" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold leading-tight text-fg">{peer.name}</span>
                      <span className={cn("block truncate text-[12px]", peerTyping ? "italic text-fg-2" : pr.online ? "font-medium text-success-text" : "text-fg-3")}>{peerTyping ? t("typing") : pr.label}</span>
                    </span>
                  </>
                );
                return peer.slug ? (
                  <Link href={`/mutaxassislar/${peer.slug}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full transition hover:opacity-80" title={t("profile")}>
                    {inner}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">{inner}</div>
                );
              })()
            ) : (
              <div className="flex flex-1 items-center gap-2.5" aria-busy="true">
                <span className="h-9 w-9 rounded-full skeleton" />
                <span className="h-4 w-32 skeleton" />
              </div>
            )}
            {active && peer && <CallButton kind="dm" id={active} title={peer.name} />}
            <button type="button" onClick={() => setSearchOpen((v) => !v)} aria-pressed={searchOpen} aria-label={t("searchMsgs")} title={t("searchMsgs")} className={cn(iconBtn, "hidden sm:flex", searchOpen && "bg-fg/6 text-fg")}>
              <Search size={16} />
            </button>
            <button type="button" onClick={() => setHeaderMenu((v) => !v)} aria-haspopup="menu" aria-expanded={headerMenu} aria-label={t("menu")} className={cn(iconBtn, headerMenu && "bg-fg/6 text-fg")}>
              <MoreHorizontal size={17} />
            </button>
            <Layer open={headerMenu} onClose={() => setHeaderMenu(false)} label={t("menu")} anchorClass="right-2 top-full mt-0.5" width="w-[250px]">
              {peer?.slug && <MenuItem icon={User} label={t("profile")} onClick={() => (setHeaderMenu(false), router.push(`/mutaxassislar/${peer.slug}`))} />}
              <MenuItem icon={Search} label={t("searchMsgs")} onClick={() => (setHeaderMenu(false), setSearchOpen(true))} />
              <MenuItem icon={Info} label={t("info")} onClick={() => (setHeaderMenu(false), setInfoOpen(true))} />
              <MenuDivider />
              <PrefItems prefs={prefs} locale={locale} onChange={(p) => (setHeaderMenu(false), active && void updatePrefs(active, p))} />
              <MenuItem icon={Timer} label={ttl ? `Yo'qoladi: ${ttlLabel(ttl)}` : "Yo'qoladigan xabarlar"} onClick={() => (setHeaderMenu(false), setTtlMenu(true))} active={ttl > 0} />
              {folders.length > 0 && active && (
                <>
                  <MenuDivider />
                  <MenuItem icon={FolderPlus} label={prefs.folderId ? `Papka: ${folders.find((f) => f.id === prefs.folderId)?.name ?? "—"}` : "Papkaga qo'shish"} onClick={() => (setHeaderMenu(false), setFolderMgr(true))} active={Boolean(prefs.folderId)} />
                </>
              )}
              {peer?.id && (
                <>
                  <MenuDivider />
                  <MenuItem icon={Flag} label={t("report")} onClick={() => (setHeaderMenu(false), setReportFor({ type: "user", id: peer.id!, key: Date.now() }))} />
                  <MenuItem icon={blocked.byMe ? ShieldCheck : Ban} label={blocked.byMe ? t("unblock") : t("block")} danger={!blocked.byMe} disabled={blockBusy} onClick={() => (setHeaderMenu(false), blocked.byMe ? void setBlock(false) : setBlockConfirm(true))} />
                </>
              )}
            </Layer>
          </div>

          {/* Qidiruv paneli */}
          {searchPresence.mounted && (
            <div className={cn(searchPresence.closing ? "expand-out" : "expand-in", "border-b border-line bg-surface-2 p-2")}>
              <label className="relative block">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-4" aria-hidden="true" />
                <input autoFocus value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)} placeholder={t("searchPh")} aria-label={t("searchPh")} className="field h-9 w-full rounded-full pl-8 pr-9 text-[13px]" />
                <button type="button" onClick={() => setSearchOpen(false)} aria-label={t("cancel")} className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-fg-4 hover:bg-fg/8 hover:text-fg">
                  <X size={13} />
                </button>
              </label>
              {searchRes && (
                <ul className="mt-1.5 max-h-44 overflow-y-auto" aria-live="polite">
                  {searchRes.length === 0 && <li className="px-2 py-2 text-[12.5px] text-fg-3">{t("noResults")}</li>}
                  {searchRes.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => jump(r.id)} className="flex w-full items-baseline gap-2 rounded-[8px] px-2 py-1.5 text-left transition hover:bg-fg/6">
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">
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
          {pinPresence.mounted && pinned && (
            <div className={cn(pinPresence.closing ? "expand-out" : "expand-in", "flex items-center gap-2 border-b border-line bg-surface-2 py-1.5 pl-3 pr-1")}>
              <Pin size={13} className="shrink-0 text-fg-3" aria-hidden="true" />
              <button type="button" onClick={() => jump(pinned.id)} className="min-w-0 flex-1 text-left">
                <span className="block text-[11px] font-semibold text-fg-3">{t("pinned")}</span>
                <span className="block truncate text-[12.5px] text-fg">{pinned.body || "…"}</span>
              </button>
              <button type="button" onClick={() => void togglePin(null)} aria-label={t("unpin")} className={cn(iconBtn, "h-8 w-8")}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Blok tasdig'i */}
          {blockPresence.mounted && peer && (
            <div className={cn(blockPresence.closing ? "expand-out" : "expand-in", "flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-3 py-2 text-[12.5px]")} role="group" aria-label={t("block")}>
              <span className="min-w-0 flex-1 text-fg-2">
                <b className="text-fg">{peer.name}</b> — {t("blockQ")}
              </span>
              <button type="button" onClick={() => void setBlock(true)} disabled={blockBusy} className="h-8 rounded-full bg-danger-strong px-3 text-[12px] font-semibold text-white disabled:opacity-50">
                {t("yes")}
              </button>
              <button type="button" onClick={() => setBlockConfirm(false)} className="h-8 rounded-full px-3 text-[12px] font-semibold text-fg-3 hover:text-fg">
                {t("cancel")}
              </button>
            </div>
          )}

          {/* Xabarlar */}
          <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3" role="log" aria-live="polite" aria-relevant="additions" aria-busy={msgs === null} aria-label={peer ? `${peer.name}` : undefined}>
            {!msgs ? (
              <div className="space-y-2.5" aria-hidden="true">
                <span className="block h-10 w-2/3 rounded-[14px] skeleton" />
                <span className="ml-auto block h-10 w-1/2 rounded-[14px] skeleton" />
                <span className="block h-10 w-1/2 rounded-[14px] skeleton" />
              </div>
            ) : msgs.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-fg-3">{t("firstMsg")}</p>
            ) : (
              msgs.map((m, i) => {
                const newDay = i === 0 || dayKey(m.at) !== dayKey(msgs[i - 1].at);
                const sameSender = i > 0 && msgs[i - 1].mine === m.mine && !newDay;
                const url = !m.deleted && m.body ? firstUrl(m.body) : null;
                const open = msgMenu?.id === m.id;
                return (
                  <div key={m.id} className={cn(animIds.has(m.id) && "animate-msg-in", sameSender ? "mt-1" : "mt-2.5")}>
                    {newDay && <DayPill label={dayLabel(m.at, locale, now)} />}
                    {dividerId === m.id && (
                      <div id={`divider-${m.id}`} className="my-2 flex items-center gap-2" role="separator" aria-label={t("newMessages")}>
                        <span className="h-px flex-1 bg-accent/40" />
                        <span className="text-[11px] font-semibold text-accent-text">{t("newMessages")}</span>
                        <span className="h-px flex-1 bg-accent/40" />
                      </div>
                    )}
                    <div
                      {...swipeHandlers(m)}
                      style={swipe?.id === m.id ? { transform: `translateX(${swipe.dx}px)`, transition: "none" } : undefined}
                      className={cn("group relative flex items-end gap-1 transition-transform duration-200", m.mine ? "justify-end" : "justify-start")}
                    >
                      {swipe?.id === m.id && (
                        <span aria-hidden className="pointer-events-none absolute top-1/2 -left-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-fg/10 text-fg" style={{ opacity: Math.min(1, swipe.dx / SWIPE_REPLY), transform: `translateY(-50%) scale(${swipe.dx >= SWIPE_REPLY ? 1 : 0.8})` }}>
                          <CornerUpLeft size={15} />
                        </span>
                      )}
                      {!m.deleted && (
                        <div className={cn("relative self-center", m.mine ? "order-first" : "order-last")}>
                          <button
                            type="button"
                            onClick={(e) => setMsgMenu(open ? null : { id: m.id, mine: m.mine, up: menuUp(e.currentTarget, scrollRef.current), side: menuSide(e.currentTarget.getBoundingClientRect().left, scrollRef.current) })}
                            aria-haspopup="menu"
                            aria-expanded={open}
                            aria-label={t("msgMenu")}
                            className={cn(iconBtn, "h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:hidden", open && "opacity-100")}
                          >
                            <MoreHorizontal size={15} />
                          </button>
                          {open && messageMenu}
                        </div>
                      )}
                      <div className={cn("flex min-w-0 max-w-[82%] flex-col", m.mine ? "items-end" : "items-start")}>
                      <div
                        id={`msg-${m.id}`}
                        onContextMenu={(e) => {
                          if (m.deleted || m.pending) return;
                          e.preventDefault();
                          const r = e.currentTarget.getBoundingClientRect();
                          setMsgMenu({ id: m.id, mine: m.mine, up: menuUp(e.currentTarget, scrollRef.current), side: menuSide(m.mine ? r.left - 32 : r.right + 4, scrollRef.current) });
                        }}
                        onPointerDown={pressStart(m)}
                        onPointerUp={pressEnd}
                        onPointerCancel={pressEnd}
                        onPointerMove={pressEnd}
                        className={cn(
                          "min-w-0 max-w-full select-text rounded-[14px] px-3 py-2 transition-[box-shadow,transform] active:scale-[0.995]",
                          m.mine ? "bubble-mine rounded-br-[4px] bg-ink text-ink-fg" : "rounded-bl-[4px] bg-surface-2 text-fg",
                          m.pending === "failed" && "ring-1 ring-danger",
                          m.deleted && "opacity-70",
                        )}
                      >
                        {m.forwardedFrom && !m.deleted && (
                          <p className={cn("mb-0.5 flex items-center gap-1 text-[11px] font-semibold", m.mine ? "text-ink-fg/70" : "text-fg-3")}>
                            <Forward size={11} aria-hidden="true" /> {t("forwarded")}: {m.forwardedFrom}
                          </p>
                        )}
                        {m.replyTo && !m.deleted && <QuoteBlock q={m.replyTo} mine={m.mine} />}
                        <AttachmentList attachments={m.attachments} mine={m.mine} />
                        {m.call && !m.deleted ? (
                          <CallBubble call={m.call} mine={m.mine} conversationId={active ?? ""} peerName={peer?.name ?? ""} />
                        ) : m.deleted ? (
                          <p className={cn("text-[13.5px] italic", m.mine ? "text-ink-fg/70" : "text-fg-3")}>{DM_DELETED_TEXT[locale]}</p>
                        ) : (
                          m.body && (
                            <p className="whitespace-pre-wrap text-[14px] leading-relaxed [overflow-wrap:anywhere]">
                              <Linkified text={m.body} mine={m.mine} />
                            </p>
                          )
                        )}
                        {url && <LinkCard url={url} mine={m.mine} />}
                        <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[11px]", m.mine ? "text-ink-fg/55" : "text-fg-4")}>
                          {m.editedAt && !m.deleted && <span title={fullStamp(m.editedAt, locale, now)}>{t("edited")} {clock(m.editedAt)} ·</span>}
                          <time dateTime={new Date(m.at).toISOString()} title={fullStamp(m.at, locale, now)}>
                            {clock(m.at)}
                          </time>
                          {m.mine &&
                            (m.pending === "sending" ? (
                              <Loader2 size={12} className="animate-spin-slow shrink-0 [animation-duration:1s]" aria-label={t("sending")} />
                            ) : m.pending === "failed" ? (
                              <span className="flex items-center gap-1.5 text-danger">
                                <AlertCircle size={12} aria-hidden="true" />
                                <button type="button" onClick={() => void deliver(m.body, m.attachments, m.replyToId ?? null, m.id)} className="inline-flex items-center gap-0.5 font-semibold underline underline-offset-2">
                                  <RotateCcw size={10} /> {t("retry")}
                                </button>
                                <button type="button" onClick={() => void removeMsg(m, "me")} className="font-semibold underline underline-offset-2">
                                  {t("remove")}
                                </button>
                              </span>
                            ) : peerReadAt >= m.at ? (
                              <span title={`${t("read")} · ${fullStamp(peerReadAt, locale, now)}`} className="inline-flex">
                                <CheckCheck size={13} className="shrink-0 text-accent" aria-label={`${t("read")} ${clock(peerReadAt)}`} />
                              </span>
                            ) : (
                              <Check size={13} className="shrink-0" aria-label={t("sent")} />
                            ))}
                        </p>
                      </div>
                      {!m.deleted && <ReactionChips reactions={m.reactions ?? []} mine={m.mine} onToggle={(e) => void react(m, e)} />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {typingPresence.mounted && peer && (
              <div className="pt-1.5">
                <TypingDots label={`${peer.name} ${t("typing")}`} closing={typingPresence.closing} />
              </div>
            )}
          </div>

          {/* «Pastga» tugmasi */}
          {jumpPresence.mounted && (
            <button
              type="button"
              onClick={scrollToBottom}
              aria-label={newBelow > 0 ? `${t("toLatest")} — ${newBelow}` : t("toLatest")}
              className={cn(jumpPresence.closing ? "pop-out" : "pop-in", "card-floating absolute bottom-[76px] right-3 z-[2] flex h-10 min-w-10 items-center justify-center gap-1.5 !rounded-full px-2.5 text-fg")}
            >
              <ArrowDown size={16} />
              {newBelow > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold leading-[18px] text-white">{newBelow}</span>}
            </button>
          )}

          {/* Drag&drop overlay */}
          {dragPresence.mounted && (
            <div className={cn(dragPresence.closing ? "overlay-out" : "overlay-in", "pointer-events-none absolute inset-0 z-[3] flex items-center justify-center bg-surface/85")} aria-hidden="true">
              <p className="flex items-center gap-2 rounded-full border border-dashed border-fg px-4 py-2 text-[13.5px] font-semibold text-fg">
                <Paperclip size={15} /> {t("dropHere")}
              </p>
            </div>
          )}

          {/* Kompozitor */}
          {composerLocked ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-3.5 py-3 text-[13px] text-fg-2" role="status">
              <Ban size={14} className="text-fg-3" />
              <span className="min-w-0 flex-1">{peer?.isBanned ? t("banned") : blocked.byMe ? t("blockedByMe") : t("blockedMe")}</span>
              {blocked.byMe && (
                <button type="button" onClick={() => void setBlock(false)} disabled={blockBusy} className="h-9 rounded-full border border-line px-3.5 text-[12.5px] font-semibold text-fg transition hover:border-fg disabled:opacity-50">
                  {t("unblock")}
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={send} className="border-t border-line p-2.5">
              {replyPresence.mounted &&
                (editing ? (
                  <div className={cn(replyPresence.closing ? "expand-out" : "expand-in", "mb-2 flex items-center gap-2 rounded-[12px] border-l-[3px] border-fg bg-surface-2 py-1.5 pl-3 pr-1")} role="status">
                    <Pencil size={14} className="shrink-0 text-fg-3" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11.5px] font-bold text-fg">{t("edit")}</span>
                      <span className="block truncate text-[12.5px] text-fg-2">{editing.body}</span>
                    </span>
                    <button type="button" onClick={() => (setEditing(null), setText(store.get(draftKey(active)) ?? ""))} aria-label={t("cancel")} className={cn(iconBtn, "h-8 w-8")}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  replyTo && peer && <ReplyBar q={quoteOf(replyTo, peer.name, t("you"))} onCancel={() => setReplyTo(null)} closing={replyPresence.closing} />
                ))}
              {(files.length > 0 || uploads.length > 0) && (
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {files.map((f, i) => (
                    <li key={f.url} className="expand-in flex items-center gap-1.5 rounded-full border border-line py-1 pl-2.5 pr-1 text-[12px] font-medium text-fg-2">
                      <span className="max-w-[140px] truncate">{f.name}</span>
                      <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} aria-label={`${f.name} — ${t("remove")}`} className="flex h-6 w-6 items-center justify-center rounded-full text-fg-4 transition hover:bg-fg/10 hover:text-fg">
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                  {uploads.map((u) => (
                    <li key={u.key} className="expand-in relative flex items-center gap-1.5 overflow-hidden rounded-full border border-line py-1 pl-2.5 pr-1 text-[12px] font-medium text-fg-2" aria-live="polite">
                      <span className="absolute inset-y-0 left-0 bg-fg/8 transition-[width]" style={{ width: `${Math.round(u.progress * 100)}%` }} aria-hidden="true" />
                      <span className="relative max-w-[120px] truncate">{u.name}</span>
                      <span className="relative tabular-nums text-fg-4">{Math.round(u.progress * 100)}%</span>
                      <button type="button" onClick={() => u.ctl.abort()} aria-label={`${u.name} — ${t("cancel")}`} className="relative flex h-6 w-6 items-center justify-center rounded-full text-fg-4 transition hover:bg-fg/10 hover:text-fg">
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {error && (
                <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-danger-text" role="alert">
                  <AlertCircle size={13} /> {error}
                </p>
              )}
              <div className="flex items-end gap-1.5">
                <input ref={fileRef} type="file" accept={UPLOAD_ACCEPT_DOCS} multiple className="hidden" onChange={(e) => void addFiles(Array.from(e.target.files ?? []))} tabIndex={-1} />
                {!recording && (
                  <div className="relative">
                    <button type="button" onClick={() => setPlusMenu((v) => !v)} aria-haspopup="menu" aria-expanded={plusMenu} aria-label={t("more")} className={cn(iconBtn, "border border-line", plusMenu && "bg-fg/6 text-fg")}>
                      <Plus size={18} className={cn("transition-transform", plusMenu && "rotate-45")} />
                    </button>
                    <Layer open={plusMenu} onClose={() => setPlusMenu(false)} label={t("more")} anchorClass="bottom-full left-0 mb-1" width="w-[260px]">
                      <MenuItem icon={Paperclip} label={t("attach")} hint="≤ 5" disabled={files.length + uploads.length >= MAX_ATTACHMENTS} onClick={() => (setPlusMenu(false), fileRef.current?.click())} />
                      {viewerRole === "specialist" && (
                        <>
                          <MenuDivider />
                          <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-4">{t("quick")}</p>
                          <div className="max-h-48 overflow-y-auto">
                            {[...DEFAULT_QUICK, ...quick].map((s) => (
                              <MenuItem
                                key={s}
                                icon={Zap}
                                label={s}
                                onClick={() => {
                                  setPlusMenu(false);
                                  setText((cur) => (cur.trim() ? `${cur.trimEnd()}\n${s}` : s));
                                  textRef.current?.focus();
                                }}
                              />
                            ))}
                          </div>
                        </>
                      )}
                      <MenuDivider />
                      <MenuItem
                        label={t("ctrlEnter")}
                        hint={ctrlEnter ? "✓" : ""}
                        active={ctrlEnter}
                        onClick={() => {
                          setCtrlEnter((v) => {
                            store.set(CTRL_ENTER_KEY, v ? null : "1");
                            return !v;
                          });
                        }}
                      />
                    </Layer>
                  </div>
                )}
                {!recording && (
                  <textarea
                    ref={textRef}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      pingTyping(e.target.value);
                    }}
                    onKeyDown={onKey}
                    onPaste={onPaste}
                    rows={1}
                    maxLength={DM_BODY_MAX}
                    placeholder={editing ? t("editPh") : replyTo ? t("replyPh") : t("write")}
                    aria-label={t("write")}
                    className="field max-h-[140px] min-h-10 flex-1 resize-none rounded-[20px] !py-2.5 text-[14px] leading-snug transition-[height]"
                    style={{ height: 40 }}
                  />
                )}
                {text.trim() || files.length > 0 || editing ? (
                  <button type="submit" disabled={uploads.length > 0} aria-label={editing ? t("edit") : t("send")} className="btn-accent flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full disabled:opacity-40">
                    {editing ? <Check size={17} /> : <Send size={17} className={cn("transition-all duration-300 ease-out", flying && "-translate-y-6 translate-x-6 opacity-0")} />}
                  </button>
                ) : (
                  <>
                    {videoNoteSupported() && <VideoNoteRecorder onRecorded={sendVoice} onError={setError} onPhase={setRecording} />}
                    <VoiceRecorder size="md" onRecorded={sendVoice} onError={setError} onPhase={setRecording} />
                  </>
                )}
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );

  const root = (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 lg:h-[calc(100dvh-130px)] lg:grid-cols-[300px_minmax(0,1fr)]",
        // Telefon: suhbat ochiq — to'liq ekran (yuqori/pastki panel yashirin, yozish maydoni pastda); ro'yxat — tab'lar orasida butun balandlik
        active
          ? "max-lg:fixed max-lg:inset-0 max-lg:z-[60] max-lg:h-dvh max-lg:gap-0 max-lg:bg-bg max-lg:pb-[env(safe-area-inset-bottom)] max-lg:pt-[env(safe-area-inset-top)]"
          : "max-lg:h-[calc(100dvh-8.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-lg:min-h-[320px]",
      )}
    >
      {listPanel}
      {thread}
      {/* Yo'naltirish dialogi */}
      <ForwardDialog
        open={Boolean(forwardOf)}
        onClose={() => setForwardOf(null)}
        locale={locale}
        busy={forwardBusy}
        items={(convs ?? []).filter((c) => c.id !== active && !c.peer.isBanned).map((c) => ({ id: c.id, name: c.peer.name, username: c.peer.username, avatarUrl: c.peer.avatarUrl }))}
        onPick={(id) => void doForward(id)}
      />
      {/* Yo'qoladigan xabarlar muddati */}
      {ttlMenu && active && (
        <Layer open onClose={() => setTtlMenu(false)} variant="dialog" label="Yo'qoladigan xabarlar" width="w-[320px]">
          <DialogHead title="Yo'qoladigan xabarlar" onClose={() => setTtlMenu(false)} />
          <p className="px-3 pb-2 text-[12.5px] text-fg-3">Shundan keyin yuborilgan xabarlar belgilangan vaqtdan so&apos;ng ikki tomonda ham o&apos;chadi. Avvalgi xabarlarga ta&apos;sir qilmaydi.</p>
          <div className="pb-2">
            {TTL_CHOICES.map((c) => (
              <MenuItem
                key={c.sec}
                icon={Timer}
                label={c.label}
                active={ttl === c.sec}
                onClick={() => {
                  setTtlMenu(false);
                  void setTtlFor(active, c.sec);
                }}
              />
            ))}
          </div>
        </Layer>
      )}
      {/* Papkalar: yaratish, tanlash, o'chirish */}
      {folderMgr && (
        <Layer open onClose={() => setFolderMgr(false)} variant="dialog" label="Papkalar" width="w-[340px]">
          <DialogHead title="Papkalar" onClose={() => setFolderMgr(false)} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void addFolder();
            }}
            className="flex gap-2 px-3 pb-2"
          >
            <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} maxLength={24} placeholder="Yangi papka nomi" aria-label="Papka nomi" className="field h-9 min-w-0 flex-1 text-[13px]" />
            <button type="submit" disabled={!newFolder.trim()} className="btn-accent h-9 shrink-0 px-3 text-[12.5px] disabled:opacity-50">
              Qo&apos;shish
            </button>
          </form>
          {folders.length === 0 ? (
            <p className="px-3 pb-3 text-[12.5px] text-fg-3">Hali papka yo&apos;q. Papka yaratib, suhbatlarni ajratib qo&apos;yishingiz mumkin.</p>
          ) : (
            <ul className="max-h-[40vh] overflow-y-auto pb-2">
              {folders.map((f) => (
                <li key={f.id} className="flex items-center gap-1 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (active) void updatePrefs(active, { folderId: prefs.folderId === f.id ? null : f.id });
                      setFolderMgr(false);
                    }}
                    disabled={!active}
                    className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-[10px] px-2 py-2 text-left text-[13.5px] transition hover:bg-fg/5 disabled:opacity-50", prefs.folderId === f.id && "bg-fg/5 font-semibold")}
                  >
                    <Folder size={15} className="shrink-0 text-fg-3" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="shrink-0 text-[12px] text-fg-4">{f.count}</span>
                  </button>
                  <button type="button" onClick={() => void removeFolder(f.id)} aria-label={`${f.name} — o'chirish`} className={cn(iconBtn, "h-8 w-8 hover:text-danger-text")}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!active && folders.length > 0 && <p className="px-3 pb-3 text-[12px] text-fg-4">Suhbatni papkaga joylash uchun avval suhbatni oching.</p>}
        </Layer>
      )}
      {/* Ma'lumot + media */}
      {active && peer && (
        <InfoDialog
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          convId={active}
          peer={peer}
          presence={presenceOf(peer).label}
          prefs={prefs}
          locale={locale}
          onPrefs={(p) => void updatePrefs(active, p)}
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
  return active && isPhone ? createPortal(root, document.body) : root;
}
