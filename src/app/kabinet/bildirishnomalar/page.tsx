import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { Bell, BellOff } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { Pagination } from "@/components/specialists/Pagination";
import { NotificationPrefs } from "@/components/kabinet/NotificationPrefs";
import { NotificationsList, type NotificationRow } from "@/components/kabinet/NotificationsList";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { NOTIFY_GROUPS, NOTIFY_GROUP_KEYS, NOTIFY_GROUP_META, notifyGroupOf, type NotifyGroupKey } from "@/lib/notifications";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bildirishnomalar" };

const PER_PAGE = 20;
const BASE = "/kabinet/bildirishnomalar";
const GROUP_SET = new Set<string>(NOTIFY_GROUP_KEYS);

/** Barcha bildirishnomalar: yangilari birinchi (barqaror sahifalash uchun faqat vaqt bo'yicha), 20 tadan; filtr: o'qilmagan yoki tur guruhi */
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string; filter?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(BASE));

  const onlyUnread = sp.filter === "unread";
  const group = sp.filter && GROUP_SET.has(sp.filter) ? (sp.filter as NotifyGroupKey) : null;
  const mine = eq(notifications.userId, user.id);
  const where = onlyUnread ? and(mine, isNull(notifications.readAt)) : group ? and(mine, inArray(notifications.type, [...NOTIFY_GROUPS[group]])) : mine;

  const [[{ total }], [{ unread }], byType, prefsRow] = await Promise.all([
    db.select({ total: count() }).from(notifications).where(where),
    db.select({ unread: count() }).from(notifications).where(and(mine, isNull(notifications.readAt))),
    db.select({ type: notifications.type, n: count() }).from(notifications).where(mine).groupBy(notifications.type),
    db.query.users.findFirst({ where: eq(users.id, user.id), columns: { notifyPrefs: true, notifyEmail: true } }),
  ]);
  const groupCounts: Record<NotifyGroupKey, number> = { orders: 0, jobs: 0, social: 0, chat: 0, system: 0 };
  for (const r of byType) {
    const g = notifyGroupOf(r.type);
    if (g) groupCounts[g] += r.n;
  }
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

  const filterKey = onlyUnread ? "unread" : (group ?? undefined);
  const tabs: Array<{ key: string; label: string; href: string; active: boolean; count?: number }> = [
    { key: "all", label: "Hammasi", href: BASE, active: !onlyUnread && !group },
    { key: "unread", label: "O'qilmagan", href: `${BASE}?filter=unread`, active: onlyUnread, count: unread },
    ...NOTIFY_GROUP_KEYS.filter((k) => groupCounts[k] > 0).map((k) => ({ key: k, label: NOTIFY_GROUP_META[k].label.split(" ")[0], href: `${BASE}?filter=${k}`, active: group === k, count: groupCounts[k] })),
  ];
  const prefs = {
    groups: Object.fromEntries(NOTIFY_GROUP_KEYS.map((k) => [k, (prefsRow?.notifyPrefs ?? {})[k] !== false])) as Record<NotifyGroupKey, boolean>,
    notifyEmail: prefsRow?.notifyEmail ?? true,
    meta: NOTIFY_GROUP_META,
  };

  return (
    <div className="animate-fade-up">
      <header className="mb-5 sm:mb-6">
        <span className="eyebrow">
          <Bell size={13} /> Kabinet
        </span>
        <h1 className="display-xl mt-4 text-fg">Bildirishnomalar</h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">Buyurtma, xabar, obuna va hisob yangiliklari bir joyda.</p>
      </header>

      <div className="mb-4 space-y-3">
        <NotificationPrefs initial={prefs} />
        {/* Filtr chiplari: telefonda gorizontal aylanadi (16px gutter) */}
        <nav aria-label="Saralash" className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex w-max gap-1.5">
            {tabs.map((t) => (
              <li key={t.key}>
                <Link
                  href={t.href}
                  aria-current={t.active ? "page" : undefined}
                  className={cn(
                    "press inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition",
                    t.active ? "btn-ink border-transparent" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
                  )}
                >
                  {t.label}
                  {t.count ? <span className={cn("tabular-nums", t.active ? "opacity-70" : "text-fg-4")}>{t.count}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {items.length > 0 ? (
        <>
          <NotificationsList key={`${page}-${filterKey ?? "a"}`} items={items} unread={unread} canPurge={!onlyUnread && !group && page === 1} />
          <Pagination page={page} pages={pages} query={{ filter: filterKey }} basePath={BASE} className="mt-6" />
        </>
      ) : (
        <EmptyState
          icon={onlyUnread ? Bell : BellOff}
          title={onlyUnread ? "O'qilmagan bildirishnoma yo'q" : group ? `«${NOTIFY_GROUP_META[group].label}» bo'yicha bildirishnoma yo'q` : "Hali bildirishnoma yo'q"}
          description={onlyUnread ? "Hammasi ko'rib chiqilgan." : "Yangi hodisalar shu yerda jamlanadi."}
          action={
            onlyUnread || group ? (
              <ButtonLink href={BASE} variant="outline" size="md">
                Barchasini ko&apos;rish
              </ButtonLink>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
