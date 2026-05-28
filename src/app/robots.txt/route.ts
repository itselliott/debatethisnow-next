/**
 * /robots.txt — gate non-public surfaces, advertise the sitemap.
 *
 * Allow everything by default, then disallow the private and per-user
 * stuff (API, live debate rooms, results pages, admin). The blog is
 * explicitly allowed via a redundant Allow rule so any future Disallow
 * sweep can't accidentally take it offline — the blog is our SEO surface
 * and must stay indexable.
 *
 * The Sitemap line points crawlers at the auto-generated sitemap.xml so
 * they pick up every article on the first crawl rather than having to
 * discover them via internal links.
 */
const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://debatethisnow.com";

export function GET() {
  const body =
    "User-agent: *\n" +
    "Allow: /\n" +
    "Allow: /blog\n" +
    "Allow: /blog/\n" +
    "Disallow: /api/\n" +
    "Disallow: /debate/\n" +
    "Disallow: /results/\n" +
    "Disallow: /admin\n" +
    "\n" +
    `Sitemap: ${BASE_URL}/sitemap.xml\n`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
