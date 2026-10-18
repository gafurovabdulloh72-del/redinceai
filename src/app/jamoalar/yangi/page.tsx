import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { GroupForm } from "@/components/groups/GroupForm";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Yangi jamoa", robots: { index: false, follow: false } };

/** Jamoa ochish — faqat kirgan foydalanuvchilar (mijoz ham, mutaxassis ham) */
export default async function NewGroupPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/jamoalar/yangi"));
  return (
    <div className="container-x animate-fade-up">
      <nav aria-label="Yo'l" className="mb-5 text-[13px] text-fg-3">
        <Link href="/jamoalar" className="transition hover:text-fg">
          Jamoalar
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg-2">Yangi jamoa</span>
      </nav>
      <PageHeader
        eyebrow="Jamoalar"
        title={
          <>
            Yangi <span className="accent-serif text-accent">guruh yoki kanal</span>
          </>
        }
        description="Guruh — hamma yozadi; kanal — faqat siz yozasiz. Hammasini keyin o'zgartira olasiz."
      />
      <div className="mt-8 max-w-2xl">
        <GroupForm mode="create" isSiteAdmin={user.role === "admin"} />
      </div>
    </div>
  );
}
