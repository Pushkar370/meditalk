import { useState, useEffect } from "react";
import {
  Users, Clock, CheckCircle2, UserCheck, AlertCircle, Search, RefreshCw, CalendarDays, ArrowRight, DoorOpen
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";
import LoadingState from "../../components/ui/LoadingState";
import EmergencyBanner from "../../components/ui/EmergencyBanner";
import { useToast } from "../../context/ToastContext";
import {
  getWaitingRoomQueue,
  checkInAppointment,
  updateQueueStatus
} from "../../services/appointmentService";
import { formatDate } from "../../constants";

export default function ReceptionistQueue() {
  const toast = useToast();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState({});

  async function loadQueue(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await getWaitingRoomQueue();
      setQueue(res.queue || []);
    } catch (err) {
      toast.error(err.message || "Failed to load clinic queue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadQueue();
    // Auto-refresh queue every 15 seconds
    const interval = setInterval(() => loadQueue(true), 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleCheckIn(id, patientName) {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await checkInAppointment(id);
      toast.success(`${patientName} marked as checked in!`);
      await loadQueue(true);
    } catch (err) {
      toast.error(err.message || "Failed to check in patient");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleStatusChange(id, newStatus, label) {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await updateQueueStatus(id, newStatus);
      toast.success(`Queue status updated to ${label}`);
      await loadQueue(true);
    } catch (err) {
      toast.error(err.message || "Failed to update queue status");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  const filtered = queue.filter((item) => {
    const term = search.toLowerCase();
    const matchSearch =
      (item.patientName || "").toLowerCase().includes(term) ||
      (item.id || "").toLowerCase().includes(term) ||
      (item.doctorName || "").toLowerCase().includes(term);

    if (!matchSearch) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "checked_in") return item.checkInStatus === "checked_in";
    if (statusFilter === "in_room") return item.checkInStatus === "in_room";
    if (statusFilter === "scheduled") return !item.checkInStatus || item.checkInStatus === "scheduled";
    if (statusFilter === "completed") return item.status === "completed" || item.checkInStatus === "completed";
    return true;
  });

  const totalScheduled = queue.length;
  const waitingCount = queue.filter((q) => q.checkInStatus === "checked_in").length;
  const inRoomCount = queue.filter((q) => q.checkInStatus === "in_room").length;
  const completedCount = queue.filter((q) => q.status === "completed" || q.checkInStatus === "completed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reception & Patient Check-in Console"
        subtitle="Manage arriving patients, front-desk check-ins, and waiting room flow."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadQueue(true)}
            loading={refreshing}
          >
            <RefreshCw className="h-4 w-4" /> Refresh Queue
          </Button>
        }
      />

      <EmergencyBanner compact />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="card p-4 bg-white border border-sage/30 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-ink/50 font-medium">Today's Visits</p>
            <p className="text-xl font-extrabold text-ink">{totalScheduled}</p>
          </div>
        </div>

        <div className="card p-4 bg-amber-50/70 border border-amber-200 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-amber-700 font-medium">In Waiting Room</p>
            <p className="text-xl font-extrabold text-amber-950">{waitingCount}</p>
          </div>
        </div>

        <div className="card p-4 bg-blue-50/70 border border-blue-200 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
            <DoorOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-blue-700 font-medium">With Doctor</p>
            <p className="text-xl font-extrabold text-blue-950">{inRoomCount}</p>
          </div>
        </div>

        <div className="card p-4 bg-emerald-50/70 border border-emerald-200 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-emerald-700 font-medium">Completed</p>
            <p className="text-xl font-extrabold text-emerald-950">{completedCount}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-ink/40" />
            <input
              type="text"
              placeholder="Search patient, doctor, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs rounded-xl border border-sage/40 pl-9 pr-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {[
              { key: "all", label: "All" },
              { key: "checked_in", label: `Waiting (${waitingCount})` },
              { key: "in_room", label: `In Room (${inRoomCount})` },
              { key: "scheduled", label: "Not Checked In" },
              { key: "completed", label: "Completed" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition " +
                  (statusFilter === tab.key
                    ? "bg-primary text-white shadow-xs"
                    : "bg-sage/15 text-ink/60 hover:bg-sage/25")
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Live Queue Table */}
      {loading ? (
        <LoadingState message="Loading live waiting room queue..." />
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12 text-ink/50">
          <Users className="h-10 w-10 mx-auto text-sage/60 mb-2" />
          <p className="text-sm font-semibold">No appointments match the selected filter.</p>
          <p className="text-xs mt-1">Check-in appointments appear here automatically.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isCheckedIn = item.checkInStatus === "checked_in";
            const isInRoom = item.checkInStatus === "in_room";
            const isCompleted = item.status === "completed" || item.checkInStatus === "completed";
            const isBusy = !!actionLoading[item.id];

            return (
              <div
                key={item.id}
                className={
                  "card p-4 transition border " +
                  (isCheckedIn
                    ? "border-amber-300 bg-amber-50/30"
                    : isInRoom
                    ? "border-blue-300 bg-blue-50/20"
                    : isCompleted
                    ? "border-sage/20 bg-white opacity-70"
                    : "border-sage/30 bg-white")
                }
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Patient & Doctor Details */}
                  <div className="flex items-start gap-3">
                    <div
                      className={
                        "h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 " +
                        (isCheckedIn
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : isInRoom
                          ? "bg-blue-100 text-blue-800 border border-blue-300"
                          : "bg-sage/20 text-ink")
                      }
                    >
                      {item.patientName ? item.patientName.charAt(0) : "P"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-ink text-sm">{item.patientName}</span>
                        <span className="text-[10px] text-ink/40 font-mono">ID: {item.id}</span>
                        {item.type && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sage/20 text-ink/70">
                            {item.type}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink/60 mt-0.5">
                        Assigned Physician: <strong>{item.doctorName}</strong> ({item.specialty || "General"})
                      </p>
                      <p className="text-xs text-ink/50 mt-0.5">
                        Time: <strong>{item.time}</strong> · Date: {formatDate(item.date)}
                      </p>
                    </div>
                  </div>

                  {/* Status & Wait Timer */}
                  <div className="flex items-center gap-3 shrink-0">
                    {isCheckedIn && (
                      <div className="px-2.5 py-1 rounded-lg bg-amber-100/90 text-amber-900 border border-amber-200 text-xs font-bold flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 animate-pulse text-amber-700" />
                        <span>Waiting: {item.waitMinutes || 0} min</span>
                      </div>
                    )}

                    {isInRoom && (
                      <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold flex items-center gap-1.5">
                        <DoorOpen className="h-3.5 w-3.5" /> In Consultation
                      </span>
                    )}

                    {!isCheckedIn && !isInRoom && !isCompleted && (
                      <span className="px-2.5 py-1 rounded-lg bg-sage/20 text-ink/60 text-xs font-medium">
                        Not Checked In
                      </span>
                    )}

                    {isCompleted && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Done
                      </span>
                    )}
                  </div>

                  {/* Front-Desk Queue Controls */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    {!isCheckedIn && !isInRoom && !isCompleted && (
                      <Button
                        size="sm"
                        disabled={isBusy}
                        loading={isBusy}
                        onClick={() => handleCheckIn(item.id, item.patientName)}
                        className="text-xs"
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Mark Checked-In
                      </Button>
                    )}

                    {isCheckedIn && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isBusy}
                          loading={isBusy}
                          onClick={() => handleStatusChange(item.id, "in_room", "In Room")}
                          className="text-xs"
                        >
                          <DoorOpen className="h-3.5 w-3.5" /> Call into Room
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => handleStatusChange(item.id, "no_show", "No-Show")}
                          className="text-xs text-rose-600 hover:bg-rose-50 border-rose-200"
                        >
                          No-Show
                        </Button>
                      </>
                    )}

                    {isInRoom && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        loading={isBusy}
                        onClick={() => handleStatusChange(item.id, "completed", "Completed")}
                        className="text-xs text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Completed
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
