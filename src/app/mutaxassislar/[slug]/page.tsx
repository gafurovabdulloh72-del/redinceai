import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Eye,
  Globe,
  Instagram,
  Languages,
  MapPin,
  Phone,
  Send,
  Settings,
  Sparkles,
  Youtube,
} from "lucide-react";
import { Avatar, ButtonLink, InsetGroup, InsetRow, SectionHeading, Stars } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { SpecialistCard } from "@/components/specialists/SpecialistCard";
import { PortfolioGallery } from "@/components/specialists/PortfolioGallery";
import { ReviewForm } from "@/components/specialists/ReviewForm";
import { ReviewList } from "@/components/specialists/ReviewList";
import { SafeImage } from "@/components/specialists/SafeImage";
import { ShareButton } from "@/components/specialists/ShareButton";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_BY_SLUG, EXPERIENCE_LEVELS, REGION_BY_SLUG, SITE } from "@/lib/constants";
import { bumpViewCount, getSimilarSpecialists, getSpecialistBySlug } from "@/lib/queries";
import { formatDate, formatPriceRange, hashHue } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LANGUAGE_LABEL: Record<string, string> = {
  uz: "O'zbek",
  ru: "Rus",
  en: "Ingliz",
  kaa: "Qoraqalpoq",
  tg: "Tojik",
};

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const sp = await getSpecialistBySlug(slug);
  if (!sp) return { title: "Mutaxassis topilmadi" };
  const region = REGION_BY_SLUG[sp.regionSlug];
  const title = `${sp.user.name} — ${sp.title}`;
  const description = sp.bio?.trim()
    ? sp.bio.slice(0, 160)
    : `${sp.user.name}: ${sp.title}. ${sp.city}${region ? `, ${region.name}` : ""}. ${SITE.name} orqali buyurtma bering.`;
  return {
    title,
    description,
    openGraph: { title: `${title} · ${SITE.name}`, description, type: "profile", images: sp.coverUrl ? [{ url: sp.coverUrl }] : undefined },
  };
}

function handle(v: string) {
  return v.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me|instagram\.com)\//i, "").replace(/\/+$/, "");
}

function prettyUrl(v: string) {
  try {
    const u = new URL(v);
    return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return v;
  }
}

export default async function SpecialistPage({ params }: { params: Params }) {
  const { slug } = await params;
  const sp = await getSpecialistBySlug(slug);
  if (!sp) notFound();

  // Ko'rishlar soni — natijani kutmaymiz, xatolik sahifani buzmasin
  try {
    void bumpViewCount(sp.id).catch(() => {});
  } catch {
    /* noop */
  }

  const [viewer, similar] = await Promise.all([getCurrentUser(), getSimilarSpecialists(sp, 4)]);

  const isOwner = Boolean(viewer && viewer.id === sp.userId);
  const myReview = viewer ? sp.reviews.find((r) => r.authorId === viewer.id) : null;
  const canReview = Boolean(viewer) && !isOwner;
  const profilePath = `/mutaxassislar/${sp.slug}`;
  const loginHref = `/auth/kirish?next=${encodeURIComponent(profilePath)}`;

  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];
  const hue = hashHue(sp.slug);
  const experience = EXPERIENCE_LEVELS.find((e) => e.value === sp.experience)?.label ?? sp.experience;
  const languages = sp.languages.map((l) => LANGUAGE_LABEL[l] ?? l).join(", ");
  const views = new Intl.NumberFormat("uz-UZ").format(sp.viewCount);

  const contacts: Array<{ key: string; label: string; value: string; href: string; icon: typeof Send }> = [];
  if (sp.telegram) contacts.push({ key: "tg", label: "Telegram", value: `@${handle(sp.telegram)}`, href: `https://t.me/${handle(sp.telegram)}`, icon: Send });
  if (sp.instagram)
    contacts.push({ key: "ig", label: "Instagram", value: `@${handle(sp.instagram)}`, href: `https://instagram.com/${handle(sp.instagram)}`, icon: Instagram });
  if (sp.youtube) contacts.push({ key: "yt", label: "YouTube", value: prettyUrl(sp.youtube), href: sp.youtube, icon: Youtube });
  if (sp.website) contacts.push({ key: "web", label: "Veb-sayt", value: prettyUrl(sp.website), href: sp.website, icon: Globe });
  if (sp.user.phone) contacts.push({ key: "tel", label: "Telefon", value: sp.user.phone, href: `tel:${sp.user.phone.replace(/[^\d+]/g, "")}`, icon: Phone });

  const metaChips = [
    { icon: Briefcase, text: experience },
    { icon: Languages, text: languages },
    { icon: Eye, text: `${views} ko'rish` },
    { icon: CalendarDays, text: `${formatDate(sp.user.createdAt)} dan beri` },
  ];

  return (
    <div className="container-x">
      {/* Breadcrumb */}
      <nav aria-label="Yo'l" className="mb-4 flex items-center gap-1.5 text-[13px] text-fg-3">
        <Link href="/mutaxassislar" className="transition hover:text-fg">
          Mutaxassislar
        </Link>
        <span aria-hidden>/</span>
        {cat && (
          <>
            <Link href={`/mutaxassislar?category=${cat.slug}`} className="transition hover:text-fg">
              {cat.plural}
            </Link>
            <span aria-hidden>/</span>
          </>
        )}
        <span className="truncate text-fg-2">{sp.user.name}</span>
      </nav>

      {/* ================= HERO ================= */}
      <section className="glass animate-fade-up overflow-hidden !rounded-[32px]">
        <div className="relative h-44 overflow-hidden sm:h-64">
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, hsl(${hue} 85% 72%), ${cat?.accent ?? "#7c5cff"} 60%, hsl(${(hue + 60) % 360} 80% 65%))` }}
          />
          {sp.coverUrl && <SafeImage src={sp.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />

          <div className="absolute left-4 top-4 flex flex-wrap gap-2 sm:left-6 sm:top-6">
            {cat && (
              <Link href={`/mutaxassislar?category=${cat.slug}`} className="glass-strong glass-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-fg">
                <CategoryIcon icon={cat.icon} size={13} style={{ color: cat.accent }} />
                {cat.name}
              </Link>
            )}
            {sp.isFeatured && (
              <span className="glass-strong glass-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-tint">
                <Sparkles size={13} /> Tavsiya etiladi
              </span>
            )}
          </div>

          <span
            className={`glass-strong glass-pill absolute right-4 top-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold sm:right-6 sm:top-6 ${
              sp.isAvailable ? "text-[#1f9d46] dark:text-ios-green" : "text-[#b86a00] dark:text-ios-orange"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${sp.isAvailable ? "bg-ios-green" : "bg-ios-orange"}`} />
            {sp.isAvailable ? "Bo'sh" : "Band"}
          </span>
        </div>

        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
            <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={112} className="ring-4 !ring-[var(--glass-strong)] text-[36px]" />
            <div className="min-w-0 flex-1 sm:pb-1">
              <h1 className="flex flex-wrap items-center gap-2 text-[28px] font-bold leading-tight tracking-tight text-fg sm:text-4xl">
                <span className="break-words">{sp.user.name}</span>
                {sp.isVerified && <BadgeCheck size={26} className="shrink-0 fill-ios-blue text-white" aria-label="Tasdiqlangan profil" />}
              </h1>
              <p className="mt-1 text-[16px] text-fg-2 sm:text-[17px]">{sp.title}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-3">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} className="text-tint" />
                  {sp.city}
                  {region && (sp.city !== region.capital || region.slug !== "toshkent-shahri") && <span>· {region.name}</span>}
                </span>
                <Stars value={sp.rating} count={sp.reviewCount} size={13} />
              </p>
            </div>
            <div className="flex shrink-0 gap-2 sm:pb-1">
              <ShareButton title={`${sp.user.name} — ${sp.title}`} size="sm" />
            </div>
          </div>

          <ul className="mt-5 flex flex-wrap gap-2">
            {metaChips.map((m) => (
              <li key={m.text} className="glass-weak glass-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-fg-2">
                <m.icon size={13} className="text-tint" />
                {m.text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= TANA ================= */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Chap ustun */}
        <div className="space-y-6 lg:col-span-8">
          {/* Haqida */}
          <section className="glass animate-fade-up p-5 sm:p-7" style={{ animationDelay: "80ms" }}>
            <h2 className="text-[20px] font-bold tracking-tight text-fg">Haqida</h2>
            {sp.bio?.trim() ? (
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-fg-2">{sp.bio}</p>
            ) : (
              <p className="mt-3 text-[15px] text-fg-3">Mutaxassis hali o'zi haqida ma'lumot yozmagan.</p>
            )}

            {sp.skills.length > 0 && (
              <div className="mt-6 border-t border-hairline pt-5">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-fg-3">Ko'nikmalar</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {sp.skills.map((s) => (
                    <li key={s} className="glass-weak glass-pill px-3 py-1.5 text-[13px] font-medium text-fg">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Portfolio */}
          <section className="animate-fade-up" style={{ animationDelay: "140ms" }} id="portfolio">
            <div className="mb-4 flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-[20px] font-bold tracking-tight text-fg">Portfolio</h2>
                <p className="text-[13px] text-fg-3">{sp.portfolio.length} ta ish · bosib kattalashtiring</p>
              </div>
            </div>
            <PortfolioGallery
              items={sp.portfolio.map((p) => ({
                id: p.id,
                title: p.title,
                type: p.type,
                url: p.url,
                thumbnailUrl: p.thumbnailUrl,
                description: p.description,
              }))}
            />
          </section>

          {/* Sharhlar */}
          <section className="animate-fade-up" style={{ animationDelay: "200ms" }} id="sharhlar">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-[20px] font-bold tracking-tight text-fg">Sharhlar</h2>
                <p className="text-[13px] text-fg-3">{sp.reviewCount > 0 ? `${sp.reviewCount} ta sharh · o'rtacha ${sp.rating.toFixed(1)}` : "Haqiqiy mijozlar fikri"}</p>
              </div>
              {sp.reviewCount > 0 && <Stars value={sp.rating} count={sp.reviewCount} size={15} />}
            </div>
            <div className="space-y-4">
              <ReviewForm
                specialistId={sp.id}
                canReview={canReview}
                isOwner={isOwner}
                existing={myReview ? { rating: myReview.rating, text: myReview.text } : null}
                loginHref={loginHref}
              />
              <ReviewList
                reviews={sp.reviews.map((r) => ({
                  id: r.id,
                  rating: r.rating,
                  text: r.text,
                  createdAt: r.createdAt.getTime(),
                  author: r.author,
                }))}
                highlightAuthorName={myReview ? viewer?.name : null}
              />
            </div>
          </section>
        </div>

        {/* O'ng ustun — yopishqoq */}
        <aside className="order-first lg:order-none lg:col-span-4">
          <div className="space-y-4 lg:sticky lg:top-28">
            <div className="glass-strong animate-fade-up p-5 sm:p-6" style={{ animationDelay: "60ms" }}>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-fg-3">Narx</p>
              <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-fg">{formatPriceRange(sp.priceFrom, sp.priceTo)}</p>
              <p className="mt-1 text-[13px] text-fg-3">
                {sp.priceFrom || sp.priceTo ? "Yakuniy narx loyiha hajmiga qarab kelishiladi." : "Narx loyihaga qarab belgilanadi."}
              </p>

              <div className="mt-5 space-y-2.5">
                {isOwner ? (
                  <ButtonLink href="/kabinet/profil" size="lg" className="w-full">
                    <Settings size={18} /> Profilni tahrirlash
                  </ButtonLink>
                ) : (
                  <ButtonLink href={`/buyurtma/${sp.id}`} size="lg" className="w-full">
                    Buyurtma berish <ArrowRight size={18} />
                  </ButtonLink>
                )}
                {!isOwner && !sp.isAvailable && (
                  <p className="text-center text-[12px] text-fg-3">Hozir band — buyurtmangiz navbatga qo'yiladi.</p>
                )}
              </div>

              <ul className="mt-5 grid grid-cols-3 divide-x divide-hairline border-t border-hairline pt-4 text-center">
                <li>
                  <p className="text-[17px] font-bold text-fg">{sp.rating > 0 ? sp.rating.toFixed(1) : "—"}</p>
                  <p className="text-[11px] text-fg-3">Reyting</p>
                </li>
                <li>
                  <p className="text-[17px] font-bold text-fg">{sp.reviewCount}</p>
                  <p className="text-[11px] text-fg-3">Sharh</p>
                </li>
                <li>
                  <p className="text-[17px] font-bold text-fg">{sp.portfolio.length}</p>
                  <p className="text-[11px] text-fg-3">Ish</p>
                </li>
              </ul>
            </div>

            {contacts.length > 0 && (
              <InsetGroup title="Aloqa" className="animate-fade-up" >
                {contacts.map((c) => (
                  <InsetRow key={c.key} label={c.label} value={<span className="max-w-[160px] truncate">{c.value}</span>} icon={c.icon} href={c.href} />
                ))}
              </InsetGroup>
            )}
          </div>
        </aside>
      </div>

      {/* ================= O'XSHASH ================= */}
      {similar.length > 0 && (
        <section className="mt-16 sm:mt-24">
          <SectionHeading
            eyebrow="Yana ko'ring"
            title="O'xshash mutaxassislar"
            description={`${cat ? cat.plural : "Mutaxassislar"} va ${region ? region.short : "shu hudud"} bo'yicha yaqin profillar.`}
            action={
              <ButtonLink href={`/mutaxassislar?category=${sp.category}`} variant="glass" size="sm">
                Barchasi <ArrowRight size={14} />
              </ButtonLink>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((s) => (
              <SpecialistCard key={s.id} sp={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
