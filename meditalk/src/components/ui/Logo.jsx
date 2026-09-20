import { Stethoscope, HeartPulse } from "lucide-react";

export default function Logo({ size = "md", withText = true }) {
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const text = size === "sm" ? "text-base" : "text-xl";
  return (
    <div className="flex items-center gap-2.5">
      <div className={"rounded-xl bg-primary flex items-center justify-center " + box}>
        <HeartPulse className={"text-accent " + icon} />
      </div>
      {withText && (
        <div className="leading-none">
          <span className={"font-extrabold text-primary " + text}>MediTalk</span>
          <span className="block text-[10px] text-ink/50 tracking-wide mt-0.5">
            HEALTH MANAGEMENT
          </span>
        </div>
      )}
    </div>
  );
}
