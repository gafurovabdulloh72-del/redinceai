"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/ui";
import { StoryComposer } from "./StoryComposer";
import { StoryViewer } from "./StoryViewer";
import type { StoryRailItem } from "@/lib/stories/types";

/**
 * Story halqalari (qator ichidagi <li> elementlar): birinchi — «Sizning story» (+ yangi), keyin boshqalar (ko'rilmagan — gradient halqa).
 * Bosilganda to'liq ekranli StoryViewer; ko'rib bo'lingan muallif halqasi darhol kulranglashadi.
 */
export function StoryRail({ rail, me, canCreate }: { rail: StoryRailItem[]; me: { id: string; name: string; avatarUrl: string | null } | null; canCreate: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(rail);
  const [open, setOpen] = useState<number | null>(null);
  const [composer, setComposer] = useState(false);
  const mine = items.find((i) => i.isMe);
  const others = items.filter((i) => !i.isMe);
  const ordered = mine ? [mine, ...others] : others;
  const item = "press flex w-[72px] flex-col items-center gap-1.5 text-center";

  return (
    <>
      {canCreate && me && (
        <li className="shrink-0">
          <div className={item}>
            <span className="relative">
              <button type="button" onClick={() => (mine ? setOpen(0) : setComposer(true))} aria-label={mine ? "Mening story'larim" : "Story qo'shish"} className={mine ? "story-ring-seen block" : "block"}>
                <span className={mine ? "story-gap block" : "block"}>
                  <Avatar name={me.name} src={me.avatarUrl} size={58} decorative className="!ring-0 !shadow-none" />
                </span>
              </button>
              <button type="button" onClick={() => setComposer(true)} aria-label="Yangi story" className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-accent text-white ring-2 ring-bg">
                <Plus size={14} strokeWidth={3} />
              </button>
            </span>
            <span className="w-full truncate text-[11.5px] font-semibold text-fg">{mine ? "Sizniki" : "Story"}</span>
          </div>
        </li>
      )}
      {others.map((s) => {
        const idx = ordered.indexOf(s);
        return (
          <li key={s.author.id} className="shrink-0">
            <button type="button" onClick={() => setOpen(idx)} className={item} aria-label={`${s.author.name} story'lari`}>
              <span className={s.allSeen ? "story-ring-seen" : "story-ring"}>
                <span className="story-gap">
                  <Avatar name={s.author.name} src={s.author.avatarUrl} size={58} decorative className="!ring-0 !shadow-none" />
                </span>
              </span>
              <span className={s.allSeen ? "w-full truncate text-[11.5px] font-medium text-fg-3" : "w-full truncate text-[11.5px] font-semibold text-fg"}>{s.author.name.split(" ")[0]}</span>
            </button>
          </li>
        );
      })}
      {open !== null && (
        <StoryViewer
          rail={ordered}
          startIndex={open}
          me={me}
          onClose={() => setOpen(null)}
          onSeen={(id) => setItems((l) => l.map((x) => (x.author.id === id ? { ...x, allSeen: true } : x)))}
        />
      )}
      <StoryComposer open={composer} onClose={() => setComposer(false)} onCreated={() => router.refresh()} />
    </>
  );
}
