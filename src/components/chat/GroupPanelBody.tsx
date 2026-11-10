"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, BellOff, Clock3, Info, Loader2, Lock, LogOut, MessagesSquare, MoreVertical, Newspaper, Settings, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChannelPosts } from "@/components/chat/ChannelPosts";
import { GroupInfoSheet, type GroupSheetTab } from "@/components/chat/GroupInfoSheet";
import { GroupChat } from "@/components/groups/GroupChat";
import type { Page } from "@/components/groups/GroupFeed";
import { LiveStrip } from "@/components/live/LiveStrip";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { GroupView } from "@/lib/groups/service";
import { chatT, type ChatKey } from "@/lib/i18n/dict/chat";
import { cn, compactCount } from "@/lib/utils";
import type { GroupRow } from "./chat-types";
import { GroupAvatar, Layer, MenuDivider, MenuItem } from "./DmPanels";
import { iconBtn } from "./MessageParts";

/**
 * TELEGRAM USLUBI (2026-11-02): guruh/kanal alohida sahifada emas — chat panelining o'zida ochiladi.
 *  - Kanal: «Postlar» (ChannelPosts — Telegram pufakchalari) va «Muhokama» (GroupChat) tablari;
 *  - Guruh: to'g'ridan GroupChat;
 *  - A'zo bo'lmagan ko'ruvchi: kanal postlari + pastda «Obuna bo'lish»; guruhda — tanishtiruv kartasi (chat faqat a'zolarga);
 *    yopiq jamoada qo'shilish ekrani (so'rov holati va uni qaytarib olish bilan).
 *
 * SARLAVHA shu komponentda (2026-11-10): nom ostidagi a'zolar soni har doim yangi ma'lumotdan (qo'shilgach eskirmaydi),
 * boshqaruvchiga «N ta so'rov» nishoni, «⋮» menyu — Ma'lumot · A'zolar · Sozlash · Ovozsiz · Chiqish. Chiqish / obunani
 * bekor qilish / so'rovni qaytarib olish ilgari chat ichidan umuman mumkin emas edi (QA A3, A4, C5, A22).
 */

type ApiResp<T> = { ok: boolean; data?: T; error?: string };

export function GroupPanelBody({
  slug,
  row = null,
  initialTab = "posts",
  initialSheet = null,
  highlightId = null,
  invite = null,
  viewerId = null,
  viewerRole = null,
  onClose,
  onChanged,
  onLeft,
  onSheetClosed,
}: {
  slug: string;
  /** Chat ro'yxatidagi qator — ma'lumot yuklanguncha sarlavha shundan chiziladi (a'zo bo'lmagan ko'ruvchida null) */
  row?: GroupRow | null;
  /** Kanal uchun boshlang'ich tab (`gtab=chat` havolalari — Muhokama) */
  initialTab?: "posts" | "chat";
  /** `gtab=azolar` (bildirishnoma / sozlash sahifasidagi «N ta so'rov») — a'zolar varag'i darhol ochiladi */
  initialSheet?: GroupSheetTab | null;
  /** `?post=` deep link — lentada ajratib ko'rsatiladi */
  highlightId?: string | null;
  /** Taklif havolasidan kelgan kod — qo'shilishda yuboriladi */
  invite?: string | null;
  viewerId?: string | null;
  viewerRole?: string | null;
  onClose: () => void;
  /** A'zolik / o'qilganlik / sozlama o'zgardi — chat ro'yxati yangilansin */
  onChanged?: () => void;
  /** Jamoadan chiqildi (yoki so'rov qaytarib olindi) — panel yopiladi */
  onLeft?: () => void;
  /** Deep-link bilan ochilgan varaq yopildi — manzildan `gtab=azolar` olib tashlanadi */
  onSheetClosed?: () => void;
}) {
  const til = useLocale();
  const t = (k: ChatKey, v?: Record<string, string | number>) => chatT(til, k, v);
  const { toast } = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [view, setView] = useState<GroupView | null>(null);
  const [feed, setFeed] = useState<Page | null>(null);
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState<"posts" | "chat">(initialTab);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<GroupSheetTab | null>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const sheetBooted = useRef(false);
  const base = `/api/groups/${encodeURIComponent(slug)}`;

  const load = useCallback(async () => {
    setErr(false);
    try {
      const v = (await (await fetch(base, { cache: "no-store" })).json()) as ApiResp<GroupView>;
      if (!v.ok || !v.data) throw new Error(v.error);
      setView(v.data);
      if (v.data.kind === "channel" && v.data.canView) {
        const p = (await (await fetch(`${base}/posts${highlightId ? `?post=${encodeURIComponent(highlightId)}` : ""}`, { cache: "no-store" })).json()) as ApiResp<Page>;
        setFeed(p.ok && p.data ? p.data : { items: [], nextCursor: null });
      }
    } catch {
      setErr(true);
    }
  }, [base, highlightId]);

  useEffect(() => {
    setView(null);
    setFeed(null);
    void load();
  }, [load]);

  // `gtab=azolar`: ma'lumot kelgach a'zolar varag'i bir marta ochiladi (boshqaruvchi — so'rovlarni tasdiqlaydi)
  useEffect(() => {
    if (!view || sheetBooted.current || !initialSheet) return;
    sheetBooted.current = true;
    if (view.canView) setSheet(initialSheet);
  }, [view, initialSheet]);

  const m = view?.membership ?? null;
  const isMember = m === "owner" || m === "admin" || m === "member";
  const kind = view?.kind ?? row?.kind ?? "group";
  const name = view?.name ?? row?.name ?? "";
  const cover = view?.coverUrl ?? row?.coverUrl ?? null;
  const official = view?.isOfficial ?? row?.isOfficial ?? false;
  const membersCount = view?.membersCount ?? row?.membersCount ?? 0;
  const muted = view ? view.muted : Boolean(row?.muted);
  const canLeave = Boolean(view && isMember && m !== "owner" && !view.isOfficial);

  async function join() {
    if (busy || !view) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(invite ? { invite } : {}) });
      const j = (await res.json()) as ApiResp<{ membership: string; welcome: string | null }>;
      if (!res.ok || !j.ok) throw new Error(j.error || t("joinFail"));
      if (j.data?.welcome) toast(j.data.welcome, "success");
      else if (j.data?.membership === "pending") toast(t("joinPending"), "info");
      await load();
      onChanged?.();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : t("joinFail"), "error");
    } finally {
      setBusy(false);
    }
  }

  /** Chiqish / obunani bekor qilish / so'rovni qaytarib olish — bitta so'rov (`DELETE …/join`), har biri tasdiq bilan */
  async function leave() {
    if (busy || !view) return;
    const pendingReq = m === "pending";
    const okay = await confirm(
      pendingReq
        ? { title: t("withdrawQ"), confirmLabel: t("withdraw"), danger: true }
        : { title: t(view.kind === "channel" ? "leaveChannelQ" : "leaveGroupQ"), text: t("leaveText"), confirmLabel: t(view.kind === "channel" ? "leaveChannel" : "leave"), danger: true },
    );
    if (!okay) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/join`, { method: "DELETE" });
      const j = (await res.json().catch(() => null)) as ApiResp<unknown> | null;
      if (!res.ok || !j?.ok) throw new Error(j?.error || t("fail"));
      toast(pendingReq ? t("withdrawn") : t(view.kind === "channel" ? "unsubscribed" : "left"), "info");
      setSheet(null);
      onChanged?.();
      if (pendingReq) await load();
      else onLeft?.();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : t("fail"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function setMute(next: boolean) {
    if (!view) return;
    setView({ ...view, muted: next, mutedUntil: null });
    const res = await fetch(`/api/chat/guruh/${encodeURIComponent(view.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ muted: next }) }).catch(() => null);
    if (!res?.ok) {
      setView((v) => (v ? { ...v, muted: !next } : v));
      toast(t("saveFail"), "error");
      return;
    }
    onChanged?.();
  }

  const closeSheet = () => {
    setSheet(null);
    if (initialSheet) onSheetClosed?.();
  };

  /* ---------------- Sarlavha ---------------- */
  const header = (
    <div className="relative flex shrink-0 items-center gap-1.5 border-b border-line px-2 py-2">
      <button type="button" onClick={onClose} aria-label={t("backToChats")} className={cn(iconBtn, "lg:hidden")}>
        <ArrowLeft size={18} />
      </button>
      <button
        type="button"
        onClick={() => view?.canView && setSheet("info")}
        disabled={!view?.canView}
        aria-label={`${name} — ${t("groupInfo")}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[12px] px-1.5 py-1 text-left transition enabled:hover:bg-fg/5 lg:ml-1"
      >
        <GroupAvatar name={name} coverUrl={cover} kind={kind} size={38} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-[14px] font-semibold leading-tight text-fg">
            <span className="truncate" data-no-auto>
              {name}
            </span>
            {official && <ShieldCheck size={13} className="shrink-0 text-accent" aria-label={t("official")} />}
            {muted && isMember && <BellOff size={12} className="shrink-0 text-fg-4" aria-label={t("muted")} />}
          </span>
          <span className="block truncate text-[12px] text-fg-3">
            {compactCount(membersCount)} {t(kind === "channel" ? "subscribersShort" : "membersShort")}
          </span>
        </span>
      </button>
      {/* Boshqaruvchi: kutayotgan qo'shilish so'rovlari — bosilsa a'zolar varag'i (tasdiqlash shu yerda) */}
      {view?.canManage && view.pendingCount > 0 && (
        <button type="button" onClick={() => setSheet("members")} className="animate-badge-pop inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[12.5px] font-bold text-accent-text transition hover:opacity-85">
          <UserPlus size={14} aria-hidden /> <span className="max-sm:hidden">{t("requestsN", { n: view.pendingCount })}</span>
          <span className="sm:hidden" aria-label={t("requestsN", { n: view.pendingCount })}>
            {view.pendingCount}
          </span>
        </button>
      )}
      {view?.canView && (
        <button ref={menuBtn} type="button" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} aria-label={t("menu")} className={cn(iconBtn, menu && "bg-fg/6 text-fg")}>
          <MoreVertical size={17} />
        </button>
      )}
      <button type="button" onClick={onClose} aria-label={t("close")} className={cn(iconBtn, "max-lg:hidden")}>
        <X size={16} />
      </button>
      <Layer open={menu} onClose={() => setMenu(false)} label={t("menu")} anchor={menuBtn.current} width="w-[250px]">
        <MenuItem icon={Info} label={t("groupInfo")} onClick={() => (setMenu(false), setSheet("info"))} />
        <MenuItem icon={Users} label={t("members")} hint={view?.canManage && view.pendingCount > 0 ? t("requestsN", { n: view.pendingCount }) : undefined} onClick={() => (setMenu(false), setSheet("members"))} />
        {view?.canManage && <MenuItem icon={Settings} label={t("settings")} onClick={() => (setMenu(false), router.push(`/jamoalar/${slug}/sozlash`))} />}
        {isMember && <MenuItem icon={muted ? Bell : BellOff} label={t(muted ? "swUnmute" : "swMute")} onClick={() => (setMenu(false), void setMute(!muted))} />}
        {canLeave && (
          <>
            <MenuDivider />
            <MenuItem icon={LogOut} label={t(kind === "channel" ? "leaveChannel" : "leaveGroup")} danger onClick={() => (setMenu(false), void leave())} />
          </>
        )}
      </Layer>
    </div>
  );

  const spinner = (
    <div className="flex flex-1 items-center justify-center text-fg-3" aria-busy="true">
      <Loader2 size={18} className="animate-spin" aria-label={t("loading")} />
    </div>
  );

  let body: React.ReactNode;
  if (err) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-[13.5px] text-fg-3">{t("loadErr")}</p>
        <button type="button" onClick={() => void load()} className="h-10 rounded-full border border-line px-4 text-[13px] font-semibold text-fg-2 hover:border-fg hover:text-fg">
          {t("tryAgain")}
        </button>
      </div>
    );
  } else if (!view) {
    body = spinner;
  } else if (!view.canView || m === "banned" || (view.kind === "group" && !isMember)) {
    // Tanishtiruv kartasi: yopiq jamoa / chetlatilgan / ochiq guruhning a'zo bo'lmagan ko'ruvchisi.
    // Ochiq guruhda ilgari «Lenta hali bo'sh» degan chalg'ituvchi bo'sh holat chiqardi (chat faol bo'lsa ham) — QA B4.
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center">
        <GroupAvatar name={view.name} coverUrl={view.coverUrl} kind={view.kind} size={76} />
        <div>
          <p className="font-display text-[18px] font-bold text-fg [overflow-wrap:anywhere]" data-no-auto>
            {view.name}
          </p>
          <p className="mt-0.5 text-[12.5px] text-fg-3">
            {compactCount(view.membersCount)} {t(view.kind === "channel" ? "subscribersShort" : "membersShort")}
          </p>
        </div>
        {view.description && (
          <p className="max-w-sm whitespace-pre-line text-[13.5px] leading-relaxed text-fg-2 [overflow-wrap:anywhere]" data-no-auto>
            {view.description}
          </p>
        )}
        {m === "banned" ? (
          <p className="text-[13px] font-semibold text-danger-text">{t("bannedFrom")}</p>
        ) : m === "pending" ? (
          <>
            <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-warning-text">
              <Clock3 size={14} aria-hidden /> {t("joinPending")}
              {view.pendingPosition ? ` · ${t("joinQueue", { n: view.pendingPosition })}` : ""}
            </p>
            <button type="button" onClick={() => void leave()} disabled={busy} className="h-10 rounded-full border border-line px-5 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-60">
              {t("withdraw")}
            </button>
          </>
        ) : (
          <>
            <p className="inline-flex max-w-sm items-start gap-1.5 text-[12.5px] leading-relaxed text-fg-3">
              <Lock size={13} className="mt-0.5 shrink-0" aria-hidden /> {t(view.canView ? "openGroupPreview" : "closedGroup")}
            </p>
            <button type="button" onClick={() => void join()} disabled={busy} className="btn-accent inline-flex h-11 items-center gap-2 rounded-full px-6 text-[14px] font-semibold disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} {t(view.isPrivate && !invite ? "joinRequest" : "join")}
            </button>
          </>
        )}
      </div>
    );
  } else {
    const showDiscussion = view.kind === "channel" && !view.chatDisabled && isMember;
    const onChat = view.kind === "group" || (tab === "chat" && showDiscussion);
    body = (
      <>
        <LiveStrip key={`live-${view.id}`} slug={view.slug} />
        {/* Kanal: Postlar · Muhokama tablari (Telegram'dagidek postlar asosiy) */}
        {showDiscussion && (
          <div className="flex shrink-0 gap-1 border-b border-line px-3" role="tablist" aria-label={view.name}>
            {(
              [
                { k: "posts", label: t("posts"), icon: Newspaper },
                { k: "chat", label: t("discussion"), icon: MessagesSquare },
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
        {onChat ? (
          <GroupChat key={`c-${view.id}`} slug={view.slug} membersCount={view.membersCount} kind={view.kind} canManage={view.canManage} embedded onActivity={onChanged} />
        ) : feed ? (
          <ChannelPosts
            key={view.id}
            groupId={view.id}
            slug={view.slug}
            canPost={view.canPost}
            canManage={view.canManage}
            canInteract={isMember}
            viewerId={viewerId}
            loggedIn
            initial={feed}
            highlightId={highlightId}
            channelName={view.name}
            channelAvatar={view.coverUrl}
            onActivity={onChanged}
          />
        ) : (
          spinner
        )}
        {/* A'zo bo'lmaganga pastki «Obuna bo'lish» paneli (ochiq kanal, Telegram uslubi) */}
        {!isMember && m !== "pending" && (
          <div className="shrink-0 border-t border-line p-2.5">
            <button type="button" onClick={() => void join()} disabled={busy} className="btn-accent inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] text-[14px] font-semibold disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} {t(view.kind === "channel" ? "joinChannel" : "join")}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {header}
      {body}
      <GroupInfoSheet
        open={sheet !== null}
        onClose={closeSheet}
        slug={slug}
        initialTab={sheet ?? "info"}
        viewerId={viewerId}
        siteAdmin={viewerRole === "admin"}
        onChanged={() => {
          void load();
          onChanged?.();
        }}
        onLeave={() => void leave()}
        onToggleMute={(next) => void setMute(next)}
      />
    </>
  );
}
