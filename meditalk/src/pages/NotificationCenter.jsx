import { CheckCheck, Bell } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import NotificationItem from "../components/cards/NotificationItem";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import { useNotifications } from "../context/NotificationContext";

export default function NotificationCenter() {
  const { notifications, loading, markRead, markAllRead, remove } = useNotifications();

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <PageHeader
        title="Notification Center"
        subtitle="Stay updated with your appointments, prescriptions, and clinical care updates."
        action={
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        }
      />

      {notifications.length === 0 ? (
        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-12 shadow-apple-card">
          <EmptyState icon={Bell} title="No notifications" message="You're all caught up." />
        </div>
      ) : (
        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl divide-y divide-border-subtle dark:divide-dark-border-subtle p-3 shadow-apple-card">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onRead={markRead}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
