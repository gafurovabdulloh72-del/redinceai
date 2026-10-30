"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Eye, Heart, Music2, Pause, Play, Send, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { Avatar, Spinner } from "@/components/ui";
import { ShareSheet } from "@/components/social/ShareSheet";
import { StoryStickerCard } from "./StorySticker";
import { showToast } from "@/components/ui/toast";
import { useScrollLock } from "@/components/motion/useScrollLock";
import { STORY_BACKGROUNDS } from "@/lib/social/limits";
import { cn, timeAgo } from "@/lib/utils";
import type { AuthorStories, StoryRailItem } from "@/lib/stories/types";

const IMAGE_MS = 5500;

/**
 * Story ko'ruvchi (Instagram uslubi): to'liq ekran (portal), tepada progress chiziqlari, chap/o'ng bosish — oldingi/keyingi,
 * bosib turish — pauza, muallif tugagach keyingi muallifga o'tadi. Rasm/matn 5.5 s, video — o'z davomiyligi; musiqa chalinadi.
 * Pastda: javob yozish (DM), ❤️ tez reaksiya (DM), ulashish. Egasiga: ko'rishlar soni, kim ko'rgani va o'chirish.
 */
export function StoryViewer({ rail, startIndex, me, onClose, onSeen }: { rail: StoryRailItem[]; startIndex: number; me: { id: string } | null; onClose: () => void; onSeen: (authorId: string) => void }) {
  const [ai, setAi] = useState(startIndex);
  const [data, setData] = useState<AuthorStories | null>(null);
  const [si, setSi] = useState(0);
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

  // Muallif story'larini yuklash; birinchi ko'rilmaganidan boshlash
  useEffect(() => {
    if (!author) return;
    let off = false;
    setData(null);
    setViewers(null);
    fetch(`/api/stories/user/${author.author.id}`)
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: AuthorStories }) => {
        if (off) return;
        if (!j.ok || !j.data) return next();
        setData(j.data);
        const first = j.data.items.findIndex((s) => !s.seen);
        setSi(first === -1 ? 0 : first);
      })
      .catch(() => !off && next());
    return () => {
      off = true;
    };
  }, [ai]); // eslint-disable-line react-hooks/exhaustive-deps

  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const next = useCallback(() => {
    setProgress(0);
    elapsedRef.current = 0;
    setData((d) => {
      if (d && si < d.items.length - 1) {
        setSi(si + 1);
        return d;
      }
      if (author) onSeen(author.author.id);
      if (ai < rail.length - 1) setAi(ai + 1);
      else onClose();
      return d;
    });
  }, [si, ai, rail.length, author, onClose, onSeen]);

  const prev = () => {
    setProgress(0);
    elapsedRef.current = 0;
    if (si > 0) setSi(si - 1);
    else if (ai > 0) setAi(ai - 1);
  };

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
      if (e.key === "Escape") onClose();
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
    setData((d) => {
      if (!d) return d;
      const items = d.items.filter((s) => s.id !== story.id);
      if (!items.length) {
        onClose();
        return d;
      }
      setSi(Math.min(si, items.length - 1));
      return { ...d, items };
    });
  }

  if (typeof document === "undefined") return null;
  const bg = story && !story.media ? (STORY_BACKGROUNDS[story.bg ?? "coral"] ?? STORY_BACKGROUNDS.coral) : undefined;

  return createPortal(
    <div className="overlay-in fixed inset-0 z-[136] flex items-center justify-center bg-black" role="dialog" aria-modal="true" aria-label={`${author?.author.name ?? ""} story'lari`}>
      <div
        className="relative h-full w-full overflow-hidden bg-[#0b0b0c] sm:h-[min(92vh,880px)] sm:w-auto sm:aspect-[9/16] sm:rounded-[22px]"
        /* Instagram imo-ishoralari: pastga surish — yopish, chapga/o'ngga — keyingi/oldingi. Oddiy bosish zonalariga tegmaydi */
        onTouchStart={(e) => {
          const t0 = e.touches[0];
          swipeRef.current = { x: t0.clientX, y: t0.clientY };
        }}
        onTouchEnd={(e) => {
          const st = swipeRef.current;
          swipeRef.current = null;
          if (!st) return;
          const t0 = e.changedTouches[0];
          const dx = t0.clientX - st.x;
          const dy = t0.clientY - st.y;
          if (dy > 90 && Math.abs(dx) < 80) return onClose();
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
            e.preventDefault();
            if (dx < 0) next();
            else prev();
          }
        }}
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
                  className="h-full w-full object-contain"
                />
              ) : (
                <>
                  <img src={story.media.url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
                  <img key={story.id} src={story.media.url} alt={story.caption ?? "Story"} className="animate-fade-in relative h-full w-full object-contain" />
                </>
              )
            ) : (
              <div className="grid h-full place-items-center p-8" style={{ background: bg }}>
                <p className="text-balance text-center font-display text-[28px] font-extrabold leading-tight text-white drop-shadow">{story.caption}</p>
              </div>
            )}
            {story.music && <audio key={`a-${story.id}`} ref={audioRef} src={story.music.url} autoPlay loop />}
            {story.media && story.caption && (
              <p className="absolute inset-x-6 bottom-28 rounded-2xl bg-black/45 px-4 py-3 text-center text-[16px] font-semibold leading-snug text-white backdrop-blur-sm">{story.caption}</p>
            )}

            {/* Bosish zonalari: chap — oldingi, o'ng — keyingi, bosib turish — pauza */}
            <button type="button" aria-label="Oldingi" className="absolute inset-y-16 left-0 w-1/3" onClick={prev} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)} />
            <button type="button" aria-label="Keyingi" className="absolute inset-y-16 right-0 w-2/3" onClick={next} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)} />

            {/* Tepa: progress + muallif + boshqaruv */}
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-3 pb-8 pt-[calc(env(safe-area-inset-top)+0.6rem)]">
              <div className="flex gap-1">
                {data.items.map((s, i) => (
                  <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                    <span className="block h-full rounded-full bg-white" style={{ width: `${i < si ? 100 : i === si ? progress * 100 : 0}%` }} />
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2.5 text-white">
                <Link href={data.author.slug ? `/mutaxassislar/${data.author.slug}` : "#"} className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={data.author.name} src={data.author.avatarUrl} size={34} decorative />
                  <span className="truncate text-[14px] font-semibold">{data.author.name}</span>
                </Link>
                <span className="shrink-0 text-[12.5px] text-white/65">{timeAgo(story.createdAt)}</span>
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
                  <button type="button" onClick={onClose} aria-label="Yopish" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
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
              <div className="pointer-events-auto absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] flex justify-center px-4" onPointerDown={(e) => e.stopPropagation()}>
                <StoryStickerCard storyId={story.id} sticker={story.sticker} isMe={data.isMe} onBusy={setPaused} />
              </div>
            )}

            {burst && (
              <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 animate-pop text-[96px] leading-none drop-shadow-xl">
                {burst}
              </span>
            )}
            {/* Pastki panel */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-10">
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
                        <button key={x} type="button" aria-label={`Reaksiya ${x}`} onPointerDown={(e) => { e.preventDefault(); quickReact(x); }} className="press grid h-12 w-12 place-items-center rounded-full text-[30px] leading-none transition hover:scale-110">
                          {x}
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
                  <button type="button" onClick={() => void sendDm("❤️ Story'ingiz yoqdi")} aria-label="Yoqdi" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white hover:bg-white/10">
                    <Heart size={24} />
                  </button>
                  <button type="button" onClick={() => setShare(true)} aria-label="Ulashish" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white hover:bg-white/10">
                    <Send size={22} />
                  </button>
                </form>
              )}
            </div>

            {/* Kim ko'rdi (egasiga) */}
            {viewers && (
              <div className="sheet-in absolute inset-x-0 bottom-0 max-h-[60%] overflow-y-auto rounded-t-[22px] bg-surface p-4 text-fg">
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
                        <span className="text-[12px] text-fg-4">{timeAgo(v.at)}</span>
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
