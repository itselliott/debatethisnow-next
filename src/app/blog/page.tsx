/**
 * /blog — article index, newest first. Articles with `redirect_to` in
 * the frontmatter are hidden from the index (they're keyword-canonicals
 * that 301 to the real article).
 *
 * SEO: canonical URL set, broad debate keyword stack on the listing
 * page, Blog + ItemList JSON-LD so Google treats this as a real index
 * page with N entries. Each entry's title acts as an internal anchor
 * for the corresponding article.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { listArticles } from "@/lib/blog/loader";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://debatethisnow.com";

const BLOG_KEYWORDS = [
  "debate blog",
  "debate articles",
  "debate strategy",
  "debate guide",
  "how to debate",
  "online debate",
  "debate practice",
  "debate club",
  "debate topics",
  "AI debate",
  "Lincoln-Douglas debate",
  "Public Forum debate",
  "policy debate",
  "Congressional debate",
  "debate coach",
  "debate tournament",
  "debate format",
  "argument structure",
  "speech and debate",
  "competitive debate",
  "debate tactics",
  "debate skills",
  "debate training",
];

export const metadata: Metadata = {
  title: "Debate Blog — Strategy, Formats, Tools",
  description:
    "In-depth guides on debate strategy, formats (PF, LD, Policy, Congressional), online practice tools, club building, and AI debate coaching. Free to read.",
  keywords: BLOG_KEYWORDS,
  alternates: { canonical: `${BASE_URL}/blog` },
  openGraph: {
    title: "Debate Blog — DebateThis",
    description:
      "Guides on debate strategy, formats, tools, and online communities. Updated regularly.",
    type: "website",
    url: `${BASE_URL}/blog`,
    siteName: "DebateThis",
    images: [{ url: `${BASE_URL}/og-default.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Debate Blog — DebateThis",
    description:
      "Guides on debate strategy, formats, tools, and online communities.",
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
    },
  },
};

export const dynamic = "force-static";

export default function BlogIndexPage() {
  const articles = listArticles().filter((a) => !a.redirect_to);

  // Blog + ItemList JSON-LD. Tells Google "this URL is a blog index
  // with N posts, here's each one's headline + URL". Improves how the
  // /blog page itself ranks for queries like "debate blog".
  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "DebateThis Blog",
    description:
      "Guides on debate strategy, formats, tools, and online communities.",
    url: `${BASE_URL}/blog`,
    publisher: {
      "@type": "Organization",
      name: "DebateThis",
      url: BASE_URL,
    },
    blogPost: articles.slice(0, 50).map((a) => ({
      "@type": "BlogPosting",
      headline: a.title,
      description: a.description,
      url: `${BASE_URL}/blog/${a.slug}`,
      datePublished: a.date || undefined,
      keywords: a.tags.join(", "),
    })),
  };

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Field notes
        </span>
        <h1 className="mt-1 font-display text-4xl">Debate Blog</h1>
        <p className="text-sm text-sepia">
          Strategy, formats, history, and how to be less wrong on stage.
          {" "}
          Free guides on Public Forum, Lincoln-Douglas, Policy, and Congressional
          debate, plus AI practice tools and club-building playbooks.
        </p>
      </header>
      {articles.length === 0 ? (
        <p className="text-sm text-sepia">No articles yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {articles.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/blog/${a.slug}`}
                className="block h-full rounded border border-ink bg-paper-2 p-4 shadow-press transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-press-sm"
              >
                <div className="font-condensed text-[11px] uppercase tracking-wider text-sepia">
                  {a.date || "—"}
                </div>
                <h2 className="mt-1 font-display text-xl leading-tight">
                  {a.title}
                </h2>
                {a.description ? (
                  <p className="mt-2 text-sm text-sepia">{a.description}</p>
                ) : null}
                {a.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {a.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-paper px-2 py-0.5 font-condensed text-[10px] uppercase tracking-wider text-ink"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
