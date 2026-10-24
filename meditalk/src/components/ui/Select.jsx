import { ChevronDown, AlertCircle } from "lucide-react";

export default function Select({ label, error, className = "", id, children, ...props }) {
  const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="label-base">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${selectId}-error` : undefined}
          className={
            "input-base appearance-none pr-10 cursor-pointer " +
            (error ? "border-danger focus:border-danger focus:ring-danger/15 " : "") +
            className
          }
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-tertiary" />
      </div>
      {error && (
        <p id={`${selectId}-error`} className="mt-1.5 text-xs text-danger flex items-start gap-1 font-medium break-words">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="min-w-0 flex-1">{error}</span>
        </p>
      )}
    </div>
  );
}
