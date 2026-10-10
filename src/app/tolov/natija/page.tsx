import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { PaymentResult } from "@/components/payments/PaymentResult";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { siteOrigin } from "@/lib/payments/config";
import { canViewPayment, loadPaymentDetail, toPaymentDto } from "@/lib/payments/dto";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "To'lov natijasi", robots: { index: false, follow: false } };

/** Payme/Click'dan qaytish sahifasi: ?payment=<id>. Holat avtomatik yangilanadi. */
export default async function PaymentResultPage({ searchParams }: { searchParams: Promise<{ payment?: string | string[] }> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.payment) ? sp.payment[0] : sp.payment;
  const paymentId = raw && /^[\w-]{6,64}$/.test(raw) ? raw : "";

  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(`/tolov/natija?payment=${encodeURIComponent(paymentId)}`));

  const p = paymentId ? await loadPaymentDetail(paymentId) : null;
  const dto = p && canViewPayment(p, { sub: user.id, role: user.role }) ? toPaymentDto(p, siteOrigin(await headers())) : null;

  return (
    <div className="container-x animate-fade-up">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 text-center">
          <span className="eyebrow justify-center">
            <Lock size={13} className="text-accent" /> Eskrou to'lov
          </span>
          <h1 className="display-xl mt-4 text-[30px] text-fg sm:text-[40px]">To'lov natijasi</h1>
        </header>
        <PaymentResult paymentId={paymentId} initial={dto} />
      </div>
    </div>
  );
}
