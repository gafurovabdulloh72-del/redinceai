import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  Images,
  Inbox,
  MapPinned,
  MessageSquareText,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Badge, ButtonLink, Stars } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import { getOrdersForUser } from "@/lib/queries";
import { cn, formatPrice, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Umumiy" };

const STATUS_TONE: Record<OrderStatus, "blue" | "purple" | "orange" | "green" | "neutral"> = {
  new: "blue",
  accepted: "purple",
  in_progress: "orange",
  done: "green",
  cancelled: "neutral",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Xayrli tun";
  if (h < 12) return "Xayrli tong";
  if (h < 18) return "Xayrli kun";
  return "Xayrli kech";
}

function Tile({ icon: Icon, value, label, accent, href }: { icon: LucideIcon; value: React.ReactNode; label: string; accent: string; href?: string }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] text-white shadow-lg" style={{ background: `linear-gradient(145deg, ${accent}, ${accent}aa)`, boxShadow: `0 10px 24px -10px ${accent}` }}>
          <Icon size={18} />
        </span>
        {href && <ArrowRight size={16} className="text-fg-4 transition group-hover:translate-x-0.5 group-hover:text-tint" />}
      </div>
      <div className="mt-4 text-[28px] font-bold leading-none tracking-tight text-fg sm:text-[32px]">{value}</div>
      <div className="mt-1.5 text-[12px] font-medium text-fg-3">{label}</div>
    </>
  );
  const cls = "glass group block p-4 sm:p-5";
  return href ? (
    <Link href={href} className={cn(cls, "glass-hover")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export default async function KabinetPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/kirish?next=%2Fkabinet");

  const sp = user.specialist;
  const { asClient, asSpecialist } = await getOrdersForUser(user.id, sp?.id);

  const firstName = user.name.split(" ")[0] || user.name;

  /* ---------- Statistika ---------- */
  const newIncoming = asSpecialist.filter((o) => o.status === "new").length;
  const activeIncoming = asSpecialist.filter((o) => o.status === "accepted" || o.status === "in_progress").length;
  const doneIncoming = asSpecialist.filter((o) => o.status === "done").length;

  const sent = asClient.length;
  const inProgress = asClient.filter((o) => o.status === "accepted" || o.status === "in_progress").length;
  const doneOutgoing = asClient.filter((o) => o.status === "done").length;

  /* ---------- Profil holati ---------- */
  const profileIncomplete = Boolean(sp && ((!sp.isAvailable && !sp.bio.trim()) || /yangi mutaxassis$/i.test(sp.title.trim())));
  const needsProfile = !sp && user.role === "specialist";

  /* ---------- So'nggi buyurtmalar (ikkala rol birgalikda) ---------- */
  const recent = [
    ...asSpecialist.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      budget: o.budget,
      createdAt: o.createdAt.getTime(),
      who: o.client.name,
      avatar: o.client.avatarUrl,
      kind: "incoming" as const,
    })),
    ...asClient.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      budget: o.budget,
      createdAt: o.createdAt.getTime(),
      who: o.specialist.user.name,
      avatar: o.specialist.user.avatarUrl,
      kind: "outgoing" as const,
    })),
  ]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  /* ---------- Tezkor amallar ---------- */
  const actions: Array<{ href: string; label: string; icon: LucideIcon }> = [];
  if (sp) {
    actions.push({ href: "/kabinet/profil", label: "Profilni tahrirlash", icon: Settings });
    actions.push({ href: "/kabinet/portfolio", label: "Ish qo'shish", icon: Images });
    actions.push({ href: `/mutaxassislar/${sp.slug}`, label: "Ommaviy profil", icon: UserRound });
  } else if (user.role === "specialist") {
    actions.push({ href: "/kabinet/profil", label: "Profil yaratish", icon: Sparkles });
  } else {
    actions.push({ href: "/kabinet/profil", label: "Sozlamalar", icon: Settings });
  }
  actions.push({ href: "/kabinet/buyurtmalar", label: "Buyurtmalar", icon: ClipboardList });
  actions.push({ href: "/mutaxassislar", label: "Mutaxassis topish", icon: Search });
  actions.push({ href: "/xarita", label: "Xarita", icon: MapPinned });
  if (user.role === "admin") actions.push({ href: "/admin", label: "Admin panel", icon: ShieldCheck });

  return (
    <div className="animate-fade-up">
      {/* Sarlavha */}
      <div className="mb-5 sm:mb-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-tint">{greeting()}</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-fg sm:text-4xl">Salom, {firstName}!</h1>
        <p className="mt-1.5 text-[15px] text-fg-2">
          {sp
            ? "Buyurtmalar, profil ko'rsatkichlari va portfolio — hammasi shu yerda."
            : user.role === "specialist"
              ? "Profilingizni to'ldiring — mijozlar sizni xaritadan topsin."
              : "Yuborgan buyurtmalaringiz holatini shu yerdan kuzatib boring."}
        </p>
      </div>

      {/* Profil to'ldirish banneri */}
      {(profileIncomplete || needsProfile) && (
        <Link
          href="/kabinet/profil"
          className="glass-tint group relative mb-5 flex flex-col gap-4 overflow-hidden !rounded-[24px] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <span className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-16 left-1/3 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/20">
              <Sparkles size={20} />
            </span>
            <div>
              <p className="text-[17px] font-bold leading-tight">{needsProfile ? "Mutaxassis profilingizni yarating" : "Profilingizni to'ldiring"}</p>
              <p className="mt-1 text-[13px] leading-snug text-white/85">
                {needsProfile
                  ? "Yo'nalish, hudud, narx va ko'nikmalarni kiriting — profilingiz xaritada paydo bo'ladi."
                  : "Sarlavha, o'zingiz haqingizda matn va narxlarni kiriting. To'liq profil 3 barobar ko'proq buyurtma oladi."}
              </p>
            </div>
          </div>
          <span className="relative inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-semibold text-tint transition group-hover:brightness-95">
            To'ldirish <ArrowRight size={15} />
          </span>
        </Link>
      )}

      {/* Statistika plitkalari */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {sp ? (
          <>
            <Tile icon={Eye} value={new Intl.NumberFormat("uz-UZ").format(sp.viewCount)} label="Profil ko'rishlar" accent="#0a84ff" href={`/mutaxassislar/${sp.slug}`} />
            <Tile icon={Star} value={sp.rating > 0 ? sp.rating.toFixed(1) : "—"} label="Reyting" accent="#ff9f0a" />
            <Tile icon={MessageSquareText} value={sp.reviewCount} label="Sharhlar" accent="#bf5af2" href={`/mutaxassislar/${sp.slug}#sharhlar`} />
            <Tile icon={Inbox} value={newIncoming} label="Yangi buyurtmalar" accent="#30d158" href="/kabinet/buyurtmalar?tab=kelgan" />
          </>
        ) : (
          <>
            <Tile icon={Send} value={sent} label="Yuborilgan buyurtmalar" accent="#0a84ff" href="/kabinet/buyurtmalar" />
            <Tile icon={Clock3} value={inProgress} label="Jarayonda" accent="#ff9f0a" href="/kabinet/buyurtmalar" />
            <Tile icon={CheckCircle2} value={doneOutgoing} label="Bajarilgan" accent="#30d158" href="/kabinet/buyurtmalar" />
            <Tile icon={Search} value="14" label="Hudud bo'ylab qidiruv" accent="#bf5af2" href="/xarita" />
          </>
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* So'nggi buyurtmalar */}
        <section className="glass lg:col-span-2">
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
            <div>
              <h2 className="text-[17px] font-semibold text-fg">So'nggi buyurtmalar</h2>
              <p className="text-[12px] text-fg-3">
                {sp && asSpecialist.length > 0
                  ? `${activeIncoming} ta jarayonda · ${doneIncoming} ta bajarilgan`
                  : asClient.length > 0
                    ? `${inProgress} ta jarayonda · ${doneOutgoing} ta bajarilgan`
                    : "Hozircha bo'sh"}
              </p>
            </div>
            <ButtonLink href="/kabinet/buyurtmalar" variant="glass" size="sm">
              Barchasi <ArrowRight size={14} />
            </ButtonLink>
          </div>

          {recent.length === 0 ? (
            <div className="flex flex-col items-center px-6 pb-8 pt-4 text-center">
              <span className="glass-weak mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] text-tint">
                <Inbox size={22} />
              </span>
              <p className="text-[15px] font-semibold text-fg">{sp ? "Hali buyurtmalar kelmagan" : "Hali buyurtma bermagansiz"}</p>
              <p className="mt-1 max-w-xs text-[13px] text-fg-3">
                {sp ? "Profil va portfolioni to'ldiring — mijozlar sizni tezroq topadi." : "Xaritadan mutaxassis tanlang va loyihangizni yuboring."}
              </p>
              {!sp && (
                <ButtonLink href="/mutaxassislar" size="sm" className="mt-4">
                  Mutaxassis topish <ArrowRight size={14} />
                </ButtonLink>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-hairline border-t border-hairline">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/kabinet/buyurtmalar?tab=${o.kind === "incoming" ? "kelgan" : "mening"}`}
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-fg/4"
                  >
                    <Avatar name={o.who} src={o.avatar} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-fg">{o.title}</p>
                      <p className="truncate text-[12px] text-fg-3">
                        {o.kind === "incoming" ? "Mijoz: " : "Mutaxassis: "}
                        {o.who}
                        {o.budget ? ` · ${formatPrice(o.budget, { compact: true })}` : ""}
                        {" · "}
                        {timeAgo(o.createdAt)}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[o.status]} className="shrink-0">
                      {ORDER_STATUS_LABEL[o.status]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* O'ng ustun */}
        <div className="space-y-5">
          {/* Tezkor amallar */}
          <section className="glass p-5">
            <h2 className="text-[17px] font-semibold text-fg">Tezkor amallar</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((a) => (
                <Link
                  key={a.href + a.label}
                  href={a.href}
                  className="glass glass-pill glass-hover inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold text-fg"
                >
                  <a.icon size={14} className="text-tint" />
                  {a.label}
                </Link>
              ))}
            </div>
          </section>

          {/* Profil holati (mutaxassis) */}
          {sp && (
            <section className="glass-strong p-5">
              <div className="flex items-center gap-3">
                <Avatar name={user.name} src={user.avatarUrl} size={48} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[15px] font-semibold text-fg">
                    <span className="truncate">{user.name}</span>
                    {sp.isVerified && <BadgeCheck size={16} className="shrink-0 fill-ios-blue text-white" aria-label="Tasdiqlangan" />}
                  </p>
                  <p className="truncate text-[12px] text-fg-3">{sp.title}</p>
                </div>
              </div>

              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-fg-3">Holat</span>
                  <span className={cn("inline-flex items-center gap-1.5 font-semibold", sp.isAvailable ? "text-[#1f9d46] dark:text-ios-green" : "text-[#b86a00] dark:text-ios-orange")}>
                    <span className={cn("h-2 w-2 rounded-full", sp.isAvailable ? "bg-ios-green" : "bg-ios-orange")} />
                    {sp.isAvailable ? "Buyurtma qabul qilaman" : "Band"}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-fg-3">Tasdiq</span>
                  <span className="font-semibold text-fg">{sp.isVerified ? "Tasdiqlangan" : "Tekshiruvda"}</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-fg-3">Reyting</span>
                  <Stars value={sp.rating} count={sp.reviewCount} size={12} />
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-fg-3">Narx</span>
                  <span className="font-semibold text-fg">{sp.priceFrom ? `${formatPrice(sp.priceFrom, { compact: true })} dan` : "Kelishiladi"}</span>
                </li>
              </ul>

              <ButtonLink href="/kabinet/profil" variant="glass" size="sm" className="mt-4 w-full">
                <Settings size={14} /> Profilni tahrirlash
              </ButtonLink>
            </section>
          )}

          {/* Mijoz uchun maslahat */}
          {!sp && user.role === "client" && (
            <section className="glass-strong relative overflow-hidden p-5">
              <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-tint/20 blur-3xl" />
              <span className="glass-weak glass-pill inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-tint">
                <Sparkles size={12} /> Siz ijodkormisiz?
              </span>
              <p className="mt-3 text-[15px] font-semibold text-fg">Mutaxassis profilini oching</p>
              <p className="mt-1 text-[13px] leading-snug text-fg-2">Portfolio joylang, narx belgilang — buyurtmalar to'g'ridan-to'g'ri kabinetingizga keladi.</p>
              <ButtonLink href="/kabinet/profil#mutaxassis" size="sm" className="mt-4">
                Mutaxassis bo'lish <ArrowRight size={14} />
              </ButtonLink>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
