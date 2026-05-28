/**
 * GET /api/i18n/<lang> — translation bundle. Unknown lang falls back to
 * DEFAULT_LANG so a typo never 404s the UI.
 * Mirrors [app/routes/i18n.py:16].
 */
import { NextResponse } from "next/server";
import {
  DEFAULT_LANG,
  TRANSLATIONS,
  getBundle,
} from "@/lib/i18n/bundle";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  const effective = lang in TRANSLATIONS ? lang : DEFAULT_LANG;
  return NextResponse.json({
    lang: effective,
    strings: getBundle(effective),
  });
}
