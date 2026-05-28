/**
 * /blog/[slug] — single article. Renders the markdown body via
 * react-markdown + remark-gfm. Honors `redirect_to` for keyword
 * canonicalization (301 to the real article).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { listArticles, loadArticle } from "@/lib/blog/loader";

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
  return {
    title: `${article.title} · DebateThis`,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      publishedTime: article.date || undefined,
      tags: article.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
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
  const related = listArticles()
    .filter((a) => a.slug !== article.slug && !a.redirect_to)
    .slice(0, 6);
  return (
    <article className="space-y-6">
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
          {article.date ? <span>{article.date}</span> : null}
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
            a: (props) => (
              <a
                className="text-red underline decoration-2 underline-offset-2 hover:text-red-dark"
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
          }}
        >
          {article.body}
        </ReactMarkdown>
      </div>

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
