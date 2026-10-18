import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, Filter, ScrollText, X } from "lucide-react";
import { Pagination } from "@/components/specialists/Pagination";
import { Avatar, Badge, ButtonLink, EmptyState } from "@/components/ui";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { auditFilterFromQuery, countAuditLogs, labelFor, queryAuditLogs } from "../queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Audit jurnali", robots: { index: false, follow: false } };

/** Bir sahifada yozuvlar soni (mobilda har qator karta — 200 ta 25 ming px sahifa qilardi) */
const LIMIT = 50;

type Tone = "neutral" | "accent" | "ink" | "green" | "orange" | "purple" | "info";
function toneFor(action: string): Tone {
  if (action === "login_failed") return "orange";
  if (action.startsWith("admin_")) return "ink";
  if (action.startsWith("password_") || action === "logout_all") return "accent";
  if (action.startsWith("payment_") || action.startsWith("payout_")) return "purple";
  if (action.startsWith("order_")) return "info";
  if (action === "login_success" || action === "register") return "green";
  return "neutral";
}

/** meta'dan izoh (note) alohida ko'rsatiladi — qolgani ixcham */
function metaText(meta: Record<string, unknown>) {
  const entries = Object.entries(meta ?? {}).filter(([k, v]) => k !== "note" && v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  return entries.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ");
}
const noteOf = (meta: Record<string, unknown>) => (typeof meta?.note === "string" && meta.note.trim() ? meta.note.trim() : null);
/** Tizim harakatlari (cron) — aktyor yo'q */
const isSystem = (action: string) => action.startsWith("cron_");

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type Search = { action?: string | string[]; actor?: string | string[]; from?: string | string[]; to?: string | string[]; q?: string | string[]; page?: string | string[]; format?: string | string[] };

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/admin/audit"));
  if (user.role !== "admin") redirect("/kabinet");

  const sp = await searchParams;
  const filter = auditFilterFromQuery({ action: first(sp.action), actor: first(sp.actor), from: first(sp.from), to: first(sp.to), q: first(sp.q) });
  const { action, actor, from, to, q } = filter;
  const query = { action, actor, from, to, q };
  const qs = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  // ?format=csv — eksport API'siga (fayl sifatida yuklanadi)
  if (first(sp.format) === "csv") redirect(`/api/admin/audit?format=csv${qs ? `&${qs}` : ""}`);

  const pageRaw = Number(first(sp.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 1 ? Math.min(pageRaw, 10_000) : 1;

  const [rows, { total: matching, byAction }] = await Promise.all([queryAuditLogs(filter, { limit: LIMIT, offset: (page - 1) * LIMIT }), countAuditLogs(filter)]);
  const total = byAction.reduce((s, a) => s + a.n, 0);
  const pages = Math.max(1, Math.ceil(matching / LIMIT));
  const hasExtra = Boolean(actor || from || to || q);
  const chipHref = (a?: string) => {
    const q = new URLSearchParams(Object.entries({ ...query, action: a }).filter((e): e is [string, string] => Boolean(e[1])));
    const str = q.toString();
    return `/admin/audit${str ? `?${str}` : ""}`;
  };

  return (
    <div className="container-x animate-fade-up">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4">
            <ScrollText size={12} aria-hidden="true" /> Admin panel
          </p>
          <h1 className="mt-1.5 font-display text-[26px] font-semibold leading-tight tracking-tight text-fg sm:text-[30px]">Audit jurnali</h1>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-fg-3">
            Kirishlar, parol o'zgarishlari, yuklashlar, buyurtma va to'lov harakatlari — sahifada {LIMIT} tadan. {hasExtra ? `Filtr bo'yicha ${total} ta` : `Jami ${total} ta`}
            {action ? `, tanlangan harakat bo'yicha ${matching} ta` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/api/admin/audit?format=csv${qs ? `&${qs}` : ""}`} variant="outline" size="sm" aria-label="CSV yuklab olish (joriy filtr)">
            <Download size={14} /> CSV
          </ButtonLink>
          <ButtonLink href="/admin" variant="outline" size="sm">
            <ArrowLeft size={14} /> Admin panel
          </ButtonLink>
        </div>
      </header>

      {/* ---------- Filtr: kim / sana (GET forma — havola ulashiladi) ---------- */}
      <form method="get" action="/admin/audit" className="card mt-8 flex flex-col gap-3 p-3 sm:flex-row sm:items-end sm:p-4">
        {action && <input type="hidden" name="action" value={action} />}
        <div className="flex-1">
          <label htmlFor="audit-actor" className="field-label">
            Kim (ism yoki email)
          </label>
          <input id="audit-actor" name="actor" className="field" defaultValue={actor ?? ""} placeholder="masalan: admin@redince.uz" maxLength={120} />
        </div>
        <div className="flex-1">
          <label htmlFor="audit-q" className="field-label">
            Qidiruv (nishon ID, harakat, tafsilot)
          </label>
          <input id="audit-q" name="q" type="search" className="field" defaultValue={q ?? ""} placeholder="masalan: buyurtma ID yoki «refund»" maxLength={80} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-[300px]">
          <div>
            <label htmlFor="audit-from" className="field-label">
              Sanadan
            </label>
            <input id="audit-from" name="from" type="date" className="field" defaultValue={from ?? ""} />
          </div>
          <div>
            <label htmlFor="audit-to" className="field-label">
              Sanagacha
            </label>
            <input id="audit-to" name="to" type="date" className="field" defaultValue={to ?? ""} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-ink inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[14px] font-semibold">
            <Filter size={14} /> Filtrlash
          </button>
          {hasExtra && (
            <Link href={chipHref(action).replace(/[?&](actor|from|to|q)=[^&]*/g, "").replace(/\?&/, "?")} className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-fg-2 hover:bg-fg/6 hover:text-fg">
              <X size={14} /> Tozalash
            </Link>
          )}
        </div>
      </form>

      {/* ---------- Harakat chiplari: mobil/planshetda aylanadi (o'ng chetda so'nish), katta ekranda qatorlarga o'raladi ---------- */}
      <nav aria-label="Harakat bo'yicha filtr" className="no-scrollbar scroll-fade -mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0 lg:[mask-image:none]">
        <div className="segment lg:flex-wrap lg:rounded-[24px]">
          <Link href={chipHref(undefined)} className="segment-item inline-flex min-h-[38px] items-center" data-active={!action} aria-current={!action ? "page" : undefined}>
            Barchasi <span className="ml-1.5 text-[11px] opacity-70">{total}</span>
          </Link>
          {byAction.map((a) => (
            <Link key={a.action} href={chipHref(a.action)} className="segment-item inline-flex min-h-[38px] items-center" data-active={action === a.action} aria-current={action === a.action ? "page" : undefined}>
              {labelFor(a.action)} <span className="ml-1.5 text-[11px] opacity-70">{a.n}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* ---------- Jadval ---------- */}
      <section className="mt-6">
        {rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="Yozuvlar yo'q" description={action || hasExtra ? "Bu filtr bo'yicha yozuv yo'q." : "Jurnal hali bo'sh — kirishlar va o'zgarishlar shu yerda ko'rinadi."} />
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
                      <time dateTime={r.createdAt.toISOString()} className="block font-medium text-fg" title="Toshkent vaqti (UTC+5)">
                        {formatDateTime(r.createdAt)}
                      </time>
                      <span className="text-[11px] text-fg-4" suppressHydrationWarning>
                        {timeAgo(r.createdAt)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={toneFor(r.action)}>{labelFor(r.action, r.meta)}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      {!r.actorId && isSystem(r.action) ? (
                        <span className="text-fg-3">Tizim</span>
                      ) : r.actorId ? (
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
                      {noteOf(r.meta) && <span className="mb-0.5 block font-medium text-fg">Izoh: {noteOf(r.meta)}</span>}
                      <span className="line-clamp-2 break-all">{metaText(r.meta) || (noteOf(r.meta) ? "" : "—")}</span>
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
                    <Badge tone={toneFor(r.action)}>{labelFor(r.action, r.meta)}</Badge>
                    <time dateTime={r.createdAt.toISOString()} className="shrink-0 text-[11px] text-fg-4" suppressHydrationWarning>
                      {timeAgo(r.createdAt)}
                    </time>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[13px]">
                    {!r.actorId && isSystem(r.action) ? (
                      <span className="text-fg-3">Tizim</span>
                    ) : r.actorId ? (
                      <>
                        <Avatar name={r.actorName ?? "?"} src={r.actorAvatar} size={22} decorative />
                        <span className="truncate font-medium text-fg">{r.actorName ?? "O'chirilgan"}</span>
                        <span className="truncate text-[11px] text-fg-4">{r.actorEmail}</span>
                      </>
                    ) : (
                      <span className="text-fg-4">Anonim</span>
                    )}
                  </div>
                  {noteOf(r.meta) && <p className="mt-1.5 text-[12px] font-medium text-fg">Izoh: {noteOf(r.meta)}</p>}
                  <p className={cn("mt-1.5 text-[12px] text-fg-3", !metaText(r.meta) && !r.targetType && "hidden")}>
                    {r.targetType && (
                      <span className="mr-2">
                        {r.targetType}
                        {r.targetId ? ` ${r.targetId.slice(0, 12)}` : ""}
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
        <Pagination page={page} pages={pages} query={query} basePath="/admin/audit" className="mt-6" />
      </section>
    </div>
  );
}
