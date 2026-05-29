"use client";

/**
 * Topics browse UI. Search + category filter + sort, paginated.
 *
 * Each topic card has a "Queue Up" link that drops the user straight
 * into matchmaking with the topic preselected — same URL convention
 * the dashboard "Trending Topics" panel uses.
 *
 * Data is fetched via TanStack Query against `/api/topics/search`,
 * so the page is fully cacheable per (q, category, sort) tuple.
 * Search is debounced 200ms to avoid spamming the API on every
 * keystroke.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useTone } from "@/lib/hooks/use-tone";
import { useTrendingTopics } from "@/lib/hooks/use-dashboard";

type SortMode = "alpha" | "category" | "shuffle";

interface TopicRow {
  topic: string;
  category: string;
  tags?: string[];
}

interface SearchResponse {
  total: number;
  topics: TopicRow[];
  categories: string[];
}

const PAGE_SIZE = 50;

export function TopicsClient({
  initialTotal,
  initialCategories,
}: {
  initialTotal: number;
  initialCategories: ReadonlyArray<string>;
}) {
  const { t } = useTone();
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [sort, setSort] = useState<SortMode>("alpha");
  const [page, setPage] = useState(0);

  // 200ms debounce — type-and-search feels live but doesn't spam the
  // API every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(rawQuery), 200);
    return () => clearTimeout(id);
  }, [rawQuery]);

  // Whenever filter/search/sort changes, reset to page 0 (showing
  // page 7 of a query that only has 2 pages is confusing).
  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, category, sort]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQuery) p.set("q", debouncedQuery);
    if (category) p.set("category", category);
    p.set("sort", sort);
    p.set("limit", String(PAGE_SIZE));
    p.set("offset", String(page * PAGE_SIZE));
    return p.toString();
  }, [debouncedQuery, category, sort, page]);

  const search = useQuery<SearchResponse>({
    queryKey: ["topics", "search", params],
    queryFn: () => apiClient.get<SearchResponse>(`/api/topics/search?${params}`),
    staleTime: 5 * 60 * 1000, // static catalog — cache for 5 min
  });

  const total = search.data?.total ?? initialTotal;
  const topics = search.data?.topics ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  void initialTotal;
  return (
    <div className="space-y-6">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Catalog
        </span>
        <h1 className="mt-1 font-display text-3xl">{t("nav_topics")}</h1>
      </header>

      {/* Trending Topics panel — same component the dashboard renders,
       * pulled in via the shared TanStack Query hook so the home page
       * and /topics never disagree on what's trending today. Sits
       * above the search box so a returning user sees today's rotation
       * before they decide whether to dig through the full catalog. */}
      <TrendingPanel />

      <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="block">
            <span className="font-condensed text-[10px] uppercase tracking-wider text-sepia">
              Search topics
            </span>
            <input
              type="search"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="e.g. AI, pizza, voting…"
              className="mt-1 w-full rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
              aria-label="Search topics"
            />
          </label>
          <label className="block">
            <span className="font-condensed text-[10px] uppercase tracking-wider text-sepia">
              Category
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded border-2 border-ink bg-paper px-3 py-2 font-condensed text-sm uppercase tracking-wider shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {initialCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-condensed text-[10px] uppercase tracking-wider text-sepia">
              Sort
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="mt-1 w-full rounded border-2 border-ink bg-paper px-3 py-2 font-condensed text-sm uppercase tracking-wider shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
              aria-label="Sort order"
            >
              <option value="alpha">A → Z</option>
              <option value="category">By category</option>
              <option value="shuffle">Random</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-baseline justify-between text-xs text-sepia">
          <span>
            {search.isLoading
              ? "Loading…"
              : `${total} ${total === 1 ? "topic" : "topics"} match`}
          </span>
          {category || debouncedQuery ? (
            <button
              type="button"
              onClick={() => {
                setRawQuery("");
                setCategory("");
              }}
              className="font-condensed uppercase tracking-wider text-red hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      {search.isError ? (
        <div
          role="alert"
          className="rounded border border-red bg-red/10 p-3 text-sm text-red-dark"
        >
          Couldn&apos;t load topics. Try a refresh.
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((t) => (
          <TopicCard key={`${t.category}::${t.topic}`} topic={t} />
        ))}
      </section>

      {topics.length === 0 && !search.isLoading ? (
        <div className="rounded border border-ink bg-paper-2 p-4 text-center text-sm text-sepia shadow-press-sm">
          No topics match. Try a different category or shorter search.
        </div>
      ) : null}

      {totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          onChange={setPage}
        />
      ) : null}
    </div>
  );
}

function TopicCard({ topic }: { topic: TopicRow }) {
  const params = new URLSearchParams();
  params.set("topic", topic.topic);
  params.set("category", topic.category);
  // Whole card is the queue link — no separate button. Matches the
  // dashboard's trending-topics card density and keeps the grid
  // scanable when 50 per page are on screen.
  return (
    <Link
      href={`/matchmaking?${params.toString()}`}
      className="block rounded border border-ink bg-paper-2 p-3 text-sm shadow-press-sm transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-none"
    >
      <span className="font-condensed text-xs uppercase tracking-wider text-red">
        {topic.category}
      </span>
      <div className="mt-1 font-body leading-snug text-ink">
        {topic.topic}
      </div>
    </Link>
  );
}

/**
 * Trending Topics — identical look + data source to the dashboard
 * panel. Pulls 10 topics from /api/debates/trending (rotated daily
 * by a UTC-date seed inside the matchmaking service).
 */
function TrendingPanel() {
  const trending = useTrendingTopics();
  const topics = trending.data?.topics ?? [];
  return (
    <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg">Trending Topics</h2>
        <span className="font-condensed text-[10px] uppercase tracking-wider text-sepia">
          Rotates daily
        </span>
      </div>
      {trending.isLoading ? (
        <p className="text-sm text-sepia">Loading…</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {topics.map((tp) => (
            <li key={tp.topic}>
              <Link
                href={`/matchmaking?topic=${encodeURIComponent(tp.topic)}&category=${encodeURIComponent(tp.category)}`}
                className="block rounded border border-ink bg-paper p-3 text-sm shadow-press-sm transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-none"
              >
                <span className="font-condensed text-xs uppercase tracking-wider text-red">
                  {tp.category}
                </span>
                <div className="mt-1 font-body text-ink">{tp.topic}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (n: number) => void;
}) {
  return (
    <nav
      aria-label="Topics pagination"
      className="flex items-center justify-center gap-2"
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        aria-label="Previous page"
        className="rounded border-2 border-ink bg-paper-2 px-3 py-1 font-condensed text-xs uppercase tracking-widest shadow-press-sm hover:bg-ink hover:text-paper disabled:opacity-40"
      >
        ◂ Prev
      </button>
      <span className="font-condensed text-xs uppercase tracking-wider text-sepia">
        Page {page + 1} / {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        aria-label="Next page"
        className="rounded border-2 border-ink bg-paper-2 px-3 py-1 font-condensed text-xs uppercase tracking-widest shadow-press-sm hover:bg-ink hover:text-paper disabled:opacity-40"
      >
        Next ▸
      </button>
    </nav>
  );
}
