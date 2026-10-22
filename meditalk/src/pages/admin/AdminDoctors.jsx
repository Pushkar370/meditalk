import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Stethoscope, Plus, Pencil, Eye, Power, Check, X, ShieldAlert, Award, Phone, Mail } from "lucide-react";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "all";
  const { data: list, loading, reload } = useFetch(() => getDoctors());
  const [filterTab, setFilterTab] = useState(tabFromUrl);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [inspectingDoctor, setInspectingDoctor] = useState(null);
  const [form, setForm] = useState({});
  const [toggle, setToggle] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t) setFilterTab(t);
  }, [searchParams]);

  function handleTabChange(tab) {
    setFilterTab(tab);
    if (tab === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  }

  if (loading) return <LoadingState />;

  const rawList = list || [];
  const pendingCount = rawList.filter((d) => d.verification_status === "pending").length;
  const activeCount = rawList.filter((d) => d.status === "active").length;
  const inactiveCount = rawList.filter((d) => d.status === "inactive").length;

  const rows = rawList.filter((d) => {
    const matchesSearch =
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.specialty?.toLowerCase().includes(search.toLowerCase()) ||
      d.id?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTab === "pending") return d.verification_status === "pending";
    if (filterTab === "active") return d.status === "active";
    if (filterTab === "inactive") return d.status === "inactive";
    return true;
  });

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
        if (v === "pending") return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">Pending</span>;
        if (v === "rejected") return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">Rejected</span>;
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">Approved</span>;
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
              <button
                onClick={() => quickVerify(r, "approve")}
                title="Approve Credentials"
                className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition-all text-xs font-bold"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => quickVerify(r, "reject")}
                title="Reject Application"
                className="p-1.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 transition-all text-xs font-bold"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => setInspectingDoctor(r)}
            title="View Doctor Profile"
            className="p-1.5 rounded-lg bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle text-ink/70 dark:text-dark-ink/70 hover:text-accent hover:border-accent/40 transition-all"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => openEdit(r)}
            title="Edit Doctor Details"
            className="p-1.5 rounded-lg hover:bg-canvas-subtle dark:hover:bg-dark-surface-elevated text-ink/60 dark:text-dark-ink/60 hover:text-ink dark:hover:text-dark-ink transition-all"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setToggle({ id: r.id, next: r.status === "active" ? "inactive" : "active" })}
            title={r.status === "active" ? "Deactivate Doctor" : "Activate Doctor"}
            className={`p-1.5 rounded-lg transition-all ${
              r.status === "active"
                ? "text-ink/40 dark:text-dark-ink/40 hover:text-danger hover:bg-danger/10"
                : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
            }`}
          >
            <Power className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Practitioners & Clinical Faculty"
        subtitle="Manage licensed doctors, verify credential submissions, and toggle clinical availability status."
        action={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Doctor
          </Button>
        }
      />

      {/* Status Filter Segmented Control */}
      <div className="inline-flex p-1 rounded-2xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle shadow-inner-subtle overflow-x-auto max-w-full">
        <button
          onClick={() => handleTabChange("all")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
            filterTab === "all"
              ? "bg-surface dark:bg-dark-surface text-ink dark:text-dark-ink shadow-apple-card"
              : "text-ink/60 dark:text-dark-ink/60 hover:text-ink dark:hover:text-dark-ink"
          }`}
        >
          All Doctors ({rawList.length})
        </button>

        <button
          onClick={() => handleTabChange("pending")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 ${
            filterTab === "pending"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-ink/60 dark:text-dark-ink/60 hover:text-ink dark:hover:text-dark-ink"
          }`}
        >
          Pending Verification
          {pendingCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                filterTab === "pending"
                  ? "bg-white text-amber-700"
                  : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
              }`}
            >
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange("active")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
            filterTab === "active"
              ? "bg-surface dark:bg-dark-surface text-ink dark:text-dark-ink shadow-apple-card"
              : "text-ink/60 dark:text-dark-ink/60 hover:text-ink dark:hover:text-dark-ink"
          }`}
        >
          Active ({activeCount})
        </button>

        <button
          onClick={() => handleTabChange("inactive")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
            filterTab === "inactive"
              ? "bg-surface dark:bg-dark-surface text-ink dark:text-dark-ink shadow-apple-card"
              : "text-ink/60 dark:text-dark-ink/60 hover:text-ink dark:hover:text-dark-ink"
          }`}
        >
          Inactive ({inactiveCount})
        </button>
      </div>

      {pendingCount > 0 && filterTab !== "pending" && (
        <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span><strong>{pendingCount} doctor application{pendingCount > 1 ? 's' : ''}</strong> awaiting credential verification review.</span>
          </div>
          <button
            onClick={() => setFilterTab("pending")}
            className="font-semibold text-amber-800 dark:text-amber-300 underline hover:no-underline"
          >
            Review Applications →
          </button>
        </div>
      )}

      <SearchBar
        value={search}
        onChange={(v) => setSearch(v)}
        placeholder="Search by practitioner name, medical specialty, or doctor ID..."
        className="max-w-md"
      />

      <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card">
        {rows.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No practitioners found"
            message="No doctor profiles match the current filter criteria."
          />
        ) : (
          <DataTable columns={columns} data={rows} />
        )}
      </div>

      {/* Edit/Add Doctor Modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit Doctor Profile" : "Add Doctor Profile"}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </>
        }
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Full Name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Medical Specialty" value={form.specialty || ""} onChange={(e) => setForm({ ...form, specialty: e.target.value })}>
            {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Input label="Email Address" type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Phone Number" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Experience (Years)" type="number" value={form.experience || 0} onChange={(e) => setForm({ ...form, experience: Number(e.target.value) })} />
          <Select label="Clinical Availability" value={form.availability || "Available"} onChange={(e) => setForm({ ...form, availability: e.target.value })}>
            <option>Available</option>
            <option>Busy</option>
          </Select>
        </div>
      </Modal>

      {/* ── Doctor Profile Inspection Modal ─── */}
      <Modal
        open={!!inspectingDoctor}
        onClose={() => setInspectingDoctor(null)}
        title="Doctor Profile & Credentials"
        size="md"
        footer={<Button size="sm" onClick={() => setInspectingDoctor(null)}>Close</Button>}
      >
        {inspectingDoctor && (
          <div className="space-y-4">
            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle">
              <div className="h-12 w-12 rounded-xl bg-accent/10 dark:bg-accent/20 border border-accent/20 flex items-center justify-center font-bold text-accent text-lg shadow-sm">
                {inspectingDoctor.name?.charAt(0) || "D"}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-ink dark:text-dark-ink text-base tracking-tight">{inspectingDoctor.name}</h4>
                <p className="text-xs text-ink/60 dark:text-dark-ink/60">{inspectingDoctor.specialty} · {inspectingDoctor.experience || 0} years experience</p>
                <p className="text-[11px] font-mono text-ink/50 dark:text-dark-ink/50 mt-0.5">ID: {inspectingDoctor.id}</p>
              </div>
              <StatusBadge status={inspectingDoctor.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle text-xs">
              <div>
                <span className="text-ink/50 dark:text-dark-ink/50 block mb-0.5">Email Address</span>
                <span className="font-medium text-ink dark:text-dark-ink break-all">{inspectingDoctor.email || "—"}</span>
              </div>
              <div>
                <span className="text-ink/50 dark:text-dark-ink/50 block mb-0.5">Phone Number</span>
                <span className="font-medium text-ink dark:text-dark-ink">{inspectingDoctor.phone || "—"}</span>
              </div>
              <div className="pt-2 border-t border-border-subtle dark:border-dark-border-subtle">
                <span className="text-ink/50 dark:text-dark-ink/50 block mb-0.5">Verification Status</span>
                <span className="font-semibold capitalize text-ink dark:text-dark-ink">{inspectingDoctor.verification_status || "approved"}</span>
              </div>
              <div className="pt-2 border-t border-border-subtle dark:border-dark-border-subtle">
                <span className="text-ink/50 dark:text-dark-ink/50 block mb-0.5">Live Availability</span>
                <span className="font-semibold text-ink dark:text-dark-ink">{inspectingDoctor.availability || "Available"}</span>
              </div>
            </div>

            {inspectingDoctor.bio && (
              <div className="p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle text-xs">
                <span className="font-semibold text-ink/70 dark:text-dark-ink/70 block mb-1">Professional Bio & Credentials</span>
                <p className="text-ink/80 dark:text-dark-ink/80 leading-relaxed">{inspectingDoctor.bio}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmationModal
        open={!!toggle}
        onClose={() => setToggle(null)}
        onConfirm={confirmToggle}
        title={toggle?.next === "active" ? "Activate doctor?" : "Deactivate doctor?"}
        message={`Are you sure you want to ${toggle?.next === "active" ? "activate" : "deactivate"} this doctor?`}
      />
    </div>
  );
}
