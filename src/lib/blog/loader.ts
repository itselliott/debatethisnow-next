/**
 * Blog article loader. Reads `.md` files from `content/blog/` with
 * gray-matter parsing the frontmatter. Mirrors [app/routes/blog.py:1-200]
 * — same frontmatter shape (title, description, date, tags, optional
 * `redirect_to`), same sort order (newest first), same draft-skip rule
 * (no title = draft, not listed).
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const ARTICLES_DIR = path.join(process.cwd(), "content", "blog");

export interface ArticleMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  redirect_to?: string;
}

export interface Article extends ArticleMeta {
  body: string;
}

function slugFromFilename(name: string): string {
  return name.endsWith(".md") ? name.slice(0, -3) : name;
}

function parseDate(d: string): number {
  if (!d) return 0;
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Normalise a frontmatter date into ISO YYYY-MM-DD form.
 *
 * YAML's unquoted-date form (`date: 2026-05-29`) is auto-parsed by
 * gray-matter into a JS Date — so a bare `String(data.date)` produces
 * "Fri May 29 2026 00:00:00 GMT+0000 (Coordinated Universal Time)",
 * which then leaks into the article header. Map back to ISO so the
 * client sees the format it expects regardless of how the frontmatter
 * was written.
 */
function isoFromFrontmatterDate(raw: unknown): string {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    // .toISOString() is yyyy-mm-ddThh:mm:ss.sssZ; slice the date head.
    return raw.toISOString().slice(0, 10);
  }
  const s = String(raw ?? "").trim();
  // Already ISO-ish? Pass through.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Anything else (e.g. "May 29, 2026") — try to parse, fall back to
  // the raw string so we never throw.
  const t = Date.parse(s);
  if (Number.isFinite(t)) return new Date(t).toISOString().slice(0, 10);
  return s;
}

export function listArticles(): ArticleMeta[] {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md"));
  const out: ArticleMeta[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), "utf-8");
    const { data } = matter(raw);
    const title = String(data.title ?? "").trim();
    if (!title) continue; // Untitled = draft, skip.
    out.push({
      slug: slugFromFilename(file),
      title,
      description: String(data.description ?? ""),
      date: isoFromFrontmatterDate(data.date),
      tags: Array.isArray(data.tags)
        ? data.tags.map((t) => String(t))
        : [],
      redirect_to:
        typeof data.redirect_to === "string" ? data.redirect_to : undefined,
    });
  }
  out.sort((a, b) => parseDate(b.date) - parseDate(a.date));
  return out;
}

export function loadArticle(slug: string): Article | null {
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!safe) return null;
  const file = path.join(ARTICLES_DIR, `${safe}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf-8");
  const { data, content } = matter(raw);
  return {
    slug: safe,
    title: String(data.title ?? safe),
    description: String(data.description ?? ""),
    date: isoFromFrontmatterDate(data.date),
    tags: Array.isArray(data.tags) ? data.tags.map((t) => String(t)) : [],
    redirect_to:
      typeof data.redirect_to === "string" ? data.redirect_to : undefined,
    body: content,
  };
}
