import { SITE } from "@/lib/constants";
import { qrSvg } from "@/lib/profile/qr";
import { slugByShortCode } from "@/lib/queries";
import { trustedSiteOrigin } from "@/lib/security/request";

export const dynamic = "force-dynamic";

/**
 * GET /u/<kod>/qr — qisqa havolaning QR kodi (image/svg+xml, yuklab olinadi). Faqat mavjud, bloklanmagan profil kodi uchun;
 * ichida faqat ommaviy manzil bor (shaxsiy ma'lumot yo'q), shuning uchun umumiy kesh 1 kun.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const slug = await slugByShortCode(code);
  if (!slug) return new Response("Topilmadi", { status: 404 });
  const url = new URL(req.url);
  const origin = trustedSiteOrigin() ?? `${url.protocol}//${url.host}`;
  const target = `${origin}/u/${code.toUpperCase()}`;
  const svg = qrSvg(target, { size: 512, title: `${SITE.name} — ${target}` });
  if (!svg) return new Response("Havola juda uzun", { status: 422 });
  const download = url.searchParams.get("yuklab") === "1";
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
      ...(download ? { "Content-Disposition": `attachment; filename="${slug}-qr.svg"` } : {}),
    },
  });
}
