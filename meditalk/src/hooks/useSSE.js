import { useEffect, useRef } from "react";

function getToken() {
  try {
    const user = localStorage.getItem("meditrack_user");
    if (!user) return null;
    return JSON.parse(user)?.token || null;
  } catch {
    return null;
  }
}

/**
 * Hook to connect to Server-Sent Events (SSE) notification stream.
 * @param {Function} onMessage - callback invoked when a notification arrives
 * @param {boolean} enabled - whether stream connection is active
 */
export function useSSE(onMessage, enabled = true) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;

    const token = getToken();
    if (!token) return;

    let eventSource = null;
    let retryTimer = null;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;
      try {
        eventSource = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && data.type !== "connected") {
              onMessageRef.current?.(data);
            }
          } catch (e) {
            console.debug("[SSE] Parse error:", e);
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Attempt reconnection after 5 seconds if still mounted
          if (isMounted) {
            retryTimer = setTimeout(connect, 5000);
          }
        };
      } catch (e) {
        console.warn("[SSE] Connection error:", e);
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [enabled]);
}
