import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary:
    "bg-primary text-white hover:bg-primary-dark shadow-[0_1px_2px_rgba(0,0,0,0.06)] active:bg-primary-dark",
  secondary:
    "bg-[#E8E8ED] dark:bg-[#2C2C2E] text-ink dark:text-white hover:bg-[#DEDEE3] dark:hover:bg-[#3A3A3C]",
  accent:
    "bg-accent text-white hover:bg-accent-dark shadow-xs",
  danger:
    "bg-danger text-white hover:bg-danger-dark shadow-xs",
  outline:
    "bg-white dark:bg-[#1C1C1E] text-ink dark:text-white border border-black/[0.12] dark:border-white/[0.16] hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
  ghost:
    "bg-transparent text-ink dark:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08]",
  success:
    "bg-success text-white hover:bg-success-dark shadow-xs",
};

const SIZES = {
  sm: "px-4 py-1.5 text-xs font-medium rounded-full",
  md: "px-5 py-2.5 text-sm font-medium rounded-full",
  lg: "px-6 py-3 text-base font-semibold rounded-full",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  disabled,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={
        "inline-flex items-center justify-center gap-2 transition-all duration-150 max-w-full " +
        "active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1C1C1E] " +
        "[&>svg]:shrink-0 [&>svg]:!mr-0 [&>svg]:!ml-0 " +
        VARIANTS[variant] +
        " " +
        SIZES[size] +
        " " +
        className
      }
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
      {children}
    </button>
  );
}
