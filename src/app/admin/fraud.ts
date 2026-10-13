import "server-only";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { specialists, users } from "@/lib/db/schema";

/**
 * Shubhali faollik signallari (F89) — faqat admin uchun, avtomatik choralar YO'Q (admin ko'rib chiqib bloklaydi).
 *  1. Bir IP'dan ko'p akkaunt: sessions.ipHash (kirishlar) va audit "register" IP'si bo'yicha ≥ SHARED_IP_MIN akkaunt
 *  2. Qisqa vaqtda ko'p faollik: 24 soatda ≥ BURST_ORDERS buyurtma (mijoz) yoki ≥ BURST_PROPOSALS taklif (mutaxassis)
 *  3. O'z-o'ziga buyurtma: buyurtmaning mijozi va mutaxassisi bir xil IP hashdan kirgan
 *  4. Takroriy bekor qilishlar: 90 kunda ≥ CANCEL_MIN bekor qilingan buyurtma (mijoz yoki mutaxassis tomonida)
 * Xom IP sahifaga chiqmaydi: sessiyalarda faqat hash prefiksi, audit IP'si maskalanadi.
 */

export const SHARED_IP_MIN = 3;
export const BURST_ORDERS = 5;
export const BURST_PROPOSALS = 8;
export const CANCEL_MIN = 3;
const DAY_MS = 86_400_000;
const SHARED_WINDOW_DAYS = 90;
const LIMIT = 12;

export interface FraudUser {
  id: string;
  name: string;
  email: string;
  role: "client" | "specialist" | "admin";
  isBanned: boolean;
  bannedReason: string | null;
  specialistSlug: string | null;
}
export interface SharedIpSignal {
  key: string;
  /** "IP #a1b2c3" yoki "192.168.*.*" */
  label: string;
  source: "session" | "register";
  users: FraudUser[];
}
export interface BurstSignal {
  user: FraudUser;
  kind: "orders" | "proposals";
  count: number;
}
export interface SelfDealSignal {
  orderId: string;
  title: string;
  status: string;
  amount: number | null;
  createdAt: number;
  client: FraudUser;
  specialist: FraudUser;
}
export interface CancelSignal {
  user: FraudUser;
  side: "client" | "specialist";
  count: number;
}
export interface FraudSignals {
  sharedIp: SharedIpSignal[];
  bursts: BurstSignal[];
  selfDealing: SelfDealSignal[];
  cancellations: CancelSignal[];
  total: number;
}

/** 192.168.1.20 → 192.168.*.*; IPv6 → birinchi 2 guruh */
function maskIp(ip: string): string {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip.split(".").slice(0, 2).join(".") + ".*.*";
  if (ip.includes(":")) return ip.split(":").slice(0, 2).join(":") + ":…";
  return ip.length > 8 ? `${ip.slice(0, 6)}…` : ip;
}

const ids = (csv: string | null) => (csv ? [...new Set(csv.split(","))].filter(Boolean) : []);

export async function getFraudSignals(now = Date.now()): Promise<FraudSignals> {
  const sharedSince = now - SHARED_WINDOW_DAYS * DAY_MS;
  const daySince = now - DAY_MS;
  const cancelSince = now - 90 * DAY_MS;

  const [sessionIps, registerIps, orderBursts, proposalBursts, selfDeals, clientCancels, spCancels] = await Promise.all([
    db.all<{ k: string; n: number; u: string }>(sql`
      select ip_hash as k, count(distinct user_id) as n, group_concat(distinct user_id) as u
      from sessions where ip_hash is not null and created_at >= ${sharedSince}
      group by ip_hash having count(distinct user_id) >= ${SHARED_IP_MIN}
      order by n desc limit ${LIMIT}`),
    db.all<{ k: string; n: number; u: string }>(sql`
      select ip as k, count(distinct actor_id) as n, group_concat(distinct actor_id) as u
      from audit_logs where action = 'register' and ip is not null and actor_id is not null
      group by ip having count(distinct actor_id) >= ${SHARED_IP_MIN}
      order by n desc limit ${LIMIT}`),
    db.all<{ u: string; n: number }>(sql`
      select client_id as u, count(*) as n from orders where created_at >= ${daySince}
      group by client_id having count(*) >= ${BURST_ORDERS} order by n desc limit ${LIMIT}`),
    db.all<{ u: string; n: number }>(sql`
      select s.user_id as u, count(*) as n from proposals p join specialists s on s.id = p.specialist_id
      where p.created_at >= ${daySince}
      group by s.user_id having count(*) >= ${BURST_PROPOSALS} order by n desc limit ${LIMIT}`),
    db.all<{ id: string; title: string; status: string; amount: number | null; created_at: number; c: string; s: string }>(sql`
      select o.id, o.title, o.status, o.amount, o.created_at, o.client_id as c, sp.user_id as s
      from orders o join specialists sp on sp.id = o.specialist_id
      where o.client_id <> sp.user_id and exists (
        select 1 from sessions a join sessions b on a.ip_hash = b.ip_hash
        where a.user_id = o.client_id and b.user_id = sp.user_id and a.ip_hash is not null
      )
      order by o.created_at desc limit ${LIMIT}`),
    db.all<{ u: string; n: number }>(sql`
      select client_id as u, count(*) as n from orders where status = 'cancelled' and updated_at >= ${cancelSince}
      group by client_id having count(*) >= ${CANCEL_MIN} order by n desc limit ${LIMIT}`),
    db.all<{ u: string; n: number }>(sql`
      select s.user_id as u, count(*) as n from orders o join specialists s on s.id = o.specialist_id
      where o.status = 'cancelled' and o.updated_at >= ${cancelSince}
      group by s.user_id having count(*) >= ${CANCEL_MIN} order by n desc limit ${LIMIT}`),
  ]);

  const allIds = new Set<string>();
  for (const r of [...sessionIps, ...registerIps]) ids(r.u).forEach((id) => allIds.add(id));
  for (const r of [...orderBursts, ...proposalBursts, ...clientCancels, ...spCancels]) allIds.add(r.u);
  for (const r of selfDeals) {
    allIds.add(r.c);
    allIds.add(r.s);
  }

  const userRows = allIds.size
    ? await db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role, isBanned: users.isBanned, bannedReason: users.bannedReason, slug: specialists.slug })
        .from(users)
        .leftJoin(specialists, sql`${specialists.userId} = ${users.id}`)
        .where(inArray(users.id, [...allIds]))
    : [];
  const byId = new Map<string, FraudUser>(
    userRows.map((u) => [u.id, { id: u.id, name: u.name, email: u.email, role: u.role, isBanned: u.isBanned, bannedReason: u.bannedReason, specialistSlug: u.slug ?? null }]),
  );
  const pick = (id: string) => byId.get(id) ?? null;
  const users_ = (csv: string) => ids(csv).map(pick).filter((u): u is FraudUser => u !== null);

  const sharedIp: SharedIpSignal[] = [
    ...sessionIps.map((r) => ({ key: `s:${r.k}`, label: `IP #${r.k.slice(0, 8)}`, source: "session" as const, users: users_(r.u) })),
    ...registerIps.map((r) => ({ key: `r:${r.k}`, label: maskIp(r.k), source: "register" as const, users: users_(r.u) })),
  ].filter((s) => s.users.length >= SHARED_IP_MIN);

  const bursts: BurstSignal[] = [
    ...orderBursts.map((r) => ({ user: pick(r.u), kind: "orders" as const, count: Number(r.n) })),
    ...proposalBursts.map((r) => ({ user: pick(r.u), kind: "proposals" as const, count: Number(r.n) })),
  ].filter((b): b is BurstSignal => b.user !== null);

  const selfDealing: SelfDealSignal[] = selfDeals.flatMap((r) => {
    const client = pick(r.c);
    const specialist = pick(r.s);
    return client && specialist ? [{ orderId: r.id, title: r.title, status: r.status, amount: r.amount, createdAt: Number(r.created_at), client, specialist }] : [];
  });

  const cancellations: CancelSignal[] = [
    ...clientCancels.map((r) => ({ user: pick(r.u), side: "client" as const, count: Number(r.n) })),
    ...spCancels.map((r) => ({ user: pick(r.u), side: "specialist" as const, count: Number(r.n) })),
  ].filter((c): c is CancelSignal => c.user !== null);

  return { sharedIp, bursts, selfDealing, cancellations, total: sharedIp.length + bursts.length + selfDealing.length + cancellations.length };
}
