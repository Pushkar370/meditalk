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
 * Sends authorization via Bearer header — never exposes auth token in URL query parameters.
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

    let abortController = null;
    let retryTimer = null;
    let isMounted = true;

    async function connect() {
      if (!isMounted) return;
      abortController = new AbortController();

      try {
        const response = await fetch('/api/notifications/stream', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          if (isMounted) {
            retryTimer = setTimeout(connect, 5000);
          }
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (isMounted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || '';

          for (const msg of messages) {
            const dataLine = msg.split('\n').find((line) => line.startsWith('data: '));
            if (dataLine) {
              try {
                const data = JSON.parse(dataLine.slice(6));
                if (data && data.type !== 'connected') {
                  onMessageRef.current?.(data);
                }
              } catch (e) {
                console.debug('[SSE] Parse error:', e);
              }
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError' && isMounted) {
          console.debug('[SSE] Stream disconnected, retrying in 5s...');
          retryTimer = setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (abortController) {
        abortController.abort();
      }
    };
  }, [enabled]);
}
