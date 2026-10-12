import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Heart, Map } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { SpecialistCard } from "@/components/specialists/SpecialistCard";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { listFavoriteSpecialists } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sevimlilar" };

/** Saqlangan mutaxassislar — kartadagi yurak qayta bosilsa ro'yxatdan chiqadi (keyingi ochilishda yo'qoladi) */
export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/sevimlilar"));

  const items = await listFavoriteSpecialists(user.id, { userId: user.id, role: user.role });

  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <span className="eyebrow">
          <Heart size={13} className="text-accent" /> Kabinet
        </span>
        <h1 className="display-xl mt-5 text-[32px] text-fg sm:text-[40px]">
          Sevimli <span className="accent-serif text-accent">mutaxassislar</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">
          {items.length > 0
            ? `${items.length} ta saqlangan profil. Yurakni qayta bosib ro'yxatdan olib tashlashingiz mumkin.`
            : "Yoqqan mutaxassislarni yurak belgisi bilan saqlang — keyin shu yerdan tez topasiz."}
        </p>
      </header>

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((sp, i) => (
            <SpecialistCard key={sp.id} sp={sp} priority={i < 3} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Heart}
          title="Hali sevimlilar yo'q"
          description="Xarita yoki ro'yxatdan mutaxassis tanlab, kartadagi yurakni bosing."
          action={
            <ButtonLink href="/xarita">
              <Map size={15} /> Xaritadan tanlash
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
