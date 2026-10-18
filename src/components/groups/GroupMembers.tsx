"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Crown, Download, Search, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { MemberView } from "@/lib/groups/service";
import { cn, timeAgo } from "@/lib/utils";

type Action = "approve" | "reject" | "remove" | "promote" | "demote" | "unban";
type ListResp = { ok: boolean; data?: { items: MemberView[] }; error?: string };
type Filter = "all" | "online" | "admins";

/**
 * A'zolar ro'yxati + (boshqaruvchilar uchun) qo'shilish so'rovlari va chiqarilganlar.
 * Amallar: tasdiqlash/rad etish/hammasini tasdiqlash (egasi, admin), chiqarish (adminlarni faqat egasi), admin qilish/olish (faqat egasi),
 * qaytarish (unban). CSV eksport — faqat egasi (kontaktlarsiz).
 */
export function GroupMembers({
  slug,
  canManage,
  isOwner,
  viewerId,
  initialActive,
  initialPending,
}: {
  slug: string;
  canManage: boolean;
  isOwner: boolean;
  viewerId: string | null;
  initialActive: MemberView[];
  initialPending: MemberView[];
}) {
  const { toast } = useToast();
  const [active, setActive] = useState(initialActive);
  const [pending, setPending] = useState(initialPending);
  const [banned, setBanned] = useState<MemberView[] | null>(null);
  const [showBanned, setShowBanned] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const base = `/api/groups/${encodeURIComponent(slug)}/members`;
  // Ism bo'yicha lokal filtr (katta jamoalarda ro'yxat uzun) + Onlayn / Adminlar
  const needle = q.trim().toLowerCase();
  const shown = active.filter((m) => (!needle || m.user.name.toLowerCase().includes(needle)) && (filter === "all" || (filter === "online" ? m.user.online : m.role !== "member")));
  const onlineCount = active.filter((m) => m.user.online).length;
  const adminCount = active.filter((m) => m.role !== "member").length;

  async function refresh() {
    const [a, p, b] = await Promise.all([
      fetch(base, { cache: "no-store" }).then((r) => r.json() as Promise<ListResp>),
      canManage ? fetch(`${base}?status=pending`, { cache: "no-store" }).then((r) => r.json() as Promise<ListResp>) : Promise.resolve(null),
      canManage && showBanned ? fetch(`${base}?status=banned`, { cache: "no-store" }).then((r) => r.json() as Promise<ListResp>) : Promise.resolve(null),
    ]);
    if (a.ok && a.data) setActive(a.data.items);
    if (p?.ok && p.data) setPending(p.data.items);
    if (b?.ok && b.data) setBanned(b.data.items);
  }

  async function act(userId: string, action: Action) {
    if (busyId) return;
    setBusyId(userId);
    try {
      const res = await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, action }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Bajarilmadi");
      await refresh();
      if (action === "approve") toast("Qabul qilindi");
      if (action === "unban") toast("Qaytarildi — endi qayta qo'shila oladi", "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bajarilmadi", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function approveAll() {
    if (busyId) return;
    setBusyId("*");
    try {
      const res = await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve_all" }) });
      const j = (await res.json()) as { ok: boolean; data?: { count: number }; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Bajarilmadi");
      await refresh();
      toast(`${j.data?.count ?? 0} ta so'rov qabul qilindi`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bajarilmadi", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleBanned() {
    const next = !showBanned;
    setShowBanned(next);
    if (next && banned === null) {
      const r = (await fetch(`${base}?status=banned`, { cache: "no-store" }).then((x) => x.json())) as ListResp;
      setBanned(r.ok && r.data ? r.data.items : []);
    }
  }

  return (
    <div className="grid gap-4">
      {canManage && pending.length > 0 && (
        <section className="card animate-fade-in p-4 sm:p-5" aria-labelledby="pending-h">
          <div className="flex items-center justify-between gap-3">
            <h3 id="pending-h" className="text-[15px] font-bold text-fg">
              So&apos;rovlar <span className="font-semibold text-fg-3">{pending.length}</span>
            </h3>
            {pending.length > 1 && (
              <TextBtn disabled={busyId !== null} onClick={() => void approveAll()}>
                Hammasini qabul qilish
              </TextBtn>
            )}
          </div>
          <ul className="stagger mt-2 divide-y divide-line">
            {pending.map((m) => (
              <MemberRow
                key={m.user.id}
                m={m}
                right={
                  <div className="flex shrink-0 items-center gap-1.5">
                    <IconBtn icon={Check} label="Qabul qilish" tone="ok" disabled={busyId !== null} onClick={() => void act(m.user.id, "approve")} />
                    <IconBtn icon={X} label="Rad etish" tone="danger" disabled={busyId !== null} onClick={() => void act(m.user.id, "reject")} />
                  </div>
                }
              />
            ))}
          </ul>
        </section>
      )}

      <section className="card p-4 sm:p-5" aria-labelledby="members-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="members-h" className="text-[15px] font-bold text-fg">
            A&apos;zolar <span className="font-semibold text-fg-3">{active.length}</span>
          </h3>
          {isOwner && (
            <a href={`${base}?format=csv`} download className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg" title="Ism, taxallus, rol, sana — kontaktlarsiz">
              <Download size={13} /> CSV
            </a>
          )}
        </div>
        {active.length >= 5 && (
          <div className="expand-in mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            {active.length >= 8 && (
              <label className="relative block min-w-0 flex-1">
                <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} placeholder="Ism bo'yicha…" aria-label="A'zolarni qidirish" className="field h-10 w-full pl-10 text-[13.5px]" />
              </label>
            )}
            <div className="segment flex" role="group" aria-label="A'zolar filtri">
              {(
                [
                  { key: "all", label: "Hammasi", n: active.length },
                  { key: "online", label: "Onlayn", n: onlineCount },
                  { key: "admins", label: "Adminlar", n: adminCount },
                ] as const
              ).map((o) => (
                <button key={o.key} type="button" aria-pressed={filter === o.key} data-active={filter === o.key} onClick={() => setFilter(o.key)} className="segment-item flex-1 whitespace-nowrap">
                  {o.label} <span className="ml-1 text-fg-3">{o.n}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <ul className="stagger mt-2 divide-y divide-line" key={filter + needle}>
          {shown.map((m) => {
            const self = m.user.id === viewerId;
            const manageable = canManage && !self && m.role !== "owner" && (m.role !== "admin" || isOwner);
            return (
              <MemberRow
                key={m.user.id}
                m={m}
                right={
                  manageable ? (
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      {isOwner &&
                        (m.role === "admin" ? (
                          <TextBtn disabled={busyId !== null} onClick={() => void act(m.user.id, "demote")}>
                            Adminlikdan olish
                          </TextBtn>
                        ) : (
                          <TextBtn disabled={busyId !== null} onClick={() => void act(m.user.id, "promote")}>
                            Admin qilish
                          </TextBtn>
                        ))}
                      <TextBtn tone="danger" disabled={busyId !== null} onClick={() => void act(m.user.id, "remove")}>
                        Chiqarish
                      </TextBtn>
                    </div>
                  ) : null
                }
              />
            );
          })}
        </ul>
        {shown.length === 0 && <p className="py-6 text-center text-[13px] text-fg-3">{needle ? "Bunday a'zo topilmadi" : filter === "online" ? "Hozir hech kim onlayn emas" : "Adminlar yo'q"}</p>}
      </section>

      {canManage && (
        <section className="card p-4 sm:p-5" aria-labelledby="banned-h">
          <button type="button" onClick={() => void toggleBanned()} aria-expanded={showBanned} className="flex w-full items-center justify-between text-left">
            <h3 id="banned-h" className="text-[15px] font-bold text-fg">
              Chiqarilganlar {banned && <span className="font-semibold text-fg-3">{banned.length}</span>}
            </h3>
            <span className="text-[12.5px] font-semibold text-fg-3">{showBanned ? "Yashirish" : "Ko'rsatish"}</span>
          </button>
          {showBanned && (
            <div className="expand-in">
              {banned === null ? (
                <p className="py-4 text-[13px] text-fg-3">Yuklanmoqda…</p>
              ) : banned.length === 0 ? (
                <p className="py-4 text-[13px] text-fg-3">Hech kim chiqarilmagan.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {banned.map((m) => (
                    <MemberRow
                      key={m.user.id}
                      m={m}
                      right={
                        <TextBtn disabled={busyId !== null} onClick={() => void act(m.user.id, "unban")}>
                          Qaytarish
                        </TextBtn>
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function MemberRow({ m, right }: { m: MemberView; right?: ReactNode }) {
  const name = <span className="block truncate text-[14px] font-semibold text-fg">{m.user.name}</span>;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="relative shrink-0">
        <Avatar name={m.user.name} src={m.user.avatarUrl} size={36} decorative />
        {m.user.online && <span role="img" className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-success" title="Onlayn" aria-label="Onlayn" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {m.user.slug ? (
            <Link href={`/mutaxassislar/${m.user.slug}`} className="min-w-0 underline-offset-2 hover:underline">
              {name}
            </Link>
          ) : (
            <span className="min-w-0">{name}</span>
          )}
          {m.role === "owner" && <RoleChip icon={Crown}>Egasi</RoleChip>}
          {m.role === "admin" && <RoleChip icon={ShieldCheck}>Admin</RoleChip>}
        </div>
        <p className="truncate text-[12px] text-fg-3">
          {m.status === "banned" ? "Chiqarilgan" : timeAgo(m.joinedAt)}
          {m.note && <span className="text-fg-2"> · «{m.note}»</span>}
        </p>
      </div>
      {right}
    </li>
  );
}

function RoleChip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-fg/6 px-2 py-0.5 text-[11px] font-bold text-fg-2">
      <Icon size={11} /> {children}
    </span>
  );
}

function IconBtn({ icon: Icon, label, tone, disabled, onClick }: { icon: LucideIcon; label: string; tone: "ok" | "danger"; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "press flex h-9 w-9 items-center justify-center rounded-full border transition disabled:opacity-50",
        tone === "ok" ? "border-success/40 text-success-text hover:bg-success-soft" : "border-line-2 text-fg-3 hover:border-danger/40 hover:text-danger-text",
      )}
    >
      <Icon size={16} />
    </button>
  );
}

function TextBtn({ tone = "default", disabled, onClick, children }: { tone?: "default" | "danger"; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "press inline-flex h-8 items-center rounded-full border border-line-2 px-3 text-[12.5px] font-semibold transition disabled:opacity-50",
        tone === "danger" ? "text-danger-text hover:border-danger/40" : "text-fg-2 hover:border-fg hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
