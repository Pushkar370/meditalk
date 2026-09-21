import { useState, useEffect, useCallback } from "react";
import { Calendar, Save, Clock, Coffee, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import LoadingState from "../../components/ui/LoadingState";
import StatusBadge from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import { getAppointments } from "../../services/appointmentService";
import { getDoctorSchedule, saveDoctorSchedule } from "../../services/appointmentService";
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

  // Load schedule on mount
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
  }, [doctorId]);

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

  if (apptLoading || !scheduleLoaded) return <LoadingState />;

  const selectedDateStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : null;
  const selectedAppts = selectedDay ? apptsOn(selectedDay) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Schedule"
        subtitle="Configure your working hours and view your appointment calendar."
      />

      {/* ─── Schedule Settings Card ─────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-ink text-base">Working Hours Configuration</h2>
        </div>

        {/* Working Days */}
        <div className="mb-5">
          <p className="text-sm font-medium text-ink/70 mb-2">Working Days</p>
          <div className="flex flex-wrap gap-2">
            {DAYS_LABELS.map((label, idx) => (
              <button
                key={idx}
                onClick={() => toggleDay(idx)}
                className={
                  "h-9 w-12 rounded-lg text-sm font-semibold border transition " +
                  (schedule.work_days.includes(idx)
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-ink/50 border-sage/40 hover:bg-sage/20")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Times & Slot Duration */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Start Time</label>
            <input
              type="time"
              value={schedule.start_time}
              onChange={(e) => setSchedule((s) => ({ ...s, start_time: e.target.value }))}
              className="w-full border border-sage/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">End Time</label>
            <input
              type="time"
              value={schedule.end_time}
              onChange={(e) => setSchedule((s) => ({ ...s, end_time: e.target.value }))}
              className="w-full border border-sage/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Slot Duration</label>
            <select
              value={schedule.slot_mins}
              onChange={(e) => setSchedule((s) => ({ ...s, slot_mins: Number(e.target.value) }))}
              className="w-full border border-sage/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              {SLOT_OPTIONS.map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleSave} loading={saving} className="w-full">
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        </div>

        {/* Break Window */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <Coffee className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-xs font-medium text-amber-800">Lunch / Break Window</span>
          <input
            type="time"
            value={schedule.break_start}
            onChange={(e) => setSchedule((s) => ({ ...s, break_start: e.target.value }))}
            className="border border-amber-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500 bg-white ml-2"
          />
          <span className="text-xs text-amber-700">to</span>
          <input
            type="time"
            value={schedule.break_end}
            onChange={(e) => setSchedule((s) => ({ ...s, break_end: e.target.value }))}
            className="border border-amber-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500 bg-white"
          />
        </div>
      </div>

      {/* ─── Calendar ─────────────────────────────────────── */}
      <div className="card">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg border border-sage/40 hover:bg-sage/10 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-semibold text-ink">
            {new Date(year, month).toLocaleString("en-US", { month: "long" })} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg border border-sage/40 hover:bg-sage/10 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {DAYS_LABELS.map((d) => (
            <div key={d} className="py-2 font-semibold text-ink/50">{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => <div key={"e" + i} />)}
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

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={
                  "min-h-[72px] rounded-xl border p-1.5 text-left cursor-pointer transition " +
                  (isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : isWorkingDay
                    ? "border-sage/30 hover:bg-background"
                    : "border-dashed border-sage/20 bg-sage/5 opacity-50")
                }
              >
                <span
                  className={
                    "text-[11px] font-semibold " +
                    (isToday ? "bg-primary text-white rounded-full px-1.5 py-0.5" : "text-ink/70")
                  }
                >
                  {day}
                </span>
                {isWorkingDay && (
                  <div className="mt-1 space-y-0.5">
                    {appts.slice(0, 2).map((a) => (
                      <div
                        key={a.id}
                        className={"text-[9px] truncate rounded px-1 py-0.5 " + statusColor(a.status)}
                      >
                        {a.time} {a.patientName?.split(" ")[0]}
                      </div>
                    ))}
                    {appts.length > 2 && (
                      <div className="text-[9px] text-ink/40">+{appts.length - 2} more</div>
                    )}
                    {totalSlots > 0 && (
                      <div className="text-[9px] text-ink/30 mt-0.5">
                        {appts.length}/{totalSlots} slots
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs mt-4 pt-3 border-t border-sage/20">
          <Legend className="bg-success/15 text-success" label="Upcoming / Confirmed" />
          <Legend className="bg-danger/10 text-danger" label="Cancelled" />
          <Legend className="bg-sage/30 text-primary" label="Completed" />
          <span className="inline-flex items-center gap-1.5 text-ink/40">
            <span className="h-3 w-3 rounded border border-dashed border-sage/40" />
            Non-working day
          </span>
        </div>
      </div>

      {/* ─── Day Detail Panel ──────────────────────────── */}
      {selectedDay && (
        <div className="card">
          <h3 className="font-semibold text-ink mb-4">
            {formatDate(selectedDateStr)} — Appointments ({selectedAppts.length})
          </h3>
          {selectedAppts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-ink/50 py-4">
              <CheckCircle2 className="h-4 w-4 text-success" />
              No appointments booked for this day.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedAppts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-sage/10 border border-sage/20 hover:bg-sage/15 transition"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{a.patientName}</p>
                    <p className="text-xs text-ink/50">{a.time} · {a.type}</p>
                    {a.reason && <p className="text-xs text-ink/40 mt-0.5">"{a.reason}"</p>}
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
    ? "bg-danger/10 text-danger"
    : status === "upcoming" || status === "confirmed"
    ? "bg-success/15 text-success"
    : "bg-sage/30 text-primary";
}

function Legend({ className, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={"h-3 w-3 rounded " + className} />
      {label}
    </span>
  );
}
