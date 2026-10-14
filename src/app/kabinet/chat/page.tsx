import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { DmChat } from "@/components/chat/DmChat";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Chat" };

/** Ichki chat: suhbatlar ro'yxati + yozishmalar. ?s=<id> — ochib qo'yiladigan suhbat (bildirishnoma havolasidan) */
export default async function ChatPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={
          <>
            <MessageCircle size={13} className="text-accent" /> Chat
          </>
        }
        title={
          <>
            Xabarlar — <span className="accent-serif text-accent">to'g'ridan-to'g'ri</span>
          </>
        }
        description="Mutaxassislar va mijozlar bilan buyurtmadan tashqari ham yozishing. Suhbat havolangizni profil sozlamalaridan nusxalab ulashing."
      />
      <div className="mt-6">
        <DmChat initialId={s ?? null} />
      </div>
    </div>
  );
}
