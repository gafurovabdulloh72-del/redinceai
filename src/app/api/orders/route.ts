import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, specialists } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { orderSchema } from "@/lib/validators";
import { getOrdersForUser } from "@/lib/queries";
import { enforceLimit } from "@/lib/security/rate-limit";
import { notify } from "@/lib/notifications";
import { orderHref, recordOrderEvent } from "@/lib/payments/service";
import { formatPrice, uid } from "@/lib/utils";

/** Mijoz mutaxassisga buyurtma yuboradi (soatiga 10 ta) */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, orderSchema);
  await enforceLimit("orders", session.sub);

  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.id, input.specialistId),
    columns: { id: true, userId: true, isAvailable: true, vacationUntil: true },
    with: { user: { columns: { isBanned: true } } },
  });
  // Bloklangan yoki o'chirilgan (anonimlashtirilgan — isBanned) mutaxassis ro'yxat/profilda yo'q — buyurtma ham qabul qilinmaydi
  if (!sp || sp.user.isBanned) throw new ApiError(404, "Mutaxassis topilmadi");
  if (sp.userId === session.sub) throw new ApiError(400, "O'zingizga buyurtma bera olmaysiz");

  const id = uid();
  await db.insert(orders).values({
    id,
    clientId: session.sub,
    specialistId: sp.id,
    title: input.title,
    description: input.description,
    budget: input.budget || null,
    deadline: input.deadline || null,
    contactPhone: input.contactPhone,
  });
  await recordOrderEvent(id, session.sub, "status", { toStatus: "new" });

  await notify(
    sp.userId,
    "order_new",
    `Yangi buyurtma: ${input.title}`,
    `${session.name}${input.budget ? ` · byudjet ${formatPrice(input.budget)}` : ""}${input.deadline ? ` · muddat ${input.deadline}` : ""}. Qabul qiling va narx belgilang.`,
    orderHref(id),
  );
  return ok({ id }, { status: 201 });
});

/**
 * Joriy foydalanuvchining buyurtmalari (mijoz sifatida + mutaxassis sifatida).
 * Qo'shimcha: disputeBy (kim nizo ochgan — "client"|"specialist"), autoReleaseAt (ms); foydalanuvchi ID'lari chiqmaydi.
 */
export const GET = handler(async () => {
  const session = await requireSession();
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, session.sub), columns: { id: true } });
  const result = await getOrdersForUser(session.sub, sp?.id);
  const extras = (o: { clientId: string; disputeOpenedBy: string | null; autoReleaseAt: Date | null }) => ({
    disputeOpenedBy: undefined,
    autoReleaseAt: o.autoReleaseAt?.getTime() ?? null,
    disputeBy: o.disputeOpenedBy ? (o.disputeOpenedBy === o.clientId ? ("client" as const) : ("specialist" as const)) : null,
  });
  type SpecialistRow = (typeof result.asSpecialist)[number];
  return ok({
    asClient: result.asClient.map((o) => ({ ...o, ...extras(o) })),
    asSpecialist: (result.asSpecialist as SpecialistRow[]).map((o) => ({ ...o, ...extras(o) })),
  });
});
