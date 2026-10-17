"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Crown, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui";
import type { MemberView } from "@/lib/groups/service";
import { cn, timeAgo } from "@/lib/utils";

type Action = "approve" | "reject" | "remove" | "promote" | "demote";
type ListResp = { ok: boolean; data?: { items: MemberView[] }; error?: string };

/**
 * A'zolar ro'yxati + (boshqaruvchilar uchun) qo'shilish so'rovlari.
 * Amallar: tasdiqlash/rad etish (egasi, admin), chiqarish (egasi, admin — adminlarni faqat egasi), admin qilish/olish (faqat egasi).
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
  const [active, setActive] = useState(initialActive);
  const [pending, setPending] = useState(initialPending);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/groups/${encodeURIComponent(slug)}/members`;

  async function refresh() {
    const [a, p] = await Promise.all([
      fetch(base, { cache: "no-store" }).then((r) => r.json() as Promise<ListResp>),
      canManage ? fetch(`${base}?status=pending`, { cache: "no-store" }).then((r) => r.json() as Promise<ListResp>) : Promise.resolve(null),
    ]);
    if (a.ok && a.data) setActive(a.data.items);
    if (p?.ok && p.data) setPending(p.data.items);
  }

  async function act(userId: string, action: Action) {
    if (busyId) return;
    setBusyId(userId);
    setError(null);
    try {
      const res = await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, action }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Bajarilmadi");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bajarilmadi");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-4">
      {canManage && pending.length > 0 && (
        <section className="card p-4 sm:p-5" aria-labelledby="pending-h">
          <h3 id="pending-h" className="text-[15px] font-bold text-fg">
            Qo&apos;shilish so&apos;rovlari <span className="font-semibold text-fg-3">{pending.length}</span>
          </h3>
          <ul className="mt-2 divide-y divide-line">
            {pending.map((m) => (
              <MemberRow
                key={m.user.id}
                m={m}
                right={
                  <div className="flex shrink-0 items-center gap-1.5">
                    <IconBtn icon={Check} label="Qabul qilish" tone="ok" disabled={busyId === m.user.id} onClick={() => void act(m.user.id, "approve")} />
                    <IconBtn icon={X} label="Rad etish" tone="danger" disabled={busyId === m.user.id} onClick={() => void act(m.user.id, "reject")} />
                  </div>
                }
              />
            ))}
          </ul>
        </section>
      )}

      <section className="card p-4 sm:p-5" aria-labelledby="members-h">
        <h3 id="members-h" className="text-[15px] font-bold text-fg">
          A&apos;zolar <span className="font-semibold text-fg-3">{active.length}</span>
        </h3>
        <ul className="mt-2 divide-y divide-line">
          {active.map((m) => {
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
                          <TextBtn disabled={busyId === m.user.id} onClick={() => void act(m.user.id, "demote")}>
                            Adminlikdan olish
                          </TextBtn>
                        ) : (
                          <TextBtn disabled={busyId === m.user.id} onClick={() => void act(m.user.id, "promote")}>
                            Admin qilish
                          </TextBtn>
                        ))}
                      <TextBtn tone="danger" disabled={busyId === m.user.id} onClick={() => void act(m.user.id, "remove")}>
                        Chiqarish
                      </TextBtn>
                    </div>
                  ) : null
                }
              />
            );
          })}
        </ul>
      </section>
      {error && <p className="text-[12.5px] font-semibold text-danger-text">{error}</p>}
    </div>
  );
}

function MemberRow({ m, right }: { m: MemberView; right?: ReactNode }) {
  const name = <span className="truncate text-[14px] font-semibold text-fg">{m.user.name}</span>;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar name={m.user.name} src={m.user.avatarUrl} size={36} decorative />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {m.user.slug ? (
            <Link href={`/mutaxassislar/${m.user.slug}`} className="min-w-0 underline-offset-2 hover:underline">
              {name}
            </Link>
          ) : (
            name
          )}
          {m.role === "owner" && <RoleChip icon={Crown}>Egasi</RoleChip>}
          {m.role === "admin" && <RoleChip icon={ShieldCheck}>Admin</RoleChip>}
        </div>
        <p className="text-[12px] text-fg-3">{m.status === "pending" ? `So'rov yuborgan: ${timeAgo(m.joinedAt)}` : `Qo'shilgan: ${timeAgo(m.joinedAt)}`}</p>
      </div>
      {right}
    </li>
  );
}

function RoleChip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-text">
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
        "flex h-9 w-9 items-center justify-center rounded-full border transition disabled:opacity-50",
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
        "inline-flex h-8 items-center rounded-full border border-line-2 px-3 text-[12.5px] font-semibold transition disabled:opacity-50",
        tone === "danger" ? "text-danger-text hover:border-danger/40" : "text-fg-2 hover:border-fg hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
