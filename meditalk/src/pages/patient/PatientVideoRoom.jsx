import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Video, ArrowLeft, Clock, CheckCircle2, ClipboardList, Pill, Calendar, ShieldCheck } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import LoadingState from "../../components/ui/LoadingState";
import VideoRoom from "../../components/video/VideoRoom";
import EmergencyBanner from "../../components/ui/EmergencyBanner";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { getAppointmentById, recordTelehealthConsent } from "../../services/appointmentService";
import { formatDate } from "../../constants";

const POLL_MS = 5000; // poll every 5 seconds

export default function PatientVideoRoom() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: appointment, loading, reload } = useFetch(
    () => getAppointmentById(appointmentId),
    [appointmentId]
  );

  const [consented, setConsented] = useState(false);
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [submittingConsent, setSubmittingConsent] = useState(false);

  async function handleAcceptConsent() {
    setSubmittingConsent(true);
    try {
      await recordTelehealthConsent(appointmentId);
      setConsented(true);
    } catch (_) {
      // Allow user through even if offline/fallback
      setConsented(true);
    } finally {
      setSubmittingConsent(false);
    }
  }

  // Poll for video status changes
  useEffect(() => {
    if (!appointmentId) return;
    const videoStatus = appointment?.videoStatus;
    // Stop polling once ended
    if (videoStatus === "ended") return;

    const timer = setInterval(() => {
      reload();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [appointmentId, appointment?.videoStatus, reload]);

  if (loading && !appointment) return <LoadingState />;
  if (!appointment) {
    return (
      <div className="card text-center py-12">
        <p className="text-ink/50 text-sm">Appointment not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/patient/appointments")}>
          Back to Appointments
        </Button>
      </div>
    );
  }

  const hasConsent = appointment.telehealthConsent || consented;

  if (!hasConsent) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-6">
        <PageHeader
          title="Telehealth Consultation"
          subtitle={`With ${appointment.doctorName} · ${formatDate(appointment.date)} at ${appointment.time}`}
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("/patient/appointments")}>
              <ArrowLeft className="h-4 w-4" /> Cancel
            </Button>
          }
        />

        <div className="card border-2 border-primary/30 space-y-5 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">Informed Telehealth Consent</h2>
              <p className="text-xs text-ink/60">
                Required prior to entering your video consultation room.
              </p>
            </div>
          </div>

          <EmergencyBanner compact />

          <div className="space-y-3 text-xs text-ink/80 bg-sage/10 p-4 rounded-xl border border-sage/20 leading-relaxed">
            <p className="font-semibold text-ink">Please review and acknowledge the virtual care conditions:</p>
            <ul className="list-disc list-inside space-y-1.5 text-[11px] text-ink/80">
              <li><strong>Virtual Care Modality:</strong> You are connecting to a virtual consultation using encrypted two-way audio/video.</li>
              <li><strong>Clinical Scope & Limitations:</strong> Telehealth has inherent diagnostic limitations compared to in-person physical exams. If the doctor determines in-person evaluation is medically necessary, you will be referred to a clinic or emergency department.</li>
              <li><strong>Emergency Protocol:</strong> If you experience severe chest pain, shortness of breath, signs of stroke, or trauma, you agree to immediately call <strong>112 / 911</strong> rather than waiting for telehealth advice.</li>
              <li><strong>Privacy & Confidentiality:</strong> Your session is encrypted with TLS 1.3. Please ensure you are in a quiet, private space.</li>
            </ul>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={agreeChecked}
              onChange={(e) => setAgreeChecked(e.target.checked)}
              className="mt-0.5 rounded border-sage/40 text-primary focus:ring-primary h-4 w-4 shrink-0"
            />
            <span className="text-xs font-medium text-ink leading-snug">
              I have read and agree to the telehealth informed consent terms. I voluntarily consent to participate in this virtual clinical visit with {appointment.doctorName}.
            </span>
          </label>

          <Button
            className="w-full"
            size="lg"
            disabled={!agreeChecked || submittingConsent}
            loading={submittingConsent}
            onClick={handleAcceptConsent}
          >
            <Video className="h-4 w-4" /> Accept Consent & Enter Video Room
          </Button>
        </div>
      </div>
    );
  }

  const videoStatus = appointment.videoStatus || null;
  const roomId = `meditalk-${appointmentId}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Video Consultation"
        subtitle={`With ${appointment.doctorName} · ${formatDate(appointment.date)} at ${appointment.time}`}
        action={
          <Button variant="outline" size="sm" onClick={() => navigate("/patient/appointments")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />

      {/* Status Banner */}
      <div className={"flex items-center gap-3 p-4 rounded-xl border " + statusBannerClass(videoStatus)}>
        {videoStatus === "in_progress" ? (
          <>
            <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-success">Your doctor has started the call</p>
              <p className="text-xs text-success/70">You are now connected to the video room below.</p>
            </div>
          </>
        ) : videoStatus === "ended" ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-ink/40" />
            <div>
              <p className="text-sm font-semibold text-ink/60">Consultation Ended</p>
              <p className="text-xs text-ink/40">Your doctor has closed the video session.</p>
            </div>
          </>
        ) : (
          <>
            <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-amber-700">Waiting for doctor to start…</p>
              <p className="text-xs text-amber-600/70">This page checks for updates every 5 seconds. Please stay on this page.</p>
            </div>
          </>
        )}
      </div>

      {/* Post-Consultation Wrap-Up Actions */}
      {videoStatus === "ended" && (
        <div className="card border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-sage/10 to-white space-y-3.5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-ink text-base">Consultation Concluded</h3>
              <p className="text-xs text-ink/70">Your appointment documentation, notes, and prescriptions have been updated.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-2.5 pt-2 border-t border-sage/20">
            <Button
              size="sm"
              onClick={() => navigate("/patient/appointments")}
              className="w-full flex items-center justify-center gap-1.5 text-xs shadow-sm"
            >
              <ClipboardList className="h-3.5 w-3.5" /> After-Visit Summary (AVS)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/patient/prescriptions")}
              className="w-full flex items-center justify-center gap-1.5 text-xs"
            >
              <Pill className="h-3.5 w-3.5 text-primary" /> View Prescriptions
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/patient/book-appointment", { state: { recommendedSpecialty: appointment.specialty } })}
              className="w-full flex items-center justify-center gap-1.5 text-xs"
            >
              <Calendar className="h-3.5 w-3.5" /> Book Follow-Up
            </Button>
          </div>
        </div>
      )}

      {/* Video Room */}
      <div className="card">
        <VideoRoom
          roomId={roomId}
          displayName={user?.name || "Patient"}
          videoStatus={videoStatus}
          isDoctor={false}
        />
      </div>

      {/* Appointment Details */}
      <div className="card">
        <h3 className="font-semibold text-ink text-sm mb-3">Appointment Details</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <Detail label="Doctor" value={appointment.doctorName} />
          <Detail label="Specialty" value={appointment.specialty} />
          <Detail label="Date" value={formatDate(appointment.date)} />
          <Detail label="Time" value={appointment.time} />
          <Detail label="Type" value={appointment.type} />
          <Detail label="Reason" value={appointment.reason} />
        </div>
      </div>
    </div>
  );
}

function statusBannerClass(status) {
  if (status === "in_progress") return "bg-success/10 border-success/30";
  if (status === "ended") return "bg-ink/5 border-sage/20";
  return "bg-amber-50 border-amber-200";
}

function Detail({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-ink/40 font-medium">{label}</span>
      <span className="text-ink font-medium">{value || "—"}</span>
    </div>
  );
}
