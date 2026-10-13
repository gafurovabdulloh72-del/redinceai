import { notFound, permanentRedirect } from "next/navigation";
import { slugByShortCode } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Qisqa havola (F66): /u/AB12CD → 308 /mutaxassislar/<slug>. Kod katta-kichik harf farqsiz. */
export default async function ShortLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const slug = await slugByShortCode(code);
  if (!slug) notFound();
  permanentRedirect(`/mutaxassislar/${slug}`);
}
