import { useState } from "react";
import { CalendarCheck2, Clock, X, Check, Loader2, AlertCircle } from "lucide-react";
import Button from "../ui/Button";
import { formatDate } from "../../constants";
import { getAvailableSlots } from "../../services/appointmentService";
import { confirmFollowUpSuggestion, dismissFollowUpSuggestion } from "../../services/prescriptionService";
import { useToast } from "../../context/ToastContext";

export default function FollowUpSuggestionsCard({ suggestions = [], onConfirmed, onDismissed }) {
  const toast = useToast();
  const [selectedSug, setSelectedSug] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dismissingId, setDismissingId] = useState(null);

  if (!suggestions || suggestions.length === 0) return null;

  async function handleOpenConfirm(sug) {
    setSelectedSug(sug);
    setSelectedTime("");
    setSlotsLoading(true);
    try {
      const res = await getAvailableSlots(sug.doctor_id, sug.suggested_date);
      setSlots(res?.slots?.filter((s) => s.available) || []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleConfirm() {
    if (!selectedSug || !selectedTime) {
      toast.error("Please select a time slot.");
      return;
    }
    setSubmitting(true);
    try {
      await confirmFollowUpSuggestion(selectedSug.id, { time: selectedTime, type: "video" });
      toast.success(`Follow-up booked with Dr. ${selectedSug.doctor_name} on ${formatDate(selectedSug.suggested_date)} at ${selectedTime}!`);
      setSelectedSug(null);
      if (onConfirmed) onConfirmed();
    } catch (err) {
      toast.error(err.message || "Failed to confirm follow-up appointment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDismiss(sugId) {
    setDismissingId(sugId);
    try {
      await dismissFollowUpSuggestion(sugId);
      toast.info("Follow-up recommendation dismissed.");
      if (onDismissed) onDismissed();
    } catch (err) {
      toast.error(err.message || "Failed to dismiss.");
    } finally {
      setDismissingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {suggestions.map((sug) => (
        <div
          key={sug.id}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-sage/20 border border-teal-500/30 p-4 sm:p-5 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <CalendarCheck2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-600/15 text-teal-800 dark:text-teal-300">
                    Recommended Follow-Up
                  </span>
                  <span className="text-xs font-semibold text-ink">Dr. {sug.doctor_name}</span>
                  <span className="text-xs text-ink/50">({sug.specialty || "Specialist"})</span>
                </div>
                <h4 className="text-sm font-bold text-ink mt-1">
                  Proposed Date: {formatDate(sug.suggested_date)}
                </h4>
                {sug.reason && (
                  <p className="text-xs text-ink/70 mt-0.5">
                    <span className="font-medium text-ink">Clinical reason:</span> {sug.reason}
                  </p>
                )}
                {sug.instructions && (
                  <p className="text-[11px] text-teal-900 dark:text-teal-300 mt-1 italic bg-teal-500/10 px-2 py-1 rounded-md inline-block">
                    "{sug.instructions}"
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => handleOpenConfirm(sug)}
                className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm text-xs"
              >
                <Check className="h-3.5 w-3.5" /> 1-Click Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={dismissingId === sug.id}
                onClick={() => handleDismiss(sug.id)}
                className="text-xs text-ink/50 hover:text-ink hover:bg-sage/20"
              >
                <X className="h-3.5 w-3.5" /> Dismiss
              </Button>
            </div>
          </div>

          {/* Inline Slot Picker when user clicks confirm */}
          {selectedSug?.id === sug.id && (
            <div className="mt-4 pt-3 border-t border-teal-500/20 bg-white/70 dark:bg-ink/10 rounded-xl p-3">
              <p className="text-xs font-semibold text-ink mb-2 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-teal-600" />
                Select a time slot for {formatDate(sug.suggested_date)}:
              </p>

              {slotsLoading ? (
                <div className="flex items-center gap-2 text-xs text-ink/60 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-600" /> Loading available doctor slots…
                </div>
              ) : slots.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-amber-700 py-1">
                  <AlertCircle className="h-4 w-4 text-amber-600" /> No standard slots available on this exact date. Please check with clinic or select a different time in booking.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {slots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => setSelectedTime(slot.time)}
                        className={
                          "py-1.5 px-2 rounded-lg text-xs font-medium border transition " +
                          (selectedTime === slot.time
                            ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                            : "bg-white text-ink border-sage/40 hover:bg-teal-50")
                        }
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={handleConfirm}
                      loading={submitting}
                      disabled={!selectedTime}
                      className="bg-teal-600 hover:bg-teal-700 text-white text-xs"
                    >
                      Book Appointment ({selectedTime || "Select time"})
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedSug(null)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
