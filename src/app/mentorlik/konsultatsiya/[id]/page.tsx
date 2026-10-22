import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { mentorSlots, users } from "@/lib/db/schema";
import { ConsultJoin } from "@/components/mentorship/ConsultJoin";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Konsultatsiya", robots: { index: false, follow: false } };

export default async function ConsultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(`/mentorlik/konsultatsiya/${id}`));
  const slot = await db.query.mentorSlots.findFirst({ where: eq(mentorSlots.id, id), with: { mentor: { columns: { userId: true, slug: true }, with: { user: { columns: { name: true } } } } } });
  if (!slot || slot.status !== "booked" || (slot.bookedBy !== user.id && slot.mentor.userId !== user.id && user.role !== "admin")) notFound();
  const buyer = slot.bookedBy ? await db.query.users.findFirst({ where: eq(users.id, slot.bookedBy), columns: { name: true } }) : null;
  const mentorSide = slot.mentor.userId === user.id;
  const title = `Konsultatsiya: ${mentorSide ? (buyer?.name ?? "talaba") : slot.mentor.user.name}`;
  return (
    <div className="container-x py-8">
      <div className="card mx-auto max-w-md p-6 text-center">
        <h1 className="font-display text-[22px] font-bold text-fg">1:1 konsultatsiya</h1>
        <p className="mt-2 text-[15px] text-fg-2">{mentorSide ? `Talaba: ${buyer?.name ?? "—"}` : `Ustoz: ${slot.mentor.user.name}`}</p>
        <p className="mt-1 text-[14px] text-fg-3">{formatDateTime(slot.startsAt.getTime())} · {slot.durationMin} daqiqa</p>
        {slot.note && <p className="mt-2 text-[13.5px] text-fg-3">{slot.note}</p>}
        <div className="mt-5 flex justify-center">
          <ConsultJoin id={slot.id} startsAt={slot.startsAt.getTime()} durationMin={slot.durationMin} title={title} />
        </div>
        {slot.mentor.slug && <Link href={`/mentorlik/ustoz/${slot.mentor.slug}`} className="mt-4 inline-block text-[13px] font-semibold text-fg-3 hover:text-fg">Ustoz sahifasi</Link>}
      </div>
    </div>
  );
}
