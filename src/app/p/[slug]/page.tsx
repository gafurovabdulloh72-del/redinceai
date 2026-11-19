import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, MessageCircle, UserRound } from "lucide-react";
import { getSpecialistBySlug } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { canViewPrivateContent } from "@/lib/privacy/private-profile";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { SITE_URL } from "@/lib/site-url";
import { ShowcaseGrid, type ShowcaseItem } from "@/components/portfolio/ShowcaseGrid";
import { Wordmark } from "@/components/layout/Logo";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

/**
 * PORTFOLIO SAYT (2026-11-19, foydalanuvchi namunasi «Reels va video montaj.»): ijodkorning bitta ekranli vitrinasi —
 * qorong'u fon, katta sarlavha (oxirgi so'z marjon), tik (9:16) ishlar to'ri, pastda «Yozish». Ilova qobig'i yashirin
 * (`data-showcase`, globals.css). Ijodkor shu havolani mijozga Telegram kanali o'rniga yuboradi. Kontaktlar bu yerda
 * ham CHIQMAYDI (PROFILE_HIRING=false qoidasi) — aloqa sayt chati yoki profildagi «kontaktni olish» orqali.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const sp = await getSpecialistBySlug(slug);
  if (!sp) return { title: "Portfolio" };
  const name = sp.user.name;
  const desc = (sp.bio || `${sp.title} — ishlar to'plami`).replace(/\s+/g, " ").slice(0, 160);
  return {
    title: `${name} — portfolio`,
    description: desc,
    alternates: { canonical: `${SITE_URL}/p/${sp.slug}` },
    openGraph: { title: `${name} — ${sp.title}`, description: desc, url: `${SITE_URL}/p/${sp.slug}`, images: [`/mutaxassislar/${sp.slug}/opengraph-image`] },
    other: { "m-title": "Portfolio" },
  };
}

/** Uzun matnni so'z (iloji bo'lsa gap) chegarasida qisqartirish */
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const dot = cut.lastIndexOf(". ");
  if (dot > max * 0.6) return cut.slice(0, dot + 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:—–-]+$/, "")}…`;
}

/** «Video montajchi» → ["Video", "montajchi."] — oxirgi so'z marjon rangda */
function splitHeadline(s: string): [string, string] {
  const t = s.trim().replace(/[.!]+$/, "");
  const i = t.lastIndexOf(" ");
  return i > 0 ? [t.slice(0, i), `${t.slice(i + 1)}.`] : ["", `${t}.`];
}

export default async function ShowcasePage({ params }: { params: Params }) {
  const { slug } = await params;
  const sp = await getSpecialistBySlug(slug);
  if (!sp) notFound();
  const [viewer, til] = await Promise.all([getCurrentUser(), getLocale()]);
  const t = (uz: string, ru: string) => (til === "ru" ? ru : uz);
  const locked = !(await canViewPrivateContent(viewer ? { id: viewer.id, role: viewer.role } : null, { id: sp.userId, profilePrivate: sp.user.profilePrivate }));
  const isOwner = viewer?.id === sp.userId;

  const items: ShowcaseItem[] = locked
    ? []
    : [...sp.portfolio]
        // Videolar oldinda (vitrina — harakatdagi ishlar), keyin rasmlar; tartib ijodkor belgilaganicha
        .sort((a, b) => Number(b.type === "video") - Number(a.type === "video"))
        .map((p) => ({ id: p.id, title: p.title, type: p.type, url: p.url, thumbnailUrl: p.thumbnailUrl }));

  const category = CATEGORY_BY_SLUG[sp.category]?.name ?? "";
  const [head, accent] = splitHeadline(sp.title || category || t("Ishlarim", "Мои работы"));
  const sub = clip((sp.bio || "").replace(/\s+/g, " ").trim(), 220);
  const chatHref = sp.user.username ? `/yozish/${sp.user.username}` : `/mutaxassislar/${sp.slug}`;

  return (
    <div data-showcase data-theme="dark" className="min-h-dvh bg-[radial-gradient(120%_80%_at_20%_0%,#2a1a10_0%,#1a110b_45%,#120c08_100%)] text-[#f6f4ee]">
      <div className="mx-auto flex min-h-dvh max-w-[1500px] flex-col px-5 pb-10 pt-5 sm:px-8">
        {/* Yuqori qator: ism — chapda, platforma belgisi — o'ngda */}
        <header className="flex items-center justify-between gap-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70">
          <Link href={`/mutaxassislar/${sp.slug}`} className="truncate hover:text-white" data-no-auto>
            {sp.user.name}
          </Link>
          <Link href="/" className="shrink-0 normal-case tracking-normal opacity-70 hover:opacity-100" aria-label="Kasb Egalari">
            <Wordmark className="text-[15px]" />
          </Link>
        </header>

        <section className="mt-10 sm:mt-16">
          <h1 className="font-display text-[44px] font-bold leading-[1] tracking-[-0.045em] text-[#f6ebe0] sm:text-[72px] lg:text-[96px]" data-no-auto>
            {head && <>{head} </>}
            <span className="text-[#ff5a36]">{accent}</span>
          </h1>
          {sub && (
            <p className="mt-5 max-w-[520px] text-[14.5px] leading-relaxed text-[#f6ebe0]/65 sm:text-[17px]" data-no-auto>
              {sub}
            </p>
          )}
        </section>

        <section className="mt-8 flex-1 sm:mt-10" aria-label={t("Ishlar", "Работы")}>
          {locked ? (
            <div className="flex max-w-md items-center gap-3 rounded-[14px] border border-white/10 p-5 text-[14px] text-white/70">
              <Lock size={18} className="shrink-0" /> {t("Bu profil yopiq — ishlar faqat obunachilarga ko'rinadi.", "Профиль закрыт — работы видны только подписчикам.")}
            </div>
          ) : items.length === 0 ? (
            <div className="max-w-md rounded-[14px] border border-white/10 p-5 text-[14px] text-white/60">
              {isOwner ? (
                <>
                  {t("Hali ishlar qo'shilmagan.", "Работ пока нет.")}{" "}
                  <Link href="/kabinet/portfolio" className="font-semibold text-[#ff5a36] underline-offset-2 hover:underline">
                    {t("Ish qo'shish", "Добавить работу")}
                  </Link>
                </>
              ) : (
                t("Hali ishlar qo'shilmagan.", "Работ пока нет.")
              )}
            </div>
          ) : (
            <ShowcaseGrid items={items} />
          )}
        </section>

        {/* Pastki chaqiriq: aloqa sayt orqali (kontaktlar ochiq chiqmaydi) */}
        <footer className="mt-12 flex flex-wrap items-center gap-3 pt-2">
          <span className="mr-2 text-[15px] text-[#f6ebe0]/65 sm:text-[17px]">{isOwner ? t("Mijozlar shu sahifani ko'radi.", "Клиенты видят эту страницу.") : t("Ish buyurtma qilmoqchimisiz?", "Хотите заказать работу?")}</span>
          {!isOwner && (
            <Link href={chatHref} className="inline-flex h-12 items-center gap-2 rounded-full bg-[#ff5a36] px-6 text-[15px] font-bold text-[#1a110b] transition-[filter] hover:brightness-110">
              <MessageCircle size={16} /> {t("Yozish", "Написать")}
            </Link>
          )}
          <Link href={`/mutaxassislar/${sp.slug}`} className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-[#f6ebe0]/70 px-6 text-[15px] font-bold text-[#f6ebe0] transition-colors hover:border-[#f6ebe0]">
            <UserRound size={16} /> {t("To'liq profil", "Полный профиль")}
          </Link>
          <span className="w-full pt-6 text-[12px] text-white/30 sm:ml-auto sm:w-auto sm:pt-0">
            {t("Kasb Egalari'da yaratilgan", "Создано на Kasb Egalari")}
          </span>
        </footer>
      </div>
    </div>
  );
}
