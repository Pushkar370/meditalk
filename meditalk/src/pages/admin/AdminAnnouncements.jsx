import { useState } from "react";
import { Megaphone, Send, Users, User, Stethoscope, Clock, CheckCircle2, History, AlertCircle } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import { sendBroadcast, getBroadcastHistory } from "../../services/adminService";

export default function AdminAnnouncements() {
  const toast = useToast();
  const { data: history, loading, reload } = useFetch(getBroadcastHistory);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [sending, setSending] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);

  async function handleSend() {
    if (!title.trim() || !message.trim()) {
      toast.error("Please provide both a title and message.");
      return;
    }
    setSending(true);
    try {
      const res = await sendBroadcast({
        title: title.trim(),
        message: message.trim(),
        targetRole,
      });
      toast.success(`Announcement broadcasted successfully to ${res.sent || 0} user${res.sent === 1 ? "" : "s"}!`);
      setTitle("");
      setMessage("");
      setTargetRole("all");
      setConfirmModal(false);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to broadcast announcement.");
    } finally {
      setSending(false);
    }
  }

  const columns = [
    {
      key: "action",
      label: "Broadcast Summary",
      render: (r) => (
        <div>
          <div className="font-semibold text-ink dark:text-dark-ink">{r.action}</div>
          <div className="text-xs text-ink/50 dark:text-dark-ink/50 mt-0.5">By {r.user_name} ({r.role})</div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
          <CheckCircle2 className="w-3 h-3" /> Sent
        </span>
      ),
    },
    {
      key: "timestamp",
      label: "Timestamp",
      render: (r) => (
        <span className="text-xs text-ink/50 dark:text-dark-ink/50">
          {r.timestamp ? new Date(r.timestamp).toLocaleString() : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="System Announcements & Alerts"
        subtitle="Publish critical platform advisories, maintenance schedules, and public health updates to all or segmented users."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Compose Form */}
        <div className="lg:col-span-7 bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-5">
          <div className="flex items-center gap-3 text-ink dark:text-dark-ink font-semibold text-base border-b border-border-subtle dark:border-dark-border-subtle pb-4">
            <div className="h-9 w-9 rounded-xl bg-accent/10 dark:bg-accent/20 text-accent flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
            <span className="tracking-tight">Compose Broadcast</span>
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-2">Target Audience Segment</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "all", label: "All Users", icon: Users, desc: "Patients + Doctors" },
                { key: "patient", label: "Patients", icon: User, desc: "Patients only" },
                { key: "doctor", label: "Doctors", icon: Stethoscope, desc: "Doctors only" },
              ].map((t) => {
                const Icon = t.icon;
                const active = targetRole === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTargetRole(t.key)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      active
                        ? "bg-accent/10 dark:bg-accent/20 border-accent text-accent shadow-sm ring-1 ring-accent/30"
                        : "bg-canvas dark:bg-dark-surface-elevated border-border-subtle dark:border-dark-border-subtle text-ink/70 dark:text-dark-ink/70 hover:bg-canvas-subtle"
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-2 ${active ? "text-accent" : "text-ink/40 dark:text-dark-ink/40"}`} />
                    <div className="font-semibold text-xs text-ink dark:text-dark-ink">{t.label}</div>
                    <div className="text-[10px] text-ink/50 dark:text-dark-ink/50 mt-0.5">{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1.5">
              Announcement Title <span className="text-danger">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Scheduled Platform Maintenance / Seasonal Flu Vaccination Reminder"
              maxLength={100}
            />
          </div>

          {/* Message Body */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium text-ink/70 dark:text-dark-ink/70">
                Message Content <span className="text-danger">*</span>
              </label>
              <span className="text-[11px] text-ink/40 dark:text-dark-ink/40 font-mono">{message.length}/500</span>
            </div>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              placeholder="Write the full announcement message here. This will be delivered as an in-app notification and instant push toast to all targeted users."
              className="w-full bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-xl p-3 text-xs text-ink dark:text-dark-ink focus:outline-none focus:border-accent resize-none transition-all"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              onClick={() => setConfirmModal(true)}
              disabled={!title.trim() || !message.trim()}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Broadcast Announcement</span>
            </Button>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink/40 dark:text-dark-ink/40">
              Recipient Live Preview
            </div>

            <div className="rounded-2xl border border-accent/20 bg-canvas dark:bg-dark-surface-elevated p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-ink dark:text-dark-ink text-sm truncate">
                      {title.trim() || "Announcement Title"}
                    </h4>
                    <span className="text-[10px] text-accent font-bold uppercase tracking-wider bg-accent/10 px-2 py-0.5 rounded-full shrink-0">
                      {targetRole === "all" ? "All Users" : targetRole === "doctor" ? "Doctors" : "Patients"}
                    </span>
                  </div>
                  <p className="text-xs text-ink/75 dark:text-dark-ink/75 line-clamp-4 leading-relaxed">
                    {message.trim() || "Your message body will appear here exactly as seen by recipients across MediTalk."}
                  </p>
                  <div className="text-[11px] text-ink/40 dark:text-dark-ink/40 pt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-ink/40 dark:text-dark-ink/40" />
                    <span>Just now</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-ink/50 dark:text-dark-ink/50 leading-normal">
              Broadcasting triggers persistent database notifications for each recipient and pushes real-time toasts across all active client browser sessions.
            </p>
          </div>
        </div>
      </div>

      {/* Broadcast History */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-ink dark:text-dark-ink font-semibold text-base">
          <History className="w-4 h-4 text-accent" />
          <span className="tracking-tight">Past Broadcast History</span>
        </div>

        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card">
          {loading ? (
            <LoadingState />
          ) : !history || history.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No Past Broadcasts"
              message="Platform broadcasts and system-wide announcements will appear in this audit log."
            />
          ) : (
            <DataTable columns={columns} data={history} />
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <Modal
          open={true}
          onClose={() => setConfirmModal(false)}
          title="Confirm Platform Broadcast"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                You are about to broadcast <strong className="text-ink dark:text-dark-ink">"{title}"</strong> to{" "}
                <strong className="text-ink dark:text-dark-ink">{targetRole === "all" ? "all registered users" : `all ${targetRole}s`}</strong>.
                This action cannot be undone.
              </div>
            </div>

            <div className="bg-canvas dark:bg-dark-surface-elevated p-3.5 rounded-xl border border-border-subtle dark:border-dark-border-subtle text-xs text-ink/80 dark:text-dark-ink/80 space-y-1">
              <div className="font-semibold text-ink dark:text-dark-ink">Message Preview:</div>
              <p className="italic">"{message}"</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setConfirmModal(false)} disabled={sending}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSend}
                loading={sending}
              >
                Send Now
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
