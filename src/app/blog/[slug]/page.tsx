import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PencilLine } from "lucide-react";
import { ArticleBody } from "@/components/blog/ArticleBody";
import { SafeImage } from "@/components/specialists/SafeImage";
import { getCurrentUser } from "@/lib/auth";
import { getArticle } from "@/lib/blog";
import { SITE } from "@/lib/constants";
import { SITE_URL } from "@/lib/site-url";
import { formatDate } from "@/lib/utils";

import { jsonLdHtml } from "@/lib/seo/json-ld";
// Yumshoq 404 qoidasi: bu papkada loading.tsx YO'Q — yo'q maqola haqiqiy 404 qaytaradi
export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) return { title: "Maqola topilmadi" };
  return {
    title: a.title.slice(0, 70),
    description: (a.excerpt || a.title).slice(0, 160),
    alternates: { canonical: `/blog/${a.slug}` },
    openGraph: a.coverUrl ? { images: [a.coverUrl.startsWith("http") ? a.coverUrl : `${SITE_URL}${a.coverUrl}`] } : undefined,
    other: { "m-title": "Blog" },
  };
}

export default async function ArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  // Admin qoralamani ham ko'radi (sahifada «Qoralama» belgisi bilan)
  const a = await getArticle(slug, isAdmin);
  if (!a) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: a.title,
        description: a.excerpt || a.title,
        ...(a.coverUrl ? { image: [a.coverUrl.startsWith("http") ? a.coverUrl : `${SITE_URL}${a.coverUrl}`] } : {}),
        datePublished: a.publishedAt ? new Date(a.publishedAt).toISOString() : undefined,
        dateModified: new Date(a.updatedAt).toISOString(),
        author: { "@type": "Organization", name: SITE.name },
        publisher: { "@type": "Organization", name: SITE.name, url: SITE_URL },
        mainEntityOfPage: `${SITE_URL}/blog/${a.slug}`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Blog", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 2, name: a.title, item: `${SITE_URL}/blog/${a.slug}` },
        ],
      },
    ],
  };

  return (
    <div className="container-x animate-fade-up max-w-3xl py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <Link href="/blog" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 transition hover:text-fg">
        <ArrowLeft size={15} /> Blog
      </Link>
      <article>
        <header>
          {!a.isPublished && (
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-[12px] font-bold text-warning-text">
              <PencilLine size={13} /> Qoralama — faqat adminlar ko&apos;radi
            </p>
          )}
          <h1 className="font-display text-[26px] font-bold leading-tight text-fg sm:text-[32px]">{a.title}</h1>
          <p className="mt-2.5 text-[13px] text-fg-3">
            {a.publishedAt ? formatDate(new Date(a.publishedAt)) : "E'lon qilinmagan"}
            {a.authorName ? ` · ${a.authorName}` : ""}
          </p>
        </header>
        {a.coverUrl && (
          <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-[16px] bg-surface-2 max-sm:-mx-4 max-sm:rounded-none">
            <SafeImage optimize={828} priority src={a.coverUrl} alt={a.title} className="absolute inset-0 h-full w-full object-cover" />
          </div>
        )}
        <div className="mt-6">
          <ArticleBody body={a.body} />
        </div>
      </article>
    </div>
  );
}
