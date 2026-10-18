import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { specialists } from "@/lib/db/schema";
import { handler, ok, parseQuery, requireSession } from "@/lib/api";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { audit } from "@/lib/security/audit";
import { csvResponse } from "@/lib/security/csv";
import { formatDateTime } from "@/lib/utils";

const schema = z.object({
  status: z.enum(["all", "pending", "verified"]).default("all"),
  format: z.enum(["json", "csv"]).default("json"),
});

/** Admin: mutaxassislar ro'yxati — CSV eksport (tasdiqlash navbati yoki hammasi). Kontaktlar faqat adminga. */
export const GET = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { status, format } = parseQuery(req.url, schema);
  const rows = await db.query.specialists.findMany({
    where: status === "pending" ? eq(specialists.isVerified, false) : status === "verified" ? eq(specialists.isVerified, true) : undefined,
    orderBy: [desc(specialists.createdAt)],
    limit: 5000,
    columns: { id: true, slug: true, title: true, category: true, regionSlug: true, city: true, isVerified: true, isFeatured: true, isHidden: true, isPrivileged: true, rating: true, reviewCount: true, completedCount: true, createdAt: true },
    with: { user: { columns: { name: true, email: true, phone: true, isBanned: true } } },
  });
  const items = rows.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.user.name,
    email: s.user.email,
    phone: s.user.phone ?? "",
    title: s.title,
    category: CATEGORY_BY_SLUG[s.category]?.name ?? s.category,
    region: REGION_BY_SLUG[s.regionSlug]?.short ?? s.regionSlug,
    city: s.city,
    verified: s.isVerified,
    featured: s.isFeatured,
    hidden: s.isHidden,
    privileged: s.isPrivileged,
    banned: s.user.isBanned,
    rating: s.rating,
    reviews: s.reviewCount,
    completed: s.completedCount,
    createdAt: s.createdAt.getTime(),
  }));

  if (format === "csv") {
    await audit(session.sub, "admin_export", { targetType: "specialists", meta: { status, rows: items.length } }, req);
    const yes = (b: boolean) => (b ? "ha" : "");
    return csvResponse(
      `kasbegalari-mutaxassislar-${status}`,
      ["id", "slug", "ism", "email", "telefon", "kasb", "yonalish", "hudud", "shahar", "tasdiqlangan", "tavsiya", "yashirilgan", "imtiyozli", "bloklangan", "reyting", "sharhlar", "bajarilgan", "yaratilgan"],
      items.map((s) => [s.id, s.slug, s.name, s.email, s.phone, s.title, s.category, s.region, s.city, yes(s.verified), yes(s.featured), yes(s.hidden), yes(s.privileged), yes(s.banned), s.rating, s.reviews, s.completed, formatDateTime(s.createdAt)]),
    );
  }
  return ok({ total: items.length, items });
});
