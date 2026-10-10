import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, BadgeCheck, MapPin, MessageSquareText, PhoneCall, ShieldCheck } from "lucide-react";
import { Avatar, Stars } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { OrderForm } from "@/components/orders/OrderForm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { specialists } from "@/lib/db/schema";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { formatPriceRange } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

async function loadSpecialist(id: string) {
  return db.query.specialists.findFirst({
    where: eq(specialists.id, id),
    with: { user: { columns: { name: true, avatarUrl: true } } },
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const sp = await loadSpecialist(id);
  return { title: sp ? `Buyurtma — ${sp.user.name}` : "Buyurtma berish", robots: { index: false } };
}

export default async function OrderPage({ params }: { params: Params }) {
  const { id } = await params;
  const [sp, user] = await Promise.all([loadSpecialist(id), getCurrentUser()]);
  if (!sp) notFound();
  // Middleware kirishni talab qiladi; baribir ehtiyot chorasi
  if (!user) redirect(`/auth/kirish?next=${encodeURIComponent(`/buyurtma/${id}`)}`);
  if (sp.userId === user.id) redirect("/kabinet");

  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];

  return (
    <div className="container-x">
      <Link href={`/mutaxassislar/${sp.slug}`} className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-3 transition hover:text-fg">
        <ArrowLeft size={14} /> {sp.user.name} profiliga qaytish
      </Link>

      <div className="mb-6 max-w-2xl sm:mb-8">
        <span className="glass-weak glass-pill inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-tint">
          <MessageSquareText size={12} /> Yangi buyurtma
        </span>
        <h1 className="mt-3 text-[28px] font-bold leading-[1.1] tracking-tight text-fg sm:text-4xl">Buyurtma berish</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg-2 sm:text-[17px]">
          Loyihangiz haqida qisqacha yozing — <span className="font-semibold text-fg">{sp.user.name}</span> kabinetida ko'radi va siz bilan bog'lanadi.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Forma */}
        <div className="animate-fade-up lg:col-span-7 xl:col-span-8">
          <OrderForm specialistId={sp.id} specialistSlug={sp.slug} specialistName={sp.user.name} defaultPhone={user.phone} />
        </div>

        {/* Mutaxassis xulosasi */}
        <aside className="animate-fade-up lg:col-span-5 xl:col-span-4" style={{ animationDelay: "80ms" }}>
          <div className="space-y-4 lg:sticky lg:top-28">
            <div className="glass-strong p-5">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-fg-3">Kimga</p>
              <div className="flex items-center gap-3.5">
                <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={60} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[17px] font-semibold leading-tight text-fg">
                    <span className="truncate">{sp.user.name}</span>
                    {sp.isVerified && <BadgeCheck size={17} className="shrink-0 fill-ios-blue text-white" aria-label="Tasdiqlangan" />}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-fg-2">{sp.title}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {cat && (
                  <span className="glass-weak glass-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-fg">
                    <CategoryIcon icon={cat.icon} size={12} style={{ color: cat.accent }} />
                    {cat.name}
                  </span>
                )}
                <span className="glass-weak glass-pill inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-fg-2">
                  <MapPin size={11} className="text-tint" />
                  {sp.city}
                  {region && region.slug !== "toshkent-shahri" && ` · ${region.short}`}
                </span>
                <span className={`glass-weak glass-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold ${sp.isAvailable ? "text-[#1f9d46] dark:text-ios-green" : "text-[#b86a00] dark:text-ios-orange"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sp.isAvailable ? "bg-ios-green" : "bg-ios-orange"}`} />
                  {sp.isAvailable ? "Bo'sh" : "Band"}
                </span>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-hairline pt-4">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-fg-4">Narx</dt>
                  <dd className="mt-0.5 text-[15px] font-semibold text-fg">{formatPriceRange(sp.priceFrom, sp.priceTo)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-fg-4">Reyting</dt>
                  <dd className="mt-1">
                    <Stars value={sp.rating} count={sp.reviewCount} size={12} />
                  </dd>
                </div>
              </dl>
            </div>

            <div className="glass p-5">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-fg-3">Keyin nima bo'ladi?</p>
              <ol className="mt-3 space-y-3">
                {[
                  { icon: MessageSquareText, t: "So'rov mutaxassis kabinetiga tushadi", d: "U qabul qiladi yoki savollar bilan bog'lanadi." },
                  { icon: PhoneCall, t: "Siz bilan bog'lanadi", d: "Ko'rsatgan raqamingizga qo'ng'iroq yoki Telegram xabar." },
                  { icon: ShieldCheck, t: "Holatni kuzatib boring", d: "«Buyurtmalarim» bo'limida har bir bosqich ko'rinadi." },
                ].map((s, i) => (
                  <li key={s.t} className="flex items-start gap-3">
                    <span className="glass-tint flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]">
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
