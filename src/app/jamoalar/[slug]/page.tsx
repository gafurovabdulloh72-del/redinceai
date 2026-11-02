import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * TELEGRAM USLUBI (2026-11-02, foydalanuvchi so'rovi): alohida jamoa/kanal sahifasi OLIB TASHLANDI —
 * hamma narsa Chat bo'limining o'zida (kanal: postlar lentasi + muhokama, guruh: chat, a'zo bo'lmaganga
 * qo'shilish paneli — `components/chat/GroupPanelBody.tsx`). Eski havolalar (bildirishnoma, ulashish,
 * taklif, ?post= / ?tab=chat) chatga yo'naltiriladi; mehmon — login orqali qaytadi.
 * Sozlash sahifasi (/jamoalar/[slug]/sozlash) saqlangan.
 */
export default async function GroupRedirect({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = new URLSearchParams({ guruh: slug });
  if (one(sp.tab) === "chat") q.set("gtab", "chat");
  const post = one(sp.post);
  if (post) q.set("post", post);
  const invite = one(sp.invite);
  if (invite) q.set("invite", invite);
  redirect(`/kabinet/chat?${q.toString()}`);
}
