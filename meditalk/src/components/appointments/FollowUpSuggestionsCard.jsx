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
      toast.success(
        `Follow-up booked with Dr. ${selectedSug.doctor_name} on ${formatDate(
          selectedSug.suggested_date
        )} at ${selectedTime}!`
      );
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
          className="relative overflow-hidden rounded-2xl bg-surface dark:bg-dark-surface border border-primary/20 dark:border-primary/30 p-5 shadow-card dark:shadow-none transition-all duration-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light flex items-center justify-center shrink-0">
                <CalendarCheck2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light">
                    Recommended Follow-Up
                  </span>
                  <span className="text-xs font-semibold text-ink dark:text-dark-ink">
                    Dr. {sug.doctor_name}
                  </span>
                  <span className="text-xs text-ink/50 dark:text-dark-ink/50">
                    ({sug.specialty || "Specialist"})
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-ink dark:text-dark-ink">
                  Proposed Date: {formatDate(sug.suggested_date)}
                </h4>
                {sug.reason && (
                  <p className="text-xs text-ink/70 dark:text-dark-ink/70">
                    <span className="font-medium text-ink dark:text-dark-ink">Clinical reason:</span>{" "}
                    {sug.reason}
                  </p>
                )}
                {sug.instructions && (
                  <p className="text-[11px] text-ink/80 dark:text-dark-ink/80 italic bg-canvas dark:bg-dark-surface-elevated px-2.5 py-1 rounded-lg border border-border-subtle dark:border-dark-border-subtle inline-block mt-1">
                    "{sug.instructions}"
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => handleOpenConfirm(sug)}
                className="text-xs"
              >
                <Check className="h-3.5 w-3.5" /> 1-Click Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={dismissingId === sug.id}
                onClick={() => handleDismiss(sug.id)}
                className="text-xs text-ink/50 dark:text-dark-ink/50 hover:text-ink dark:hover:text-dark-ink"
              >
                <X className="h-3.5 w-3.5" /> Dismiss
              </Button>
            </div>
          </div>

          {/* Inline Slot Picker when user clicks confirm */}
          {selectedSug?.id === sug.id && (
            <div className="mt-4 pt-4 border-t border-border-subtle dark:border-dark-border-subtle bg-canvas dark:bg-dark-surface-elevated/50 rounded-xl p-3.5">
              <p className="text-xs font-medium text-ink dark:text-dark-ink mb-2.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Select a time slot for {formatDate(sug.suggested_date)}:
              </p>

              {slotsLoading ? (
                <div className="flex items-center gap-2 text-xs text-ink/60 dark:text-dark-ink/60 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading available doctor slots…
                </div>
              ) : slots.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 py-1">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  No standard slots available on this date. Please check with clinic or select another day.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {slots.map((slot) => {
                      const isSelected = selectedTime === slot.time;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => setSelectedTime(slot.time)}
                          className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all duration-150 active:scale-[0.98] ${
                            isSelected
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-surface dark:bg-dark-surface text-ink dark:text-dark-ink border-border-subtle dark:border-dark-border-subtle hover:border-primary/40"
                          }`}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={handleConfirm}
                      loading={submitting}
                      disabled={!selectedTime}
                      className="text-xs"
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
