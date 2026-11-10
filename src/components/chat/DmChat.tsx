"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, ArrowDown, ArrowLeft, ArrowUp, Bell, BellOff, Check, CheckCheck, CircleDot, Compass, Folder, FolderPlus, Image as ImageIcon, Loader2, LogOut, Megaphone, MessageCircle, MessagesSquare, Mic, Paperclip, Pencil, Pin, PinOff, RotateCcw, Search, ShieldCheck, ShoppingBag, SquarePen, Timer, Trash2, User, UserX, Users, Video, X, type LucideIcon } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useVisualViewport } from "@/components/motion/useVisualViewport";
import { VerifiedBadge } from "@/components/ui";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toast";
import { DM_DELETED_TEXT } from "@/lib/chat/constants";
import { listStamp } from "@/lib/chat/time";
import { chatT, type ChatKey } from "@/lib/i18n/dict/chat";
import { cn } from "@/lib/utils";
import { ChatRow, type RowSwipeAction } from "./ChatRow";
import { readDraft, readMarks, writeDraft, writeMarks } from "./chat-store";
import type { AttachKind, ChatType, ConvRow, FolderRow, GroupRow, OrderRow, Peer } from "./chat-types";
import { DialogHead, GroupAvatar, Layer, MenuDivider, MenuItem, PeerAvatar, PrefItems, type ConvPick, type ConvPrefsView, type LayerAnchor } from "./DmPanels";
import { DmThread } from "./DmThread";
import { iconBtn, useNowTick } from "./MessageParts";
import { NewChatDialog } from "./NewChatDialog";
import { publishChatUnread, refreshChatUnread } from "./unread-store";
import { useChatRoute } from "./useChatRoute";
import { useChatStream } from "./useChatStream";

/**
 * «Chat» bo'limi (kabinet): chapda yagona ro'yxat — shaxsiy suhbatlar, men a'zo guruh/kanallar va o'qilmagan xabari bor
 * buyurtma chatlari; o'ngda ochiq chat (telefonda — to'liq ekran). Ochiq chat MANZILDA (`?s=` / `?guruh=`, useChatRoute):
 * brauzer «Orqaga» tugmasi ro'yxatga qaytaradi, sahifa yangilanganda o'sha chat ochiladi.
 *
 * Bo'laklar: shaxsiy suhbat — `DmThread` (+`DmBubble`, `DmComposer`), guruh/kanal — `GroupPanelBody`, qator — `ChatRow`.
 * Yangilanish: bitta SSE ulanishi (`dm` → ochiq suhbat va ro'yxat, `inbox` → ro'yxat) + zaxira polling.
 * «Chat» nishoni (yon panel, pastki tab, sarlavha) shu ro'yxatdan `publishChatUnread` orqali darhol yangilanadi.
 */

/** Guruh/kanal paneli — faqat ochilganda yuklanadi */
const GroupPanelBody = dynamic(() => import("@/components/chat/GroupPanelBody").then((m) => m.GroupPanelBody), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center text-fg-3">
      <Loader2 size={20} className="animate-spin" />
    </div>
  ),
});

const ONLINE_MS = 3 * 60 * 1000;
const LIST_LIMIT = 60;
const NOTICE_KEY: Record<string, ChatKey> = { yopiq: "closedDm", topilmadi: "userNotFound", blok: "userBlocked", ozim: "selfChat" };
const KIND_ICON: Record<AttachKind, LucideIcon | null> = { text: null, voice: Mic, image: ImageIcon, video: Video, file: Paperclip };

type MergedRow = { kind: "dm"; at: number; pinned: boolean; dm: ConvRow } | { kind: "grp"; at: number; pinned: boolean; grp: GroupRow } | { kind: "ord"; at: number; pinned: boolean; ord: OrderRow };
type RowMenu = { kind: "dm" | "grp"; id: string; anchor: LayerAnchor };

/**
 * Chat kartasi balandligi — ko'rish maydonida QOLGAN joy (QA B1). Ilgari `100dvh - 130px` deb qat'iy yozilgan edi:
 * sahifa tepasida qo'shimcha blok («Obuna faol emas» banneri, xabar paneli) bo'lsa karta ekrandan chiqib, yozish maydoni
 * pastda kesilar va sahifa aylanardi. Endi kartaning haqiqiy joylashuvi o'lchanadi: tepasi + ota elementlarning pastki
 * bo'shliqlari ayiriladi. Server / birinchi chizishda CSS zaxira qiymati ishlaydi.
 */
function useAvailableHeight(ref: RefObject<HTMLElement | null>, enabled: boolean): number | null {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) {
      setH(null);
      return;
    }
    const calc = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      let below = 0;
      for (let p: HTMLElement | null = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const cs = window.getComputedStyle(p);
        below += (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.marginBottom) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
      }
      const next = Math.max(360, Math.floor(window.innerHeight - top - below));
      setH((cur) => (cur === next ? cur : next));
    };
    calc();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(calc);
    ro?.observe(document.body);
    window.addEventListener("resize", calc);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", calc);
    };
  }, [ref, enabled]);
  return h;
}

export function DmChat({ viewerId, viewerRole }: { viewerId: string; viewerRole?: string | null }) {
  const locale = useLocale();
  const t = useCallback((k: ChatKey, v?: Record<string, string | number>) => chatT(locale, k, v), [locale]);
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();
  const now = useNowTick(60_000);
  const route = useChatRoute();
  const sp = useSearchParams();
  const active = route.conv;
  const groupSlug = route.group;
  const open = Boolean(active || groupSlug);

  const [convs, setConvs] = useState<ConvRow[] | null>(null);
  const [groupRows, setGroupRows] = useState<GroupRow[]>([]);
  const [orderRows, setOrderRows] = useState<OrderRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [listErr, setListErr] = useState(false);
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [folder, setFolder] = useState<string | null>(null);
  const [chatType, setChatType] = useState<ChatType>("all");
  const [rowMenu, setRowMenu] = useState<RowMenu | null>(null);
  const [folderMgr, setFolderMgr] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [newChat, setNewChat] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [marks, setMarks] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  // Telefon (<lg): ochiq chat document.body'ga portal bilan chiziladi — sahifa kirish animatsiyasi (transform) `fixed`ni qamab qo'ymasin
  const [isPhone, setIsPhone] = useState(false);
  const [ready, setReady] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const prevActive = useRef<string | null>(null);
  const listBusy = useRef(false);
  const listAgain = useRef(false);
  const signedOut = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const on = () => setIsPhone(mq.matches);
    on();
    setReady(true);
    setMarks(readMarks());
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Chat ochiq bo'lsa telefon qobig'i (yuqori panel + pastki tab) yashiriladi — chat to'liq ekran (globals.css)
  useEffect(() => {
    const el = document.documentElement;
    if (open) el.setAttribute("data-chat-open", "1");
    else el.removeAttribute("data-chat-open");
    return () => el.removeAttribute("data-chat-open");
  }, [open]);

  const fullscreen = ready && isPhone && open;
  // Klaviatura ochiq bo'lsa to'liq ekranli chat balandligi — ko'rinadigan maydon (iOS Safari)
  const vv = useVisualViewport(fullscreen);
  const avail = useAvailableHeight(rootRef, ready);

  /* ---------------- /yozish xabarlari (?xato=) ---------------- */
  const xato = sp.get("xato");
  useEffect(() => {
    if (!xato) return;
    setNotice(xato);
    // Manzildan olib tashlanadi — sahifa yangilanganda xabar qayta chiqmasin
    const u = new URL(window.location.href);
    u.searchParams.delete("xato");
    const st = window.history.state as { chatOpen?: boolean } | null;
    window.history.replaceState({ chatOpen: Boolean(st?.chatOpen) }, "", `${u.pathname}${u.search}`);
  }, [xato]);
  const noticeText = notice && NOTICE_KEY[notice] ? t(NOTICE_KEY[notice]) : null;

  /* ---------------- Ro'yxat ---------------- */
  const loadListRef = useRef<() => Promise<void>>(async () => undefined);
  const loadList = useCallback(async () => {
    if (signedOut.current) return;
    if (listBusy.current) {
      // So'rov ketayotganda kelgan hodisa yo'qolmasin — tugagach yana bir marta
      listAgain.current = true;
      return;
    }
    listBusy.current = true;
    try {
      const res = await fetch("/api/chat", { cache: "no-store" }).catch(() => null);
      if (res?.status === 401) {
        signedOut.current = true;
        return;
      }
      const json = res ? ((await res.json().catch(() => null)) as { ok?: boolean; data?: { items: ConvRow[]; folders?: FolderRow[]; groups?: GroupRow[]; orders?: OrderRow[] } } | null) : null;
      if (json?.ok && json.data) {
        setConvs(json.data.items);
        setFolders(json.data.folders ?? []);
        setGroupRows(json.data.groups ?? []);
        setOrderRows(json.data.orders ?? []);
        setListErr(false);
      } else setListErr(true);
    } finally {
      listBusy.current = false;
      if (listAgain.current) {
        listAgain.current = false;
        void loadListRef.current();
      }
    }
  }, []);
  loadListRef.current = loadList;

  // Real-time (SSE): `dm` — suhbatda o'zgarish (ochiq bo'lsa darhol so'raladi) va ro'yxat; `inbox` — faqat ro'yxat
  const streamConnected = useChatStream({
    conv: active,
    onDm: (conv) => {
      if (conv === activeRef.current) setPulse((n) => n + 1);
      void loadList();
    },
    onInbox: () => void loadList(),
  });
  const streamRef = useRef(false);
  streamRef.current = streamConnected;

  useEffect(() => {
    void loadList();
    // Zaxira: SSE ulangan bo'lsa siyrak (60 s), aks holda 20 s
    let n = 0;
    const timer = window.setInterval(() => {
      n++;
      if (document.hidden) return;
      if (!streamRef.current || n % 3 === 0) void loadList();
    }, 20000);
    const onVis = () => {
      if (!document.hidden) void loadList();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadList]);

  // «Chat» nishoni (yon panel / pastki tab / sarlavha): ro'yxatdagi sonlardan darhol (so'rovsiz)
  useEffect(() => {
    if (!convs) return;
    if (convs.length >= LIST_LIMIT) {
      // Ro'yxat to'liq emas (eski suhbatlar sig'magan) — aniq sonni server hisoblaydi
      refreshChatUnread();
      return;
    }
    const dm = convs.reduce((s, c) => s + (c.prefs.muted ? 0 : c.unread), 0);
    const groups = groupRows.reduce((s, g) => s + (g.muted ? 0 : g.unread), 0);
    if (orderRows.length >= 20) publishChatUnread({ dm, groups });
    else publishChatUnread({ dm, groups, orderUnread: Object.fromEntries(orderRows.map((o) => [o.orderId, o.unread])) });
  }, [convs, groupRows, orderRows]);

  // Qoralamalar (ro'yxatdagi «Qoralama: …» belgisi) — suhbatlar to'plami o'zgarganda qurilma xotirasidan o'qiladi
  const convIds = useMemo(() => (convs ?? []).map((c) => c.id).join(","), [convs]);
  useEffect(() => {
    if (!convIds) return;
    const next: Record<string, string> = {};
    for (const id of convIds.split(",")) {
      const d = readDraft(id).trim();
      if (d) next[id] = d;
    }
    setDrafts(next);
  }, [convIds]);
  const onDraft = useCallback((convId: string, text: string) => {
    const v = text.trim();
    setDrafts((d) => {
      if ((d[convId] ?? "") === v) return d;
      const next = { ...d };
      if (v) next[convId] = v;
      else delete next[convId];
      return next;
    });
  }, []);

  /* ---------------- «O'qilmagan deb belgilash» (qurilmada) ---------------- */
  const setMark = useCallback((key: string, on: boolean) => {
    setMarks((cur) => {
      if (cur.has(key) === on) return cur;
      const next = new Set(cur);
      if (on) next.add(key);
      else next.delete(key);
      writeMarks(next);
      return next;
    });
  }, []);

  /* ---------------- Ochish / yopish ---------------- */
  const openConv = useCallback(
    (id: string) => {
      setMark(`d:${id}`, false);
      route.openConv(id);
    },
    [route, setMark],
  );
  const openGroup = useCallback(
    (g: GroupRow) => {
      setMark(`g:${g.id}`, false);
      route.openGroup(g.slug);
    },
    [route, setMark],
  );

  // Fokus: suhbat yopilganda ro'yxatdagi shu qatorga qaytadi (klaviatura bilan ishlaydiganlar adashmasin)
  useEffect(() => {
    if (active) prevActive.current = active;
    else if (prevActive.current) {
      const btn = listRef.current?.querySelector<HTMLButtonElement>(`[data-conv="${prevActive.current}"]`);
      prevActive.current = null;
      window.setTimeout(() => btn?.focus({ preventScroll: true }), 50);
    }
  }, [active]);

  /* ---------------- Sozlamalar ---------------- */
  const updatePrefs = useCallback(
    async (convId: string, patch: Partial<ConvPrefsView>) => {
      setConvs((c) => c?.map((r) => (r.id === convId ? { ...r, prefs: { ...r.prefs, ...patch } } : r)) ?? c);
      const res = await fetch(`/api/chat/${convId}/prefs`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => null);
      if (!res?.ok) toast(t("saveFail"), "error");
      void loadList();
    },
    [loadList, t, toast],
  );

  /** Guruh/kanal qatorining pin/papka/ovoz/arxiv sozlamasi — optimistik */
  const updateGroupPref = async (id: string, patch: { pinned?: boolean; folderId?: string | null; muted?: boolean; archived?: boolean }) => {
    setGroupRows((l) => l.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    const res = await fetch(`/api/chat/guruh/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => null);
    if (!res?.ok) {
      toast(t("saveFail"), "error");
      void loadList();
    }
  };

  /** «O'qildi deb belgilash»: guruh — serverda o'qish belgisi hozirga suriladi; suhbat — o'qilgan deb yuklanadi */
  const markGroupRead = async (g: GroupRow) => {
    setMark(`g:${g.id}`, false);
    if (g.unread === 0) return;
    setGroupRows((l) => l.map((x) => (x.id === g.id ? { ...x, unread: 0 } : x)));
    const res = await fetch(`/api/chat/guruh/${encodeURIComponent(g.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }) }).catch(() => null);
    if (!res?.ok) toast(t("saveFail"), "error");
    void loadList();
  };
  const markConvRead = async (c: ConvRow) => {
    setMark(`d:${c.id}`, false);
    if (c.unread === 0) return;
    setConvs((l) => l?.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)) ?? l);
    const res = await fetch(`/api/chat/${c.id}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) toast(t("saveFail"), "error");
    void loadList();
  };
  const onThreadRead = useCallback((convId: string) => {
    setConvs((l) => (l?.some((x) => x.id === convId && x.unread > 0) ? l.map((x) => (x.id === convId ? { ...x, unread: 0 } : x)) : l));
  }, []);

  /** Suhbatni men uchun o'chirish (suhbatdoshda hammasi qoladi) — tasdiq bilan */
  const deleteConv = useCallback(
    async (convId: string) => {
      if (!(await confirm({ title: t("deleteChatQ"), text: t("deleteChatText"), confirmLabel: t("remove"), danger: true }))) return;
      const res = await fetch(`/api/chat/${convId}`, { method: "DELETE" }).catch(() => null);
      if (!res?.ok) {
        toast(res ? t("deleteFail") : t("netError"), "error");
        return;
      }
      writeDraft(convId, "");
      onDraft(convId, "");
      setMark(`d:${convId}`, false);
      setConvs((l) => l?.filter((x) => x.id !== convId) ?? l);
      if (activeRef.current === convId) route.close();
      toast(t("chatDeleted"), "info");
      void loadList();
    },
    [confirm, loadList, onDraft, route, setMark, t, toast],
  );

  /** Guruhdan chiqish / kanal obunasini bekor qilish — ro'yxat menyusidan (tasdiq bilan) */
  const leaveGroup = async (g: GroupRow) => {
    const channel = g.kind === "channel";
    if (!(await confirm({ title: t(channel ? "leaveChannelQ" : "leaveGroupQ"), text: t("leaveText"), confirmLabel: t(channel ? "leaveChannel" : "leave"), danger: true }))) return;
    const res = await fetch(`/api/groups/${encodeURIComponent(g.slug)}/join`, { method: "DELETE" }).catch(() => null);
    const json = res ? ((await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null) : null;
    if (!res?.ok || !json?.ok) {
      toast(json?.error ?? (res ? t("fail") : t("netError")), "error");
      return;
    }
    setGroupRows((l) => l.filter((x) => x.id !== g.id));
    if (groupSlug === g.slug) route.close();
    toast(t(channel ? "unsubscribed" : "left"), "info");
    void loadList();
  };

  /* ---------------- Papkalar ---------------- */
  const addFolder = async () => {
    const name = newFolder.trim();
    if (!name) return;
    const res = await fetch("/api/chat/papkalar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    const json = res ? ((await res.json().catch(() => null)) as { ok?: boolean; data?: { id: string; name: string }; error?: string; fields?: Record<string, string> } | null) : null;
    if (!res?.ok || !json?.data) {
      toast((json?.fields && Object.values(json.fields)[0]) || json?.error || t("folderFail"), "error");
      return;
    }
    const created = json.data;
    setFolders((l) => [...l, { id: created.id, name: created.name, count: 0 }]);
    setNewFolder("");
  };
  const saveFolderName = async (id: string, nameRaw: string) => {
    const name = nameRaw.trim();
    setRenaming(null);
    const cur = folders.find((f) => f.id === id);
    if (!name || !cur || cur.name === name) return;
    const prev = folders;
    setFolders((l) => l.map((f) => (f.id === id ? { ...f, name } : f)));
    const res = await fetch(`/api/chat/papkalar/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    if (!res?.ok) {
      const json = res ? ((await res.json().catch(() => null)) as { error?: string } | null) : null;
      setFolders(prev);
      toast(json?.error ?? t("saveFail"), "error");
    }
  };
  /** Papkani tartibda surish: lokal almashtirish + serverda position yangilanadi */
  const moveFolderRow = async (id: string, dir: "up" | "down") => {
    const prev = folders;
    const idx = folders.findIndex((f) => f.id === id);
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || j < 0 || j >= folders.length) return;
    const next = [...folders];
    [next[idx], next[j]] = [next[j], next[idx]];
    setFolders(next);
    const res = await fetch(`/api/chat/papkalar/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ move: dir }) }).catch(() => null);
    if (!res?.ok) {
      setFolders(prev);
      toast(t("saveFail"), "error");
    }
  };
  /** Papkani o'chirish — tasdiq bilan (ichidagi chatlar «Barchasi»da qoladi) */
  const removeFolder = async (f: FolderRow) => {
    if (!(await confirm({ title: t("folderDeleteQ"), text: t("folderDeleteText"), confirmLabel: t("remove"), danger: true }))) return;
    setFolders((l) => l.filter((x) => x.id !== f.id));
    if (folder === f.id) setFolder(null);
    const res = await fetch(`/api/chat/papkalar/${encodeURIComponent(f.id)}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) toast(t("deleteFail"), "error");
    void loadList();
  };

  /* ---------------- Ko'rinadigan qatorlar ---------------- */
  const needle = q.trim().toLowerCase();
  const merged = useMemo<MergedRow[]>(() => {
    // Qidiruv hamma joydan izlaydi (tab, papka, arxivdan qat'i nazar); aks holda — joriy ko'rinish
    const inView = (archived: boolean, folderId: string | null | undefined, type: "dm" | "group" | "channel") => (needle ? true : showArchived ? archived : !archived && (chatType === "all" || chatType === type) && (!folder || folderId === folder));
    const has = (...parts: Array<string | null | undefined>) => !needle || parts.some((p) => (p ?? "").toLowerCase().includes(needle));
    const rows: MergedRow[] = [];
    for (const c of convs ?? []) if (inView(c.prefs.archived, c.prefs.folderId, "dm") && has(c.peer.name, c.peer.username, c.last?.body)) rows.push({ kind: "dm", at: c.sortAt ?? c.last?.at ?? 0, pinned: c.prefs.pinned, dm: c });
    for (const g of groupRows) if (inView(Boolean(g.archived), g.folderId, g.kind) && has(g.name, g.last?.body)) rows.push({ kind: "grp", at: g.last?.at ?? 0, pinned: g.pinned, grp: g });
    // Buyurtma chatlari (faqat o'qilmagan xabari borlari) — umumiy ro'yxatda
    if (needle || (!showArchived && chatType === "all" && !folder)) for (const o of orderRows) if (has(o.title, o.peerName, o.last?.body)) rows.push({ kind: "ord", at: o.last?.at ?? 0, pinned: false, ord: o });
    rows.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at - a.at);
    return rows;
  }, [convs, groupRows, orderRows, needle, showArchived, folder, chatType]);

  /** Arxiv: nechta chat va ulardan nechtasida o'qilmagan xabar bor (arxiv qatoridagi nishon) */
  const archive = useMemo(() => {
    const dm = (convs ?? []).filter((c) => c.prefs.archived);
    const grp = groupRows.filter((g) => g.archived);
    return {
      total: dm.length + grp.length,
      unread: dm.filter((c) => c.unread > 0 && !c.prefs.muted).length + grp.filter((g) => g.unread > 0 && !g.muted).length,
      names: [...dm.map((c) => c.peer.name), ...grp.map((g) => g.name)].slice(0, 4).join(", "),
    };
  }, [convs, groupRows]);
  // Arxiv bo'shab qolsa (oxirgi chat chiqarildi) — oddiy ro'yxatga qaytamiz (ilgari «Topilmadi»da qotib qolardi)
  useEffect(() => {
    if (showArchived && convs && archive.total === 0) setShowArchived(false);
  }, [showArchived, convs, archive.total]);

  /** Har tab/papka yonidagi son: o'qilmagan (ovozsizlardan tashqari, arxivsiz) CHATLAR soni */
  const tabCounts = useMemo(() => {
    const dmRows = (convs ?? []).filter((c) => !c.prefs.archived && c.unread > 0 && !c.prefs.muted);
    const grpRows = groupRows.filter((g) => !g.archived && g.unread > 0 && !g.muted);
    const byFolder = new Map<string, number>();
    for (const c of dmRows) if (c.prefs.folderId) byFolder.set(c.prefs.folderId, (byFolder.get(c.prefs.folderId) ?? 0) + 1);
    for (const g of grpRows) if (g.folderId) byFolder.set(g.folderId, (byFolder.get(g.folderId) ?? 0) + 1);
    return { all: dmRows.length + grpRows.length + orderRows.length, dm: dmRows.length, group: grpRows.filter((g) => g.kind === "group").length, channel: grpRows.filter((g) => g.kind === "channel").length, byFolder };
  }, [convs, groupRows, orderRows]);

  // Klaviatura: Alt+↑/↓ — ko'rinib turgan shaxsiy suhbatlar orasida
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!e.altKey || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
      const ids = merged.flatMap((r) => (r.kind === "dm" ? [r.dm.id] : []));
      if (!ids.length) return;
      e.preventDefault();
      const i = ids.indexOf(active ?? "");
      const n = e.key === "ArrowDown" ? Math.min(ids.length - 1, i + 1) : Math.max(0, i - 1);
      if (ids[n] !== active) openConv(ids[n]);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [merged, active, openConv]);

  /* ---------------- Yordamchilar ---------------- */
  const isOnline = (p: Peer) => Boolean(p.lastSeenAt && now - p.lastSeenAt < ONLINE_MS);
  const kindLabel = (k: AttachKind | undefined) => (k && k !== "text" ? t(k) : "");
  const kindIcon = (k: AttachKind | undefined) => {
    const Icon = k ? KIND_ICON[k] : null;
    return Icon ? <Icon size={12} className="shrink-0" aria-hidden="true" /> : undefined;
  };
  const pickType = (k: ChatType) => {
    setChatType(k);
    setFolder(null);
    setShowArchived(false);
  };
  const pickFolder = (id: string) => {
    setChatType("all");
    setShowArchived(false);
    setFolder(folder === id ? null : id);
  };
  const typeTabs: Array<{ k: ChatType; icon: LucideIcon; label: string; n: number }> = [
    { k: "all", icon: MessagesSquare, label: t("tabAll"), n: tabCounts.all },
    { k: "dm", icon: User, label: t("tabDms"), n: tabCounts.dm },
    { k: "group", icon: Users, label: t("tabGroups"), n: tabCounts.group },
    { k: "channel", icon: Megaphone, label: t("tabChannels"), n: tabCounts.channel },
  ];
  const avatarSize = isPhone ? 52 : 44;
  const swipeCls = { pin: "bg-fg/80 text-bg", mute: "bg-warning text-white", archive: "bg-accent text-white" };
  const markCls = "shrink-0 text-fg-4";

  const railBtn = (key: string, on: boolean, Icon: LucideIcon, label: string, n: number, onClick: () => void) => (
    <button key={key} type="button" onClick={onClick} aria-pressed={on} title={label} className={cn("relative mx-1.5 flex flex-col items-center gap-1.5 rounded-[12px] px-0.5 py-2 text-center transition-colors duration-150", on ? "text-accent-text" : "text-fg-3 hover:text-fg")}>
      <span className={cn("glass-ic relative h-10 w-10", on && "glass-ic-on")}>
        <Icon size={19} strokeWidth={on ? 2.2 : 1.8} />
        {n > 0 && (
          <span key={n} className={cn("absolute -right-1.5 -top-1.5 flex h-4 min-w-4 animate-badge-pop items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white", on ? "bg-accent" : "bg-fg/45")}>
            {n > 99 ? "99+" : n}
          </span>
        )}
      </span>
      {/* Bir qator (QA: «Barcha chatlar» ikki qatorga bo'linardi) — sig'masa uch nuqta, to'liq nom `title`da */}
      <span className="block w-full truncate text-[10.5px] font-semibold leading-[1.2]" data-no-auto>
        {label}
      </span>
    </button>
  );
  const pillBtn = (key: string, on: boolean, label: string, n: number, onClick: () => void) => (
    <button key={key} type="button" onClick={onClick} aria-pressed={on} className={cn("press relative inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold transition-[color,transform] duration-200", on ? "glass-pill text-fg" : "text-fg-3 active:scale-95")}>
      <span data-no-auto>{label}</span>
      {n > 0 && <span className={cn("ml-1.5 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold leading-none text-white", on ? "bg-accent" : "bg-fg/35")}>{n > 99 ? "99+" : n}</span>}
    </button>
  );

  /* ---------------- Qatorlar ---------------- */
  const renderRow = (row: MergedRow): ReactNode => {
    if (row.kind === "ord") {
      const o = row.ord;
      return (
        <ChatRow
          key={`o:${o.orderId}`}
          rowKey={`o:${o.orderId}`}
          current={false}
          phone={isPhone}
          avatar={
            <span className="glass-ic grid shrink-0 place-items-center !rounded-full text-fg-2" style={{ width: avatarSize, height: avatarSize }}>
              <ShoppingBag size={isPhone ? 21 : 18} aria-hidden />
            </span>
          }
          title={o.title}
          marks={<span className="shrink-0 rounded-full bg-fg/8 px-1.5 py-px text-[10.5px] font-semibold text-fg-3">{t("orderRow")}</span>}
          time={o.last ? listStamp(o.last.at, locale, now) : undefined}
          timeIso={o.last ? new Date(o.last.at).toISOString() : undefined}
          accentTime
          preview={`${o.peerName ? `${o.peerName}: ` : ""}${o.last?.body || (o.last?.hasFiles ? t("file") : t("openOrder"))}`}
          previewIcon={o.last?.hasFiles && !o.last.body ? kindIcon("file") : undefined}
          previewTone="strong"
          unread={o.unread}
          onOpen={() => router.push(o.href)}
          newLabel={t("newMessages")}
        />
      );
    }
    if (row.kind === "grp") {
      const g = row.grp;
      const key = `g:${g.id}`;
      const swipe: RowSwipeAction[] = [
        { key: "pin", icon: g.pinned ? PinOff : Pin, label: t(g.pinned ? "unpin" : "pin"), cls: swipeCls.pin, act: () => void updateGroupPref(g.id, { pinned: !g.pinned }) },
        { key: "mute", icon: g.muted ? Bell : BellOff, label: t(g.muted ? "swUnmute" : "swMute"), cls: swipeCls.mute, act: () => void updateGroupPref(g.id, { muted: !g.muted }) },
        { key: "archive", icon: g.archived ? ArchiveRestore : Archive, label: t(g.archived ? "swUnarchive" : "swArchive"), cls: swipeCls.archive, act: () => void updateGroupPref(g.id, { archived: !g.archived }) },
      ];
      return (
        <ChatRow
          key={key}
          rowKey={key}
          current={groupSlug === g.slug}
          phone={isPhone}
          avatar={<GroupAvatar name={g.name} coverUrl={g.coverUrl} kind={g.kind} size={avatarSize} />}
          title={g.name}
          marks={
            <>
              {g.isOfficial && <ShieldCheck size={12} className="shrink-0 text-accent" aria-label={t("official")} />}
              {g.muted && <BellOff size={11} className={markCls} aria-label={t("muted")} />}
              {g.pinned && <Pin size={11} className={markCls} aria-label={t("pin")} />}
            </>
          }
          time={g.last ? listStamp(g.last.at, locale, now) : undefined}
          timeIso={g.last ? new Date(g.last.at).toISOString() : undefined}
          accentTime={g.unread > 0 && !g.muted}
          preview={g.typing ? `${g.typing} ${t("typing")}` : g.last ? `${g.last.by ? `${g.last.by}: ` : ""}${g.last.body || kindLabel(g.last.kind) || t("file")}` : t(g.kind === "channel" ? "channelRow" : "groupRow")}
          previewIcon={g.typing || !g.last ? undefined : kindIcon(g.last.kind ?? (g.last.hasFiles ? "file" : "text"))}
          previewTone={g.typing ? "typing" : g.unread > 0 ? "strong" : "normal"}
          unread={g.unread}
          unreadMuted={g.muted}
          unreadDot={marks.has(key)}
          swipe={swipe}
          onOpen={() => openGroup(g)}
          onMenu={(anchor) => setRowMenu({ kind: "grp", id: g.id, anchor })}
          menuOpen={rowMenu?.kind === "grp" && rowMenu.id === g.id}
          menuLabel={`${g.name} — ${t("menu")}`}
          newLabel={t("newMessages")}
        />
      );
    }
    const c = row.dm;
    const key = `d:${c.id}`;
    const draft = c.id !== active ? drafts[c.id] : undefined;
    const who = c.last?.mine ? `${t("you")}: ` : "";
    const swipe: RowSwipeAction[] = [
      { key: "pin", icon: c.prefs.pinned ? PinOff : Pin, label: t(c.prefs.pinned ? "unpin" : "pin"), cls: swipeCls.pin, act: () => void updatePrefs(c.id, { pinned: !c.prefs.pinned }) },
      { key: "mute", icon: c.prefs.muted ? Bell : BellOff, label: t(c.prefs.muted ? "swUnmute" : "swMute"), cls: swipeCls.mute, act: () => void updatePrefs(c.id, { muted: !c.prefs.muted }) },
      { key: "archive", icon: c.prefs.archived ? ArchiveRestore : Archive, label: t(c.prefs.archived ? "swUnarchive" : "swArchive"), cls: swipeCls.archive, act: () => void updatePrefs(c.id, { archived: !c.prefs.archived }) },
    ];
    return (
      <ChatRow
        key={key}
        rowKey={key}
        current={c.id === active}
        phone={isPhone}
        avatar={
          <>
            <PeerAvatar name={c.peer.name} avatarUrl={c.peer.avatarUrl} size={avatarSize} />
            {isOnline(c.peer) && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-bg bg-success" role="img" aria-label={t("online")} />}
          </>
        }
        title={c.peer.name}
        marks={
          <>
            {c.peer.isVerified && <VerifiedBadge size={12} className="shrink-0" />}
            {c.ttlSeconds ? <Timer size={11} className={markCls} aria-label={t("ttlTitle")} /> : null}
            {c.prefs.muted && <BellOff size={11} className={markCls} aria-label={t("muted")} />}
            {c.prefs.pinned && <Pin size={11} className={markCls} aria-label={t("pin")} />}
          </>
        }
        time={c.last ? listStamp(c.last.at, locale, now) : undefined}
        timeIso={c.last ? new Date(c.last.at).toISOString() : undefined}
        accentTime={c.unread > 0 && !c.prefs.muted}
        preview={
          c.peerTyping ? (
            t("typing")
          ) : draft ? (
            <>
              <span className="font-semibold text-danger-text">{t("draft")}:</span> {draft}
            </>
          ) : !c.last ? (
            ""
          ) : c.last.deleted ? (
            `${who}${DM_DELETED_TEXT[locale]}`
          ) : (
            `${who}${c.last.body || kindLabel(c.last.kind) || (c.last.voice ? t("voice") : c.last.hasFiles ? t("file") : "")}`
          )
        }
        previewIcon={c.peerTyping || draft || !c.last || c.last.deleted ? undefined : kindIcon(c.last.kind ?? (c.last.voice ? "voice" : c.last.hasFiles ? "file" : "text"))}
        previewTone={c.peerTyping ? "typing" : c.unread > 0 && !draft ? "strong" : "normal"}
        unread={c.unread}
        unreadMuted={c.prefs.muted}
        unreadDot={marks.has(key)}
        swipe={swipe}
        onOpen={() => openConv(c.id)}
        onMenu={(anchor) => setRowMenu({ kind: "dm", id: c.id, anchor })}
        menuOpen={rowMenu?.kind === "dm" && rowMenu.id === c.id}
        menuLabel={`${c.peer.name} — ${t("menu")}`}
        dataConv={c.id}
        newLabel={t("newMessages")}
      />
    );
  };

  /* ---------------- Ro'yxat paneli ---------------- */
  const headBtn = "glass-ic h-10 w-10 shrink-0 !rounded-[12px] text-fg-2 hover:text-fg lg:h-9 lg:w-9";
  const showArchiveRow = archive.total > 0 && !showArchived && !needle && chatType === "all" && !folder;
  const listPanel = (
    <div ref={listRef} className={cn("card-elevated flex min-h-0 flex-col overflow-hidden lg:flex-row max-lg:!rounded-none max-lg:!border-0 max-lg:!bg-transparent max-lg:!shadow-none", open && "hidden lg:flex")}>
      {/* Telegram Desktop papka ustuni (lg+): ikonka + nom + o'qilmagan chatlar soni */}
      <aside aria-label={t("folders")} className="hidden w-[76px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line bg-fg/[0.02] py-2 lg:flex">
        {typeTabs.map((o) => railBtn(o.k, chatType === o.k && !folder && !showArchived, o.icon, o.label, o.n, () => pickType(o.k)))}
        {folders.map((f) => railBtn(f.id, folder === f.id, Folder, f.name, tabCounts.byFolder.get(f.id) ?? 0, () => pickFolder(f.id)))}
        <button type="button" onClick={() => setFolderMgr(true)} title={t("folders")} aria-label={t("folders")} className="mx-1.5 mt-auto flex flex-col items-center gap-1 rounded-[12px] px-1 py-2 text-fg-4 transition-colors duration-150 hover:text-fg">
          <span className="glass-ic h-10 w-10">
            <FolderPlus size={18} strokeWidth={1.8} />
          </span>
        </button>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5 border-b border-line p-2.5 max-lg:border-0 max-lg:px-0 max-lg:pt-0">
          <label className="relative block min-w-0 flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-4 max-lg:left-3.5 max-lg:size-4" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && q && (e.stopPropagation(), setQ(""))} placeholder={t("searchConvs")} className="field h-9 w-full !rounded-full pl-8 pr-9 text-[13px] max-lg:h-11 max-lg:pl-10 max-lg:text-[16px]" aria-label={t("searchConvs")} />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label={t("close")} className="absolute right-0.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-fg-4 hover:bg-fg/8 hover:text-fg max-lg:h-10 max-lg:w-10">
                <X size={14} />
              </button>
            )}
          </label>
          {/* Yangi chat: ro'yxatdan chiqmasdan odam topib yozish */}
          <button type="button" onClick={() => setNewChat(true)} aria-label={t("newChat")} title={t("newChat")} className={headBtn}>
            <SquarePen size={16} />
          </button>
          {/* Papkalar: desktopda chap ustun pastidagi tugma bor — bu yerda faqat telefonda (`.glass-ic` display'i layersiz — `!hidden`) */}
          <button type="button" onClick={() => setFolderMgr(true)} aria-label={t("folders")} title={t("folders")} className={cn(headBtn, "lg:!hidden")}>
            <Folder size={16} />
          </button>
          {/* Jamoalar katalogi — yangi guruh/kanal topish */}
          <Link href="/jamoalar" aria-label={t("catalog")} title={t("catalog")} className={headBtn}>
            <Compass size={16} />
          </Link>
        </div>
        {/* Telefon: tablar qatori (4 asosiy tab surishsiz sig'adi; o'z papkalari davomida) */}
        <nav aria-label={t("folders")} className="no-scrollbar flex items-center gap-0.5 overflow-x-auto border-b border-line px-0.5 pb-1.5 lg:hidden">
          {typeTabs.map((o) => pillBtn(o.k, chatType === o.k && !folder && !showArchived, o.label, o.n, () => pickType(o.k)))}
          {folders.map((f) => pillBtn(f.id, folder === f.id, f.name, tabCounts.byFolder.get(f.id) ?? 0, () => pickFolder(f.id)))}
        </nav>
        {showArchived && (
          <div className="flex shrink-0 items-center gap-1 border-b border-line px-1 py-1">
            <button type="button" onClick={() => setShowArchived(false)} aria-label={t("back")} className={iconBtn}>
              <ArrowLeft size={17} />
            </button>
            <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg">
              {t("archived")} <span className="font-normal text-fg-4">· {t("chatsN", { n: archive.total })}</span>
            </p>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!convs ? (
            listErr ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <p className="text-[13.5px] text-fg-3">{t("loadErr")}</p>
                <button type="button" onClick={() => void loadList()} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                  <RotateCcw size={13} aria-hidden="true" /> {t("tryAgain")}
                </button>
              </div>
            ) : (
              <ul className="stagger divide-y divide-line max-lg:divide-y-0" aria-busy="true" aria-label={t("loading")}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <li key={i} className="animate-fade-in flex items-center gap-3 px-3 py-2.5 max-lg:px-2 max-lg:py-3">
                    <span className="h-11 w-11 shrink-0 rounded-full skeleton max-lg:h-[52px] max-lg:w-[52px]" />
                    <span className="flex-1 space-y-2">
                      <span className="block h-3 w-1/2 skeleton" />
                      <span className="block h-2.5 w-3/4 skeleton" />
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : merged.length === 0 && !showArchiveRow ? (
            <div className="flex h-full flex-col items-center justify-center gap-2.5 px-6 py-12 text-center">
              <span className="icon-tile-soft !rounded-full">
                <MessageCircle size={20} />
              </span>
              {needle ? (
                <p className="font-display text-[15px] font-semibold text-fg">{t("notFound")}</p>
              ) : folder || chatType !== "all" || showArchived ? (
                <p className="text-[13.5px] text-fg-3">{t("emptyFolder")}</p>
              ) : (
                <>
                  <p className="font-display text-[15px] font-semibold text-fg">{t("noConvs")}</p>
                  <p className="max-w-[300px] text-[13px] leading-relaxed text-fg-3">{t("noConvsHint")}</p>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                    <button type="button" onClick={() => setNewChat(true)} className="btn-accent inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold">
                      <SquarePen size={14} aria-hidden="true" /> {t("newChat")}
                    </button>
                    <Link href="/mutaxassislar" className="inline-flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                      {t("browse")}
                    </Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Tab/papka almashganda ro'yxat yumshoq almashinadi (key → qayta kirish animatsiyasi) */
            <ul key={`${chatType}:${folder ?? ""}:${showArchived ? 1 : 0}`} className="animate-fade-in divide-y divide-line max-lg:divide-y-0" aria-label={t("chatList")}>
              {showArchiveRow && (
                <li>
                  <button type="button" onClick={() => setShowArchived(true)} className="press flex w-full items-center gap-3 border-l-2 border-transparent py-2.5 pl-3 pr-3 text-left transition lg:pr-11 hover:bg-fg/4 focus-visible:bg-fg/4 focus-visible:outline-none max-lg:gap-3.5 max-lg:rounded-[var(--r-md)] max-lg:border-l-0 max-lg:px-2 max-lg:py-3">
                    <span className="glass-ic grid shrink-0 place-items-center !rounded-full text-fg-2" style={{ width: avatarSize, height: avatarSize }}>
                      <Archive size={isPhone ? 20 : 17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-fg max-lg:text-[16px]">{t("archived")}</span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-fg-3 max-lg:text-[14.5px]" data-no-auto>
                        {archive.names}
                      </span>
                    </span>
                    {archive.unread > 0 ? (
                      <span className="flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-none text-white" aria-label={t("unreadChatsN", { n: archive.unread })}>
                        {archive.unread}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[12px] tabular-nums text-fg-4">{archive.total}</span>
                    )}
                  </button>
                </li>
              )}
              {merged.map(renderRow)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  /* ---------------- O'ng panel: suhbat / guruh / bo'sh holat ---------------- */
  const activeRow = active ? ((convs ?? []).find((c) => c.id === active) ?? null) : null;
  const groupRow = groupSlug ? (groupRows.find((g) => g.slug === groupSlug) ?? null) : null;
  // Guruh manzilidagi bir martalik parametrlar (gtab/post/invite) — panel ochilgan paytdagi qiymatlari
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const extras = useMemo(() => ({ gtab: route.gtab, post: route.post, invite: route.invite }), [groupSlug]);
  const forwardTargets = useMemo<ConvPick[]>(() => (convs ?? []).filter((c) => c.id !== active && !c.peer.isBanned).map((c) => ({ id: c.id, name: c.peer.name, username: c.peer.username, avatarUrl: c.peer.avatarUrl })), [convs, active]);
  const panelCls = "card-elevated relative flex min-h-0 flex-1 flex-col overflow-hidden max-lg:rounded-none max-lg:border-0 max-lg:shadow-none";

  const panel = !open ? (
    <div className={cn(panelCls, "hidden lg:flex")}>
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-6 text-center">
        <span className="icon-tile-soft !rounded-full">
          <MessageCircle size={20} />
        </span>
        <p className="font-display text-[15px] font-semibold text-fg">{t("pickConv")}</p>
        <p className="max-w-[280px] text-[13px] leading-relaxed text-fg-3">{t("pickConvHint")}</p>
        <button type="button" onClick={() => setNewChat(true)} className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
          <SquarePen size={14} aria-hidden="true" /> {t("newChat")}
        </button>
      </div>
    </div>
  ) : !ready ? (
    // Server va birinchi chizish: yengil skelet (telefonda panel portalga ko'chadi — ichki komponentlar bir marta yuklanadi)
    <div className={panelCls} aria-busy="true">
      <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5">
        <span className="h-[38px] w-[38px] rounded-full skeleton" />
        <span className="h-4 w-32 skeleton" />
      </div>
      <div className="tg-chat-bg flex-1 space-y-2.5 p-3">
        <span className="block h-10 w-2/3 rounded-2xl skeleton" />
        <span className="ml-auto block h-10 w-1/2 rounded-2xl skeleton" />
        <span className="block h-10 w-1/2 rounded-2xl skeleton" />
      </div>
    </div>
  ) : groupSlug ? (
    <div className={panelCls}>
      <GroupPanelBody
        key={groupSlug}
        slug={groupSlug}
        row={groupRow}
        initialTab={extras.gtab === "chat" ? "chat" : "posts"}
        initialSheet={extras.gtab === "azolar" ? "members" : null}
        highlightId={extras.post}
        invite={extras.invite}
        viewerId={viewerId}
        viewerRole={viewerRole}
        onClose={route.close}
        onChanged={() => void loadList()}
        onLeft={() => {
          route.close();
          void loadList();
        }}
        onSheetClosed={route.clearGroupExtras}
      />
    </div>
  ) : active ? (
    <DmThread
      key={active}
      convId={active}
      viewerRole={viewerRole}
      row={activeRow}
      folders={folders}
      forwardTargets={forwardTargets}
      streamOn={streamConnected}
      pulse={pulse}
      portaled={fullscreen}
      onClose={route.close}
      onListChanged={() => void loadList()}
      onRead={onThreadRead}
      onPrefs={(id, patch) => void updatePrefs(id, patch)}
      onFolders={() => setFolderMgr(true)}
      onDeleteChat={(id) => void deleteConv(id)}
      onDraft={onDraft}
    />
  ) : null;

  /* ---------------- Qator menyusi (bitta `Layer`: desktopda langarga bog'langan, telefonda pastki varaq) ---------------- */
  const menuConv = rowMenu?.kind === "dm" ? ((convs ?? []).find((c) => c.id === rowMenu.id) ?? null) : null;
  const menuGroup = rowMenu?.kind === "grp" ? (groupRows.find((g) => g.id === rowMenu.id) ?? null) : null;
  // Yopilish animatsiyasi paytida bandlar yo'qolib qolmasin — oxirgi ochilgan qator bilan chiziladi
  const lastRowMenu = useRef<{ conv: ConvRow | null; group: GroupRow | null }>({ conv: null, group: null });
  if (menuConv || menuGroup) lastRowMenu.current = { conv: menuConv, group: menuGroup };
  const mc = menuConv ?? (menuGroup ? null : lastRowMenu.current.conv);
  const mg = menuGroup ?? (menuConv ? null : lastRowMenu.current.group);
  const closeMenu = () => setRowMenu(null);
  const folderItems = (currentId: string | null | undefined, set: (id: string | null) => void) =>
    folders.length > 0 && (
      <>
        <MenuDivider />
        <p className="px-3 pb-0.5 pt-1.5 text-[11.5px] font-semibold text-fg-4">{t("toFolder")}</p>
        {folders.map((f) => (
          <MenuItem key={f.id} icon={Folder} label={f.name} hint={currentId === f.id ? "✓" : ""} active={currentId === f.id} onClick={() => (closeMenu(), set(currentId === f.id ? null : f.id))} />
        ))}
      </>
    );
  const rowMenuLayer = (
    <Layer open={Boolean(menuConv || menuGroup)} onClose={closeMenu} label={mc ? `${mc.peer.name} — ${t("menu")}` : mg ? `${mg.name} — ${t("menu")}` : t("menu")} anchor={rowMenu?.anchor} width="w-[250px]">
      {mc && (
        <>
          <PrefItems prefs={mc.prefs} locale={locale} onChange={(p) => (closeMenu(), void updatePrefs(mc.id, p))} />
          {mc.unread > 0 || marks.has(`d:${mc.id}`) ? (
            <MenuItem icon={CheckCheck} label={t("markRead")} onClick={() => (closeMenu(), void markConvRead(mc))} />
          ) : (
            mc.id !== active && <MenuItem icon={CircleDot} label={t("markUnread")} onClick={() => (closeMenu(), setMark(`d:${mc.id}`, true))} />
          )}
          {folderItems(mc.prefs.folderId, (id) => void updatePrefs(mc.id, { folderId: id }))}
          <MenuDivider />
          <MenuItem icon={Trash2} label={t("deleteChat")} danger onClick={() => (closeMenu(), void deleteConv(mc.id))} />
        </>
      )}
      {mg && (
        <>
          <MenuItem icon={mg.pinned ? PinOff : Pin} label={t(mg.pinned ? "unpin" : "pin")} onClick={() => (closeMenu(), void updateGroupPref(mg.id, { pinned: !mg.pinned }))} />
          <MenuItem icon={mg.muted ? Bell : BellOff} label={t(mg.muted ? "swUnmute" : "swMute")} onClick={() => (closeMenu(), void updateGroupPref(mg.id, { muted: !mg.muted }))} />
          {mg.unread > 0 || marks.has(`g:${mg.id}`) ? (
            <MenuItem icon={CheckCheck} label={t("markRead")} onClick={() => (closeMenu(), void markGroupRead(mg))} />
          ) : (
            mg.slug !== groupSlug && <MenuItem icon={CircleDot} label={t("markUnread")} onClick={() => (closeMenu(), setMark(`g:${mg.id}`, true))} />
          )}
          <MenuItem icon={mg.archived ? ArchiveRestore : Archive} label={t(mg.archived ? "swUnarchive" : "swArchive")} onClick={() => (closeMenu(), void updateGroupPref(mg.id, { archived: !mg.archived }))} />
          {folderItems(mg.folderId, (id) => void updateGroupPref(mg.id, { folderId: id }))}
          {/* Chiqish: egasi chiqa olmaydi (avval egalikni topshiradi), rasmiy kanaldan chiqib bo'lmaydi */}
          {!mg.isOwner && !mg.isOfficial && (
            <>
              <MenuDivider />
              <MenuItem icon={LogOut} label={t(mg.kind === "channel" ? "leaveChannel" : "leaveGroup")} danger onClick={() => (closeMenu(), void leaveGroup(mg))} />
            </>
          )}
        </>
      )}
    </Layer>
  );

  /* ---------------- Papkalar oynasi ---------------- */
  // Ochiq chat bo'lsa — papka tanlash shu chatni joylaydi
  const folderTarget: { id: string | null | undefined; set: (id: string | null) => void } | null = activeRow
    ? { id: activeRow.prefs.folderId, set: (id) => void updatePrefs(activeRow.id, { folderId: id }) }
    : groupRow
      ? { id: groupRow.folderId, set: (id) => void updateGroupPref(groupRow.id, { folderId: id }) }
      : null;
  const folderDialog = (
    <Layer open={folderMgr} onClose={() => (setFolderMgr(false), setRenaming(null))} variant="dialog" label={t("folders")} width="max-w-[400px]">
      <DialogHead title={t("folders")} onClose={() => (setFolderMgr(false), setRenaming(null))} locale={locale} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void addFolder();
        }}
        className="flex gap-2 px-3 pb-2 pt-1"
      >
        {/* Telefonda oyna ochilganda klaviatura o'zi chiqib ketmasin (ko'pincha papka tanlash uchun ochiladi) */}
        <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} maxLength={24} placeholder={t("newFolderPh")} aria-label={t("folderName")} data-autofocus-skip={isPhone ? "" : undefined} className="field h-10 min-w-0 flex-1 !rounded-[10px] text-[13.5px] max-md:text-[16px]" />
        <button type="submit" disabled={!newFolder.trim()} className="btn-accent h-10 shrink-0 rounded-full px-4 text-[12.5px] font-semibold disabled:opacity-50">
          {t("add")}
        </button>
      </form>
      {folders.length === 0 ? (
        <p className="px-4 pb-4 text-[12.5px] leading-relaxed text-fg-3">{t("noFolders")}</p>
      ) : (
        <ul className="max-h-[46vh] overflow-y-auto px-1 pb-2">
          {folders.map((f, i) =>
            renaming?.id === f.id ? (
              <li key={f.id}>
                <form
                  className="flex items-center gap-2 px-2 py-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveFolderName(f.id, renaming.name);
                  }}
                >
                  <Folder size={15} className="shrink-0 text-fg-3" aria-hidden="true" />
                  <input
                    autoFocus
                    value={renaming.name}
                    maxLength={24}
                    aria-label={t("renameFolder")}
                    onChange={(e) => setRenaming({ id: f.id, name: e.target.value })}
                    onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), setRenaming(null))}
                    onBlur={() => void saveFolderName(f.id, renaming.name)}
                    className="field h-10 min-w-0 flex-1 !rounded-[10px] text-[13.5px] max-md:text-[16px]"
                  />
                  <button type="submit" aria-label={t("save")} className={iconBtn}>
                    <Check size={15} />
                  </button>
                </form>
              </li>
            ) : (
              <li key={f.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (!folderTarget) return;
                    folderTarget.set(folderTarget.id === f.id ? null : f.id);
                    setFolderMgr(false);
                  }}
                  disabled={!folderTarget}
                  aria-pressed={folderTarget ? folderTarget.id === f.id : undefined}
                  className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13.5px] text-fg transition enabled:hover:bg-fg/5 disabled:cursor-default", folderTarget?.id === f.id && "bg-fg/5 font-semibold")}
                >
                  <Folder size={15} className="shrink-0 text-fg-3" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate" data-no-auto>
                    {f.name}
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-fg-4">{folderTarget?.id === f.id ? "✓" : f.count}</span>
                </button>
                <button type="button" disabled={i === 0} onClick={() => void moveFolderRow(f.id, "up")} aria-label={`${f.name} — ${t("folderUp")}`} className={cn(iconBtn, "w-8 disabled:opacity-25")}>
                  <ArrowUp size={14} />
                </button>
                <button type="button" disabled={i === folders.length - 1} onClick={() => void moveFolderRow(f.id, "down")} aria-label={`${f.name} — ${t("folderDown")}`} className={cn(iconBtn, "w-8 disabled:opacity-25")}>
                  <ArrowDown size={14} />
                </button>
                <button type="button" onClick={() => setRenaming({ id: f.id, name: f.name })} aria-label={`${f.name} — ${t("renameFolder")}`} className={cn(iconBtn, "w-9")}>
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={() => void removeFolder(f)} aria-label={`${f.name} — ${t("remove")}`} className={cn(iconBtn, "w-9 hover:text-danger-text")}>
                  <Trash2 size={14} />
                </button>
              </li>
            ),
          )}
        </ul>
      )}
      {!folderTarget && folders.length > 0 && <p className="px-4 pb-4 text-[12px] leading-relaxed text-fg-4">{t("folderOpenFirst")}</p>}
    </Layer>
  );

  // To'liq ekranli qobiq (telefon): chat ochiq — yuqori/pastki panel yashirin, yozish maydoni pastda
  const fullCls = "fixed inset-0 z-[60] flex h-dvh flex-col bg-bg pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]";
  const root = (
    <div
      ref={rootRef}
      // Ro'yxat ustuni Telegram'dagidek keng (ichida 76px tur-ustuni ham bor) — ismlar kesilib qolmasin.
      // Balandlik: o'lchangan bo'sh joy (QA B1); o'lchanguncha — CSS zaxira qiymati
      className="grid grid-cols-1 gap-3 lg:h-[calc(100dvh-130px)] lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)] max-lg:h-[calc(100dvh-8.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-lg:min-h-[320px]"
      style={avail ? { height: avail } : undefined}
    >
      {/* Ro'yxat doim shu yerda qoladi (telefonda chat ochilganda faqat yashiriladi) — qaytilganda aylanish o'rni saqlanadi */}
      {listPanel}
      {/* Telefonda ochiq chat: brauzer aniqlanguncha CSS bilan to'liq ekran skelet, keyin — body'ga portal */}
      {!fullscreen && (open && !ready ? <div className="contents max-lg:fixed max-lg:inset-0 max-lg:z-[60] max-lg:flex max-lg:h-dvh max-lg:flex-col max-lg:bg-bg max-lg:pb-[env(safe-area-inset-bottom)] max-lg:pt-[env(safe-area-inset-top)]">{panel}</div> : panel)}
    </div>
  );

  return (
    <>
      {/* /yozish/<taxallus> ochilmadi: sabab ko'rinib turadi (ilgari jimgina ro'yxatga qaytarardi) */}
      {noticeText && (
        <div role="alert" className="expand-in mb-3 flex items-center gap-2.5 rounded-[14px] border border-line bg-surface-2 py-2 pl-3.5 pr-1.5 text-[13.5px] text-fg">
          <UserX size={17} className="shrink-0 text-danger-text" aria-hidden="true" />
          <p className="min-w-0 flex-1 py-1 leading-snug">{noticeText}</p>
          {notice === "topilmadi" && (
            <button type="button" onClick={() => (setNotice(null), setNewChat(true))} className="h-10 shrink-0 rounded-full border border-line px-3.5 text-[12.5px] font-semibold text-fg transition hover:border-fg max-sm:hidden">
              {t("newChat")}
            </button>
          )}
          <button type="button" onClick={() => setNotice(null)} aria-label={t("noticeClose")} className={iconBtn}>
            <X size={15} />
          </button>
        </div>
      )}
      {root}
      {fullscreen &&
        createPortal(
          // Klaviatura ochiq (iOS): balandlik = ko'rinadigan maydon, pastki safe-area klaviatura ostida qolgani uchun 0
          <div className={fullCls} style={vv ? { height: vv.height, top: vv.offsetTop, paddingBottom: 0 } : undefined}>
            {panel}
          </div>,
          document.body,
        )}
      {rowMenuLayer}
      {folderDialog}
      <NewChatDialog
        open={newChat}
        onClose={() => setNewChat(false)}
        onOpen={(id) => {
          setNewChat(false);
          openConv(id);
        }}
      />
    </>
  );
}
