/**
 * /blog — article index, newest first. Articles with `redirect_to` in
 * the frontmatter are hidden from the index (they're keyword-canonicals
 * that 301 to the real article).
 */
import Link from "next/link";
import type { Metadata } from "next";
import { listArticles } from "@/lib/blog/loader";

export const metadata: Metadata = {
  title: "Blog · DebateThis",
  description:
    "Articles on debate strategy, formats, tools, and online communities. Updated regularly.",
};

export const dynamic = "force-static";

export default function BlogIndexPage() {
  const articles = listArticles().filter((a) => !a.redirect_to);
  return (
    <div className="space-y-6">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Field notes
        </span>
        <h1 className="mt-1 font-display text-4xl">Blog</h1>
        <p className="text-sm text-sepia">
          Strategy, history, and how to be less wrong on stage.
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
