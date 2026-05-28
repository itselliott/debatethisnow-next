/**
 * Streaming-SSR fallback for the dashboard route. Renders immediately
 * (the bones of the page) while server components fetch user data,
 * giving us a meaningful first paint well under the 2.5s LCP budget.
 *
 * No spinners — Linear-style skeleton blocks that mimic the real
 * layout so the page doesn't lurch when content arrives.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <SkeletonBlock height={120} />
      <SkeletonBlock height={80} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SkeletonBlock height={120} />
        <SkeletonBlock height={120} />
        <SkeletonBlock height={120} />
      </div>
      <SkeletonBlock height={160} />
      <SkeletonBlock height={200} />
    </div>
  );
}

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div
      aria-hidden
      className="animate-pulse rounded border border-ink/30 bg-paper-2 shadow-press-sm"
      style={{ height }}
    />
  );
}
