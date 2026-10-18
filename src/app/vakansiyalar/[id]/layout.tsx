import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { loadVacancy } from "@/lib/vacancies/service";

/**
 * Mavjudlik tekshiruvi loading.tsx (Suspense) chegarasidan TASHQARIDA: page.tsx ichidagi notFound() oqim boshlangach
 * chaqirilsa javob 200 bo'lardi (soft 404). Yo'q vakansiya uchun bu yerda haqiqiy 404 qaytadi (qidiruv tizimlari uchun).
 */
export default async function VacancyLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await loadVacancy(id))) notFound();
  return children;
}
