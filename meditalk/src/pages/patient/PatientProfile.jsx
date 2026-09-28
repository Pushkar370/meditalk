import { useState, useEffect } from "react";
import { Pencil, Save, X, HeartPulse, Phone, ShieldCheck } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Avatar from "../../components/ui/Avatar";
import LoadingState from "../../components/ui/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getPatientById, updatePatient } from "../../services/patientService";
import { useFetch } from "../../hooks/useFetch";
import { GENDERS } from "../../constants";

export default function PatientProfile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const patientId = user?.id;

  const { data: base, loading, reload } = useFetch(() => getPatientById(patientId), [patientId]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Sync form with fetched patient data
  useEffect(() => {
    if (base) setForm(base);
  }, [base]);

  if (loading || !form) return <LoadingState />;

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function updateNested(section, key, value) {
    setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updatePatient(patientId, form);
      if (updateUser) {
        updateUser({ name: form.name, email: form.email, phone: form.phone });
      }
      toast.success("Profile updated successfully.");
      setEditing(false);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Manage your personal and health information."
        action={
          editing ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={saving} onClick={() => { setForm(base); setEditing(false); }}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} loading={saving}>
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit Profile
            </Button>
          )
        }
      />

      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={form.name} size="lg" />
          <div>
            <p className="text-lg font-semibold text-ink">{form.name}</p>
            <p className="text-sm text-ink/50">{form.id} · {form.gender} · {form.bloodGroup}</p>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Personal Information">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name" value={form.name} editing={editing} onChange={(v) => update("name", v)} />
            <Field label="Date of birth" type="date" value={form.dob} editing={editing} onChange={(v) => update("dob", v)} />
            <SelectField label="Gender" value={form.gender} editing={editing} onChange={(v) => update("gender", v)} options={GENDERS} />
            <Field label="Email" type="email" value={form.email} editing={editing} onChange={(v) => update("email", v)} />
            <Field label="Phone" value={form.phone} editing={editing} onChange={(v) => update("phone", v)} />
            <Field label="Address" value={form.address} editing={editing} onChange={(v) => update("address", v)} />
          </div>
        </Card>

        <Card title={
          <span className="flex items-center gap-2"><HeartPulse className="h-4 w-4 text-primary" /> Health Information</span>
        }>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Blood group" value={form.bloodGroup} editing={editing} onChange={(v) => update("bloodGroup", v)} />
            <Field label="Height" value={form.height} editing={editing} onChange={(v) => update("height", v)} />
            <Field label="Weight" value={form.weight} editing={editing} onChange={(v) => update("weight", v)} />
            <Field label="Allergies" value={(form.allergies || []).join(", ")} editing={editing} onChange={(v) => update("allergies", v.split(",").map((s) => s.trim()).filter(Boolean))} />
            <Field label="Chronic conditions" value={(form.chronicConditions || []).join(", ")} editing={editing} onChange={(v) => update("chronicConditions", v.split(",").map((s) => s.trim()).filter(Boolean))} />
            <Field label="Current medications" value={(form.currentMedications || []).join(", ")} editing={editing} onChange={(v) => update("currentMedications", v.split(",").map((s) => s.trim()).filter(Boolean))} />
          </div>
        </Card>

        <Card title={
          <span className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> Emergency Contact</span>
        }>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name" value={form.emergencyContact?.name} editing={editing} onChange={(v) => updateNested("emergencyContact", "name", v)} />
            <Field label="Relationship" value={form.emergencyContact?.relationship} editing={editing} onChange={(v) => updateNested("emergencyContact", "relationship", v)} />
            <Field label="Phone" value={form.emergencyContact?.phone} editing={editing} onChange={(v) => updateNested("emergencyContact", "phone", v)} />
          </div>
        </Card>

        <Card title={
          <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Insurance</span>
        }>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Provider" value={form.insurance?.provider} editing={editing} onChange={(v) => updateNested("insurance", "provider", v)} />
            <Field label="Policy number" value={form.insurance?.policyNumber} editing={editing} onChange={(v) => updateNested("insurance", "policyNumber", v)} />
            <Field label="Validity" type="date" value={form.insurance?.validity} editing={editing} onChange={(v) => updateNested("insurance", "validity", v)} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, editing, onChange, type = "text" }) {
  return editing ? (
    <Input label={label} type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <div>
      <label className="label-base">{label}</label>
      <p className="text-sm text-ink py-2">{value || "-"}</p>
    </div>
  );
}

function SelectField({ label, value, editing, onChange, options }) {
  return editing ? (
    <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </Select>
  ) : (
    <div>
      <label className="label-base">{label}</label>
      <p className="text-sm text-ink py-2">{value || "-"}</p>
    </div>
  );
}
