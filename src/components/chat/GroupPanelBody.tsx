"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock, MessagesSquare, Newspaper, UserPlus } from "lucide-react";
import { ChannelPosts } from "@/components/chat/ChannelPosts";
import { GroupChat } from "@/components/groups/GroupChat";
import { GroupFeed, type Page } from "@/components/groups/GroupFeed";
import { LiveStrip } from "@/components/live/LiveStrip";
import { Avatar } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { GroupView } from "@/lib/groups/service";
import { cn } from "@/lib/utils";

/**
 * TELEGRAM USLUBI (2026-11-02): guruh/kanal endi alohida sahifada emas — chat panelining o'zida ochiladi.
 *  - Kanal: «Postlar» (GroupFeed — kanal e'lonlari) va «Muhokama» (GroupChat) tablari; Telegram'dagidek post lentasi asosiy.
 *  - Guruh: to'g'ridan GroupChat.
 *  - A'zo bo'lmagan ko'ruvchi: ochiq jamoada kontent ko'rinadi + pastda «Qo'shilish» paneli;
 *    yopiq jamoada qo'shilish ekrani (so'rov holati bilan). /jamoalar/[slug] sahifasi shu panelga redirect qiladi.
 */

type ApiResp<T> = { ok: boolean; data?: T; error?: string };

const T = {
  posts: { uz: "Postlar", ru: "Посты" },
  discussion: { uz: "Muhokama", ru: "Обсуждение" },
  join: { uz: "Qo'shilish", ru: "Вступить" },
  joinChannel: { uz: "Obuna bo'lish", ru: "Подписаться" },
  pending: { uz: "So'rov yuborildi — tasdiq kutilmoqda", ru: "Заявка отправлена — ждите подтверждения" },
  closed: { uz: "Yopiq jamoa — kontent faqat a'zolarga ko'rinadi", ru: "Закрытое сообщество — контент виден только участникам" },
  banned: { uz: "Siz bu jamoadan chetlatilgansiz", ru: "Вы исключены из этого сообщества" },
  members: { uz: "a'zo", ru: "участников" },
  loadErr: { uz: "Yuklab bo'lmadi. Qayta urinib ko'ring.", ru: "Не удалось загрузить. Попробуйте ещё раз." },
  channelPlaceholder: { uz: "Kanal e'loni…", ru: "Пост канала…" },
} as const;

export function GroupPanelBody({
  slug,
  kind,
  initialTab = "posts",
  highlightId = null,
  invite = null,
  onJoined,
}: {
  slug: string;
  kind: "group" | "channel";
  /** Kanal uchun boshlang'ich tab (`?tab=chat` havolalari — Muhokama) */
  initialTab?: "posts" | "chat";
  /** `?post=` deep link — lentada ajratib ko'rsatiladi */
  highlightId?: string | null;
  /** Taklif havolasidan kelgan kod — qo'shilishda yuboriladi */
  invite?: string | null;
  /** Qo'shilgandan keyin ro'yxatni yangilash uchun */
  onJoined?: () => void;
}) {
  const til = useLocale();
  const { toast } = useToast();
  const [view, setView] = useState<GroupView | null>(null);
  const [feed, setFeed] = useState<Page | null>(null);
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState<"posts" | "chat">(kind === "channel" ? initialTab : "chat");
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    setErr(false);
    try {
      const v = (await (await fetch(`/api/groups/${encodeURIComponent(slug)}`, { cache: "no-store" })).json()) as ApiResp<GroupView>;
      if (!v.ok || !v.data) throw new Error(v.error);
      setView(v.data);
      if (v.data.canView) {
        const p = (await (await fetch(`/api/groups/${encodeURIComponent(slug)}/posts${highlightId ? `?post=${encodeURIComponent(highlightId)}` : ""}`, { cache: "no-store" })).json()) as ApiResp<Page>;
        setFeed(p.ok && p.data ? p.data : { items: [], nextCursor: null });
      }
    } catch {
      setErr(true);
    }
  }, [slug, highlightId]);

  useEffect(() => {
    setView(null);
    setFeed(null);
    void load();
  }, [load]);

  async function join() {
    if (joining || !view) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(slug)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invite ? { invite } : {}),
      });
      const j = (await res.json()) as ApiResp<{ membership: string; welcome: string | null }>;
      if (!res.ok || !j.ok) throw new Error(j.error || "Xatolik");
      if (j.data?.welcome) toast(j.data.welcome, "success");
      await load();
      onJoined?.();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Qo'shilib bo'lmadi", "error");
    } finally {
      setJoining(false);
    }
  }

  if (err)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-[13.5px] text-fg-3">{T.loadErr[til]}</p>
        <button type="button" onClick={() => void load()} className="rounded-full border border-line px-4 py-1.5 text-[13px] font-semibold text-fg-2 hover:border-fg hover:text-fg">
          Qayta urinish
        </button>
      </div>
    );
  if (!view)
    return (
      <div className="flex flex-1 items-center justify-center text-fg-3">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );

  const m = view.membership;
  const isMember = m === "owner" || m === "admin" || m === "member";

  // Yopiq jamoa / chetlatilgan — qo'shilish ekrani (kontent ko'rinmaydi)
  if (!view.canView || m === "banned") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <Avatar name={view.name} src={view.coverUrl} size={72} decorative />
        <div>
          <p className="font-display text-[17px] font-bold text-fg">{view.name}</p>
          <p className="mt-0.5 text-[12.5px] text-fg-3">
            {view.membersCount} {T.members[til]}
          </p>
        </div>
        {view.description && <p className="max-w-sm text-[13.5px] leading-relaxed text-fg-2">{view.description}</p>}
        {m === "banned" ? (
          <p className="text-[13px] font-semibold text-danger-text">{T.banned[til]}</p>
        ) : m === "pending" ? (
          <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-warning-text">
            <Lock size={14} /> {T.pending[til]}
            {view.pendingPosition ? ` · №${view.pendingPosition}` : ""}
          </p>
        ) : (
          <>
            <p className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-3">
              <Lock size={13} /> {T.closed[til]}
            </p>
            <button type="button" onClick={() => void join()} disabled={joining} className="btn-accent inline-flex h-10 items-center gap-2 rounded-full px-6 text-[14px] font-semibold disabled:opacity-60">
              {joining ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} {T.join[til]}
            </button>
          </>
        )}
      </div>
    );
  }

  const loading = (
    <div className="flex flex-1 items-center justify-center text-fg-3">
      <Loader2 size={18} className="animate-spin" />
    </div>
  );
  // Kanal — Telegram pufakchalari (ChannelPosts); guruh preview — oddiy lenta
  const feedBlock = feed ? (
    view.kind === "channel" ? (
      <ChannelPosts key={view.id} slug={view.slug} canPost={view.canPost} canInteract={isMember} loggedIn initial={feed} highlightId={highlightId} channelName={view.name} channelAvatar={view.coverUrl} />
    ) : (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
        <GroupFeed slug={view.slug} kind={view.kind} canPost={view.canPost} canInteract={isMember} canSchedule={view.canManage} loggedIn initial={feed} highlightId={highlightId} />
      </div>
    )
  ) : (
    loading
  );

  const showDiscussion = !view.chatDisabled && isMember;

  return (
    <>
      <LiveStrip key={`live-${view.id}`} slug={view.slug} />
      {/* Kanal: Postlar · Muhokama tablari (Telegram'dagidek postlar asosiy) */}
      {view.kind === "channel" && showDiscussion && (
        <div className="flex shrink-0 gap-1 border-b border-line px-3" role="tablist" aria-label={view.name}>
          {(
            [
              { k: "posts", label: T.posts[til], icon: Newspaper },
              { k: "chat", label: T.discussion[til], icon: MessagesSquare },
            ] as const
          ).map((x) => (
            <button
              key={x.k}
              type="button"
              role="tab"
              aria-selected={tab === x.k}
              onClick={() => setTab(x.k)}
              className={cn("relative inline-flex h-10 items-center gap-1.5 px-3 text-[13px] font-semibold transition", tab === x.k ? "text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-fg" : "text-fg-3 hover:text-fg")}
            >
              <x.icon size={14} /> {x.label}
            </button>
          ))}
        </div>
      )}
      {view.kind === "channel" ? (
        tab === "chat" && showDiscussion ? (
          <GroupChat key={`c-${view.id}`} slug={view.slug} membersCount={view.membersCount} kind="channel" canManage={view.canManage} embedded />
        ) : (
          feedBlock
        )
      ) : isMember ? (
        <GroupChat key={`g-${view.id}`} slug={view.slug} membersCount={view.membersCount} kind="group" canManage={view.canManage} embedded />
      ) : (
        feedBlock
      )}
      {/* A'zo bo'lmaganga pastki «Qo'shilish» paneli (ochiq jamoa, Telegram uslubi) */}
      {!isMember && m !== "pending" && (
        <div className="shrink-0 border-t border-line p-2.5">
          <button type="button" onClick={() => void join()} disabled={joining} className="btn-accent inline-flex h-10 w-full items-center justify-center gap-2 rounded-[12px] text-[14px] font-semibold disabled:opacity-60">
            {joining ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} {view.kind === "channel" ? T.joinChannel[til] : T.join[til]}
          </button>
        </div>
      )}
      {m === "pending" && <p className="shrink-0 border-t border-line p-3 text-center text-[13px] font-semibold text-warning-text">{T.pending[til]}</p>}
    </>
  );
}
