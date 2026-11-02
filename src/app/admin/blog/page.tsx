import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminBlog } from "@/components/admin/AdminBlog";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { listAllArticles } from "@/lib/blog";
import { ADMIN_2FA_PATH, adminTwoFactorRequired } from "@/lib/security/admin-2fa";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blog boshqaruvi", robots: { index: false, follow: false } };

/** Admin blog muharriri (kamchilik #48): maqolalar ro'yxati + yaratish/tahrirlash */
export default async function AdminBlogPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/admin/blog"));
  if (user.role !== "admin") redirect("/kabinet");
  if (adminTwoFactorRequired() && !user.totpEnabled) redirect(ADMIN_2FA_PATH);
  const items = await listAllArticles();
  return (
    <div className="container-x animate-fade-up py-6">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 transition hover:text-fg">
        <ArrowLeft size={15} /> Admin panel
      </Link>
      <h1 className="mb-1 font-display text-[22px] font-bold text-fg">Blog boshqaruvi</h1>
      <p className="mb-5 max-w-xl text-[13.5px] text-fg-2">SEO maqolalari: yozing, qoralama sifatida saqlang, tayyor bo'lgach e'lon qiling. Matn markdown-lite formatida.</p>
      <div className="card p-5 max-sm:!border-0 max-sm:!bg-transparent max-sm:!p-0 max-sm:!shadow-none">
        <AdminBlog initial={items} />
      </div>
    </div>
  );
}
