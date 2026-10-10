import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { ArrowLeft, ScrollText } from "lucide-react";
import { Avatar, Badge, ButtonLink, EmptyState } from "@/components/ui";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { auditLabel } from "@/lib/security/audit";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Audit jurnali", robots: { index: false, follow: false } };

const LIMIT = 200;

type Tone = "neutral" | "accent" | "ink" | "green" | "orange" | "purple";
function toneFor(action: string): Tone {
  if (action === "login_failed") return "orange";
  if (action.startsWith("admin_")) return "ink";
  if (action.startsWith("password_") || action === "logout_all") return "accent";
  if (action.startsWith("payment_") || action.startsWith("payout_")) return "purple";
  if (action === "login_success" || action === "register") return "green";
  return "neutral";
}

function metaText(meta: Record<string, unknown>) {
  const entries = Object.entries(meta ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  return entries.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ");
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ action?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/admin/audit"));
  if (user.role !== "admin") redirect("/kabinet");

  const sp = await searchParams;
  const raw = Array.isArray(sp.action) ? sp.action[0] : sp.action;
  const action = raw && /^[a-z_]{1,40}$/.test(raw) ? raw : undefined;

  const [rows, actions] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        ip: auditLogs.ip,
        meta: auditLogs.meta,
        createdAt: auditLogs.createdAt,
        actorId: auditLogs.actorId,
        actorName: users.name,
        actorEmail: users.email,
        actorAvatar: users.avatarUrl,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(action ? eq(auditLogs.action, action) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(LIMIT),
    db
      .select({ action: auditLogs.action, n: sql<number>`count(*)` })
      .from(auditLogs)
      .groupBy(auditLogs.action)
      .orderBy(desc(sql`count(*)`)),
  ]);

  const total = actions.reduce((s, a) => s + Number(a.n), 0);

  return (
    <div className="container-x animate-fade-up">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <span className="eyebrow">
            <ScrollText size={13} className="text-accent" /> Admin panel
          </span>
          <h1 className="display-xl mt-5 text-[34px] text-fg sm:text-[48px]">
            Audit <span className="accent-serif text-accent">jurnali</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-fg-2">
            Kirishlar, parol o'zgarishlari, yuklashlar va admin harakatlari — oxirgi {LIMIT} ta yozuv. Jami {total} ta.
          </p>
        </div>
        <ButtonLink href="/admin" variant="outline" size="sm">
          <ArrowLeft size={14} /> Admin panel
        </ButtonLink>
      </header>

      {/* ---------- Filtr ---------- */}
      <nav aria-label="Harakat bo'yicha filtr" className="no-scrollbar -mx-4 mt-8 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <div className="segment">
          <Link href="/admin/audit" className="segment-item inline-flex min-h-[38px] items-center" data-active={!action} aria-current={!action ? "page" : undefined}>
            Barchasi <span className="ml-1.5 text-[11px] opacity-70">{total}</span>
          </Link>
          {actions.map((a) => (
            <Link
              key={a.action}
              href={`/admin/audit?action=${encodeURIComponent(a.action)}`}
              className="segment-item inline-flex min-h-[38px] items-center"
              data-active={action === a.action}
              aria-current={action === a.action ? "page" : undefined}
            >
              {auditLabel(a.action)} <span className="ml-1.5 text-[11px] opacity-70">{a.n}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* ---------- Jadval ---------- */}
      <section className="mt-6">
        {rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="Yozuvlar yo'q" description={action ? "Bu harakat bo'yicha hali yozuv yo'q." : "Jurnal hali bo'sh — kirishlar va o'zgarishlar shu yerda ko'rinadi."} />
        ) : (
          <div className="card overflow-hidden">
            {/* Desktop jadval */}
            <table className="hidden w-full md:table">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">
                  <th className="px-5 py-3 font-bold">Vaqt</th>
                  <th className="px-3 py-3 font-bold">Harakat</th>
                  <th className="px-3 py-3 font-bold">Kim</th>
                  <th className="px-3 py-3 font-bold">Nishon</th>
                  <th className="px-3 py-3 font-bold">IP</th>
                  <th className="px-5 py-3 font-bold">Tafsilot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top text-[13px] text-fg-2 transition hover:bg-fg/3">
                    <td className="whitespace-nowrap px-5 py-3">
                      <time dateTime={r.createdAt.toISOString()} className="block font-medium text-fg">
                        {formatDateTime(r.createdAt)}
                      </time>
                      <span className="text-[11px] text-fg-4" suppressHydrationWarning>
                        {timeAgo(r.createdAt)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={toneFor(r.action)}>{auditLabel(r.action)}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      {r.actorId ? (
                        <span className="flex items-center gap-2">
                          <Avatar name={r.actorName ?? "?"} src={r.actorAvatar} size={26} decorative />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-fg">{r.actorName ?? "O'chirilgan"}</span>
                            <span className="block truncate text-[11px] text-fg-4">{r.actorEmail ?? r.actorId.slice(0, 8)}</span>
                          </span>
                        </span>
                      ) : (
                        <span className="text-fg-4">Anonim</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {r.targetType ? (
                        <span className="block">
                          <span className="text-fg-3">{r.targetType}</span>
                          {r.targetId && <span className="block truncate font-mono text-[11px] text-fg-4">{r.targetId.slice(0, 12)}</span>}
                        </span>
                      ) : (
                        <span className="text-fg-4">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] text-fg-3">{r.ip ?? "—"}</td>
                    <td className="max-w-[320px] px-5 py-3 text-[12px] text-fg-3">
                      <span className="line-clamp-2 break-all">{metaText(r.meta) || "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobil ro'yxat */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={toneFor(r.action)}>{auditLabel(r.action)}</Badge>
                    <time dateTime={r.createdAt.toISOString()} className="shrink-0 text-[11px] text-fg-4" suppressHydrationWarning>
                      {timeAgo(r.createdAt)}
                    </time>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[13px]">
                    {r.actorId ? (
                      <>
                        <Avatar name={r.actorName ?? "?"} src={r.actorAvatar} size={22} decorative />
                        <span className="truncate font-medium text-fg">{r.actorName ?? "O'chirilgan"}</span>
                        <span className="truncate text-[11px] text-fg-4">{r.actorEmail}</span>
                      </>
                    ) : (
                      <span className="text-fg-4">Anonim</span>
                    )}
                  </div>
                  <p className={cn("mt-1.5 text-[12px] text-fg-3", !metaText(r.meta) && !r.targetType && "hidden")}>
                    {r.targetType && (
                      <span className="mr-2">
                        {r.targetType}
                        {r.targetId ? ` ${r.targetId.slice(0, 8)}` : ""}
                      </span>
                    )}
                    <span className="break-all">{metaText(r.meta)}</span>
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-fg-4">
                    {r.ip ?? "—"} · {formatDateTime(r.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
