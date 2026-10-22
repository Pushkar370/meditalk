import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    // Prevent body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Handle Escape key to close dialog
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || "Dialog"}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6"
    >
      {/* Frosted backdrop */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content */}
      <div
        ref={modalRef}
        className={
          "relative bg-white dark:bg-[#1C1C1E] text-ink dark:text-white " +
          "rounded-t-3xl sm:rounded-3xl border border-black/[0.08] dark:border-white/[0.12] " +
          "shadow-modal w-full " +
          widths[size] +
          " max-h-[92vh] flex flex-col animate-enter overflow-hidden"
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-md">
          <h2 className="text-lg font-semibold tracking-tight text-ink dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.15] text-ink-secondary dark:text-neutral-300 flex items-center justify-center transition-all"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-black/[0.06] dark:border-white/[0.08] bg-[#F5F5F7]/80 dark:bg-[#2C2C2E]/60 backdrop-blur-md flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
