import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Pencil, Eye, Power } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import SearchBar from "../../components/ui/SearchBar";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import ConfirmationModal from "../../components/ui/ConfirmationModal";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import LoadingState from "../../components/ui/LoadingState";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import { getPatients, addPatient, updatePatient, setPatientStatus } from "../../services/patientService";
import { formatDate, GENDERS } from "../../constants";

const PAGE_SIZE = 6;

function ageFrom(dob) {
  return dob ? new Date().getFullYear() - new Date(dob).getFullYear() : "-";
}

export default function AdminPatients() {
  const toast = useToast();
  const navigate = useNavigate();
  const { data: list, loading, reload } = useFetch(() => getPatients());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [viewingPatient, setViewingPatient] = useState(null);
  const [form, setForm] = useState({});
  const [toggle, setToggle] = useState(null);
  const [saving, setSaving] = useState(false);

  if (loading) return <LoadingState />;

  const rows = (list || [])
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => statusFilter === "All" || p.status === statusFilter);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openAdd() {
    setEditing({});
    setForm({ name: "", email: "", phone: "", dob: "", gender: "", address: "", bloodGroup: "", status: "active" });
  }
  function openEdit(p) {
    setEditing(p);
    setForm(p);
  }

  async function save() {
    if (!form.name || !form.email) {
      toast.error("Name and email are required.");
      return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        await updatePatient(editing.id, form);
        toast.success("Patient updated successfully.");
      } else {
        await addPatient(form);
        toast.success("Patient added successfully.");
      }
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to save patient.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmToggle() {
    try {
      await setPatientStatus(toggle.id, toggle.next);
      toast.success(`Patient ${toggle.next === "active" ? "activated" : "deactivated"}.`);
      setToggle(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to update status.");
    }
  }

  const columns = [
    { key: "id", label: "Patient ID" },
    { key: "name", label: "Name" },
    { key: "age", label: "Age", render: (r) => ageFrom(r.dob) },
    { key: "gender", label: "Gender" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "registeredAt", label: "Registered", render: (r) => formatDate(r.registeredAt) },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setViewingPatient(r)} title="View Patient Details">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title="Edit Patient Details">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant={r.status === "active" ? "secondary" : "success"} onClick={() => setToggle({ id: r.id, next: r.status === "active" ? "inactive" : "active" })} title={r.status === "active" ? "Deactivate" : "Activate"}>
            <Power className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Patients" subtitle="Manage all registered patients."
        action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Patient</Button>} />

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name or ID..." className="flex-1" />
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="sm:w-44">
          <option value="All">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      <div className="card">
        {rows.length === 0 ? <EmptyState icon={Users} title="No patients found" /> : (
          <>
            <DataTable columns={columns} data={pageRows} />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* ── View Patient Details Modal ─── */}
      <Modal
        open={!!viewingPatient}
        onClose={() => setViewingPatient(null)}
        title="Patient Details"
        size="md"
        footer={
          <div className="flex justify-between w-full">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const p = viewingPatient;
                setViewingPatient(null);
                openEdit(p);
              }}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit Profile
            </Button>
            <Button size="sm" onClick={() => setViewingPatient(null)}>Close</Button>
          </div>
        }
      >
        {viewingPatient && (
          <div className="space-y-4">
            <div className="flex items-center gap-3.5 p-4 rounded-xl bg-sage/10 border border-sage/25">
              <div className="h-12 w-12 rounded-xl bg-white border border-sage/30 flex items-center justify-center font-bold text-primary text-lg shadow-sm">
                {viewingPatient.name?.charAt(0) || "P"}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-ink text-base">{viewingPatient.name}</h4>
                <p className="text-xs text-ink/60">ID: <span className="font-mono">{viewingPatient.id}</span> · {viewingPatient.gender || "—"}</p>
                <p className="text-[11px] text-ink/50 mt-0.5">Registered: {formatDate(viewingPatient.registeredAt)}</p>
              </div>
              <StatusBadge status={viewingPatient.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-white border border-sage/30 text-xs">
              <div>
                <span className="text-ink/50 block">Email Address</span>
                <span className="font-medium text-ink break-all">{viewingPatient.email || "—"}</span>
              </div>
              <div>
                <span className="text-ink/50 block">Phone</span>
                <span className="font-medium text-ink">{viewingPatient.phone || "—"}</span>
              </div>
              <div className="pt-2 border-t border-sage/20">
                <span className="text-ink/50 block">Date of Birth / Age</span>
                <span className="font-medium text-ink">{viewingPatient.dob ? `${viewingPatient.dob} (${ageFrom(viewingPatient.dob)} yrs)` : "—"}</span>
              </div>
              <div className="pt-2 border-t border-sage/20">
                <span className="text-ink/50 block">Blood Group</span>
                <span className="font-semibold text-danger">{viewingPatient.bloodGroup || viewingPatient.blood_group || "—"}</span>
              </div>
              {viewingPatient.address && (
                <div className="col-span-2 pt-2 border-t border-sage/20">
                  <span className="text-ink/50 block">Residential Address</span>
                  <span className="font-medium text-ink">{viewingPatient.address}</span>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-surface border border-sage/20 text-xs space-y-2">
              <div>
                <span className="font-semibold text-ink/70 block mb-1">Recorded Allergies</span>
                <p className="text-ink/80">
                  {Array.isArray(viewingPatient.allergies) && viewingPatient.allergies.length > 0
                    ? viewingPatient.allergies.join(", ")
                    : "No known drug/food allergies recorded."}
                </p>
              </div>
              <div>
                <span className="font-semibold text-ink/70 block mb-1">Chronic Conditions</span>
                <p className="text-ink/80">
                  {Array.isArray(viewingPatient.chronicConditions) && viewingPatient.chronicConditions.length > 0
                    ? viewingPatient.chronicConditions.join(", ")
                    : "No chronic health conditions on file."}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit Patient" : "Add Patient"} size="lg"
        footer={<><Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Full name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Phone" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Date of birth" type="date" value={form.dob || ""} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          <Select label="Gender" value={form.gender || ""} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="">Select</option>
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
          <Input label="Blood group" value={form.bloodGroup || ""} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} />
          <div className="sm:col-span-2">
            <Input label="Address" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
      </Modal>

      <ConfirmationModal open={!!toggle} onClose={() => setToggle(null)} onConfirm={confirmToggle}
        title={toggle?.next === "active" ? "Activate patient?" : "Deactivate patient?"}
        message={`Are you sure you want to ${toggle?.next === "active" ? "activate" : "deactivate"} this patient?`} />
    </div>
  );
}
