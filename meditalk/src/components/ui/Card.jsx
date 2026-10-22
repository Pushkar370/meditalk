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
        "shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden " +
        (padded ? "p-6 " : "") +
        className
      }
    >
      {(title || subtitle || action) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-ink dark:text-white tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-ink-secondary dark:text-neutral-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
