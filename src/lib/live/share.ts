import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, liveStreams, mentors, users } from "@/lib/db/schema";
import { getMembership } from "@/lib/groups/service";
import { canWatchPaid } from "@/lib/mentorship/purchases";
import { LIVE_MAX_MS } from "./service";

/**
 * EFIR ULASHISH HAVOLASI (2026-11-06): `/efir/<id>` — har qanday jonli efirni (mentor kanali yoki oddiy jamoa)
 * bitta doimiy havola bilan ochish. Sahifa efir oynasini O'ZI ochadi, shuning uchun havola efir paneli qayerda
 * turganiga (ustoz sahifasi / chat paneli) bog'liq emas.
 *
 * Maxfiylik: yopiq jamoa efiri a'zo bo'lmaganga UMUMAN ko'rinmaydi (null → 404) — sarlavha OG metadata orqali ham
 * oshkor bo'lmaydi. Pullik efir ko'rinadi (chipta sotish uchun), lekin kirish `liveAccess` (token) da tekshiriladi.
 */
type Viewer = { id: string; role: string } | null;

export interface LiveShareInfo {
  id: string;
  title: string;
  /** live — hozir efirda; ended — tugagan (yoki 6 soatdan oshgan yetim efir) */
  status: "live" | "ended";
  startedAt: number;
  endedAt: number | null;
  price: number;
  /** Ko'ruvchi kira oladimi (bepul yoki chipta/obuna bor yoki boshlovchi/admin) */
  access: boolean;
  /** Ko'ruvchi — boshlovchi */
  isHost: boolean;
  /** Kod yoki kutish xonasi bor (oyna ichida LiveGate so'raydi) */
  gated: boolean;
  host: { name: string; avatarUrl: string | null };
  group: { name: string; slug: string; coverUrl: string | null; isPrivate: boolean };
  /** Efir egasining sahifasi: ustoz sahifasi (Efirlar tabi) yoki jamoa chati */
  homeHref: string;
  /** Yozuv tayyor (tugagan efir uchun «Yozuvni ko'rish») */
  hasRecording: boolean;
}

/** Ulashish sahifasi uchun efir ma'lumoti; ko'rinmasa (yo'q yoki yopiq jamoaga begona) — null */
export async function liveShareInfo(id: string, viewer: Viewer): Promise<LiveShareInfo | null> {
  if (!id || id.length > 64) return null;
  const s = await db.query.liveStreams.findFirst({ where: eq(liveStreams.id, id) });
  if (!s) return null;
  const g = await db.query.groups.findFirst({ where: eq(groups.id, s.groupId), columns: { id: true, name: true, slug: true, coverUrl: true, isPrivate: true } });
  if (!g) return null;

  const isHost = viewer?.id === s.hostId;
  const isAdmin = viewer?.role === "admin";
  if (g.isPrivate && !isHost && !isAdmin) {
    const m = viewer ? await getMembership(g.id, viewer.id) : null;
    if (m?.status !== "active") return null; // yopiq jamoa — begonaga efir mavjudligi ham oshkor qilinmaydi
  }

  const [host, mentor] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, s.hostId), columns: { name: true, avatarUrl: true } }),
    db.query.mentors.findFirst({ where: eq(mentors.channelId, g.id), columns: { slug: true, isApproved: true } }),
  ]);

  const stale = s.startedAt.getTime() < Date.now() - LIVE_MAX_MS;
  const status: "live" | "ended" = s.status === "live" && !stale ? "live" : "ended";
  const access = s.priceSom <= 0 || isHost || (viewer ? await canWatchPaid(viewer.id, s, isAdmin) : false);
  const homeHref = mentor?.slug && mentor.isApproved ? `/mentorlik/ustoz/${mentor.slug}?tab=efirlar` : `/kabinet/chat?guruh=${encodeURIComponent(g.slug)}`;

  return {
    id: s.id,
    title: s.title,
    status,
    startedAt: s.startedAt.getTime(),
    endedAt: s.endedAt?.getTime() ?? null,
    price: s.priceSom,
    access,
    isHost,
    gated: Boolean(s.waitingRoom || s.passcode),
    host: { name: host?.name ?? "Boshlovchi", avatarUrl: host?.avatarUrl ?? null },
    group: { name: g.name, slug: g.slug, coverUrl: g.coverUrl, isPrivate: g.isPrivate },
    homeHref,
    hasRecording: s.recordingStatus === "ready" && !s.recordingHidden,
  };
}

/** Efirning doimiy ulashish yo'li (bildirishnoma, bot, ulashish tugmalari — hammasi shu) */
export const liveSharePath = (id: string) => `/efir/${encodeURIComponent(id)}`;
