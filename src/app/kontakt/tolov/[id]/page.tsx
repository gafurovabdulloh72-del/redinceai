import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { loadInvoice } from "@/lib/subscriptions/billing";
import { contactMeta, isContactUnlock } from "@/lib/contacts/unlock";
import { db } from "@/lib/db";
import { specialists } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PurchaseStatus } from "@/components/mentorship/PurchaseStatus";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kontakt uchun to'lov", robots: { index: false, follow: false } };

/** Kontakt ochish to'lovi holati: Payme/Click'dan qaytgach kuzatish, o'tkazma rekvizitlari va «To'ladim» */
export default async function ContactPayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(`/kontakt/tolov/${id}`));
  const inv = await loadInvoice(id);
  if (!inv || !isContactUnlock(inv) || (inv.userId !== user.id && user.role !== "admin")) notFound();
  const m = contactMeta(inv);
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, m.specialistId), columns: { slug: true } });
  const next = sp ? `/mutaxassislar/${sp.slug}#aloqa` : "/mutaxassislar";
  return (
    <div className="container-x py-8">
      <PurchaseStatus id={id} next={next} apiBase="/api/kontakt/tolov" />
    </div>
  );
}
