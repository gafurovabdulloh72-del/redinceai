import { redirect } from "next/navigation";
import { loadGroupByAnySlug } from "@/lib/groups/service";
import { activeLive } from "@/lib/live/service";

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
  // ?efir=1 (eski bildirishnoma/efir eslatmasi havolalari) — jonli efir bo'lsa uning ulashish sahifasiga.
  // Ilgari bu parametr yo'qolardi va foydalanuvchi efirsiz chatga tushib qolardi.
  if (one(sp.efir) === "1") {
    const g = await loadGroupByAnySlug(slug);
    const live = g ? await activeLive(g.id) : null;
    if (live) redirect(`/efir/${live.id}`);
  }
  const q = new URLSearchParams({ guruh: slug });
  if (one(sp.tab) === "chat") q.set("gtab", "chat");
  // «A'zolar bo'limida tasdiqlang» bildirishnomasi va sozlash sahifasidagi «N ta so'rov»: a'zolar varag'i ochiladi
  // (ilgari `tab=azolar` yo'qolib, boshqaruvchi qo'shilish so'rovini tasdiqlaydigan joyni topa olmasdi — QA A3)
  else if (one(sp.tab) === "azolar") q.set("gtab", "azolar");
  const post = one(sp.post);
  if (post) q.set("post", post);
  const invite = one(sp.invite);
  if (invite) q.set("invite", invite);
  redirect(`/kabinet/chat?${q.toString()}`);
}
