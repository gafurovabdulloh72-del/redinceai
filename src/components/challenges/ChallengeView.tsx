"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Crown, Heart, ImagePlus, Loader2, Play, Trophy } from "lucide-react";
import { Avatar } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/toast";
import { SafeImage } from "@/components/specialists/SafeImage";
import type { ChallengeDetail, ChallengeEntryView } from "@/lib/challenges/service";
import { cn, compactCount } from "@/lib/utils";

/**
 * Konkurs sahifasining interaktiv qismi: ishlar to'ri (ovoz berish — optimistik, 1 ovoz,
 * qayta bosish bekor qiladi, boshqa ishga bosish ko'chiradi) va «Ishtirok etish» varag'i
 * (o'zining ommaviy media'li postini tanlaydi). Mehmon bosganda kirish sahifasiga.
 */

type EligiblePost = { id: string; body: string; thumbUrl: string | null; isVideo: boolean; createdAt: number };
type Api<T> = { ok: true; data: T } | { ok: false; error: string };

export function ChallengeView({ initial, authed }: { initial: ChallengeDetail; authed: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [entries, setEntries] = useState<ChallengeEntryView[]>(initial.entries);
  const [myVote, setMyVote] = useState<string | null>(initial.myVoteEntryId);
  const [joined, setJoined] = useState<boolean>(Boolean(initial.myEntryId));
  const [voteBusy, setVoteBusy] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [posts, setPosts] = useState<EligiblePost[] | null>(null);
  const [joinBusy, setJoinBusy] = useState<string | null>(null);
  const open = initial.state === "open";
  const login = `/auth/kirish?next=${encodeURIComponent(`/konkurs/${initial.id}`)}`;

  useEffect(() => {
    if (!pickOpen || posts !== null) return;
    void (async () => {
      try {
        const res = await fetch(`/api/konkurs/${initial.id}/qatnashish`);
        const j = (await res.json()) as Api<{ items: EligiblePost[] }>;
        setPosts(j.ok ? j.data.items : []);
      } catch {
        setPosts([]);
      }
    })();
  }, [pickOpen, posts, initial.id]);

  const vote = async (entry: ChallengeEntryView) => {
    if (!authed) return router.push(login);
    if (!open || entry.mine || voteBusy) return;
    const prevVote = myVote;
    const next = prevVote === entry.id ? null : entry.id;
    setVoteBusy(entry.id);
    setMyVote(next);
    setEntries((es) => es.map((e) => ({ ...e, votesCount: e.votesCount + (e.id === entry.id ? (next ? 1 : -1) : e.id === prevVote && next ? -1 : 0) })));
    try {
      const res = await fetch(`/api/konkurs/${initial.id}/ovoz`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entryId: entry.id }) });
      const j = (await res.json()) as Api<{ votedEntryId: string | null }>;
      if (!j.ok) throw new Error(j.error);
      setMyVote(j.data.votedEntryId);
    } catch (e) {
      setMyVote(prevVote);
      setEntries(initial.entries);
      toast(e instanceof Error ? e.message : "Ovoz saqlanmadi", "error");
      router.refresh();
    } finally {
      setVoteBusy(null);
    }
  };

  const join = async (postId: string) => {
    if (joinBusy) return;
    setJoinBusy(postId);
    try {
      const res = await fetch(`/api/konkurs/${initial.id}/qatnashish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId }) });
      const j = (await res.json()) as Api<{ entryId: string }>;
      if (!j.ok) throw new Error(j.error);
      setJoined(true);
      setPickOpen(false);
      toast("Ishingiz konkursga qo'shildi 🎉", "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Qo'shib bo'lmadi", "error");
    } finally {
      setJoinBusy(null);
    }
  };

  return (
    <div>
      {open && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {joined ? (
            <span className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-success-soft px-4 text-[13.5px] font-semibold text-success-text">
              <Trophy size={15} /> Siz ishtirok etyapsiz — omad!
            </span>
          ) : (
            <button onClick={() => (authed ? setPickOpen(true) : router.push(login))} className="btn-accent inline-flex h-10 items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold">
              <ImagePlus size={16} /> Ishtirok etish
            </button>
          )}
          <span className="text-[13px] text-fg-3">Ovoz berish: yoqqan ishdagi yurakni bosing (1 ta ovoz, almashtirish mumkin)</span>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="card p-8 text-center text-[14px] text-fg-3">Hali ish qo&apos;shilmagan — birinchi bo&apos;ling!</div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 max-sm:gap-2">
          {entries.map((e) => (
            <li key={e.id} className={cn("card overflow-hidden", e.isWinner && "ring-2 ring-accent")}>
              <Link href={e.author.slug ? `/mutaxassislar/${e.author.slug}?tab=postlar&post=${e.post.id}` : "#"} className="group/tile img-zoom relative block aspect-square w-full overflow-hidden bg-surface-3">
                {e.post.thumbUrl ? (
                  <SafeImage src={e.post.thumbUrl} alt={e.post.body.slice(0, 60) || "Konkurs ishi"} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center p-3 text-center text-[12.5px] text-fg-3">{e.post.body.slice(0, 80) || "Post"}</span>
                )}
                {e.post.isVideo && (
                  <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
                    <Play size={13} fill="currentColor" />
                  </span>
                )}
                {e.isWinner && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11.5px] font-bold text-white">
                    <Crown size={12} /> G&apos;olib
                  </span>
                )}
              </Link>
              <div className="flex items-center gap-2 p-2.5">
                <Avatar name={e.author.name} src={e.author.avatarUrl} size={28} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-fg">{e.author.name}</span>
                <button
                  onClick={() => void vote(e)}
                  disabled={!open || e.mine || voteBusy === e.id}
                  aria-label={myVote === e.id ? "Ovozni bekor qilish" : "Ovoz berish"}
                  aria-pressed={myVote === e.id}
                  className={cn(
                    "press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-bold tabular-nums transition",
                    myVote === e.id ? "bg-accent text-white" : "bg-fg/6 text-fg-2 hover:bg-fg/10",
                    (!open || e.mine) && "cursor-default opacity-70",
                  )}
                >
                  {voteBusy === e.id ? <Loader2 size={13} className="animate-spin" /> : <Heart size={13} fill={myVote === e.id ? "currentColor" : "none"} />}
                  {compactCount(e.votesCount)}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={pickOpen} onClose={() => setPickOpen(false)} title="Qaysi ishingiz bilan ishtirok etasiz?" label="Konkursga post tanlash">
        {posts === null ? (
          <div className="flex items-center justify-center py-10 text-fg-3">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="px-1 py-6 text-center text-[13.5px] leading-relaxed text-fg-3">
            Yaroqli post topilmadi. Konkursga qo&apos;shish uchun avval profilingizga rasm yoki videoli OMMAVIY post joylang —{" "}
            <Link href="/kabinet/postlar" className="font-semibold text-accent underline-offset-2 hover:underline">
              post joylash
            </Link>
            .
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-2 p-1">
            {posts.map((p) => (
              <li key={p.id}>
                <button onClick={() => void join(p.id)} disabled={joinBusy !== null} className="group relative block aspect-square w-full overflow-hidden rounded-[10px] bg-surface-3 ring-accent transition focus-visible:ring-2 disabled:opacity-60">
                  {p.thumbUrl ? (
                    <SafeImage src={p.thumbUrl} alt={p.body.slice(0, 40) || "Post"} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center p-2 text-center text-[11.5px] text-fg-3">{p.body.slice(0, 50)}</span>
                  )}
                  {p.isVideo && (
                    <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white">
                      <Play size={11} fill="currentColor" />
                    </span>
                  )}
                  {joinBusy === p.id && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                      <Loader2 size={18} className="animate-spin" />
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}
