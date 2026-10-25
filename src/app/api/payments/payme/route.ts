import { handler } from "@/lib/api";
import { handlePayme } from "@/lib/payments/payme";

/**
 * Payme Merchant API endpoint (JSON-RPC 2.0). Payme serverlari chaqiradi —
 * CSRF (Origin) tekshiruvi o'chirilgan, himoya Basic auth (Paycom:<KEY>) orqali.
 */
export const POST = handler(async (req) => handlePayme(req), { csrf: false, limit: false });

export const GET = handler(async () => Response.json({ ok: false, error: "Faqat POST (JSON-RPC)" }, { status: 405 }));
