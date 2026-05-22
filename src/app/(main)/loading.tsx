export default function MainLoading() {
  return (
    <div className="pt-16 pb-24 px-3 space-y-3 max-w-2xl mx-auto">
      {/* Skeleton post cards */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="bb-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="shimmer w-8 h-8 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <div className="shimmer h-3 w-28 rounded" />
              <div className="shimmer h-2 w-16 rounded" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="shimmer h-3 w-full rounded" />
            <div className="shimmer h-3 w-4/5 rounded" />
          </div>
          <div className="flex gap-2 pt-1">
            <div className="shimmer h-6 w-12 rounded" />
            <div className="shimmer h-6 w-12 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
