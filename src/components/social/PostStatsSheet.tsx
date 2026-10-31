"use client";

import { useEffect, useState } from "react";
import { BarChart3, Bookmark, Eye, Heart, Loader2, MessageCircle, Users } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { REACTIONS } from "@/lib/groups/limits";
import { compactCount } from "@/lib/utils";
import { EmojiSticker, EmojiStack } from "@/components/social/EmojiSticker";

interface Stats {
  views: number;
  uniqueViews: number;
  likes: number;
  comments: number;
  saves: number;
  reactions: Array<{ emoji: string; count: number }>;
  topCommenters: Array<{ name: string; count: number }>;
  engagement: number;
  createdAt: number;
}

const emojiOf = (key: string) => REACTIONS.find((r) => r.key === key)?.emoji ?? "❤️";

/**
 * Post statistikasi (Telegram kanal statistikasi naqshi): ko'rishlar, noyob ko'ruvchilar,
 * reaksiyalar taqsimoti, izohlar, saqlashlar va eng faol izohchilar.
 * Faqat muallif · jamoa boshqaruvchisi · admin ochadi (server ham shuni tekshiradi).
 */
export function PostStatsSheet({ open, onClose, postId }: { open: boolean; onClose: () => void; postId: string }) {
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setData(null);
    setError("");
    void fetch(`/api/posts/${encodeURIComponent(postId)}/statistika`)
      .then(async (r) => {
        const j = (await r.json()) as { data?: Stats; error?: string };
        if (!r.ok || !j.data) throw new Error(j.error || "Yuklanmadi");
        setData(j.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Yuklanmadi"));
  }, [open, postId]);

  const total = data?.reactions.reduce((s, r) => s + r.count, 0) ?? 0;

  return (
    <Sheet open={open} onClose={onClose} title="Post statistikasi" size="md">
      {error ? (
        <p className="py-6 text-center text-[13.5px] text-danger-text">{error}</p>
      ) : !data ? (
        <p className="py-8 text-center text-fg-3">
          <Loader2 size={18} className="inline animate-spin" />
        </p>
      ) : (
        <div className="space-y-4">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                [Eye, "Ko'rishlar", compactCount(data.views)],
                [Users, "Noyob", compactCount(data.uniqueViews)],
                [Heart, "Reaksiya", compactCount(data.likes)],
                [MessageCircle, "Izoh", compactCount(data.comments)],
              ] as const
            ).map(([Icon, label, value]) => (
              <li key={label} className="card p-3">
                <p className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-fg-3">
                  <Icon size={12} /> {label}
                </p>
                <p className="mt-1 text-[20px] font-bold tabular-nums text-fg">{value}</p>
              </li>
            ))}
          </ul>

          <div className="card p-3.5">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-fg">
              <BarChart3 size={14} className="text-fg-3" /> Faollik
            </p>
            <p className="mt-1 text-[12.5px] text-fg-2">
              Har 100 ko&apos;rishga <span className="font-bold text-fg">{data.engagement}</span> reaksiya/izoh
              {data.saves > 0 && (
                <>
                  {" · "}
                  <Bookmark size={11} className="inline" /> {compactCount(data.saves)} saqlangan
                </>
              )}
            </p>
            <p className="mt-1 text-[12px] text-fg-4">Joylangan: {new Date(data.createdAt).toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>

          {data.reactions.length > 0 && (
            <section>
              <h3 className="text-[13px] font-bold text-fg">Reaksiyalar</h3>
              <ul className="mt-2 space-y-1.5">
                {data.reactions.map((r) => (
                  <li key={r.emoji} className="flex items-center gap-2.5">
                    <span className="inline-flex w-6 shrink-0 justify-center"><EmojiSticker e={emojiOf(r.emoji)} size={18} /></span>
                    <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-fg/8">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${total ? Math.max(4, Math.round((r.count / total) * 100)) : 0}%` }} />
                    </span>
                    <span className="w-10 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-fg-2">{r.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.topCommenters.length > 0 && (
            <section>
              <h3 className="text-[13px] font-bold text-fg">Eng faol izohchilar</h3>
              <ul className="mt-2 space-y-1">
                {data.topCommenters.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="min-w-0 truncate text-fg">{c.name}</span>
                    <span className="shrink-0 tabular-nums text-fg-3">{c.count} izoh</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}
