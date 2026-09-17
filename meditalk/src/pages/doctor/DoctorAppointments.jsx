import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Video } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import SearchBar from "../../components/ui/SearchBar";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { getAppointments } from "../../services/appointmentService";
import { formatDate } from "../../constants";

const FILTERS = ["All", "upcoming", "confirmed", "completed", "cancelled"];

export default function DoctorAppointments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const doctorId = user?.id || user?.doctorId || "D-201";
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const { data: appts, loading } = useFetch(() => getAppointments({ doctorId }), [doctorId]);

  if (loading) return <LoadingState />;

  const list = (appts || [])
    .filter((a) => filter === "All" || a.status === filter)
    .filter((a) => (a.patientName || "").toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { key: "date", label: "Date", render: (r) => formatDate(r.date) },
    { key: "time", label: "Time" },
    { key: "patientName", label: "Patient" },
    { key: "type", label: "Type" },
    { key: "reason", label: "Reason" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`/doctor/patients/${r.patientId}`)}>
            View Patient
          </Button>
          {(r.status === "upcoming" || r.status === "confirmed") && (
            <Button
              size="sm"
              onClick={() => navigate(`/doctor/consultation/${r.patientId}?apptId=${r.id}`)}
            >
              <Video className="h-3.5 w-3.5" /> Consult
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Appointments" subtitle="Manage your patient appointments." />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "px-3 py-1.5 rounded-full text-sm font-medium capitalize transition " +
                (filter === f ? "bg-primary text-white" : "bg-white text-ink/60 border border-sage/40 hover:bg-sage/20")
              }
            >
              {f}
            </button>
          ))}
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search patient..." className="sm:w-64" />
      </div>

      <div className="card">
        {list.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No appointments" />
        ) : (
          <DataTable columns={columns} data={list} />
        )}
      </div>
    </div>
  );
}
