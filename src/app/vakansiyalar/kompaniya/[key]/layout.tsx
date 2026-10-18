import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { employerProfile } from "@/lib/vacancies/service";

/** Vakansiyasi yo'q / bloklangan foydalanuvchi — haqiqiy 404 (Suspense chegarasidan tashqarida) */
export default async function EmployerLayout({ children, params }: { children: ReactNode; params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!(await employerProfile(key))) notFound();
  return children;
}
