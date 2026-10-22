import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className="flex items-center justify-center gap-1.5 mt-8 select-none"
    >
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="h-8 w-8 flex items-center justify-center rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1C1C1E] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition-all"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
        const isCurrent = p === page;
        return (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-current={isCurrent ? "page" : undefined}
            className={
              "h-8 min-w-8 px-2.5 rounded-full text-xs font-semibold transition-all " +
              (isCurrent
                ? "bg-primary text-white shadow-xs"
                : "border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1C1C1E] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]")
            }
          >
            {p}
          </button>
        );
      })}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="h-8 w-8 flex items-center justify-center rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1C1C1E] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition-all"
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
