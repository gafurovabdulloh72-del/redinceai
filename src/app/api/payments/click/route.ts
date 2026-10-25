import { handler } from "@/lib/api";
import { handleClick } from "@/lib/payments/click";

/**
 * Click SHOP API endpoint (Prepare/Complete, x-www-form-urlencoded). Click serverlari chaqiradi —
 * CSRF (Origin) tekshiruvi o'chirilgan, himoya md5 imzo (CLICK_SECRET_KEY) orqali.
 */
export const POST = handler(async (req) => handleClick(req), { csrf: false, limit: false });

export const GET = handler(async () => Response.json({ ok: false, error: "Faqat POST" }, { status: 405 }));
