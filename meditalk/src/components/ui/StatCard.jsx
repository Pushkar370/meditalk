import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
  action,
}) {
  const tones = {
    primary: "bg-primary/10 text-primary dark:text-primary-light",
    sage: "bg-primary/10 text-primary dark:text-primary-light",
    accent: "bg-accent/10 text-accent dark:text-accent-light",
    danger: "bg-danger/10 text-danger dark:text-danger-light",
    success: "bg-success/10 text-success dark:text-success-light",
  };

  const isPositive = hint?.startsWith("+");
  const isNegative = hint?.startsWith("-");

  return (
    <div className="card flex flex-col justify-between min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div
          className={
            "h-10 sm:h-11 w-10 sm:w-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 " +
            (tones[tone] || tones.primary)
          }
        >
          {Icon && <Icon className="h-5 w-5" />}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="mt-4 min-w-0">
        <p
          className="text-2xl sm:text-3xl font-bold tracking-tight text-ink dark:text-white leading-tight truncate"
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </p>
        <p
          className="text-xs font-semibold uppercase tracking-wider text-ink-secondary dark:text-neutral-300 mt-1.5 truncate"
          title={label}
        >
          {label}
        </p>

        {hint && (
          <div className="mt-2.5 flex items-center gap-1 text-xs font-medium min-w-0">
            <span
              className={
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs truncate max-w-full " +
                (isPositive
                  ? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-300"
                  : isNegative
                  ? "bg-rose-500/10 text-rose-900 dark:text-rose-300"
                  : "bg-black/[0.04] dark:bg-white/[0.06] text-ink-secondary dark:text-neutral-300")
              }
              title={hint}
            >
              {isPositive && <ArrowUpRight className="h-3 w-3 shrink-0" />}
              {isNegative && <ArrowDownRight className="h-3 w-3 shrink-0" />}
              <span className="truncate">{hint}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
