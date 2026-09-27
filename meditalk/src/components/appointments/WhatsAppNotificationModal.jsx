import { useState } from "react";
import { MessageSquare, Calendar, Download, Send, ExternalLink, Check, Copy, X, Loader2, Sparkles, Smartphone } from "lucide-react";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { useToast } from "../../context/ToastContext";
import {
  generateGoogleCalendarUrl,
  downloadIcsFile,
  generateWhatsAppLink,
  buildAppointmentWhatsAppText,
} from "../../utils/calendarSync";
import { apiFetch } from "../../services/apiClient";

export default function WhatsAppNotificationModal({ isOpen, onClose, appointment }) {
  const toast = useToast();
  const [phone, setPhone] = useState(appointment?.patient_phone || "");
  const [msgType, setMsgType] = useState("confirmation");
  const [customNote, setCustomNote] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSentResult, setLastSentResult] = useState(null);

  if (!isOpen || !appointment) return null;

  const defaultText = buildAppointmentWhatsAppText(appointment);
  const effectiveText =
    msgType === "custom" && customNote.trim()
      ? `🏥 *MediTalk Notice*\n\nRegarding your appointment with Dr. ${appointment.doctor_name || appointment.doctorName}:\n\n${customNote}\n\n📅 Date: ${appointment.date} at ${appointment.time}`
      : defaultText;

  const waLink = generateWhatsAppLink(phone, effectiveText);
  const googleCalUrl = generateGoogleCalendarUrl(appointment);

  async function handleSendApi() {
    if (!phone || phone.trim().length < 8) {
      toast.error("Please enter a valid phone number with country code (e.g. +91 9876543210)");
      return;
    }
    setSending(true);
    setLastSentResult(null);
    try {
      const res = await apiFetch("/messaging/test-whatsapp", {
        method: "POST",
        body: JSON.stringify({
          phone,
          type: msgType,
          customText: msgType === "custom" ? customNote : undefined,
          data: {
            patientName: appointment.patient_name || appointment.patientName,
            doctorName: appointment.doctor_name || appointment.doctorName,
            specialty: appointment.specialty,
            date: appointment.date,
            time: appointment.time,
            appointmentType: appointment.type === "video" ? "Video Consultation" : "In-Clinic Visit",
            appointmentId: appointment.id,
          },
        }),
      });

      if (res.success) {
        setLastSentResult(res);
        toast.success(
          res.mode === "twilio"
            ? "WhatsApp message sent via Twilio Gateway!"
            : "WhatsApp alert generated! (Simulation / Click-to-Chat active)"
        );
      } else {
        toast.error(res.error || "Failed to dispatch WhatsApp alert");
      }
    } catch (err) {
      toast.error(err.message || "Network error dispatching WhatsApp alert");
    } finally {
      setSending(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(effectiveText);
    toast.success("Message copied to clipboard!");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-sage/40 dark:border-slate-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sage/20 dark:border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">WhatsApp & Calendar Sync</h3>
              <p className="text-xs text-ink/60">Test notifications or add consultation to your calendar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink/50 hover:text-ink hover:bg-sage/20 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-4">
          {/* Phone Input with Test Hint */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5 flex items-center justify-between">
              <span>Recipient WhatsApp Phone Number</span>
              <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Smartphone className="h-3 w-3" /> Test with your personal phone
              </span>
            </label>
            <Input
              type="text"
              placeholder="+91 9876543210 (include country code)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Notification Type Selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMsgType("confirmation")}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left transition ${
                msgType === "confirmation"
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                  : "border-sage/40 hover:bg-sage/20 text-ink/70"
              }`}
            >
              📅 Booking Confirmation
            </button>
            <button
              type="button"
              onClick={() => setMsgType("reminder_2h")}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left transition ${
                msgType === "reminder_2h"
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                  : "border-sage/40 hover:bg-sage/20 text-ink/70"
              }`}
            >
              🔔 2-Hour Video Link
            </button>
          </div>

          {/* Live Message Preview */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3.5 text-xs text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider flex items-center gap-1">
                💬 Message Preview
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed max-h-36 overflow-y-auto">
              {effectiveText}
            </pre>
          </div>

          {/* Result Banner if sent */}
          {lastSentResult && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2 animate-fade-in">
              <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">WhatsApp alert processed!</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  Mode: <span className="font-mono uppercase">{lastSentResult.mode}</span> · Target: {lastSentResult.to}
                </p>
              </div>
            </div>
          )}

          {/* Main Action Buttons */}
          <div className="grid sm:grid-cols-2 gap-2.5 pt-2">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
            >
              <MessageSquare className="h-4 w-4" />
              Open in WhatsApp Web / App
              <ExternalLink className="h-3 w-3 opacity-70" />
            </a>

            <Button
              type="button"
              variant="outline"
              disabled={sending}
              onClick={handleSendApi}
              className="text-xs font-semibold border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50"
            >
              {sending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Dispatching...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Send WhatsApp via API
                </>
              )}
            </Button>
          </div>

          {/* Calendar Sync Divider */}
          <div className="pt-3 border-t border-sage/20 dark:border-slate-800">
            <p className="text-xs font-semibold text-ink mb-2 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" /> Calendar Synchronization
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={googleCalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 transition"
              >
                <Calendar className="h-3.5 w-3.5" /> Google Calendar
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>

              <button
                type="button"
                onClick={() => {
                  downloadIcsFile(appointment);
                  toast.success("iCal (.ICS) file downloaded!");
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-ink text-xs font-semibold hover:bg-slate-200 transition"
              >
                <Download className="h-3.5 w-3.5" /> Download .ICS (Apple/Outlook)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
