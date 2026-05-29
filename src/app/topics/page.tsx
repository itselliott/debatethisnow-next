/**
 * /topics — browseable catalog of debate topics. Search, filter by
 * category, sort, queue any topic into matchmaking with one click.
 *
 * Public — anonymous spectators can browse the catalog too (great for
 * SEO discovery) but the "Queue Up" link will route them through
 * /login first.
 */
import type { Metadata } from "next";
import { TopicsClient } from "./TopicsClient";
import { KNOWN_CATEGORIES, TOPIC_CATALOG } from "@/lib/topics/catalog";

export const metadata: Metadata = {
  title: "Topics · DebateThis",
  description:
    "Browse the DebateThis topic catalog — politics, philosophy, pop culture, food, sports, everyday debates. Search, filter, queue a match.",
};

export default function TopicsPage() {
  // SEO-friendly: server-render the full list once, then the client
  // takes over with search/filter/sort. No flash of empty state on
  // first paint and crawlers see the whole catalog.
  return (
    <TopicsClient
      initialTotal={TOPIC_CATALOG.length}
      initialCategories={KNOWN_CATEGORIES}
    />
  );
}
