import { useEffect, useRef } from "react";
import { Video, VideoOff, PhoneOff, Maximize2, Sparkles } from "lucide-react";

/**
 * VideoRoom — embeds a Jitsi Meet call in an iframe with Apple frosted glass styling.
 * roomId:       unique room name (e.g. "meditalk-A-123456")
 * displayName:  user's display name inside Jitsi
 * onEnd:        called when doctor clicks "End Call" (doctor view only)
 * isDoctor:     if true, shows End Call button; otherwise shows Leave button only
 * videoStatus:  "waiting" | "in_progress" | "ended"
 */
export default function VideoRoom({ roomId, displayName, onEnd, isDoctor, videoStatus }) {
  const containerRef = useRef(null);

  // Build the Jitsi URL with config params
  const jitsiUrl =
    `https://meet.jit.si/${encodeURIComponent(roomId)}` +
    `#userInfo.displayName="${encodeURIComponent(displayName || "User")}"` +
    `&config.startWithAudioMuted=false` +
    `&config.startWithVideoMuted=false` +
    `&config.prejoinPageEnabled=false` +
    `&config.disableDeepLinking=true` +
    `&interfaceConfig.SHOW_JITSI_WATERMARK=false` +
    `&interfaceConfig.SHOW_BRAND_WATERMARK=false` +
    `&interfaceConfig.SHOW_POWERED_BY=false`;

  if (videoStatus === "ended") {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-canvas dark:bg-dark-surface-elevated/40 rounded-3xl border border-border-subtle dark:border-dark-border-subtle gap-3.5 p-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle flex items-center justify-center text-ink/40 dark:text-dark-ink/40 shadow-sm">
          <VideoOff className="h-6 w-6" />
        </div>
        <div>
          <p className="text-base font-semibold text-ink dark:text-dark-ink">
            Consultation Call Concluded
          </p>
          <p className="text-xs text-ink/50 dark:text-dark-ink/50 mt-1 max-w-sm">
            The video session has been closed by your provider. Review your After-Visit Summary and prescriptions below.
          </p>
        </div>
      </div>
    );
  }

  if (!videoStatus || videoStatus === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-canvas dark:bg-dark-surface-elevated/40 rounded-3xl border border-border-subtle dark:border-dark-border-subtle gap-3.5 p-6 text-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Clinical Lobby Ready</span>
        </div>
        <p className="text-base font-semibold text-ink dark:text-dark-ink">
          {isDoctor
            ? 'Click "Start Consultation" to initiate the clinical video stream.'
            : "Waiting for your physician to begin the call…"}
        </p>
        {!isDoctor && (
          <p className="text-xs text-ink/50 dark:text-dark-ink/50 max-w-xs">
            Your connection status is live. This session will connect automatically the moment your doctor arrives.
          </p>
        )}
      </div>
    );
  }

  // in_progress — show iframe with Apple overlay controls
  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-3xl overflow-hidden border border-border-subtle dark:border-dark-border-subtle shadow-card bg-black"
    >
      <iframe
        src={jitsiUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="w-full"
        style={{ height: "520px", border: "none" }}
        title="Video Consultation"
      />
      {/* Floating Apple frosted glass control bar */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between px-4 py-2.5 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 shadow-lg text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Encrypted Call
          </span>
          <span className="text-[11px] text-white/50 font-mono hidden sm:inline">
            {roomId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              containerRef.current?.querySelector("iframe")?.requestFullscreen?.()
            }
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition active:scale-95 text-white"
            title="Fullscreen"
            aria-label="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          {isDoctor && onEnd && (
            <button
              type="button"
              onClick={onEnd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition active:scale-95 shadow-sm"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              End Call
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
