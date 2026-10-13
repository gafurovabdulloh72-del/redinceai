import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { SecurityPanel, type SecurityInitial } from "@/components/kabinet/SecurityPanel";
import { getCurrentUser, getSession, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { listUserSessions } from "@/lib/security/sessions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Xavfsizlik" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SecurityPage({ searchParams }: { searchParams: SearchParams }) {
  const [user, session, sp] = await Promise.all([getCurrentUser(), getSession(), searchParams]);
  if (!user) redirect(await loginRedirectPath("/kabinet/xavfsizlik"));
  const [codes, sessionList] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, user.id), columns: { recoveryCodes: true } }),
    listUserSessions(user.id, session, (await headers()).get("user-agent")),
  ]);

  const initial: SecurityInitial = {
    email: user.email,
    emailVerified: user.emailVerified,
    phone: user.phone,
    lastLoginAt: user.lastLoginAt?.getTime() ?? null,
    passwordChangedAt: user.passwordChangedAt?.getTime() ?? null,
    createdAt: user.createdAt.getTime(),
    remember: session?.remember ?? true,
    role: user.role,
    totpEnabled: user.totpEnabled,
    recoveryLeft: user.totpEnabled ? (codes?.recoveryCodes.length ?? 0) : 0,
    sessions: sessionList,
    lowRecovery: sp.zaxira === "kam",
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
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">Parol, ikki bosqichli himoya, faol qurilmalar va tasdiqlash holati. Parol o'zgarsa yoki «hammasidan chiqish» bosilsa, eski sessiyalar darhol bekor bo'ladi.</p>
      </header>

      <SecurityPanel initial={initial} />
    </div>
  );
}
