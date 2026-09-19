import { useState } from "react";
import { Stethoscope, Plus, Pencil, Eye, Power } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import SearchBar from "../../components/ui/SearchBar";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import ConfirmationModal from "../../components/ui/ConfirmationModal";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import { getDoctors, addDoctor, updateDoctor, setDoctorStatus } from "../../services/doctorService";
import { verifyDoctor } from "../../services/adminService";
import { SPECIALTIES } from "../../constants";

export default function AdminDoctors() {
  const toast = useToast();
  const { data: list, loading, reload } = useFetch(() => getDoctors());
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [toggle, setToggle] = useState(null);
  const [saving, setSaving] = useState(false);

  if (loading) return <LoadingState />;

  const rows = (list || []).filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.specialty.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setEditing({});
    setForm({ name: "", specialty: SPECIALTIES[0], email: "", phone: "", experience: 1, availability: "Available", status: "active" });
  }
  function openEdit(d) {
    setEditing(d);
    setForm(d);
  }

  async function save() {
    if (!form.name || !form.email) {
      toast.error("Name and email are required.");
      return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        await updateDoctor(editing.id, form);
        toast.success("Doctor updated successfully.");
      } else {
        await addDoctor(form);
        toast.success("Doctor added successfully.");
      }
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to save doctor.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmToggle() {
    try {
      await setDoctorStatus(toggle.id, toggle.next);
      toast.success(`Doctor ${toggle.next === "active" ? "activated" : "deactivated"}.`);
      setToggle(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to update status.");
    }
  }

  async function quickVerify(doc, action) {
    try {
      await verifyDoctor(doc.id, action);
      toast.success(`Doctor ${action === 'approve' ? 'approved' : 'rejected'}.`);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to update verification status.");
    }
  }

  const columns = [
    { key: "id", label: "Doctor ID" },
    { key: "name", label: "Name" },
    { key: "specialty", label: "Specialty" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "experience", label: "Experience (yrs)", render: (r) => r.experience },
    {
      key: "verification_status",
      label: "Verification",
      render: (r) => {
        const v = r.verification_status || "approved";
        if (v === "pending") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">Pending</span>;
        if (v === "rejected") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">Rejected</span>;
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Approved</span>;
      },
    },
    { key: "availability", label: "Availability", render: (r) => <StatusBadge status={r.availability.toLowerCase()} label={r.availability} /> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex flex-wrap gap-1.5 items-center">
          {r.verification_status === "pending" && (
            <>
              <Button size="sm" variant="success" onClick={() => quickVerify(r, "approve")} title="Approve Verification">
                ✓
              </Button>
              <Button size="sm" variant="danger" onClick={() => quickVerify(r, "reject")} title="Reject Application">
                ✕
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => toast.info(`${r.name} — ${r.bio || "No bio."}`)}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant={r.status === "active" ? "secondary" : "success"} onClick={() => setToggle({ id: r.id, next: r.status === "active" ? "inactive" : "active" })}>
            <Power className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Doctors" subtitle="Manage clinic doctors and availability."
        action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Doctor</Button>} />

      <SearchBar value={search} onChange={(v) => setSearch(v)} placeholder="Search by name or specialty..." className="max-w-md" />

      <div className="card">
        {rows.length === 0 ? <EmptyState icon={Stethoscope} title="No doctors found" /> : <DataTable columns={columns} data={rows} />}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit Doctor" : "Add Doctor"} size="lg"
        footer={<><Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Full name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Specialty" value={form.specialty || ""} onChange={(e) => setForm({ ...form, specialty: e.target.value })}>
            {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Input label="Email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Phone" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Experience (years)" type="number" value={form.experience || 0} onChange={(e) => setForm({ ...form, experience: Number(e.target.value) })} />
          <Select label="Availability" value={form.availability || "Available"} onChange={(e) => setForm({ ...form, availability: e.target.value })}>
            <option>Available</option>
            <option>Busy</option>
          </Select>
        </div>
      </Modal>

      <ConfirmationModal open={!!toggle} onClose={() => setToggle(null)} onConfirm={confirmToggle}
        title={toggle?.next === "active" ? "Activate doctor?" : "Deactivate doctor?"}
        message={`Are you sure you want to ${toggle?.next === "active" ? "activate" : "deactivate"} this doctor?`} />
    </div>
  );
}
