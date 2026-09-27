import { useState } from "react";
import { MessageSquare, Calendar, Download, Send, ExternalLink, Check, Copy, X, Loader2, Smartphone, ShieldCheck } from "lucide-react";
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
  const [phone, setPhone] = useState(appointment?.patient_phone || "+91");
  const [msgType, setMsgType] = useState("confirmation");
  const [customNote, setCustomNote] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSentResult, setLastSentResult] = useState(null);

  if (!isOpen || !appointment) return null;

  const defaultText = buildAppointmentWhatsAppText(appointment, msgType);
  const effectiveText =
    msgType === "custom" && customNote.trim()
      ? `🏥 *MediTalk Clinical Notice*\n\nRegarding consultation with Dr. ${appointment.doctor_name || appointment.doctorName}:\n\n${customNote}\n\n📅 Date: ${appointment.date} at ${appointment.time}`
      : defaultText;

  const waLink = generateWhatsAppLink(phone, effectiveText);
  const googleCalUrl = generateGoogleCalendarUrl(appointment);

  async function handleSendApi() {
    const rawDigits = phone.replace(/[^\d]/g, "");
    if (!rawDigits || rawDigits.length < 8) {
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
            appointmentType: appointment.type === "video" ? "Video Consultation" : "In-Clinic Consultation",
            appointmentId: appointment.id,
          },
        }),
      });

      if (res.success) {
        setLastSentResult(res);
        toast.success(
          res.mode === "twilio"
            ? "WhatsApp message dispatched via Twilio Gateway!"
            : "WhatsApp test processed successfully (Simulation mode)"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800 shadow-sm shrink-0">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  WhatsApp & Omnichannel Testing Sandbox
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Test clinical delivery to personal phone or simulate automated alerts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-4">
          {/* Phone Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span>Test Phone Number</span>
              <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400">
                Enter your personal number to test live
              </span>
            </label>
            <Input
              type="text"
              placeholder="+91 9876543210 (include country code)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Template Selector */}
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Clinical Notification Template
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: "confirmation", label: "Confirmation" },
                { id: "reminder_2h", label: "2h Video Alert" },
                { id: "patient_late_ping", label: "Late Patient" },
                { id: "prescription_ready", label: "Prescription" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMsgType(t.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition text-center ${
                    msgType === t.id
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Message Preview */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider">
                Message Preview
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed max-h-32 overflow-y-auto">
              {effectiveText}
            </pre>
          </div>

          {/* Result Banner if sent */}
          {lastSentResult && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2 animate-fade-in">
              <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">WhatsApp alert processed!</p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Mode: <span className="font-mono uppercase">{lastSentResult.mode}</span> · Target: {lastSentResult.to}
                </p>
              </div>
            </div>
          )}

          {/* Main Action Buttons */}
          <div className="grid sm:grid-cols-2 gap-2 pt-1">
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
              className="text-xs font-semibold border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50"
            >
              {sending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Dispatching...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Send via Backend API
                </>
              )}
            </Button>
          </div>

          {/* Calendar Sync Verification */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" /> Calendar Sync Tests
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={googleCalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 transition"
              >
                <Calendar className="h-3.5 w-3.5 text-blue-600" /> Test Google Cal
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>

              <button
                type="button"
                onClick={() => {
                  downloadIcsFile(appointment);
                  toast.success("iCal (.ics) downloaded!");
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 transition"
              >
                <Download className="h-3.5 w-3.5" /> Download .ICS
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
