import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createHash } from "node:crypto";
import {
  MessageCircle,
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Award,
  BadgeCheck,
  Briefcase,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  Lock,
  MapPin,
  PackageCheck,
  PauseCircle,
  Repeat2,
  Settings,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { Avatar, ButtonLink, Stars, VerifiedBadge } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ContactPanel } from "@/components/specialists/ContactPanel";
import { ContactUnlockCard } from "@/components/contacts/ContactUnlockCard";
import { contactPriceFor, hasContactUnlock } from "@/lib/contacts/unlock";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { Highlights } from "@/components/stories/Highlights";
import { ReviewForm } from "@/components/specialists/ReviewForm";
import { ReviewList, ReviewSummary } from "@/components/specialists/ReviewList";
import { CoverImage } from "@/components/specialists/CoverImage";
import { FavoriteButton } from "@/components/specialists/FavoriteButton";
import { SchedulePanel } from "@/components/specialists/SchedulePanel";
import { ShareButton } from "@/components/specialists/ShareButton";
import { FollowButton } from "@/components/groups/FollowButton";
import { StickyCta } from "@/components/ui/StickyCta";
import { ReportButton } from "@/components/specialists/ReportButton";
import { BlockButton } from "@/components/specialists/BlockButton";
import { FollowersDialog } from "@/components/groups/FollowersDialog";
import { TAJRIBA } from "@/lib/i18n/dict/profile";
import { blockState } from "@/lib/privacy/blocks";
import { PackagesTable } from "@/components/specialists/PackagesTable";
import { RateCalculator } from "@/components/specialists/RateCalculator";
import { ShortLink } from "@/components/specialists/ShortLink";
import { CompareButton } from "@/components/specialists/CompareButton";
import { CompareTray } from "@/components/specialists/CompareTray";
import { SkillChips } from "@/components/specialists/SkillChips";
import { RecentViewRecorder, RecentlyViewed } from "@/components/specialists/RecentlyViewed";
import { ReviewSort, parseReviewSort } from "@/components/specialists/ReviewSort";
import { Completeness } from "@/components/profile/Completeness";
import { Handle } from "@/components/profile/Handle";
import { ProfileGroups } from "@/components/profile/ProfileGroups";
import { Timeline } from "@/components/profile/Timeline";
import { profileCompleteness } from "@/lib/profile/completeness";
import { listPublicGroupsOf } from "@/lib/profile/groups";
import { getCurrentUser } from "@/lib/auth";
import { followState } from "@/lib/groups/service";
import { getProfilePostView, listProfilePosts, profilePostCounts } from "@/lib/profile/posts";
import { listHighlights, storyArchive } from "@/lib/social/instagram";
import { CATEGORY_BY_SLUG, EXPERIENCE_LEVELS, GENDERS, PROFILE_CROSS_LINKS, PROFILE_HIRING, REGION_BY_SLUG, SITE, TOP_RATED_RULE, WORK_TYPE_BY_SLUG } from "@/lib/constants";
import { tr } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { KARTA, experienceLabel, genderPersonLabel, localizePrice, priceFromLabel, priceRangeLabel, workTypeLabel } from "@/lib/i18n/dict/catalog";
import { FAOLLIK, PROFIL, PROFIL_X, TIL_NOMI } from "@/lib/i18n/dict/profile";
import { getSettings } from "@/lib/payments/settings";
import { GUEST_VIEWER, effectivePriceFrom, filterSpecialistForViewer, isBotUserAgent, isOnVacation, lockReason, resolveVisibility, type Viewer } from "@/lib/privacy";
import { forwardedHost, forwardedProto, trustedSiteOrigin } from "@/lib/security/request";
import { subscriptionState } from "@/lib/subscriptions/access";
import {
  countRecentProfileViews,
  ensureShortCode,
  getReviewVotes,
  getSimilarSpecialists,
  getSocialProof,
  getSpecialistBySlug,
  getVerifiedReviewerIds,
  hasAcceptedOrderWith,
  hasCompletedOrderWith,
  ratingDistribution,
  recordProfileView,
  responseTimeLabel,
} from "@/lib/queries";
import { activityBucket, cn, formatDate, formatNumber, formatPrice, formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Egasi uchun "boshqalar ko'zi bilan" rejimlari (yorliq/izoh — PROFIL.previewModes lug'atida) */
const PREVIEW_MODES = ["guest", "client", "order"] as const;
type PreviewMode = (typeof PREVIEW_MODES)[number];

type Params = Promise<{ slug: string }>;
type Search = Promise<{ preview?: string; tab?: string; post?: string; ish?: string; sharh?: string }>;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const [{ slug }, spq] = await Promise.all([params, searchParams]);
  const [raw, settings, til] = await Promise.all([getSpecialistBySlug(slug), getSettings(), getLocale()]);
  if (!raw) return { title: "Mutaxassis topilmadi" };
  // Metadata — mehmon ko'rinishi (shahar yashirin bo'lsa hudud markazi)
  const sp = filterSpecialistForViewer(raw, GUEST_VIEWER);
  // Obunasi tugagan profil katalogdan yashirin — qidiruv tizimlari ham indekslamasin
  const inactive = subscriptionState(raw, settings).status === "expired";
  const region = REGION_BY_SLUG[sp.regionSlug];
  // Sarlavha oxiridagi "." / "!" olib tashlanadi — " · Kasb Egalari" shablonidan oldin ortiqcha tinish belgisi qolmasin
  const jobTitle = sp.title.trim().replace(/[.!]+$/, "");
  // ?tab= varianti sarlavhada ko'rinadi ("… · Videolar"); ?tab/?post/?ish/?sharh variantlari dublikat — indekslanmaydi, kanonik asosiy sahifa
  const tabKey = spq.tab === "videolar" || spq.tab === "ishlar" || spq.tab === "postlar" ? spq.tab : null;
  const variant = Boolean(tabKey || spq.post || spq.ish || spq.sharh);
  const title = `${sp.user.name} — ${jobTitle}${tabKey ? ` · ${tr(til, PROFIL_X.tabMetaSuffix[tabKey])}` : ""}`;
  // Tavsif — bio kesmasi emas, tuzilgan matn (bo'lmagan qismlar tushib qoladi)
  const metaPlace = [region?.name, sp.city].filter(Boolean).join(", ");
  const metaPrice = effectivePriceFrom(raw);
  const description = [
    `«${jobTitle}» — ${sp.user.name}.`,
    metaPlace ? `${metaPlace}.` : null,
    PROFILE_HIRING && metaPrice > 0 ? `Narx ${formatPrice(metaPrice, { compact: true })} dan.` : null,
    `Portfolio va sharhlar — ${SITE.name}'da.`,
  ]
    .filter(Boolean)
    .join(" ");
  // OG rasm — shu segmentdagi opengraph-image.tsx (ism, kasb, hudud, reyting; mehmon ma'lumoti)
  return {
    title,
    other: { "m-title": sp.user.name },
    description,
    alternates: { canonical: `/mutaxassislar/${sp.slug}` },
    openGraph: { title: `${title} · ${SITE.name}`, description, type: "profile", url: `/mutaxassislar/${sp.slug}` },
    twitter: { card: "summary_large_image", title: `${title} · ${SITE.name}`, description },
    ...(inactive ? { robots: { index: false, follow: false } } : variant ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Ism: oxirgi so'z + tasdiq belgisi bitta "bo'linmas" bo'lakda — belgi yolg'iz qatorga tushmaydi */
/** Muqovadagi yo'nalish belgisi: havola faqat PROFILE_CROSS_LINKS yoqilganda (aks holda tashrif buyuruvchi katalogga ketmasin) */
function CatChip({ href, children }: { href: string | null; children: React.ReactNode }) {
  const cls = "inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[12px] font-semibold text-ink-fg";
  return href ? (
    <Link href={href} className={cn(cls, "transition hover:brightness-110")}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}

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
  const [{ slug }, { preview, tab, post: postParam, ish: ishParam, sharh }] = await Promise.all([params, searchParams]);
  const raw = await getSpecialistBySlug(slug);
  if (!raw) notFound();

  const [viewer, hdrs, settings, til] = await Promise.all([getCurrentUser(), headers(), getSettings(), getLocale()]);
  const isOwner = Boolean(viewer && viewer.id === raw.userId);
  // Obuna (follow) holati — jamoalar moduli; egasining o'ziga ko'rsatilmaydi
  const follow = await followState(viewer?.id ?? null, raw.userId);
  // Blok (ikki yo'nalish): yozish/obuna tugmalari yashirin; bloklash tugmasi — shikoyat yonida
  const blocked = viewer && !isOwner ? await blockState(viewer.id, raw.userId) : { byMe: false, me: false };
  const blockedAny = blocked.byMe || blocked.me;
  const isAdmin = viewer?.role === "admin";

  // ?preview= faqat egasi uchun: profil boshqalarga qanday ko'rinishini simulyatsiya qiladi
  const previewMode: PreviewMode | null = isOwner && PREVIEW_MODES.some((m) => m === preview) ? (preview as PreviewMode) : null;

  // hasOrder — maxfiylik darajalari ("orders") uchun: qabul qilingan/jarayonda/bajarilgan buyurtma yetarli.
  // hasDoneOrder — sharh huquqi uchun: faqat YAKUNLANGAN (done) buyurtma (server ham shuni tekshiradi).
  const [hasOrder, hasDoneOrder, contactUnlocked] =
    viewer && !isOwner ? await Promise.all([hasAcceptedOrderWith(viewer.id, raw.id), hasCompletedOrderWith(viewer.id, raw.id), hasContactUnlock(viewer.id, raw.id)]) : [false, false, false];
  const effectiveViewer: Viewer = previewMode
    ? previewMode === "guest"
      ? { userId: null }
      : { userId: viewer!.id, role: "client", hasOrder: previewMode === "order" }
    : { userId: viewer?.id ?? null, role: viewer?.role ?? null, isOwner, hasOrder, contactUnlocked };
  // KONTAKT SOTILADI (2026-10-31): contactMode="paid" — mijoz/boshqa mutaxassis platformaga to'lab kontaktni ochadi;
  // "hidden" — faqat portfolio (kontakt umuman sotilmaydi). Egasi/admin uchun karta chiqmaydi (ular kontaktni ko'radi).
  const contactPrice = contactPriceFor(raw, settings);
  const showContactUnlock = !PROFILE_HIRING && raw.contactMode === "paid" && !isOwner && !isAdmin && !contactUnlocked && !blockedAny;
  const showUnlockedContacts = !PROFILE_HIRING && !previewMode && contactUnlocked && !isOwner;

  const sp = filterSpecialistForViewer(raw, effectiveViewer);
  const vis = resolveVisibility(raw.visibility);

  // Profil lentasi (Instagram uslubi): shaxsiy postlar, sonlar va ?post=<id> bilan ochiladigan post
  const feedViewer = viewer ? { id: viewer.id, role: viewer.role } : null;
  const [profilePosts, postCounts, openPost, highlights] = await Promise.all([
    listProfilePosts(raw.userId, feedViewer, { limit: 18 }),
    profilePostCounts(raw.userId),
    typeof postParam === "string" && postParam ? getProfilePostView(postParam, feedViewer, raw.userId) : Promise.resolve(null),
    listHighlights(raw.userId).catch(() => []),
  ]);
  // Highlights'ga story qo'shish uchun arxiv — faqat egasiga
  const archive = viewer?.id === raw.userId ? await storyArchive(raw.userId, 40).catch(() => []) : [];
  // ?ish=<id> — portfolio ishi oynada ochiladi (qidiruvdan chuqur havola); ?post= topilmasa — ProfileTabs bildirishnoma ko'rsatadi
  const openWork = typeof ishParam === "string" && ishParam ? (raw.portfolio.find((p) => p.id === ishParam) ?? null) : null;
  const missingPost = Boolean(typeof postParam === "string" && postParam && !openPost);
  const feedTab = tab === "videolar" || tab === "ishlar" || tab === "postlar" ? tab : openWork ? (openWork.type === "video" ? "videolar" : "ishlar") : openPost || postCounts.posts > 0 ? "postlar" : "ishlar";

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
  const qrHref = shortCode ? `/u/${shortCode.toUpperCase()}/qr?yuklab=1` : undefined;
  // O'xshashlar — umumiy ko'ruvchi konteksti: isOwner/hasOrder faqat SHU profilga nisbatan, boshqa profillarga o'tkazilmaydi
  const [similar, proof, verifiedIds, publicGroups, votes, views7] = await Promise.all([
    PROFILE_CROSS_LINKS ? getSimilarSpecialists(raw, 4, { userId: effectiveViewer.userId, role: effectiveViewer.role }) : Promise.resolve([] as Awaited<ReturnType<typeof getSimilarSpecialists>>),
    getSocialProof(raw.id, raw.completedCount),
    getVerifiedReviewerIds(raw.id),
    listPublicGroupsOf(raw.userId).catch(() => []),
    getReviewVotes(
      raw.reviews.map((r) => r.id),
      viewer?.id ?? null,
    ).catch(() => new Map<string, { n: number; mine: boolean }>()),
    isOwner ? countRecentProfileViews(raw.id).catch(() => 0) : Promise.resolve(0),
  ]);
  const completedOrders = proof.completed;

  // Ko'rishlar soni — kunlik noyob (profile_views): egasi (shu jumladan preview) va botlar hisoblanmaydi; natijani kutmaymiz.
  // Ko'ruvchi kaliti: kirgan — u:<id>; mehmon — IP+UA xeshi (shaxsiy ma'lumot saqlanmaydi)
  if (!isOwner && !isBotUserAgent(hdrs.get("user-agent"))) {
    const ip = (hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "").split(",")[0].trim();
    const viewerKey = viewer ? `u:${viewer.id}` : `a:${createHash("sha256").update(`${ip}|${hdrs.get("user-agent") ?? ""}`).digest("hex").slice(0, 24)}`;
    try {
      void recordProfileView(raw.id, viewerKey).catch(() => {});
    } catch {
      /* noop */
    }
  }

  const myReview = viewer ? raw.reviews.find((r) => r.authorId === viewer.id) : null;
  // Sharhlar saralash (?sharh=yangi|yuqori|past|foydali) — standart: yangi
  const reviewSort = parseReviewSort(sharh);
  const sortedReviews = [...raw.reviews].sort((a, b) => {
    const byDate = b.createdAt.getTime() - a.createdAt.getTime();
    if (reviewSort === "yuqori") return b.rating - a.rating || byDate;
    if (reviewSort === "past") return a.rating - b.rating || byDate;
    if (reviewSort === "foydali") return (votes.get(b.id)?.n ?? 0) - (votes.get(a.id)?.n ?? 0) || byDate;
    return byDate;
  });
  // «Profil to'liqligi» — faqat egasiga
  const completeness = isOwner
    ? profileCompleteness({
        avatarUrl: raw.user.avatarUrl,
        coverUrl: raw.coverUrl,
        bio: raw.bio,
        skills: raw.skills,
        portfolioCount: raw.portfolio.length,
        workHistory: raw.workHistory,
        education: raw.education,
        languages: raw.languages,
        workTypes: raw.workTypes,
        priceFrom: raw.priceFrom,
        certificates: raw.certificates,
        postsCount: postCounts.posts,
      })
    : null;
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
  const coverSrc = sp.coverUrl ?? sp.portfolio.find((p) => p.thumbnailUrl)?.thumbnailUrl ?? null;
  const hasCover = Boolean(coverSrc);
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

  // Meta — bitta tinch qator («·» bilan): tajriba · (jins) · tillar · ko'rishlar · a'zolik yili
  const metaParts: string[] = [experience, languages, PROFIL_X.metaViews[til](views), PROFIL_X.metaSince[til](formatDate(sp.user.createdAt).slice(-4))];
  if (genderLabel) metaParts.splice(1, 0, genderLabel);

  // Ijtimoiy isbot (E86/F12/F68): faqat bor ko'rsatkichlar — yangi profilda "0 ta" chiqmaydi
  const responseLabel = responseTimeLabel(proof.responseHours, til);
  const activity = activityBucket(raw.user.lastLoginAt);
  const proofChips: Array<{ icon: typeof Briefcase; text: string; title?: string }> = [];
  if (PROFILE_HIRING && proof.completed > 0) proofChips.push({ icon: PackageCheck, text: PROFIL.completedOrders[til](proof.completed), title: tr(til, PROFIL.completedOrdersHint) });
  if (PROFILE_HIRING && proof.repeatClients > 0) proofChips.push({ icon: Repeat2, text: PROFIL.repeatClients[til](proof.repeatClients), title: tr(til, PROFIL.repeatClientsHint) });
  if (responseLabel) proofChips.push({ icon: Clock3, text: responseLabel, title: tr(til, PROFIL.responseHint) });
  if (activity) proofChips.push({ icon: Activity, text: PROFIL.lastActivity[til](tr(til, FAOLLIK[activity])) });
  const verifiedSet = new Set(verifiedIds);

  /** Ichki chat: mutaxassisga to'g'ridan-to'g'ri yozish (kirmaganlar login orqali qaytadi) */
  const chatCta =
    !showOwnerCta && sp.user.username && !blockedAny ? (
      <ButtonLink href={`/yozish/${sp.user.username}`} variant="outline" size="lg" className="w-full">
        <MessageCircle size={17} /> {tr(til, PROFIL.write)}
      </ButtonLink>
    ) : null;
  const cta = showOwnerCta ? (
    <ButtonLink href="/kabinet/profil" size="lg" className="w-full">
      <Settings size={18} /> {tr(til, PROFIL.editProfile)}
    </ButtonLink>
  ) : !PROFILE_HIRING ? (
    // Yollash bloklari yashirin: kontaktni ochish (platformaga to'lov) + ichki chat
    <div className="flex w-full flex-col gap-2.5">{chatCta}</div>
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
    <div className={cn("container-x", PROFILE_HIRING ? "pb-24 lg:pb-0" : "pb-10")}>
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

      {PROFILE_CROSS_LINKS && (
        <>
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
        </>
      )}

      {/* ================= HERO ================= */}
      <section className="card animate-fade-up m-flat overflow-hidden !rounded-[var(--r-lg)] max-sm:!rounded-none">
        {/* Balandlik 4:1 nisbatdan — kesish oynasida (ImageCropper) moslangan muqova qayta kesilmasin */}
        <div className={cn("relative overflow-hidden bg-surface-2", hasCover ? "h-36 sm:h-auto sm:max-h-[260px] sm:aspect-[4/1]" : "h-20 sm:h-24")}>
          {/* Rasm bo'lmasa: tinch yuza + yo'nalish rangida nozik nur (rang-barang gradient o'rniga) */}
          <div
            className="absolute inset-0 opacity-70 dark:opacity-50"
            style={{ background: "var(--surface-3)" }}
          />
          {/* Muqova yo'q bo'lsa — birinchi portfolio ishining muqovasi (kabinetdagi "Birinchi ish muqovada ko'rinadi"), u ham bo'lmasa naqsh */}
          {hasCover && <CoverImage src={coverSrc} category={sp.category} seed={sp.slug} priority />}

          <span
            className={cn(
              "absolute right-4 top-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold sm:right-6 sm:top-6",
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
            <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={96} className="!ring-4 !ring-surface text-[32px]" />
            <div className="min-w-0 flex-1 sm:pt-14">
              <h1 className="break-words font-display text-[26px] font-semibold leading-[1.1] tracking-tight text-fg sm:text-[32px]">
                <NameWithBadge name={sp.user.name} verified={sp.isVerified} verifiedTitle={tr(til, PROFIL.verifiedPerson)} />
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[16px] text-fg-2 sm:text-[17px]">
                <span>{sp.title}{cat ? <span className="text-fg-3"> · {cat.name}</span> : null}</span>
                {/* «Top» va «Tanlangan» — muqovadagi pill'lar o'rniga kasb yonida kichik belgi */}
                {sp.topRated && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-fg" title={KARTA.topHint[til](TOP_RATED_RULE.minRating, TOP_RATED_RULE.minReviews)}>
                    <Award size={13} className="text-accent" aria-hidden /> {tr(til, PROFIL.topSpecialist)}
                  </span>
                )}
                {sp.isFeatured && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-fg-2">
                    <Sparkles size={13} className="text-accent" aria-hidden /> {tr(til, PROFIL.featured)}
                  </span>
                )}
              </p>
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
                <li key={m.text} title={m.title} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[12px] font-medium text-fg-2">
                  <m.icon size={13} className="text-fg-3" aria-hidden />
                  {m.text}
                </li>
              ))}
            </ul>
          )}

          {/* Telefon/planshet: Instagram uslubidagi statistika (Ishlar · Obunachi · Obuna) — desktopda yon panelda */}
          <FollowersDialog
            userId={raw.userId}
            followers={follow.followersCount}
            following={follow.followingCount}
            loggedIn={Boolean(viewer)}
            viewerId={viewer?.id ?? null}
            variant="stats"
            extraStats={[{ value: sp.portfolio.length, label: til === "ru" ? "работ" : "ish" }]}
            className="mt-5 lg:hidden"
          />

          <ul className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", proofChips.length > 0 ? "mt-3" : "mt-5")}>
            <li className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-3">
              {sp.user.username && <Handle username={sp.user.username} />}
              <span className="min-w-0">{metaParts.join(" · ")}</span>
            </li>
            {showContactUnlock && (
              <li className="w-full lg:hidden">
                <ContactUnlockCard variant="button" specialistId={raw.id} price={contactPrice} loggedIn={Boolean(viewer)} loginHref={loginHref} />
              </li>
            )}
            <li id="profil-amallar" className="grid w-full grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto] items-center gap-2 lg:hidden">
              {PROFILE_HIRING && !isOwner && !inactive && <CompareButton item={compareItem} variant="ghost" className="border border-line-2" />}
              {!isOwner && !blockedAny && (
                <div className="min-w-0 [&>button]:w-full [&>button]:px-3">
                  <FollowButton userId={raw.userId} initialFollowing={follow.following} initialCount={follow.followersCount} loggedIn={Boolean(viewer)} size="md" showCount={false} showBell initialNotifyLevel={follow.notifyLevel} />
                </div>
              )}
              {!PROFILE_HIRING && !isOwner && sp.user.username && !blockedAny && (
                <ButtonLink href={viewer ? `/yozish/${sp.user.username}` : `/auth/kirish?next=${encodeURIComponent(`/yozish/${sp.user.username}`)}`} variant="outline" size="md" className="min-w-0 !px-3">
                  <MessageCircle size={15} className="max-[380px]:hidden" /> {tr(til, PROFIL.write)}
                </ButtonLink>
              )}
              {!isOwner && <FavoriteButton specialistId={sp.id} variant="outline" size="md" />}
              <ShareButton title={`${sp.user.name} — ${sp.title}`} url={shortUrl ?? undefined} qrDownloadHref={qrHref} size="md" variant="outline" iconOnly />
            </li>
          </ul>
        </div>
      </section>

      {/* Profil to'liqligi — egasiga, telefon/planshetda (desktopda yon panelda) */}
      {showOwnerCta && completeness && (
        <div className="mt-6 lg:hidden">
          <Completeness data={completeness} til={til} />
        </div>
      )}

      {/* ================= OBUNA FAOL EMAS (tashrif buyuruvchilar) ================= */}
      {PROFILE_HIRING && inactive && !showOwnerCta && (
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
          <section className="card m-flat animate-fade-up p-5 sm:p-7" style={{ animationDelay: "80ms" }}>
            <h2 className="font-display text-[20px] font-semibold tracking-tight text-fg">
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
                {/* Har bir ko'nikma — shu ko'nikmali mutaxassislar ro'yxatiga (F50); 8 tadan ko'pi «+N» ostida */}
                <SkillChips skills={sp.skills} max={8} size="md" className="mt-3" />
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
          {PROFILE_HIRING && sp.packages.length > 0 && (
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
          {showContactUnlock && <ContactUnlockCard className="lg:hidden" specialistId={raw.id} price={contactPrice} loggedIn={Boolean(viewer)} loginHref={loginHref} />}
          {showUnlockedContacts && (
            <ContactPanel className="lg:hidden" contacts={{ telegram: sp.telegram, instagram: sp.instagram, youtube: sp.youtube, website: sp.website, phone: sp.user.phone, email: sp.user.email }} locked={sp.locked} loginHref={loginHref} orderHref={null} />
          )}
          {!PROFILE_HIRING ? null : contactsLocked ? (
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
              <ShortLink url={shortUrl} display={shortDisplay} vcardHref={PROFILE_HIRING ? `/api/vcard/${raw.slug}` : undefined} />
            </section>
          )}

          {/* Narx kalkulyatori (F70) */}
          {PROFILE_HIRING && (sp.rates.hourly || sp.rates.daily || sp.rates.project || sp.rates.unit) && <RateCalculator rates={sp.rates} urgentPct={settings.urgentPct} usdRate={settings.usdRate} className="animate-fade-up" />}

          {/* Ish vaqti + band kunlar (F41) — faqat yollash rejimida */}
          {PROFILE_HIRING && (
            <SchedulePanel
              schedule={sp.schedule}
              vacationUntil={sp.vacationUntil}
              lock={raw.schedule ? scheduleLock : null}
              loginHref={loginHref}
              blockedDates={sp.blockedDates}
              className="animate-fade-up"
            />
          )}

          {/* Highlights: doimiy story to'plamlari (profil lentasidan yuqorida) */}
          {(highlights.length > 0 || isOwner) && (
            <section className="animate-fade-up" style={{ animationDelay: "120ms" }} aria-label="Story to'plamlari">
              <Highlights initial={highlights} canManage={isOwner} archive={isOwner ? archive : undefined} />
            </section>
          )}

          {/* Profil lentasi (Instagram uslubi): Postlar / Videolar / Ishlar — portfolio shu yerda; id="portfolio" eski havolalar uchun saqlanadi */}
          <section className="animate-fade-up scroll-mt-28" style={{ animationDelay: "140ms" }} id="portfolio" aria-label={til === "ru" ? "Лента профиля" : "Profil lentasi"}>
            <ProfileTabs
              til={til}
              slug={sp.slug}
              userId={raw.userId}
              name={sp.user.name}
              avatarUrl={sp.user.avatarUrl}
              isOwner={isOwner}
              loggedIn={Boolean(viewer)}
              isAdmin={isAdmin}
              viewerId={viewer?.id ?? null}
              counts={{ posts: postCounts.posts, videos: postCounts.videos, works: sp.portfolio.length }}
              initialPosts={profilePosts}
              openPost={openPost}
              openWork={openWork ? { id: openWork.id, title: openWork.title, type: openWork.type, url: openWork.url, thumbnailUrl: openWork.thumbnailUrl, description: openWork.description, tags: openWork.tags, beforeUrl: openWork.beforeUrl } : null}
              missingPost={missingPost}
              initialTab={feedTab}
              works={sp.portfolio.map((p) => ({
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

          {/* «Yo'l»: ish tajribasi + ta'lim bitta xronologik chiziqda; «Jamoalari» — ochiq jamoa/kanallar */}
          <Timeline work={raw.workHistory} education={raw.education} til={til} className="animate-fade-up" />
          <ProfileGroups groups={publicGroups} til={til} className="animate-fade-up" />

          {/* Sertifikatlar va litsenziyalar (F64) */}
          {sp.certificates.length > 0 && (
            <section className="card m-flat animate-fade-up p-5 sm:p-7" aria-labelledby="sertifikatlar-title">
              <h2 id="sertifikatlar-title" className="font-display text-[20px] font-semibold tracking-tight text-fg">
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

          {/* Sharhlar */}
          <section className="animate-fade-up scroll-mt-28" style={{ animationDelay: "200ms" }} id="sharhlar">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
              <h2 className="font-display text-[20px] font-semibold tracking-tight text-fg">
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
              {sp.reviewCount > 1 && <ReviewSort current={reviewSort} basePath={profilePath} til={til} />}
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
                votes={votes}
                loggedIn={Boolean(viewer)}
                loginHref={loginHref}
                reviews={sortedReviews.map((r) => ({
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
          {!isOwner && !previewMode && (
            <div className="flex flex-wrap items-center justify-center gap-2 lg:hidden">
              <ReportButton targetType="specialist" targetId={raw.id} loggedIn={Boolean(viewer)} loginHref={loginHref} align="center" />
              {viewer && <BlockButton userId={raw.userId} name={sp.user.name} initialBlocked={blocked.byMe} />}
            </div>
          )}
        </div>

        {/* O'ng ustun — yopishqoq (faqat desktop) */}
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="space-y-4 lg:sticky lg:top-28">
            <div className="card-elevated animate-fade-up p-5 sm:p-6" style={{ animationDelay: "60ms" }}>
              {PROFILE_HIRING ? (
                <>
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
                </>
              ) : null}

              {/* Kontakt sotuvi: alohida to'liq kenglikdagi tugma (amallar qatori tor — matn kesilmasin) */}
              {showContactUnlock && <ContactUnlockCard variant="button" specialistId={raw.id} price={contactPrice} loggedIn={Boolean(viewer)} loginHref={loginHref} className="mb-2.5" />}
              {/* Yollash yashirin: kasb/hudud hero'da — karta to'g'ridan-to'g'ri amallardan boshlanadi */}
              <div className={cn("flex items-stretch gap-2", PROFILE_HIRING && "mt-5")}>
                <div className="min-w-0 flex-1">{cta}</div>
                {!isOwner && !blockedAny && <FollowButton userId={raw.userId} initialFollowing={follow.following} initialCount={follow.followersCount} loggedIn={Boolean(viewer)} size="lg" compact />}
                {!isOwner && <FavoriteButton specialistId={sp.id} variant="outline" size="lg" />}
                <ShareButton title={`${sp.user.name} — ${sp.title}`} url={shortUrl ?? undefined} qrDownloadHref={qrHref} variant="outline" size="lg" iconOnly />
              </div>
              <FollowersDialog userId={raw.userId} followers={follow.followersCount} following={follow.followingCount} loggedIn={Boolean(viewer)} viewerId={viewer?.id ?? null} className="mt-3 justify-center" />
              {PROFILE_HIRING && !isOwner && !inactive && (
                <div className="mt-2.5 flex justify-center">
                  <CompareButton item={compareItem} variant="chip" />
                </div>
              )}
              {PROFILE_HIRING && !showOwnerCta && inactive && <p className="mt-2.5 text-center text-[12px] text-fg-3">{tr(til, PROFIL.subInactiveNote)}</p>}
              {!showOwnerCta && !inactive && responseLabel && !onVacation && sp.isAvailable && (
                <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[12px] text-fg-3">
                  <Clock3 size={12} /> {responseLabel}
                </p>
              )}
              {/* Halol muddat (#43): ta'tilda — qaytish sanasi bilan, band — bo'shagach ko'rib chiqadi */}
              {PROFILE_HIRING && !showOwnerCta && !inactive && onVacation && (
                <p className="mt-2.5 text-center text-[12px] text-fg-3">
                  {sp.vacationUntil ? PROFIL.vacationNote[til](formatDate(sp.vacationUntil)) : tr(til, PROFIL.vacationNoteNoDate)}
                </p>
              )}
              {PROFILE_HIRING && !showOwnerCta && !inactive && !onVacation && !sp.isAvailable && <p className="mt-2.5 text-center text-[12px] text-fg-3">{tr(til, PROFIL.busyNote)}</p>}

              {/* Reyting/sharh/ish statistikasi olib tashlandi — hero (reyting) va lenta tablari (ishlar) bilan dublikat edi */}
              {showOwnerCta && completeness && (
                <div className="mt-4 space-y-3 border-t border-line pt-4">
                  <Completeness data={completeness} til={til} />
                  <p className="flex items-center gap-1.5 text-[12px] text-fg-3" title={tr(til, PROFIL_X.views7Hint)}>
                    <Eye size={12} aria-hidden /> {PROFIL_X.views7[til](views7)}
                  </p>
                </div>
              )}

              {shortUrl && shortDisplay && (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-4">{tr(til, PROFIL.shortLink)}</p>
                  <ShortLink url={shortUrl} display={shortDisplay} vcardHref={PROFILE_HIRING ? `/api/vcard/${raw.slug}` : undefined} />
                </div>
              )}

              {!isOwner && !previewMode && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <ReportButton targetType="specialist" targetId={raw.id} loggedIn={Boolean(viewer)} loginHref={loginHref} align="center" />
                  {viewer && <BlockButton userId={raw.userId} name={sp.user.name} initialBlocked={blocked.byMe} />}
                </div>
              )}
            </div>

            {PROFILE_HIRING && showOwnerCta && (
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

            {showContactUnlock && <ContactUnlockCard specialistId={raw.id} price={contactPrice} loggedIn={Boolean(viewer)} loginHref={loginHref} />}
            {showUnlockedContacts && (
              <ContactPanel contacts={{ telegram: sp.telegram, instagram: sp.instagram, youtube: sp.youtube, website: sp.website, phone: sp.user.phone, email: sp.user.email }} locked={sp.locked} loginHref={loginHref} orderHref={null} />
            )}
            {!PROFILE_HIRING ? null : contactsLocked ? (
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
      {PROFILE_CROSS_LINKS && similar.length > 0 && (
        <section className="mt-14 sm:mt-20" aria-labelledby="oxshash-title">
          {/* Sarlavha + «Barchasi» — eyebrow va tavsifsiz (o'xshashlik endi ko'nikma/yo'nalish/hudud bo'yicha ballanadi) */}
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 id="oxshash-title" className="font-display text-[22px] font-semibold tracking-tight text-fg">
              {tr(til, PROFIL.similarTitleStart)} <span className="accent-serif text-accent">{tr(til, PROFIL.similarTitleAccent)}</span>
            </h2>
            <ButtonLink href={`/mutaxassislar?category=${sp.category}`} variant="outline" size="sm" className="shrink-0">
              {tr(til, PROFIL.seeAll)} <ArrowRight size={14} />
            </ButtonLink>
          </div>
          <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((s) => {
              const c = CATEGORY_BY_SLUG[s.category];
              return (
                <li key={s.id}>
                  <Link href={`/mutaxassislar/${s.slug}`} className="card hover-lift press flex h-full items-center gap-3 p-3.5">
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
                        <span className="truncate font-display text-[12px] font-semibold text-fg">{PROFILE_HIRING ? priceRangeLabel(til, s.priceFrom, s.priceTo) : (c?.name ?? "")}</span>
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
      {PROFILE_HIRING && (
      <div
        data-sticky-cta
        className="card-elevated fixed inset-x-3 bottom-[calc(5.125rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2.5 !rounded-[22px] px-4 py-2.5 md:bottom-[calc(1rem+env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4">{tr(til, PROFIL.priceEyebrow)}</p>
          {/* Qisqa "… dan" ko'rinishi + kichikroq shrift — narx hech qachon qirqilmaydi */}
          <p className="font-display text-[13.5px] font-semibold leading-tight text-fg">
            {priceCompact}
            {priceUsd && <span className="ml-1.5 font-sans text-[11px] font-medium text-fg-3">{priceUsd}</span>}
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
      )}

      {/* Yaqinda ko'rilganlar (localStorage): shu profil yoziladi (egasi bundan mustasno), boshqalari lenta bo'lib chiqadi */}
      {PROFILE_CROSS_LINKS && (
        <>
          <RecentViewRecorder item={{ slug: sp.slug, name: sp.user.name, title: sp.title, avatarUrl: sp.user.avatarUrl }} enabled={!isOwner} />
          <RecentlyViewed excludeSlug={sp.slug} className="mt-10" />
        </>
      )}

      {/* Taqqoslash paneli (F54) — telefonda pastki CTA paneli ustida */}
      <CompareTray aboveCta={PROFILE_HIRING} />
      {/* Telefon: profil pastga aylantirilganda yopishqoq «Yozish» (Instagram «Message» odati); amallar qatori ko'ringanda yashirinadi */}
      {!PROFILE_HIRING && !isOwner && !blockedAny && sp.user.username && (
        <StickyCta targetId="profil-amallar">
          <a
            href={viewer ? `/yozish/${sp.user.username}` : `/auth/kirish?next=${encodeURIComponent(`/yozish/${sp.user.username}`)}`}
            className="btn-ink press flex h-12 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold shadow-[var(--shadow-3)]"
          >
            <MessageCircle size={17} /> {tr(til, PROFIL.write)} · {sp.user.name.split(" ")[0]}
          </a>
        </StickyCta>
      )}
    </div>
  );
}
