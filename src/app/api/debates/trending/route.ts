/**
 * GET /api/debates/trending — first 8 of TRENDING_TOPICS.
 * Mirrors [app/routes/debates.py:128].
 */
import { NextResponse } from "next/server";
import { trendingTopics } from "@/lib/services/matchmaking-service";

export async function GET() {
  return NextResponse.json({ topics: trendingTopics(20) });
}
