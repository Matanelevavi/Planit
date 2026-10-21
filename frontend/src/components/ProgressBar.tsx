export function ProgressBar({ pct, label }: { pct: number; label: string }) {
  const value = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
    >
      <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${value}%` }} />
    </div>
  )
}
