"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Ago } from "@/components/ui/Ago";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Eye, Heart, Music2, Pause, Play, Send, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { Avatar, Spinner } from "@/components/ui";
import { ShareSheet } from "@/components/social/ShareSheet";
import { StoryStickerCard } from "./StorySticker";
import { showToast } from "@/components/ui/toast";
import { useScrollLock } from "@/components/motion/useScrollLock";
import { STORY_BACKGROUNDS } from "@/lib/social/limits";
import { StoryText } from "./StoryText";
import { cn } from "@/lib/utils";
import type { AuthorStories, StoryRailItem } from "@/lib/stories/types";
import { EmojiSticker } from "@/components/social/EmojiSticker";
import { haptic } from "@/components/motion/haptics";
import { closeTo, cubeSwap, openFrom, springBack, type OriginRect } from "./story-motion";

const IMAGE_MS = 5500;

/**
 * Story ko'ruvchi (Instagram uslubi): to'liq ekran (portal), tepada progress chiziqlari, chap/o'ng bosish — oldingi/keyingi,
 * bosib turish — pauza, muallif tugagach keyingi muallifga o'tadi. Rasm/matn 5.5 s, video — o'z davomiyligi; musiqa chalinadi.
 * Pastda: javob yozish (DM), ❤️ tez reaksiya (DM), ulashish. Egasiga: ko'rishlar soni, kim ko'rgani va o'chirish.
 */
const HOLD_MS = 220;
const firstUnseen = (d: AuthorStories) => Math.max(0, d.items.findIndex((s) => !s.seen));

export function StoryViewer({
  rail,
  startIndex,
  me,
  onClose,
  onSeen,
  initialData,
  originFor,
}: {
  rail: StoryRailItem[];
  startIndex: number;
  me: { id: string } | null;
  onClose: () => void;
  onSeen: (authorId: string) => void;
  /** Qatorda oldindan yuklangan (halqa aylangan paytda) birinchi muallif story'lari */
  initialData?: AuthorStories | null;
  /** Muallif avatarining ekrandagi joyi — ochilish/yopilish shu joydan (ko'rinmasa null) */
  originFor?: (authorIndex: number) => OriginRect | null;
}) {
  const [ai, setAi] = useState(startIndex);
  const cacheRef = useRef(new Map<string, AuthorStories>());
  if (initialData && rail[startIndex] && !cacheRef.current.has(rail[startIndex].author.id)) cacheRef.current.set(rail[startIndex].author.id, initialData);
  const [data, setData] = useState<AuthorStories | null>(initialData ?? null);
  const [si, setSi] = useState(initialData ? firstUnseen(initialData) : 0);
  // Bosib turish: pauza + ustki/pastki panellar yashirinadi (Instagram)
  const [holding, setHolding] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [likePop, setLikePop] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  // Instagram tez reaksiyalar: javob maydoni fokusda — 6 emoji qatori; bosilsa DM ketadi + markazda «portlash»
  const [replyFocus, setReplyFocus] = useState(false);
  const [burst, setBurst] = useState<string | null>(null);
  const QUICK = ["❤️", "🔥", "👏", "😂", "😮", "😢"];
  function quickReact(e: string) {
    setBurst(e);
    window.setTimeout(() => setBurst(null), 900);
    void sendDm(`${e} Story'ingizga`);
  }
  const [muted, setMuted] = useState(false);
  const [reply, setReply] = useState("");
  const [viewers, setViewers] = useState<Array<{ user: { name: string; avatarUrl: string | null }; at: number }> | null>(null);
  const [share, setShare] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const startRef = useRef(0);
  const elapsedRef = useRef(0);
  useScrollLock(true);

  const author = rail[ai];
  const story = data?.items[si];

  // Muallif story'larini yuklash (keshdan bo'lsa — darhol); keyingi muallif oldindan yuklanadi (kub aylanishida bo'sh yuz chiqmasin)
  const loadAuthor = useCallback((id: string) => {
    const hit = cacheRef.current.get(id);
    if (hit) return Promise.resolve(hit);
    return fetch(`/api/stories/user/${id}`)
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: AuthorStories }) => {
        if (j.ok && j.data) cacheRef.current.set(id, j.data);
        return j.ok ? (j.data ?? null) : null;
      })
      .catch(() => null);
  }, []);
  useEffect(() => {
    if (!author) return;
    let off = false;
    setViewers(null);
    const hit = cacheRef.current.get(author.author.id);
    if (hit) {
      if (data?.author.id !== hit.author.id) {
        setData(hit);
        setSi(firstUnseen(hit));
      }
    } else {
      setData(null);
      void loadAuthor(author.author.id).then((d) => {
        if (off) return;
        if (!d) return next();
        setData(d);
        setSi(firstUnseen(d));
      });
    }
    const nb = rail[ai + 1];
    if (nb) void loadAuthor(nb.author.id);
    return () => {
      off = true;
    };
  }, [ai]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Yopish: karta avatarga qaytadi (yoki pastga tushadi), keyin unmount */
  const closeAnimated = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setPaused(true);
    void closeTo(cardRef.current, backdropRef.current, originFor?.(ai) ?? null).then(onClose);
  }, [ai, onClose, originFor]);

  /** Boshqa muallifga o'tish — kub aylanishi bilan; keshda bo'lsa yangi yuz darhol to'la chiziladi */
  const goAuthor = useCallback(
    (to: number, dir: 1 | -1) => {
      if (to < 0) return;
      if (to >= rail.length) return closeAnimated();
      setProgress(0);
      elapsedRef.current = 0;
      cubeSwap(cardRef.current, dir, () => {
        const hit = cacheRef.current.get(rail[to].author.id);
        setAi(to);
        setData(hit ?? null);
        setSi(hit ? firstUnseen(hit) : 0);
      });
    },
    [rail, closeAnimated],
  );

  const next = useCallback(() => {
    setProgress(0);
    elapsedRef.current = 0;
    if (data && si < data.items.length - 1) return setSi(si + 1);
    if (author) onSeen(author.author.id);
    goAuthor(ai + 1, 1);
  }, [si, ai, data, author, onSeen, goAuthor]);

  const prev = () => {
    setProgress(0);
    elapsedRef.current = 0;
    if (si > 0) setSi(si - 1);
    else if (ai > 0) goAuthor(ai - 1, -1);
    else startRef.current = performance.now(); // birinchi story — boshidan
  };

  // Ochilish: karta bosilgan avatar joyidan kattalashadi
  useLayoutEffect(() => {
    openFrom(cardRef.current, backdropRef.current, originFor?.(startIndex) ?? null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Imo-ishoralar (bitta pointer oqimi): bosish — chap uchdan biri oldingi, qolgani keyingi; bosib turish — pauza va panellar
   * yashirinadi; pastga tortish — karta barmoq ortidan kichrayib boradi (yetarli bo'lsa yopiladi); yonga surish — kub bilan muallif.
   */
  const gRef = useRef<{ id: number; x: number; y: number; t: number; mode: "none" | "down" | "side"; hold: number; held: boolean } | null>(null);
  function onGestureDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || viewers || share) return;
    if ((e.target as HTMLElement).closest("button, a, input, textarea, form, [data-no-gesture]")) return;
    const g = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), mode: "none" as const, hold: 0, held: false };
    g.hold = window.setTimeout(() => {
      if (gRef.current !== g) return;
      g.held = true;
      setHolding(true);
    }, HOLD_MS);
    gRef.current = g;
    setPaused(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture bo'lmasa ham ishlaydi */
    }
  }
  function onGestureMove(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gRef.current;
    const card = cardRef.current;
    if (!g || g.id !== e.pointerId || !card) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.mode === "none") {
      if (Math.hypot(dx, dy) < 10) return;
      window.clearTimeout(g.hold);
      g.mode = dy > 0 && Math.abs(dy) > Math.abs(dx) ? "down" : Math.abs(dx) > Math.abs(dy) ? "side" : "none";
      if (g.mode === "none") return;
      setHolding(true);
    }
    if (g.mode === "down") {
      const d = Math.max(0, dy);
      const k = Math.min(1, d / (card.offsetHeight || 800));
      card.style.transform = `translate(${dx * 0.5}px, ${d}px) scale(${1 - k * 0.35})`;
      card.style.borderRadius = `${Math.min(28, 8 + d / 6)}px`;
      if (backdropRef.current) backdropRef.current.style.opacity = String(Math.max(0.15, 1 - k * 1.6));
    }
  }
  function onGestureUp(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gRef.current;
    if (!g || g.id !== e.pointerId) return;
    gRef.current = null;
    window.clearTimeout(g.hold);
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    const dt = Math.max(1, performance.now() - g.t);
    setHolding(false);
    if (g.mode === "down") {
      if (dy > 120 || dy / dt > 0.6) return closeAnimated();
      springBack(cardRef.current, backdropRef.current);
      setPaused(false);
      return;
    }
    setPaused(false);
    if (g.mode === "side") {
      if (Math.abs(dx) > 50 || Math.abs(dx) / dt > 0.4) {
        if (author && dx < 0) onSeen(author.author.id);
        goAuthor(dx < 0 ? ai + 1 : ai - 1, dx < 0 ? 1 : -1);
      }
      return;
    }
    if (g.held || e.type === "pointercancel") return; // bosib turgandan keyin qo'yib yuborish — faqat davom etadi
    const box = cardRef.current?.getBoundingClientRect();
    if (box && e.clientX - box.left < box.width / 3) prev();
    else next();
  }

  // Ko'rildi deb belgilash
  useEffect(() => {
    if (!story || !me || data?.isMe || story.seen) return;
    void fetch(`/api/stories/${story.id}/view`, { method: "POST" }).catch(() => undefined);
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Taymer: rasm/matn — IMAGE_MS; video — o'z vaqti (onTimeUpdate)
  useEffect(() => {
    if (!story || paused || viewers || share) return;
    const isVideo = story.media?.type.startsWith("video/");
    if (isVideo) return;
    startRef.current = performance.now() - elapsedRef.current;
    let raf = 0;
    const tick = () => {
      const el = performance.now() - startRef.current;
      elapsedRef.current = el;
      setProgress(Math.min(1, el / IMAGE_MS));
      if (el >= IMAGE_MS) next();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [story?.id, paused, viewers, share, next]); // eslint-disable-line react-hooks/exhaustive-deps

  // Video va musiqani pauza holati bilan sinxronlash
  useEffect(() => {
    const hold = paused || Boolean(viewers) || share;
    const v = videoRef.current;
    if (v) hold ? v.pause() : void v.play().catch(() => undefined);
    const a = audioRef.current;
    if (a) {
      a.muted = muted;
      if (hold) a.pause();
      else {
        if (story?.music?.start && a.currentTime < story.music.start) a.currentTime = story.music.start;
        void a.play().catch(() => undefined);
      }
    }
  }, [paused, viewers, share, muted, story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAnimated();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function sendDm(body: string) {
    if (!data?.author.username) return;
    if (!me) {
      window.location.href = "/auth/kirish";
      return;
    }
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: data.author.username, body }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!j.ok) throw new Error(j.error);
      showToast("Yuborildi", "success");
    } catch (e) {
      showToast(e instanceof Error && e.message ? e.message : "Yuborilmadi", "error");
    }
  }

  function like() {
    if (!story) return;
    haptic("light");
    setLikePop((n) => n + 1);
    if (liked.has(story.id)) return setLiked((l) => new Set([...l].filter((x) => x !== story.id)));
    setLiked((l) => new Set(l).add(story.id));
    void sendDm("❤️ Story'ingiz yoqdi");
  }

  async function onReply(e: FormEvent) {
    e.preventDefault();
    const t = reply.trim();
    if (!t) return;
    setReply("");
    await sendDm(`↩ Story'ingizga javob: ${t}`);
  }

  async function showViewers() {
    if (!story) return;
    setViewers([]);
    const j = (await fetch(`/api/stories/${story.id}/viewers`).then((r) => r.json()).catch(() => null)) as { data?: { items: Array<{ user: { name: string; avatarUrl: string | null }; at: number }> } } | null;
    setViewers(j?.data?.items ?? []);
  }

  async function remove() {
    if (!story || !confirm("Story o'chirilsinmi?")) return;
    const res = await fetch(`/api/stories/${story.id}`, { method: "DELETE" });
    if (!res.ok) return showToast("O'chirilmadi", "error");
    showToast("O'chirildi", "success");
    if (!data) return;
    const items = data.items.filter((s) => s.id !== story.id);
    if (!items.length) return closeAnimated();
    const nd = { ...data, items };
    cacheRef.current.set(nd.author.id, nd);
    setData(nd);
    setSi(Math.min(si, items.length - 1));
  }

  if (typeof document === "undefined") return null;
  const bg = story && !story.media ? (STORY_BACKGROUNDS[story.bg ?? "coral"] ?? STORY_BACKGROUNDS.coral) : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[136] flex items-center justify-center" style={{ perspective: "1400px" }} role="dialog" aria-modal="true" aria-label={`${author?.author.name ?? ""} story'lari`}>
      <div ref={backdropRef} aria-hidden className="absolute inset-0 bg-black" />
      <div
        ref={cardRef}
        className={cn("relative h-full w-full select-none overflow-hidden bg-[#0b0b0c] [backface-visibility:hidden] sm:aspect-[9/16] sm:h-[min(92vh,880px)] sm:w-auto sm:rounded-[22px]", !viewers && "touch-none")}
        style={{ containerType: "inline-size", WebkitTouchCallout: "none" }}
        onPointerDown={onGestureDown}
        onPointerMove={onGestureMove}
        onPointerUp={onGestureUp}
        onPointerCancel={onGestureUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!data || !story ? (
          <div className="grid h-full place-items-center text-white/70">
            <Spinner />
          </div>
        ) : (
          <>
            {/* Media */}
            {story.media ? (
              story.media.type.startsWith("video/") ? (
                <video
                  key={story.id}
                  ref={videoRef}
                  src={story.media.url}
                  autoPlay
                  playsInline
                  muted={muted || Boolean(story.music)}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (v.duration) setProgress(v.currentTime / v.duration);
                  }}
                  onEnded={next}
                  className={cn("h-full w-full", story.design?.fit === "cover" ? "object-cover" : "object-contain")}
                />
              ) : (
                <>
                  {story.design?.fit !== "cover" && <img src={story.media.url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />}
                  <img key={story.id} src={story.media.url} alt={story.caption ?? "Story"} className={cn("animate-fade-in relative h-full w-full", story.design?.fit === "cover" ? "object-cover" : "object-contain")} />
                </>
              )
            ) : (
              <div className="grid h-full place-items-center p-8" style={{ background: bg }}>
                {!story.design?.text && <p className="text-balance text-center font-display text-[28px] font-extrabold leading-tight text-white drop-shadow">{story.caption}</p>}
              </div>
            )}
            {story.music && <audio key={`a-${story.id}`} ref={audioRef} src={story.music.url} autoPlay loop />}
            {/* Muharrirda qo'yilgan matn: uslubi va joyi bilan (muharrirdagi bilan aynan bir xil chiziladi) */}
            {story.caption && story.design?.text && <StoryText text={story.caption} design={story.design.text} className="pointer-events-none" />}
            {story.media && story.caption && !story.design?.text && (
              // Stiker (so'rovnoma/savol) pastda turadi — u bor bo'lsa izoh yuqoriga ko'chadi (ilgari so'rovnoma izohni yopib qo'yardi)
              <p className={cn("absolute inset-x-6 rounded-2xl bg-black/45 px-4 py-3 text-center text-[16px] font-semibold leading-snug text-white backdrop-blur-sm", story.sticker ? "top-24" : "bottom-28")}>{story.caption}</p>
            )}

            {/* Ekran o'quvchi va klaviatura uchun (sichqoncha/barmoq — karta imo-ishoralari) */}
            <button type="button" className="sr-only" onClick={prev}>
              Oldingi story
            </button>
            <button type="button" className="sr-only" onClick={next}>
              Keyingi story
            </button>

            {/* Tepa: progress + muallif + boshqaruv */}
            <div className={cn("absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-3 pb-8 pt-[calc(env(safe-area-inset-top)+0.6rem)] transition-opacity duration-200", holding && "pointer-events-none opacity-0")}>
              <div className="flex gap-1">
                {data.items.map((s, i) => (
                  <span key={s.id} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/35">
                    <span className="block h-full origin-left rounded-full bg-white" style={{ transform: `scaleX(${i < si ? 1 : i === si ? progress : 0})` }} />
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2.5 text-white">
                <Link href={data.author.slug ? `/mutaxassislar/${data.author.slug}` : "#"} className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={data.author.name} src={data.author.avatarUrl} size={34} decorative />
                  <span className="truncate text-[14px] font-semibold">{data.author.name}</span>
                </Link>
                <span className="shrink-0 text-[12.5px] text-white/65"><Ago at={story.createdAt} /></span>
                {story.music && (
                  <span className="hidden min-w-0 items-center gap-1 truncate text-[12px] text-white/75 sm:inline-flex">
                    <Music2 size={12} /> {story.music.title}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1">
                  <button type="button" onClick={() => setPaused((v) => !v)} aria-label={paused ? "Davom etish" : "Pauza"} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
                    {paused ? <Play size={18} /> : <Pause size={18} />}
                  </button>
                  {(story.music || story.media?.type.startsWith("video/")) && (
                    <button type="button" onClick={() => setMuted((v) => !v)} aria-label={muted ? "Ovozni yoqish" : "Ovozni o'chirish"} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
                      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                  )}
                  <button type="button" onClick={closeAnimated} aria-label="Yopish" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
                    <X size={22} />
                  </button>
                </span>
              </div>
              {story.music && (
                <p className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-[12px] text-white/75 sm:hidden">
                  <Music2 size={12} /> {story.music.title}
                  {story.music.artist ? ` — ${story.music.artist}` : ""}
                </p>
              )}
            </div>

            {/* Stiker (so'rovnoma / savol / hisoblagich / havola) — media ustida, pastki paneldan yuqorida */}
            {story.sticker && (
              <div
                className={cn("pointer-events-auto absolute inset-x-0 flex justify-center px-4", story.design?.stickerY == null && "bottom-[calc(env(safe-area-inset-bottom)+4.75rem)]")}
                style={story.design?.stickerY != null ? { top: `${Math.min(0.8, Math.max(0.14, story.design.stickerY)) * 100}%`, transform: "translateY(-50%)" } : undefined}
                data-no-gesture
              >
                <StoryStickerCard storyId={story.id} sticker={story.sticker} isMe={data.isMe} onBusy={setPaused} />
              </div>
            )}

            {burst && (
              <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 animate-pop text-[96px] leading-none drop-shadow-xl">
                {burst}
              </span>
            )}
            {/* Pastki panel */}
            <div className={cn("absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-10 transition-opacity duration-200", holding && "pointer-events-none opacity-0")}>
              {data.isMe ? (
                <div className="flex items-center gap-2 text-white">
                  <button type="button" onClick={() => void showViewers()} className="inline-flex h-11 items-center gap-2 rounded-full bg-white/12 px-4 text-[14px] font-semibold backdrop-blur-md hover:bg-white/20">
                    <Eye size={17} /> {story.viewsCount ?? 0} ko&apos;rdi
                  </button>
                  <button type="button" onClick={() => setShare(true)} aria-label="Ulashish" className="ml-auto grid h-11 w-11 place-items-center rounded-full bg-white/12 backdrop-blur-md hover:bg-white/20">
                    <Send size={18} />
                  </button>
                  <button type="button" onClick={() => void remove()} aria-label="O'chirish" className="grid h-11 w-11 place-items-center rounded-full bg-white/12 backdrop-blur-md hover:bg-white/20">
                    <Trash2 size={18} />
                  </button>
                </div>
              ) : (
                <form onSubmit={onReply} className="relative flex items-center gap-2">
                  {replyFocus && data.author.username && (
                    /* pointerdown — blur'dan oldin ishlaydi (qator yo'qolib ketmasin) */
                    <div className="pop-in absolute inset-x-0 bottom-full mb-3 flex justify-around px-1" role="group" aria-label="Tez reaksiya">
                      {QUICK.map((x) => (
                        <button key={x} type="button" aria-label={`Reaksiya ${x}`} onPointerDown={(e) => { e.preventDefault(); quickReact(x); }} className="press grid h-12 w-12 place-items-center rounded-full transition hover:scale-110">
                          <EmojiSticker e={x} size={36} />
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onFocus={() => { setPaused(true); setReplyFocus(true); }}
                    onBlur={() => { setPaused(false); setReplyFocus(false); }}
                    maxLength={500}
                    placeholder={data.author.username ? `${data.author.name.split(" ")[0]}ga javob…` : "Javob yozib bo'lmaydi"}
                    disabled={!data.author.username}
                    aria-label="Javob yozish"
                    className="h-11 min-w-0 flex-1 rounded-full border border-white/35 bg-transparent px-4 text-[14px] text-white placeholder:text-white/60 focus:border-white focus:outline-none"
                  />
                  <button type="button" onClick={like} aria-label="Yoqdi" aria-pressed={liked.has(story.id)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white hover:bg-white/10">
                    <Heart key={likePop} size={24} className={cn(likePop > 0 && "animate-heartbeat", liked.has(story.id) && "fill-[#ff3040] text-[#ff3040]")} />
                  </button>
                  <button type="button" onClick={() => setShare(true)} aria-label="Ulashish" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white hover:bg-white/10">
                    <Send size={22} />
                  </button>
                </form>
              )}
            </div>

            {/* Kim ko'rdi (egasiga) */}
            {viewers && (
              <div data-no-gesture className="sheet-in absolute inset-x-0 bottom-0 max-h-[60%] overflow-y-auto rounded-t-[22px] bg-surface p-4 text-fg">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[15px] font-bold">Ko&apos;rganlar · {viewers.length}</p>
                  <button type="button" onClick={() => setViewers(null)} aria-label="Yopish" className="grid h-9 w-9 place-items-center rounded-full hover:bg-fg/6">
                    <X size={18} />
                  </button>
                </div>
                {viewers.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-fg-3">Hali hech kim ko&apos;rmadi</p>
                ) : (
                  <ul className="space-y-3">
                    {viewers.map((v, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <Avatar name={v.user.name} src={v.user.avatarUrl} size={36} decorative />
                        <span className="flex-1 truncate text-[14px] font-medium">{v.user.name}</span>
                        <span className="text-[12px] text-fg-4"><Ago at={v.at} /></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {share && data && <ShareSheet open onClose={() => setShare(false)} loggedIn={Boolean(me)} title={`${data.author.name} story'si`} url={data.author.slug ? `/mutaxassislar/${data.author.slug}` : "/"} />}
      <span className={cn("sr-only")} aria-live="polite">
        {story ? `${si + 1} / ${data?.items.length ?? 0}` : ""}
      </span>
    </div>,
    document.body,
  );
}
