import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import {
  ArrowRight,
  Check,
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
  Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Badge, ButtonLink, IconTile, Stars, VerifiedBadge } from "@/components/ui";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { portfolioItems } from "@/lib/db/schema";
import { ORDER_STATUS_LABEL, REGION_BY_SLUG, type OrderStatus } from "@/lib/constants";
import { isOnVacation, scheduleSummary } from "@/lib/privacy";
import { getOrdersForUser } from "@/lib/queries";
import { cn, formatDate, formatNumber, formatPrice, greetingFor, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Umumiy" };

const STATUS_TONE: Record<OrderStatus, "info" | "accent" | "warning" | "success" | "neutral"> = {
  new: "info",
  accepted: "accent",
  in_progress: "warning",
  done: "success",
  cancelled: "neutral",
};

/* ------------------------------------------------------------------ */
/* Kichik bo'laklar                                                    */
/* ------------------------------------------------------------------ */
function Tile({ icon, value, label, href }: { icon: LucideIcon; value: React.ReactNode; label: string; href?: string }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <IconTile icon={icon} />
        {href && <ArrowRight size={16} className="mt-1 text-fg-4 transition group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden="true" />}
      </div>
      <div className="mt-4 font-display text-[28px] font-semibold leading-none tracking-tight text-fg sm:text-[32px]">{value}</div>
      <div className="mt-1.5 text-[12px] font-medium text-fg-3">{label}</div>
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

function ProgressRing({ pct, size = 76, stroke = 7 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Profil ${pct}% to'ldirilgan`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(c * pct) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray var(--dur-3) var(--ease-out)" }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={15} fontWeight={700} fill="var(--fg)" fontFamily="var(--font-display)">
        {pct}%
      </text>
    </svg>
  );
}

interface CheckItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
  hint?: string;
}

/* ------------------------------------------------------------------ */
/* Sahifa                                                              */
/* ------------------------------------------------------------------ */
export default async function KabinetPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet"));

  const sp = user.specialist;
  const [{ asClient, asSpecialist }, portfolioCount] = await Promise.all([
    getOrdersForUser(user.id, sp?.id),
    sp
      ? db
          .select({ n: count() })
          .from(portfolioItems)
          .where(eq(portfolioItems.specialistId, sp.id))
          .then((r) => r[0]?.n ?? 0)
      : Promise.resolve(0),
  ]);

  const firstName = user.name.split(" ")[0] || user.name;

  /* ---------- Statistika (faqat real raqamlar) ---------- */
  const newIncoming = asSpecialist.filter((o) => o.status === "new").length;
  const activeIncoming = asSpecialist.filter((o) => o.status === "accepted" || o.status === "in_progress").length;
  const doneIncoming = asSpecialist.filter((o) => o.status === "done").length;

  const sent = asClient.length;
  const inProgress = asClient.filter((o) => o.status === "accepted" || o.status === "in_progress").length;
  const doneOutgoing = asClient.filter((o) => o.status === "done").length;
  const partners = new Set(asClient.map((o) => o.specialistId)).size;

  /* ---------- Profil to'liqligi (mutaxassis) ---------- */
  const needsProfile = !sp && user.role === "specialist";
  const checklist: CheckItem[] = sp
    ? [
        { key: "title", label: "Haqiqiy sarlavha", done: sp.title.trim().length >= 5 && !/yangi mutaxassis$/i.test(sp.title.trim()), href: "/kabinet/profil#mutaxassis", hint: "Masalan: To'y videografi · Sony FX3" },
        { key: "bio", label: "O'zingiz haqingizda (bio)", done: sp.bio.trim().length >= 80, href: "/kabinet/profil#mutaxassis", hint: "Kamida 80 ta belgi" },
        { key: "price", label: "Narx belgilangan", done: sp.priceFrom > 0, href: "/kabinet/profil#mutaxassis" },
        { key: "skills", label: "Kamida 3 ta ko'nikma", done: sp.skills.length >= 3, href: "/kabinet/profil#mutaxassis" },
        { key: "photo", label: "Muqova yoki avatar rasmi", done: Boolean(sp.coverUrl || user.avatarUrl), href: "/kabinet/profil" },
        { key: "portfolio", label: "Portfolioda kamida 3 ta ish", done: portfolioCount >= 3, href: "/kabinet/portfolio", hint: `Hozir: ${portfolioCount} ta` },
        { key: "schedule", label: "Ish vaqti kiritilgan", done: Boolean(sp.schedule && Object.values(sp.schedule.days ?? {}).some((d) => d?.enabled)), href: "/kabinet/profil#ish-vaqti" },
        { key: "contact", label: "Aloqa: Telegram yoki Instagram", done: Boolean(sp.telegram || sp.instagram), href: "/kabinet/profil#mutaxassis" },
      ]
    : [];
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;
  const onVacation = Boolean(sp && isOnVacation(sp.vacationUntil));

  /* ---------- So'nggi buyurtmalar (ikkala rol birgalikda) ---------- */
  const recent = [
    ...asSpecialist.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      budget: o.budget,
      amount: o.amount,
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
      amount: o.amount,
      createdAt: o.createdAt.getTime(),
      who: o.specialist.user.name,
      avatar: o.specialist.user.avatarUrl,
      kind: "outgoing" as const,
    })),
  ]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  /* ---------- Tezkor amallar: 1 ta asosiy (accent) + qolganlari kontur ---------- */
  const actions: Array<{ href: string; label: string; icon: LucideIcon }> = [];
  if (sp) {
    actions.push({ href: "/kabinet/portfolio", label: "Ish qo'shish", icon: Images });
    actions.push({ href: "/kabinet/profil", label: "Profilni tahrirlash", icon: Settings });
    actions.push({ href: `/mutaxassislar/${sp.slug}`, label: "Ommaviy profil", icon: UserRound });
    actions.push({ href: "/kabinet/buyurtmalar", label: "Buyurtmalar", icon: ClipboardList });
  } else if (user.role === "specialist") {
    actions.push({ href: "/kabinet/profil#mutaxassis", label: "Profil yaratish", icon: Sparkles });
    actions.push({ href: "/mutaxassislar", label: "Boshqa mutaxassislar", icon: Search });
  } else {
    actions.push({ href: "/mutaxassislar", label: "Mutaxassis topish", icon: Search });
    actions.push({ href: "/xarita", label: "Xarita", icon: MapPinned });
    actions.push({ href: "/kabinet/buyurtmalar", label: "Buyurtmalar", icon: ClipboardList });
    actions.push({ href: "/kabinet/profil", label: "Sozlamalar", icon: Settings });
  }
  if (user.role === "admin") actions.push({ href: "/admin", label: "Admin panel", icon: ShieldCheck });

  const region = sp ? REGION_BY_SLUG[sp.regionSlug] : null;

  return (
    <div className="animate-fade-up">
      {/* ---------- Sarlavha ---------- */}
      <header className="mb-6 sm:mb-8">
        <span className="eyebrow">
          {greetingFor()} · {sp ? "Mutaxassis kabineti" : user.role === "admin" ? "Administrator" : "Mijoz kabineti"}
        </span>
        <h1 className="display-xl mt-4 text-[32px] text-fg sm:text-[40px] lg:text-[44px]">
          Salom, <span className="accent-serif text-accent">{firstName}</span>!
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2 sm:text-[16px]">
          {sp
            ? "Buyurtmalar, profil ko'rsatkichlari va portfolio — hammasi shu yerda."
            : user.role === "specialist"
              ? "Profilingizni to'ldiring — mijozlar sizni xaritadan topsin."
              : "Yuborgan buyurtmalaringiz holatini shu yerdan kuzatib boring."}
        </p>
      </header>

      {/* ---------- Onboarding: progress ring + checklist ---------- */}
      {needsProfile && (
        <section className="card-elevated mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <ProgressRing pct={0} />
            <div>
              <p className="font-display text-[18px] font-semibold leading-tight text-fg">Mutaxassis profilingizni yarating</p>
              <p className="mt-1 max-w-md text-[13px] leading-relaxed text-fg-2">
                Yo'nalish, hudud, narx va ko'nikmalarni kiriting — profilingiz xaritada paydo bo'ladi va mijozlar buyurtma bera oladi.
              </p>
            </div>
          </div>
          <ButtonLink href="/kabinet/profil#mutaxassis" variant="primary" className="shrink-0">
            Profilni yaratish <ArrowRight size={15} />
          </ButtonLink>
        </section>
      )}

      {sp && pct < 100 && (
        <section className="card-elevated mb-5 p-5 sm:p-6" aria-labelledby="onb-title">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="flex items-start gap-4 sm:w-[300px] sm:shrink-0">
              <ProgressRing pct={pct} />
              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">Profil to'liqligi</p>
                <h2 id="onb-title" className="mt-1 font-display text-[18px] font-semibold leading-tight text-fg">
                  {pct < 50 ? "Profilni to'ldiring" : pct < 100 ? "Yana ozgina qoldi" : "Profil to'liq"}
                </h2>
                <p className="mt-1 text-[13px] leading-snug text-fg-2">
                  {doneCount}/{checklist.length} bajarildi · {portfolioCount} ta ish · {sp.isVerified ? "tasdiqlangan" : "tasdiq kutilmoqda"}
                </p>
              </div>
            </div>
            <ul className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 sm:grid-cols-2">
              {checklist.map((c) => (
                <li key={c.key}>
                  {c.done ? (
                    <span className="flex min-h-10 items-center gap-2.5 rounded-[10px] px-2 text-[13px] text-fg-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span className="line-through decoration-line-2">{c.label}</span>
                    </span>
                  ) : (
                    <Link href={c.href} className="group flex min-h-10 items-center gap-2.5 rounded-[10px] px-2 text-[13px] font-medium text-fg transition hover:bg-fg/4">
                      <span className="h-5 w-5 shrink-0 rounded-full border-2 border-line-2 transition group-hover:border-accent" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{c.label}</span>
                        {c.hint && <span className="block truncate text-[11px] font-normal text-fg-4">{c.hint}</span>}
                      </span>
                      <ArrowRight size={14} className="shrink-0 text-fg-4 transition group-hover:translate-x-0.5 group-hover:text-fg" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ---------- Statistika plitkalari ---------- */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {sp ? (
          <>
            <Tile icon={Eye} value={formatNumber(sp.viewCount)} label="Profil ko'rishlar" href={`/mutaxassislar/${sp.slug}`} />
            <Tile
              icon={Star}
              value={sp.rating > 0 ? sp.rating.toFixed(1) : <span className="text-[18px] font-medium text-fg-3 sm:text-[20px]">Hali yo'q</span>}
              label={sp.reviewCount > 0 ? `Reyting · ${sp.reviewCount} ta sharh` : "Reyting"}
            />
            <Tile icon={MessageSquareText} value={sp.reviewCount} label="Sharhlar" href={`/mutaxassislar/${sp.slug}#sharhlar`} />
            <Tile icon={Inbox} value={newIncoming} label="Yangi buyurtmalar" href="/kabinet/buyurtmalar?tab=kelgan" />
          </>
        ) : (
          <>
            <Tile icon={Send} value={sent} label="Yuborilgan buyurtmalar" href="/kabinet/buyurtmalar" />
            <Tile icon={Clock3} value={inProgress} label="Jarayonda" href="/kabinet/buyurtmalar" />
            <Tile icon={CheckCircle2} value={doneOutgoing} label="Bajarilgan" href="/kabinet/buyurtmalar" />
            <Tile icon={Users} value={partners} label="Ishlagan mutaxassislar" href="/kabinet/buyurtmalar" />
          </>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        {/* ---------- So'nggi buyurtmalar ---------- */}
        <section className="card lg:col-span-2" aria-labelledby="recent-title">
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
            <div>
              <h2 id="recent-title" className="font-display text-[17px] font-semibold text-fg">
                So'nggi buyurtmalar
              </h2>
              <p className="text-[12px] text-fg-3">
                {sp && asSpecialist.length > 0
                  ? `${activeIncoming} ta jarayonda · ${doneIncoming} ta bajarilgan`
                  : asClient.length > 0
                    ? `${inProgress} ta jarayonda · ${doneOutgoing} ta bajarilgan`
                    : "Hozircha bo'sh"}
              </p>
            </div>
            {recent.length > 0 && (
              <ButtonLink href="/kabinet/buyurtmalar" variant="outline" size="sm">
                Barchasi <ArrowRight size={14} />
              </ButtonLink>
            )}
          </div>

          {recent.length === 0 ? (
            <div className="flex flex-col items-center border-t border-line px-6 pb-7 pt-6 text-center">
              <IconTile icon={Inbox} tone="soft" size="lg" className="mb-3" />
              <p className="font-display text-[15px] font-semibold text-fg">{sp ? "Hali buyurtmalar kelmagan" : "Hali buyurtma bermagansiz"}</p>
              <p className="mt-1 max-w-xs text-[13px] text-fg-3">
                {sp ? "Profil va portfolioni to'ldiring — mijozlar sizni tezroq topadi." : "Xaritadan mutaxassis tanlang va loyihangizni yuboring."}
              </p>
              {!sp && (
                <ButtonLink href="/xarita" variant="outline" size="sm" className="mt-4">
                  Xaritani ochish <ArrowRight size={14} />
                </ButtonLink>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/kabinet/buyurtmalar?id=${o.id}`} className="flex min-h-14 items-center gap-3 px-5 py-3 transition hover:bg-fg/4">
                    <Avatar name={o.who} src={o.avatar} size={38} decorative />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-fg">{o.title}</p>
                      <p className="truncate text-[12px] text-fg-3">
                        {o.kind === "incoming" ? "Mijoz: " : "Mutaxassis: "}
                        {o.who}
                        {o.amount ? ` · ${formatPrice(o.amount, { compact: true })}` : o.budget ? ` · byudjet ${formatPrice(o.budget, { compact: true })}` : ""}
                        {" · "}
                        <time dateTime={new Date(o.createdAt).toISOString()}>{timeAgo(o.createdAt)}</time>
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

        {/* ---------- O'ng ustun ---------- */}
        <div className="space-y-5">
          {/* Tezkor amallar */}
          <section className="card p-5" aria-labelledby="qa-title">
            <h2 id="qa-title" className="font-display text-[17px] font-semibold text-fg">
              Tezkor amallar
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((a, i) => (
                <ButtonLink key={a.href + a.label} href={a.href} variant={i === 0 ? "accent" : "outline"} size="md" className="!px-4">
                  <a.icon size={15} />
                  {a.label}
                </ButtonLink>
              ))}
            </div>
          </section>

          {/* Profil holati (mutaxassis) */}
          {sp && (
            <section className="card-elevated p-5" aria-labelledby="status-title">
              <h2 id="status-title" className="sr-only">
                Profil holati
              </h2>
              <div className="flex items-center gap-3">
                <Avatar name={user.name} src={user.avatarUrl} size={48} decorative />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[15px] font-semibold text-fg">
                    <span className="truncate">{user.name}</span>
                    {sp.isVerified && <VerifiedBadge size={16} />}
                  </p>
                  <p className="truncate text-[12px] text-fg-3">{sp.title}</p>
                </div>
              </div>

              {/* Semantik chiplar */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {onVacation ? (
                  <Badge tone="warning">Ta'tilda · {formatDate(sp.vacationUntil!)} gacha</Badge>
                ) : sp.isAvailable ? (
                  <Badge tone="success">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" /> Bo'sh
                  </Badge>
                ) : (
                  <Badge tone="warning">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" /> Band
                  </Badge>
                )}
                {sp.isVerified ? <Badge tone="success">Tasdiqlangan</Badge> : <Badge tone="neutral">Tekshiruvda</Badge>}
                {sp.isFeatured && <Badge tone="accent">Tavsiya etilgan</Badge>}
              </div>

              <dl className="mt-4 space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-fg-3">Reyting</dt>
                  <dd>{sp.rating > 0 ? <Stars value={sp.rating} count={sp.reviewCount} size={12} /> : <span className="font-medium text-fg-3">Hali yo'q</span>}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-fg-3">Narx</dt>
                  <dd className="font-semibold text-fg">{sp.priceFrom ? `${formatPrice(sp.priceFrom, { compact: true })} dan` : "Kelishiladi"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-fg-3">Hudud</dt>
                  <dd className="truncate font-semibold text-fg">{region ? `${sp.city} · ${region.short}` : sp.city}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="shrink-0 text-fg-3">Ish vaqti</dt>
                  <dd className="min-w-0 break-words text-right font-semibold text-fg">{scheduleSummary(sp.schedule) || <span className="font-medium text-fg-3">Ko'rsatilmagan</span>}</dd>
                </div>
              </dl>

              <ButtonLink href="/kabinet/profil" variant="outline" size="md" className="mt-4 w-full">
                <Settings size={15} /> Profilni tahrirlash
              </ButtonLink>
            </section>
          )}

          {/* Mijoz uchun maslahat */}
          {!sp && user.role === "client" && (
            <section className="card-elevated p-5">
              <Badge tone="accent">
                <Sparkles size={12} /> Siz ijodkormisiz?
              </Badge>
              <p className="mt-3 font-display text-[16px] font-semibold text-fg">Mutaxassis profilini oching</p>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-2">Portfolio joylang, narx belgilang — buyurtmalar to'g'ridan-to'g'ri kabinetingizga keladi.</p>
              <ButtonLink href="/kabinet/profil#mutaxassis" variant="outline" size="md" className="mt-4 w-full">
                Mutaxassis bo'lish <ArrowRight size={14} />
              </ButtonLink>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
