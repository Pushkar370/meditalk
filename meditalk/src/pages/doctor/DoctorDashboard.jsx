import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Users,
  ClipboardList,
  CalendarClock,
  Play,
  Eye,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import LoadingState from "../../components/ui/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { getAppointments } from "../../services/appointmentService";
import { getPatients } from "../../services/patientService";
import { getConsultations } from "../../services/prescriptionService";
import { getDoctorById } from "../../services/doctorService";
import { formatDate } from "../../constants";

export default function DoctorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const doctorId = user?.id || "D-201";
  const today = new Date().toISOString().slice(0, 10);

  const { data: currentDoctor } = useFetch(
    () => (doctorId ? getDoctorById(doctorId) : Promise.resolve(null)),
    [doctorId]
  );
  const { data: appts, loading } = useFetch(
    () => getAppointments({ doctorId }),
    [doctorId]
  );
  const { data: patients } = useFetch(() => getPatients());
  const { data: consultations } = useFetch(
    () => getConsultations({ doctorId }),
    [doctorId]
  );

  if (loading) return <LoadingState />;

  const list = appts || [];
  const todays = list.filter((a) => a.date === today);
  const pending = list.filter(
    (a) => a.status === "upcoming" || a.status === "confirmed"
  ).length;
  const followUps = (consultations || []).filter(
    (c) => c.followUpDate && c.followUpDate >= today
  ).length;

  const columns = [
    { key: "time", label: "Time" },
    { key: "patientName", label: "Patient" },
    { key: "type", label: "Mode" },
    { key: "reason", label: "Reason for Visit" },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      label: "Action",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() =>
              navigate(`/doctor/consultation/${row.patientId}?apptId=${row.id}`)
            }
            className="text-xs"
          >
            <Play className="h-3 w-3 mr-1" /> Start
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/doctor/patients/${row.patientId}`)}
            className="text-xs"
          >
            <Eye className="h-3 w-3 mr-1" /> View
          </Button>
        </div>
      ),
    },
  ];

  const patientColumns = [
    {
      key: "name",
      label: "Patient",
      render: (p) => (
        <div>
          <p className="font-semibold text-ink dark:text-dark-ink">{p.name}</p>
          <p className="text-xs text-ink/50 dark:text-dark-ink/50">
            {p.id} · {p.gender || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Contact",
      render: (p) => p.phone || p.email || "—",
    },
    {
      key: "bloodGroup",
      label: "Blood Group",
      render: (p) => p.bloodGroup || p.blood_group || "—",
    },
    {
      key: "conditions",
      label: "Allergies / Conditions",
      render: (p) => {
        const all = Array.isArray(p.allergies) ? p.allergies : [];
        const cond = Array.isArray(p.chronicConditions) ? p.chronicConditions : [];
        const combined = [...all, ...cond];
        return combined.length ? (
          <span className="text-xs text-ink/75 dark:text-dark-ink/75 font-medium">
            {combined.slice(0, 2).join(", ")}
            {combined.length > 2 ? ` +${combined.length - 2}` : ""}
          </span>
        ) : (
          <span className="text-xs text-ink/40 dark:text-dark-ink/40">
            None recorded
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (p) => <StatusBadge status={p.status || "active"} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (p) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => navigate(`/doctor/consultation/${p.id}`)}
            className="text-xs"
          >
            <Play className="h-3 w-3 mr-1" /> Consult
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/doctor/patients/${p.id}`)}
            className="text-xs"
          >
            <Eye className="h-3 w-3 mr-1" /> Chart
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Physician Workspace"
        subtitle={`Welcome back, Dr. ${user?.name || "Doctor"}. Today's clinical schedule and patient telemetry.`}
      />

      {currentDoctor?.verification_status === "pending" && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-4 text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                Medical License Verification Under Review
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                Your medical licensing credentials are being reviewed by clinic administration. Patient booking availability will unlock once verified.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 shrink-0">
            Pending Review
          </span>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={CalendarDays}
          label="Today's Appointments"
          value={todays.length}
          tone="primary"
        />
        <div
          onClick={() => navigate("/doctor/patients")}
          className="cursor-pointer transition-transform hover:scale-[1.01]"
        >
          <StatCard
            icon={Users}
            label="Total Patients"
            value={(patients || []).length}
            tone="sage"
            hint="View patient registry →"
          />
        </div>
        <StatCard
          icon={ClipboardList}
          label="Pending Consults"
          value={pending}
          tone="accent"
        />
        <StatCard
          icon={CalendarClock}
          label="Follow-ups"
          value={followUps}
          tone="success"
        />
      </div>

      {/* Today's Appointments Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-ink dark:text-dark-ink text-base">
              Today's Scheduled Appointments
            </h3>
            <p className="text-xs text-ink/50 dark:text-dark-ink/50 mt-0.5">
              Patients scheduled for virtual and in-person visits today
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate("/doctor/appointments")}
            className="text-xs text-primary dark:text-primary-light"
          >
            All Appointments →
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={todays}
          emptyMessage="No consultations scheduled for today."
        />
      </div>

      {/* Assigned Patients Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-ink dark:text-dark-ink text-base">
              Patient Registry
            </h3>
            <p className="text-xs text-ink/50 dark:text-dark-ink/50 mt-0.5">
              Quick access to clinical charts, histories, and instant consultation.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/doctor/patients")}
            className="text-xs"
          >
            View All ({(patients || []).length})
          </Button>
        </div>
        <DataTable
          columns={patientColumns}
          data={(patients || []).slice(0, 5)}
          emptyMessage="No patients currently assigned to your department."
        />
      </div>
    </div>
  );
}
