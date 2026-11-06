import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVerifiedSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { liveShareInfo, liveSharePath } from "@/lib/live/share";
import { SITE_URL } from "@/lib/site-url";
import { LiveShareView } from "@/components/live/LiveShareView";

export const dynamic = "force-dynamic";

/**
 * EFIR ULASHISH SAHIFASI (2026-11-06): `/efir/<id>` — jonli efirning doimiy havolasi.
 * Bildirishnoma, Telegram bot va «Ulashish» tugmalari shu yerga olib keladi; sahifa efir oynasini o'zi ochadi.
 * DIQQAT: loading.tsx QO'SHILMASIN (yumshoq 404 qoidasi — notFound() holati 200 bo'lib qoladi).
 */
type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  const s = await getVerifiedSession();
  const viewer = s ? { id: s.sub, role: s.role } : null;
  return { info: await liveShareInfo(id, viewer), loggedIn: Boolean(s) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const [{ info }, til] = await Promise.all([load(id), getLocale()]);
  const ru = til === "ru";
  if (!info) return { title: ru ? "Эфир не найден" : "Efir topilmadi", robots: { index: false } };
  const live = info.status === "live";
  const title = live ? `🔴 ${ru ? "Прямой эфир" : "Jonli efir"}: ${info.title}` : `${info.title} — ${ru ? "эфир завершён" : "efir tugadi"}`;
  const description = live
    ? ru
      ? `${info.host.name} сейчас в эфире на Kasb Egalari (${info.group.name}). Присоединяйтесь!`
      : `${info.host.name} hozir Kasb Egalari'da jonli efirda (${info.group.name}). Qo'shiling!`
    : ru
      ? `Эфир ${info.host.name} (${info.group.name}) на Kasb Egalari.`
      : `${info.host.name} efiri (${info.group.name}) — Kasb Egalari.`;
  const url = `${SITE_URL}${liveSharePath(info.id)}`;
  const image = info.group.coverUrl || info.host.avatarUrl || undefined;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
    other: { "m-title": ru ? "Эфир" : "Efir" },
  };
}

export default async function LiveSharePage({ params }: Params) {
  const { id } = await params;
  const [{ info, loggedIn }, til] = await Promise.all([load(id), getLocale()]);
  if (!info) notFound();
  return <LiveShareView info={info} loggedIn={loggedIn} shareUrl={`${SITE_URL}${liveSharePath(info.id)}`} ru={til === "ru"} />;
}
