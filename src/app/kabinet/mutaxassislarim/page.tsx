import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowRight, MapPin, Repeat2, Search, Users } from "lucide-react";
import { Avatar, Badge, ButtonLink, EmptyState, Stars, VerifiedBadge } from "@/components/ui";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { CATEGORY_BY_SLUG, ORDER_STATUS_LABEL, REGION_BY_SLUG, type OrderStatus } from "@/lib/constants";
import { viewerCity } from "@/lib/privacy";
import { formatPrice, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Mutaxassislarim"])  };
}

/** Buyurtmalar sahifasi (OrdersList) bilan bir xil: yangi — coral, qabul qilindi — binafsha */
const STATUS_TONE: Record<OrderStatus, "accent" | "purple" | "warning" | "success" | "neutral"> = {
  new: "accent",
  accepted: "purple",
  in_progress: "warning",
  done: "success",
  cancelled: "neutral",
};

/** «Haqiqiy» buyurtma (shahar «orders» darajasi uchun) — hasAcceptedOrderWith bilan bir xil qoida */
const ACCEPTED: ReadonlySet<OrderStatus> = new Set(["accepted", "in_progress", "done"]);

/**
 * Mijozning «Mening mutaxassislarim» ro'yxati (F48): buyurtma bergan mutaxassislar — oxirgi buyurtma, bajarilganlar soni
 * va bir bosishda qayta buyurtma. Mutaxassis ma'lumotlari minimal (aloqa/jadval chiqmaydi), shahar — maxfiylik qoidasi bo'yicha.
 */
export default async function MySpecialistsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mutaxassislarim"));

  const rows = await db.query.orders.findMany({
    where: eq(orders.clientId, user.id),
    orderBy: [desc(orders.createdAt)],
    columns: { id: true, title: true, status: true, amount: true, createdAt: true, specialistId: true },
    with: {
      specialist: {
        columns: { id: true, slug: true, title: true, category: true, regionSlug: true, city: true, visibility: true, isVerified: true, rating: true, reviewCount: true },
        with: { user: { columns: { name: true, avatarUrl: true, isBanned: true } } },
      },
    },
  });

  type Group = {
    sp: (typeof rows)[number]["specialist"];
    last: (typeof rows)[number];
    total: number;
    done: number;
    accepted: boolean;
  };
  const groups = new Map<string, Group>();
  for (const o of rows) {
    // Bloklangan mutaxassis ro'yxatda chiqmaydi (profil ham ochilmaydi)
    if (o.specialist.user.isBanned) continue;
    const g = groups.get(o.specialistId);
    if (!g) groups.set(o.specialistId, { sp: o.specialist, last: o, total: 1, done: o.status === "done" ? 1 : 0, accepted: ACCEPTED.has(o.status) });
    else {
      g.total += 1;
      if (o.status === "done") g.done += 1;
      if (ACCEPTED.has(o.status)) g.accepted = true;
    }
  }
  // Bajarilgan ishlari borlar birinchi, keyin oxirgi buyurtma sanasi bo'yicha
  const list = [...groups.values()].sort((a, b) => Number(b.done > 0) - Number(a.done > 0) || b.last.createdAt.getTime() - a.last.createdAt.getTime());

  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <span className="eyebrow">
          <Users size={13} /> Kabinet
        </span>
        <h1 className="display-xl mt-4 text-fg">
          Mening <span className="accent-serif">mutaxassislarim</span>
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">{list.length > 0 ? `${list.length} ta mutaxassis bilan ishlagansiz — bir bosishda qayta buyurtma bering.` : "Buyurtma bergan mutaxassislaringiz shu yerda jamlanadi."}</p>
      </header>

      {list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Hali hech kim bilan ishlamagansiz"
          description="Xarita yoki ro'yxatdan mutaxassis tanlab, birinchi buyurtmangizni yuboring."
          action={
            <ButtonLink href="/mutaxassislar" size="md">
              <Search size={15} /> Mutaxassis topish
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
          {list.map(({ sp, last, total, done, accepted }) => {
            const cat = CATEGORY_BY_SLUG[sp.category];
            const region = REGION_BY_SLUG[sp.regionSlug];
            const city = viewerCity(sp, { userId: user.id, role: user.role, hasOrder: accepted });
            return (
              <li key={sp.id} className="card flex min-w-0 flex-col p-4 sm:p-5">
                <div className="flex min-w-0 items-start gap-3">
                  <Link href={`/mutaxassislar/${sp.slug}`} className="shrink-0 rounded-full" aria-label={`${sp.user.name} — profil`}>
                    <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={52} decorative />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/mutaxassislar/${sp.slug}`} className="flex items-center gap-1.5 text-[15px] font-semibold text-fg hover:underline">
                      <span className="truncate">{sp.user.name}</span>
                      {sp.isVerified && <VerifiedBadge size={15} />}
                    </Link>
                    <p className="truncate text-[12.5px] text-fg-3">{sp.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-3">
                      {cat && <span>{cat.name}</span>}
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} aria-hidden="true" /> {city}
                        {region && region.slug !== "toshkent-shahri" ? ` · ${region.short}` : ""}
                      </span>
                      {sp.rating > 0 && <Stars value={sp.rating} count={sp.reviewCount} size={11} />}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-[var(--r-sm)] bg-fg/4 px-3.5 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4">Oxirgi buyurtma</p>
                  <div className="mt-1 flex min-w-0 items-center justify-between gap-3">
                    <Link href={`/kabinet/buyurtmalar?tab=mening&id=${last.id}`} className="min-w-0 truncate text-[14px] font-semibold text-fg hover:underline">
                      {last.title}
                    </Link>
                    <Badge tone={STATUS_TONE[last.status]} className="shrink-0">
                      {ORDER_STATUS_LABEL[last.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12px] text-fg-3">
                    <time dateTime={last.createdAt.toISOString()}>{timeAgo(last.createdAt)}</time>
                    {last.amount ? ` · ${formatPrice(last.amount, { compact: true })}` : ""}
                    {` · jami ${total} ta buyurtma`}
                    {done > 0 ? `, ${done} ta bajarilgan` : ""}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink href={`/buyurtma/${sp.id}`} variant="primary" size="md" className="flex-1">
                    <Repeat2 size={15} /> Qayta buyurtma
                  </ButtonLink>
                  <ButtonLink href={`/mutaxassislar/${sp.slug}`} variant="outline" size="md">
                    Profil <ArrowRight size={14} />
                  </ButtonLink>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
