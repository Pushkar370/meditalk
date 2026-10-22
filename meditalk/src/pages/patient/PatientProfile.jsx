import { useState, useEffect } from "react";
import {
  Pencil,
  Save,
  X,
  HeartPulse,
  Phone,
  ShieldCheck,
  User,
  Activity,
  FileCheck2,
} from "lucide-react";
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

  const { data: base, loading, reload } = useFetch(
    () => getPatientById(patientId),
    [patientId]
  );
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

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
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="My Profile"
        subtitle="Manage your personal identity, biometric attributes, and clinical emergency contacts."
        action={
          editing ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => {
                  setForm(base);
                  setEditing(false);
                }}
                className="text-xs"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                loading={saving}
                className="text-xs"
              >
                <Save className="h-3.5 w-3.5 mr-1" /> Save Changes
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => setEditing(true)}
              className="text-xs"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Profile
            </Button>
          )
        }
      />

      {/* User Avatar Card */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <Avatar name={form.name} size="lg" />
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-ink dark:text-dark-ink">
                {form.name}
              </h2>
              <div className="flex items-center gap-2 flex-wrap text-xs text-ink/50 dark:text-dark-ink/50">
                <span className="font-mono">#{form.id}</span>
                <span>·</span>
                <span>{form.gender || "Gender unspecified"}</span>
                <span>·</span>
                <span className="font-semibold text-primary dark:text-primary-light">
                  {form.bloodGroup || "Blood group unrecorded"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Verified Patient
            </span>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card
          title={
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Personal Information
            </span>
          }
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="Full name"
              value={form.name}
              editing={editing}
              onChange={(v) => update("name", v)}
            />
            <Field
              label="Date of birth"
              type="date"
              value={form.dob}
              editing={editing}
              onChange={(v) => update("dob", v)}
            />
            <SelectField
              label="Gender"
              value={form.gender}
              editing={editing}
              onChange={(v) => update("gender", v)}
              options={GENDERS}
            />
            <Field
              label="Email address"
              type="email"
              value={form.email}
              editing={editing}
              onChange={(v) => update("email", v)}
            />
            <Field
              label="Phone number"
              value={form.phone}
              editing={editing}
              onChange={(v) => update("phone", v)}
            />
            <Field
              label="Home address"
              value={form.address}
              editing={editing}
              onChange={(v) => update("address", v)}
            />
          </div>
        </Card>

        {/* Health Information */}
        <Card
          title={
            <span className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-primary" /> Health & Biometrics
            </span>
          }
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="Blood group"
              value={form.bloodGroup}
              editing={editing}
              onChange={(v) => update("bloodGroup", v)}
            />
            <Field
              label="Height"
              value={form.height}
              editing={editing}
              onChange={(v) => update("height", v)}
              placeholder="e.g. 175 cm"
            />
            <Field
              label="Weight"
              value={form.weight}
              editing={editing}
              onChange={(v) => update("weight", v)}
              placeholder="e.g. 70 kg"
            />
            <Field
              label="Allergies (comma-separated)"
              value={(form.allergies || []).join(", ")}
              editing={editing}
              onChange={(v) =>
                update(
                  "allergies",
                  v.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
            />
            <Field
              label="Chronic conditions"
              value={(form.chronicConditions || []).join(", ")}
              editing={editing}
              onChange={(v) =>
                update(
                  "chronicConditions",
                  v.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
            />
            <Field
              label="Current medications"
              value={(form.currentMedications || []).join(", ")}
              editing={editing}
              onChange={(v) =>
                update(
                  "currentMedications",
                  v.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
            />
          </div>
        </Card>

        {/* Emergency Contact */}
        <Card
          title={
            <span className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" /> Emergency Contact
            </span>
          }
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="Contact name"
              value={form.emergencyContact?.name}
              editing={editing}
              onChange={(v) => updateNested("emergencyContact", "name", v)}
            />
            <Field
              label="Relationship"
              value={form.emergencyContact?.relationship}
              editing={editing}
              onChange={(v) => updateNested("emergencyContact", "relationship", v)}
            />
            <Field
              label="Emergency phone"
              value={form.emergencyContact?.phone}
              editing={editing}
              onChange={(v) => updateNested("emergencyContact", "phone", v)}
            />
          </div>
        </Card>

        {/* Insurance */}
        <Card
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Health Insurance
            </span>
          }
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="Insurance provider"
              value={form.insurance?.provider}
              editing={editing}
              onChange={(v) => updateNested("insurance", "provider", v)}
            />
            <Field
              label="Policy number"
              value={form.insurance?.policyNumber}
              editing={editing}
              onChange={(v) => updateNested("insurance", "policyNumber", v)}
            />
            <Field
              label="Validity date"
              type="date"
              value={form.insurance?.validity}
              editing={editing}
              onChange={(v) => updateNested("insurance", "validity", v)}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, editing, onChange, type = "text", placeholder }) {
  return editing ? (
    <Input
      label={label}
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ) : (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-ink/50 dark:text-dark-ink/50 uppercase tracking-wider block">
        {label}
      </label>
      <p className="text-sm font-medium text-ink dark:text-dark-ink py-1">
        {value || "—"}
      </p>
    </div>
  );
}

function SelectField({ label, value, editing, onChange, options }) {
  return editing ? (
    <Select
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </Select>
  ) : (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-ink/50 dark:text-dark-ink/50 uppercase tracking-wider block">
        {label}
      </label>
      <p className="text-sm font-medium text-ink dark:text-dark-ink py-1">
        {value || "—"}
      </p>
    </div>
  );
}
