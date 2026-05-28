/**
 * GET /api/matchmaking/topics — first 20 of TRENDING_TOPICS.
 * Mirrors [app/routes/matchmaking.py:46].
 */
import { NextResponse } from "next/server";
import { trendingTopics } from "@/lib/services/matchmaking-service";

export async function GET() {
  return NextResponse.json({ topics: trendingTopics(20) });
}
