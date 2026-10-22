import { AlertCircle } from "lucide-react";

export default function Input({ label, error, helperText, className = "", id, ...props }) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="label-base">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={
          "input-base " +
          (error
            ? "border-danger focus:border-danger focus:ring-danger/15 text-danger "
            : "") +
          className
        }
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-danger flex items-center gap-1 font-medium">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {!error && helperText && (
        <p className="mt-1 text-xs text-ink-secondary dark:text-neutral-400">{helperText}</p>
      )}
    </div>
  );
}
