import { ApiError, handler } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG, SITE } from "@/lib/constants";
import { getSettings } from "@/lib/payments/settings";
import { filterSpecialistForViewer, type Viewer } from "@/lib/privacy";
import { getSpecialistBySlug, hasAcceptedOrderWith } from "@/lib/queries";
import { siteUrl } from "@/lib/security/site";
import { canReceiveOrders } from "@/lib/subscriptions/access";
import { normalizeUzPhone } from "@/lib/utils";

/** vCard 3.0 qiymatini ekranlash (RFC 6350 §3.4): \ , ; va yangi qator */
function esc(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");
}

/** 75 baytdan uzun qatorlarni bo'lish (oddiy yondashuv — belgilar bo'yicha) */
function fold(line: string) {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) parts.push((i ? " " : "") + line.slice(i, i + 73));
  return parts.join("\r\n");
}

function handle(v: string) {
  return v.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me|instagram\.com)\//i, "").replace(/\/+$/, "");
}

/**
 * Vizitka (F66): GET /api/vcard/[slug] → text/vcard. Ism, kasb, profil havolasi va FAQAT ko'ruvchiga ko'rinadigan
 * aloqalar (maxfiylik — filterSpecialistForViewer). Obunasi faol bo'lmagan profil: aloqalar faqat egasi/admin/buyurtmachiga.
 */
export const GET = handler(async (req, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const raw = await getSpecialistBySlug(slug);
  if (!raw) throw new ApiError(404, "Mutaxassis topilmadi");

  const [session, settings] = await Promise.all([getSession(), getSettings()]);
  const isOwner = Boolean(session && session.sub === raw.userId);
  const viewer: Viewer = {
    userId: session?.sub ?? null,
    role: session?.role ?? null,
    isOwner,
    hasOrder: session && !isOwner ? await hasAcceptedOrderWith(session.sub, raw.id) : false,
  };
  const sp = filterSpecialistForViewer(raw, viewer);
  const locked = !canReceiveOrders(raw, settings) && !isOwner && viewer.role !== "admin" && !viewer.hasOrder;

  const base = siteUrl(req, { allowHostInProduction: true }) ?? "";
  const profileUrl = `${base}/mutaxassislar/${raw.slug}`;
  const cat = CATEGORY_BY_SLUG[raw.category];
  const region = REGION_BY_SLUG[raw.regionSlug];
  const [first, ...restName] = sp.user.name.trim().split(/\s+/);

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(sp.user.name)}`,
    `N:${esc(restName.join(" "))};${esc(first ?? "")};;;`,
    `TITLE:${esc(sp.title)}`,
    `ORG:${esc(SITE.name)}${cat ? `;${esc(cat.name)}` : ""}`,
    `URL:${esc(profileUrl)}`,
    `ADR;TYPE=WORK:;;;${esc(sp.city)};${esc(region?.name ?? "")};;O'zbekiston`,
  ];
  if (!locked) {
    const phone = sp.user.phone ? (normalizeUzPhone(sp.user.phone) ?? sp.user.phone) : null;
    if (phone) lines.push(`TEL;TYPE=CELL:${esc(phone)}`);
    if (sp.user.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(sp.user.email)}`);
    if (sp.telegram) lines.push(`X-SOCIALPROFILE;TYPE=telegram:${esc(`https://t.me/${handle(sp.telegram)}`)}`);
    if (sp.instagram) lines.push(`X-SOCIALPROFILE;TYPE=instagram:${esc(`https://instagram.com/${handle(sp.instagram)}`)}`);
    if (sp.website) lines.push(`URL;TYPE=WORK:${esc(sp.website)}`);
  }
  lines.push(`NOTE:${esc(`${SITE.name} profili: ${profileUrl}`)}`, "END:VCARD");

  const body = lines.map(fold).join("\r\n") + "\r\n";
  const filename = `${raw.slug.replace(/[^a-z0-9-]/gi, "") || "mutaxassis"}.vcf`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Javob ko'ruvchiga bog'liq (maxfiylik) — umumiy keshga tushmasin
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
