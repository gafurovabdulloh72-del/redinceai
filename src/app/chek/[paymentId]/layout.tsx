import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { canViewPayment, loadPaymentDetail } from "@/lib/payments/dto";

/**
 * Mavjudlik va huquq tekshiruvi loading.tsx (Suspense) chegarasidan TASHQARIDA (tolov/[paymentId]/layout.tsx bilan bir xil):
 * page.tsx ichidagi notFound() oqim boshlangach chaqirilsa javob 200 bo'lardi (soft 404). Noma'lum yoki begona
 * to'lov uchun bu yerda haqiqiy 404 qaytadi; kirmagan foydalanuvchi — kirish sahifasiga.
 */
export default async function ReceiptLayout({ children, params }: { children: ReactNode; params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(`/chek/${paymentId}`));
  const p = await loadPaymentDetail(paymentId);
  if (!p || !canViewPayment(p, { sub: user.id, role: user.role })) notFound();
  return children;
}
