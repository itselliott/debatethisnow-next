/**
 * GET /api/i18n/languages — list of available languages + default.
 * Mirrors [app/routes/i18n.py:8].
 */
import { NextResponse } from "next/server";
import { LANGUAGES, DEFAULT_LANG } from "@/lib/i18n/bundle";

export async function GET() {
  return NextResponse.json({
    default: DEFAULT_LANG,
    languages: LANGUAGES,
  });
}
