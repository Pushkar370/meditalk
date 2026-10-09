// ── SSE (Server-Sent Events) Client Registry ─────────────────────────────────
export const sseClients = new Map(); // key: userId -> Set of express res objects

export function pushNotification(userId, payload) {
  if (!userId) return;
  const targetId = String(userId);
  const userClients = sseClients.get(targetId);
  if (userClients && userClients.size > 0) {
    const dataString = `data: ${JSON.stringify(payload)}\n\n`;
    for (const clientRes of userClients) {
      try {
        clientRes.write(dataString);
      } catch (e) {
        console.warn('[SSE] Failed to write to client:', e.message);
      }
    }
  }
}
