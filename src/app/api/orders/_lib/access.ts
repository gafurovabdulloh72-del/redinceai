import "server-only";
import { ApiError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth";
import { loadOrderWithParties, type OrderWithParties } from "@/lib/payments/service";

export type OrderRole = "client" | "specialist" | "admin";

/**
 * Buyurtmani tomonlar (mijoz / mutaxassis egasi) yoki admin uchun yuklash.
 * Begona foydalanuvchiga 404 (buyurtma borligi oshkor bo'lmasin) — events route bilan bir xil qoida.
 * `write: true` — admin faqat o'qiydi (chat, biriktirma, havola o'zgartirishda 403).
 */
export async function loadOrderForParty(id: string, session: Pick<SessionPayload, "sub" | "role">, opts: { write?: boolean } = {}): Promise<{ order: OrderWithParties; role: OrderRole }> {
  const order = await loadOrderWithParties(id);
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");
  const role: OrderRole | null = order.specialist.userId === session.sub ? "specialist" : order.clientId === session.sub ? "client" : session.role === "admin" ? "admin" : null;
  if (!role) throw new ApiError(404, "Buyurtma topilmadi");
  if (opts.write && role === "admin") throw new ApiError(403, "Administrator bu buyurtmani faqat ko'ra oladi");
  return { order, role };
}

/** Qarshi tomon userId'si (bildirishnoma uchun) */
export function otherPartyId(order: OrderWithParties, role: OrderRole): string {
  return role === "client" ? order.specialist.userId : order.clientId;
}
