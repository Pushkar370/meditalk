export default function Card({
  children,
  className = "",
  title,
  subtitle,
  action,
  padded = true,
}) {
  return (
    <div
      className={
        "bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] " +
        "shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden min-w-0 w-full " +
        (padded ? "p-4 sm:p-6 " : "") +
        className
      }
    >
      {(title || subtitle || action) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 min-w-0">
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="text-base sm:text-lg font-semibold text-ink dark:text-white tracking-tight break-words">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-ink-secondary dark:text-neutral-300 mt-0.5 break-words">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0 flex items-center gap-2 flex-wrap">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
