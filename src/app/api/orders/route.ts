import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders, specialists, type PackageKey } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { orderSchema } from "@/lib/validators";
import { PACKAGE_TIERS } from "@/lib/constants";
import { getOrdersForUser } from "@/lib/queries";
import { isOnVacation, tashkentNow } from "@/lib/privacy";
import { enforceLimit } from "@/lib/security/rate-limit";
import { notify } from "@/lib/notifications";
import { orderHref, recordOrderEvent } from "@/lib/payments/service";
import { getSettings } from "@/lib/payments/settings";
import { canReceiveOrders } from "@/lib/subscriptions/access";
import { formatDate, formatPrice, uid } from "@/lib/utils";
import { assertOwnUploads, attachmentListSchema, uniqueAttachments } from "./_lib/attachments";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Topshirish sanasi bugundan ko'pi bilan 1 yil keyin */
const MAX_DUE_DAYS = 366;

/**
 * Buyurtma formasi: asosiy maydonlar (validators.orderSchema) + F30 shoshilinch, F31 paket, F35 biriktirmalar, F37 topshirish sanasi.
 * Hammasi ixtiyoriy — eski mijozlar (faqat asosiy maydonlar) ham ishlayveradi.
 */
const createSchema = orderSchema.extend({
  dueDate: z.string().trim().regex(DATE_RE, "Sana noto'g'ri").optional().nullable().or(z.literal("")),
  urgent: z.boolean().optional().default(false),
  packageKey: z.enum(PACKAGE_TIERS.map((p) => p.key) as [PackageKey, ...PackageKey[]]).optional().nullable(),
  attachments: attachmentListSchema().optional().default([]),
});

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Mijoz mutaxassisga buyurtma yuboradi (soatiga 10 ta).
 * Obunasi faol bo'lmagan (sinov + imtiyozli kunlar tugagan) mutaxassis yangi buyurtma olmaydi — 403 (subscriptions/access.ts).
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, createSchema);
  await enforceLimit("orders", session.sub);

  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.id, input.specialistId),
    columns: { id: true, userId: true, isAvailable: true, vacationUntil: true, packages: true, blockedDates: true, createdAt: true, subscriptionUntil: true },
    with: { user: { columns: { isBanned: true } } },
  });
  // Bloklangan yoki o'chirilgan (anonimlashtirilgan — isBanned) mutaxassis ro'yxat/profilda yo'q — buyurtma ham qabul qilinmaydi
  if (!sp || sp.user.isBanned) throw new ApiError(404, "Mutaxassis topilmadi");
  if (sp.userId === session.sub) throw new ApiError(400, "O'zingizga buyurtma bera olmaysiz");
  const settings = await getSettings();
  if (!canReceiveOrders(sp, settings)) throw new ApiError(403, "Mutaxassis obunasi faol emas");

  // Topshirish sanasi: bugundan oldin emas, mutaxassisning band kunlarida emas
  const dueDate = input.dueDate || null;
  if (dueDate) {
    const today = tashkentNow().date;
    if (dueDate < today) throw new ApiError(422, "Ma'lumotlarni tekshiring", { dueDate: "Sana bugundan oldin bo'lmasin" });
    if (dueDate > addDays(today, MAX_DUE_DAYS)) throw new ApiError(422, "Ma'lumotlarni tekshiring", { dueDate: "Sana 1 yildan uzoq bo'lmasin" });
    if (sp.blockedDates.includes(dueDate)) throw new ApiError(422, "Ma'lumotlarni tekshiring", { dueDate: "Mutaxassis bu sanada band — boshqa kunni tanlang" });
  }

  // Paket: faqat mutaxassisda haqiqatan bor paket; byudjet berilmasa — paket narxi
  const pkg = input.packageKey ? sp.packages.find((p) => p.key === input.packageKey) : null;
  if (input.packageKey && !pkg) throw new ApiError(422, "Ma'lumotlarni tekshiring", { packageKey: "Bu paket mavjud emas" });
  const budget = input.budget || pkg?.price || null;

  const attachments = uniqueAttachments(input.attachments);
  await assertOwnUploads(
    session.sub,
    attachments.map((a) => a.url),
  );

  const id = uid();
  await db.insert(orders).values({
    id,
    clientId: session.sub,
    specialistId: sp.id,
    title: input.title,
    description: input.description,
    budget,
    // Erkin matnli muddat bo'lmasa — topshirish sanasi (eski ko'rinishlar uchun)
    deadline: input.deadline || (dueDate ? `${formatDate(dueDate)} gacha` : null),
    dueDate,
    urgent: input.urgent,
    packageKey: pkg ? pkg.key : null,
    attachments,
    contactPhone: input.contactPhone,
  });
  const extra = [input.urgent ? "shoshilinch" : null, pkg ? `paket: ${pkg.title}` : null, attachments.length ? `${attachments.length} ta fayl` : null].filter(Boolean).join(", ");
  await recordOrderEvent(id, session.sub, "status", { toStatus: "new", note: extra ? extra[0].toUpperCase() + extra.slice(1) : null });

  await notify(
    sp.userId,
    "order_new",
    `${input.urgent ? "Shoshilinch buyurtma" : "Yangi buyurtma"}: ${input.title}`,
    `${session.name}${budget ? ` · byudjet ${formatPrice(budget)}` : ""}${dueDate ? ` · topshirish ${formatDate(dueDate)}` : input.deadline ? ` · muddat ${input.deadline}` : ""}${pkg ? ` · «${pkg.title}» paketi` : ""}. Qabul qiling va narx belgilang.`,
    orderHref(id),
  );
  // Halol muddat (#43): mutaxassis ta'tilda yoki band bo'lsa buyurtma baribir yaratiladi,
  // lekin mijozga navbat belgisi va (ta'tilda bo'lsa) qaytish sanasi qaytariladi
  const vacation = isOnVacation(sp.vacationUntil);
  const queued = vacation || !sp.isAvailable;
  return ok({ id, ...(queued ? { queued: true as const, availableFrom: vacation ? sp.vacationUntil : null } : {}) }, { status: 201 });
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
