/**
 * Debate-room route-segment fallback. Same skeleton-block approach as
 * dashboard/loading.tsx — render the bones immediately so the page
 * never goes blank between click and first paint.
 */
export default function DebateLoading() {
  return (
    <div className="space-y-6">
      <SkeletonBlock height={80} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SkeletonBlock height={140} />
        <SkeletonBlock height={140} />
      </div>
      <SkeletonBlock height={48} />
      <SkeletonBlock height={300} />
      <SkeletonBlock height={140} />
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
