import { initials } from "../../constants";

export default function Avatar({ name = "", size = "md", className = "" }) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-16 w-16 text-lg",
  };

  return (
    <div
      aria-hidden="true"
      className={
        "rounded-full bg-[#E5E5EA] dark:bg-[#2C2C2E] text-ink dark:text-white font-bold flex items-center justify-center shrink-0 border border-black/[0.06] dark:border-white/[0.08] transition-transform select-none " +
        (sizes[size] || sizes.md) +
        " " +
        className
      }
    >
      {initials(name)}
    </div>
  );
}
