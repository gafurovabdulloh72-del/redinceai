import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AskForm } from "@/components/qa/AskForm";
import { getVerifiedSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { SAVOL } from "@/lib/i18n/dict/community";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Savol berish",
  alternates: { canonical: "/savollar/yangi" },
  other: { "m-title": "Savol berish" },
};

export default async function AskPage() {
  const [til, session] = await Promise.all([getLocale(), getVerifiedSession()]);
  if (!session) redirect("/auth/kirish?next=/savollar/yangi");
  return (
    <div className="container-x animate-fade-up py-6">
      <Link href="/savollar" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 transition hover:text-fg">
        <ArrowLeft size={15} /> {tr(til, SAVOL.title)}
      </Link>
      <h1 className="display-xl mb-1.5 text-fg max-sm:hidden">{tr(til, SAVOL.askTitle)}</h1>
      <p className="mb-5 max-w-xl text-[14px] text-fg-2">{tr(til, SAVOL.askSubtitle)}</p>
      <div className="max-w-xl">
        <AskForm />
      </div>
    </div>
  );
}
