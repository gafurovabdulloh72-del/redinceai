import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListVideo } from "lucide-react";
import { CollectionsManager } from "@/components/social/CollectionsManager";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { listCollections } from "@/lib/social/library";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "To'plamlar" };

/** To'plamlar (pleylist): post to'plamlari — ommaviylari profilda ham ko'rinadi */
export default async function CollectionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/toplamlar"));
  const items = await listCollections(user.id, false);

  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <h1 className="display-xl flex items-center gap-2 text-fg">
          <ListVideo size={22} className="text-fg-3" /> To&apos;plamlar
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">Postlarni mavzular bo&apos;yicha to&apos;plamga yig&apos;ing. Ommaviy to&apos;plamni havola orqali ulashish mumkin.</p>
      </header>
      <CollectionsManager initial={items} />
    </div>
  );
}
