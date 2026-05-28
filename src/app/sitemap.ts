/**
 * /sitemap.xml — auto-generated. Lists every public, indexable URL on
 * the site so search engines crawl them. Private routes (/api/*,
 * /debate/*, /results/*, /admin) are excluded by proxy.ts's
 * X-Robots-Tag, so they don't appear here either.
 */
import type { MetadataRoute } from "next";
import { listArticles } from "@/lib/blog/loader";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://debatethisnow.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    { path: "/", priority: 1.0, freq: "daily" as const },
    { path: "/blog", priority: 0.8, freq: "weekly" as const },
    { path: "/how-it-works", priority: 0.7, freq: "monthly" as const },
    { path: "/leaderboard", priority: 0.6, freq: "daily" as const },
    { path: "/bots", priority: 0.6, freq: "weekly" as const },
    { path: "/login", priority: 0.4, freq: "yearly" as const },
    { path: "/register", priority: 0.4, freq: "yearly" as const },
    { path: "/terms", priority: 0.2, freq: "yearly" as const },
    { path: "/privacy", priority: 0.2, freq: "yearly" as const },
  ];

  const articles = listArticles().filter((a) => !a.redirect_to);
  const articleEntries = articles.map((a) => ({
    url: `${BASE_URL}/blog/${a.slug}`,
    lastModified: a.date ? new Date(a.date) : new Date(),
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  return [
    ...staticPaths.map((p) => ({
      url: `${BASE_URL}${p.path}`,
      lastModified: new Date(),
      changeFrequency: p.freq,
      priority: p.priority,
    })),
    ...articleEntries,
  ];
}
