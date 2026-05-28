/**
 * /ads.txt — required by AdSense (+ most ad networks) to declare which
 * sellers are authorized to monetize this site's inventory. When
 * ADSENSE_CLIENT_ID is unset we serve a comment-only file so we never
 * 404 the AdSense crawler.
 * Mirrors [app/routes/pages.py:87].
 */
import { env } from "@/lib/env";

export function GET() {
  const lines: string[] = [];
  const client = (env.ADSENSE_CLIENT_ID ?? "").trim();
  if (client) {
    const pubNum = client.replace(/^ca-pub-/, "").replace(/^pub-/, "");
    lines.push(`google.com, pub-${pubNum}, DIRECT, f08c47fec0942fa0`);
  }
  const extras = (env.EXTRA_ADS_TXT_LINES ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const line of extras) lines.push(line);
  const body =
    lines.length > 0
      ? lines.join("\n") + "\n"
      : "# No ad networks configured. Set ADSENSE_CLIENT_ID in the app config\n" +
        "# (or EXTRA_ADS_TXT_LINES for other networks) to populate this file.\n";
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
