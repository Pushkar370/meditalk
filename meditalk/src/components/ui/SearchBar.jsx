import { Search, X } from "lucide-react";

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  onClear,
}) {
  return (
    <div className={"relative " + className}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-tertiary dark:text-neutral-500 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-[#F5F5F7] dark:bg-[#2C2C2E] pl-10 pr-9 py-2 text-sm text-ink dark:text-white placeholder:text-ink-tertiary focus:bg-white dark:focus:bg-[#1C1C1E] focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all duration-150"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            if (onClear) onClear();
            else onChange?.("");
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-black/[0.1] dark:bg-white/[0.15] text-ink-secondary dark:text-neutral-300 flex items-center justify-center hover:bg-black/[0.2] transition"
          aria-label="Clear search"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}
