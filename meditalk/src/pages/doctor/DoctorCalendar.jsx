import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  Save,
  Clock,
  Coffee,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Palmtree,
  CalendarOff,
  Trash2,
  Plus,
  AlertCircle
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import LoadingState from "../../components/ui/LoadingState";
import StatusBadge from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import {
  getAppointments,
  getDoctorSchedule,
  saveDoctorSchedule,
  getDoctorUnavailability,
  addDoctorUnavailability,
  deleteDoctorUnavailability
} from "../../services/appointmentService";
import { formatDate } from "../../constants";

const DAYS_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOT_OPTIONS = [15, 20, 30, 45, 60];

const DEFAULT_SCHEDULE = {
  work_days: [1, 2, 3, 4, 5],
  start_time: "09:00",
  end_time: "17:00",
  slot_mins: 30,
  break_start: "13:00",
  break_end: "14:00",
};

export default function DoctorCalendar() {
  const { user } = useAuth();
  const doctorId = user?.id;
  const toast = useToast();

  const { data: appointments, loading: apptLoading } = useFetch(
    () => getAppointments({ doctorId }),
    [doctorId]
  );

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- CW-2: Availability Exceptions / Leave State ---
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("Vacation");
  const [addingLeave, setAddingLeave] = useState(false);

  const loadUnavailability = useCallback(async () => {
    if (!doctorId) return;
    try {
      const res = await getDoctorUnavailability(doctorId);
      setUnavailabilities(res.unavailability || []);
    } catch (_) {}
  }, [doctorId]);

  // Load schedule and leave days on mount
  useEffect(() => {
    if (!doctorId) return;
    getDoctorSchedule(doctorId)
      .then((s) => {
        setSchedule({
          work_days: s.work_days || [1, 2, 3, 4, 5],
          start_time: s.start_time || "09:00",
          end_time: s.end_time || "17:00",
          slot_mins: s.slot_mins || 30,
          break_start: s.break_start || "13:00",
          break_end: s.break_end || "14:00",
        });
        setScheduleLoaded(true);
      })
      .catch(() => setScheduleLoaded(true));

    loadUnavailability();
  }, [doctorId, loadUnavailability]);

  // Fast map lookup: "YYYY-MM-DD" -> leave object
  const unavailMap = useMemo(() => {
    const map = {};
    for (const u of unavailabilities) {
      const dStr = typeof u.date === "string" ? u.date.slice(0, 10) : "";
      if (dStr) map[dStr] = u;
    }
    return map;
  }, [unavailabilities]);

  // --- Calendar helpers ---
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  function apptsOn(day) {
    const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return (appointments || []).filter((a) => a.date === ds);
  }

  function totalSlotsForDay(dayOfWeek) {
    if (!schedule.work_days.includes(dayOfWeek)) return 0;
    const toM = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const startM = toM(schedule.start_time);
    const endM = toM(schedule.end_time);
    const bsM = toM(schedule.break_start);
    const beM = toM(schedule.break_end);
    const sm = schedule.slot_mins || 30;
    let count = 0;
    for (let cur = startM; cur + sm <= endM; cur += sm) {
      const slotEnd = cur + sm;
      if (cur < beM && slotEnd > bsM) continue;
      count++;
    }
    return count;
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  }

  // --- Schedule helpers ---
  function toggleDay(d) {
    setSchedule((s) => ({
      ...s,
      work_days: s.work_days.includes(d)
        ? s.work_days.filter((x) => x !== d)
        : [...s.work_days, d].sort(),
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveDoctorSchedule(doctorId, schedule);
      toast.success("Schedule saved successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLeave(dateToAdd, reasonToAdd) {
    const targetDate = dateToAdd || leaveDate;
    const targetReason = reasonToAdd || leaveReason;
    if (!targetDate) {
      toast.error("Please pick a date for your leave.");
      return;
    }
    setAddingLeave(true);
    try {
      await addDoctorUnavailability(doctorId, { date: targetDate, reason: targetReason });
      toast.success(`Leave scheduled for ${targetDate}`);
      setLeaveDate("");
      await loadUnavailability();
    } catch (err) {
      toast.error(err.message || "Failed to schedule leave");
    } finally {
      setAddingLeave(false);
    }
  }

  async function handleDeleteLeave(unavailId) {
    try {
      await deleteDoctorUnavailability(doctorId, unavailId);
      toast.success("Leave date removed");
      await loadUnavailability();
    } catch (err) {
      toast.error(err.message || "Failed to remove leave");
    }
  }

  if (apptLoading || !scheduleLoaded) return <LoadingState />;

  const selectedDateStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : null;
  const selectedAppts = selectedDay ? apptsOn(selectedDay) : [];
  const selectedDayLeave = selectedDateStr ? unavailMap[selectedDateStr] : null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Schedule & Availability"
        subtitle="Configure consultation operating hours, manage planned leave exceptions, and inspect daily booking density."
      />

      {/* ─── Schedule Settings Card ─────────────────────── */}
      <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-accent/10 dark:bg-accent/20 text-accent flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-ink dark:text-dark-ink text-base tracking-tight">Working Hours Configuration</h2>
            <p className="text-xs text-ink/60 dark:text-dark-ink/60">Define your recurring weekly clinic hours and patient consultation appointment duration.</p>
          </div>
        </div>

        {/* Working Days */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/60 dark:text-dark-ink/60 mb-2.5">Regular Working Days</p>
          <div className="flex flex-wrap gap-2">
            {DAYS_LABELS.map((label, idx) => {
              const active = schedule.work_days.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className={`h-9 px-4 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                    active
                      ? "bg-accent text-white shadow-accent/25"
                      : "bg-canvas dark:bg-dark-surface-elevated text-ink/70 dark:text-dark-ink/70 border border-border-subtle dark:border-dark-border-subtle hover:bg-canvas-subtle hover:text-ink dark:hover:text-dark-ink"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Times & Slot Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1.5">Start Time</label>
            <input
              type="time"
              value={schedule.start_time}
              onChange={(e) => setSchedule((s) => ({ ...s, start_time: e.target.value }))}
              className="w-full bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-xl px-3 py-2 text-sm text-ink dark:text-dark-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1.5">End Time</label>
            <input
              type="time"
              value={schedule.end_time}
              onChange={(e) => setSchedule((s) => ({ ...s, end_time: e.target.value }))}
              className="w-full bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-xl px-3 py-2 text-sm text-ink dark:text-dark-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1.5">Slot Duration</label>
            <select
              value={schedule.slot_mins}
              onChange={(e) => setSchedule((s) => ({ ...s, slot_mins: Number(e.target.value) }))}
              className="w-full bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-xl px-3 py-2 text-sm text-ink dark:text-dark-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            >
              {SLOT_OPTIONS.map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleSave} loading={saving} className="w-full justify-center">
              <Save className="h-4 w-4" /> Save Hours
            </Button>
          </div>
        </div>

        {/* Break Window */}
        <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
          <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-semibold text-amber-900 dark:text-amber-100">Lunch & Break Intermission:</span>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={schedule.break_start}
              onChange={(e) => setSchedule((s) => ({ ...s, break_start: e.target.value }))}
              className="bg-white dark:bg-dark-surface border border-amber-500/30 rounded-lg px-2 py-1 text-xs text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
            />
            <span className="text-amber-800 dark:text-amber-300">to</span>
            <input
              type="time"
              value={schedule.break_end}
              onChange={(e) => setSchedule((s) => ({ ...s, break_end: e.target.value }))}
              className="bg-white dark:bg-dark-surface border border-amber-500/30 rounded-lg px-2 py-1 text-xs text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
            />
          </div>
          <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80 ml-auto hidden sm:inline">Slots within this range will remain unavailable.</span>
        </div>
      </div>

      {/* ─── CW-2: Leave & Availability Exceptions Card ──────────── */}
      <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Palmtree className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-ink dark:text-dark-ink text-base tracking-tight">Leave & Vacation Overrides</h2>
            <p className="text-xs text-ink/60 dark:text-dark-ink/60">Block specific dates for conferences, clinical rounds, or annual leave. Patients cannot book slots on these dates.</p>
          </div>
        </div>

        {/* Add Leave Form */}
        <div className="p-4 rounded-xl bg-canvas dark:bg-dark-surface-elevated/50 border border-border-subtle dark:border-dark-border-subtle mb-6">
          <p className="text-xs font-semibold text-ink dark:text-dark-ink mb-3 flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5 text-accent" /> Schedule Leave / Vacation Day
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1">Date</label>
              <input
                type="date"
                value={leaveDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setLeaveDate(e.target.value)}
                className="w-full bg-white dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-xl px-3 py-2 text-xs text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1">Reason / Category</label>
              <select
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                className="w-full bg-white dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-xl px-3 py-2 text-xs text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
              >
                <option value="Vacation">Vacation / Holiday</option>
                <option value="Conference / Training">Medical Conference / Training</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Personal Day">Personal Day Off</option>
                <option value="Clinical Duty / Rounds">External Clinical Duty</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => handleAddLeave()}
                loading={addingLeave}
                disabled={!leaveDate}
                className="w-full text-xs justify-center"
              >
                <CalendarOff className="h-4 w-4" /> Block Date
              </Button>
            </div>
          </div>
        </div>

        {/* Scheduled Exceptions List */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/60 dark:text-dark-ink/60 mb-3">Scheduled Leave Days</p>
          {unavailabilities.length === 0 ? (
            <p className="text-xs text-ink/40 dark:text-dark-ink/40 py-2">No upcoming leave dates scheduled. You are available according to your regular hours.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {unavailabilities.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 text-xs transition-all hover:border-amber-500/50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Palmtree className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-ink dark:text-dark-ink truncate">{formatDate(u.date)}</p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium truncate">{u.reason || "On Leave"}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteLeave(u.id)}
                    title="Remove leave date"
                    className="p-1.5 rounded-lg text-ink/40 dark:text-dark-ink/40 hover:text-danger hover:bg-danger/10 transition-colors ml-2 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Calendar Grid Card ───────────────────────────── */}
      <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl border border-border-subtle dark:border-dark-border-subtle bg-canvas dark:bg-dark-surface-elevated hover:bg-canvas-subtle text-ink dark:text-dark-ink transition-all shadow-sm"
            aria-label="Previous Month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-semibold text-ink dark:text-dark-ink text-base tracking-tight">
            {new Date(year, month).toLocaleString("en-US", { month: "long" })} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-xl border border-border-subtle dark:border-dark-border-subtle bg-canvas dark:bg-dark-surface-elevated hover:bg-canvas-subtle text-ink dark:text-dark-ink transition-all shadow-sm"
            aria-label="Next Month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs">
          {DAYS_LABELS.map((d) => (
            <div key={d} className="py-2 text-[11px] font-semibold uppercase tracking-wider text-ink/40 dark:text-dark-ink/40">
              {d}
            </div>
          ))}

          {/* Empty prefix slots */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={"e" + i} className="min-h-[84px] rounded-xl opacity-0" />
          ))}

          {/* Month day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const appts = apptsOn(day);
            const dow = new Date(year, month, day).getDay();
            const totalSlots = totalSlotsForDay(dow);
            const isWorkingDay = schedule.work_days.includes(dow);
            const isSelected = selectedDay === day;
            const isToday =
              day === new Date().getDate() &&
              month === new Date().getMonth() &&
              year === new Date().getFullYear();

            const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const leaveInfo = unavailMap[dayStr];

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`min-h-[84px] rounded-xl border p-2 text-left cursor-pointer transition-all ${
                  isSelected
                    ? "border-accent bg-accent/5 dark:bg-accent/15 ring-2 ring-accent"
                    : leaveInfo
                    ? "border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 hover:border-amber-500/50"
                    : isWorkingDay
                    ? "border-border-subtle dark:border-dark-border-subtle bg-surface dark:bg-dark-surface hover:bg-canvas dark:hover:bg-dark-surface-elevated"
                    : "border-dashed border-border-subtle/40 dark:border-dark-border-subtle/30 bg-canvas/30 dark:bg-dark-surface-elevated/20 opacity-40 hover:opacity-75"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[11px] font-semibold ${
                      isToday
                        ? "bg-accent text-white rounded-full px-2 py-0.5 shadow-sm"
                        : "text-ink/80 dark:text-dark-ink/80"
                    }`}
                  >
                    {day}
                  </span>
                  {leaveInfo && (
                    <span title={leaveInfo.reason || "On Leave"}>
                      <Palmtree className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    </span>
                  )}
                </div>

                {leaveInfo ? (
                  <div className="p-1 rounded-lg bg-amber-500/20 text-amber-900 dark:text-amber-200">
                    <p className="text-[10px] font-semibold truncate leading-tight">{leaveInfo.reason || "Leave"}</p>
                    <p className="text-[9px] text-amber-700 dark:text-amber-300 font-medium">Slots Blocked</p>
                  </div>
                ) : isWorkingDay ? (
                  <div className="space-y-1">
                    {appts.slice(0, 2).map((a) => (
                      <div
                        key={a.id}
                        className={`text-[9px] truncate rounded-md px-1.5 py-0.5 font-medium ${statusColor(a.status)}`}
                      >
                        {a.time} {a.patientName?.split(" ")[0]}
                      </div>
                    ))}
                    {appts.length > 2 && (
                      <div className="text-[9px] text-ink/50 dark:text-dark-ink/50 font-medium">+{appts.length - 2} more</div>
                    )}
                    {totalSlots > 0 && (
                      <div className="text-[9px] text-ink/40 dark:text-dark-ink/40 font-mono mt-0.5">
                        {appts.length}/{totalSlots} slots
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs mt-6 pt-4 border-t border-border-subtle dark:border-dark-border-subtle text-ink/60 dark:text-dark-ink/60">
          <Legend className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30" label="Upcoming / Confirmed" />
          <Legend className="bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30" label="Cancelled" />
          <Legend className="bg-primary/20 text-primary dark:text-primary-light border border-primary/30" label="Completed" />
          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <span className="h-3 w-3 rounded-md bg-amber-500/20 border border-amber-500/40 inline-block" />
            Scheduled Leave / Time-Off
          </span>
          <span className="inline-flex items-center gap-1.5 text-ink/40 dark:text-dark-ink/40">
            <span className="h-3 w-3 rounded-md border border-dashed border-border-subtle dark:border-dark-border-subtle" />
            Non-working day
          </span>
        </div>
      </div>

      {/* ─── Day Detail Panel ──────────────────────────── */}
      {selectedDay && (
        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-subtle dark:border-dark-border-subtle">
            <div>
              <h3 className="font-semibold text-ink dark:text-dark-ink text-base tracking-tight">
                {formatDate(selectedDateStr)}
              </h3>
              <p className="text-xs text-ink/60 dark:text-dark-ink/60">
                {selectedDayLeave
                  ? `Marked as Leave: ${selectedDayLeave.reason || "On Leave"}`
                  : `${selectedAppts.length} appointments booked`}
              </p>
            </div>

            {/* Quick Toggle Leave Button for Selected Day */}
            <div>
              {selectedDayLeave ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteLeave(selectedDayLeave.id)}
                  className="text-xs text-danger border-danger/30 hover:bg-danger/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Cancel Leave (Make Available)
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddLeave(selectedDateStr, "Personal Day")}
                  className="text-xs text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
                >
                  <Palmtree className="h-3.5 w-3.5" /> Mark as Leave Day
                </Button>
              )}
            </div>
          </div>

          {selectedDayLeave && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                You are currently marked on leave for this day ({selectedDayLeave.reason}). All booking slots are blocked for patients.
              </span>
            </div>
          )}

          {selectedAppts.length === 0 ? (
            <div className="flex items-center gap-2.5 text-sm text-ink/50 dark:text-dark-ink/50 py-4">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              No appointments booked for this day.
            </div>
          ) : (
            <div className="space-y-2.5">
              {selectedAppts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle hover:border-accent/30 transition-all"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink dark:text-dark-ink">{a.patientName}</p>
                    <p className="text-xs text-ink/50 dark:text-dark-ink/50">{a.time} · {a.type}</p>
                    {a.reason && <p className="text-xs text-ink/40 dark:text-dark-ink/40 mt-0.5">"{a.reason}"</p>}
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function statusColor(status) {
  return status === "cancelled"
    ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20"
    : status === "upcoming" || status === "confirmed"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
    : "bg-primary/15 text-primary dark:text-primary-light border border-primary/20";
}

function Legend({ className, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={"h-3 w-3 rounded-md " + className} />
      {label}
    </span>
  );
}
