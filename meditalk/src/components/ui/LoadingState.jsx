import { Loader2 } from "lucide-react";
import Skeleton from "./Skeleton";

export default function LoadingState({
  message = "Loading...",
  skeleton = false,
  lines = 3,
}) {
  if (skeleton) {
    return (
      <div className="space-y-4 py-6 w-full animate-enter">
        <Skeleton className="h-6 w-1/3" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" rounded="rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-enter">
      <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-primary-light" />
      <p className="mt-3 text-xs font-medium text-ink-secondary dark:text-neutral-400">
        {message}
      </p>
    </div>
  );
}
