import { HeartPulse } from "lucide-react";

export default function Logo({ size = "md", withText = true, inverted = false }) {
  const isSm = size === "sm";
  const isLg = size === "lg";

  const boxSize = isSm ? "h-7 w-7" : isLg ? "h-11 w-11" : "h-9 w-9";
  const iconSize = isSm ? "h-3.5 w-3.5" : isLg ? "h-5 w-5" : "h-4 w-4";
  const textSize = isSm ? "text-base" : isLg ? "text-2xl" : "text-lg";

  return (
    <div className="flex items-center gap-2.5 select-none">
      <div
        className={
          "rounded-xl flex items-center justify-center transition-transform shrink-0 " +
          boxSize +
          " " +
          (inverted
            ? "bg-white/15 text-white border border-white/20"
            : "bg-primary text-white shadow-xs")
        }
      >
        <HeartPulse className={iconSize + " stroke-[2.25]"} />
      </div>

      {withText && (
        <div className="flex flex-col leading-none">
          <span
            className={
              "font-bold tracking-tight " +
              textSize +
              " " +
              (inverted ? "text-white" : "text-ink dark:text-white")
            }
          >
            MediTalk
          </span>
          <span
            className={
              "text-[9px] font-semibold tracking-widest uppercase mt-0.5 " +
              (inverted ? "text-white/70" : "text-ink-secondary dark:text-neutral-400")
            }
          >
            Clinical Care
          </span>
        </div>
      )}
    </div>
  );
}
