import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ButtonLink, PageHeader } from "@/components/ui";
import { Link2 } from "lucide-react";
import { GroupForm } from "@/components/groups/GroupForm";
import { InviteLink } from "@/components/groups/InviteLink";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getGroupView } from "@/lib/groups/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Jamoa sozlamalari", robots: { index: false, follow: false } };

/** Jamoa sozlamalari — egasi yoki jamoa admini (sayt admini ham) */
export default async function GroupSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(`/jamoalar/${slug}/sozlash`));
  const view = await getGroupView(slug, { id: user.id, role: user.role });
  if (!view) notFound();
  if (!view.canManage) redirect(`/jamoalar/${slug}`);
  const isOwner = view.membership === "owner" || user.role === "admin";

  return (
    <div className="container-x animate-fade-up">
      <nav aria-label="Yo'l" className="mb-5 text-[13px] text-fg-3">
        <Link href="/jamoalar" className="transition hover:text-fg">
          Jamoalar
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/jamoalar/${view.slug}`} className="transition hover:text-fg">
          {view.name}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg-2">Sozlash</span>
      </nav>
      <PageHeader
        eyebrow="Jamoa sozlamalari"
        title={view.name}
        description={
          view.pendingCount > 0
            ? `${view.pendingCount} ta qo'shilish so'rovi kutmoqda — "A'zolar" bo'limida tasdiqlang yoki rad eting.`
            : "Nom, tavsif, yo'nalish va muqovani o'zgartiring. Yopiq rejimda yangi a'zolar faqat tasdiq bilan qo'shiladi."
        }
        action={
          <ButtonLink href={`/jamoalar/${view.slug}?tab=azolar`} variant="outline" size="md">
            {view.pendingCount > 0 ? `${view.pendingCount} ta so'rov` : "A'zolar"}
          </ButtonLink>
        }
      />
      <div className="mt-8 max-w-2xl">
        <GroupForm
          mode="edit"
          isOwner={isOwner}
          isSiteAdmin={user.role === "admin"}
          initial={{
            slug: view.slug,
            name: view.name,
            description: view.description,
            category: view.category,
            region: view.region,
            coverUrl: view.coverUrl,
            isPrivate: view.isPrivate,
            kind: view.kind,
            isOfficial: view.isOfficial,
          }}
        />
      </div>
      <section className="card mt-6 max-w-2xl p-5 sm:p-6" aria-labelledby="invite-h" data-reveal>
        <h2 id="invite-h" className="flex items-center gap-2 font-display text-[17px] font-semibold text-fg">
          <Link2 size={17} className="text-accent" /> Taklif havolasi
        </h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">
          {view.isPrivate
            ? "Havolani Telegram yoki Instagram'da ulashing — yopiq jamoaga havola orqali kelganlar tasdiqsiz, darhol a'zo bo'ladi. Havola tarqalib ketsa, «yangilash» bilan eskisini bekor qiling."
            : "Havolani Telegram yoki Instagram'da ulashing — do'stlaringiz bir bosishda qo'shiladi. Havola tarqalib ketsa, «yangilash» bilan eskisini bekor qiling."}
        </p>
        <div className="mt-4">
          <InviteLink slug={view.slug} initialCode={view.inviteCode} />
        </div>
      </section>
    </div>
  );
}
