/**
 * /robots.txt — keep API + per-debate transcripts out of search indexes.
 * Belt-and-suspenders alongside the X-Robots-Tag header set by proxy.ts.
 * Mirrors [app/routes/pages.py:131].
 */
export function GET() {
  const body =
    "User-agent: *\n" +
    "Disallow: /api/\n" +
    "Disallow: /debate/\n" +
    "Disallow: /results/\n" +
    "Disallow: /admin\n" +
    "Allow: /\n";
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
