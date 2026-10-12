import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getSpecialistBrief } from "@/lib/queries";

/**
 * Mavjudlik tekshiruvi loading.tsx (Suspense) chegarasidan TASHQARIDA (mutaxassislar/[slug]/layout.tsx bilan bir xil):
 * page.tsx ichidagi notFound() oqim boshlangach chaqiriladi — javob 200 bo'lardi (soft 404). Yo'q, bloklangan
 * yoki o'chirilgan mutaxassis uchun bu yerda 404 qaytadi. getSpecialistBrief React cache'da — page.tsx va
 * generateMetadata'dagi qayta chaqiruv bazaga bormaydi.
 */
export default async function OrderLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getSpecialistBrief(id))) notFound();
  return children;
}
