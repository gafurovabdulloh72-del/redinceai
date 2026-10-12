import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getSpecialistBySlug } from "@/lib/queries";

/**
 * Mavjudlik tekshiruvi loading.tsx (Suspense) chegarasidan TASHQARIDA. page.tsx ichidagi notFound()
 * oqim (streaming) boshlangach chaqiladi — javob 200 + noindex bo'lardi; qidiruv tizimi va monitoring
 * uchun o'lik profil manzillari 404 qaytarishi kerak. getSpecialistBySlug React cache'da — page.tsx
 * va generateMetadata'dagi qayta chaqiruv bazaga bormaydi.
 */
export default async function SpecialistLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getSpecialistBySlug(slug))) notFound();
  return children;
}
