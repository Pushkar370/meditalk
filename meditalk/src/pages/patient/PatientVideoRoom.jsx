import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Video,
  ArrowLeft,
  Clock,
  CheckCircle2,
  ClipboardList,
  Pill,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import LoadingState from "../../components/ui/LoadingState";
import VideoRoom from "../../components/video/VideoRoom";
import EmergencyBanner from "../../components/ui/EmergencyBanner";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import {
  getAppointmentById,
  recordTelehealthConsent,
} from "../../services/appointmentService";
import { formatDate } from "../../constants";

const POLL_MS = 5000;

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
      setConsented(true);
    } finally {
      setSubmittingConsent(false);
    }
  }

  // Poll for video status changes
  useEffect(() => {
    if (!appointmentId) return;
    const videoStatus = appointment?.videoStatus;
    if (videoStatus === "ended") return;

    const timer = setInterval(() => {
      reload();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [appointmentId, appointment?.videoStatus, reload]);

  if (loading && !appointment) return <LoadingState />;
  if (!appointment) {
    return (
      <div className="card text-center py-16">
        <p className="text-ink/50 dark:text-dark-ink/50 text-sm font-medium">
          Appointment not found or expired.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 text-xs"
          onClick={() => navigate("/patient/appointments")}
        >
          Back to Appointments
        </Button>
      </div>
    );
  }

  const hasConsent = appointment.telehealthConsent || consented;

  if (!hasConsent) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 py-8 animate-fade-in">
        <PageHeader
          title="Telehealth Consultation"
          subtitle={`With Dr. ${appointment.doctorName} · ${formatDate(
            appointment.date
          )} at ${appointment.time}`}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/patient/appointments")}
              className="text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
          }
        />

        <div className="card space-y-6 p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light flex items-center justify-center shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink dark:text-dark-ink">
                Informed Telehealth Consent
              </h2>
              <p className="text-xs text-ink/60 dark:text-dark-ink/60 mt-0.5">
                Required prior to entering your virtual clinical examination room.
              </p>
            </div>
          </div>

          <EmergencyBanner compact />

          <div className="space-y-3 text-xs text-ink/80 dark:text-dark-ink/80 bg-canvas dark:bg-dark-surface-elevated/40 p-4 sm:p-5 rounded-2xl border border-border-subtle dark:border-dark-border-subtle leading-relaxed">
            <p className="font-semibold text-ink dark:text-dark-ink">
              Please review and acknowledge virtual care conditions:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[11px] text-ink/75 dark:text-dark-ink/75">
              <li>
                <strong>Virtual Care Modality:</strong> You are connecting to a virtual consultation using encrypted two-way audio/video telemetry.
              </li>
              <li>
                <strong>Clinical Scope & Limitations:</strong> Telehealth has inherent diagnostic boundaries compared to in-person physical exams. If your physician deems physical palpation, blood draw, or in-person exam necessary, you will be promptly referred.
              </li>
              <li>
                <strong>Emergency Protocol:</strong> If you experience severe chest pain, shortness of breath, signs of stroke, or acute trauma, you agree to immediately call <strong>112 / 911</strong> rather than waiting on video.
              </li>
              <li>
                <strong>Confidentiality & Privacy:</strong> Your video stream is encrypted with TLS 1.3. Please verify you are in a quiet, confidential space.
              </li>
            </ul>
          </div>

          <label className="flex items-start gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={agreeChecked}
              onChange={(e) => setAgreeChecked(e.target.checked)}
              className="mt-0.5 rounded border-border-subtle dark:border-dark-border-subtle text-primary focus:ring-primary h-4 w-4 shrink-0 cursor-pointer"
            />
            <span className="text-xs font-medium text-ink dark:text-dark-ink leading-snug">
              I have read and agree to the telehealth informed consent terms. I voluntarily consent to participate in this virtual clinical visit with Dr. {appointment.doctorName}.
            </span>
          </label>

          <Button
            className="w-full text-xs py-3"
            size="lg"
            disabled={!agreeChecked || submittingConsent}
            loading={submittingConsent}
            onClick={handleAcceptConsent}
          >
            <Video className="h-4 w-4 mr-2" /> Accept Consent & Enter Video Room
          </Button>
        </div>
      </div>
    );
  }

  const videoStatus = appointment.videoStatus || null;
  const roomId = `meditalk-${appointmentId}`;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Video Consultation"
        subtitle={`With Dr. ${appointment.doctorName} · ${formatDate(
          appointment.date
        )} at ${appointment.time}`}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/patient/appointments")}
            className="text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
          </Button>
        }
      />

      {/* Status Banner */}
      <div
        className={`flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl border transition-all ${
          videoStatus === "in_progress"
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300"
            : videoStatus === "ended"
            ? "bg-canvas dark:bg-dark-surface-elevated/40 border-border-subtle dark:border-dark-border-subtle text-ink/60 dark:text-dark-ink/60"
            : "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300"
        }`}
      >
        {videoStatus === "in_progress" ? (
          <>
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div>
              <p className="text-sm font-semibold">Your doctor has started the call</p>
              <p className="text-xs opacity-80 mt-0.5">
                You are currently connected to the secure clinical session below.
              </p>
            </div>
          </>
        ) : videoStatus === "ended" ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-ink/40 dark:text-dark-ink/40 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Consultation Concluded</p>
              <p className="text-xs opacity-80 mt-0.5">
                Your physician has finalized the video session.
              </p>
            </div>
          </>
        ) : (
          <>
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
            <div>
              <p className="text-sm font-semibold">Waiting for doctor to initiate…</p>
              <p className="text-xs opacity-80 mt-0.5">
                Checking for provider arrival every 5 seconds. Please remain in this lobby.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Post-Consultation Wrap-Up Actions */}
      {videoStatus === "ended" && (
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-ink dark:text-dark-ink text-base">
                Consultation Finalized
              </h3>
              <p className="text-xs text-ink/60 dark:text-dark-ink/60">
                Your medical notes, diagnostic impressions, and prescriptions are now ready.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 pt-3 border-t border-border-subtle dark:border-dark-border-subtle">
            <Button
              size="sm"
              onClick={() => navigate("/patient/appointments")}
              className="w-full text-xs"
            >
              <ClipboardList className="h-3.5 w-3.5 mr-1" /> After-Visit Summary (AVS)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/patient/prescriptions")}
              className="w-full text-xs"
            >
              <Pill className="h-3.5 w-3.5 mr-1 text-primary" /> View Prescriptions
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                navigate("/patient/book-appointment", {
                  state: { recommendedSpecialty: appointment.specialty },
                })
              }
              className="w-full text-xs"
            >
              <Calendar className="h-3.5 w-3.5 mr-1" /> Book Follow-Up
            </Button>
          </div>
        </div>
      )}

      {/* Video Room */}
      <div className="card p-2 sm:p-3">
        <VideoRoom
          roomId={roomId}
          displayName={user?.name || "Patient"}
          videoStatus={videoStatus}
          isDoctor={false}
        />
      </div>

      {/* Appointment Details */}
      <div className="card">
        <h3 className="font-semibold text-ink dark:text-dark-ink text-base mb-4">
          Consultation Summary & Metadata
        </h3>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <Detail label="Physician" value={`Dr. ${appointment.doctorName}`} />
          <Detail label="Specialty" value={appointment.specialty} />
          <Detail label="Date" value={formatDate(appointment.date)} />
          <Detail label="Time" value={appointment.time} />
          <Detail label="Consultation Type" value={appointment.type} />
          <Detail label="Reason for Visit" value={appointment.reason} />
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-semibold text-ink/50 dark:text-dark-ink/50 uppercase tracking-wider block">
        {label}
      </span>
      <p className="text-sm font-medium text-ink dark:text-dark-ink">{value || "—"}</p>
    </div>
  );
}
