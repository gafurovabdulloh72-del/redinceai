import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Globe, ListVideo, Lock } from "lucide-react";
import { HomeFeed } from "@/components/feed/HomeFeed";
import { getCurrentUser } from "@/lib/auth";
import { getCollection } from "@/lib/social/library";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  const data = await getCollection(id, user ? { id: user.id, role: user.role } : null);
  if (!data) return { title: "To'plam topilmadi" };
  return { title: data.collection.title, description: data.collection.description ?? undefined, robots: data.collection.isPublic ? undefined : { index: false } };
}

/** Ommaviy to'plam sahifasi (pleylist): postlar tartib bo'yicha, lenta kartalari bilan */
export default async function CollectionPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  const data = await getCollection(id, user ? { id: user.id, role: user.role } : null);
  if (!data) notFound();
  const { collection: c, items, canManage } = data;

  return (
    <div className="container-x animate-fade-up">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 border-b border-line pb-5">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-3">
            <ListVideo size={14} /> To&apos;plam · {c.itemsCount} ta post
            {!c.isPublic && (
              <span className="inline-flex items-center gap-1 text-fg-4">
                <Lock size={12} /> yopiq
              </span>
            )}
            {c.isPublic && <Globe size={12} className="text-fg-4" />}
          </p>
          <h1 className="display-xl mt-2 text-fg">{c.title}</h1>
          {c.description && <p className="mt-2 text-[14px] leading-relaxed text-fg-2">{c.description}</p>}
          {c.owner && <p className="mt-2 text-[13px] text-fg-3">Muallif: {c.owner.name}</p>}
          {canManage && (
            <Link href="/kabinet/toplamlar" className="mt-3 inline-block text-[13px] font-semibold text-fg-2 underline-offset-2 hover:underline">
              To&apos;plamlarni boshqarish
            </Link>
          )}
        </header>
        {items.length === 0 ? (
          <p className="card p-8 text-center text-[14px] text-fg-3">To&apos;plam hali bo&apos;sh.</p>
        ) : (
          <HomeFeed initial={{ items, nextCursor: null }} loggedIn={Boolean(user)} source={`/api/toplamlar/${c.id}/feed`} emptyTitle="To'plam bo'sh" />
        )}
      </div>
    </div>
  );
}
