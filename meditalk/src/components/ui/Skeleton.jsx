export default function Skeleton({ className = "", rounded = "rounded-xl" }) {
  return (
    <div
      className={`animate-pulse bg-black/[0.06] dark:bg-white/[0.08] ${rounded} ${className}`}
      aria-hidden="true"
    />
  );
}
