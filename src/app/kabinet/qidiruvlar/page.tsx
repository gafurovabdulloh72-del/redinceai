import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bookmark, Search } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { MAX_SAVED_SEARCHES, listSavedSearches } from "@/lib/saved-searches";
import { SavedSearchList } from "./SavedSearchList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saqlangan qidiruvlar" };

/** Saqlangan qidiruvlar (F53): ochish, nomini o'zgartirish, bildirishnomani yoqish/o'chirish, o'chirish */
export default async function SavedSearchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/qidiruvlar"));

  const items = await listSavedSearches(user.id);

  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <span className="eyebrow">
          <Bookmark size={13} className="text-accent" /> Kabinet
        </span>
        <h1 className="display-xl mt-5 text-[32px] text-fg sm:text-[40px]">
          Saqlangan <span className="accent-serif text-accent">qidiruvlar</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">
          {items.length > 0
            ? `${items.length} / ${MAX_SAVED_SEARCHES} ta qidiruv. Bildirishnoma yoqilgan bo'lsa, filtrga mos yangi mutaxassis paydo bo'lganda xabar beramiz.`
            : "Mutaxassislar ro'yxatida filtrlarni tanlab, «Qidiruvni saqlash» tugmasini bosing — yangi mos mutaxassislar haqida xabar olasiz."}
        </p>
      </header>

      {items.length > 0 ? (
        <SavedSearchList initial={items} />
      ) : (
        <EmptyState
          icon={Bookmark}
          title="Hali saqlangan qidiruv yo'q"
          description="Masalan: «Samarqanddagi to'y videograflari, 3 mln gacha» — saqlang va yangilarini o'tkazib yubormang."
          action={
            <ButtonLink href="/mutaxassislar">
              <Search size={15} /> Mutaxassislarni qidirish
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
