import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { PROFESSION_BY_SLUG } from "@/lib/vacancies/format";

/** Noma'lum kasb — haqiqiy 404 (Suspense chegarasidan tashqarida, soft 404 emas) */
export default async function ProfessionLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!PROFESSION_BY_SLUG[slug]) notFound();
  return children;
}
