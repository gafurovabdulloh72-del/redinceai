import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, payments, payouts, specialists } from "@/lib/db/schema";
import type { PaymentProvider } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/* Mutaxassis balansi                                                  */
/* ------------------------------------------------------------------ */
export interface SpecialistBalance {
  /** Yakunlangan buyurtmalardan tushgan sof summa (komissiya ayrilgan) */
  released: number;
  /** Hali eskrouda turgan (to'langan, lekin mijoz qabul qilmagan) sof summa */
  escrow: number;
  /** So'ralgan / tasdiqlangan / to'langan payoutlar jami */
  paidOut: number;
  /** Ochiq (requested/approved) payoutlar jami */
  pendingPayouts: number;
  /** Chiqarish mumkin bo'lgan qoldiq = released − (requested + approved + paid) */
  available: number;
  /** Platformaga to'langan komissiya (ma'lumot uchun) */
  commission: number;
}

export async function getSpecialistBalance(specialistId: string): Promise<SpecialistBalance> {
  const [[p], [po]] = await Promise.all([
    db
      .select({
        released: sql<number>`coalesce(sum(case when ${payments.state} = 'released' then ${payments.netAmount} else 0 end), 0)`,
        escrow: sql<number>`coalesce(sum(case when ${payments.state} = 'paid' then ${payments.netAmount} else 0 end), 0)`,
        commission: sql<number>`coalesce(sum(case when ${payments.state} in ('paid','released') then ${payments.commissionAmount} else 0 end), 0)`,
      })
      .from(payments)
      .where(eq(payments.specialistId, specialistId)),
    db
      .select({
        open: sql<number>`coalesce(sum(case when ${payouts.state} in ('requested','approved') then ${payouts.amount} else 0 end), 0)`,
        paid: sql<number>`coalesce(sum(case when ${payouts.state} = 'paid' then ${payouts.amount} else 0 end), 0)`,
      })
      .from(payouts)
      .where(eq(payouts.specialistId, specialistId)),
  ]);
  const released = Number(p?.released ?? 0);
  const pendingPayouts = Number(po?.open ?? 0);
  const paidOut = Number(po?.paid ?? 0);
  return {
    released,
    escrow: Number(p?.escrow ?? 0),
    commission: Number(p?.commission ?? 0),
    pendingPayouts,
    paidOut,
    available: Math.max(0, released - pendingPayouts - paidOut),
  };
}

/* ------------------------------------------------------------------ */
/* Ro'yxatlar                                                          */
/* ------------------------------------------------------------------ */
export async function listPaymentsForClient(userId: string) {
  return db.query.payments.findMany({
    where: eq(payments.clientId, userId),
    orderBy: [desc(payments.createdAt)],
    with: {
      order: { columns: { id: true, title: true, status: true, paymentState: true } },
      specialist: { columns: { id: true, slug: true, title: true }, with: { user: { columns: { name: true, avatarUrl: true } } } },
    },
  });
}

export async function listPaymentsForSpecialist(specialistId: string) {
  return db.query.payments.findMany({
    where: eq(payments.specialistId, specialistId),
    orderBy: [desc(payments.createdAt)],
    with: {
      order: { columns: { id: true, title: true, status: true, paymentState: true } },
      client: { columns: { name: true, avatarUrl: true } },
    },
  });
}

export async function listPayoutsForSpecialist(specialistId: string) {
  return db.query.payouts.findMany({ where: eq(payouts.specialistId, specialistId), orderBy: [desc(payouts.createdAt)] });
}

/** Mijozning to'lov kutilayotgan buyurtmalari ("To'lash" tugmasi uchun) */
export async function listAwaitingOrdersForClient(userId: string) {
  return db.query.orders.findMany({
    where: and(eq(orders.clientId, userId), eq(orders.paymentState, "awaiting"), inArray(orders.status, ["accepted", "in_progress", "done"])),
    orderBy: [desc(orders.updatedAt)],
    with: { specialist: { columns: { slug: true, title: true }, with: { user: { columns: { name: true, avatarUrl: true } } } } },
  });
}

/** Mutaxassisning ochiq (requested/approved) payout so'rovi — bir vaqtda bittadan oshmasin */
export async function findOpenPayout(specialistId: string) {
  return db.query.payouts.findFirst({ where: and(eq(payouts.specialistId, specialistId), inArray(payouts.state, ["requested", "approved"])) });
}

export interface OpenPaymentRef {
  id: string;
  provider: PaymentProvider;
  state: "created" | "pending";
}

/**
 * Buyurtmalar ro'yxati uchun: har bir buyurtmaning ochiq (created/pending) to'lovi — karta «To'lash» o'rniga
 * «tasdiq kutilmoqda» / «davom etish» ko'rsatsin. Pending ustun, keyin eng yangisi.
 */
export async function listOpenPaymentsForOrders(orderIds: string[]): Promise<Map<string, OpenPaymentRef>> {
  const out = new Map<string, OpenPaymentRef>();
  if (!orderIds.length) return out;
  const rows = await db.query.payments.findMany({
    where: and(inArray(payments.orderId, orderIds), inArray(payments.state, ["created", "pending"])),
    orderBy: [desc(payments.createdAt)],
    columns: { id: true, orderId: true, provider: true, state: true },
  });
  for (const r of rows) {
    const prev = out.get(r.orderId);
    if (prev && (prev.state === "pending" || r.state === "created")) continue;
    out.set(r.orderId, { id: r.id, provider: r.provider, state: r.state === "pending" ? "pending" : "created" });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */
export interface AdminFinance {
  /** Platforma daromadi: faqat yakunlangan (released) to'lovlar komissiyasi — eskroudagi qaytarilishi mumkin */
  revenue: number;
  /** Eskrouda turgan to'lovlar komissiyasi (hali daromad emas) */
  escrowCommission: number;
  /** Eskrouda turgan sof summa (paid) */
  escrow: number;
  /** Mutaxassislarga o'tkazilgan (released) sof summa */
  released: number;
  /** To'langan payoutlar jami */
  payoutsPaid: number;
  /** Tasdiqlashni kutayotgan payoutlar (requested + approved) */
  payoutsOpen: number;
  payoutsOpenCount: number;
  /** Admin tasdig'ini kutayotgan qo'lda o'tkazmalar */
  manualPending: number;
  /** Yakunlangan (released) to'lovlar soni — daromad shulardan */
  paymentsCount: number;
}

export async function getAdminFinance(): Promise<AdminFinance> {
  const [[p], [po]] = await Promise.all([
    db
      .select({
        revenue: sql<number>`coalesce(sum(case when ${payments.state} = 'released' then ${payments.commissionAmount} else 0 end), 0)`,
        escrowCommission: sql<number>`coalesce(sum(case when ${payments.state} = 'paid' then ${payments.commissionAmount} else 0 end), 0)`,
        escrow: sql<number>`coalesce(sum(case when ${payments.state} = 'paid' then ${payments.netAmount} else 0 end), 0)`,
        released: sql<number>`coalesce(sum(case when ${payments.state} = 'released' then ${payments.netAmount} else 0 end), 0)`,
        manualPending: sql<number>`coalesce(sum(case when ${payments.state} = 'pending' and ${payments.provider} = 'manual' then 1 else 0 end), 0)`,
        total: sql<number>`coalesce(sum(case when ${payments.state} = 'released' then 1 else 0 end), 0)`,
      })
      .from(payments),
    db
      .select({
        paid: sql<number>`coalesce(sum(case when ${payouts.state} = 'paid' then ${payouts.amount} else 0 end), 0)`,
        open: sql<number>`coalesce(sum(case when ${payouts.state} in ('requested','approved') then ${payouts.amount} else 0 end), 0)`,
        openCount: sql<number>`coalesce(sum(case when ${payouts.state} in ('requested','approved') then 1 else 0 end), 0)`,
      })
      .from(payouts),
  ]);
  return {
    revenue: Number(p?.revenue ?? 0),
    escrowCommission: Number(p?.escrowCommission ?? 0),
    escrow: Number(p?.escrow ?? 0),
    released: Number(p?.released ?? 0),
    manualPending: Number(p?.manualPending ?? 0),
    paymentsCount: Number(p?.total ?? 0),
    payoutsPaid: Number(po?.paid ?? 0),
    payoutsOpen: Number(po?.open ?? 0),
    payoutsOpenCount: Number(po?.openCount ?? 0),
  };
}

export async function listAdminPayments(limit = 60) {
  return db.query.payments.findMany({
    orderBy: [desc(payments.createdAt)],
    limit,
    with: {
      order: { columns: { id: true, title: true, status: true, paymentState: true } },
      client: { columns: { name: true, email: true } },
      specialist: { columns: { id: true, slug: true }, with: { user: { columns: { name: true } } } },
    },
  });
}

/** Payout navbati: ochiqlar birinchi (eng eskisi yuqorida), keyin yopilganlar yangisidan */
export async function listAdminPayouts(limit = 40) {
  const rows = await db.query.payouts.findMany({
    orderBy: [sql`case when ${payouts.state} in ('requested','approved') then 0 else 1 end`, desc(payouts.createdAt)],
    limit,
    with: { specialist: { columns: { id: true, slug: true, title: true }, with: { user: { columns: { name: true, email: true, phone: true } } } } },
  });
  // Har bir so'rov uchun joriy balans (admin tasdiqlashdan oldin ko'rsin)
  const ids = Array.from(new Set(rows.map((r) => r.specialistId)));
  const balances = new Map<string, SpecialistBalance>();
  await Promise.all(ids.map(async (id) => balances.set(id, await getSpecialistBalance(id))));
  return rows.map((r) => {
    const b = balances.get(r.specialistId);
    // Qoplama = released − to'langan − boshqa ochiq so'rovlar (clamp'siz: ikkita ochiq so'rov ikkalasi ham "qoplangan" ko'rinmasin)
    const own = r.state === "requested" || r.state === "approved" ? r.amount : 0;
    return { ...r, releasedBalance: b ? b.released - b.paidOut - (b.pendingPayouts - own) : 0 };
  });
}

/** Mutaxassis profili bo'yicha egasini topish (payout/bildirishnoma uchun) */
export async function specialistOwnerId(specialistId: string): Promise<string | null> {
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, specialistId), columns: { userId: true } });
  return sp?.userId ?? null;
}
