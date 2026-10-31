import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Contact } from "lucide-react";
import { AdminContactPanel } from "@/components/admin/AdminContactPanel";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { contactUnlockStats, pendingContactInvoices, recentContactUnlocks } from "@/lib/contacts/unlock";
import { getSettings } from "@/lib/payments/settings";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kontakt sotuvi (admin)", robots: { index: false, follow: false } };

/** Admin: kontakt sotuvi — narxlar, maxsus narx/rejim, qo'lda o'tkazmalar navbati, statistika */
export default async function AdminKontaktlarPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/admin/kontaktlar"));
  if (user.role !== "admin") redirect("/kabinet");
  const [settings, stats, pending, recent] = await Promise.all([getSettings(), contactUnlockStats(), pendingContactInvoices(), recentContactUnlocks()]);
  return (
    <div className="container-x">
      <div className="mx-auto max-w-[860px] space-y-5 py-2">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 hover:text-fg">
          <ArrowLeft size={14} /> Boshqaruv markazi
        </Link>
        <h1 className="flex items-center gap-2 font-display text-[26px] font-semibold tracking-tight text-fg">
          <Contact size={22} className="text-accent" /> Kontakt sotuvi
        </h1>
        <p className="text-[13.5px] leading-relaxed text-fg-3">Mutaxassis kontaktlari hech kimga bepul ko&apos;rinmaydi — mijoz ishlarni ko&apos;rib, kontakt uchun platformaga to&apos;laydi. Buyurtma/eskrou tizimi avvalgidek ishlaydi.</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { v: String(stats.count), l: "jami ochilgan" },
            { v: String(stats.last30), l: "so'nggi 30 kun" },
            { v: formatPrice(stats.revenue), l: "jami tushum" },
          ].map((t) => (
            <div key={t.l} className="card min-w-0 p-4">
              <div className="font-display text-[20px] font-semibold tabular-nums text-fg">{t.v}</div>
              <div className="mt-1 text-[12px] font-medium text-fg-3">{t.l}</div>
            </div>
          ))}
        </div>
        <AdminContactPanel
          prices={{ contactPriceJunior: settings.contactPriceJunior, contactPriceMiddle: settings.contactPriceMiddle, contactPriceSenior: settings.contactPriceSenior, contactPriceExpert: settings.contactPriceExpert }}
          settings={settings as unknown as Record<string, number>}
          pending={pending}
          recent={recent}
        />
      </div>
    </div>
  );
}
