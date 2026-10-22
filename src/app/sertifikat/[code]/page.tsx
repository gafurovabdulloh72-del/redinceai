import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCertificate } from "@/lib/mentorship/learning";
import { PrintButton } from "@/components/mentorship/PrintButton";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const c = await getCertificate(code);
  if (!c) return { title: "Sertifikat topilmadi", robots: { index: false } };
  return { title: `${c.student} — ${c.course} sertifikati`, description: `${c.student} «${c.course}» kursini muvaffaqiyatli tugatdi. Sertifikat raqami ${c.code}.`, robots: { index: false } };
}

/** Ommaviy sertifikat: raqami bo'yicha tekshiriladi; «Chop etish / PDF» tugmasi brauzer orqali PDF qilib saqlaydi */
export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const c = await getCertificate(code);
  if (!c) notFound();
  return (
    <div className="container-x py-6">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <p className="text-[13px] font-semibold text-success-text">✓ Sertifikat haqiqiy — Kasb Egalari platformasi tomonidan berilgan</p>
          <PrintButton />
        </div>
        <article className="cert relative aspect-[1.414/1] overflow-hidden rounded-[8px] border-[10px] border-[#1a1a1c] bg-[#fbfaf6] p-[5%] text-[#1a1a1c] print:rounded-none" style={{ colorScheme: "light" }}>
          <div className="flex h-full flex-col items-center justify-between border border-[#1a1a1c]/25 px-[4%] py-[3%] text-center">
            <p className="text-[clamp(10px,1.4vw,14px)] font-bold uppercase tracking-[0.35em]">Kasb Egalari</p>
            <div>
              <p className="text-[clamp(11px,1.5vw,15px)] uppercase tracking-[0.25em] text-[#1a1a1c]/60">Sertifikat</p>
              <p className="mt-[2%] text-[clamp(11px,1.3vw,14px)] text-[#1a1a1c]/60">Ushbu sertifikat egasi</p>
              <h1 className="mt-[1%] font-display text-[clamp(24px,5vw,52px)] font-extrabold leading-tight">{c.student}</h1>
              <p className="mt-[2%] text-[clamp(11px,1.4vw,15px)] text-[#1a1a1c]/70">quyidagi kursni muvaffaqiyatli tugatganini tasdiqlaydi</p>
              <h2 className="mt-[1.5%] text-[clamp(16px,2.8vw,28px)] font-bold leading-snug">«{c.course}»</h2>
              <p className="mt-[1.5%] text-[clamp(10px,1.2vw,13px)] text-[#1a1a1c]/60">{c.lessons} ta dars · barcha testlar muvaffaqiyatli topshirilgan</p>
            </div>
            <div className="grid w-full grid-cols-3 items-end gap-3 text-[clamp(9px,1.1vw,12px)]">
              <div className="text-left">
                <p className="font-semibold">{formatDate(new Date(c.issuedAt))}</p>
                <p className="text-[#1a1a1c]/55">Berilgan sana</p>
              </div>
              <div>
                <p className="font-semibold tracking-widest">{c.code}</p>
                <p className="text-[#1a1a1c]/55">Sertifikat raqami</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{c.mentor}</p>
                <p className="text-[#1a1a1c]/55">Ustoz</p>
              </div>
            </div>
          </div>
        </article>
        <p className="mt-4 text-center text-[13px] text-fg-3 print:hidden">
          <Link href={`/mentorlik/${c.courseSlug}`} className="font-semibold text-fg-2 hover:text-fg">Kurs sahifasi</Link>
          {c.mentorSlug && <> · <Link href={`/mentorlik/ustoz/${c.mentorSlug}`} className="font-semibold text-fg-2 hover:text-fg">Ustoz sahifasi</Link></>}
        </p>
      </div>
    </div>
  );
}
