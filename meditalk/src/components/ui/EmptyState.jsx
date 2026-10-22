import { Inbox } from "lucide-react";

export default function EmptyState({
  icon: Icon = Inbox,
  title = "No items yet",
  message,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-sm mx-auto animate-enter">
      <div className="h-14 w-14 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] text-ink-secondary dark:text-neutral-400 flex items-center justify-center mb-4 transition-transform">
        <Icon className="h-6 w-6 stroke-[1.75]" />
      </div>
      <h3 className="text-base font-semibold text-ink dark:text-white tracking-tight">
        {title}
      </h3>
      {message && (
        <p className="mt-1.5 text-xs text-ink-secondary dark:text-neutral-400 leading-relaxed">
          {message}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
