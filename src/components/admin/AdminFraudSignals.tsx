import Link from "next/link";
import { Ban, Network, Repeat2, Zap, type LucideIcon } from "lucide-react";
import { AdminBanToggle } from "@/components/admin/AdminBanToggle";
import { Badge, type BadgeTone } from "@/components/ui";
import type { FraudSignals, FraudUser } from "@/app/admin/fraud";
import { BURST_ORDERS, BURST_PROPOSALS, CANCEL_MIN, SHARED_IP_MIN } from "@/app/admin/fraud";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import { formatPrice, timeAgo } from "@/lib/utils";

/**
 * "Shubhali faollik" (F89): signallar — xulosa emas. Har qatorda foydalanuvchi / buyurtmaga havola va bloklash
 * (mavjud PATCH /api/admin/users/[id], AdminBanToggle). Server komponenti: ma'lumot sahifada tayyorlanadi.
 */

const ROLE_LABEL: Record<FraudUser["role"], string> = { client: "Mijoz", specialist: "Mutaxassis", admin: "Admin" };
const ROLE_TONE: Record<FraudUser["role"], BadgeTone> = { client: "neutral", specialist: "accent", admin: "ink" };

function UserRow({ u, note }: { u: FraudUser; note?: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
      <div className="min-w-[11rem] flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold text-fg">
          <span className="truncate">{u.name}</span>
          <Badge tone={u.isBanned ? "danger" : ROLE_TONE[u.role]}>{u.isBanned ? "Bloklangan" : ROLE_LABEL[u.role]}</Badge>
        </p>
        <p className="truncate text-[12px] text-fg-3">
          {u.email}
          {note ? ` · ${note}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {u.specialistSlug && (
          <Link href={`/mutaxassislar/${u.specialistSlug}`} className="inline-flex h-11 items-center rounded-full border border-line-2 px-3 text-[12px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg md:h-9">
            Profil
          </Link>
        )}
        <Link
          href={`/admin/audit?actor=${encodeURIComponent(u.email)}`}
          className="inline-flex h-11 items-center rounded-full border border-line-2 px-3 text-[12px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg md:h-9"
        >
          Audit
        </Link>
        {u.role !== "admin" && <AdminBanToggle key={`${u.id}:${u.isBanned}`} userId={u.id} name={u.name} initialBanned={u.isBanned} initialReason={u.bannedReason} />}
      </div>
    </li>
  );
}

function Group({ icon: Icon, title, rule, count, children }: { icon: LucideIcon; title: string; rule: string; count: number; children: React.ReactNode }) {
  return (
    <section className="card min-w-0 p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="icon-tile-soft icon-tile-sm shrink-0" aria-hidden="true">
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 font-display text-[16px] font-semibold text-fg">
            {title}
            <Badge tone={count > 0 ? "warning" : "success"}>{count > 0 ? `${count} ta` : "Toza"}</Badge>
          </h3>
          <p className="mt-0.5 text-[12px] text-fg-3">{rule}</p>
        </div>
      </header>
      <div className="mt-3">{count === 0 ? <p className="rounded-[var(--r-sm)] bg-surface-2 px-4 py-3 text-[13px] text-fg-3">Signal yo&apos;q.</p> : children}</div>
    </section>
  );
}

export function AdminFraudSignals({ data }: { data: FraudSignals }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Group icon={Network} title="Bir IP'dan ko'p akkaunt" rule={`Kirish (sessiya) yoki ro'yxatdan o'tish IP'si ${SHARED_IP_MIN}+ akkauntda — oxirgi 90 kun`} count={data.sharedIp.length}>
        <ul className="space-y-3">
          {data.sharedIp.map((g) => (
            <li key={g.key} className="rounded-[var(--r-sm)] border border-line px-3.5 py-2">
              <p className="flex flex-wrap items-center gap-2 pt-1 text-[12px] font-semibold text-fg-2">
                <span className="font-mono text-fg">{g.label}</span>
                <Badge tone="neutral">{g.source === "session" ? "Kirishlar" : "Ro'yxatdan o'tish"}</Badge>
                <span className="text-fg-3">{g.users.length} ta akkaunt</span>
              </p>
              <ul className="divide-y divide-line">
                {g.users.map((u) => (
                  <UserRow key={u.id} u={u} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Group>

      <Group icon={Repeat2} title="O'z-o'ziga buyurtma" rule="Buyurtmaning mijozi va mutaxassisi bir xil IP'dan kirgan (soxta sharh / reyting xavfi)" count={data.selfDealing.length}>
        <ul className="space-y-3">
          {data.selfDealing.map((o) => (
            <li key={o.orderId} className="rounded-[var(--r-sm)] border border-line px-3.5 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Link href={`/admin/buyurtmalar/${o.orderId}`} className="inline-flex min-h-10 min-w-0 items-center text-[14px] font-semibold text-fg transition hover:text-accent">
                  <span className="truncate">{o.title}</span>
                </Link>
                <span className="text-[12px] text-fg-3">
                  {ORDER_STATUS_LABEL[o.status as OrderStatus] ?? o.status}
                  {o.amount ? ` · ${formatPrice(o.amount, { compact: true })}` : ""} · {timeAgo(o.createdAt)}
                </span>
              </div>
              <ul className="divide-y divide-line">
                <UserRow u={o.client} note="mijoz" />
                <UserRow u={o.specialist} note="mutaxassis" />
              </ul>
            </li>
          ))}
        </ul>
      </Group>

      <Group
        icon={Zap}
        title="Qisqa vaqtda ko'p faollik"
        rule={`24 soatda ${BURST_ORDERS}+ buyurtma (mijoz) yoki ${BURST_PROPOSALS}+ taklif (mutaxassis)`}
        count={data.bursts.length}
      >
        <ul className="divide-y divide-line">
          {data.bursts.map((b) => (
            <UserRow key={`${b.kind}:${b.user.id}`} u={b.user} note={`${b.count} ta ${b.kind === "orders" ? "buyurtma" : "taklif"} / 24 soat`} />
          ))}
        </ul>
      </Group>

      <Group icon={Ban} title="Takroriy bekor qilishlar" rule={`90 kunda ${CANCEL_MIN}+ bekor qilingan buyurtma`} count={data.cancellations.length}>
        <ul className="divide-y divide-line">
          {data.cancellations.map((c) => (
            <UserRow key={`${c.side}:${c.user.id}`} u={c.user} note={`${c.count} ta bekor qilingan (${c.side === "client" ? "mijoz sifatida" : "mutaxassis sifatida"})`} />
          ))}
        </ul>
      </Group>
    </div>
  );
}

