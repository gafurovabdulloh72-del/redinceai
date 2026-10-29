"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Crown, Eye, Heart, MessageCircle, MessageSquareText, Music2, Pause, Play, Send, Volume2, VolumeX } from "lucide-react";
import { Avatar, Spinner, VerifiedBadge } from "@/components/ui";
import { ShareSheet } from "@/components/social/ShareSheet";
import { CommentsSheet } from "./CommentsSheet";
import { showToast } from "@/components/ui/toast";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { compactCount, cn } from "@/lib/utils";
import type { ReelItem, ReelsMode } from "@/lib/reels";

const TABS: Array<{ key: ReelsMode; label: string }> = [
  { key: "foryou", label: "Siz uchun" },
  { key: "new", label: "Yangi" },
  { key: "top", label: "Top hafta" },
];

type Me = { id: string; username: string | null } | null;

/**
 * Reels (Instagram/TikTok uslubi): ekran bo'yi vertikal slaydlar (scroll-snap). Tepada tablar — «Siz uchun» (trend), «Yangi», «Top hafta».
 * Har slayd: video (ko'rinishda avtomatik, ovoz — bitta umumiy tugma) yoki rasm(lar) + musiqa; o'ngda amal ustuni (profil, ❤️, izoh,
 * saqlash, ulashish); pastda muallif, matn, musiqa nomi va «Yozish» (ijodkor bilan chat) tugmasi. Mehmon amal qilsa — kirishga.
 */
export function ReelsFeed({ initial, initialCursor, initialMode, me, pinnedKey }: { initial: ReelItem[]; initialCursor: string | null; initialMode: ReelsMode; me: Me; pinnedKey?: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<ReelsMode>(initialMode);
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(initial[0]?.key ?? null);
  const [comments, setComments] = useState<ReelItem | null>(null);
  const [share, setShare] = useState<ReelItem | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const reqId = useRef(0);
  // Tab keshi: almashganda tayyor ro'yxat darhol ko'rinadi (so'rov kutilmaydi); boshqa tablar fonda oldindan yuklanadi
  const cache = useRef(new Map<ReelsMode, { items: ReelItem[]; cursor: string | null }>());

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches || document.documentElement.dataset.motion === "reduce");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActiveKey((e.target as HTMLElement).dataset.reel ?? null);
      },
      { root, threshold: 0.6 },
    );
    for (const el of root.querySelectorAll<HTMLElement>("[data-reel]")) io.observe(el);
    return () => io.disconnect();
  }, [items.length, mode]);

  const load = useCallback(
    async (m: ReelsMode, c: string | null, replace: boolean) => {
      if (busy.current && !replace) return;
      busy.current = true;
      const req = ++reqId.current;
      setLoading(true);
      try {
        const res = await fetch(`/api/reels?mode=${m}${c ? `&cursor=${encodeURIComponent(c)}` : ""}`);
        const j = (await res.json()) as { ok: boolean; data?: { items: ReelItem[]; nextCursor: string | null } };
        if (!j.ok || !j.data) throw new Error();
        const data = j.data;
        if (req !== reqId.current) return; // eskirgan javob (tab almashgan)
        setItems((prev) => {
          if (replace) return data.items;
          const seen = new Set(prev.map((i) => i.key));
          return [...prev, ...data.items.filter((i) => !seen.has(i.key))];
        });
        setCursor(data.nextCursor);
        if (replace) {
          setActiveKey(data.items[0]?.key ?? null);
          containerRef.current?.scrollTo({ top: 0 });
        }
      } catch {
        showToast("Yuklanmadi — qayta urinib ko'ring", "error");
      } finally {
        if (req === reqId.current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const root = containerRef.current;
    const el = sentinelRef.current;
    if (!root || !el || !cursor) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && load(mode, cursor, false), { root, rootMargin: "150% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, mode, load, items.length]);

  useEffect(() => {
    if (items.length > 0) cache.current.set(mode, { items, cursor });
  }, [mode, items, cursor]);

  /**
   * Klaviatura boshqaruvi (2026-10-29): ↑/↓ yoki j/k — oldingi/keyingi reels,
   * Home/End — birinchi/oxirgi. Ilgari reels faqat sichqoncha g'ildiragi yoki barmoq
   * bilan aylanardi; kompyuterda ko'rayotgan odam uchun qisqartma yo'q edi.
   * Matn maydoniga (izoh) yozayotganda qisqartmalar o'chadi.
   */
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-reel]"));
      if (slides.length === 0) return;
      // Joriy slayd — ko'rinish markaziga eng yaqini
      const mid = root.scrollTop + root.clientHeight / 2;
      let cur = 0;
      let best = Infinity;
      slides.forEach((el, i) => {
        const d = Math.abs(el.offsetTop + el.clientHeight / 2 - mid);
        if (d < best) { best = d; cur = i; }
      });
      let next: number | null = null;
      if (e.key === "ArrowDown" || e.key === "j") next = Math.min(cur + 1, slides.length - 1);
      else if (e.key === "ArrowUp" || e.key === "k") next = Math.max(cur - 1, 0);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = slides.length - 1;
      if (next === null || next === cur) return;
      e.preventDefault();
      slides[next].scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length]);

  // Boshqa tablarni bo'sh vaqtda oldindan yuklab qo'yamiz
  useEffect(() => {
    const run = () => {
      for (const m of ["foryou", "new", "top"] as ReelsMode[]) {
        if (m === mode || cache.current.has(m)) continue;
        void fetch(`/api/reels?mode=${m}`)
          .then((r) => r.json())
          .then((j: { ok: boolean; data?: { items: ReelItem[]; nextCursor: string | null } }) => {
            if (j.ok && j.data && !cache.current.has(m)) {
              cache.current.set(m, { items: j.data.items, cursor: j.data.nextCursor });
              warm(j.data.items[0]);
            }
          })
          .catch(() => undefined);
      }
    };
    // Darhol (kechikmasdan) — foydalanuvchi tez bosishi mumkin; faol videoning yuklanishi bilan poygalashmasligi uchun qisqa pauza
    const t = window.setTimeout(run, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchMode = (m: ReelsMode) => {
    if (m === mode) return;
    setMode(m);
    const hit = cache.current.get(m);
    if (hit) {
      setItems(hit.items);
      setCursor(hit.cursor);
      setActiveKey(hit.items[0]?.key ?? null);
      containerRef.current?.scrollTo({ top: 0 });
    }
    const url = new URL(window.location.href);
    if (m === "foryou") url.searchParams.delete("tab");
    else url.searchParams.set("tab", m);
    url.searchParams.delete("post");
    window.history.replaceState(null, "", url.toString());
    if (!hit) {
      // Kesh yo'q: eski ro'yxat turib qolmasin — darhol bo'shatamiz (yuklanish belgisi chiqadi)
      setItems([]);
      setCursor(null);
      void load(m, null, true);
    }
  };

  const needLogin = () => {
    router.push(`/auth/kirish?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  };

  const patch = (key: string, p: Partial<ReelItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function like(it: ReelItem) {
    if (!me) return needLogin();
    if (!it.postId) return;
    const was = it.myReaction;
    patch(it.key, { myReaction: was ? null : "heart", likesCount: it.likesCount + (was ? -1 : 1) });
    try {
      const res = await fetch(`/api/posts/${it.postId}/like`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reaction: was ?? "heart" }) });
      const j = (await res.json()) as { ok: boolean; data?: { likesCount: number; myReaction: ReelItem["myReaction"] }; error?: string };
      if (!j.ok || !j.data) throw new Error(j.error);
      patch(it.key, { likesCount: j.data.likesCount, myReaction: j.data.myReaction });
    } catch (e) {
      patch(it.key, { myReaction: was, likesCount: it.likesCount });
      showToast(e instanceof Error && e.message ? e.message : "Bo'lmadi", "error");
    }
  }

  async function save(it: ReelItem) {
    if (!me) return needLogin();
    if (!it.postId) return;
    const was = it.savedByMe;
    patch(it.key, { savedByMe: !was, savesCount: it.savesCount + (was ? -1 : 1) });
    try {
      const res = await fetch(`/api/posts/${it.postId}/save`, { method: "POST" });
      const j = (await res.json()) as { ok: boolean; data?: { saved: boolean } };
      if (!j.ok || !j.data) throw new Error();
      showToast(j.data.saved ? "Saqlanganlarga qo'shildi" : "Saqlanganlardan olindi", "success");
    } catch {
      patch(it.key, { savedByMe: was, savesCount: it.savesCount });
    }
  }

  return (
    <div className="relative">
      {/* Tablar — slaydlar ustida, shisha kapsula (absolute: sahifa o'tish transformi `fixed`ni qamab qo'yadi) */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 flex justify-center md:top-9">
        <div role="tablist" aria-label="Reels bo'limlari" className="pointer-events-auto flex gap-1 rounded-full border border-white/15 bg-black/45 p-1 backdrop-blur-md">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={mode === t.key}
              onClick={() => switchMode(t.key)}
              className={cn("press h-9 rounded-full px-4 text-[13.5px] font-semibold transition", mode === t.key ? "bg-white text-black" : "text-white/80 hover:text-white")}
            >
              {t.key === "top" && <Crown size={13} className="-mt-0.5 mr-1 inline" aria-hidden="true" />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="no-scrollbar h-[100svh] snap-y snap-mandatory overflow-y-auto bg-black" aria-label="Reels">
        {items.length === 0 && !loading && (
          <div className="grid h-[100svh] place-items-center px-6 text-center text-white/70">
            <div>
              <p className="font-display text-[20px] font-bold text-white">Hozircha bo'sh</p>
              <p className="mt-2 text-[14px]">Bu bo'limda hali post yo'q — boshqa tabni tanlang.</p>
            </div>
          </div>
        )}
        {items.map((it, idx) => (
          <ReelSlide
            key={it.key}
            item={it}
            active={it.key === activeKey}
            near={Math.abs(idx - Math.max(0, items.findIndex((x) => x.key === activeKey))) <= 1}
            pinned={it.key === pinnedKey}
            reduced={reduced}
            soundOn={soundOn}
            me={me}
            onSound={() => setSoundOn((v) => !v)}
            onLike={() => void like(it)}
            onSave={() => void save(it)}
            onComments={() => (it.postId ? setComments(it) : undefined)}
            onShare={() => setShare(it)}
            onNeedLogin={needLogin}
          />
        ))}
        <div ref={sentinelRef} className="grid h-24 snap-start place-items-center text-white/60">
          {loading ? <Spinner /> : !cursor && items.length > 0 ? <span className="text-[13px]">Hammasini ko'rdingiz ✨</span> : null}
        </div>
      </div>

      {comments?.postId && (
        <CommentsSheet
          postId={comments.postId}
          open
          onClose={() => setComments(null)}
          loggedIn={Boolean(me)}
          onCount={(n) => patch(comments.key, { commentsCount: n })}
        />
      )}
      {share && (
        <ShareSheet
          open
          onClose={() => setShare(null)}
          loggedIn={Boolean(me)}
          title={share.caption.slice(0, 80) || `${share.author.name} — Kasb Egalari`}
          url={share.postId ? `/lenta?post=${share.postId}` : share.author.slug ? `/mutaxassislar/${share.author.slug}` : "/lenta"}
        />
      )}
    </div>
  );
}

/** Tab almashganda birinchi video darhol chiqishi uchun uning boshini (512 KB) brauzer keshiga yuklab qo'yamiz */
function warm(it: ReelItem | undefined) {
  if (!it) return;
  try {
    if (it.mediaType === "video") void fetch(it.mediaUrl, { headers: { Range: "bytes=0-524287" } }).catch(() => undefined);
    else void (new Image().src = it.mediaUrl);
    if (it.posterUrl) void (new Image().src = it.posterUrl);
  } catch {}
}

/* ------------------------------------------------------------------ */
function ReelSlide({
  item,
  active,
  near,
  pinned,
  reduced,
  soundOn,
  me,
  onSound,
  onLike,
  onSave,
  onComments,
  onShare,
  onNeedLogin,
}: {
  item: ReelItem;
  active: boolean;
  /** Faol slayd yoki uning qo'shnisi — videoni oldindan yuklaydi */
  near: boolean;
  pinned: boolean;
  reduced: boolean;
  soundOn: boolean;
  me: Me;
  onSound: () => void;
  onLike: () => void;
  onSave: () => void;
  onComments: () => void;
  onShare: () => void;
  onNeedLogin: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  /** Davom ettirilganda qisqa «Play» belgisi */
  const [flash, setFlash] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [burst, setBurst] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const viewed = useRef(false);
  const isMe = me?.id === item.author.id;
  const cat = item.author.category ? CATEGORY_BY_SLUG[item.author.category] : undefined;
  const images = item.mediaType === "image" ? [item.mediaUrl, ...item.extraImages] : [];

  // Video: ko'rinishda o'ynaydi; rasm + musiqa: ko'rinishda va ovoz yoqilganda chalinadi
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.muted = !soundOn;
      if (active && !reduced) v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      else {
        v.pause();
        setPlaying(false);
      }
    }
    const a = audioRef.current;
    if (a) {
      if (active && soundOn) {
        if (item.music?.start && a.currentTime < item.music.start) a.currentTime = item.music.start;
        void a.play().catch(() => undefined);
      } else a.pause();
    }
  }, [active, reduced, soundOn, item.music?.start]);

  // Ko'rish hisobi: 1.2 s faol tursa (sessiyada bir marta)
  useEffect(() => {
    if (!active || viewed.current || !item.postId) return;
    const t = window.setTimeout(() => {
      viewed.current = true;
      try {
        const k = `kv:${item.postId}`;
        if (sessionStorage.getItem(k)) return;
        sessionStorage.setItem(k, "1");
      } catch {}
      void fetch(`/api/posts/${item.postId}/view`, { method: "POST" }).catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [active, item.postId]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return onSound();
    if (v.paused) {
      v.play().then(() => setPlaying(true)).catch(() => undefined);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 600);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  // Ikki marta bosish — yurak (Instagram odati)
  const lastTap = useRef(0);
  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 240 && item.postId) {
      if (!item.myReaction) onLike();
      setBurst(true);
      window.setTimeout(() => setBurst(false), 700);
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    window.setTimeout(() => {
      if (lastTap.current === now) item.mediaType === "video" ? togglePlay() : onSound();
    }, 250);
  };

  const chatHref = item.author.username ? `/yozish/${item.author.username}` : null;

  return (
    <section data-reel={item.key} className="relative flex h-[100svh] snap-start items-center justify-center md:py-6">
      <div className="relative h-full w-full overflow-hidden bg-[#0b0b0c] md:aspect-[9/16] md:h-full md:max-h-[880px] md:w-auto md:rounded-[26px] md:border md:border-white/10">
        {item.mediaType === "video" ? (
          <video ref={videoRef} src={`${item.mediaUrl}#t=0.1`} poster={item.posterUrl ?? undefined} preload={active ? "auto" : near ? "metadata" : "none"} playsInline loop muted onClick={onTap} className="h-full w-full cursor-pointer object-contain" />
        ) : (
          <div className="relative h-full w-full" onClick={onTap}>
            {/* Orqa fon: rasmning xira nusxasi (har xil o'lchamdagi rasm chiroyli turadi) */}
            <img src={images[imgIdx]} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
            <img src={images[imgIdx]} alt={item.caption.slice(0, 80) || "Post rasmi"} className="relative h-full w-full object-contain" />
            {images.length > 1 && (
              <>
                <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] flex justify-center gap-1 md:top-4">
                  {images.map((_, i) => (
                    <span key={i} className={cn("h-1.5 rounded-full transition-all", i === imgIdx ? "w-5 bg-white" : "w-1.5 bg-white/50")} />
                  ))}
                </div>
                <button type="button" aria-label="Oldingi rasm" onClick={(e) => (e.stopPropagation(), setImgIdx((i) => Math.max(0, i - 1)))} className="absolute inset-y-0 left-0 w-1/4" />
                <button type="button" aria-label="Keyingi rasm" onClick={(e) => (e.stopPropagation(), setImgIdx((i) => Math.min(images.length - 1, i + 1)))} className="absolute inset-y-0 right-0 w-1/4" />
              </>
            )}
          </div>
        )}
        {item.music && <audio ref={audioRef} src={item.music.url} loop preload="none" />}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent" aria-hidden="true" />

        {burst && <Heart size={110} className="animate-heartbeat pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 fill-white text-white drop-shadow-xl" aria-hidden="true" />}

        {/* Ovoz */}
        {(item.mediaType === "video" || item.music) && (
          <button type="button" onClick={onSound} aria-label={soundOn ? "Ovozni o'chirish" : "Ovozni yoqish"} className="absolute right-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-10 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md md:top-4">
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        )}
        {item.mediaType === "video" && active && !playing && (
          <button type="button" onClick={togglePlay} aria-label="Davom ettirish" className="absolute left-1/2 top-1/2 z-10 grid h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 animate-pop place-items-center rounded-full bg-black/45 text-white backdrop-blur-md">
            <Pause size={30} className="fill-white" />
          </button>
        )}
        {item.mediaType === "video" && playing && flash && (
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 animate-fade-in place-items-center rounded-full bg-black/45 text-white backdrop-blur-md">
            <Play size={30} className="ml-1 fill-white" />
          </span>
        )}

        {/* Top o'rni */}
        {item.rank !== null && (
          <span className={cn("absolute left-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-10 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-extrabold md:top-4", item.rank <= 3 ? "bg-[linear-gradient(135deg,#ffd76a,#f39c2a)] text-black" : "bg-black/50 text-white backdrop-blur-md")}>
            <Crown size={13} aria-hidden="true" /> #{item.rank}
          </span>
        )}
        {pinned && item.rank === null && <span className="absolute left-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-10 rounded-full bg-black/50 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-md md:top-4">Sizga ulashildi</span>}

        {/* O'ng amal ustuni */}
        <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+11.5rem)] right-2.5 z-10 flex flex-col items-center gap-4 text-white md:bottom-40">
          <Link href={item.author.slug ? `/mutaxassislar/${item.author.slug}` : "#"} aria-label={`${item.author.name} profili`} className="press">
            <Avatar name={item.author.name} src={item.author.avatarUrl} size={46} decorative className="!ring-2 !ring-white" />
          </Link>
          {item.postId && (
            <>
              <ActionBtn label="Yoqtirish" count={item.likesCount} onClick={onLike} active={Boolean(item.myReaction)}>
                <Heart size={30} className={cn("transition", item.myReaction ? "fill-[#ff3b5c] text-[#ff3b5c]" : "")} />
              </ActionBtn>
              <ActionBtn label="Izohlar" count={item.commentsCount} onClick={onComments}>
                <MessageCircle size={29} />
              </ActionBtn>
              <ActionBtn label="Saqlash" count={item.savesCount} onClick={onSave} active={item.savedByMe}>
                <Bookmark size={28} className={item.savedByMe ? "fill-white" : ""} />
              </ActionBtn>
            </>
          )}
          <ActionBtn label="Ulashish" onClick={onShare}>
            <Send size={27} />
          </ActionBtn>
        </div>

        {/* Pastki qism */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-24 md:pb-5">
          <div className="space-y-3 px-4 pr-16 text-white">
            <Link href={item.author.slug ? `/mutaxassislar/${item.author.slug}` : "#"} className="group flex items-center gap-2.5">
              <Avatar name={item.author.name} src={item.author.avatarUrl} size={34} decorative className="shrink-0 !ring-2 !ring-white/80" />
              <span className="truncate font-display text-[15.5px] font-bold group-hover:underline">{item.author.name}</span>
              {item.author.isVerified && <VerifiedBadge size={15} />}
              {cat && <span className="truncate text-[12.5px] text-white/65">· {cat.name}</span>}
            </Link>
            {item.caption && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className={cn("block text-left text-[14px] leading-snug text-white/90", !expanded && "line-clamp-2")}>
                {item.caption}
              </button>
            )}
            <div className="flex items-center gap-3 text-[12.5px] text-white/70">
              {item.music && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Music2 size={13} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {item.music.title}
                    {item.music.artist ? ` — ${item.music.artist}` : ""}
                  </span>
                </span>
              )}
              {item.postId && item.viewsCount > 0 && (
                <span className="inline-flex shrink-0 items-center gap-1">
                  <Eye size={13} aria-hidden="true" /> {compactCount(item.viewsCount)}
                </span>
              )}
            </div>
            {!isMe && (
              <div className="flex gap-2 pt-0.5">
                {chatHref ? (
                  me ? (
                    <Link href={chatHref} className="btn-accent inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[14px] font-semibold">
                      <MessageSquareText size={17} /> Ijodkorga yozish
                    </Link>
                  ) : (
                    <button type="button" onClick={onNeedLogin} className="btn-accent inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[14px] font-semibold">
                      <MessageSquareText size={17} /> Ijodkorga yozish
                    </button>
                  )
                ) : null}
                {item.author.slug && (
                  <Link href={`/mutaxassislar/${item.author.slug}`} className="inline-flex h-11 items-center justify-center rounded-full border border-white/30 bg-white/10 px-5 text-[14px] font-semibold backdrop-blur-sm transition hover:bg-white/20">
                    Profil
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ActionBtn({ label, count, onClick, active, children }: { label: string; count?: number; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={active} className="press flex flex-col items-center gap-1 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
      {children}
      {count !== undefined && <span className="text-[12.5px] font-semibold tabular-nums">{count > 0 ? compactCount(count) : ""}</span>}
    </button>
  );
}
