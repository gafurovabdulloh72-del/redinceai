import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { SecurityPanel, type SecurityInitial } from "@/components/kabinet/SecurityPanel";
import { getCurrentUser, getSession, loginRedirectPath } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Xavfsizlik" };

export default async function SecurityPage() {
  const [user, session] = await Promise.all([getCurrentUser(), getSession()]);
  if (!user) redirect(await loginRedirectPath("/kabinet/xavfsizlik"));

  const initial: SecurityInitial = {
    email: user.email,
    emailVerified: user.emailVerified,
    phone: user.phone,
    lastLoginAt: user.lastLoginAt?.getTime() ?? null,
    passwordChangedAt: user.passwordChangedAt?.getTime() ?? null,
    createdAt: user.createdAt.getTime(),
    remember: session?.remember ?? true,
  };

  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <span className="eyebrow">
          <LockKeyhole size={13} className="text-accent" /> Xavfsizlik
        </span>
        <h1 className="display-xl mt-5 text-[32px] text-fg sm:text-[40px]">
          Hisob <span className="accent-serif text-accent">xavfsizligi</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">Parol, qurilmalar va tasdiqlash holati. Parol o'zgarsa yoki «hammasidan chiqish» bosilsa, eski sessiyalar darhol bekor bo'ladi.</p>
      </header>

      <SecurityPanel initial={initial} />
    </div>
  );
}
