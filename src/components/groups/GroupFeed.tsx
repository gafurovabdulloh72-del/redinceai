"use client";

import { BuyButton } from "@/components/mentorship/PurchaseDialog";
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import Link from "next/link";
import { AtSign, BadgeCheck, BarChart3, CalendarClock, Clock, FolderPlus, MapPin, Music2, Copy, CornerDownRight, ExternalLink, EyeOff, Heart, ImagePlus, Link2, MessageCircle, Pencil, Pin, PinOff, Radio, RadioTower, Send, Trash2, UserRoundX, UsersRound, X } from "lucide-react";
import { firstUrl, RichText } from "./RichText";
import { MentionField } from "./MentionInput";
import { postPermalink, ReactionButton, ReactorsButton, SaveButton, ShareAction, type ReactionState } from "./Reactions";
import { LinkPreviewCard, MediaGrid, PollBlock, PostMenu, type MenuItem } from "./PostParts";
import { FollowButton } from "./FollowButton";
import { ReportButton } from "@/components/specialists/ReportButton";
import { useViewTracker } from "./useViewTracker";
import { CalendarLinks } from "./CalendarLinks";
import { useToast } from "@/components/ui/toast";
import { usePresence } from "@/components/motion/usePresence";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { Avatar, Button, Spinner } from "@/components/ui";
import { SafeImage } from "@/components/specialists/SafeImage";
import { FeedEmpty, LoadMore, RelativeTime, untilTime, useNow, useRequireLogin, withQuery } from "@/components/feed/shared";
import { VideoCoverPicker } from "@/components/ui/VideoCoverPicker";
import { CollectionSheet } from "@/components/social/CollectionSheet";
import { PostStatsSheet } from "@/components/social/PostStatsSheet";
import { AudiencePicker, PlaceField, SchedulePicker, TagPeopleSheet, type TaggedUser } from "@/components/social/PostExtras";
import { captureVideoPoster, isVideoAttachment, uploadAttachment, type Attachment } from "@/components/chat/attachments";
import { MusicPicker, QuotaLine, useQuota, type MusicDraft } from "@/components/stories/StoryComposer";
import { MusicChip } from "@/components/social/MusicChip";
import { COMMENT_MAX, POLL_OPTIONS_MAX, POLL_OPTIONS_MIN, POLL_OPTION_MAX, POST_BODY_MAX, POST_MEDIA_MAX } from "@/lib/groups/limits";
import type { PostView, UserBrief } from "@/lib/groups/service";
import type { CommentViewX, PollView } from "@/lib/groups/posts-extra";
import { tr } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import { cn, formatDateTime } from "@/lib/utils";

type Page = { items: PostView[]; nextCursor: number | null };
type ApiResp<T> = { ok: boolean; data?: T; error?: string; fields?: Record<string, string> };

/** Lenta manbai (jamoa/kanal chipi) */
export interface PostSource {
  slug: string;
  name: string;
  kind: "group" | "channel";
  isOfficial: boolean;
}
/** PostView + lenta qo'shimchalari (bosh sahifa `FeedItem` beradi; jamoa/profil lentasi — faqat PostView) */
export type FeedPostView = PostView & { poll?: PollView | null; editedAt?: number | null; followingAuthor?: boolean | null; group?: PostSource | null };

/** Postga faqat rasm yoki video (hujjat emas) */
const POST_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";
const MEDIA_EXT = /\.(?:jpe?g|png|webp|gif|mp4|webm|mov)$/i;

function AuthorLink({ u, className }: { u: UserBrief; className?: string }) {
  const inner = <span className={cn("truncate font-semibold text-fg", className)}>{u.name}</span>;
  return u.slug ? (
    <Link href={`/mutaxassislar/${u.slug}`} className="min-w-0 underline-offset-2 hover:underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/**
 * Jamoa lentasi: kompozitor (a'zolar uchun), postlar (like/izoh/o'chirish), cursor bo'yicha «Yana».
 * `highlightId` — bildirishnomadan kelganda (?post=) shu post ochiq izohlar bilan ko'rsatiladi.
 * Yangi post yuborilgach to'liq qayta yuklanmaydi — `GET /api/posts/[id]` bilan faqat shu post tepaga qo'shiladi.
 */
export function GroupFeed({
  slug,
  kind = "group",
  canPost,
  canInteract,
  canSchedule = false,
  allowSubOnly = false,
  loggedIn,
  initial,
  highlightId = null,
  apiBase,
  composerPlaceholder,
}: {
  slug: string;
  kind?: "group" | "channel";
  /** Post yoza oladimi (guruhda a'zo, kanalda egasi/admin) */
  canPost: boolean;
  /** Yoqtirish/izoh — faol a'zo */
  canInteract: boolean;
  /** Efir/yig'ilish e'lon qila oladimi (egasi/admin) */
  canSchedule?: boolean;
  allowSubOnly?: boolean;
  loggedIn: boolean;
  initial: Page;
  highlightId?: string | null;
  /** Boshqa manba (profil postlari: /api/profil/postlar?user=) — berilsa slug ishlatilmaydi */
  apiBase?: string;
  composerPlaceholder?: string;
}) {
  const til = useLocale();
  const { toast } = useToast();
  const requireLogin = useRequireLogin(loggedIn);
  const [items, setItems] = useState<FeedPostView[]>(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const base = apiBase ?? `/api/groups/${encodeURIComponent(slug)}/posts`;

  const reload = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      const j = (await res.json()) as ApiResp<Page>;
      if (!j.ok || !j.data) throw new Error(j.error);
      setItems(j.data.items);
      setCursor(j.data.nextCursor);
    } catch {
      toast(tr(til, FEED.loadFailed), "error");
    }
  }, [base, toast, til]);

  /** Yangi post: id bo'lsa faqat shu post olinib tepaga qo'shiladi (sahifa va aylantirish joyi saqlanadi) */
  const onPosted = useCallback(
    async (id?: string) => {
      if (id) {
        try {
          const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, { cache: "no-store" });
          const j = (await res.json()) as ApiResp<FeedPostView>;
          if (j.ok && j.data) {
            const item = j.data;
            setItems((prev) => [item, ...prev.filter((p) => p.id !== id)]);
            return;
          }
        } catch {}
      }
      await reload();
    },
    [reload],
  );

  async function loadMore() {
    if (!cursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const res = await fetch(withQuery(base, { cursor }), { cache: "no-store" });
      const j = (await res.json()) as ApiResp<Page>;
      if (!j.ok || !j.data) throw new Error(j.error);
      const more = j.data.items;
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...more.filter((p) => !seen.has(p.id))];
      });
      setCursor(j.data.nextCursor);
    } catch {
      setLoadError(tr(til, FEED.loadFailed));
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }

  return (
    <div className="stagger grid gap-4">
      {canPost ? (
        <Composer base={base} onPosted={onPosted} allowEvent={canSchedule} allowSubOnly={allowSubOnly} kind={kind} placeholder={composerPlaceholder} />
      ) : canInteract && kind === "channel" ? (
        <p className="px-1 text-[13px] text-fg-3">Kanalga faqat adminlar yozadi — yoqtirish va izoh mumkin.</p>
      ) : (
        <p className="px-1 text-[13px] text-fg-3">{kind === "channel" ? "Izoh va reaksiya uchun kanalga qo'shiling." : "Yozish uchun guruhga qo'shiling."}</p>
      )}
      {items.length === 0 ? (
        <FeedEmpty icon={<MessageCircle size={20} />} title="Lenta hali bo'sh" text={canPost ? "Birinchi postni siz yozing." : kind === "channel" ? "Kanal e'lonlari shu yerda chiqadi." : "A'zolar postlari shu yerda chiqadi."} />
      ) : (
        items.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            canInteract={canInteract}
            canPin={canSchedule}
            loggedIn={loggedIn}
            requireLogin={requireLogin}
            highlighted={p.id === highlightId}
            groupSlug={apiBase ? null : slug}
            onDeleted={() => setItems((prev) => prev.filter((x) => x.id !== p.id))}
            onChanged={reload}
          />
        ))
      )}
      {cursor && <LoadMore onLoad={() => void loadMore()} loading={loadingMore} error={loadError} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kompozitor                                                          */
/* ------------------------------------------------------------------ */
/** datetime-local qiymati → ms (mahalliy vaqt) */
function localToMs(v: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}
const draftKey = (base: string) => `kv-draft:${base}`;

/**
 * Post kompozitori: fokusgacha bir qatorli, fokusda kengayadi; qoralama localStorage'da; rasm/video (tanlash, paste, drop);
 * ixtiyoriy so'rovnoma (2–4 variant) va efir e'loni; Ctrl/⌘+Enter yuboradi. `onPosted(id)` — yangi post id'si bilan.
 */
export function Composer({
  base,
  onPosted,
  allowEvent = false,
  allowPoll = false,
  allowSubOnly = false,
  kind = "group",
  placeholder,
  collapsible = true,
}: {
  base: string;
  /** Mentor kanali (obuna narxi bor): «faqat obunachilar uchun» belgisi */
  allowSubOnly?: boolean;
  onPosted: (id?: string) => Promise<void> | void;
  allowEvent?: boolean;
  /** So'rovnoma qo'shish imkoni (post joylangach POST /api/posts/[id]/poll) */
  allowPoll?: boolean;
  kind?: "group" | "channel";
  placeholder?: string;
  /** Fokusgacha bir qatorli ko'rinish */
  collapsible?: boolean;
}) {
  const til = useLocale();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<Attachment[]>([]);
  // Muqova tanlash: yuklangan videoning lokal nusxasi (CORS'siz kadr olish uchun)
  const localVideo = useRef(new Map<string, string>());
  const [coverIdx, setCoverIdx] = useState<number | null>(null);
  // Instagram qo'shimchalari: auditoriya, joy, belgilangan odamlar, rejalashtirish
  const [audience, setAudience] = useState<"public" | "close">("public");
  const [placeName, setPlaceName] = useState("");
  const [tagged, setTagged] = useState<TaggedUser[]>([]);
  const [tagOpen, setTagOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [eventOpen, setEventOpen] = useState(false);
  const [eventAt, setEventAt] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [subOnly, setSubOnly] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  // Profil (Reels) posti: musiqa va haftalik kvota (oddiy — 2 ta, premium — cheksiz)
  const isProfile = base.startsWith("/api/profil/postlar");
  const [musicOpen, setMusicOpen] = useState(false);
  const [music, setMusic] = useState<MusicDraft | null>(null);
  const [quotaTick, setQuotaTick] = useState(0);
  const quota = useQuota(isProfile ? quotaTick + 1 : 0);
  const [uploading, setUploading] = useState(false);
  // Yuklash jarayoni: umumiy ulush (0–1) va qaysi fayl nechanchidan — foydalanuvchiga % ko'rsatiladi
  const [progress, setProgress] = useState(0);
  const [upCount, setUpCount] = useState<{ i: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  // Bir marta ochilgach ochiq qoladi: aks holda asboblar tugmasiga teginganda matn maydoni blur bo'lib,
  // panel (`{expanded && …}`) tap "click"idan oldin DOM'dan chiqib ketardi — rasm/so'rovnoma tugmasi ishlamasdi (mobil).
  const [touched, setTouched] = useState(false);
  const [restored, setRestored] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();
  const eventMs = eventOpen ? localToMs(eventAt) : null;
  const eventPast = Boolean(eventOpen && eventMs && now && eventMs < now);
  const eventInvalid = eventOpen && (!eventMs || eventPast || (eventUrl.trim() !== "" && !/^https:\/\/\S+$/.test(eventUrl.trim())));
  const pollClean = pollOptions.map((o) => o.trim()).filter(Boolean);
  const pollInvalid = pollOpen && (pollClean.length < POLL_OPTIONS_MIN || new Set(pollClean.map((o) => o.toLowerCase())).size !== pollClean.length);
  const canSend = (body.trim().length > 0 || media.length > 0) && !busy && !uploading && !eventInvalid && !pollInvalid;
  const expanded = !collapsible || touched || focused || body.length > 0 || media.length > 0 || eventOpen || pollOpen;

  // Qoralama: tiklash (bir marta) va saqlash (400 ms kechikish)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(base));
      if (!raw) return;
      const d = JSON.parse(raw) as { body?: string; poll?: string[] };
      if (d.body) {
        setBody(d.body);
        setRestored(true);
      }
      if (d.poll && d.poll.length >= 2 && allowPoll) {
        setPollOptions(d.poll);
        setPollOpen(true);
      }
    } catch {}
  }, [base, allowPoll]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        if (body.trim() || (pollOpen && pollClean.length)) localStorage.setItem(draftKey(base), JSON.stringify({ body, poll: pollOpen ? pollOptions : undefined }));
        else localStorage.removeItem(draftKey(base));
      } catch {}
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, pollOpen, pollOptions, base]);

  async function pick(files: FileList | File[] | null) {
    if (!files?.length) return;
    const all = Array.from(files);
    const room = POST_MEDIA_MAX - media.length;
    if (room <= 0) {
      setError(FEED.tooManyFiles[til](POST_MEDIA_MAX));
      return;
    }
    const list = all.slice(0, room);
    if (all.length > room) toast(FEED.tooManyFiles[til](POST_MEDIA_MAX), "info");
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      const added: Attachment[] = [];
      const total = list.length;
      for (let i = 0; i < total; i++) {
        const f = list[i];
        setUpCount({ i: i + 1, total });
        setProgress(i / total);
        // Ba'zi brauzerlar .mov/.webm uchun type bo'sh beradi — kengaytma bo'yicha zaxira tekshiruv
        if (!/^(image|video)\//.test(f.type) && !MEDIA_EXT.test(f.name)) throw new Error(FEED.onlyMedia[til](f.name));
        // Umumiy ulush = tugagan fayllar + joriy faylning qismi (bir nechta faylda silliq %)
        const att = await uploadAttachment(f, { docs: true, onProgress: (p) => setProgress((i + p) / total) });
        // Video: muqovani (birinchi kadr) avtomatik olib yuklaymiz — plitka/oldindan ko'rinishda qora kvadrat chiqmasin
        if (isVideoAttachment(att)) {
          localVideo.current.set(att.url, URL.createObjectURL(f));
          try {
            const pf = await captureVideoPoster(f);
            if (pf) att.poster = (await uploadAttachment(pf)).url;
          } catch {
            /* muqova ixtiyoriy */
          }
        }
        added.push(att);
      }
      setProgress(1);
      setMedia((m) => [...m, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yuklanmadi");
    } finally {
      setUploading(false);
      setUpCount(null);
      setProgress(0);
    }
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) => /^(image|video)\//.test(f.type));
    if (!files.length) return;
    e.preventDefault();
    void pick(files);
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    void pick(e.dataTransfer?.files ?? null);
  }

  function reset() {
    setBody("");
    setMedia([]);
    setEventOpen(false);
    setEventAt("");
    setEventUrl("");
    setPollOpen(false);
    setPollOptions(["", ""]);
    setMusic(null);
    setMusicOpen(false);
    setAudience("public");
    setPlaceName("");
    setTagged([]);
    setExtrasOpen(false);
    setScheduleAt("");
    setRestored(false);
    setTouched(false);
    try {
      localStorage.removeItem(draftKey(base));
    } catch {}
  }

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        body: body.trim(),
        media,
        eventAt: eventOpen ? eventMs : null,
        eventUrl: eventOpen ? eventUrl.trim() : "",
        ...(allowSubOnly && subOnly ? { subscribersOnly: true } : {}),
        ...(isProfile && music ? { music: { url: music.url, title: music.title || "Musiqa", ...(music.artist ? { artist: music.artist } : {}) } } : {}),
      };
      // Rejalashtirilgan post: darhol joylanmaydi, cron vaqti kelganda qo'yadi
      const runAt = scheduleAt ? new Date(scheduleAt).getTime() : 0;
      if (runAt) {
        const sr = await fetch("/api/rejalashtirilgan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: body.trim(), media, audience, placeName: placeName.trim() || null, tagIds: tagged.map((t) => t.id), groupId: isProfile ? null : undefined, runAt }),
        });
        const sj = (await sr.json()) as ApiResp<{ id: string }>;
        if (!sr.ok || !sj.ok) throw new Error((sj.fields && Object.values(sj.fields)[0]) || sj.error || "Rejalashtirilmadi");
        reset();
        toast("Post rejalashtirildi");
        return;
      }
      const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = (await res.json()) as ApiResp<{ id: string }>;
      if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Yuborilmadi");
      const id = j.data?.id;
      // Auditoriya / joy / belgilanganlar — post yaratilgandan keyin
      if (id && (audience === "close" || placeName.trim())) {
        await fetch(`/api/posts/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audience, placeName: placeName.trim() || null }) }).catch(() => undefined);
      }
      if (id && tagged.length) {
        await fetch(`/api/posts/${encodeURIComponent(id)}/tags`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: tagged.map((t) => t.id) }) }).catch(() => undefined);
      }
      if (id && pollOpen && pollClean.length >= POLL_OPTIONS_MIN) {
        try {
          const pr = await fetch(`/api/posts/${encodeURIComponent(id)}/poll`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ options: pollClean }) });
          const pj = (await pr.json()) as ApiResp<unknown>;
          if (!pr.ok || !pj.ok) throw new Error(pj.error || tr(til, FEED.pollFailed));
        } catch (e) {
          toast(e instanceof Error ? e.message : tr(til, FEED.pollFailed), "error");
        }
      }
      reset();
      setQuotaTick((t) => t + 1);
      await onPosted(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yuborilmadi");
    } finally {
      setBusy(false);
    }
  }

  const pct = body.length / POST_BODY_MAX;
  const toolBtn = (active: boolean) =>
    cn("press inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-semibold transition disabled:opacity-50", active ? "bg-fg/6 text-fg" : "text-fg-3 hover:bg-fg/6 hover:text-fg");

  return (
    <div
      className={cn("card p-3 transition-colors sm:p-4", dragging && "border-fg")}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <MentionField
        multiline
        value={body}
        onChange={setBody}
        maxLength={POST_BODY_MAX}
        rows={expanded ? 3 : 1}
        onFocus={() => {
          setFocused(true);
          setTouched(true);
        }}
        onBlur={() => setFocused(false)}
        onPaste={onPaste}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder={eventOpen ? "Efir mavzusi — birinchi qator sarlavha" : (placeholder ?? (kind === "channel" ? "Kanal e'loni…" : "Jamoa bilan bo'lishing… (@ism — eslatish)"))}
        ariaLabel={placeholder ?? "Post matni"}
        className={cn("field w-full py-2.5 text-[14px] leading-relaxed transition-[height]", expanded ? "resize-y" : "resize-none")}
      />
      {restored && (
        <p className="expand-in mt-1.5 flex items-center gap-2 px-1 text-[12px] text-fg-3">
          {tr(til, FEED.draftRestored)}
          <button type="button" onClick={reset} className="font-semibold text-fg-2 underline-offset-2 hover:underline">
            {tr(til, FEED.clearDraft)}
          </button>
        </p>
      )}
      {uploading && (
        <div className="expand-in mt-2.5 grid gap-1.5 rounded-[14px] bg-fg/4 px-3 py-2.5" aria-live="polite">
          <div className="flex items-center justify-between text-[12.5px] font-semibold text-fg-2">
            <span className="flex items-center gap-1.5">
              <Spinner className="h-3.5 w-3.5" />
              {upCount && upCount.total > 1 ? FEED.uploadingFile[til](upCount.i, upCount.total) : tr(til, FEED.uploading)}…
            </span>
            <span className="tabular-nums text-fg">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-fg/10">
            <div className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out" style={{ width: `${Math.max(3, Math.round(progress * 100))}%` }} />
          </div>
        </div>
      )}
      {pollOpen && (
        <div className="expand-in mt-2.5 grid gap-2 rounded-[14px] bg-fg/4 p-3">
          <p className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.1em] text-fg-3">
            <BarChart3 size={13} /> {tr(til, FEED.poll)} <span className="font-medium normal-case tracking-normal text-fg-4">· {tr(til, FEED.pollHint)}</span>
          </p>
          {pollOptions.map((o, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={o}
                onChange={(e) => setPollOptions((arr) => arr.map((x, k) => (k === i ? e.target.value : x)))}
                maxLength={POLL_OPTION_MAX}
                placeholder={FEED.pollOption[til](i + 1)}
                aria-label={FEED.pollOption[til](i + 1)}
                className="field h-10 min-w-0 flex-1 text-[13.5px]"
              />
              {pollOptions.length > POLL_OPTIONS_MIN && (
                <button type="button" onClick={() => setPollOptions((arr) => arr.filter((_, k) => k !== i))} aria-label={tr(til, FEED.pollRemoveOption)} className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          {pollOptions.length < POLL_OPTIONS_MAX && (
            <button type="button" onClick={() => setPollOptions((arr) => [...arr, ""])} className="justify-self-start text-[12.5px] font-semibold text-fg-2 underline-offset-2 hover:underline">
              + {tr(til, FEED.pollAddOption)}
            </button>
          )}
        </div>
      )}
      {allowSubOnly && expanded && (
        <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-fg-2">
          <input type="checkbox" checked={subOnly} onChange={(e) => setSubOnly(e.target.checked)} /> 🔒 Faqat obunachilar uchun
        </label>
      )}
      {eventOpen && (
        <div className="expand-in mt-2.5 grid gap-2.5 rounded-[14px] bg-fg/4 p-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-fg-3">Efir vaqti</span>
            <input type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} className="field h-10 w-full text-[13.5px]" required aria-invalid={eventPast || undefined} />
          </label>
          <label className="grid gap-1">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-fg-3">Havola (ixtiyoriy)</span>
            <input type="url" value={eventUrl} onChange={(e) => setEventUrl(e.target.value)} placeholder="https://…" dir="ltr" className="field h-10 w-full text-[13.5px]" />
          </label>
          {eventPast ? (
            <p role="alert" className="text-[12px] font-semibold text-danger-text sm:col-span-2">
              {tr(til, FEED.pastEvent)}
            </p>
          ) : (
            <p className="text-[12px] leading-relaxed text-fg-3 sm:col-span-2">A&apos;zolarga «Jonli efir» xabari boradi (sayt + Telegram).</p>
          )}
        </div>
      )}
      {isProfile && musicOpen && (
        <div className="expand-in mt-2.5">
          <MusicPicker value={music} onChange={setMusic} />
        </div>
      )}
      {media.length > 0 && (
        <ul className="mt-2.5 grid grid-cols-4 gap-2">
          {media.map((a, i) => (
            <li key={a.url} className="expand-in relative aspect-square overflow-hidden rounded-[14px] border border-line bg-surface-2">
              {isVideoAttachment(a) ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                a.poster ? <SafeImage src={a.poster} alt="" width={160} height={160} className="h-full w-full object-cover" /> : <video src={a.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : (
                <SafeImage src={a.url} alt={a.name} width={160} height={160} className="h-full w-full object-cover" />
              )}
              {isVideoAttachment(a) && (
                <button type="button" onClick={() => setCoverIdx(i)} className="press absolute inset-x-1 bottom-1 flex h-6 items-center justify-center rounded-full bg-ink/75 text-[10.5px] font-semibold text-white">
                  Muqova
                </button>
              )}
              <button type="button" aria-label="Olib tashlash" onClick={() => setMedia((m) => m.filter((_, j) => j !== i))} className="press absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white">
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {coverIdx !== null && media[coverIdx] && (
        <VideoCoverPicker
          open
          onClose={() => setCoverIdx(null)}
          src={localVideo.current.get(media[coverIdx].url) ?? media[coverIdx].url}
          onPick={async (file) => {
            const up = await uploadAttachment(file);
            const i = coverIdx;
            setMedia((m) => m.map((x, j) => (j === i ? { ...x, poster: up.url } : x)));
          }}
        />
      )}
      {expanded && extrasOpen && (
        <div className="expand-in mt-2.5 space-y-2.5 rounded-[14px] border border-line p-3">
          <AudiencePicker value={audience} onChange={setAudience} />
          <PlaceField value={placeName} onChange={setPlaceName} />
          <SchedulePicker value={scheduleAt} onChange={setScheduleAt} />
          <p className="text-[11.5px] leading-snug text-fg-4">«Yaqin do&apos;stlar» — post faqat ro&apos;yxatdagilarga ko&apos;rinadi. Vaqt belgilansa, post o&apos;sha paytda avtomatik joylanadi.</p>
        </div>
      )}
      {tagOpen && <TagPeopleSheet open onClose={() => setTagOpen(false)} value={tagged} onChange={setTagged} />}
      {expanded && (
        <div className="expand-in mt-2 flex items-center gap-0.5">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || media.length >= POST_MEDIA_MAX} aria-label={tr(til, FEED.media)} title={tr(til, FEED.media)} className={toolBtn(media.length > 0)}>
            {uploading ? <Spinner className="h-4 w-4" /> : <ImagePlus size={18} />}
            {uploading ? <span className="tabular-nums">{Math.round(progress * 100)}%</span> : media.length > 0 && <span className="tabular-nums">{media.length}/{POST_MEDIA_MAX}</span>}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={POST_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              void pick(e.target.files);
              e.target.value = "";
            }}
          />
          {allowPoll && (
            <button type="button" onClick={() => setPollOpen((v) => !v)} aria-pressed={pollOpen} aria-label={tr(til, FEED.poll)} title={tr(til, FEED.poll)} className={toolBtn(pollOpen)}>
              <BarChart3 size={18} />
            </button>
          )}
          {isProfile && (
            <button type="button" onClick={() => setMusicOpen((v) => !v)} aria-pressed={musicOpen} aria-label="Musiqa" title="Musiqa qo'shish" className={toolBtn(musicOpen || Boolean(music))}>
              <Music2 size={18} />
            </button>
          )}
          {allowEvent && (
            <button type="button" onClick={() => setEventOpen((v) => !v)} aria-pressed={eventOpen} aria-label={tr(til, FEED.event)} title={tr(til, FEED.event)} className={toolBtn(eventOpen)}>
              <RadioTower size={18} />
            </button>
          )}
          <button type="button" onClick={() => setTagOpen(true)} aria-label="Odamlarni belgilash" title="Odamlarni belgilash" className={toolBtn(tagged.length > 0)}>
            <AtSign size={18} />
            {tagged.length > 0 && <span className="tabular-nums">{tagged.length}</span>}
          </button>
          <button
            type="button"
            onClick={() => setExtrasOpen((v) => !v)}
            aria-pressed={extrasOpen}
            aria-label="Qo'shimcha: joy, kim ko'radi, vaqt"
            title="Joy, kim ko'radi, rejalashtirish"
            className={toolBtn(extrasOpen || audience === "close" || Boolean(placeName) || Boolean(scheduleAt))}
          >
            {scheduleAt ? <CalendarClock size={18} /> : <MapPin size={18} />}
          </button>
          {pct > 0.8 && (
            <span className={cn("ml-auto text-[11.5px] tabular-nums", pct > 0.95 ? "font-semibold text-danger-text" : "text-fg-4")} aria-live="polite">
              {POST_BODY_MAX - body.length}
            </span>
          )}
          <Button type="button" variant="primary" size="sm" onClick={() => void submit()} disabled={!canSend} title={tr(til, FEED.sendHint)} className={cn(pct <= 0.8 && "ml-auto")}>
            {busy ? <Spinner className="h-4 w-4" /> : <Send size={16} />} {busy ? tr(til, FEED.posting) : scheduleAt ? "Rejalashtirish" : eventOpen ? "Efirni e'lon qilish" : tr(til, FEED.post)}
          </Button>
        </div>
      )}
      {isProfile && expanded && quota && (
        <div className="mt-2 px-1">
          <QuotaLine q={quota} kind="posts" />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[12.5px] font-semibold text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Post                                                                */
/* ------------------------------------------------------------------ */
export function PostCard({
  post,
  canInteract,
  canPin,
  loggedIn,
  requireLogin,
  highlighted,
  groupSlug = null,
  onDeleted,
  onChanged,
  onMuted,
}: {
  post: FeedPostView;
  canInteract: boolean;
  /** Egasi/admin — qadash va olish */
  canPin: boolean;
  loggedIn: boolean;
  requireLogin: () => boolean;
  highlighted: boolean;
  /** Jamoa slug'i (ulashish havolasi uchun); profil posti — null */
  groupSlug?: string | null;
  onDeleted: () => void;
  onChanged: () => Promise<void>;
  /** Muallif lentadan yashirilganda (bosh sahifa shu muallifning boshqa postlarini ham olib tashlaydi) */
  onMuted?: (authorId: string) => void;
}) {
  const til = useLocale();
  const ref = useRef<HTMLElement | null>(null);
  const { ref: viewRef, views } = useViewTracker(post.id, post.viewsCount);
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [body, setBody] = useState(post.body);
  // Video muqovasini almashtirish (muallif): media nusxasi lokal yangilanadi
  const [mediaList, setMediaList] = useState(post.media);
  const [posterOpen, setPosterOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [queued, setQueued] = useState(post.queuedLater);
  const posterIdx = useRef(0);
  const [editedAt, setEditedAt] = useState<number | null>(post.editedAt ?? (post.edited ? 0 : null));
  const [pinned, setPinned] = useState(post.isPinned);
  const [comments, setComments] = useState(post.commentsCount);
  const [rx, setRx] = useState<ReactionState>({ liked: post.likedByMe, likesCount: post.likesCount, myReaction: post.myReaction, reactions: post.reactions });
  const [open, setOpen] = useState(highlighted);
  const panel = usePresence(open, 180);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState<"post" | "author" | null>(null);

  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "center" });
  }, [highlighted]);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
      const j = (await res.json()) as ApiResp<unknown>;
      if (!res.ok || !j.ok) throw new Error(j.error || tr(til, FEED.notDeleted));
      toast(tr(til, FEED.deleted));
      onDeleted();
    } catch (e) {
      toast(e instanceof Error ? e.message : tr(til, FEED.notDeleted), "error");
      setBusy(false);
      setConfirm(false);
    }
  }

  async function patch(payload: Record<string, unknown>) {
    const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = (await res.json()) as ApiResp<{ isPinned: boolean; body: string; editedAt: number | null }>;
    if (!res.ok || !j.ok || !j.data) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Bo'lmadi");
    return j.data;
  }
  // «Keyinroq ko'rish» navbati (YouTube uslubi) — toggle
  async function toggleWatchLater() {
    if (!requireLogin()) return;
    const was = queued;
    setQueued(!was);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}/keyinroq`, { method: "POST" });
      const j = (await res.json()) as ApiResp<{ queued: boolean }>;
      if (!res.ok || !j.ok || !j.data) throw new Error(j.error || "Bo'lmadi");
      setQueued(j.data.queued);
      toast(j.data.queued ? "Keyinroq ko'rish navbatiga qo'shildi" : "Navbatdan olindi");
    } catch (e) {
      setQueued(was);
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    }
  }

  async function changePoster(file: File) {
    try {
      const up = await uploadAttachment(file);
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ poster: { index: posterIdx.current, url: up.url } }) });
      const j = (await res.json()) as ApiResp<unknown>;
      if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Muqova saqlanmadi");
      setMediaList((l) => l.map((m, i) => (i === posterIdx.current ? { ...m, poster: up.url } : m)));
      toast("Muqova yangilandi");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Muqova saqlanmadi", "error");
    }
  }
  async function togglePin() {
    try {
      const d = await patch({ isPinned: !pinned });
      setPinned(d.isPinned);
      toast(d.isPinned ? "Post qadaldi — lentada tepada" : "Qadash olindi");
      await onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    }
  }
  async function saveEdit() {
    const t = draft.trim();
    if (!t || t === body) {
      setEditing(false);
      return;
    }
    try {
      const d = await patch({ body: t });
      setBody(d.body);
      setEditedAt(d.editedAt ?? Date.now());
      setEditing(false);
      toast("Post yangilandi");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Saqlab bo'lmadi", "error");
    }
  }
  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(tr(til, FEED.copied));
    } catch {
      toast(text, "info");
    }
  }
  async function hidePost(hide: boolean) {
    if (!requireLogin()) return;
    setHidden(hide ? "post" : null);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}/hide`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hidden: hide }) });
      const j = (await res.json()) as ApiResp<unknown>;
      if (!res.ok || !j.ok) throw new Error(j.error || "Bo'lmadi");
    } catch (e) {
      setHidden(hide ? null : "post");
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    }
  }
  async function muteAuthor(mute: boolean) {
    if (!requireLogin()) return;
    setHidden(mute ? "author" : null);
    try {
      const res = await fetch(`/api/feed/mute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authorId: post.author.id, muted: mute }) });
      const j = (await res.json()) as ApiResp<unknown>;
      if (!res.ok || !j.ok) throw new Error(j.error || "Bo'lmadi");
      if (mute) onMuted?.(post.author.id);
    } catch (e) {
      setHidden(mute ? null : "author");
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    }
  }

  const isAuthor = post.canDelete && loggedIn && post.author.id !== "";
  const media = mediaList;
  const permalink = postPermalink(post, groupSlug ?? post.group?.slug ?? null);
  const source = post.group ?? null;
  const url = media.length === 0 ? firstUrl(body) : null;
  const title = body.split("\n")[0] || post.author.name;

  const menuItems: MenuItem[] = [
    { key: "link", label: tr(til, FEED.copyLink), icon: Link2, onSelect: () => void copyText(`${window.location.origin}${permalink}`) },
    { key: "text", label: tr(til, FEED.copyText), icon: Copy, onSelect: () => void copyText(body), hidden: !body },
    { key: "edit", label: tr(til, FEED.edit), icon: Pencil, onSelect: () => setEditing(true), hidden: !isAuthor || editing },
    { key: "later", label: queued ? "Navbatdan olish" : "Keyinroq ko'rish", icon: Clock, onSelect: () => void toggleWatchLater(), hidden: !loggedIn || media.length === 0 },
    { key: "collect", label: "To'plamga qo'shish", icon: FolderPlus, onSelect: () => setCollectOpen(true), hidden: !loggedIn },
    {
      key: "poster",
      label: "Muqovani o'zgartirish",
      icon: ImagePlus,
      onSelect: () => {
        posterIdx.current = Math.max(0, media.findIndex((m) => isVideoAttachment(m)));
        setPosterOpen(true);
      },
      hidden: !isAuthor || !media.some((m) => isVideoAttachment(m)),
    },
    { key: "stats", label: "Statistika", icon: BarChart3, onSelect: () => setStatsOpen(true), hidden: !isAuthor && !canPin },
    { key: "pin", label: tr(til, pinned ? FEED.unpin : FEED.pin), icon: pinned ? PinOff : Pin, onSelect: () => void togglePin(), hidden: !canPin },
    { key: "hide", label: tr(til, FEED.notInterested), icon: EyeOff, onSelect: () => void hidePost(true), hidden: !loggedIn || isAuthor },
    { key: "mute", label: FEED.muteAuthor[til](post.author.name.split(" ")[0]), icon: UserRoundX, onSelect: () => void muteAuthor(true), hidden: !loggedIn || isAuthor },
    { key: "delete", label: tr(til, FEED.delete), icon: Trash2, onSelect: () => setConfirm(true), danger: true, hidden: !post.canDelete },
  ];

  if (hidden) {
    return (
      <div className="card expand-in flex items-center gap-3 px-4 py-3 text-[13px] text-fg-2" role="status">
        <EyeOff size={16} className="shrink-0 text-fg-3" />
        <span className="min-w-0 flex-1 truncate">{tr(til, hidden === "post" ? FEED.hiddenToast : FEED.mutedToast)}</span>
        <button type="button" onClick={() => void (hidden === "post" ? hidePost(false) : muteAuthor(false))} className="shrink-0 font-semibold text-fg underline-offset-2 hover:underline">
          {tr(til, FEED.undo)}
        </button>
      </div>
    );
  }

  return (
    <article
      ref={(el) => {
        ref.current = el;
        viewRef.current = el;
      }}
      id={`post-${post.id}`}
      data-post-id={post.id}
      tabIndex={-1}
      className={cn("card card-hover p-4 outline-none focus-visible:border-fg sm:p-5", highlighted && "ring-2 ring-accent/40")}
    >
      <header className="flex items-start gap-2.5">
        <Avatar name={post.author.name} src={post.author.avatarUrl} size={44} decorative />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[15px] font-bold leading-tight">
            <AuthorLink u={post.author} />
            {source && (
              <>
                <span className="text-fg-4" aria-hidden>
                  ·
                </span>
                <Link href={`/jamoalar/${source.slug}`} className="inline-flex min-w-0 max-w-[14rem] items-center gap-1 text-[12.5px] font-semibold text-fg-3 transition hover:text-fg">
                  {source.isOfficial ? <BadgeCheck size={13} className="shrink-0 text-accent" /> : source.kind === "channel" ? <Radio size={13} className="shrink-0" /> : <UsersRound size={13} className="shrink-0" />}
                  <span className="truncate">{source.name}</span>
                </Link>
              </>
            )}
            {pinned && (
              <span className="inline-flex items-center text-fg-3" title={tr(til, FEED.pinned)}>
                <Pin size={12} />
                <span className="sr-only">{tr(til, FEED.pinned)}</span>
              </span>
            )}
            {post.followingAuthor === false && loggedIn && <FollowButton userId={post.author.id} initialFollowing={false} initialCount={0} loggedIn size="sm" compact showCount={false} variant="outline" />}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[12px] text-fg-3">
            <Link href={permalink} className="hover:underline" title={tr(til, FEED.permalink)}>
              <RelativeTime at={post.createdAt} />
            </Link>
            {editedAt !== null && (
              <span className="text-fg-4" title={editedAt ? FEED.editedAt[til](formatDateTime(editedAt)) : undefined}>
                · {tr(til, FEED.edited)}
              </span>
            )}
            {views > 0 && <span className="tabular-nums text-fg-4">· {FEED.views[til](views)}</span>}
          </p>
        </div>
        <PostMenu items={menuItems} extra={loggedIn && !post.canDelete ? <ReportButton targetType="post" targetId={post.id} loggedIn modal triggerClassName="!h-9 w-full justify-start rounded-[10px] px-2.5 !text-[13px] !text-fg hover:bg-fg/6" /> : undefined} />
      </header>

      {confirm && (
        <div className="expand-in mt-3 flex flex-wrap items-center gap-2 rounded-[14px] bg-fg/4 px-3 py-2 text-[13px] font-semibold text-fg" role="alertdialog" aria-label={tr(til, FEED.deleteConfirm)}>
          <span className="min-w-0 flex-1">{tr(til, FEED.deleteConfirm)}</span>
          <Button type="button" variant="danger" size="sm" onClick={remove} disabled={busy}>
            {tr(til, FEED.delete)}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(false)}>
            {tr(til, FEED.cancel)}
          </Button>
        </div>
      )}

      {editing ? (
        <div className="expand-in mt-3">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={POST_BODY_MAX} rows={4} className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" autoFocus aria-label={tr(til, FEED.edit)} />
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" variant="primary" size="sm" onClick={() => void saveEdit()} disabled={!draft.trim()}>
              {tr(til, FEED.save)}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setDraft(body);
              }}
            >
              {tr(til, FEED.cancel)}
            </Button>
          </div>
        </div>
      ) : (
        body && (
          <p className="mt-3.5 whitespace-pre-wrap break-words text-[15.5px] leading-[1.6] text-fg">
            <RichText text={body} />
          </p>
        )
      )}

      {post.locked && (
        <div className="mt-3 flex flex-col items-center gap-2.5 rounded-[14px] bg-fg/[0.04] px-4 py-7 text-center">
          <p className="text-[14.5px] font-semibold text-fg">🔒 Bu post faqat obunachilar uchun</p>
          {post.subMentorId && (
            <BuyButton type="sub" id={post.subMentorId} loggedIn={loggedIn} className="btn-accent inline-flex h-10 items-center px-5 text-[13.5px] font-semibold">
              Obuna bo&apos;lish
            </BuyButton>
          )}
        </div>
      )}
      {url && !post.locked && <LinkPreviewCard url={url} />}
      {post.poll && <PollBlock postId={post.id} poll={post.poll} canInteract={canInteract} requireLogin={requireLogin} />}
      {post.eventAt && <EventBlock at={post.eventAt} url={post.eventUrl} title={body.split("\n")[0] || "Jonli efir"} />}
      {!post.locked && (post.placeName || post.tags.length > 0 || post.audience === "close") && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-fg-3">
          {post.audience === "close" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-1.5 py-0.5 font-semibold text-success-text" title="Faqat yaqin do'stlarga ko'rinadi">
              <UsersRound size={11} /> Yaqin do&apos;stlar
            </span>
          )}
          {post.placeName && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} /> {post.placeName}
            </span>
          )}
          {post.tags.length > 0 && (
            <span className="inline-flex flex-wrap items-center gap-1">
              <AtSign size={12} />
              {post.tags.slice(0, 3).map((t, i) => (
                <Link key={t.id} href={t.slug ? `/mutaxassislar/${t.slug}` : t.username ? `/yozish/${t.username}` : "#"} className="font-semibold text-fg-2 underline-offset-2 hover:underline">
                  {t.name}
                  {i < Math.min(post.tags.length, 3) - 1 ? "," : ""}
                </Link>
              ))}
              {post.tags.length > 3 && <span>va yana {post.tags.length - 3} ta</span>}
            </span>
          )}
        </p>
      )}
      {!post.locked && <MediaGrid media={media} alt={body.slice(0, 120)} postId={post.id} resumeAt={post.resumeAt} />}
      {collectOpen && <CollectionSheet open onClose={() => setCollectOpen(false)} postId={post.id} />}
      {statsOpen && <PostStatsSheet open onClose={() => setStatsOpen(false)} postId={post.id} />}
      {posterOpen && media[posterIdx.current] && <VideoCoverPicker open onClose={() => setPosterOpen(false)} src={media[posterIdx.current].url} onPick={(f) => changePoster(f)} />}
      {post.music && <MusicChip music={post.music} className="mt-2.5" />}

      <footer className="-mx-1.5 mt-2.5 flex items-center gap-1">
        <ReactionButton postId={post.id} initial={post} canInteract={canInteract} requireLogin={requireLogin} showCount={false} lockedTitle={loggedIn && !canInteract ? tr(til, FEED.joinToReact) : undefined} onChange={setRx} />
        <ReactorsButton postId={post.id} total={rx.likesCount} counts={rx.reactions} />
        <button
          type="button"
          data-action="comments"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${tr(til, FEED.comments)} (${comments})`}
          className={cn("press inline-flex h-10 min-w-10 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold transition", open ? "bg-fg/6 text-fg" : "text-fg-2 hover:bg-fg/6 hover:text-fg")}
        >
          <MessageCircle size={20} /> {comments > 0 && <span className="tabular-nums">{comments}</span>}
        </button>
        <ShareAction url={permalink} title={title} loggedIn={loggedIn} />
        <SaveButton postId={post.id} initial={post.savedByMe} requireLogin={requireLogin} className="ml-auto" />
      </footer>

      {panel.mounted && (
        <div className={panel.closing ? "expand-out" : "expand-in"}>
          <Comments postId={post.id} canWrite={canInteract} loggedIn={loggedIn} onCount={setComments} />
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Izohlar                                                             */
/* ------------------------------------------------------------------ */
type Sort = "old" | "new";

/**
 * Izohlar: saralash (eski/yangi), javob (1 daraja, iqtibos chiziqchasi), tahrir (muallif, 15 daqiqa), ikki bosqichli o'chirish,
 * xato holati + qayta urinish. `onCount` — serverdagi jami son.
 */
export function Comments({ postId, canWrite, onCount, loggedIn = canWrite }: { postId: string; canWrite: boolean; onCount: (n: number) => void; /** Shikoyat tugmasi uchun (yoza olmasa ham kirgan bo'lishi mumkin) */ loggedIn?: boolean }) {
  const til = useLocale();
  const { toast } = useToast();
  const [items, setItems] = useState<CommentViewX[] | null>(null);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<Sort>("old");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const url = `/api/posts/${encodeURIComponent(postId)}/comments`;

  const load = useCallback(
    async (s: Sort) => {
      setLoadError(false);
      try {
        const res = await fetch(`${url}?sort=${s}`, { cache: "no-store" });
        const j = (await res.json()) as ApiResp<{ items: CommentViewX[]; total: number }>;
        if (!j.ok || !j.data) throw new Error(j.error);
        setItems(j.data.items);
        setTotal(j.data.total);
        onCount(j.data.total);
      } catch {
        setLoadError(true);
      }
    },
    [url, onCount],
  );

  useEffect(() => {
    void load(sort);
  }, [load, sort]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, replyToId: replyTo?.id ?? null }) });
      const j = (await res.json()) as ApiResp<{ id: string }>;
      if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Yuborilmadi");
      setText("");
      setReplyTo(null);
      await load(sort);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuborilmadi");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const body = editing.text.trim();
    if (!body) return;
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(editing.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const j = (await res.json()) as ApiResp<{ body: string; editedAt: number | null }>;
      if (!res.ok || !j.ok || !j.data) throw new Error(j.error || "Saqlanmadi");
      const d = j.data;
      setItems((prev) => prev?.map((c) => (c.id === editing.id ? { ...c, body: d.body, editedAt: d.editedAt } : c)) ?? prev);
      setEditing(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Saqlanmadi", "error");
    }
  }

  async function remove(id: string) {
    setConfirmId(null);
    setRemoving((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = (await res.json()) as ApiResp<unknown>;
      if (!res.ok || !j.ok) throw new Error(j.error || tr(til, FEED.notDeleted));
      window.setTimeout(() => {
        setItems((prev) => prev?.filter((c) => c.id !== id) ?? prev);
        setTotal((n) => {
          onCount(Math.max(0, n - 1));
          return Math.max(0, n - 1);
        });
        setRemoving((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      }, 160);
    } catch (err) {
      setRemoving((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      toast(err instanceof Error ? err.message : tr(til, FEED.notDeleted), "error");
    }
  }

  /** Izohni yoqtirish: darhol almashadi (optimistik), server javobi bilan aniqlanadi, xatoda qaytadi */
  async function likeComment(id: string) {
    const patch = (liked: boolean, count: number) => setItems((prev) => prev?.map((c) => (c.id === id ? { ...c, likedByMe: liked, likesCount: count } : c)) ?? prev);
    const cur = items?.find((c) => c.id === id);
    if (!cur) return;
    patch(!cur.likedByMe, Math.max(0, cur.likesCount + (cur.likedByMe ? -1 : 1)));
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(id)}/like`, { method: "POST" });
      const j = (await res.json()) as ApiResp<{ liked: boolean; likesCount: number }>;
      if (!res.ok || !j.ok || !j.data) throw new Error(j.error || "Bo'lmadi");
      patch(j.data.liked, j.data.likesCount);
    } catch (err) {
      patch(cur.likedByMe, cur.likesCount);
      toast(err instanceof Error ? err.message : "Bo'lmadi", "error");
    }
  }

  /** Izohni qadash: qadalgani ro'yxat tepasiga chiqadi (bitta postda bitta qadalgan) */
  async function togglePin(c: CommentViewX) {
    const next = !c.isPinned;
    setItems((prev) => prev?.map((x) => ({ ...x, isPinned: x.id === c.id ? next : next ? false : x.isPinned })).sort((a, b) => Number(b.isPinned) - Number(a.isPinned)) ?? prev);
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(c.id)}/pin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: next }) });
      const j = (await res.json()) as ApiResp<unknown>;
      if (!res.ok || !j.ok) throw new Error(j.error || "Bo'lmadi");
    } catch (e) {
      setItems((prev) => prev?.map((x) => (x.id === c.id ? { ...x, isPinned: !next } : x)) ?? prev);
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    }
  }


  function startReply(c: CommentViewX) {
    setReplyTo({ id: c.replyTo?.id ?? c.id, name: c.author.name });
    const handle = c.author.username ? `@${c.author.username} ` : "";
    setText((t) => (handle && !t.includes(handle) ? `${handle}${t}` : t));
    inputRef.current?.focus();
  }

  const actionCls = "text-[11.5px] font-semibold text-fg-4 transition hover:text-fg";

  return (
    <div className="mt-3 pt-1">
      {total > 0 && (
        <div className="mb-2 flex items-center gap-2 text-[12px] text-fg-3">
          <span className="font-semibold">{total}</span>
          <div className="ml-auto flex items-center gap-1" role="group" aria-label="Saralash">
            {(["old", "new"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)} className={cn("press rounded-full px-2 py-0.5 text-[12px] font-semibold transition", sort === s ? "bg-fg/8 text-fg" : "text-fg-3 hover:text-fg")}>
                {tr(til, s === "old" ? FEED.sortOld : FEED.sortNew)}
              </button>
            ))}
          </div>
        </div>
      )}
      {loadError ? (
        <p role="alert" className="flex items-center gap-2 text-[12.5px] font-semibold text-danger-text">
          {tr(til, FEED.loadFailed)}
          <button type="button" onClick={() => void load(sort)} className="text-fg-2 underline-offset-2 hover:underline">
            {tr(til, FEED.retry)}
          </button>
        </p>
      ) : !items ? (
        <ul className="grid gap-2" aria-hidden>
          {[0, 1].map((i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="skeleton h-7 w-7 !rounded-full" />
              <span className="skeleton h-10 flex-1 !rounded-[14px]" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="text-[12.5px] text-fg-3">
          {tr(til, FEED.noComments)}
          {canWrite && ` — ${tr(til, FEED.firstComment).toLowerCase()}.`}
        </p>
      ) : (
        <ul className="grid gap-2">
          {items.map((c) => (
            <li key={c.id} className={cn("group flex items-start gap-2", removing.has(c.id) ? "expand-out" : "animate-msg-in")}>
              <Avatar name={c.author.name} src={c.author.avatarUrl} size={28} decorative />
              <div className="min-w-0 flex-1 rounded-[14px] bg-fg/4 px-3 py-2">
                <div className="flex min-w-0 items-baseline gap-2 text-[12.5px]">
                  <AuthorLink u={c.author} />
                  {c.isPinned && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-fg/8 px-1.5 text-[11px] font-semibold text-fg-2" title="Muallif qadagan izoh">
                      <Pin size={10} className="fill-current" /> qadalgan
                    </span>
                  )}
                  {c.creatorLiked && (
                    <span className="shrink-0 text-accent" title="Muallif yoqtirdi" aria-label="Muallif yoqtirdi">
                      <Heart size={11} className="fill-current" />
                    </span>
                  )}
                  <RelativeTime at={c.createdAt} className="shrink-0 text-fg-4" />
                  {c.editedAt && (
                    <span className="shrink-0 text-fg-4" title={formatDateTime(c.editedAt)}>
                      · {tr(til, FEED.edited)}
                    </span>
                  )}
                </div>
                {c.replyTo && (
                  <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-fg-4">
                    <CornerDownRight size={11} /> {FEED.replyingTo[til](c.replyTo.authorName)}
                  </span>
                )}
                {editing?.id === c.id ? (
                  <div className="expand-in mt-1">
                    <textarea value={editing.text} onChange={(e) => setEditing({ id: c.id, text: e.target.value })} maxLength={COMMENT_MAX} rows={2} autoFocus aria-label={tr(til, FEED.edit)} className="field w-full resize-y py-2 text-[13.5px]" />
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Button type="button" variant="primary" size="sm" className="!h-8" onClick={() => void saveEdit()} disabled={!editing.text.trim()}>
                        {tr(til, FEED.save)}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="!h-8" onClick={() => setEditing(null)}>
                        {tr(til, FEED.cancel)}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-fg">
                    <RichText text={c.body} />
                  </p>
                )}
                {editing?.id !== c.id && (loggedIn || canWrite) && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                    {canWrite && (
                      <button type="button" onClick={() => startReply(c)} className={actionCls}>
                        {tr(til, FEED.reply)}
                      </button>
                    )}
                    {c.canEdit && (
                      <button type="button" onClick={() => setEditing({ id: c.id, text: c.body })} className={actionCls}>
                        {tr(til, FEED.edit)}
                      </button>
                    )}
                    {c.canDelete &&
                      (confirmId === c.id ? (
                        <span className="expand-in inline-flex items-center gap-2 text-[11.5px] font-semibold">
                          <span className="text-fg-3">{tr(til, FEED.deleteQ)}</span>
                          <button type="button" onClick={() => void remove(c.id)} className="text-danger-text hover:underline">
                            {tr(til, FEED.yes)}
                          </button>
                          <button type="button" onClick={() => setConfirmId(null)} className="text-fg-3 hover:text-fg">
                            {tr(til, FEED.no)}
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirmId(c.id)} aria-label={tr(til, FEED.deleteComment)} className={cn(actionCls, "hover:text-danger-text")}>
                          {tr(til, FEED.delete)}
                        </button>
                      ))}
                    {c.canPin && (
                      <button type="button" onClick={() => void togglePin(c)} className={actionCls}>
                        {c.isPinned ? "Qadashni olish" : "Qadash"}
                      </button>
                    )}
                    {loggedIn && !c.canDelete && <ReportButton targetType="comment" targetId={c.id} loggedIn compact modal triggerClassName="!h-6 !w-6" />}
                  </div>
                )}
              </div>
              {/* Izohga yurakcha (Instagram naqshi): yozishga ruxsati bo'lmasa — faqat son */}
              {canWrite || c.likesCount > 0 ? (
                <div className="flex w-9 shrink-0 flex-col items-center pt-1.5">
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => void likeComment(c.id)}
                      aria-pressed={c.likedByMe}
                      aria-label={c.likedByMe ? "Yoqtirishni olish" : "Izohni yoqtirish"}
                      className={cn("press flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-fg/6", c.likedByMe ? "text-accent" : "text-fg-4 hover:text-fg")}
                    >
                      <Heart key={c.likedByMe ? "on" : "off"} size={15} className={cn(c.likedByMe && "animate-heartbeat fill-current")} aria-hidden="true" />
                    </button>
                  ) : (
                    <Heart size={15} className="mt-1.5 text-fg-4" aria-hidden="true" />
                  )}
                  {c.likesCount > 0 && <span className="-mt-0.5 text-[11px] font-semibold tabular-nums text-fg-3">{c.likesCount}</span>}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {items && total > items.length && <p className="mt-2 text-[12px] text-fg-4">{FEED.moreComments[til](total - items.length)}</p>}
      {canWrite ? (
        <form onSubmit={send} className="mt-3">
          {replyTo && (
            <p className="expand-in mb-1.5 flex items-center gap-2 px-1 text-[12px] text-fg-3">
              <CornerDownRight size={12} /> {FEED.replyingTo[til](replyTo.name)}
              <button type="button" onClick={() => setReplyTo(null)} aria-label={tr(til, FEED.cancel)} className="press flex h-6 w-6 items-center justify-center rounded-full hover:bg-fg/6 hover:text-fg">
                <X size={12} />
              </button>
            </p>
          )}
          <div className="flex items-center gap-2">
            <MentionField value={text} onChange={setText} maxLength={COMMENT_MAX} placeholder={tr(til, FEED.commentPlaceholder)} ariaLabel={tr(til, FEED.commentPlaceholder)} wrapperClassName="min-w-0 flex-1" className="field h-10 w-full text-[13.5px]" inputRef={(el) => (inputRef.current = el)} />
            <Button type="submit" variant="primary" size="sm" disabled={!text.trim() || busy} aria-label={tr(til, FEED.sendComment)} className="!h-10 !w-10 !px-0">
              {busy ? <Spinner className="h-4 w-4" /> : <Send size={16} />}
            </Button>
          </div>
        </form>
      ) : (
        loggedIn && <p className="mt-3 text-[12px] text-fg-4">{tr(til, FEED.joinToComment)}</p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-[12.5px] font-semibold text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

/** Efir/yig'ilish bloki: holat (kutilmoqda / jonli / o'tkazildi), vaqt va havola; «N daqiqadan keyin» klientda hisoblanadi */
function EventBlock({ at, url, title }: { at: number; url: string | null; title: string }) {
  const til = useLocale();
  // Serverda va birinchi klient renderida `now` = 0 → neytral «kutilmoqda» ko'rinishi (hydration mos); keyin holat klientda aniqlanadi
  const now = useNow(30_000);
  const known = now > 0;
  const live = known && now >= at && now < at + 2 * 60 * 60 * 1000;
  const past = known && now >= at + 2 * 60 * 60 * 1000;
  return (
    <div className={cn("mt-3 flex flex-wrap items-center gap-3 rounded-[14px] border px-4 py-3", live ? "border-accent/40 bg-accent-soft/50" : "border-line bg-fg/4")}>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", live ? "bg-accent text-white" : "bg-fg/6 text-fg-3")}>
        <RadioTower size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-fg">{past ? "Efir o'tkazildi" : live ? "Hozir jonli efirda" : "Jonli efir"}</p>
        <p className="text-[12.5px] text-fg-2" suppressHydrationWarning>
          {formatDateTime(at)}
          {!past && !live && now > 0 && <span className="text-fg-3"> · {untilTime(til, at, now)}</span>}
        </p>
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className={cn("inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold", live ? "btn-accent" : "border border-line-2 text-fg hover:border-fg")}>
          {live ? "Qo'shilish" : past ? "Yozuv" : "Havola"} <ExternalLink size={14} />
        </a>
      ) : (
        !past && <span className="text-[12px] text-fg-3">Havola efir oldidan qo&apos;shiladi</span>
      )}
      {!past && (
        <div className="basis-full">
          <CalendarLinks title={title} at={at} url={url} compact />
        </div>
      )}
    </div>
  );
}
