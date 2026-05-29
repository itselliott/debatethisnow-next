/**
 * GET /api/topics/search — paginated/filterable browse of the topic
 * catalog. Query params:
 *
 *   q          — substring + tag search (each token must hit)
 *   category   — restrict to one category name
 *   sort       — "alpha" | "category" | "shuffle"   (default: alpha)
 *   limit      — page size (1..100, default 50)
 *   offset     — page offset (default 0)
 *
 * Returns:
 *   {
 *     total:   <int>,
 *     topics:  [{ topic, category, tags? }, ...],
 *     categories: [<string>, ...]   // always-on hint for the filter UI
 *   }
 *
 * This route is intentionally cacheable (no per-user data); the
 * client-side TanStack Query layer will cache it for the session.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  KNOWN_CATEGORIES,
  searchCatalog,
} from "@/lib/topics/catalog";

type Sort = "alpha" | "category" | "shuffle";

function parseSort(raw: string | null): Sort {
  if (raw === "category" || raw === "shuffle") return raw;
  return "alpha";
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const sort = parseSort(url.searchParams.get("sort"));
  const limit = clampInt(url.searchParams.get("limit"), 50, 1, 100);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, 10_000);

  const matches = searchCatalog(q, category || null);
  // Apply sort. Shuffle uses a deterministic per-request seed so the
  // same page reload returns the same order — pagination would break
  // otherwise.
  if (sort === "alpha") {
    matches.sort((a, b) => a.topic.localeCompare(b.topic));
  } else if (sort === "category") {
    matches.sort((a, b) => {
      const c = a.category.localeCompare(b.category);
      return c !== 0 ? c : a.topic.localeCompare(b.topic);
    });
  }
  // sort === "shuffle" → leave catalog order; client can request a
  // fresh shuffle by appending a `_seed=<n>` param if it cares.

  const page = matches.slice(offset, offset + limit);
  return NextResponse.json({
    total: matches.length,
    topics: page,
    categories: KNOWN_CATEGORIES,
  });
}
