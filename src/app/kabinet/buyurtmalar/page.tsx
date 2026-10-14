import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, inArray, sql } from "drizzle-orm";
import { ClipboardList, ShieldCheck } from "lucide-react";
import { OrdersList, type OrderItem, type Tab } from "@/components/orders/OrdersList";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getOrdersForUser } from "@/lib/queries";
import { availableProviders } from "@/lib/payments/config";
import { getPendingPaymentsByOrder } from "@/lib/payments/queries";
import { commissionPctFor, getSettings } from "@/lib/payments/settings";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";

/** Chat (F34): har bir buyurtma bo'yicha xabarlar soni va qarshi tomondan kelgan o'qilmaganlar */
async function chatStats(orderIds: string[], userId: string): Promise<Map<string, { count: number; unread: number }>> {
  const out = new Map<string, { count: number; unread: number }>();
  if (!orderIds.length) return out;
  try {
    const rows = await db
      .select({
        orderId: messages.orderId,
        count: sql<number>`count(*)`,
        unread: sql<number>`sum(case when ${messages.readAt} is null and ${messages.senderId} is not null and ${messages.senderId} <> ${userId} then 1 else 0 end)`,
      })
      .from(messages)
      .where(and(inArray(messages.orderId, orderIds)))
      .groupBy(messages.orderId);
    for (const r of rows) out.set(r.orderId, { count: Number(r.count) || 0, unread: Number(r.unread) || 0 });
  } catch (e) {
    console.error("[orders] chatStats", e);
  }
  return out;
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Buyurtmalar" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string; id?: string; chat?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/buyurtmalar"));

  const [{ asClient, asSpecialist }, settings] = await Promise.all([getOrdersForUser(user.id, user.specialist?.id), getSettings()]);
  // Komissiya darajali: mutaxassisga — hozirgi darajasi foizi, mijozga — oraliq (yangi / oddiy / top)
  const tierPcts = [settings.commissionPctNew, settings.commissionPct, settings.commissionPctTop];
  const feeLabel = user.specialist
    ? `${commissionPctFor(settings, user.specialist).pct}%`
    : Math.min(...tierPcts) === Math.max(...tierPcts)
      ? `${settings.commissionPct}%`
      : `${Math.min(...tierPcts)}–${Math.max(...tierPcts)}%`;
  const providers = await availableProviders();
  // Mijozning ochiq to'lovlari (created — davom ettirish, pending — tasdiq kutilmoqda)
  const [open, chats] = await Promise.all([getPendingPaymentsByOrder(asClient.map((o) => o.id)), chatStats([...asClient, ...asSpecialist].map((o) => o.id), user.id)]);

  // Bekor qilish sababi, nizo va avto-qabul (F15) — sahifa beradi, ro'yxat /api/orders'ga qayta so'rov yubormaydi.
  // Foydalanuvchi ID'lari chiqmaydi: disputeBy faqat "client" | "specialist" (GET /api/orders bilan bir xil qoida)
  const extras = (o: (typeof asClient)[number] | (typeof asSpecialist)[number]) => ({
    cancelReason: o.cancelReason ?? null,
    disputeState: o.disputeState,
    disputeReason: o.disputeReason ?? null,
    disputeBy: o.disputeOpenedBy ? (o.disputeOpenedBy === o.clientId ? ("client" as const) : ("specialist" as const)) : null,
    autoReleaseAt: o.autoReleaseAt?.getTime() ?? null,
    // F16/F30/F31/F35/F37/F40 va chat (F34)
    urgent: o.urgent,
    urgentFee: o.urgentFee,
    packageKey: o.packageKey,
    dueDate: o.dueDate,
    meetingUrl: o.meetingUrl,
    attachments: o.attachments ?? [],
    counterAmount: o.counterAmount,
    counterBy: o.counterBy,
    chatCount: chats.get(o.id)?.count ?? 0,
    chatUnread: chats.get(o.id)?.unread ?? 0,
  });

  // Mutaxassis sifatida kelgan buyurtmalar
  const incoming: OrderItem[] = asSpecialist.map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    budget: o.budget,
    deadline: o.deadline,
    contactPhone: o.contactPhone,
    status: o.status,
    amount: o.amount,
    paymentState: o.paymentState,
    commissionPct: o.commissionPct,
    completedAt: o.completedAt?.getTime() ?? null,
    createdAt: o.createdAt.getTime(),
    updatedAt: o.updatedAt.getTime(),
    specialistId: o.specialistId,
    ...extras(o),
    counterpart: { name: o.client.name, avatarUrl: o.client.avatarUrl, subtitle: "Mijoz", href: null },
  }));

  // Mijoz sifatida yuborilgan buyurtmalar
  const outgoing: OrderItem[] = asClient.map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    budget: o.budget,
    deadline: o.deadline,
    contactPhone: o.contactPhone,
    status: o.status,
    amount: o.amount,
    paymentState: o.paymentState,
    commissionPct: o.commissionPct,
    completedAt: o.completedAt?.getTime() ?? null,
    createdAt: o.createdAt.getTime(),
    updatedAt: o.updatedAt.getTime(),
    specialistId: o.specialistId,
    openPayment: open.get(o.id) ?? null,
    ...extras(o),
    counterpart: {
      name: o.specialist.user.name,
      avatarUrl: o.specialist.user.avatarUrl,
      subtitle: o.specialist.title,
      href: `/mutaxassislar/${o.specialist.slug}`,
    },
  }));

  const hasSpecialist = Boolean(user.specialist);
  const initialTab: Tab = sp.tab === "mening" ? "outgoing" : sp.tab === "kelgan" && hasSpecialist ? "incoming" : hasSpecialist ? "incoming" : "outgoing";
  const highlightId = typeof sp.id === "string" && sp.id ? sp.id : null;
  const openChatId = highlightId && sp.chat === "1" ? highlightId : null;
  const awaitingCount = outgoing.filter((o) => o.paymentState === "awaiting" && o.status !== "cancelled").length;

  return (
    <div className="animate-fade-up">
      <header className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">
            <ClipboardList size={13} className="text-accent" /> Kabinet
          </span>
          <h1 className="display-xl mt-4 text-[32px] text-fg sm:text-[40px]">Buyurtmalar</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">
            {hasSpecialist
              ? "Kelgan so'rovlarni qabul qiling, narx belgilang, jarayonni boshqaring. Mijoz to'lovi eskrouda turadi va ish qabul qilingach balansingizga tushadi."
              : "Yuborgan buyurtmalaringiz holati, narx va to'lov. Pul eskrouda saqlanadi — ish qabul qilingunga qadar mutaxassisga o'tmaydi."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[12px] font-semibold text-fg-2">
          <ShieldCheck size={14} className="text-success" />
          {awaitingCount > 0 ? `${awaitingCount} ta buyurtma to'lov kutmoqda` : `Eskrou · xizmat haqi ${feeLabel}`}
        </div>
      </header>

      <OrdersList
        incoming={incoming}
        outgoing={outgoing}
        hasSpecialist={hasSpecialist}
        initialTab={initialTab}
        highlightId={highlightId}
        providers={providers}
        commissionPct={settings.commissionPct}
        minOrderAmount={settings.minOrderAmount}
        urgentPct={settings.urgentPct}
        openChatId={openChatId}
      />
    </div>
  );
}
