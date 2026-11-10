import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { Avatar } from "@/components/ui";
import { QuestionThread } from "@/components/qa/QuestionThread";
import { getVerifiedSession } from "@/lib/auth";
import { getQuestion } from "@/lib/qa/service";
import { timeAgo } from "@/lib/utils";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { SAVOL } from "@/lib/i18n/dict/community";

import { jsonLdHtml } from "@/lib/seo/json-ld";
export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const q = await getQuestion(id, null);
  if (!q) return { title: "Savol topilmadi" };
  return { title: q.title.slice(0, 70), description: (q.body || q.title).slice(0, 160), alternates: { canonical: `/savollar/${id}` }, other: { "m-title": "Maslahat" } };
}

export default async function QuestionPage({ params }: { params: Params }) {
  const { id } = await params;
  const [til, session] = await Promise.all([getLocale(), getVerifiedSession()]);
  const q = await getQuestion(id, session?.sub ?? null, { countView: true });
  if (!q) notFound();
  // QAPage JSON-LD — Google'da savol-javob rich natijasi uchun (acceptedAnswer = «Eng foydali»)
  const toLd = (a: (typeof q.answers)[number]) => ({
    "@type": "Answer",
    text: a.body.slice(0, 2000),
    upvoteCount: a.upvotesCount,
    dateCreated: new Date(a.createdAt).toISOString(),
    author: { "@type": "Person", name: a.author.name },
  });
  const accepted = q.answers.find((a) => a.isAccepted);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: q.title,
      text: q.body || q.title,
      answerCount: q.answersCount,
      dateCreated: new Date(q.createdAt).toISOString(),
      author: { "@type": "Person", name: q.author.name },
      ...(accepted ? { acceptedAnswer: toLd(accepted) } : {}),
      suggestedAnswer: q.answers.filter((a) => !a.isAccepted).slice(0, 10).map(toLd),
    },
  };
  return (
    <div className="container-x animate-fade-up py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <Link href="/savollar" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 transition hover:text-fg">
        <ArrowLeft size={15} /> {tr(til, SAVOL.title)}
      </Link>
      <header className="mb-5">
        <h1 className="text-[22px] font-bold leading-snug text-fg max-sm:text-[18px]">{q.title}</h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-fg-3">
          <span className="inline-flex items-center gap-1.5 font-semibold text-fg-2">
            <Avatar name={q.author.name} src={q.author.avatarUrl} size={22} decorative />
            {q.author.slug ? (
              <Link href={`/mutaxassislar/${q.author.slug}`} className="hover:underline">
                {q.author.name}
              </Link>
            ) : (
              q.author.name
            )}
          </span>
          {q.author.title && <span>{q.author.title}</span>}
          {q.categoryName && <span className="rounded-full border border-line px-2 py-px text-[11.5px]">{q.categoryName}</span>}
          <span>{timeAgo(q.createdAt)}</span>
          <span className="inline-flex items-center gap-1">
            <Eye size={13} /> {q.viewsCount}
          </span>
        </div>
        {q.body && <p className="mt-3 max-w-2xl whitespace-pre-line text-[14.5px] leading-relaxed text-fg-2">{q.body}</p>}
      </header>
      <QuestionThread initial={q} viewer={session ? { id: session.sub, isAdmin: session.role === "admin" } : null} />
    </div>
  );
}
