import { Stethoscope, HeartPulse } from "lucide-react";

export default function Logo({ size = "md", withText = true, inverted = false }) {
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const text = size === "sm" ? "text-base" : "text-xl";
  const boxBg = inverted ? "bg-white/20 border border-white/30" : "bg-primary";
  const iconColor = inverted ? "text-accent" : "text-accent";
  const titleColor = inverted ? "text-white" : "text-primary";
  const subtextColor = inverted ? "text-white/75" : "text-ink/50";

  return (
    <div className="flex items-center gap-2.5">
      <div className={`rounded-xl flex items-center justify-center ${boxBg} ${box}`}>
        <HeartPulse className={`${iconColor} ${icon}`} />
      </div>
      {withText && (
        <div className="leading-none">
          <span className={`font-extrabold ${titleColor} ${text}`}>MediTalk</span>
          <span className={`block text-[10px] ${subtextColor} tracking-wide mt-0.5 font-medium`}>
            HEALTH MANAGEMENT
          </span>
        </div>
      )}
    </div>
  );
}
