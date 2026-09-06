/**
 * Route-level ultra-fast native loading UI for /admin.
 * Renders an obsidian shimmer skeleton matching the admin layout
 * without jarring fullscreen takeovers or server crashes.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat data admin...">
      {/* Top Header Skeleton */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="h-6 w-48 rounded-lg bg-surface-raised animate-shimmer-sweep" />
          <div className="h-4 w-72 rounded-md bg-surface animate-shimmer-sweep" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 rounded-xl bg-surface animate-shimmer-sweep" />
          <div className="h-8 w-28 rounded-xl bg-surface animate-shimmer-sweep" />
        </div>
      </div>

      {/* Financial Section Skeleton */}
      <div className="rounded-2xl border border-hairline/80 bg-surface/70 p-4 sm:p-5 space-y-3">
        <div className="h-4 w-36 rounded bg-surface-raised animate-shimmer-sweep" />
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-hairline bg-obsidian/60 p-3 animate-shimmer-sweep" />
          ))}
        </div>
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-hairline bg-surface p-3.5 animate-shimmer-sweep" />
        ))}
      </div>

      {/* Table / Activity Skeleton */}
      <div className="rounded-2xl border border-hairline bg-surface p-4 space-y-3">
        <div className="h-4 w-44 rounded bg-surface-raised animate-shimmer-sweep" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-xl border border-hairline/50 bg-obsidian/40 animate-shimmer-sweep" />
          ))}
        </div>
      </div>
    </div>
  );
}
