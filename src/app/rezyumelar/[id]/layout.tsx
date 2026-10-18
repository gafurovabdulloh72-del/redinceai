import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { resumes } from "@/lib/db/schema";

/** Mavjud bo'lmagan rezyume — haqiqiy 404 (ko'rish huquqi page.tsx'da: yopiq rezyume egasi/ish beruvchisiga ochiq) */
export default async function ResumeLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.query.resumes.findFirst({ where: eq(resumes.id, id), columns: { id: true } });
  if (!row) notFound();
  return children;
}
