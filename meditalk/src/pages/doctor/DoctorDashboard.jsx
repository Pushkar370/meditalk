import { useNavigate } from "react-router-dom";
import { CalendarDays, Users, ClipboardList, CalendarClock, Play, Eye, Clock } from "lucide-react";
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

  const { data: currentDoctor } = useFetch(() => (doctorId ? getDoctorById(doctorId) : Promise.resolve(null)), [doctorId]);
  const { data: appts, loading } = useFetch(() => getAppointments({ doctorId }), [doctorId]);
  const { data: patients } = useFetch(() => getPatients());
  const { data: consultations } = useFetch(() => getConsultations({ doctorId }), [doctorId]);

  if (loading) return <LoadingState />;

  const list = appts || [];
  const todays = list.filter((a) => a.date === today);
  const pending = list.filter((a) => a.status === "upcoming" || a.status === "confirmed").length;
  const followUps = (consultations || []).filter((c) => c.followUpDate && c.followUpDate >= today).length;

  const columns = [
    { key: "time", label: "Time" },
    { key: "patientName", label: "Patient" },
    { key: "type", label: "Type" },
    { key: "reason", label: "Reason" },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      label: "Action",
      render: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={() => navigate(`/doctor/consultation/${row.patientId}?apptId=${row.id}`)}>
            <Play className="h-3.5 w-3.5" /> Start
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/doctor/patients/${row.patientId}`)}>
            <Eye className="h-3.5 w-3.5" /> View
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
          <p className="font-medium text-ink">{p.name}</p>
          <p className="text-xs text-ink/50">{p.id} · {p.gender || "—"}</p>
        </div>
      ),
    },
    { key: "phone", label: "Contact", render: (p) => p.phone || p.email || "—" },
    { key: "bloodGroup", label: "Blood Group", render: (p) => p.bloodGroup || p.blood_group || "—" },
    {
      key: "conditions",
      label: "Allergies / Conditions",
      render: (p) => {
        const all = Array.isArray(p.allergies) ? p.allergies : [];
        const cond = Array.isArray(p.chronicConditions) ? p.chronicConditions : [];
        const list = [...all, ...cond];
        return list.length ? (
          <span className="text-xs text-ink/70">{list.slice(0, 2).join(", ")}{list.length > 2 ? ` +${list.length - 2}` : ""}</span>
        ) : (
          <span className="text-xs text-ink/40">None recorded</span>
        );
      },
    },
    { key: "status", label: "Status", render: (p) => <StatusBadge status={p.status || "active"} /> },
    {
      key: "actions",
      label: "Actions",
      render: (p) => (
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={() => navigate(`/doctor/consultation/${p.id}`)}>
            <Play className="h-3.5 w-3.5" /> Consult
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/doctor/patients/${p.id}`)}>
            <Eye className="h-3.5 w-3.5" /> View
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Doctor Dashboard" subtitle={`Welcome, ${user?.name || "Doctor"}`} />

      {currentDoctor?.verification_status === "pending" && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-amber-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">Medical License Verification Under Review</p>
              <p className="text-xs text-amber-700/80">
                Your medical credentials and licensing documents are currently being reviewed by clinic administration. Patient booking availability will be unlocked once verification is complete.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-800 shrink-0">
            Pending Review
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CalendarDays} label="Today's Appointments" value={todays.length} tone="primary" />
        <div onClick={() => navigate("/doctor/patients")} className="cursor-pointer transition hover:scale-[1.01]">
          <StatCard icon={Users} label="Total Patients" value={(patients || []).length} tone="sage" hint="Click to view all →" />
        </div>
        <StatCard icon={ClipboardList} label="Pending Consultations" value={pending} tone="accent" />
        <StatCard icon={CalendarClock} label="Follow-ups" value={followUps} tone="success" />
      </div>

      <div className="card">
        <h3 className="font-semibold text-ink mb-4">Today's Appointments</h3>
        <DataTable columns={columns} data={todays} emptyMessage="No appointments scheduled for today." />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-ink">Assigned Patients</h3>
            <p className="text-xs text-ink/50 mt-0.5">Quick access to medical profiles and instant consultation.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate("/doctor/patients")}>
            View All ({(patients || []).length})
          </Button>
        </div>
        <DataTable
          columns={patientColumns}
          data={(patients || []).slice(0, 5)}
          emptyMessage="No patients assigned yet."
        />
      </div>
    </div>
  );
}
