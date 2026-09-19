import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getNotifications, markAsRead, markAllAsRead, deleteNotification } from "../services/notificationService";
import { useToast } from "./ToastContext";
import { useSSE } from "../hooks/useSSE";

const NotificationContext = createContext(null);

const POLL_INTERVAL = 120_000; // 120 seconds fallback

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (_) {
      // silently fail on polling errors
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle incoming real-time SSE notification
  const handleSSENotification = useCallback(
    (notif) => {
      if (!notif) return;
      setNotifications((prev) => {
        // Prevent duplicates
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [{ ...notif, read: false, createdAt: notif.createdAt || new Date().toISOString() }, ...prev];
      });

      // Show real-time notification toast
      const toastType = notif.type === "error" ? "error" : notif.type === "warning" ? "info" : "success";
      showToast(`${notif.title || "Notification"}: ${notif.message || ""}`, toastType);
    },
    [showToast]
  );

  // Connect to SSE stream
  useSSE(handleSSENotification);

  useEffect(() => {
    load();
    // Safety-net fallback polling
    intervalRef.current = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [load]);


  const markRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await markAsRead(id);
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllAsRead();
  }, []);

  const remove = useCallback(async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        loading,
        unread,
        reload: load,
        markRead,
        markAllRead,
        remove,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
