import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { Bell, BellOff, Settings } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { Pagination } from "@/components/specialists/Pagination";
import { NotificationsList, type NotificationRow } from "@/components/kabinet/NotificationsList";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bildirishnomalar" };

const PER_PAGE = 20;
const BASE = "/kabinet/bildirishnomalar";

/** Barcha bildirishnomalar: yangilari birinchi (barqaror sahifalash uchun faqat vaqt bo'yicha), 20 tadan */
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string; filter?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(BASE));

  const onlyUnread = sp.filter === "unread";
  const mine = eq(notifications.userId, user.id);
  const where = onlyUnread ? and(mine, isNull(notifications.readAt)) : mine;

  const [[{ total }], [{ unread }]] = await Promise.all([
    db.select({ total: count() }).from(notifications).where(where),
    db.select({ unread: count() }).from(notifications).where(and(mine, isNull(notifications.readAt))),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const requested = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(requested) ? Math.min(Math.max(1, requested), pages) : 1;

  const rows = await db.query.notifications.findMany({
    where,
    orderBy: [desc(notifications.createdAt), desc(notifications.id)],
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });
  const items: NotificationRow[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    readAt: n.readAt?.getTime() ?? null,
    createdAt: n.createdAt.getTime(),
  }));

  const tabs = [
    { key: "all", label: "Hammasi", href: BASE, active: !onlyUnread },
    { key: "unread", label: unread > 0 ? `O'qilmagan · ${unread}` : "O'qilmagan", href: `${BASE}?filter=unread`, active: onlyUnread },
  ];

  return (
    <div className="animate-fade-up">
      <header className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">
            <Bell size={13} className="text-accent" /> Kabinet
          </span>
          <h1 className="display-xl mt-4 text-[32px] text-fg sm:text-[40px]">Bildirishnomalar</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">Buyurtma, to'lov va hisob yangiliklari. Muhimlari emailingizga ham yuboriladi.</p>
        </div>
        <ButtonLink href="/kabinet/profil#akkaunt" variant="outline" size="sm" className="shrink-0 self-start sm:self-auto">
          <Settings size={14} /> Email sozlamalari
        </ButtonLink>
      </header>

      <nav aria-label="Saralash" className="segment mb-4 inline-flex">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} aria-current={t.active ? "page" : undefined} data-active={t.active} className={cn("segment-item inline-flex min-h-9 items-center")}>
            {t.label}
          </Link>
        ))}
      </nav>

      {items.length > 0 ? (
        <>
          <NotificationsList key={`${page}-${onlyUnread ? "u" : "a"}`} items={items} unread={unread} />
          <Pagination page={page} pages={pages} query={{ filter: onlyUnread ? "unread" : undefined }} basePath={BASE} className="mt-6" />
        </>
      ) : (
        <EmptyState
          icon={onlyUnread ? Bell : BellOff}
          title={onlyUnread ? "O'qilmagan bildirishnoma yo'q" : "Hali bildirishnoma yo'q"}
          description={onlyUnread ? "Hammasi ko'rib chiqilgan. Yangi buyurtma yoki to'lov bo'lsa shu yerda chiqadi." : "Buyurtma va to'lov yangiliklari shu yerda jamlanadi."}
          action={
            onlyUnread ? (
              <ButtonLink href={BASE} variant="outline" size="md">
                Barchasini ko'rish
              </ButtonLink>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
