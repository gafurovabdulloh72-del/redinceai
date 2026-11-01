import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Crown, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { ChallengeView } from "@/components/challenges/ChallengeView";
import { getVerifiedSession } from "@/lib/auth";
import { getChallenge } from "@/lib/challenges/service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const c = await getChallenge(id, null);
  if (!c) return { title: "Konkurs topilmadi" };
  return { title: c.title, description: c.description.slice(0, 160) || "Kasb Egalari ijod konkursi", alternates: { canonical: `/konkurs/${id}` }, other: { "m-title": "Konkurs" } };
}

export default async function ChallengePage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await getVerifiedSession();
  const c = await getChallenge(id, session?.sub ?? null);
  if (!c) notFound();
  return (
    <div className="container-x animate-fade-up py-6">
      <Link href="/konkurs" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 transition hover:text-fg">
        <ArrowLeft size={15} /> Konkurslar
      </Link>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="display-xl text-fg max-sm:hidden">{c.title}</h1>
          <h2 className="hidden text-[18px] font-bold text-fg max-sm:block">{c.title}</h2>
          {c.state === "open" && <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-success-text">Ochiq</span>}
          {c.state === "done" && <span className="rounded-full bg-fg/6 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-fg-3">Yakunlangan</span>}
        </div>
        {c.description && <p className="mt-2 max-w-2xl whitespace-pre-line text-[14px] leading-relaxed text-fg-2">{c.description}</p>}
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-fg-3">
          <span className="inline-flex items-center gap-1.5">
            <Users size={14} /> {c.entriesCount} ta ish
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock size={14} /> {formatDate(new Date(c.startsAt))} — {formatDate(new Date(c.endsAt))}
          </span>
          {c.winner && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
              <Crown size={14} className="text-accent" /> G&apos;olib: {c.winner.name}
              <Avatar name={c.winner.name} src={c.winner.avatarUrl} size={20} decorative />
            </span>
          )}
        </p>
      </header>
      <ChallengeView initial={c} authed={Boolean(session)} />
    </div>
  );
}
