"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";
import { StoryComposer } from "./StoryComposer";
import { StoryViewer } from "./StoryViewer";
import type { AuthorStories, StoryRailItem } from "@/lib/stories/types";
import { rectOf } from "./story-motion";

/**
 * Story halqalari (qator ichidagi <li> elementlar): birinchi — «Sizning story» (+ yangi), keyin boshqalar (ko'rilmagan — gradient halqa).
 * Bosilganda (Instagram kabi) halqa aylanadi — story'lar oldindan yuklanadi — so'ng ko'ruvchi shu avatar joyidan kattalashib
 * ochiladi va yopilganda unga qaytadi; ko'rib bo'lingan muallif halqasi darhol kulranglashadi.
 */
export function StoryRail({ rail, me, canCreate }: { rail: StoryRailItem[]; me: { id: string; name: string; avatarUrl: string | null } | null; canCreate: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(rail);
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState<number | null>(null);
  const [initial, setInitial] = useState<AuthorStories | null>(null);
  const avatarRefs = useRef(new Map<string, HTMLElement>());
  const reqRef = useRef(0);
  const [composer, setComposer] = useState(false);
  const mine = items.find((i) => i.isMe);
  const others = items.filter((i) => !i.isMe);
  const ordered = mine ? [mine, ...others] : others;
  const item = "press flex w-[72px] flex-col items-center gap-1.5 text-center";
  const setAvatar = (id: string) => (el: HTMLElement | null) => {
    if (el) avatarRefs.current.set(id, el);
    else avatarRefs.current.delete(id);
  };

  /** Bosish: halqa aylanadi, story'lar yuklanadi (ko'pi bilan ~1.5 s kutiladi), keyin ko'ruvchi ochiladi */
  function openAt(idx: number) {
    const target = ordered[idx];
    if (!target || loading !== null) return;
    const req = ++reqRef.current;
    setLoading(idx);
    const show = (d: AuthorStories | null) => {
      if (reqRef.current !== req) return;
      reqRef.current++;
      setInitial(d);
      setLoading(null);
      setOpen(idx);
    };
    const timer = window.setTimeout(() => show(null), 1500);
    fetch(`/api/stories/user/${target.author.id}`)
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: AuthorStories }) => {
        window.clearTimeout(timer);
        show(j.ok ? (j.data ?? null) : null);
      })
      .catch(() => {
        window.clearTimeout(timer);
        show(null);
      });
  }

  return (
    <>
      {canCreate && me && (
        <li className="shrink-0">
          <div className={item}>
            <span className="relative">
              <button ref={mine ? setAvatar(mine.author.id) : undefined} type="button" onClick={() => (mine ? openAt(0) : setComposer(true))} aria-label={mine ? "Mening story'larim" : "Story qo'shish"} className={mine ? cn("story-ring-seen block", loading === 0 && "story-ring-loading") : "block"}>
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
            <button type="button" onClick={() => openAt(idx)} className={item} aria-label={`${s.author.name} story'lari`} aria-busy={loading === idx}>
              <span ref={setAvatar(s.author.id)} className={cn(s.allSeen ? "story-ring-seen" : "story-ring", loading === idx && "story-ring-loading")}>
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
          initialData={initial}
          originFor={(i) => rectOf(avatarRefs.current.get(ordered[i]?.author.id ?? ""))}
          me={me}
          onClose={() => setOpen(null)}
          onSeen={(id) => setItems((l) => l.map((x) => (x.author.id === id ? { ...x, allSeen: true } : x)))}
        />
      )}
      <StoryComposer open={composer} onClose={() => setComposer(false)} onCreated={() => router.refresh()} />
    </>
  );
}
