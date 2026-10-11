import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock, MapPin, MessageSquareText, PhoneCall } from "lucide-react";
import { Avatar, Badge, PageHeader, Stars, VerifiedBadge } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { OrderForm } from "@/components/orders/OrderForm";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { canView, isOnVacation, resolveVisibility, type Viewer } from "@/lib/privacy";
import { getSpecialistBrief, hasAcceptedOrderWith } from "@/lib/queries";
import { formatDate, formatPriceRange } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const sp = await getSpecialistBrief(id);
  return { title: sp ? `Buyurtma — ${sp.user.name}` : "Buyurtma berish", robots: { index: false } };
}

export default async function OrderPage({ params }: { params: Params }) {
  const { id } = await params;
  // getSpecialistBrief cache() bilan — generateMetadata va sahifa bitta so'rovni ishlatadi
  const [sp, user] = await Promise.all([getSpecialistBrief(id), getCurrentUser()]);
  if (!sp) notFound();
  // Middleware kirishni talab qiladi; baribir ehtiyot chorasi
  if (!user) redirect(`/auth/kirish?next=${encodeURIComponent(`/buyurtma/${id}`)}`);
  if (sp.userId === user.id) redirect("/kabinet");

  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];
  const vacation = isOnVacation(sp.vacationUntil);

  // Shahar — mutaxassisning maxfiylik tanloviga ko'ra (profil sahifasidagi kabi): yopiq bo'lsa hudud markazi
  const vis = resolveVisibility(sp.visibility);
  const viewer: Viewer = { userId: user.id, role: user.role, hasOrder: vis.city === "orders" ? await hasAcceptedOrderWith(user.id, sp.id) : false };
  const cityVisible = canView(vis.city, viewer);
  const city = cityVisible ? sp.city : (region?.capital ?? sp.city);
  const cityApprox = !cityVisible && city !== sp.city;

  const steps = [
    { icon: MessageSquareText, t: "So'rov mutaxassis kabinetiga tushadi", d: "U qabul qiladi yoki savollar bilan bog'lanadi." },
    { icon: PhoneCall, t: "Siz bilan bog'lanadi", d: "Ko'rsatgan raqamingizga qo'ng'iroq yoki Telegram xabar." },
    { icon: Lock, t: "Xavfsiz to'lov (eskrou)", d: "Narx kelishilgach to'laysiz; pul ish qabul qilingach mutaxassisga o'tadi." },
  ];

  return (
    <div className="container-x">
      <Link href={`/mutaxassislar/${sp.slug}`} className="mb-5 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-fg-3 transition hover:text-fg">
        <ArrowLeft size={14} /> {sp.user.name} profiliga qaytish
      </Link>

      <PageHeader
        eyebrow={`Yangi buyurtma · ${sp.user.name}`}
        title={
          <>
            Buyurtma <span className="accent-serif text-accent">berish</span>
          </>
        }
        description={
          <>
            Loyihangiz haqida qisqacha yozing — <span className="font-semibold text-fg">{sp.user.name}</span> kabinetida ko'radi va siz bilan bog'lanadi. To'lov faqat narx
            kelishilgandan keyin, eskrou orqali.
          </>
        }
        className="mb-8 sm:mb-10"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
        {/* Forma */}
        <div className="animate-fade-up min-w-0 lg:col-span-7 xl:col-span-8">
          {(vacation || !sp.isAvailable) && (
            <div className="card-outline mb-4 flex items-start gap-3 p-4 text-[13px] leading-relaxed text-fg-2">
              <Badge tone="warning" className="mt-0.5 shrink-0">
                {vacation ? "Ta'tilda" : "Band"}
              </Badge>
              <p>
                {vacation
                  ? `${sp.user.name} ${formatDate(sp.vacationUntil!)} gacha ta'tilda. So'rovingiz saqlanadi — u qaytgach ko'rib chiqadi.`
                  : `${sp.user.name} hozir band. So'rov yuborishingiz mumkin — bo'shagach javob beradi.`}
              </p>
            </div>
          )}
          <OrderForm specialistId={sp.id} specialistSlug={sp.slug} specialistName={sp.user.name} defaultPhone={user.phone} priceFrom={sp.priceFrom} priceTo={sp.priceTo} />
        </div>

        {/* Mutaxassis xulosasi */}
        <aside className="animate-fade-up min-w-0 lg:col-span-5 xl:col-span-4" style={{ animationDelay: "80ms" }}>
          <div className="space-y-4 lg:sticky lg:top-28">
            <div className="card-elevated p-5">
              <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">Kimga</p>
              <div className="flex items-center gap-3.5">
                <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={60} decorative />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-display text-[17px] font-semibold leading-tight text-fg">
                    <span className="truncate">{sp.user.name}</span>
                    {sp.isVerified && <VerifiedBadge size={17} />}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-fg-2">{sp.title}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {cat && (
                  <Badge tone="glass">
                    <CategoryIcon icon={cat.icon} size={12} className="text-fg-3" />
                    {cat.name}
                  </Badge>
                )}
                <Badge tone="glass">
                  <MapPin size={11} className="text-fg-3" />
                  {city}
                  {region && region.slug !== "toshkent-shahri" && ` · ${region.short}`}
                  {cityApprox && (
                    <span className="inline-flex items-center gap-0.5 text-fg-4" title="Aniq shahar yashirin — hudud markazi ko'rsatilgan">
                      <Lock size={10} /> taxminan
                    </span>
                  )}
                </Badge>
                {vacation ? (
                  <Badge tone="warning">Ta'tilda</Badge>
                ) : sp.isAvailable ? (
                  <Badge tone="success">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" /> Bo'sh
                  </Badge>
                ) : (
                  <Badge tone="warning">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" /> Band
                  </Badge>
                )}
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-fg-4">Narx</dt>
                  <dd className="mt-0.5 whitespace-nowrap font-display text-[15px] font-semibold text-fg">{formatPriceRange(sp.priceFrom, sp.priceTo)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-fg-4">Reyting</dt>
                  <dd className="mt-1">{sp.rating > 0 ? <Stars value={sp.rating} count={sp.reviewCount} size={12} /> : <span className="text-[13px] text-fg-3">Hali yo'q</span>}</dd>
                </div>
              </dl>
            </div>

            <div className="card p-5">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">Keyin nima bo'ladi?</p>
              <ol className="mt-3 space-y-3">
                {steps.map((s, i) => (
                  <li key={s.t} className="flex items-start gap-3">
                    <span className="icon-tile icon-tile-sm">
                      <s.icon size={14} />
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold leading-snug text-fg">
                        <span className="mr-1 text-fg-4">{i + 1}.</span>
                        {s.t}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-snug text-fg-3">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
