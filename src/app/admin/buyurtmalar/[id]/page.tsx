import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, CalendarClock, ClipboardList, ExternalLink, Mail, Phone, Receipt, ScrollText, Wallet } from "lucide-react";
import { AdminPaymentsTable, type AdminPaymentRow } from "@/components/admin/AdminPaymentsTable";
import { ORDER_PAYMENT_TONE } from "@/components/payments/tones";
import { Avatar, Badge, ButtonLink, SectionHeading, type BadgeTone } from "@/components/ui";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { ORDER_PAYMENT_STATE_LABEL, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import { db } from "@/lib/db";
import { auditLogs, orders, payments, users } from "@/lib/db/schema";
import { auditLabel } from "@/lib/security/audit";
import { formatDate, formatDateTime, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Buyurtma — admin", robots: { index: false, follow: false } };

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  new: "accent",
  accepted: "purple",
  in_progress: "warning",
  done: "success",
  cancelled: "neutral",
};

function metaText(meta: Record<string, unknown>) {
  return Object.entries(meta ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

/**
 * Admin: bitta buyurtma — tomonlar, tavsif, narx/to'lov holati, shu buyurtmaning to'lovlari (amallar bilan)
 * va audit jurnali. Faqat o'qish + to'lov amallari; buyurtma holatini tomonlar o'zi boshqaradi.
 */
export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(`/admin/buyurtmalar/${id}`));
  if (user.role !== "admin") redirect("/kabinet");

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      client: { columns: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
      specialist: { columns: { id: true, slug: true, title: true, isVerified: true }, with: { user: { columns: { name: true, email: true, phone: true, avatarUrl: true } } } },
    },
  });
  if (!order) notFound();

  const orderPayments = await db.query.payments.findMany({
    where: eq(payments.orderId, order.id),
    orderBy: [desc(payments.createdAt)],
    with: {
      client: { columns: { name: true, email: true } },
      specialist: { columns: { id: true, slug: true }, with: { user: { columns: { name: true } } } },
    },
  });

  const targetIds = [order.id, ...orderPayments.map((p) => p.id)];
  const trail = await db
    .select({ id: auditLogs.id, action: auditLogs.action, targetType: auditLogs.targetType, meta: auditLogs.meta, createdAt: auditLogs.createdAt, actorName: users.name, actorEmail: users.email })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(and(inArray(auditLogs.targetType, ["order", "payment"]), inArray(auditLogs.targetId, targetIds)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(60);

  const paymentRows: AdminPaymentRow[] = orderPayments.map((p) => ({
    id: p.id,
    orderId: p.orderId,
    orderTitle: order.title,
    provider: p.provider,
    state: p.state,
    amount: p.amount,
    commissionPct: p.commissionPct,
    commissionAmount: p.commissionAmount,
    netAmount: p.netAmount,
    providerTxnId: p.providerTxnId,
    createdAt: p.createdAt.getTime(),
    paidAt: p.paidAt?.getTime() ?? null,
    releasedAt: p.releasedAt?.getTime() ?? null,
    client: { name: p.client.name, email: p.client.email },
    specialist: { id: p.specialist.id, slug: p.specialist.slug, name: p.specialist.user.name },
  }));

  const net = order.amount != null ? order.amount - Math.round((order.amount * (order.commissionPct ?? 0)) / 100) : null;

  const Party = ({ title, name, subtitle, email, phone, avatarUrl, href }: { title: string; name: string; subtitle: string | null; email: string; phone: string | null; avatarUrl: string | null; href?: string }) => (
    <div className="card p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">{title}</p>
      <div className="mt-3 flex items-center gap-3">
        <Avatar name={name} src={avatarUrl} size={44} decorative />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-fg">
            <span className="truncate">{name}</span>
            {href && (
              <Link href={href} target="_blank" rel="noreferrer" aria-label="Ommaviy profil" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg-4 transition hover:bg-fg/6 hover:text-fg">
                <ExternalLink size={13} />
              </Link>
            )}
          </p>
          {subtitle && <p className="truncate text-[12px] text-fg-3">{subtitle}</p>}
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-[13px] text-fg-2">
        <li>
          <a href={`mailto:${email}`} className="inline-flex min-h-7 items-center gap-1.5 hover:text-fg">
            <Mail size={13} className="text-fg-4" /> {email}
          </a>
        </li>
        {phone && (
          <li>
            <a href={`tel:${phone}`} className="inline-flex min-h-7 items-center gap-1.5 hover:text-fg">
              <Phone size={13} className="text-fg-4" /> {phone}
            </a>
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div className="container-x animate-fade-up">
      <Link href="/admin#tolovlar" className="mb-5 inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-fg-3 transition hover:text-fg">
        <ArrowLeft size={14} /> Admin panel
      </Link>

      <header className="flex flex-col gap-4">
        <span className="eyebrow">
          <ClipboardList size={13} className="text-accent" /> Admin · Buyurtma
        </span>
        <h1 className="display-xl text-[28px] text-fg sm:text-[40px]">{order.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[order.status]} className="!px-3 !py-1.5">
            {ORDER_STATUS_LABEL[order.status]}
          </Badge>
          <Badge tone={ORDER_PAYMENT_TONE[order.paymentState]} className="!px-3 !py-1.5">
            {ORDER_PAYMENT_STATE_LABEL[order.paymentState]}
          </Badge>
          <span className="font-mono text-[12px] text-fg-4">{order.id}</span>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:gap-8">
        {/* min-w-0: ichidagi aylanadigan filtr (segment) grid ustunini kengaytirib yubormasin */}
        <div className="min-w-0 space-y-6 lg:col-span-8">
          {/* Tavsif + shartlar */}
          <div className="card p-5 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Tavsif</p>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-fg-2">{order.description}</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-[13px] sm:grid-cols-4">
              <div>
                <dt className="inline-flex items-center gap-1 text-fg-4">
                  <Wallet size={12} /> Byudjet
                </dt>
                <dd className="font-semibold text-fg tabular-nums">{order.budget ? formatPrice(order.budget) : "Kelishiladi"}</dd>
              </div>
              <div>
                <dt className="inline-flex items-center gap-1 text-fg-4">
                  <CalendarClock size={12} /> Muddat
                </dt>
                <dd className="font-semibold text-fg">{order.deadline ?? "—"}</dd>
              </div>
              <div>
                <dt className="inline-flex items-center gap-1 text-fg-4">
                  <Phone size={12} /> Aloqa
                </dt>
                <dd className="font-semibold text-fg">
                  <a href={`tel:${order.contactPhone.replace(/[^\d+]/g, "")}`} className="hover:text-accent">
                    {order.contactPhone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-fg-4">Yaratilgan</dt>
                <dd className="font-semibold text-fg">
                  <time dateTime={order.createdAt.toISOString()}>{formatDateTime(order.createdAt)}</time>
                </dd>
              </div>
            </dl>
          </div>

          {/* To'lovlar */}
          <section id="tolovlar" className="scroll-mt-28">
            <SectionHeading
              eyebrow="To'lovlar"
              title="Shu buyurtma to'lovlari"
              description="Qo'lda o'tkazmani tasdiqlash, eskroudagi pulni qaytarish yoki mutaxassisga o'tkazish — shu yerda."
              action={
                <span className="inline-flex items-center gap-1.5 self-start text-[12px] font-semibold text-fg-3 sm:self-auto">
                  <Receipt size={14} /> {paymentRows.length} ta yozuv
                </span>
              }
            />
            <AdminPaymentsTable rows={paymentRows} />
          </section>

          {/* Jurnal */}
          <section>
            <SectionHeading eyebrow="Jurnal" title="Harakatlar tarixi" description="Buyurtma holati, narx, to'lov va admin qarorlari — nizolarda asos." />
            {trail.length === 0 ? (
              <p className="card p-5 text-[14px] text-fg-3">Hali yozuvlar yo'q.</p>
            ) : (
              <ol className="card divide-y divide-line overflow-hidden">
                {trail.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
                    <time dateTime={r.createdAt.toISOString()} className="shrink-0 text-[12px] text-fg-4 sm:w-32 sm:pt-1">
                      {formatDateTime(r.createdAt)}
                    </time>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[13px]">
                        <Badge tone={r.action.startsWith("admin_") ? "ink" : r.action.startsWith("order_") ? "info" : "purple"}>{auditLabel(r.action)}</Badge>
                        <span className="text-fg-2">{r.actorName ?? "Tizim"}</span>
                        {r.actorEmail && <span className="truncate text-[11px] text-fg-4">{r.actorEmail}</span>}
                      </p>
                      {metaText(r.meta) && <p className="mt-1 break-all text-[12px] text-fg-3">{metaText(r.meta)}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-3">
              <ButtonLink href="/admin/audit" variant="outline" size="sm">
                <ScrollText size={14} /> To'liq audit jurnali
              </ButtonLink>
            </div>
          </section>
        </div>

        {/* Yon panel: narx + tomonlar */}
        <aside className="min-w-0 space-y-4 lg:col-span-4">
          <div className="card-elevated p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Kelishilgan narx</p>
            <p className="mt-1 font-display text-[28px] font-semibold leading-tight text-fg tabular-nums">{order.amount != null ? formatPrice(order.amount) : "—"}</p>
            <dl className="mt-4 space-y-2 border-t border-line pt-3 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-3">Komissiya</dt>
                <dd className="font-medium text-fg tabular-nums">{order.commissionPct != null ? `${order.commissionPct}%` : "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-3">Mutaxassisga</dt>
                <dd className="font-medium text-fg tabular-nums">{net != null ? formatPrice(net) : "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-3">Yangilangan</dt>
                <dd className="text-fg-2">{formatDate(order.updatedAt)}</dd>
              </div>
              {order.completedAt && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-fg-3">Mijoz qabul qildi</dt>
                  <dd className="text-fg-2">{formatDate(order.completedAt)}</dd>
                </div>
              )}
            </dl>
          </div>
          <Party title="Mijoz" name={order.client.name} subtitle={null} email={order.client.email} phone={order.client.phone} avatarUrl={order.client.avatarUrl} />
          <Party
            title={order.specialist.isVerified ? "Mutaxassis · tasdiqlangan" : "Mutaxassis"}
            name={order.specialist.user.name}
            subtitle={order.specialist.title}
            email={order.specialist.user.email}
            phone={order.specialist.user.phone}
            avatarUrl={order.specialist.user.avatarUrl}
            href={`/mutaxassislar/${order.specialist.slug}`}
          />
        </aside>
      </div>
    </div>
  );
}
