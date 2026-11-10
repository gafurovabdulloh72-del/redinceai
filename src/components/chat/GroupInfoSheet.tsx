"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellOff, Bell, Crown, Loader2, Lock, LogOut, Megaphone, Settings, ShieldCheck, Users } from "lucide-react";
import { GroupMembers } from "@/components/groups/GroupMembers";
import { InviteLink } from "@/components/groups/InviteLink";
import { RulesText } from "@/components/groups/RulesText";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { Avatar } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import type { GroupView, MemberView } from "@/lib/groups/service";
import { chatT, type ChatKey } from "@/lib/i18n/dict/chat";
import { cn, compactCount } from "@/lib/utils";
import { GroupAvatar } from "./DmPanels";

type ApiResp<T> = { ok: boolean; data?: T; error?: string };
export type GroupSheetTab = "info" | "members";

/**
 * Jamoa varag'i (QA A3 + C5) — chat panelidan ochiladi:
 *  - «Ma'lumot»: tavsif, qoidalar, egasi, (boshqaruvchiga) taklif havolasi va «Sozlash», bildirishnoma holati, «Chiqish»;
 *  - «A'zolar»: a'zolar ro'yxati; boshqaruvchiga — QO'SHILISH SO'ROVLARI (tasdiqlash / rad etish), chiqarish, admin
 *    qilish, chiqarilganlar. Jamoa sahifasi chat ichiga ko'chirilgach bu boshqaruv hech qayerdan ochilmay qolgan edi:
 *    «so'rov keldi» bildirishnomasi va sozlash sahifasidagi «N ta so'rov» tugmasi boshi berk joyga olib borardi.
 * Ma'lumot har ochilganda yangidan olinadi (a'zolar soni/so'rovlar eskirib qolmasin).
 */
export function GroupInfoSheet({
  open,
  onClose,
  slug,
  initialTab = "info",
  viewerId,
  siteAdmin = false,
  onChanged,
  onLeave,
  onToggleMute,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  initialTab?: GroupSheetTab;
  viewerId: string | null;
  /** Sayt admini — egasi huquqlari bilan (admin qilish/olish) */
  siteAdmin?: boolean;
  /** A'zolar/so'rovlar o'zgardi — panel sarlavhasi va chat ro'yxati yangilansin */
  onChanged?: () => void;
  /** «Chiqish» bosildi (tasdiq va so'rovni ota komponent bajaradi) */
  onLeave?: () => void;
  onToggleMute?: (muted: boolean) => void;
}) {
  const til = useLocale();
  const t = (k: ChatKey, v?: Record<string, string | number>) => chatT(til, k, v);
  const [tab, setTab] = useState<GroupSheetTab>(initialTab);
  const [view, setView] = useState<GroupView | null>(null);
  const [active, setActive] = useState<MemberView[] | null>(null);
  const [pending, setPending] = useState<MemberView[]>([]);
  const [err, setErr] = useState(false);
  const [muted, setMuted] = useState(false);
  const base = `/api/groups/${encodeURIComponent(slug)}`;

  const load = useCallback(async () => {
    setErr(false);
    try {
      const v = (await (await fetch(base, { cache: "no-store" })).json()) as ApiResp<GroupView>;
      if (!v.ok || !v.data) throw new Error(v.error);
      setView(v.data);
      setMuted(v.data.muted);
      const [a, p] = await Promise.all([
        v.data.canView ? (fetch(`${base}/members`, { cache: "no-store" }).then((r) => r.json()) as Promise<ApiResp<{ items: MemberView[] }>>) : Promise.resolve(null),
        v.data.canManage ? (fetch(`${base}/members?status=pending`, { cache: "no-store" }).then((r) => r.json()) as Promise<ApiResp<{ items: MemberView[] }>>) : Promise.resolve(null),
      ]);
      setActive(a?.ok && a.data ? a.data.items : []);
      setPending(p?.ok && p.data ? p.data.items : []);
    } catch {
      setErr(true);
    }
  }, [base]);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setView(null);
    setActive(null);
    void load();
  }, [open, initialTab, load]);

  const isMember = view ? view.membership === "owner" || view.membership === "admin" || view.membership === "member" : false;
  const isOwner = view?.membership === "owner";
  const canLeave = Boolean(view && isMember && !isOwner && !view.isOfficial);

  return (
    <Sheet open={open} onClose={onClose} title={view?.name ?? t("groupInfo")} size="lg">
      {err ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-[13.5px] text-fg-3">{t("loadErr")}</p>
          <button type="button" onClick={() => void load()} className="h-10 rounded-full border border-line px-4 text-[13px] font-semibold text-fg-2 hover:border-fg hover:text-fg">
            {t("tryAgain")}
          </button>
        </div>
      ) : !view ? (
        <div className="flex items-center justify-center py-14 text-fg-3" aria-busy="true">
          <Loader2 size={18} className="animate-spin" aria-label={t("loading")} />
        </div>
      ) : (
        <div className="pb-2">
          {/* Sarlavha bloki */}
          <div className="flex items-center gap-3.5">
            <GroupAvatar name={view.name} coverUrl={view.coverUrl} kind={view.kind} size={60} />
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-fg-3">
                {view.kind === "channel" ? <Megaphone size={13} aria-hidden /> : <Users size={13} aria-hidden />}
                <span className="truncate">
                  {t(view.kind === "channel" ? "kindChannel" : "kindGroup")} · {compactCount(active?.length ?? view.membersCount)} {t(view.kind === "channel" ? "subscribersShort" : "membersShort")}
                </span>
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5">
                {view.isOfficial && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-text">
                    <ShieldCheck size={11} aria-hidden /> {t("official")}
                  </span>
                )}
                {view.isPrivate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-fg/6 px-2 py-0.5 text-[11px] font-bold text-fg-2">
                    <Lock size={11} aria-hidden /> {t("privateChip")}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Tablar: Ma'lumot · A'zolar (boshqaruvchida so'rovlar soni bilan) */}
          {view.canView && (
            <div className="segment mt-4 grid grid-cols-2" role="tablist" aria-label={view.name}>
              <button type="button" role="tab" aria-selected={tab === "info"} data-active={tab === "info"} onClick={() => setTab("info")} className="segment-item h-10 text-[13px]">
                {t("infoTab")}
              </button>
              <button type="button" role="tab" aria-selected={tab === "members"} data-active={tab === "members"} onClick={() => setTab("members")} className="segment-item flex h-10 items-center justify-center gap-1.5 text-[13px]">
                {t("members")}
                {view.canManage && pending.length > 0 && (
                  <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold leading-none text-white" aria-label={t("requestsN", { n: pending.length })}>
                    {pending.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {tab === "info" || !view.canView ? (
            <div className="mt-4 grid gap-5" key="info">
              <section>
                <h3 className="text-[12.5px] font-semibold text-fg-3">{t("about")}</h3>
                {view.description.trim() ? (
                  <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-fg [overflow-wrap:anywhere]" data-no-auto>
                    {view.description}
                  </p>
                ) : (
                  <p className="mt-1 text-[13.5px] text-fg-4">{t("noAbout")}</p>
                )}
              </section>
              {view.rules && (
                <section>
                  <h3 className="text-[12.5px] font-semibold text-fg-3">{t("rules")}</h3>
                  <div data-no-auto>
                    <RulesText text={view.rules} className="mt-1 grid gap-2 text-[14px] leading-relaxed text-fg [overflow-wrap:anywhere]" />
                  </div>
                </section>
              )}
              <section>
                <h3 className="text-[12.5px] font-semibold text-fg-3">{t("owner")}</h3>
                <div className="mt-1.5 flex items-center gap-2.5">
                  <Avatar name={view.owner.name} src={view.owner.avatarUrl} size={34} decorative />
                  {view.owner.slug ? (
                    <Link href={`/mutaxassislar/${view.owner.slug}`} className="min-w-0 truncate text-[14px] font-semibold text-fg underline-offset-2 hover:underline" data-no-auto>
                      {view.owner.name}
                    </Link>
                  ) : (
                    <span className="min-w-0 truncate text-[14px] font-semibold text-fg" data-no-auto>
                      {view.owner.name}
                    </span>
                  )}
                  <Crown size={13} className="shrink-0 text-fg-4" aria-hidden />
                </div>
              </section>
              {view.canManage && (
                <section>
                  <h3 className="text-[12.5px] font-semibold text-fg-3">{t("inviteLink")}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-fg-3">{t(view.isPrivate ? "inviteHintPrivate" : "inviteHintOpen")}</p>
                  <div className="mt-2.5">
                    <InviteLink slug={view.slug} initialCode={view.inviteCode} initialInfo={view.invite} />
                  </div>
                </section>
              )}
              {isMember && (
                <section className="grid gap-1 border-t border-line pt-3">
                  <button
                    type="button"
                    aria-pressed={muted}
                    onClick={() => {
                      const next = !muted;
                      setMuted(next);
                      onToggleMute?.(next);
                    }}
                    className="flex min-h-12 w-full items-center gap-3 rounded-[12px] px-2 text-left text-[14px] font-medium text-fg transition hover:bg-fg/5"
                  >
                    {muted ? <BellOff size={17} className="shrink-0 text-fg-3" aria-hidden /> : <Bell size={17} className="shrink-0 text-fg-3" aria-hidden />}
                    <span className="min-w-0 flex-1">{t("notifications")}</span>
                    <span className={cn("shrink-0 text-[13px]", muted ? "text-fg-3" : "font-semibold text-success-text")}>{t(muted ? "notifOff" : "notifOn")}</span>
                  </button>
                  {view.canManage && (
                    <Link href={`/jamoalar/${view.slug}/sozlash`} className="flex min-h-12 items-center gap-3 rounded-[12px] px-2 text-[14px] font-medium text-fg transition hover:bg-fg/5">
                      <Settings size={17} className="shrink-0 text-fg-3" aria-hidden /> {t("settings")}
                    </Link>
                  )}
                  {canLeave && (
                    <button type="button" onClick={onLeave} className="flex min-h-12 w-full items-center gap-3 rounded-[12px] px-2 text-left text-[14px] font-medium text-danger-text transition hover:bg-danger-soft">
                      <LogOut size={17} className="shrink-0" aria-hidden /> {t(view.kind === "channel" ? "leaveChannel" : "leaveGroup")}
                    </button>
                  )}
                  {view.isOfficial && <p className="px-2 pt-1 text-[12.5px] leading-relaxed text-fg-4">{t("officialNoLeave")}</p>}
                </section>
              )}
            </div>
          ) : active === null ? (
            <div className="flex items-center justify-center py-12 text-fg-3" aria-busy="true">
              <Loader2 size={18} className="animate-spin" aria-label={t("loading")} />
            </div>
          ) : (
            <div className="mt-4" key="members">
              <GroupMembers
                slug={view.slug}
                canManage={view.canManage}
                isOwner={isOwner || siteAdmin}
                viewerId={viewerId}
                initialActive={active}
                initialPending={pending}
                flat
                onChanged={() => {
                  // So'rov tasdiqlandi/rad etildi yoki a'zo chiqarildi — sarlavha (son, nishon) va chat ro'yxati yangilansin
                  void load();
                  onChanged?.();
                }}
              />
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
