import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  MessageCircle,
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Award,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  Languages,
  Lock,
  MapPin,
  Mars,
  PackageCheck,
  PauseCircle,
  Repeat2,
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
import { FavoriteButton } from "@/components/specialists/FavoriteButton";
import { SchedulePanel } from "@/components/specialists/SchedulePanel";
import { ShareButton } from "@/components/specialists/ShareButton";
import { ReportButton } from "@/components/specialists/ReportButton";
import { PackagesTable } from "@/components/specialists/PackagesTable";
import { RateCalculator } from "@/components/specialists/RateCalculator";
import { ShortLink } from "@/components/specialists/ShortLink";
import { CompareButton } from "@/components/specialists/CompareButton";
import { CompareTray } from "@/components/specialists/CompareTray";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_BY_SLUG, EXPERIENCE_LEVELS, GENDERS, REGION_BY_SLUG, SITE, TOP_RATED_RULE, WORK_TYPE_BY_SLUG } from "@/lib/constants";
import { tr } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { KARTA, experienceLabel, genderPersonLabel, localizePrice, priceFromLabel, priceRangeLabel, workTypeLabel } from "@/lib/i18n/dict/catalog";
import { FAOLLIK, PROFIL, TIL_NOMI } from "@/lib/i18n/dict/profile";
import { getSettings } from "@/lib/payments/settings";
import { GUEST_VIEWER, effectivePriceFrom, filterSpecialistForViewer, isBotUserAgent, isOnVacation, lockReason, resolveVisibility, type Viewer } from "@/lib/privacy";
import { forwardedHost, forwardedProto, trustedSiteOrigin } from "@/lib/security/request";
import { subscriptionState } from "@/lib/subscriptions/access";
import {
  bumpViewCount,
  ensureShortCode,
  getSimilarSpecialists,
  getSocialProof,
  getSpecialistBySlug,
  getVerifiedReviewerIds,
  hasAcceptedOrderWith,
  hasCompletedOrderWith,
  ratingDistribution,
  responseTimeLabel,
} from "@/lib/queries";
import { activityBucket, cn, formatDate, formatNumber, formatPrice, formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Egasi uchun "boshqalar ko'zi bilan" rejimlari (yorliq/izoh — PROFIL.previewModes lug'atida) */
const PREVIEW_MODES = ["guest", "client", "order"] as const;
type PreviewMode = (typeof PREVIEW_MODES)[number];

type Params = Promise<{ slug: string }>;
type Search = Promise<{ preview?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const [raw, settings] = await Promise.all([getSpecialistBySlug(slug), getSettings()]);
  if (!raw) return { title: "Mutaxassis topilmadi" };
  // Metadata — mehmon ko'rinishi (shahar yashirin bo'lsa hudud markazi)
  const sp = filterSpecialistForViewer(raw, GUEST_VIEWER);
  // Obunasi tugagan profil katalogdan yashirin — qidiruv tizimlari ham indekslamasin
  const inactive = subscriptionState(raw, settings).status === "expired";
  const region = REGION_BY_SLUG[sp.regionSlug];
  // Sarlavha oxiridagi "." / "!" olib tashlanadi — " · Kasb Egalari" shablonidan oldin ortiqcha tinish belgisi qolmasin
  const jobTitle = sp.title.trim().replace(/[.!]+$/, "");
  const title = `${sp.user.name} — ${jobTitle}`;
  // Tavsif — bio kesmasi emas, tuzilgan matn (bo'lmagan qismlar tushib qoladi)
  const metaPlace = [region?.name, sp.city].filter(Boolean).join(", ");
  const metaPrice = effectivePriceFrom(raw);
  const description = [
    `«${jobTitle}» — ${sp.user.name}.`,
    metaPlace ? `${metaPlace}.` : null,
    metaPrice > 0 ? `Narx ${formatPrice(metaPrice, { compact: true })} dan.` : null,
    `Portfolio va sharhlar — ${SITE.name}'da.`,
  ]
    .filter(Boolean)
    .join(" ");
  // OG rasm — shu segmentdagi opengraph-image.tsx (ism, kasb, hudud, reyting; mehmon ma'lumoti)
  return {
    title,
    description,
    alternates: { canonical: `/mutaxassislar/${sp.slug}` },
    openGraph: { title: `${title} · ${SITE.name}`, description, type: "profile", url: `/mutaxassislar/${sp.slug}` },
    twitter: { card: "summary_large_image", title: `${title} · ${SITE.name}`, description },
    ...(inactive ? { robots: { index: false, follow: false } } : {}),
  };
}

/** Ism: oxirgi so'z + tasdiq belgisi bitta "bo'linmas" bo'lakda — belgi yolg'iz qatorga tushmaydi */
function NameWithBadge({ name, verified, verifiedTitle }: { name: string; verified: boolean; verifiedTitle: string }) {
  const words = name.trim().split(/\s+/);
  const last = words.pop() ?? "";
  return (
    <>
      {words.length > 0 && <>{words.join(" ")} </>}
      <span className="whitespace-nowrap">
        {last}
        {verified && (
          <span title={verifiedTitle} className="ml-1.5 inline-block align-[-3px]">
            <VerifiedBadge size={24} />
          </span>
        )}
      </span>
    </>
  );
}

/** Obunasi faol bo'lmagan mutaxassis: aloqa ma'lumotlari o'rnida izoh (qiymatlar serverda olib tashlangan) */
async function LockedContacts({ className }: { className?: string }) {
  const til = await getLocale();
  return (
    <section className={className} aria-label={tr(til, PROFIL.contact)}>
      <div className="mb-2 px-4">
        <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">{tr(til, PROFIL.contact)}</h3>
      </div>
      <div className="card flex items-start gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-surface-3 text-fg-3">
          <Lock size={16} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-fg-2">{tr(til, PROFIL.contactsClosedTitle)}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-fg-3">{tr(til, PROFIL.contactsClosedDesc)}</p>
        </div>
      </div>
    </section>
  );
}

export default async function SpecialistPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  const raw = await getSpecialistBySlug(slug);
  if (!raw) notFound();

  const [viewer, hdrs, settings, til] = await Promise.all([getCurrentUser(), headers(), getSettings(), getLocale()]);
  const isOwner = Boolean(viewer && viewer.id === raw.userId);
  const isAdmin = viewer?.role === "admin";

  // ?preview= faqat egasi uchun: profil boshqalarga qanday ko'rinishini simulyatsiya qiladi
  const previewMode: PreviewMode | null = isOwner && PREVIEW_MODES.some((m) => m === preview) ? (preview as PreviewMode) : null;

  // hasOrder — maxfiylik darajalari ("orders") uchun: qabul qilingan/jarayonda/bajarilgan buyurtma yetarli.
  // hasDoneOrder — sharh huquqi uchun: faqat YAKUNLANGAN (done) buyurtma (server ham shuni tekshiradi).
  const [hasOrder, hasDoneOrder] =
    viewer && !isOwner ? await Promise.all([hasAcceptedOrderWith(viewer.id, raw.id), hasCompletedOrderWith(viewer.id, raw.id)]) : [false, false];
  const effectiveViewer: Viewer = previewMode
    ? previewMode === "guest"
      ? { userId: null }
      : { userId: viewer!.id, role: "client", hasOrder: previewMode === "order" }
    : { userId: viewer?.id ?? null, role: viewer?.role ?? null, isOwner, hasOrder };

  const sp = filterSpecialistForViewer(raw, effectiveViewer);
  const vis = resolveVisibility(raw.visibility);

  // Obuna (subscriptions/access.ts): muddati tugagan (imtiyozli kunlardan keyin) — katalogdan yashirin, yangi buyurtma yo'q,
  // aloqalar mehmon/mijozga yopiq (egasi, admin va buyurtmasi borlar ko'radi). Egasining "mehmon ko'zi bilan" rejimi ham shuni ko'rsatadi.
  const sub = subscriptionState(raw, settings);
  const inactive = sub.status === "expired";
  const contactsLocked = inactive && (previewMode ? previewMode !== "order" : !isOwner && !isAdmin && !hasOrder);

  // Qisqa havola (F66): kod yo'q eski profillar uchun bir marta yaratiladi
  const shortCode = raw.shortCode ?? (await ensureShortCode(raw.id).catch(() => null));
  const host = forwardedHost(hdrs) ?? hdrs.get("host") ?? "localhost:3000";
  const origin = trustedSiteOrigin() ?? `${forwardedProto(hdrs) ?? (/^(localhost|127\.)/i.test(host) ? "http" : "https")}://${host}`;
  const shortUrl = shortCode ? `${origin}/u/${shortCode.toUpperCase()}` : null;
  const shortDisplay = shortUrl ? shortUrl.replace(/^https?:\/\//, "") : null;
  // O'xshashlar — umumiy ko'ruvchi konteksti: isOwner/hasOrder faqat SHU profilga nisbatan, boshqa profillarga o'tkazilmaydi
  const [similar, proof, verifiedIds] = await Promise.all([
    getSimilarSpecialists(raw, 4, { userId: effectiveViewer.userId, role: effectiveViewer.role }),
    getSocialProof(raw.id, raw.completedCount),
    getVerifiedReviewerIds(raw.id),
  ]);
  const completedOrders = proof.completed;

  // Ko'rishlar soni: egasi (shu jumladan preview) va botlar hisoblanmaydi; natijani kutmaymiz
  if (!isOwner && !isBotUserAgent(hdrs.get("user-agent"))) {
    try {
      void bumpViewCount(raw.id).catch(() => {});
    } catch {
      /* noop */
    }
  }

  const myReview = viewer ? raw.reviews.find((r) => r.authorId === viewer.id) : null;
  // Sharh — faqat shu mutaxassis bilan YAKUNLANGAN buyurtmasi borlardan (server ham tekshiradi); mavjud sharh tahrirlanaveradi.
  // Adminga ham istisno yo'q — sharh faqat haqiqiy ish tajribasidan (moderatsiya/DELETE huquqi saqlanadi).
  const canReview = Boolean(viewer) && !isOwner && (hasDoneOrder || Boolean(myReview));
  const needsOrder = Boolean(viewer) && !isOwner && !canReview;
  const profilePath = `/mutaxassislar/${raw.slug}`;
  const loginHref = `/auth/kirish?next=${encodeURIComponent(profilePath)}`;
  // Sharh uchun kirish — login sahifasi kontekstli xabar ko'rsatadi (A23)
  const reviewLoginHref = `${loginHref}&reason=review`;
  const orderHref = `/buyurtma/${raw.id}`;
  const showOwnerCta = isOwner && !previewMode;
  // Buyurtma tugmalari faqat obuna faol bo'lsa (egasidan tashqari hammaga)
  const orderLink = showOwnerCta || inactive ? null : orderHref;

  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];
  const expInfo = EXPERIENCE_LEVELS.find((e) => e.value === sp.experience);
  const experience = expInfo ? experienceLabel(til, expInfo.value, expInfo.label) : sp.experience;
  const languages = sp.languages.map((l) => (TIL_NOMI[l] ? tr(til, TIL_NOMI[l]) : l)).join(", ");
  const views = formatNumber(sp.viewCount);
  const genderInfo = sp.user.gender ? GENDERS.find((g) => g.value === sp.user.gender) : null;
  const genderLabel = genderInfo ? genderPersonLabel(til, genderInfo.value, genderInfo.label) : null;
  const onVacation = isOnVacation(sp.vacationUntil);
  const scheduleLock = lockReason(vis.schedule, effectiveViewer);
  const distribution = ratingDistribution(raw.reviews);
  // "… dan" narx: priceFrom bo'sh bo'lsa — eng arzon paket (F31); dollar ekvivalenti (F99) — platforma kursi bilan
  const priceFrom = effectivePriceFrom(raw);
  const price = priceRangeLabel(til, priceFrom, sp.priceTo);
  // Mobil pastki panel uchun qisqa narx — to'liq oraliq ("1,5 – 3 mln so'm") tor ekranda qirqilmasin
  const priceCompact = priceFrom > 0 ? priceFromLabel(til, formatPrice(priceFrom, { compact: true })) : price;
  const priceUsd = priceFrom > 0 ? formatUsd(priceFrom, settings.usdRate) : "";
  const workTypes = sp.workTypes.map((w) => WORK_TYPE_BY_SLUG[w]).filter((w): w is NonNullable<typeof w> => Boolean(w));
  const compareItem = { id: raw.id, name: sp.user.name, avatarUrl: sp.user.avatarUrl };
  const lockedCount = Object.keys(sp.locked).length + (scheduleLock && raw.schedule ? 1 : 0);
  const hiddenForGuests = isOwner
    ? (["phone", "telegram", "instagram", "youtube", "website", "email", "schedule", "gender", "city"] as const).filter((k) => vis[k] !== "public").length
    : 0;

  // SEO (JSON-LD): Person (+ kasb, hudud), AggregateRating faqat sharh borida, BreadcrumbList
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        name: sp.user.name,
        jobTitle: sp.title,
        url: `${origin}${profilePath}`,
        ...(region || sp.city
          ? { address: { "@type": "PostalAddress", ...(region ? { addressRegion: region.name } : {}), ...(sp.city ? { addressLocality: sp.city } : {}), addressCountry: "UZ" } }
          : {}),
        ...(sp.reviewCount > 0
          ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(sp.rating.toFixed(1)), reviewCount: sp.reviewCount, bestRating: 5, worstRating: 1 } }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Bosh sahifa", item: `${origin}/` },
          { "@type": "ListItem", position: 2, name: "Mutaxassislar", item: `${origin}/mutaxassislar` },
          { "@type": "ListItem", position: 3, name: sp.user.name, item: `${origin}${profilePath}` },
        ],
      },
    ],
  };

  const metaChips: Array<{ icon: typeof Briefcase; text: string; tone: "accent" | "neutral" }> = [
    { icon: Briefcase, text: experience, tone: "accent" },
    { icon: Languages, text: languages, tone: "neutral" },
    { icon: Eye, text: PROFIL.views[til](views), tone: "neutral" },
    { icon: CalendarDays, text: PROFIL.memberSince[til](formatDate(sp.user.createdAt)), tone: "neutral" },
  ];
  if (genderLabel) metaChips.splice(1, 0, { icon: sp.user.gender === "female" ? Venus : Mars, text: genderLabel, tone: "neutral" });

  // Ijtimoiy isbot (E86/F12/F68): faqat bor ko'rsatkichlar — yangi profilda "0 ta" chiqmaydi
  const responseLabel = responseTimeLabel(proof.responseHours);
  const activity = activityBucket(raw.user.lastLoginAt);
  const proofChips: Array<{ icon: typeof Briefcase; text: string; title?: string }> = [];
  if (proof.completed > 0) proofChips.push({ icon: PackageCheck, text: PROFIL.completedOrders[til](proof.completed), title: tr(til, PROFIL.completedOrdersHint) });
  if (proof.repeatClients > 0) proofChips.push({ icon: Repeat2, text: PROFIL.repeatClients[til](proof.repeatClients), title: tr(til, PROFIL.repeatClientsHint) });
  if (responseLabel) proofChips.push({ icon: Clock3, text: responseLabel, title: tr(til, PROFIL.responseHint) });
  if (activity) proofChips.push({ icon: Activity, text: PROFIL.lastActivity[til](tr(til, FAOLLIK[activity])) });
  const verifiedSet = new Set(verifiedIds);

  /** Ichki chat: mutaxassisga to'g'ridan-to'g'ri yozish (kirmaganlar login orqali qaytadi) */
  const chatCta =
    !showOwnerCta && sp.user.username ? (
      <ButtonLink href={`/yozish/${sp.user.username}`} variant="outline" size="lg" className="w-full">
        <MessageCircle size={17} /> {tr(til, PROFIL.write)}
      </ButtonLink>
    ) : null;
  const cta = showOwnerCta ? (
    <ButtonLink href="/kabinet/profil" size="lg" className="w-full">
      <Settings size={18} /> {tr(til, PROFIL.editProfile)}
    </ButtonLink>
  ) : (
    <div className="flex w-full flex-col gap-2.5">
      {orderLink ? (
        <ButtonLink href={orderLink} variant="accent" size="lg" className="w-full">
          {tr(til, PROFIL.order)} <ArrowRight size={18} />
        </ButtonLink>
      ) : (
        <p className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-surface-3 px-4 text-center text-[13px] font-semibold text-fg-2">
          <PauseCircle size={16} aria-hidden="true" /> {tr(til, PROFIL.notAccepting)}
        </p>
      )}
      {chatCta}
    </div>
  );

  return (
    <div className="container-x pb-24 lg:pb-0">
      {/* Tuzilgan ma'lumot (SEO) — "</script>" ichida chiqmasligi uchun "<" belgisi qochiriladi */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* ================= PREVIEW BANNER (faqat egasi) ================= */}
      {previewMode && (
        <div className="card-elevated mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
              <Eye size={18} />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-fg">{tr(til, PROFIL.previewTitle)}</p>
              <p className="mt-0.5 text-[12px] text-fg-3">
                {tr(til, PROFIL.previewModes[previewMode].hint)}
                {lockedCount > 0 ? PROFIL.lockedFields[til](lockedCount) : tr(til, PROFIL.allFieldsOpen)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="segment" role="group" aria-label={tr(til, PROFIL.viewerTypeAria)}>
              {PREVIEW_MODES.map((m) => (
                <Link key={m} href={`${profilePath}?preview=${m}`} className="segment-item" data-active={m === previewMode} scroll={false}>
                  {tr(til, PROFIL.previewModes[m].label)}
                </Link>
              ))}
            </div>
            <Link href={profilePath} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg" scroll={false}>
              <X size={14} /> {tr(til, PROFIL.exitPreview)}
            </Link>
          </div>
        </div>
      )}

      {/* ================= OBUNA BANNERI (faqat egasi) ================= */}
      {showOwnerCta && (sub.status === "expired" || sub.status === "grace") && (
        <div
          role="status"
          className={cn(
            "mb-5 flex flex-col gap-3 rounded-[var(--r-md)] border p-4 sm:flex-row sm:items-center sm:justify-between",
            sub.status === "expired" ? "border-danger/30 bg-danger-soft" : "border-warning/30 bg-warning-soft",
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className={cn("mt-0.5 shrink-0", sub.status === "expired" ? "text-danger-text" : "text-warning-text")} aria-hidden="true" />
            <div>
              <p className="text-[14px] font-semibold text-fg">
                {sub.status === "expired" ? tr(til, PROFIL.subExpiredTitle) : PROFIL.subGraceTitle[til](sub.daysLeft)}
              </p>
              <p className="mt-0.5 text-[13px] text-fg-2">{sub.status === "expired" ? tr(til, PROFIL.subExpiredDesc) : tr(til, PROFIL.subGraceDesc)}</p>
            </div>
          </div>
          <ButtonLink href="/kabinet/obuna" variant="accent" size="sm" className="shrink-0">
            {tr(til, PROFIL.renewSub)} <ArrowRight size={14} />
          </ButtonLink>
        </div>
      )}

      {/* ================= BREADCRUMB ================= */}
      {/* Telefonda o'rta bo'g'in (kategoriya) yashiriladi — joriy sahifa nomi (ism) qisqarmasin */}
      <nav aria-label={tr(til, PROFIL.breadcrumbAria)} className="no-scrollbar mb-5 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-[14px] font-medium text-fg-3">
        <Link href="/mutaxassislar" className="inline-flex min-h-8 shrink-0 items-center transition hover:text-fg">
          {tr(til, PROFIL.specialists)}
        </Link>
        <ChevronRight size={14} aria-hidden className="shrink-0 text-fg-4" />
        {cat && (
          <>
            <Link href={`/mutaxassislar?category=${cat.slug}`} className="hidden min-h-8 shrink-0 items-center transition hover:text-fg sm:inline-flex">
              {cat.plural}
            </Link>
            <ChevronRight size={14} aria-hidden className="hidden shrink-0 text-fg-4 sm:block" />
          </>
        )}
        <span className="min-w-0 truncate text-fg" aria-current="page">
          {sp.user.name}
        </span>
      </nav>

      {/* ================= HERO ================= */}
      <section className="card animate-fade-up overflow-hidden !rounded-[28px] sm:!rounded-[32px]">
        {/* Balandlik 4:1 nisbatdan — kesish oynasida (ImageCropper) moslangan muqova qayta kesilmasin */}
        <div className="relative h-40 overflow-hidden bg-surface-3 sm:h-auto sm:max-h-[360px] sm:aspect-[4/1]">
          {/* Rasm bo'lmasa: tinch yuza + yo'nalish rangida nozik nur (rang-barang gradient o'rniga) */}
          <div
            className="absolute inset-0 opacity-70 dark:opacity-50"
            style={{ background: `radial-gradient(60% 120% at 85% 0%, ${cat?.accent ?? "#ff5a36"}33, transparent 70%), radial-gradient(50% 90% at 10% 100%, ${cat?.accent ?? "#ff5a36"}1f, transparent 70%)` }}
          />
          <div className="absolute inset-0 grain" />
          {/* Muqova yo'q bo'lsa — birinchi portfolio ishining muqovasi (kabinetdagi "Birinchi ish muqovada ko'rinadi"), u ham bo'lmasa naqsh */}
          <CoverImage src={sp.coverUrl ?? sp.portfolio.find((p) => p.thumbnailUrl)?.thumbnailUrl ?? null} category={sp.category} seed={sp.slug} priority />

          <div className="absolute left-4 top-4 flex flex-wrap gap-2 sm:left-6 sm:top-6">
            {cat && (
              <Link href={`/mutaxassislar?category=${cat.slug}`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[12px] font-semibold text-ink-fg transition hover:brightness-110">
                <CategoryIcon icon={cat.icon} size={13} />
                {cat.name}
              </Link>
            )}
            {sp.topRated && (
              <span
                title={KARTA.topHint[til](TOP_RATED_RULE.minRating, TOP_RATED_RULE.minReviews)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[12px] font-semibold text-fg shadow-[var(--shadow-1)]"
              >
                <Award size={13} className="text-accent" /> {tr(til, PROFIL.topSpecialist)}
                <span className="sr-only"> — {KARTA.topHint[til](TOP_RATED_RULE.minRating, TOP_RATED_RULE.minReviews)}</span>
              </span>
            )}
            {sp.isFeatured && (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[12px] font-semibold text-accent shadow-[var(--shadow-1)]">
                <Sparkles size={13} /> {tr(til, PROFIL.featured)}
              </span>
            )}
          </div>

          <span
            className={cn(
              "absolute right-4 top-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[12px] font-semibold shadow-[var(--shadow-1)] sm:right-6 sm:top-6",
              inactive ? "text-fg-2" : onVacation ? "text-accent" : sp.isAvailable ? "text-[#15803d] dark:text-ios-green" : "text-[#c2410c] dark:text-ios-orange",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", inactive ? "bg-fg-4" : onVacation ? "bg-accent" : sp.isAvailable ? "bg-ios-green" : "bg-ios-orange")} />
            {inactive ? tr(til, PROFIL.inactive) : onVacation ? tr(til, PROFIL.onVacation) : sp.isAvailable ? tr(til, PROFIL.available) : tr(til, PROFIL.busy)}
          </span>
        </div>

        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          {/* Avatar muqovaga chiqadi (-mt-14), matn esa desktopda muqova chetidan PASTDA boshlanadi (sm:pt-16):
              qoraytirilgan rasm ustida yorug' mavzuda qora ism o'qilmay qolmasin */}
          <div className="relative z-10 -mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-start">
            <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={112} className="!ring-4 !ring-surface text-[36px]" />
            <div className="min-w-0 flex-1 sm:pt-16">
              <h1 className="break-words font-display text-[28px] font-semibold leading-[1.05] tracking-tight text-fg sm:text-[38px]">
                <NameWithBadge name={sp.user.name} verified={sp.isVerified} verifiedTitle={tr(til, PROFIL.verifiedPerson)} />
              </h1>
              <p className="mt-1.5 text-[16px] text-fg-2 sm:text-[17px]">{sp.title}</p>
              <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-3">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} className="text-accent" />
                  {sp.city}
                  {region && (sp.city !== region.capital || region.slug !== "toshkent-shahri") && <span>· {region.name}</span>}
                  {sp.cityApprox && (
                    <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-fg-3" title={tr(til, PROFIL.approxCityHint)}>
                      <Lock size={10} /> {tr(til, PROFIL.approxCity)}
                    </span>
                  )}
                </span>
                {sp.reviewCount > 0 ? (
                  <Stars value={sp.rating} count={sp.reviewCount} size={13} />
                ) : (
                  // Bo'sh 5 yulduz "yomon baho" kabi ko'rinmasin (E84) — matnli belgi
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[12px] font-medium text-fg-2">
                    <Star size={11} className="text-fg-3" /> {tr(til, PROFIL.noReviewsYet)}
                  </span>
                )}
              </p>
            </div>
            {showOwnerCta && (
              <div className="hidden shrink-0 sm:block sm:pt-16">
                <ButtonLink href={`${profilePath}?preview=guest`} variant="outline" size="sm">
                  <Eye size={15} /> {tr(til, PROFIL.guestEye)}
                </ButtonLink>
              </div>
            )}
          </div>

          {proofChips.length > 0 && (
            <ul className="mt-5 flex flex-wrap items-center gap-2" aria-label={tr(til, PROFIL.trustAria)}>
              {proofChips.map((m) => (
                <li key={m.text} title={m.title} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-[12px] font-semibold text-success-text">
                  <m.icon size={13} />
                  {m.text}
                </li>
              ))}
            </ul>
          )}

          <ul className={cn("flex flex-wrap items-center gap-2", proofChips.length > 0 ? "mt-2" : "mt-5")}>
            {metaChips.map((m) => (
              <li
                key={m.text}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold",
                  m.tone === "accent" ? "bg-accent-soft text-accent-text" : "border border-line text-fg-2",
                )}
              >
                <m.icon size={13} className={m.tone === "accent" ? undefined : "text-fg-3"} />
                {m.text}
              </li>
            ))}
            <li className="ml-auto flex items-center gap-2 lg:hidden">
              {!isOwner && !inactive && <CompareButton item={compareItem} variant="ghost" className="border border-line-2" />}
              {!isOwner && <FavoriteButton specialistId={sp.id} variant="outline" size="sm" />}
              <ShareButton title={`${sp.user.name} — ${sp.title}`} url={shortUrl ?? undefined} size="sm" variant="outline" />
            </li>
          </ul>
        </div>
      </section>

      {/* ================= OBUNA FAOL EMAS (tashrif buyuruvchilar) ================= */}
      {inactive && !showOwnerCta && (
        <section role="status" className="card-outline mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3.5">
            <span className="icon-tile-outline shrink-0">
              <PauseCircle size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-[17px] font-semibold leading-snug text-fg">{tr(til, PROFIL.inactiveTitle)}</h2>
              <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">{tr(til, PROFIL.inactiveDesc)}</p>
            </div>
          </div>
          <ButtonLink href={`/mutaxassislar?category=${sp.category}${sp.regionSlug ? `&region=${sp.regionSlug}` : ""}`} variant="outline" size="sm" className="shrink-0">
            {tr(til, PROFIL.similarBtn)} <ArrowRight size={14} />
          </ButtonLink>
        </section>
      )}

      {/* ================= TANA ================= */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Chap ustun */}
        <div className="min-w-0 space-y-6 lg:col-span-8">
          {/* Haqida */}
          <section className="card animate-fade-up p-5 sm:p-7" style={{ animationDelay: "80ms" }}>
            <span className="eyebrow">{tr(til, PROFIL.aboutEyebrow)}</span>
            <h2 className="mt-2 font-display text-[20px] font-semibold tracking-tight text-fg">
              {til === "ru" ? (
                <>
                  О специалисте <span className="accent-serif text-accent">{sp.user.name.split(" ")[0]}</span>
                </>
              ) : (
                <>
                  {sp.user.name.split(" ")[0]} <span className="accent-serif text-accent">haqida</span>
                </>
              )}
            </h2>
            {sp.bio?.trim() ? (
              <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-fg-2">{sp.bio}</p>
            ) : (
              <p className="mt-4 text-[15px] text-fg-3">{tr(til, PROFIL.noBio)}</p>
            )}

            {workTypes.length > 0 && (
              <div className="mt-6 border-t border-line pt-5">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">{tr(til, PROFIL.workTypes)}</h3>
                {/* Har bir ish turi — shu turdagi mutaxassislar ro'yxatiga (F52) */}
                <ul className="mt-3 flex flex-wrap gap-2">
                  {workTypes.map((w) => (
                    <li key={w.slug}>
                      <Link
                        href={`/mutaxassislar?workType=${w.slug}`}
                        className="inline-flex min-h-8 items-center rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-text transition hover:brightness-105"
                        title={PROFIL.workTypeHint[til](workTypeLabel(til, w.slug, w.label))}
                      >
                        {workTypeLabel(til, w.slug, w.label)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sp.skills.length > 0 && (
              <div className="mt-6 border-t border-line pt-5">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">{tr(til, PROFIL.skills)}</h3>
                {/* Har bir ko'nikma — shu ko'nikmali mutaxassislar ro'yxatiga (F50) */}
                <ul className="mt-3 flex flex-wrap gap-2">
                  {sp.skills.map((s) => (
                    <li key={s}>
                      <Link
                        href={`/mutaxassislar?skill=${encodeURIComponent(s)}`}
                        className="inline-flex min-h-8 items-center rounded-full bg-surface-3 px-3 py-1.5 text-[13px] font-medium text-fg transition hover:bg-fg/10"
                        title={PROFIL.skillHint[til](s)}
                      >
                        {s}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sp.equipment.length > 0 && (
              <div className="mt-6 border-t border-line pt-5">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">{tr(til, PROFIL.equipment)}</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {sp.equipment.map((s) => (
                    <li key={s}>
                      <Link
                        href={`/mutaxassislar?equipment=${encodeURIComponent(s)}`}
                        className="inline-flex min-h-8 items-center rounded-full border border-line px-3 py-1.5 text-[13px] font-medium text-fg-2 transition hover:border-fg hover:text-fg"
                        title={PROFIL.equipmentHint[til](s)}
                      >
                        {s}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Xizmat paketlari (F31) */}
          {sp.packages.length > 0 && (
            <section className="animate-fade-up scroll-mt-28" id="paketlar" aria-labelledby="paketlar-title">
              <div className="mb-4 px-1">
                <span className="eyebrow">{tr(til, PROFIL.packagesEyebrow)}</span>
                <h2 id="paketlar-title" className="mt-2 font-display text-[20px] font-semibold tracking-tight text-fg">
                  {tr(til, PROFIL.packagesTitleStart)} <span className="accent-serif text-accent">{tr(til, PROFIL.packagesTitleAccent)}</span>
                </h2>
              </div>
              <PackagesTable
                packages={sp.packages}
                orderBase={orderLink}
                usdRate={settings.usdRate}
                disabledNote={showOwnerCta ? tr(til, PROFIL.packagesOwnerNote) : inactive ? tr(til, PROFIL.packagesInactiveNote) : undefined}
              />
            </section>
          )}

          {/* Aloqa — mobil/planshet (desktopda yon panelda) */}
          {contactsLocked ? (
            <LockedContacts className="lg:hidden" />
          ) : (
            <ContactPanel
              className="lg:hidden"
              contacts={{ telegram: sp.telegram, instagram: sp.instagram, youtube: sp.youtube, website: sp.website, phone: sp.user.phone, email: sp.user.email }}
              locked={sp.locked}
              loginHref={loginHref}
              orderHref={orderLink}
            />
          )}

          {/* Qisqa havola + vizitka — mobil/planshet (desktopda narx kartasida) */}
          {shortUrl && shortDisplay && (
            <section className="lg:hidden" aria-label={tr(til, PROFIL.shortLink)}>
              <h3 className="mb-2 px-4 text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">{tr(til, PROFIL.shortLink)}</h3>
              <ShortLink url={shortUrl} display={shortDisplay} vcardHref={`/api/vcard/${raw.slug}`} />
            </section>
          )}

          {/* Narx kalkulyatori (F70) */}
          {(sp.rates.hourly || sp.rates.daily || sp.rates.project || sp.rates.unit) && <RateCalculator rates={sp.rates} urgentPct={settings.urgentPct} usdRate={settings.usdRate} className="animate-fade-up" />}

          {/* Ish vaqti + band kunlar (F41) */}
          <SchedulePanel
            schedule={sp.schedule}
            vacationUntil={sp.vacationUntil}
            lock={raw.schedule ? scheduleLock : null}
            loginHref={loginHref}
            blockedDates={sp.blockedDates}
            className="animate-fade-up"
          />

          {/* Sertifikatlar va litsenziyalar (F64) */}
          {sp.certificates.length > 0 && (
            <section className="card animate-fade-up p-5 sm:p-7" aria-labelledby="sertifikatlar-title">
              <span className="eyebrow">{tr(til, PROFIL.certsEyebrow)}</span>
              <h2 id="sertifikatlar-title" className="mt-2 font-display text-[20px] font-semibold tracking-tight text-fg">
                {tr(til, PROFIL.certsTitleStart)} <span className="accent-serif text-accent">{tr(til, PROFIL.certsTitleAccent)}</span>
              </h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {sp.certificates.map((c, i) => (
                  <li key={`${c.title}-${i}`} className="flex items-start gap-3 rounded-[var(--r-sm)] border border-line p-3.5">
                    <span className="icon-tile-soft icon-tile-sm shrink-0">
                      <BadgeCheck size={16} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[14px] font-semibold leading-snug text-fg">{c.title}</p>
                      <p className="mt-0.5 text-[12.5px] text-fg-3">
                        {c.issuer} · {c.year}
                      </p>
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer noopener nofollow"
                          className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-[12.5px] font-semibold text-accent-text transition hover:opacity-80"
                        >
                          {tr(til, PROFIL.viewDoc)} <ArrowUpRight size={13} aria-hidden="true" />
                          <span className="sr-only">{tr(til, PROFIL.newWindow)}</span>
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Portfolio */}
          <section className="animate-fade-up scroll-mt-28" style={{ animationDelay: "140ms" }} id="portfolio">
            <div className="mb-4 flex items-end justify-between gap-3 px-1">
              <div>
                <span className="eyebrow">{tr(til, PROFIL.portfolioEyebrow)}</span>
                <h2 className="mt-2 font-display text-[20px] font-semibold tracking-tight text-fg">
                  {sp.portfolio.length > 0 ? (
                    <>
                      {PROFIL.portfolioTitle[til](sp.portfolio.length).pre}
                      <span className="accent-serif text-accent">{PROFIL.portfolioTitle[til](sp.portfolio.length).accent}</span>
                    </>
                  ) : (
                    tr(til, PROFIL.portfolioEmpty)
                  )}
                </h2>
              </div>
              {sp.portfolio.length > 0 && <p className="text-[13px] text-fg-3">{tr(til, PROFIL.clickToZoom)}</p>}
            </div>
            <PortfolioGallery
              items={sp.portfolio.map((p) => ({
                id: p.id,
                title: p.title,
                type: p.type,
                url: p.url,
                thumbnailUrl: p.thumbnailUrl,
                description: p.description,
                tags: p.tags,
                beforeUrl: p.beforeUrl,
              }))}
            />
          </section>

          {/* Sharhlar */}
          <section className="animate-fade-up scroll-mt-28" style={{ animationDelay: "200ms" }} id="sharhlar">
            <div className="mb-4 px-1">
              <span className="eyebrow">{tr(til, PROFIL.reviewsEyebrow)}</span>
              <h2 className="mt-2 font-display text-[20px] font-semibold tracking-tight text-fg">
                {sp.reviewCount > 0 ? (
                  <>
                    {PROFIL.reviewsTitle[til](sp.reviewCount).pre}
                    <span className="accent-serif text-accent">{PROFIL.reviewsTitle[til](sp.reviewCount).accent}</span>
                    {PROFIL.reviewsTitle[til](sp.reviewCount).end}
                  </>
                ) : (
                  <>
                    {tr(til, PROFIL.reviewsEmptyTitleStart)} <span className="accent-serif text-accent">{tr(til, PROFIL.reviewsEmptyTitleAccent)}</span>
                  </>
                )}
              </h2>
            </div>
            <div className="space-y-4">
              <ReviewSummary rating={sp.rating} count={sp.reviewCount} distribution={distribution} items={raw.reviews} />
              <ReviewForm
                specialistId={raw.id}
                canReview={canReview && !previewMode}
                needsOrder={needsOrder}
                orderHref={orderHref}
                isOwner={isOwner}
                existing={
                  myReview
                    ? {
                        rating: myReview.rating,
                        text: myReview.text,
                        quality: myReview.quality,
                        timeliness: myReview.timeliness,
                        communication: myReview.communication,
                        media: myReview.media,
                        recommend: myReview.recommend,
                      }
                    : null
                }
                loginHref={reviewLoginHref}
              />
              <ReviewList
                reviews={raw.reviews.map((r) => ({
                  id: r.id,
                  rating: r.rating,
                  text: r.text,
                  createdAt: r.createdAt.getTime(),
                  authorId: r.authorId,
                  author: r.author,
                  verified: verifiedSet.has(r.authorId),
                  reply: r.reply,
                  replyAt: r.replyAt ? r.replyAt.getTime() : null,
                  quality: r.quality,
                  timeliness: r.timeliness,
                  communication: r.communication,
                  media: r.media,
                  recommend: r.recommend,
                }))}
                highlightAuthorId={previewMode ? null : (viewer?.id ?? null)}
                specialistId={raw.id}
                canModerate={isAdmin && !isOwner}
                canReply={isOwner && !previewMode}
                canReport={Boolean(viewer) && !previewMode}
                replyAuthor={{ name: sp.user.name, avatarUrl: sp.user.avatarUrl }}
              />
            </div>
          </section>

          {/* Profil haqida shikoyat — mobil/planshet (desktopda yon panelda) */}
          {!isOwner && !previewMode && <ReportButton targetType="specialist" targetId={raw.id} loggedIn={Boolean(viewer)} loginHref={loginHref} align="center" className="lg:hidden" />}
        </div>

        {/* O'ng ustun — yopishqoq (faqat desktop) */}
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="space-y-4 lg:sticky lg:top-28">
            <div className="card-elevated animate-fade-up p-5 sm:p-6" style={{ animationDelay: "60ms" }}>
              <p className="eyebrow">{tr(til, PROFIL.priceEyebrow)}</p>
              <p className="mt-2 font-display text-[28px] font-semibold leading-tight tracking-tight text-fg">{price}</p>
              {priceUsd && (
                <p className="mt-0.5 text-[12px] text-fg-3">
                  {priceUsd}
                  {sp.priceTo && sp.priceTo > priceFrom ? tr(til, PROFIL.usdFrom) : ""}
                  {tr(til, PROFIL.usdApprox)}
                </p>
              )}
              <p className="mt-1 text-[13px] text-fg-3">{priceFrom || sp.priceTo ? tr(til, PROFIL.priceFinalNote) : tr(til, PROFIL.priceNegotiable)}</p>

              <div className="mt-5 flex items-stretch gap-2">
                <div className="min-w-0 flex-1">{cta}</div>
                {!isOwner && <FavoriteButton specialistId={sp.id} variant="outline" size="lg" />}
                <ShareButton title={`${sp.user.name} — ${sp.title}`} url={shortUrl ?? undefined} variant="outline" size="lg" iconOnly />
              </div>
              {!isOwner && !inactive && (
                <div className="mt-2.5 flex justify-center">
                  <CompareButton item={compareItem} variant="chip" />
                </div>
              )}
              {!showOwnerCta && inactive && <p className="mt-2.5 text-center text-[12px] text-fg-3">{tr(til, PROFIL.subInactiveNote)}</p>}
              {!showOwnerCta && !inactive && responseLabel && !onVacation && sp.isAvailable && (
                <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[12px] text-fg-3">
                  <Clock3 size={12} /> {responseLabel}
                </p>
              )}
              {/* Halol muddat (#43): ta'tilda — qaytish sanasi bilan, band — bo'shagach ko'rib chiqadi */}
              {!showOwnerCta && !inactive && onVacation && (
                <p className="mt-2.5 text-center text-[12px] text-fg-3">
                  {sp.vacationUntil ? PROFIL.vacationNote[til](formatDate(sp.vacationUntil)) : tr(til, PROFIL.vacationNoteNoDate)}
                </p>
              )}
              {!showOwnerCta && !inactive && !onVacation && !sp.isAvailable && <p className="mt-2.5 text-center text-[12px] text-fg-3">{tr(til, PROFIL.busyNote)}</p>}

              {/* Bajarilgan buyurtmalar (D60) — faqat bor bo'lsa, yangi profilda "0 Buyurtma" chiqmasin */}
              <ul className={cn("mt-5 grid divide-x divide-line border-t border-line pt-4 text-center", completedOrders > 0 ? "grid-cols-4" : "grid-cols-3")}>
                <li>
                  {sp.reviewCount > 0 ? (
                    <p className="font-display text-[17px] font-semibold text-fg">{sp.rating.toFixed(1)}</p>
                  ) : (
                    // Sharhsiz profil — "Yangi" (E84): bo'sh reyting o'rniga
                    <p className="flex h-[25.5px] items-center justify-center">
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-semibold text-accent-text">{tr(til, PROFIL.statNew)}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-fg-3">{tr(til, PROFIL.statRating)}</p>
                </li>
                <li>
                  <p className="font-display text-[17px] font-semibold text-fg">{sp.reviewCount}</p>
                  <p className="text-[11px] text-fg-3">{tr(til, PROFIL.statReviews)}</p>
                </li>
                <li>
                  <p className="font-display text-[17px] font-semibold text-fg">{sp.portfolio.length}</p>
                  <p className="text-[11px] text-fg-3">{tr(til, PROFIL.statWorks)}</p>
                </li>
                {completedOrders > 0 && (
                  <li title={tr(til, PROFIL.completedOrdersHint)}>
                    <p className="font-display text-[17px] font-semibold text-fg">{completedOrders}</p>
                    <p className="text-[11px] text-fg-3">{tr(til, PROFIL.statOrders)}</p>
                  </li>
                )}
              </ul>

              {shortUrl && shortDisplay && (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-4">{tr(til, PROFIL.shortLink)}</p>
                  <ShortLink url={shortUrl} display={shortDisplay} vcardHref={`/api/vcard/${raw.slug}`} />
                </div>
              )}

              {!isOwner && !previewMode && (
                <ReportButton targetType="specialist" targetId={raw.id} loggedIn={Boolean(viewer)} loginHref={loginHref} align="center" className="mt-3" />
              )}
            </div>

            {showOwnerCta && (
              <div className="card-outline p-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                  <EyeOff size={14} className="text-fg-3" /> {tr(til, PROFIL.privacy)}
                </p>
                <p className="mt-1 text-[12px] leading-snug text-fg-3">
                  {hiddenForGuests > 0 ? PROFIL.hiddenFields[til](hiddenForGuests) : tr(til, PROFIL.allOpen)} {tr(til, PROFIL.checkAs)}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {PREVIEW_MODES.map((m) => (
                    <Link key={m} href={`${profilePath}?preview=${m}`} className="inline-flex h-8 items-center rounded-full border border-line px-3 text-[12px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg" scroll={false}>
                      {tr(til, PROFIL.previewModes[m].label)}
                    </Link>
                  ))}
                  <Link href="/kabinet/profil#maxfiylik" className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-accent transition hover:bg-accent-soft">
                    {tr(til, PROFIL.configure)} <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}

            {contactsLocked ? (
              <LockedContacts />
            ) : (
              <ContactPanel
                contacts={{ telegram: sp.telegram, instagram: sp.instagram, youtube: sp.youtube, website: sp.website, phone: sp.user.phone, email: sp.user.email }}
                locked={sp.locked}
                loginHref={loginHref}
                orderHref={orderLink}
              />
            )}
          </div>
        </aside>
      </div>

      {/* ================= O'XSHASH ================= */}
      {similar.length > 0 && (
        <section className="mt-16 sm:mt-24">
          <SectionHeading
            eyebrow={tr(til, PROFIL.similarEyebrow)}
            title={
              <>
                {tr(til, PROFIL.similarTitleStart)} <span className="accent-serif text-accent">{tr(til, PROFIL.similarTitleAccent)}</span>
              </>
            }
            description={PROFIL.similarDesc[til](cat ? cat.plural : tr(til, PROFIL.similarDescCatFallback), region ? region.short : tr(til, PROFIL.similarDescRegionFallback))}
            action={
              <ButtonLink href={`/mutaxassislar?category=${sp.category}`} variant="outline" size="sm">
                {tr(til, PROFIL.seeAll)} <ArrowRight size={14} />
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
                        <span className="truncate font-display text-[12px] font-semibold text-fg">{priceRangeLabel(til, s.priceFrom, s.priceTo)}</span>
                        <span
                          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-fg-2"
                          aria-label={s.rating > 0 ? PROFIL.ratingAria[til](s.rating.toFixed(1)) : tr(til, PROFIL.notRatedAria)}
                        >
                          <Star size={11} className={s.rating > 0 ? "fill-accent-3 text-accent-3" : "text-fg-4"} />
                          {s.rating > 0 ? s.rating.toFixed(1) : <span className="font-medium text-fg-3">{tr(til, PROFIL.notRatedShort)}</span>}
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
      {/* Pastki tab-bar (bottom-3 + safe-area + ~64px balandlik) ustida kamida 6px oraliq: 82px + safe-area */}
      <div
        data-sticky-cta
        className="card-elevated fixed inset-x-3 bottom-[calc(5.125rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2.5 !rounded-[22px] px-4 py-2.5 md:bottom-[calc(1rem+env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-fg-4">{tr(til, PROFIL.priceEyebrow)}</p>
          {/* Qisqa "… dan" ko'rinishi + kichikroq shrift — narx hech qachon qirqilmaydi */}
          <p className="font-display text-[13.5px] font-semibold leading-tight text-fg">
            {priceCompact}
            {priceUsd && <span className="ml-1.5 font-sans text-[10.5px] font-medium text-fg-3">{priceUsd}</span>}
          </p>
        </div>
        {/* Ichki chat: egadan boshqa hammaga; mehmon login orqali qaytadi */}
        {!isOwner && sp.user.username && (
          <Link
            href={viewer ? `/yozish/${sp.user.username}` : `/auth/kirish?next=${encodeURIComponent(`/yozish/${sp.user.username}`)}`}
            aria-label={tr(til, PROFIL.write)}
            title={tr(til, PROFIL.write)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-fg transition hover:border-fg active:scale-95"
          >
            <MessageCircle size={18} />
          </Link>
        )}
        {showOwnerCta ? (
          <ButtonLink href="/kabinet/profil" size="md" className="shrink-0">
            <Settings size={16} /> {tr(til, PROFIL.editShort)}
          </ButtonLink>
        ) : orderLink ? (
          <ButtonLink href={orderLink} variant="accent" size="md" className="shrink-0">
            <span className="sm:hidden">{tr(til, PROFIL.orderMobile)}</span>
            <span className="hidden sm:inline">{tr(til, PROFIL.order)}</span> <ArrowRight size={16} />
          </ButtonLink>
        ) : (
          <span className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-surface-3 px-4 text-[12.5px] font-semibold text-fg-2">
            <PauseCircle size={15} aria-hidden="true" /> {tr(til, PROFIL.notAcceptingShort)}
          </span>
        )}
      </div>

      {/* Taqqoslash paneli (F54) — telefonda pastki CTA paneli ustida */}
      <CompareTray aboveCta />
    </div>
  );
}
