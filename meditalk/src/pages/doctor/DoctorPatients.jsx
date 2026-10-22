import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Eye, Play, ArrowUpDown } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import SearchBar from "../../components/ui/SearchBar";
import Select from "../../components/ui/Select";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useFetch } from "../../hooks/useFetch";
import { getPatients } from "../../services/patientService";
import { getAppointments } from "../../services/appointmentService";
import { formatDate } from "../../constants";

const PAGE_SIZE = 8;

function ageFrom(dob) {
  if (!dob) return "-";
  const yr = new Date(dob).getFullYear();
  return isNaN(yr) ? "-" : new Date().getFullYear() - yr;
}

export default function DoctorPatients() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);

  const { data: patients, loading: loadingPatients } = useFetch(() => getPatients());
  const { data: appointments, loading: loadingAppointments } = useFetch(() =>
    getAppointments()
  );

  function lastVisit(id) {
    const done = (appointments || []).filter(
      (a) =>
        (a.patientId === id || a.patient_id === id) && a.status === "completed"
    );
    return done.length ? formatDate(done[0].date) : "—";
  }
  function nextVisit(id) {
    const up = (appointments || []).filter(
      (a) =>
        (a.patientId === id || a.patient_id === id) &&
        (a.status === "upcoming" || a.status === "confirmed")
    );
    return up.length ? formatDate(up[0].date) : "—";
  }

  const rows = useMemo(() => {
    let list = (patients || [])
      .filter(
        (p) =>
          (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
          (p.id || "").toLowerCase().includes(search.toLowerCase())
      )
      .map((p) => ({ ...p, age: ageFrom(p.dob) }));
    if (sort === "name") list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else if (sort === "age")
      list.sort((a, b) => (Number(a.age) || 0) - (Number(b.age) || 0));
    return list;
  }, [patients, appointments, search, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loadingPatients || loadingAppointments) return <LoadingState />;

  const columns = [
    { key: "id", label: "Patient ID" },
    { key: "name", label: "Name" },
    { key: "age", label: "Age" },
    { key: "gender", label: "Gender" },
    { key: "lastVisit", label: "Last Visit", render: (r) => lastVisit(r.id) },
    { key: "nextVisit", label: "Next Appt.", render: (r) => nextVisit(r.id) },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/doctor/patients/${r.id}`)}
            className="text-xs"
          >
            <Eye className="h-3 w-3 mr-1" /> Chart
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(`/doctor/consultation/${r.id}`)}
            className="text-xs"
          >
            <Play className="h-3 w-3 mr-1" /> Consult
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Patient Directory"
        subtitle="Search and review clinical records for all assigned patients."
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by patient name, ID, or phone..."
          className="flex-1"
        />
        <div className="sm:w-48">
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">Sort by: Name</option>
            <option value="age">Sort by: Age</option>
          </Select>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No patients found"
            message="No patient matched your search criteria."
          />
        ) : (
          <div className="space-y-4">
            <DataTable columns={columns} data={pageRows} />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
