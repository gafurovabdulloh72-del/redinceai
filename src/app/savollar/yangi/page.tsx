import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AskForm } from "@/components/qa/AskForm";
import { getVerifiedSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Savol berish",
  alternates: { canonical: "/savollar/yangi" },
  other: { "m-title": "Savol berish" },
};

export default async function AskPage() {
  const session = await getVerifiedSession();
  if (!session) redirect("/auth/kirish?next=/savollar/yangi");
  return (
    <div className="container-x animate-fade-up py-6">
      <Link href="/savollar" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 transition hover:text-fg">
        <ArrowLeft size={15} /> Maslahat
      </Link>
      <h1 className="display-xl mb-1.5 text-fg max-sm:hidden">Savol berish</h1>
      <p className="mb-5 max-w-xl text-[14px] text-fg-2">Hamjamiyatdan maslahat so'rang — ish, narx, texnika, mijoz bilan muloqot. Eng foydali javobni keyin o'zingiz belgilaysiz.</p>
      <div className="max-w-xl">
        <AskForm />
      </div>
    </div>
  );
}
