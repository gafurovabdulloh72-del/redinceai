"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, Check, ChevronRight, Eye, Film, ImagePlus, Link2, Loader2, MessageCircle, MoreHorizontal, Pencil, Pin, PinOff, Send, SmilePlus, Trash2, X } from "lucide-react";
import { CommentsSheet } from "@/components/reels/CommentsSheet";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EmojiSticker } from "@/components/social/EmojiSticker";
import { SafeImage } from "@/components/specialists/SafeImage";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { usePresence } from "@/components/motion/usePresence";
import { Lightbox } from "@/components/groups/PostParts";
import type { Page } from "@/components/groups/GroupFeed";
import { clock, dayKey, dayLabel } from "@/lib/chat/time";
import { POST_BODY_MAX, REACTIONS, type ReactionKind } from "@/lib/groups/limits";
import type { PostView } from "@/lib/groups/service";
import { cn, compactCount } from "@/lib/utils";
import { isImageAttachment, isVideoAttachment, uploadAttachment, type Attachment } from "./attachments";
import { GroupAvatar, Layer, MenuDivider, MenuItem, type LayerAnchor } from "./DmPanels";
import { Linkified, useNowTick } from "./MessageParts";
import { useChatStream } from "./useChatStream";
import { useStickyBottom } from "./useStickyBottom";

/**
 * KANAL = TELEGRAM (2026-11-02, foydalanuvchi so'rovi «dizayn telegramdagidek bo'lsin»):
 * kanal postlari ijtimoiy karta emas — Telegram kanalidagidek XABAR-PUFAKCHALAR:
 * xronologik tartib (eski tepada, oxirgisi pastda, ochilganda pastga tushadi), sana ajratgichlari,
 * pufakcha ichida media + izoh + reaksiya pill'lari + 👁 ko'rishlar + vaqt; izohlar CommentsSheet'da.
 * Egasi/admin uchun pastda Telegram uslubidagi yozish paneli (matn + rasm/video biriktirish).
 *
 * 2026-11-10 (QA A12, A18, B3, B5, C4): ochilganda ENG YANGI postda turadi (rasmlar yuklangach ham), yangi post ochiq
 * kanalga jonli keladi (SSE `posts` + 30 s zaxira), uzun so'z/havola pufakchadan chiqmaydi va havolalar bosiladi,
 * yozish maydoni matnga qarab o'sadi (sensorli klaviaturada Enter — yangi qator), kun yorlig'i «Bugun/Kecha» (Toshkent
 * vaqti — DM/guruh bilan bir xil), pufakcha «⋯» menyusi: qadash · tahrirlash · havola · o'chirish (boshqaruvchi/muallif).
 */

type ApiResp<T> = { ok: boolean; data?: T; error?: string; fields?: Record<string, string> };

const T = {
  older: { uz: "Oldingi postlar", ru: "Предыдущие посты" },
  empty: { uz: "Kanal e'lonlari shu yerda chiqadi", ru: "Посты канала появятся здесь" },
  composer: { uz: "Kanal e'loni…", ru: "Пост канала…" },
  edited: { uz: "tahrirlangan", ru: "изменено" },
  comments: { uz: "ta izoh", ru: "комм." },
  leaveComment: { uz: "Izoh qoldirish", ru: "Оставить комментарий" },
  pinned: { uz: "Qadalgan xabar", ru: "Закреплённое сообщение" },
  sendErr: { uz: "Yuborilmadi", ru: "Не отправлено" },
  send: { uz: "Yuborish", ru: "Отправить" },
  save: { uz: "Saqlash", ru: "Сохранить" },
  attach: { uz: "Rasm yoki video biriktirish", ru: "Прикрепить фото или видео" },
  removeFile: { uz: "Olib tashlash", ru: "Убрать" },
  addReaction: { uz: "Reaksiya qo'shish", ru: "Добавить реакцию" },
  postMenu: { uz: "Post amallari", ru: "Действия с постом" },
  pin: { uz: "Qadash", ru: "Закрепить" },
  unpin: { uz: "Qadoqdan olish", ru: "Открепить" },
  edit: { uz: "Tahrirlash", ru: "Изменить" },
  editing: { uz: "Post tahrirlanmoqda", ru: "Редактирование поста" },
  cancelEdit: { uz: "Tahrirni bekor qilish", ru: "Отменить редактирование" },
  copyLink: { uz: "Havolani nusxalash", ru: "Копировать ссылку" },
  copied: { uz: "Havola nusxalandi", ru: "Ссылка скопирована" },
  del: { uz: "O'chirish", ru: "Удалить" },
  delQ: { uz: "Post o'chirilsinmi?", ru: "Удалить пост?" },
  delText: { uz: "Post, uning izohlari va reaksiyalari butunlay o'chadi. Qaytarib bo'lmaydi.", ru: "Пост, комментарии и реакции будут удалены безвозвратно." },
  deleted: { uz: "Post o'chirildi", ru: "Пост удалён" },
  pinnedOk: { uz: "Post qadaldi", ru: "Пост закреплён" },
  unpinnedOk: { uz: "Qadoqdan olindi", ru: "Пост откреплён" },
  saved: { uz: "Saqlandi", ru: "Сохранено" },
  fail: { uz: "Bajarilmadi", ru: "Не выполнено" },
  newPosts: { uz: "yangi post", ru: "новых постов" },
  toLatest: { uz: "Oxirgi postga", ru: "К последнему посту" },
  openImage: { uz: "Rasmni ochish", ru: "Открыть изображение" },
  photo: { uz: "Rasm", ru: "Фото" },
  video: { uz: "Video", ru: "Видео" },
  tooLong: { uz: "Matn juda uzun", ru: "Текст слишком длинный" },
} as const;

const sortChrono = (l: PostView[]) => [...l].sort((a, b) => a.createdAt - b.createdAt);

export function ChannelPosts({
  groupId,
  slug,
  canPost,
  canManage = false,
  canInteract,
  viewerId = null,
  loggedIn,
  initial,
  highlightId = null,
  channelName,
  channelAvatar,
  onActivity,
}: {
  /** groups.id — «o'qildi» belgisi uchun (chat ro'yxatidagi nishon) */
  groupId: string;
  slug: string;
  canPost: boolean;
  /** Egasi/admin — postni qadash va o'chirish */
  canManage?: boolean;
  canInteract: boolean;
  viewerId?: string | null;
  loggedIn: boolean;
  initial: Page;
  highlightId?: string | null;
  /** Pufakcha yonidagi avatar va imzo uchun (Telegram'dagidek) */
  channelName?: string;
  channelAvatar?: string | null;
  /** Postlar o'qildi / yangisi keldi — chat ro'yxati yangilansin */
  onActivity?: () => void;
}) {
  const til = useLocale();
  const { toast } = useToast();
  const confirm = useConfirm();
  const now = useNowTick(60_000);
  // Telegram tartibi: qat'iy xronologik (API qadalganni birinchi beradi — bu yerda sof vaqt bo'yicha)
  const [items, setItems] = useState<PostView[]>(() => sortChrono(initial.items));
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [commentsOf, setCommentsOf] = useState<string | null>(null);
  /** Qaysi post uchun reaksiya tanlagich ochiq (SmilePlus) */
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; anchor: LayerAnchor } | null>(null);
  const [viewer, setViewer] = useState<{ items: Attachment[]; index: number } | null>(null);
  const [newCount, setNewCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(!highlightId);
  const didInit = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const base = `/api/groups/${encodeURIComponent(slug)}/posts`;
  const newPill = usePresence(newCount > 0, 180);

  useStickyBottom(scrollRef, stick);

  // Ota komponent har chizilganda yangi funksiya beradi — ref orqali chaqiriladi (aks holda zaxira polling taymeri har safar qaytadan boshlanardi)
  const activityRef = useRef(onActivity);
  activityRef.current = onActivity;

  /** Kanal o'qildi (a'zo): chat ro'yxatidagi nishon tushadi */
  const markRead = useCallback(() => {
    if (!canInteract) return;
    void fetch(`/api/chat/guruh/${encodeURIComponent(groupId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }) })
      .then(() => activityRef.current?.())
      .catch(() => undefined);
  }, [canInteract, groupId]);

  // Ochilganda pastga (oxirgi postga) yoki deep-link postga tushamiz; kanal o'qilgan deb belgilanadi
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const el = scrollRef.current;
    if (!el) return;
    if (highlightId) {
      const t = el.querySelector(`[data-post="${CSS.escape(highlightId)}"]`);
      if (t) {
        t.scrollIntoView({ block: "center" });
        return;
      }
      stick.current = true;
    }
    el.scrollTop = el.scrollHeight;
    markRead();
  }, [highlightId, markRead]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stick.current = bottom;
    if (bottom && newCount > 0) {
      setNewCount(0);
      markRead();
    }
  };
  const toBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    stick.current = true;
    setNewCount(0);
    markRead();
  };

  /**
   * Birinchi sahifani qayta o'qib ro'yxat bilan birlashtirish: yangi postlar qo'shiladi, o'zgarganlari (matn, qadoq,
   * hisoblagichlar) yangilanadi, shu oynada turib o'chirilganlari olib tashlanadi. Eskiroq yuklangan sahifalarga tegilmaydi.
   */
  const refresh = useCallback(
    async (opts: { own?: boolean } = {}) => {
      const j = (await fetch(base, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null)) as ApiResp<Page> | null;
      if (!j?.ok || !j.data) return;
      const fresh = j.data.items;
      const cur = itemsRef.current;
      const have = new Set(cur.map((p) => p.id));
      const byId = new Map(fresh.map((p) => [p.id, p]));
      // Birinchi sahifa = qadalganlar (3 tagacha, eski bo'lishi mumkin) + eng yangi qadalmaganlar. «Oyna» — qadalmaganlar
      // oralig'i: shu oraliqda turib javobda yo'q post o'chirilgan; undan eskilari (ilgari yuklangan sahifalar) saqlanadi.
      // Eskiroq sahifa qolmagan bo'lsa (nextCursor yo'q) — javobda yo'q har qanday post o'chirilgan.
      const windowStart = j.data.nextCursor === null ? Number.NEGATIVE_INFINITY : fresh.filter((p) => !p.isPinned).reduce((m, p) => Math.min(m, p.createdAt), Number.POSITIVE_INFINITY);
      const kept = cur
        .filter((p) => byId.has(p.id) || p.createdAt < windowStart)
        // Javobda yo'q, lekin bizda «qadalgan» turgan eski post — boshqa boshqaruvchi qadoqdan olgan
        .map((p) => byId.get(p.id) ?? (p.isPinned ? { ...p, isPinned: false } : p));
      const added = fresh.filter((p) => !have.has(p.id));
      setItems(sortChrono([...kept, ...added]));
      if (cur.length === 0 || j.data.nextCursor === null) setCursor(j.data.nextCursor);
      const incoming = added.filter((p) => p.author.id !== viewerId).length;
      if (opts.own || stick.current) {
        stick.current = true;
        if (incoming > 0 || opts.own) markRead();
      } else if (incoming > 0) setNewCount((n) => n + incoming);
    },
    [base, viewerId, markRead],
  );

  // Jonli yangilanish: a'zoga SSE `posts` hodisasi; zaxira — 30 s (tab ko'rinib turganda)
  const live = useChatStream({ group: slug, only: "group", enabled: canInteract, onPosts: () => void refresh() });
  const liveRef = useRef(live);
  liveRef.current = live;
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden && !liveRef.current) void refresh();
    }, 30_000);
    const onVis = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  async function loadOlder() {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const prevH = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    stick.current = false;
    try {
      const j = (await (await fetch(`${base}?cursor=${cursor}`)).json()) as ApiResp<Page>;
      if (j.ok && j.data) {
        const older = j.data.items;
        setItems((l) => {
          const have = new Set(l.map((p) => p.id));
          return sortChrono([...older.filter((p) => !have.has(p.id)), ...l]);
        });
        setCursor(j.data.nextCursor);
        // Scroll o'rni saqlanadi (Telegram'dagidek)
        requestAnimationFrame(() => {
          if (el) el.scrollTop = prevTop + (el.scrollHeight - prevH);
        });
      }
    } finally {
      setLoadingOlder(false);
    }
  }

  async function react(p: PostView, kind: ReactionKind) {
    if (!canInteract) return;
    const prev = items;
    setItems((l) =>
      l.map((x) => {
        if (x.id !== p.id) return x;
        const r = { ...x.reactions };
        if (x.myReaction) r[x.myReaction] = Math.max(0, (r[x.myReaction] ?? 1) - 1);
        const next = x.myReaction === kind ? null : kind;
        if (next) r[next] = (r[next] ?? 0) + 1;
        return { ...x, myReaction: next, reactions: r, likesCount: Math.max(0, x.likesCount + (next ? 1 : 0) - (x.myReaction ? 1 : 0)) };
      }),
    );
    const res = await fetch(`/api/posts/${encodeURIComponent(p.id)}/like`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reaction: kind }) }).catch(() => null);
    if (!res?.ok) setItems(prev);
  }

  /* ---------- Egasi uchun Telegram uslubidagi yozish paneli ---------- */
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<PostView | null>(null);
  const [coarse, setCoarse] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setCoarse(window.matchMedia("(pointer: coarse)").matches), []);
  // Yozish maydoni matnga qarab o'sadi (128px gacha) — ilgari bir qator balandlikda qolardi
  useEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [draft, editing]);

  async function attach(list: FileList | null) {
    const picked = Array.from(list ?? []).slice(0, Math.max(0, 4 - files.length));
    if (!picked.length || uploading) return;
    setUploading(true);
    try {
      for (const f of picked) {
        const a = await uploadAttachment(f, { docs: true });
        if (!isImageAttachment(a) && !isVideoAttachment(a)) throw new Error(T.sendErr[til]);
        setFiles((l) => (l.length < 4 ? [...l, a] : l));
      }
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : T.sendErr[til], "error");
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    const body = draft.trim();
    if (sending || uploading) return;
    if (body.length > POST_BODY_MAX) return toast(T.tooLong[til], "error");
    if (editing) {
      if (!body) return;
      setSending(true);
      try {
        const res = await fetch(`/api/posts/${encodeURIComponent(editing.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
        const j = (await res.json().catch(() => null)) as ApiResp<{ body: string }> | null;
        if (!res.ok || !j?.ok) throw new Error((j?.fields && Object.values(j.fields)[0]) || j?.error || T.fail[til]);
        setItems((l) => l.map((x) => (x.id === editing.id ? { ...x, body, edited: true } : x)));
        setEditing(null);
        setDraft("");
        toast(T.saved[til], "success");
      } catch (e) {
        toast(e instanceof Error && e.message ? e.message : T.fail[til], "error");
      } finally {
        setSending(false);
      }
      return;
    }
    if (!body && files.length === 0) return;
    setSending(true);
    try {
      const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, media: files }) });
      const j = (await res.json().catch(() => null)) as ApiResp<{ id: string }> | null;
      if (!res.ok || !j?.ok) throw new Error((j?.fields && Object.values(j.fields)[0]) || j?.error || T.sendErr[til]);
      setDraft("");
      setFiles([]);
      // API faqat {id} qaytaradi — birinchi sahifa qayta o'qilib ro'yxat bilan birlashtiriladi
      await refresh({ own: true });
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : T.sendErr[til], "error");
    } finally {
      setSending(false);
    }
  }

  /* ---------- Post amallari (C4): qadash · tahrirlash · havola · o'chirish ---------- */
  const openPost = menu ? (items.find((p) => p.id === menu.id) ?? null) : null;
  // Menyu yopilish animatsiyasi paytida bandlar yo'qolib qolmasin — oxirgi ochilgan post bilan chiziladi
  const lastMenuPost = useRef<PostView | null>(null);
  if (openPost) lastMenuPost.current = openPost;
  const menuPost = openPost ?? lastMenuPost.current;
  async function togglePin(p: PostView) {
    const next = !p.isPinned;
    const res = await fetch(`/api/posts/${encodeURIComponent(p.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPinned: next }) }).catch(() => null);
    const j = res ? ((await res.json().catch(() => null)) as ApiResp<unknown> | null) : null;
    if (!res?.ok || !j?.ok) return toast(j?.error ?? T.fail[til], "error");
    // Telegram kabi bitta qadalgan panel: yangisi qadalganda eskisi paneldan tushadi (serverda ham bitta ko'rsatiladi)
    setItems((l) => l.map((x) => (x.id === p.id ? { ...x, isPinned: next } : x)));
    toast(next ? T.pinnedOk[til] : T.unpinnedOk[til], "info");
  }
  async function removePost(p: PostView) {
    if (!(await confirm({ title: T.delQ[til], text: T.delText[til], confirmLabel: T.del[til], danger: true }))) return;
    const res = await fetch(`/api/posts/${encodeURIComponent(p.id)}`, { method: "DELETE" }).catch(() => null);
    const j = res ? ((await res.json().catch(() => null)) as ApiResp<unknown> | null) : null;
    if (!res?.ok || !j?.ok) return toast(j?.error ?? T.fail[til], "error");
    setItems((l) => l.filter((x) => x.id !== p.id));
    if (editing?.id === p.id) (setEditing(null), setDraft(""));
    toast(T.deleted[til], "info");
    activityRef.current?.();
  }
  async function copyLink(p: PostView) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/jamoalar/${slug}?post=${p.id}`);
      toast(T.copied[til], "success");
    } catch {
      toast(T.fail[til], "error");
    }
  }
  function startEdit(p: PostView) {
    setEditing(p);
    setDraft(p.body);
    window.setTimeout(() => draftRef.current?.focus(), 40);
  }

  // Qadalgan post — Telegram'dagidek tepada yupqa panel, bosilsa postga scroll (bir nechta bo'lsa — eng yangisi)
  const pinned = [...items].reverse().find((p) => p.isPinned) ?? null;
  const [flashId, setFlashId] = useState<string | null>(null);
  const jumpTo = (id: string) => {
    stick.current = false;
    scrollRef.current?.querySelector(`[data-post="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(id);
    window.setTimeout(() => setFlashId((v) => (v === id ? null : v)), 1600);
  };

  let lastDay = "";
  return (
    <>
      {pinned && (
        <button type="button" onClick={() => jumpTo(pinned.id)} className="flex min-h-12 w-full shrink-0 items-center gap-2.5 border-b border-line bg-bg px-3.5 py-2 text-left transition hover:bg-fg/4">
          <span className="h-8 w-0.5 shrink-0 rounded-full bg-accent" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold text-accent-text">{T.pinned[til]}</span>
            <span className="block truncate text-[12.5px] text-fg-2" data-no-auto>
              {pinned.body || (pinned.media.some((x) => x.type?.startsWith("video")) ? T.video[til] : T.photo[til])}
            </span>
          </span>
          <Pin size={14} className="shrink-0 text-fg-4" aria-hidden />
        </button>
      )}
      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className="tg-chat-bg h-full overflow-y-auto overscroll-contain px-3 py-4 sm:px-5" onClick={() => pickerFor && setPickerFor(null)}>
          <div className="mx-auto flex max-w-[560px] flex-col gap-2.5">
            {cursor && (
              <button type="button" onClick={() => void loadOlder()} disabled={loadingOlder} className="tg-bubble mx-auto mb-1 inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold text-fg-3 shadow-sm transition hover:text-fg disabled:opacity-60">
                {loadingOlder && <Loader2 size={12} className="animate-spin" />} {T.older[til]}
              </button>
            )}
            {items.length === 0 && <p className="py-16 text-center text-[13.5px] text-fg-3">{T.empty[til]}</p>}
            {items.map((p) => {
              const dk = dayKey(p.createdAt);
              const sep = dk !== lastDay;
              lastDay = dk;
              let reacted = (Object.entries(p.reactions) as Array<[ReactionKind, number]>).filter(([, n]) => n > 0);
              // Eski postlarda taqsimot bo'sh, faqat umumiy son bor — ❤ sifatida ko'rsatamiz
              if (reacted.length === 0 && p.likesCount > 0) reacted = [["heart", p.likesCount]];
              const images = p.media.filter((x) => !x.type?.startsWith("video"));
              return (
                <div key={p.id} data-post={p.id} className="flex flex-col">
                  {sep && <span className="tg-bubble mx-auto my-2.5 rounded-full px-3 py-1 text-[12px] font-semibold text-fg-2 shadow-sm">{dayLabel(p.createdAt, til, now)}</span>}
                  {/* Telegram'dagidek: chapda kanal avatari (pastga tekis) + pufakcha */}
                  <div className="flex items-end gap-2">
                    <span className="mb-0.5 shrink-0">
                      <GroupAvatar name={channelName ?? p.author.name} coverUrl={channelAvatar} kind="channel" size={32} />
                    </span>
                    {/* Pufakcha — Telegram kanal xabari. min-w-0: uzun so'z/havola qatorni kengaytirmasin (matn o'zi sinadi) */}
                    <div className="min-w-0 flex-1">
                      <div className={cn("tg-bubble relative w-fit min-w-[min(220px,100%)] max-w-[min(440px,100%)] overflow-hidden rounded-[16px] rounded-bl-[6px] shadow-sm transition-shadow", (highlightId === p.id || flashId === p.id) && "ring-2 ring-accent/60")}>
                        {p.media.length > 0 && (
                          <div className={cn("grid gap-0.5", p.media.length > 1 && "grid-cols-2")}>
                            {p.media.slice(0, 4).map((m, i) =>
                              m.type?.startsWith("video") ? (
                                <video key={i} src={m.url} poster={m.poster} controls playsInline preload="metadata" className="max-h-[420px] w-full bg-black object-contain" />
                              ) : (
                                <button key={i} type="button" onClick={() => setViewer({ items: images, index: Math.max(0, images.indexOf(m)) })} aria-label={T.openImage[til]} className="block w-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-fg">
                                  <SafeImage optimize={560} loading="eager" src={m.url} alt="" className={cn("w-full object-cover", p.media.length === 1 ? "max-h-[440px] data-[img-loading]:min-h-[180px]" : "aspect-square")} />
                                </button>
                              ),
                            )}
                          </div>
                        )}
                        {/* Muallif imzosi (Telegram'dagi rangli nom) — media'dan keyin, matndan oldin; o'ngda «⋯» menyusi */}
                        <div className="flex items-start gap-1 pl-3.5 pr-1 pt-1">
                          <p className="min-w-0 flex-1 truncate pt-1 text-[13px] font-bold text-accent-text" data-no-auto>
                            {channelName ?? p.author.name}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => setMenu(menu?.id === p.id ? null : { id: p.id, anchor: e.currentTarget })}
                            aria-haspopup="menu"
                            aria-expanded={menu?.id === p.id}
                            aria-label={T.postMenu[til]}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-4 transition hover:bg-fg/8 hover:text-fg lg:h-8 lg:w-8"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </div>
                        {p.body && (
                          <p className="whitespace-pre-line px-3.5 pb-1 text-[15px] leading-[1.45] text-fg [overflow-wrap:anywhere]">
                            <Linkified text={p.body} mentions />
                          </p>
                        )}
                        {/* Reaksiyalar qatori + ko'rishlar/vaqt (Telegram'dagidek pufakcha ichida) */}
                        <div className="relative flex flex-wrap items-center gap-1.5 px-3 pb-2.5 pt-1.5">
                          {reacted.map(([k, n]) => {
                            const def = REACTIONS.find((r) => r.key === k);
                            if (!def) return null;
                            return (
                              <button
                                key={k}
                                type="button"
                                disabled={!canInteract}
                                onClick={() => void react(p, k)}
                                aria-pressed={p.myReaction === k}
                                className={cn("inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-bold tabular-nums transition", p.myReaction === k ? "bg-accent-soft text-accent-text ring-1 ring-accent/50" : "bg-fg/7 text-fg-2 hover:bg-fg/12", !canInteract && "pointer-events-none")}
                              >
                                <EmojiSticker e={def.emoji} size={15} /> {compactCount(n)}
                              </button>
                            );
                          })}
                          {canInteract && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPickerFor(pickerFor === p.id ? null : p.id);
                              }}
                              aria-label={T.addReaction[til]}
                              aria-expanded={pickerFor === p.id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-fg-4 transition hover:bg-fg/8 hover:text-fg"
                            >
                              <SmilePlus size={16} />
                            </button>
                          )}
                          {/* Reaksiya tanlagich — 6 ta emoji (Telegram uslubi) */}
                          {pickerFor === p.id && (
                            <div className="tg-bubble pop-in absolute bottom-full left-2 z-10 mb-1 flex gap-0.5 rounded-full border border-line p-1 shadow-[var(--shadow-3)]" onClick={(e) => e.stopPropagation()}>
                              {REACTIONS.map((r) => (
                                <button
                                  key={r.key}
                                  type="button"
                                  onClick={() => {
                                    setPickerFor(null);
                                    void react(p, r.key);
                                  }}
                                  aria-label={r.label}
                                  className={cn("flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-fg/8", p.myReaction === r.key && "bg-accent-soft")}
                                >
                                  <EmojiSticker e={r.emoji} size={22} />
                                </button>
                              ))}
                            </div>
                          )}
                          <span className="ml-auto inline-flex items-center gap-2 pl-3 text-[11.5px] text-fg-4">
                            {p.isPinned && <Pin size={11} aria-label={T.pinned[til]} />}
                            {p.viewsCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Eye size={12} /> {compactCount(p.viewsCount)}
                              </span>
                            )}
                            {p.edited && <span className="italic">{T.edited[til]}</span>}
                            <time dateTime={new Date(p.createdAt).toISOString()}>{clock(p.createdAt)}</time>
                          </span>
                        </div>
                        {/* Izohlar — pufakcha ichidagi pastki qator (Telegram «Leave a comment») */}
                        <button type="button" onClick={() => setCommentsOf(p.id)} className="flex min-h-10 w-full items-center gap-2 border-t border-line/70 bg-fg/[0.03] px-3.5 py-2 text-[13px] font-semibold text-accent-text transition hover:bg-fg/6">
                          <MessageCircle size={14} />
                          <span className="flex-1 text-left">{p.commentsCount > 0 ? `${compactCount(p.commentsCount)} ${T.comments[til]}` : T.leaveComment[til]}</span>
                          <ChevronRight size={14} className="text-fg-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Yuqorida o'qiyotganda yangi post kelsa */}
        {newPill.mounted && (
          <button type="button" onClick={toBottom} aria-label={T.toLatest[til]} className={cn("btn-ink absolute bottom-3 left-1/2 flex h-10 -translate-x-1/2 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-semibold", newPill.closing ? "pop-out" : "pop-in")}>
            <ArrowDown size={14} /> {newCount} {T.newPosts[til]}
          </button>
        )}
      </div>
      {/* Egasi/admin: yozish paneli (Telegram uslubi) */}
      {canPost && (
        <div className="shrink-0 border-t border-line bg-bg p-2">
          {editing && (
            <div className="expand-in mb-2 flex items-center gap-2 rounded-[12px] border-l-[3px] border-accent bg-accent-soft/60 py-1.5 pl-3 pr-1" role="status">
              <Pencil size={14} className="shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-bold text-accent-text">{T.editing[til]}</span>
                <span className="block truncate text-[12.5px] text-fg-2" data-no-auto>
                  {editing.body}
                </span>
              </span>
              <button type="button" onClick={() => (setEditing(null), setDraft(""))} aria-label={T.cancelEdit[til]} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-fg">
                <X size={14} />
              </button>
            </div>
          )}
          {files.length > 0 && !editing && (
            <div className="mb-1.5 flex gap-1.5 px-1">
              {files.map((f, i) => (
                <span key={f.url} className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-[10px] border border-line bg-surface-2 text-fg-3">
                  {isVideoAttachment(f) ? (
                    <Film size={18} aria-label={T.video[til]} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" className="h-full w-full object-cover" />
                  )}
                  <button type="button" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} aria-label={`${f.name} — ${T.removeFile[til]}`} className="absolute right-0 top-0 grid h-6 w-6 place-items-center rounded-bl-[8px] bg-black/60 text-white">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1.5">
            {!editing && (
              <label className={cn("flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg", (uploading || files.length >= 4) && "pointer-events-none opacity-50")} aria-label={T.attach[til]} title={T.attach[til]}>
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void attach(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            <textarea
              ref={draftRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && editing) (setEditing(null), setDraft(""));
                if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                // Sensorli klaviaturada Enter — yangi qator (yuborish tugma bilan); desktopda Enter yuboradi, Shift+Enter — yangi qator
                if (coarse ? e.ctrlKey || e.metaKey : !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder={T.composer[til]}
              aria-label={editing ? T.editing[til] : T.composer[til]}
              className="field max-h-32 min-h-10 min-w-0 flex-1 resize-none !rounded-[20px] !py-2.5 text-[14px] leading-snug max-md:text-[16px]"
            />
            {draft.length > POST_BODY_MAX - 200 && <span className={cn("self-center text-[11px] tabular-nums", draft.length > POST_BODY_MAX ? "font-semibold text-danger-text" : "text-fg-4")}>{POST_BODY_MAX - draft.length}</span>}
            <button type="button" onClick={() => void send()} disabled={sending || uploading || draft.length > POST_BODY_MAX || (editing ? !draft.trim() : !draft.trim() && files.length === 0)} aria-label={editing ? T.save[til] : T.send[til]} className="btn-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40">
              {sending ? <Loader2 size={17} className="animate-spin" /> : editing ? <Check size={17} /> : <Send size={17} />}
            </button>
          </div>
        </div>
      )}
      {/* Post «⋯» menyusi: desktopda popover, telefonda pastki varaq */}
      <Layer open={Boolean(menu && openPost)} onClose={() => setMenu(null)} label={T.postMenu[til]} anchor={menu?.anchor} width="w-[230px]">
        {menuPost && (
          <>
            {canManage && <MenuItem icon={menuPost.isPinned ? PinOff : Pin} label={T[menuPost.isPinned ? "unpin" : "pin"][til]} onClick={() => (setMenu(null), void togglePin(menuPost))} />}
            {canPost && viewerId === menuPost.author.id && menuPost.body && <MenuItem icon={Pencil} label={T.edit[til]} onClick={() => (setMenu(null), startEdit(menuPost))} />}
            <MenuItem icon={Link2} label={T.copyLink[til]} onClick={() => (setMenu(null), void copyLink(menuPost))} />
            {(menuPost.canDelete || canManage) && (
              <>
                <MenuDivider />
                <MenuItem icon={Trash2} label={T.del[til]} danger onClick={() => (setMenu(null), void removePost(menuPost))} />
              </>
            )}
          </>
        )}
      </Layer>
      <Lightbox items={viewer?.items ?? []} index={viewer ? viewer.index : null} onClose={() => setViewer(null)} onIndex={(i) => setViewer((v) => (v ? { ...v, index: i } : v))} />
      {commentsOf && (
        <CommentsSheet
          postId={commentsOf}
          open
          onClose={() => setCommentsOf(null)}
          loggedIn={loggedIn}
          onCount={(n) => setItems((l) => l.map((x) => (x.id === commentsOf ? { ...x, commentsCount: n } : x)))}
        />
      )}
    </>
  );
}
