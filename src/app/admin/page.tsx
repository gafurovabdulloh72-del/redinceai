import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, ClipboardList, MapPinned, MessageSquareText, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { AdminSpecialistsTable, type PendingSpecialist } from "@/components/admin/AdminSpecialistsTable";
import { Avatar, Badge, ButtonLink, SectionHeading } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { ORDER_STATUS_LABEL, REGIONS, type OrderStatus } from "@/lib/constants";
import { getAdminOverview } from "@/lib/queries";
import { cn, formatPrice, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin panel",
  robots: { index: false, follow: false },
};

type Role = "client" | "specialist" | "admin";
const ROLE_LABEL: Record<Role, string> = { client: "Mijoz", specialist: "Mutaxassis", admin: "Admin" };
const ROLE_TONE: Record<Role, "neutral" | "accent" | "ink"> = { client: "neutral", specialist: "accent", admin: "ink" };

const STATUS_TONE: Record<OrderStatus, "blue" | "purple" | "orange" | "green" | "neutral"> = {
  new: "blue",
  accepted: "purple",
  in_progress: "orange",
  done: "green",
  cancelled: "neutral",
};

function Tile({ icon: Icon, value, label, hint, href }: { icon: LucideIcon; value: React.ReactNode; label: string; hint?: string; href?: string }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="btn-ink flex h-10 w-10 items-center justify-center rounded-[12px]">
          <Icon size={18} />
        </span>
        {href && <ArrowUpRight size={16} className="text-fg-4 transition group-hover:text-fg" />}
      </div>
      <div className="mt-5 font-display text-[30px] font-semibold leading-none tracking-tight text-fg sm:text-[36px]">{value}</div>
      <div className="mt-2 text-[12px] font-medium text-fg-3">{label}</div>
      {hint && <div className="mt-1 text-[12px] font-semibold text-accent">{hint}</div>}
    </>
  );
  const cls = "card group block p-4 sm:p-5";
  return href ? (
    <Link href={href} className={cn(cls, "card-hover")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/kirish?next=%2Fadmin");
  if (user.role !== "admin") redirect("/kabinet");

  const { stats, pending, latestUsers, latestOrders } = await getAdminOverview();

  // Mijoz komponentga faqat seriyalanadigan ma'lumot beramiz (sanalar — ms)
  const pendingRows: PendingSpecialist[] = pending.map((sp) => ({
    id: sp.id,
    slug: sp.slug,
    title: sp.title,
    category: sp.category,
    regionSlug: sp.regionSlug,
    city: sp.city,
    isVerified: sp.isVerified,
    isFeatured: sp.isFeatured,
    createdAt: sp.createdAt.getTime(),
    user: { name: sp.user.name, email: sp.user.email, phone: sp.user.phone },
  }));

  const users = latestUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as Role,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt.getTime(),
  }));

  const orders = latestOrders.map((o) => ({
    id: o.id,
    title: o.title,
    status: o.status as OrderStatus,
    budget: o.budget,
    createdAt: o.createdAt.getTime(),
    client: o.client.name,
    specialist: o.specialist.user.name,
    specialistSlug: o.specialist.slug,
  }));

  const lastOrderAt = orders[0]?.createdAt;

  return (
    <div className="container-x animate-fade-up">
      {/* ---------- Sarlavha ---------- */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <span className="eyebrow">
            <ShieldCheck size={13} className="text-accent" /> Admin panel
          </span>
          <h1 className="display-xl mt-5 text-[34px] text-fg sm:text-[48px] lg:text-[56px]">
            Boshqaruv <span className="accent-serif text-accent">markazi</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-fg-2 sm:text-[16px]">
            Yangi profillarni tasdiqlang, tavsiya etilganlarni belgilang va platforma faolligini bir joydan kuzating.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/xarita" variant="outline" size="sm">
            Xarita <ArrowUpRight size={14} />
          </ButtonLink>
          <ButtonLink href="/kabinet" variant="outline" size="sm">
            Kabinet <ArrowRight size={14} />
          </ButtonLink>
        </div>
      </header>

      {/* ---------- Statistika ---------- */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile icon={Users} value={stats.specialists} label="Mutaxassislar" hint={pending.length > 0 ? `${pending.length} ta tekshiruvda` : "Hammasi tasdiqlangan"} href="/mutaxassislar" />
        <Tile icon={ClipboardList} value={stats.orders} label="Buyurtmalar" hint={lastOrderAt ? `Oxirgisi ${timeAgo(lastOrderAt)}` : undefined} />
        <Tile icon={MessageSquareText} value={stats.reviews} label="Sharhlar" />
        <Tile icon={MapPinned} value={<>{stats.regions}<span className="text-[18px] text-fg-3">/{REGIONS.length}</span></>} label="Hududlar qamrovi" href="/xarita" />
      </div>

      {/* ---------- Tasdiqlash navbati ---------- */}
      <section className="mt-16 sm:mt-20">
        <SectionHeading
          eyebrow="Tasdiqlash navbati"
          title={
            <>
              Yangi <span className="accent-serif text-accent">profillar</span>
            </>
          }
          description="Tasdiqlangan profillar ro'yxatda belgili ko'rinadi va ko'proq ishonch qozonadi. Tavsiya etilganlar bosh sahifada chiqadi."
          action={
            <Badge tone={pending.length > 0 ? "accent" : "green"} className="self-start !px-3 !py-1.5 sm:self-auto">
              {pending.length > 0 ? `${pending.length} ta kutmoqda` : "Navbat bo'sh"}
            </Badge>
          }
        />
        <AdminSpecialistsTable pending={pendingRows} />
      </section>

      {/* ---------- So'nggi faollik ---------- */}
      <section className="mt-16 sm:mt-20">
        <SectionHeading eyebrow="So'nggi faollik" title="Foydalanuvchilar va buyurtmalar" />
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Foydalanuvchilar */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
              <div>
                <h3 className="font-display text-[17px] font-semibold text-fg">So'nggi foydalanuvchilar</h3>
                <p className="text-[12px] text-fg-3">Oxirgi {users.length} ta ro'yxatdan o'tgan</p>
              </div>
              <Users size={18} className="text-fg-4" />
            </div>
            {users.length === 0 ? (
              <p className="px-5 pb-6 text-[14px] text-fg-3">Hali foydalanuvchilar yo'q.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {users.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={u.name} src={u.avatarUrl} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-fg">{u.name}</p>
                      <p className="truncate text-[12px] text-fg-3">{u.email}</p>
                    </div>
                    <Badge tone={ROLE_TONE[u.role]} className="shrink-0">
                      {ROLE_LABEL[u.role]}
                    </Badge>
                    <span className="hidden w-24 shrink-0 text-right text-[12px] text-fg-3 sm:block">{timeAgo(u.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Buyurtmalar */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
              <div>
                <h3 className="font-display text-[17px] font-semibold text-fg">So'nggi buyurtmalar</h3>
                <p className="text-[12px] text-fg-3">Mijoz → mutaxassis</p>
              </div>
              <ClipboardList size={18} className="text-fg-4" />
            </div>
            {orders.length === 0 ? (
              <p className="px-5 pb-6 text-[14px] text-fg-3">Hali buyurtmalar yo'q.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-fg">{o.title}</p>
                      <p className="truncate text-[12px] text-fg-3">
                        {o.client} <span className="text-fg-4">→</span>{" "}
                        <Link href={`/mutaxassislar/${o.specialistSlug}`} className="text-fg-2 transition hover:text-accent">
                          {o.specialist}
                        </Link>
                        {o.budget ? ` · ${formatPrice(o.budget, { compact: true })}` : ""}
                        {" · "}
                        {timeAgo(o.createdAt)}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[o.status]} className="shrink-0">
                      {ORDER_STATUS_LABEL[o.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
