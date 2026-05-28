/**
 * /blog/[slug] — single article. Heavy SEO surface:
 *
 *  - Static-rendered (every article pre-generated)
 *  - Canonical URL set on the metadata
 *  - Rich OG + Twitter cards
 *  - Keyword stack = site-wide debate keywords + per-article tags
 *  - BlogPosting JSON-LD with publisher, dates, mainEntityOfPage, keywords
 *  - BreadcrumbList JSON-LD for Home > Blog > <article>
 *  - rehype-raw enables in-markdown CTA blocks (<div class="cta-inline">)
 *  - `redirect_to` frontmatter still does 301 keyword canonicalization
 *
 * The whole site is debate-focused, so the keyword tier blends site-wide
 * canonical debate terms with article-specific tags. This is what the
 * user means by "damn near any reference of debate" — every article
 * carries the full debate keyword surface, not just its own slug.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { listArticles, loadArticle } from "@/lib/blog/loader";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://debatethisnow.com";

// Canonical site-wide debate keyword stack. Combined with each article's
// own frontmatter tags so every article ranks for both its own niche
// (e.g. "Lincoln-Douglas debate") AND broad terms ("debate", "online
// debate", "debate practice"). Keep this list curated, not 200 items —
// stuffing past ~30 is counterproductive.
const SITE_DEBATE_KEYWORDS = [
  "debate",
  "online debate",
  "debate practice",
  "debate game",
  "debate app",
  "debate platform",
  "AI debate",
  "AI debate practice",
  "debate against AI",
  "debate club",
  "debate topics",
  "debate training",
  "argue online",
  "argument practice",
  "competitive debate",
  "Lincoln-Douglas debate",
  "policy debate",
  "Public Forum debate",
  "PF debate",
  "Congressional debate",
  "debate skills",
  "debate coaching",
  "speech and debate",
  "free debate practice",
  "debate tournament",
  "debate Elo",
  "structured argument",
  "1v1 debate",
];

export async function generateStaticParams() {
  return listArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = loadArticle(slug);
  if (!article) return { title: "Not found · DebateThis" };
  const url = `${BASE_URL}/blog/${article.slug}`;
  // Dedupe + cap. Article-specific keywords come first so they get more
  // weight; site-wide debate terms follow.
  const keywords = Array.from(
    new Set([...article.tags, ...SITE_DEBATE_KEYWORDS]),
  ).slice(0, 40);
  return {
    title: article.title,
    description: article.description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      url,
      siteName: "DebateThis",
      publishedTime: article.date || undefined,
      modifiedTime: article.date || undefined,
      tags: article.tags,
      images: [
        {
          url: `${BASE_URL}/og-default.png`,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: [`${BASE_URL}/og-default.png`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export const dynamic = "force-static";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = loadArticle(slug);
  if (!article) notFound();
  if (article.redirect_to) {
    permanentRedirect(`/blog/${article.redirect_to}`);
  }
  const url = `${BASE_URL}/blog/${article.slug}`;
  const all = listArticles().filter((a) => !a.redirect_to);
  const related = all.filter((a) => a.slug !== article.slug).slice(0, 6);

  // BlogPosting JSON-LD. Search engines surface these as rich results;
  // crucially `keywords` here reinforces the meta keywords, and
  // `mainEntityOfPage` declares the canonical URL for this article.
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    datePublished: article.date || undefined,
    dateModified: article.date || undefined,
    author: {
      "@type": "Organization",
      name: "DebateThis",
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "DebateThis",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/og-default.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    url,
    keywords: Array.from(
      new Set([...article.tags, ...SITE_DEBATE_KEYWORDS]),
    ).join(", "),
    image: `${BASE_URL}/og-default.png`,
    articleSection: "Debate",
    inLanguage: "en-US",
    isAccessibleForFree: true,
  };

  // BreadcrumbList JSON-LD. Helps Google show "Home > Blog > Title"
  // breadcrumb chips in the SERP.
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: BASE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${BASE_URL}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: url,
      },
    ],
  };

  return (
    <article className="space-y-6">
      {/*
        Two inline JSON-LD blocks. Next.js supports raw <script> with
        application/ld+json type inside Server Components — search bots
        pick these up at static-render time. Stringified once so any
        future schema fields are auto-included.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <header className="border-b-[3px] border-double border-ink pb-4">
        <Link
          href="/blog"
          className="font-condensed text-xs uppercase tracking-wider text-red hover:underline"
        >
          ← All articles
        </Link>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">
          {article.title}
        </h1>
        {article.description ? (
          <p className="mt-1 text-base text-sepia">{article.description}</p>
        ) : null}
        <div className="mt-2 flex items-center gap-3 text-xs text-sepia">
          {article.date ? (
            <time dateTime={article.date}>{article.date}</time>
          ) : null}
          {article.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {article.tags.map((t) => (
                <span
                  key={t}
                  className="rounded bg-paper-3 px-2 py-0.5 font-condensed text-[10px] uppercase tracking-wider text-ink"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <div className="prose-blog max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          // rehype-raw is what lets the in-markdown <div class="cta-inline">
          // blocks render as real HTML instead of being stripped. The blog
          // content is trusted (markdown files we author + commit), so
          // there's no XSS concern from passing it through.
          rehypePlugins={[rehypeRaw]}
          components={{
            h2: (props) => (
              <h2 className="mt-8 mb-3 font-display text-2xl text-ink" {...props} />
            ),
            h3: (props) => (
              <h3 className="mt-6 mb-2 font-display text-xl text-ink" {...props} />
            ),
            p: (props) => (
              <p className="my-3 leading-relaxed text-ink" {...props} />
            ),
            a: ({ className, ...props }) => (
              // Skip the auto-styling for `.btn` CTAs — globals.css owns
              // those. Plain links get the inline red underline.
              <a
                className={
                  className?.includes("btn")
                    ? className
                    : "text-red underline decoration-2 underline-offset-2 hover:text-red-dark"
                }
                {...props}
              />
            ),
            ul: (props) => (
              <ul className="my-3 list-disc space-y-1 pl-6" {...props} />
            ),
            ol: (props) => (
              <ol className="my-3 list-decimal space-y-1 pl-6" {...props} />
            ),
            li: (props) => <li className="leading-relaxed" {...props} />,
            blockquote: (props) => (
              <blockquote
                className="my-4 border-l-4 border-red bg-paper-3 px-4 py-2 italic"
                {...props}
              />
            ),
            code: (props) => (
              <code
                className="rounded bg-paper-3 px-1 font-mono text-sm"
                {...props}
              />
            ),
            pre: (props) => (
              <pre
                className="my-4 overflow-x-auto rounded border border-ink bg-paper-3 p-4 font-mono text-sm"
                {...props}
              />
            ),
            table: (props) => (
              <div className="my-4 overflow-x-auto">
                <table
                  className="w-full border-collapse border border-ink text-sm"
                  {...props}
                />
              </div>
            ),
            th: (props) => (
              <th
                className="border border-ink bg-paper-3 px-3 py-2 text-left font-condensed uppercase tracking-wider"
                {...props}
              />
            ),
            td: (props) => (
              <td className="border border-ink px-3 py-2" {...props} />
            ),
          }}
        >
          {article.body}
        </ReactMarkdown>
      </div>

      {/* Always-present bottom CTA — even articles whose markdown lacks
          their own inline CTA convert here. */}
      <aside className="rounded border-2 border-red bg-paper-2 p-5 text-center shadow-press">
        <p className="font-display text-xl text-ink">
          Stop reading about debate — start practicing.
        </p>
        <p className="mt-1 text-sm text-sepia">
          Free Elo-ranked 1v1 debates against humans or AI bots. Three rounds.
          One winner. No coach required.
        </p>
        <Link
          href="/register"
          className="mt-3 inline-block rounded bg-red px-5 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90"
        >
          Create a Free Account ▸
        </Link>
      </aside>

      {related.length > 0 ? (
        <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
          <h2 className="mb-3 font-display text-lg">Related reading</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {related.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/blog/${a.slug}`}
                  className="block rounded border border-ink bg-paper p-2 text-sm transition-transform hover:translate-x-px hover:translate-y-px"
                >
                  <div className="font-display">{a.title}</div>
                  {a.date ? (
                    <div className="text-xs text-sepia">{a.date}</div>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
