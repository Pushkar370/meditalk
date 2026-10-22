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
    <div className="card flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div
          className={
            "h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 " +
            (tones[tone] || tones.primary)
          }
        >
          {Icon && <Icon className="h-5 w-5" />}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="mt-4">
        <p className="text-3xl font-bold tracking-tight text-ink dark:text-white leading-none">
          {value}
        </p>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-secondary dark:text-neutral-400 mt-2">
          {label}
        </p>

        {hint && (
          <div className="mt-3 flex items-center gap-1 text-xs font-medium">
            <span
              className={
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs " +
                (isPositive
                  ? "bg-success/10 text-success-dark dark:text-success-light"
                  : isNegative
                  ? "bg-danger/10 text-danger-dark dark:text-danger-light"
                  : "bg-black/[0.04] dark:bg-white/[0.06] text-ink-secondary dark:text-neutral-400")
              }
            >
              {isPositive && <ArrowUpRight className="h-3 w-3" />}
              {isNegative && <ArrowDownRight className="h-3 w-3" />}
              <span>{hint}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
