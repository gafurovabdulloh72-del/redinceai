import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { OrdersList, type OrderItem } from "@/components/orders/OrdersList";
import { getCurrentUser } from "@/lib/auth";
import { getOrdersForUser } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Buyurtmalar" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/auth/kirish?next=%2Fkabinet%2Fbuyurtmalar");

  const { asClient, asSpecialist } = await getOrdersForUser(user.id, user.specialist?.id);

  // Mutaxassis sifatida kelgan buyurtmalar
  const incoming: OrderItem[] = asSpecialist.map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    budget: o.budget,
    deadline: o.deadline,
    contactPhone: o.contactPhone,
    status: o.status,
    createdAt: o.createdAt.getTime(),
    updatedAt: o.updatedAt.getTime(),
    counterpart: {
      name: o.client.name,
      avatarUrl: o.client.avatarUrl,
      subtitle: "Mijoz",
      href: null,
    },
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
    createdAt: o.createdAt.getTime(),
    updatedAt: o.updatedAt.getTime(),
    counterpart: {
      name: o.specialist.user.name,
      avatarUrl: o.specialist.user.avatarUrl,
      subtitle: o.specialist.title,
      href: `/mutaxassislar/${o.specialist.slug}`,
    },
  }));

  const hasSpecialist = Boolean(user.specialist);
  const initialTab = sp.tab === "mening" ? "outgoing" : sp.tab === "kelgan" && hasSpecialist ? "incoming" : hasSpecialist ? "incoming" : "outgoing";

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="glass-weak glass-pill inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-tint">
            <ClipboardList size={12} /> Kabinet
          </span>
          <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-tight text-fg sm:text-4xl">Buyurtmalar</h1>
          <p className="mt-1.5 text-[15px] text-fg-2">
            {hasSpecialist
              ? "Kelgan so'rovlarni qabul qiling, jarayonni boshqaring va yakunlang."
              : "Yuborgan buyurtmalaringiz holati va mutaxassis bilan aloqa."}
          </p>
        </div>
      </div>

      <OrdersList incoming={incoming} outgoing={outgoing} hasSpecialist={hasSpecialist} initialTab={initialTab} />
    </div>
  );
}
