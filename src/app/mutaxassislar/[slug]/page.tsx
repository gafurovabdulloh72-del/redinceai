import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Eye,
  EyeOff,
  Languages,
  Lock,
  MapPin,
  Mars,
  Settings,
  Sparkles,
  Star,
  Venus,
  X,
} from "lucide-react";
import { Avatar, ButtonLink, SectionHeading, Stars, VerifiedBadge } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ContactPanel } from "@/components/specialists/ContactPanel";
import { PortfolioGallery } from "@/components/specialists/PortfolioGallery";
import { ReviewForm } from "@/components/specialists/ReviewForm";
import { ReviewList, ReviewSummary } from "@/components/specialists/ReviewList";
import { CoverImage } from "@/components/specialists/CoverImage";
import { SchedulePanel } from "@/components/specialists/SchedulePanel";
import { ShareButton } from "@/components/specialists/ShareButton";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_BY_SLUG, EXPERIENCE_LEVELS, GENDERS, REGION_BY_SLUG, SITE } from "@/lib/constants";
import { GUEST_VIEWER, filterSpecialistForViewer, isBotUserAgent, isOnVacation, lockReason, resolveVisibility, type Viewer } from "@/lib/privacy";
import { bumpViewCount, getSimilarSpecialists, getSpecialistBySlug, hasAcceptedOrderWith, ratingDistribution } from "@/lib/queries";
import { cn, formatDate, formatNumber, formatPriceRange } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LANGUAGE_LABEL: Record<string, string> = {
  uz: "O'zbek",
  ru: "Rus",
  en: "Ingliz",
  kaa: "Qoraqalpoq",
  tg: "Tojik",
};

/** Egasi uchun "boshqalar ko'zi bilan" rejimlari */
const PREVIEW_MODES = [
  { key: "guest", label: "Mehmon", hint: "Tizimga kirmagan tashrifchi" },
  { key: "client", label: "Ro'yxatdan o'tgan", hint: "Kirgan, lekin buyurtmasi yo'q" },
  { key: "order", label: "Buyurtmachi", hint: "Buyurtmasi qabul qilingan mijoz" },
] as const;
type PreviewMode = (typeof PREVIEW_MODES)[number]["key"];

type Params = Promise<{ slug: string }>;
type Search = Promise<{ preview?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const raw = await getSpecialistBySlug(slug);
  if (!raw) return { title: "Mutaxassis topilmadi" };
  // Metadata — mehmon ko'rinishi (shahar yashirin bo'lsa hudud markazi)
  const sp = filterSpecialistForViewer(raw, GUEST_VIEWER);
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

/** Ism: oxirgi so'z + tasdiq belgisi bitta "bo'linmas" bo'lakda — belgi yolg'iz qatorga tushmaydi */
function NameWithBadge({ name, verified }: { name: string; verified: boolean }) {
  const words = name.trim().split(/\s+/);
  const last = words.pop() ?? "";
  return (
    <>
      {words.length > 0 && <>{words.join(" ")} </>}
      <span className="whitespace-nowrap">
        {last}
        {verified && (
          <span title="Shaxsi tasdiqlangan" className="ml-1.5 inline-block align-[-3px]">
            <VerifiedBadge size={24} />
          </span>
        )}
      </span>
    </>
  );
}

export default async function SpecialistPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  const raw = await getSpecialistBySlug(slug);
  if (!raw) notFound();

  const [viewer, hdrs] = await Promise.all([getCurrentUser(), headers()]);
  const isOwner = Boolean(viewer && viewer.id === raw.userId);
  const isAdmin = viewer?.role === "admin";

  // ?preview= faqat egasi uchun: profil boshqalarga qanday ko'rinishini simulyatsiya qiladi
  const previewMode: PreviewMode | null = isOwner && PREVIEW_MODES.some((m) => m.key === preview) ? (preview as PreviewMode) : null;

  const hasOrder = viewer && !isOwner ? await hasAcceptedOrderWith(viewer.id, raw.id) : false;
  const effectiveViewer: Viewer = previewMode
    ? previewMode === "guest"
      ? { userId: null }
      : { userId: viewer!.id, role: "client", hasOrder: previewMode === "order" }
    : { userId: viewer?.id ?? null, role: viewer?.role ?? null, isOwner, hasOrder };

  const sp = filterSpecialistForViewer(raw, effectiveViewer);
  const vis = resolveVisibility(raw.visibility);
  const similar = await getSimilarSpecialists(raw, 4, effectiveViewer);

  // Ko'rishlar soni: egasi (shu jumladan preview) va botlar hisoblanmaydi; natijani kutmaymiz
  if (!isOwner && !isBotUserAgent(hdrs.get("user-agent"))) {
    try {
      void bumpViewCount(raw.id).catch(() => {});
    } catch {
      /* noop */
    }
  }

  const myReview = viewer ? raw.reviews.find((r) => r.authorId === viewer.id) : null;
  const canReview = Boolean(viewer) && !isOwner;
  const profilePath = `/mutaxassislar/${raw.slug}`;
  const loginHref = `/auth/kirish?next=${encodeURIComponent(profilePath)}`;
  const orderHref = `/buyurtma/${raw.id}`;
  const showOwnerCta = isOwner && !previewMode;

  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];
  const experience = EXPERIENCE_LEVELS.find((e) => e.value === sp.experience)?.label ?? sp.experience;
  const languages = sp.languages.map((l) => LANGUAGE_LABEL[l] ?? l).join(", ");
  const views = formatNumber(sp.viewCount);
  const genderLabel = sp.user.gender ? GENDERS.find((g) => g.value === sp.user.gender)?.label : null;
  const onVacation = isOnVacation(sp.vacationUntil);
  const scheduleLock = lockReason(vis.schedule, effectiveViewer);
  const distribution = ratingDistribution(raw.reviews);
  const price = formatPriceRange(sp.priceFrom, sp.priceTo);
  const lockedCount = Object.keys(sp.locked).length + (scheduleLock && raw.schedule ? 1 : 0);
  const hiddenForGuests = isOwner
    ? (["phone", "telegram", "instagram", "youtube", "website", "email", "schedule", "gender", "city"] as const).filter((k) => vis[k] !== "public").length
    : 0;

  const metaChips: Array<{ icon: typeof Briefcase; text: string; tone: "accent" | "neutral" }> = [
    { icon: Briefcase, text: experience, tone: "accent" },
    { icon: Languages, text: languages, tone: "neutral" },
    { icon: Eye, text: `${views} ko'rish`, tone: "neutral" },
    { icon: CalendarDays, text: `${formatDate(sp.user.createdAt)} dan beri`, tone: "neutral" },
  ];
  if (genderLabel) metaChips.splice(1, 0, { icon: sp.user.gender === "female" ? Venus : Mars, text: genderLabel, tone: "neutral" });

  const cta = showOwnerCta ? (
    <ButtonLink href="/kabinet/profil" size="lg" className="w-full">
      <Settings size={18} /> Profilni tahrirlash
    </ButtonLink>
  ) : (
    <ButtonLink href={orderHref} variant="accent" size="lg" className="w-full">
      Buyurtma berish <ArrowRight size={18} />
    </ButtonLink>
  );

  return (
    <div className="container-x pb-24 lg:pb-0">
      {/* ================= PREVIEW BANNER (faqat egasi) ================= */}
      {previewMode && (
        <div className="card-elevated mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
              <Eye size={18} />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-fg">Ko'rish rejimi — profilingiz boshqalarga shunday ko'rinadi</p>
              <p className="mt-0.5 text-[12px] text-fg-3">
                {PREVIEW_MODES.find((m) => m.key === previewMode)?.hint}
                {lockedCount > 0 ? ` · ${lockedCount} ta maydon yopiq` : " · hamma maydon ochiq"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="segment" role="group" aria-label="Ko'ruvchi turi">
              {PREVIEW_MODES.map((m) => (
                <Link key={m.key} href={`${profilePath}?preview=${m.key}`} className="segment-item" data-active={m.key === previewMode} scroll={false}>
                  {m.label}
                </Link>
              ))}
            </div>
            <Link href={profilePath} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg" scroll={false}>
              <X size={14} /> Chiqish
            </Link>
          </div>
        </div>
      )}

      {/* ================= BREADCRUMB ================= */}
      <nav aria-label="Yo'l" className="no-scrollbar mb-5 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-[14px] font-medium text-fg-3">
        <Link href="/mutaxassislar" className="shrink-0 transition hover:text-fg">
          Mutaxassislar
        </Link>
        <ChevronRight size={14} aria-hidden className="shrink-0 text-fg-4" />
        {cat && (
          <>
            <Link href={`/mutaxassislar?category=${cat.slug}`} className="shrink-0 transition hover:text-fg">
              {cat.plural}
            </Link>
            <ChevronRight size={14} aria-hidden className="shrink-0 text-fg-4" />
          </>
        )}
        <span className="truncate text-fg" aria-current="page">
          {sp.user.name}
        </span>
      </nav>

      {/* ================= HERO ================= */}
      <section className="card animate-fade-up overflow-hidden !rounded-[28px] sm:!rounded-[32px]">
        <div className="relative h-40 overflow-hidden bg-surface-3 sm:h-60">
          {/* Rasm bo'lmasa: tinch yuza + yo'nalish rangida nozik nur (rang-barang gradient o'rniga) */}
          <div
            className="absolute inset-0 opacity-70 dark:opacity-50"
            style={{ background: `radial-gradient(60% 120% at 85% 0%, ${cat?.accent ?? "#ff5a36"}33, transparent 70%), radial-gradient(50% 90% at 10% 100%, ${cat?.accent ?? "#ff5a36"}1f, transparent 70%)` }}
          />
          <div className="absolute inset-0 grain" />
          <CoverImage src={sp.coverUrl} />

          <div className="absolute left-4 top-4 flex flex-wrap gap-2 sm:left-6 sm:top-6">
            {cat && (
              <Link href={`/mutaxassislar?category=${cat.slug}`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[12px] font-semibold text-ink-fg transition hover:brightness-110">
                <CategoryIcon icon={cat.icon} size={13} />
                {cat.name}
              </Link>
            )}
            {sp.isFeatured && (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[12px] font-semibold text-accent shadow-[var(--shadow-1)]">
                <Sparkles size={13} /> Tavsiya etiladi
              </span>
            )}
          </div>

          <span
            className={cn(
              "absolute right-4 top-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[12px] font-semibold shadow-[var(--shadow-1)] sm:right-6 sm:top-6",
              onVacation ? "text-accent" : sp.isAvailable ? "text-[#15803d] dark:text-ios-green" : "text-[#c2410c] dark:text-ios-orange",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", onVacation ? "bg-accent" : sp.isAvailable ? "bg-ios-green" : "bg-ios-orange")} />
            {onVacation ? "Ta'tilda" : sp.isAvailable ? "Bo'sh" : "Band"}
          </span>
        </div>

        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="relative z-10 -mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
            <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={112} className="!ring-4 !ring-surface text-[36px]" />
            <div className="min-w-0 flex-1 sm:pb-1">
              <h1 className="break-words font-display text-[28px] font-semibold leading-[1.05] tracking-tight text-fg sm:text-[38px]">
                <NameWithBadge name={sp.user.name} verified={sp.isVerified} />
              </h1>
              <p className="mt-1.5 text-[16px] text-fg-2 sm:text-[17px]">{sp.title}</p>
              <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-3">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} className="text-accent" />
                  {sp.city}
                  {region && (sp.city !== region.capital || region.slug !== "toshkent-shahri") && <span>· {region.name}</span>}
                  {sp.cityApprox && (
                    <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-fg-3" title="Aniq shahar yashirin — hudud markazi ko'rsatilgan">
                      <Lock size={10} /> taxminan
                    </span>
                  )}
                </span>
                <Stars value={sp.rating} count={sp.reviewCount} size={13} />
              </p>
            </div>
            {showOwnerCta && (
              <div className="hidden shrink-0 sm:block sm:pb-1">
                <ButtonLink href={`${profilePath}?preview=guest`} variant="outline" size="sm">
                  <Eye size={15} /> Mehmon ko'zi bilan
                </ButtonLink>
              </div>
            )}
          </div>

          <ul className="mt-5 flex flex-wrap items-center gap-2">
            {metaChips.map((m) => (
              <li
                key={m.text}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold",
                  m.tone === "accent" ? "bg-accent-soft text-accent" : "border border-line text-fg-2",
                )}
              >
                <m.icon size={13} className={m.tone === "accent" ? undefined : "text-fg-3"} />
                {m.text}
              </li>
            ))}
            <li className="ml-auto lg:hidden">
              <ShareButton title={`${sp.user.name} — ${sp.title}`} size="sm" variant="outline" />
            </li>
          </ul>
        </div>
      </section>

      {/* ================= TANA ================= */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Chap ustun */}
        <div className="min-w-0 space-y-6 lg:col-span-8">
          {/* Haqida */}
          <section className="card animate-fade-up p-5 sm:p-7" style={{ animationDelay: "80ms" }}>
            <span className="eyebrow">Haqida</span>
            <h2 className="mt-2 font-display text-[20px] font-semibold tracking-tight text-fg">
              {sp.user.name.split(" ")[0]} <span className="accent-serif text-accent">haqida</span>
            </h2>
            {sp.bio?.trim() ? (
              <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-fg-2">{sp.bio}</p>
            ) : (
              <p className="mt-4 text-[15px] text-fg-3">Mutaxassis hali o'zi haqida ma'lumot yozmagan.</p>
            )}

            {sp.skills.length > 0 && (
              <div className="mt-6 border-t border-line pt-5">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">Ko'nikmalar</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {sp.skills.map((s) => (
                    <li key={s} className="rounded-full bg-surface-3 px-3 py-1.5 text-[13px] font-medium text-fg">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Aloqa — mobil/planshet (desktopda yon panelda) */}
          <ContactPanel
            className="lg:hidden"
            contacts={{ telegram: sp.telegram, instagram: sp.instagram, youtube: sp.youtube, website: sp.website, phone: sp.user.phone, email: sp.user.email }}
            locked={sp.locked}
            loginHref={loginHref}
            orderHref={showOwnerCta ? null : orderHref}
          />

          {/* Ish vaqti */}
          <SchedulePanel schedule={sp.schedule} vacationUntil={sp.vacationUntil} lock={raw.schedule ? scheduleLock : null} loginHref={loginHref} className="animate-fade-up" />

          {/* Portfolio */}
          <section className="animate-fade-up scroll-mt-28" style={{ animationDelay: "140ms" }} id="portfolio">
            <div className="mb-4 flex items-end justify-between gap-3 px-1">
              <div>
                <span className="eyebrow">Portfolio</span>
                <h2 className="mt-2 font-display text-[20px] font-semibold tracking-tight text-fg">
                  {sp.portfolio.length > 0 ? (
                    <>
                      {sp.portfolio.length} ta <span className="accent-serif text-accent">ish</span>
                    </>
                  ) : (
                    "Ishlar"
                  )}
                </h2>
              </div>
              {sp.portfolio.length > 0 && <p className="text-[13px] text-fg-3">Bosib kattalashtiring</p>}
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
          <section className="animate-fade-up scroll-mt-28" style={{ animationDelay: "200ms" }} id="sharhlar">
            <div className="mb-4 px-1">
              <span className="eyebrow">Sharhlar</span>
              <h2 className="mt-2 font-display text-[20px] font-semibold tracking-tight text-fg">
                {sp.reviewCount > 0 ? (
                  <>
                    {sp.reviewCount} ta <span className="accent-serif text-accent">haqiqiy</span> fikr
                  </>
                ) : (
                  <>
                    Mijozlar <span className="accent-serif text-accent">fikri</span>
                  </>
                )}
              </h2>
            </div>
            <div className="space-y-4">
              <ReviewSummary rating={sp.rating} count={sp.reviewCount} distribution={distribution} />
              <ReviewForm
                specialistId={raw.id}
                canReview={canReview && !previewMode}
                isOwner={isOwner}
                existing={myReview ? { rating: myReview.rating, text: myReview.text } : null}
                loginHref={loginHref}
              />
              <ReviewList
                reviews={raw.reviews.map((r) => ({
                  id: r.id,
                  rating: r.rating,
                  text: r.text,
                  createdAt: r.createdAt.getTime(),
                  authorId: r.authorId,
                  author: r.author,
                }))}
                highlightAuthorId={viewer?.id ?? null}
              />
            </div>
          </section>
        </div>

        {/* O'ng ustun — yopishqoq (faqat desktop) */}
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="space-y-4 lg:sticky lg:top-28">
            <div className="card-elevated animate-fade-up p-5 sm:p-6" style={{ animationDelay: "60ms" }}>
              <p className="eyebrow">Narx</p>
              <p className="mt-2 font-display text-[28px] font-semibold leading-tight tracking-tight text-fg">{price}</p>
              <p className="mt-1 text-[13px] text-fg-3">
                {sp.priceFrom || sp.priceTo ? "Yakuniy narx loyiha hajmiga qarab kelishiladi." : "Narx loyihaga qarab belgilanadi."}
              </p>

              <div className="mt-5 flex items-stretch gap-2">
                <div className="min-w-0 flex-1">{cta}</div>
                <ShareButton title={`${sp.user.name} — ${sp.title}`} variant="outline" size="lg" iconOnly />
              </div>
              {!showOwnerCta && onVacation && <p className="mt-2.5 text-center text-[12px] text-fg-3">Hozir ta'tilda — buyurtmangiz navbatga qo'yiladi.</p>}
              {!showOwnerCta && !onVacation && !sp.isAvailable && <p className="mt-2.5 text-center text-[12px] text-fg-3">Hozir band — buyurtmangiz navbatga qo'yiladi.</p>}

              <ul className="mt-5 grid grid-cols-3 divide-x divide-line border-t border-line pt-4 text-center">
                <li>
                  <p className="font-display text-[17px] font-semibold text-fg">{sp.rating > 0 ? sp.rating.toFixed(1) : "—"}</p>
                  <p className="text-[11px] text-fg-3">Reyting</p>
                </li>
                <li>
                  <p className="font-display text-[17px] font-semibold text-fg">{sp.reviewCount}</p>
                  <p className="text-[11px] text-fg-3">Sharh</p>
                </li>
                <li>
                  <p className="font-display text-[17px] font-semibold text-fg">{sp.portfolio.length}</p>
                  <p className="text-[11px] text-fg-3">Ish</p>
                </li>
              </ul>
            </div>

            {showOwnerCta && (
              <div className="card-outline p-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                  <EyeOff size={14} className="text-fg-3" /> Maxfiylik
                </p>
                <p className="mt-1 text-[12px] leading-snug text-fg-3">
                  {hiddenForGuests > 0 ? `${hiddenForGuests} ta maydon mehmonlardan yashirin.` : "Hamma maydon hammaga ochiq."} Boshqalar ko'zi bilan tekshiring:
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {PREVIEW_MODES.map((m) => (
                    <Link key={m.key} href={`${profilePath}?preview=${m.key}`} className="inline-flex h-8 items-center rounded-full border border-line px-3 text-[12px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg" scroll={false}>
                      {m.label}
                    </Link>
                  ))}
                  <Link href="/kabinet/profil#maxfiylik" className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-accent transition hover:bg-accent-soft">
                    Sozlash <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}

            <ContactPanel
              contacts={{ telegram: sp.telegram, instagram: sp.instagram, youtube: sp.youtube, website: sp.website, phone: sp.user.phone, email: sp.user.email }}
              locked={sp.locked}
              loginHref={loginHref}
              orderHref={showOwnerCta ? null : orderHref}
            />
          </div>
        </aside>
      </div>

      {/* ================= O'XSHASH ================= */}
      {similar.length > 0 && (
        <section className="mt-16 sm:mt-24">
          <SectionHeading
            eyebrow="Yana ko'ring"
            title={
              <>
                O'xshash <span className="accent-serif text-accent">mutaxassislar</span>
              </>
            }
            description={`${cat ? cat.plural : "Mutaxassislar"} va ${region ? region.short : "shu hudud"} bo'yicha yaqin profillar.`}
            action={
              <ButtonLink href={`/mutaxassislar?category=${sp.category}`} variant="outline" size="sm">
                Barchasi <ArrowRight size={14} />
              </ButtonLink>
            }
          />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((s) => {
              const c = CATEGORY_BY_SLUG[s.category];
              return (
                <li key={s.id}>
                  <Link href={`/mutaxassislar/${s.slug}`} className="card card-hover flex h-full items-center gap-3 p-3.5">
                    <Avatar name={s.user.name} src={s.user.avatarUrl} size={48} decorative />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate text-[14px] font-semibold text-fg">
                        <span className="truncate">{s.user.name}</span>
                        {s.isVerified && <VerifiedBadge size={14} />}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-fg-3">
                        {c && <CategoryIcon icon={c.icon} size={11} style={{ color: c.accent }} />}
                        <span className="truncate">{s.title}</span>
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="truncate font-display text-[12px] font-semibold text-fg">{formatPriceRange(s.priceFrom, s.priceTo)}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-fg-2" aria-label={s.rating > 0 ? `Reyting ${s.rating.toFixed(1)}` : "Hali baholanmagan"}>
                          <Star size={11} className={s.rating > 0 ? "fill-accent-3 text-accent-3" : "text-fg-4"} />
                          {s.rating > 0 ? s.rating.toFixed(1) : "—"}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ================= MOBIL: pastki yopishqoq narx + CTA ================= */}
      <div
        className="card-elevated fixed inset-x-3 bottom-[76px] z-40 flex items-center gap-3 !rounded-[22px] px-4 py-2.5 md:bottom-4 lg:hidden"
        style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-fg-4">Narx</p>
          <p className="truncate font-display text-[15px] font-semibold leading-tight text-fg">{price}</p>
        </div>
        {showOwnerCta ? (
          <ButtonLink href="/kabinet/profil" size="md" className="shrink-0">
            <Settings size={16} /> Tahrirlash
          </ButtonLink>
        ) : (
          <ButtonLink href={orderHref} variant="accent" size="md" className="shrink-0">
            <span className="sm:hidden">Buyurtma</span>
            <span className="hidden sm:inline">Buyurtma berish</span> <ArrowRight size={16} />
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
