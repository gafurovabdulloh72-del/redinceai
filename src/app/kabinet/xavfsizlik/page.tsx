import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { headers } from "next/headers";
import { and, desc, eq, inArray } from "drizzle-orm";
import { SecurityPanel, type LoginEvent, type SecurityInitial } from "@/components/kabinet/SecurityPanel";
import { PrivacyPanel } from "@/components/kabinet/PrivacyPanel";
import { BlockedList } from "@/components/kabinet/BlockedList";
import { listBlocked } from "@/lib/privacy/blocks";
import { getCurrentUser, getSession, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { listUserSessions } from "@/lib/security/sessions";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Xavfsizlik"])  };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Kirish tarixida ko'rsatiladigan audit harakatlari */
const LOGIN_ACTIONS = ["login_success", "login_failed", "login_2fa_failed", "login_2fa_required", "logout", "logout_all", "password_changed", "session_revoked"];
const HISTORY_LIMIT = 12;

/** IP maskasi: "185.12.34.56" → "185.12.•.•"; IPv6 — birinchi 2 bo'lak */
function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(":")) return `${ip.split(":").slice(0, 2).join(":")}:…`;
  const p = ip.split(".");
  return p.length === 4 ? `${p[0]}.${p[1]}.•.•` : ip;
}

export default async function SecurityPage({ searchParams }: { searchParams: SearchParams }) {
  const [user, session, sp] = await Promise.all([getCurrentUser(), getSession(), searchParams]);
  if (!user) redirect(await loginRedirectPath("/kabinet/xavfsizlik"));
  const [codes, sessionList, blockedRows, historyRows] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, user.id), columns: { recoveryCodes: true, dmPolicy: true, commentPolicy: true, showOnline: true, isPaused: true } }),
    listUserSessions(user.id, session, (await headers()).get("user-agent")),
    listBlocked(user.id),
    db.query.auditLogs.findMany({
      where: and(eq(auditLogs.actorId, user.id), inArray(auditLogs.action, LOGIN_ACTIONS)),
      orderBy: [desc(auditLogs.createdAt)],
      limit: HISTORY_LIMIT,
      columns: { id: true, action: true, ip: true, meta: true, createdAt: true },
    }),
  ]);

  const history: LoginEvent[] = historyRows.map((r) => ({
    id: r.id,
    action: r.action,
    at: r.createdAt.getTime(),
    ip: maskIp(r.ip),
    twoFactor: typeof r.meta?.twoFactor === "string" ? (r.meta.twoFactor as string) : null,
  }));

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
    history,
  };

  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <span className="eyebrow">
          <LockKeyhole size={13} /> Kabinet
        </span>
        <h1 className="display-xl mt-4 text-fg">
          Hisob <span className="accent-serif">xavfsizligi</span>
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">Maxfiylik, bloklanganlar, parol, ikki bosqichli himoya va faol qurilmalar.</p>
      </header>

      {/* ADMIN_REQUIRE_2FA=1 bilan admin panelidan yo'naltirilgan admin — nima uchun shu yerda ekanini tushuntiramiz */}
      {sp.admin2fa === "1" && user.role === "admin" && !user.totpEnabled && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-[var(--radius-lg)] border border-accent/40 bg-accent/5 p-4 text-[14px] leading-relaxed text-fg">
          <LockKeyhole size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span>
            <b>Admin panel uchun ikki bosqichli himoya majburiy.</b> Pastdagi «Ikki bosqichli himoya» bo&apos;limida autentifikator ilovasini ulang —
            shundan keyin admin panel va Telegram admin boti ochiladi.
          </span>
        </div>
      )}

      <div className="stagger mb-4 grid gap-4 lg:grid-cols-2">
        <div className="animate-fade-up">
          <PrivacyPanel initial={{ dmPolicy: codes?.dmPolicy ?? "all", commentPolicy: codes?.commentPolicy ?? "all", showOnline: codes?.showOnline ?? true }} paused={codes?.isPaused ?? false} canPause={Boolean(user.specialist)} />
        </div>
        <div className="animate-fade-up">
          <BlockedList initial={blockedRows} />
        </div>
      </div>

      <SecurityPanel initial={initial} />
    </div>
  );
}
