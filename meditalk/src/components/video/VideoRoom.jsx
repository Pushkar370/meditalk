import { useEffect, useRef } from "react";
import { Video, VideoOff, PhoneOff, Maximize2 } from "lucide-react";

/**
 * VideoRoom — embeds a Jitsi Meet call in an iframe.
 * roomId:       unique room name (e.g. "meditalk-A-123456")
 * displayName:  user's display name inside Jitsi
 * onEnd:        called when doctor clicks "End Call" (doctor view only)
 * isDoctor:     if true, shows End Call button; otherwise shows Leave button only
 * videoStatus:  "waiting" | "in_progress" | "ended"
 */
export default function VideoRoom({ roomId, displayName, onEnd, isDoctor, videoStatus }) {
  const containerRef = useRef(null);

  // Build the Jitsi URL with config params to hide toolbars we don't need
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
      <div className="flex flex-col items-center justify-center h-64 bg-ink/5 rounded-2xl border border-sage/20 gap-3">
        <VideoOff className="h-10 w-10 text-ink/30" />
        <p className="text-sm font-medium text-ink/50">The consultation call has ended.</p>
      </div>
    );
  }

  if (!videoStatus || videoStatus === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-ink/5 rounded-2xl border border-sage/20 gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
          <p className="text-sm font-medium text-ink/60">
            {isDoctor ? 'Click "Start Call" to open the video room.' : "Waiting for the doctor to start the call\u2026"}
          </p>
        </div>
        {!isDoctor && (
          <p className="text-xs text-ink/40">This page will update automatically.</p>
        )}
      </div>
    );
  }

  // in_progress — show iframe
  return (
    <div ref={containerRef} className="relative w-full rounded-2xl overflow-hidden border border-sage/20 shadow-lg bg-black">
      <iframe
        src={jitsiUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="w-full"
        style={{ height: "480px", border: "none" }}
        title="Video Consultation"
      />
      {/* Overlay controls */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Live
          </span>
          <span className="text-xs text-white/60 font-mono">{roomId}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => containerRef.current?.querySelector("iframe")?.requestFullscreen?.()}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
            title="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          {isDoctor && onEnd && (
            <button
              onClick={onEnd}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-danger text-white text-xs font-semibold hover:bg-danger/80 transition"
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
