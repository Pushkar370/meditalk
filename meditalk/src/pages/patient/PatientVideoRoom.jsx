import { useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Video, ArrowLeft, Clock, CheckCircle2 } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import LoadingState from "../../components/ui/LoadingState";
import VideoRoom from "../../components/video/VideoRoom";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { getAppointmentById } from "../../services/appointmentService";
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
