/**
 * GET /api/topics/categories — list of catalog categories with the
 * topic count for each. Used by the /topics page filter dropdown.
 * Pure function of the static catalog — cacheable.
 */
import { NextResponse } from "next/server";
import {
  KNOWN_CATEGORIES,
  TOPICS_BY_CATEGORY,
} from "@/lib/topics/catalog";

export async function GET() {
  const categories = KNOWN_CATEGORIES.map((name) => ({
    name,
    count: TOPICS_BY_CATEGORY.get(name)?.length ?? 0,
  }));
  return NextResponse.json({ categories });
}
