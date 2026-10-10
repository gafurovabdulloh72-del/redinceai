import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import type { PaymentProvider } from "@/lib/constants";
import { paymentsEnv } from "./config";
import { buildRedirectUrl } from "./service";

/** To'lov + buyurtma + tomonlar (checkout sahifasi, status API, admin) */
export async function loadPaymentDetail(id: string) {
  const row = await db.query.payments.findFirst({
    where: eq(payments.id, id),
    with: {
      order: { columns: { id: true, title: true, status: true, paymentState: true, amount: true, completedAt: true } },
      client: { columns: { id: true, name: true, avatarUrl: true } },
      specialist: { columns: { id: true, slug: true, title: true, userId: true }, with: { user: { columns: { name: true, avatarUrl: true } } } },
    },
  });
  return row ?? null;
}
export type PaymentDetail = NonNullable<Awaited<ReturnType<typeof loadPaymentDetail>>>;

export interface PaymentDto {
  id: string;
  orderId: string;
  orderTitle: string;
  orderStatus: PaymentDetail["order"]["status"];
  orderPaymentState: PaymentDetail["order"]["paymentState"];
  provider: PaymentProvider;
  state: PaymentDetail["state"];
  amount: number;
  commissionPct: number;
  commissionAmount: number;
  netAmount: number;
  /** ms */
  createdAt: number;
  paidAt: number | null;
  releasedAt: number | null;
  /** Payme/Click checkout havolasi — faqat hali to'lanmagan (created) holatda */
  redirectUrl: string | null;
  /** Qo'lda o'tkazma rekvizitlari */
  card: { number: string; name: string } | null;
  specialist: { name: string; avatarUrl: string | null; title: string; slug: string };
  client: { name: string };
}

export function toPaymentDto(p: PaymentDetail, origin: string): PaymentDto {
  const env = paymentsEnv();
  const open = p.state === "created" || p.state === "pending";
  return {
    id: p.id,
    orderId: p.orderId,
    orderTitle: p.order.title,
    orderStatus: p.order.status,
    orderPaymentState: p.order.paymentState,
    provider: p.provider,
    state: p.state,
    amount: p.amount,
    commissionPct: p.commissionPct,
    commissionAmount: p.commissionAmount,
    netAmount: p.netAmount,
    createdAt: p.createdAt.getTime(),
    paidAt: p.paidAt?.getTime() ?? null,
    releasedAt: p.releasedAt?.getTime() ?? null,
    redirectUrl: open && p.provider !== "manual" ? buildRedirectUrl(p, origin) : null,
    card: p.provider === "manual" && env.manual.card ? { number: env.manual.card, name: env.manual.name } : null,
    specialist: { name: p.specialist.user.name, avatarUrl: p.specialist.user.avatarUrl, title: p.specialist.title, slug: p.specialist.slug },
    client: { name: p.client.name },
  };
}

/** Ko'rish huquqi: mijoz, mutaxassis egasi yoki admin */
export function canViewPayment(p: PaymentDetail, viewer: { sub: string; role: string }): boolean {
  return viewer.role === "admin" || p.clientId === viewer.sub || p.specialist.userId === viewer.sub;
}
