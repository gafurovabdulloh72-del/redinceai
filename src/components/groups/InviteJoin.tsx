"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import type { MembershipState } from "@/lib/groups/service";

/**
 * ?invite=KOD bilan kelgan foydalanuvchi: kirgan bo'lsa — avtomatik qo'shiladi (yopiq jamoaga ham), URL tozalanadi;
 * kirmagan bo'lsa — kirish/ro'yxat havolasi (invite saqlanib qoladi).
 */
export function InviteJoin({ slug, invite, membership, loggedIn }: { slug: string; invite: string; membership: MembershipState; loggedIn: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const done = useRef(false);
  const active = membership === "owner" || membership === "admin" || membership === "member";

  useEffect(() => {
    if (!loggedIn || active || done.current) return;
    done.current = true;
    (async () => {
      const res = await fetch(`/api/groups/${encodeURIComponent(slug)}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invite }) });
      const j = (await res.json()) as { ok: boolean; data?: { membership: MembershipState }; error?: string };
      if (j.ok && j.data?.membership && j.data.membership !== "pending") toast("Taklif qabul qilindi — siz a'zosiz");
      else if (j.ok) toast("So'rov yuborildi — taklif havolasi eskirgan bo'lishi mumkin", "info");
      else toast(j.error || "Qo'shilib bo'lmadi", "error");
      router.replace(`/jamoalar/${slug}`);
      router.refresh();
    })();
  }, [loggedIn, active, slug, invite, router, toast]);

  if (loggedIn || active) return null;
  const next = encodeURIComponent(`/jamoalar/${slug}?invite=${invite}`);
  return (
    <div role="status" className="card expand-in mt-4 flex flex-wrap items-center gap-3 px-4 py-3 text-[13.5px]">
      <span className="font-semibold text-fg">Sizni taklif qilishdi.</span>
      <span className="text-fg-2">Qo&apos;shilish uchun kiring yoki hisob oching.</span>
      <span className="ml-auto flex gap-2">
        <Link href={`/auth/kirish?next=${next}`} className="btn-ink inline-flex h-9 items-center rounded-full px-4 text-[13px] font-semibold">
          Kirish
        </Link>
        <Link href={`/auth/royxat?next=${next}`} className="inline-flex h-9 items-center rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg">
          Ro&apos;yxatdan o&apos;tish
        </Link>
      </span>
    </div>
  );
}
