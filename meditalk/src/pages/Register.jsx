import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, CheckCircle2, Stethoscope, User, ShieldCheck } from "lucide-react";
import Logo from "../components/ui/Logo";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";
import { useToast } from "../context/ToastContext";
import { register as registerService } from "../services/authService";
import { GENDERS, SPECIALTIES, ROLES } from "../constants";

export default function Register() {
  const toast = useToast();
  const navigate = useNavigate();

  const [role, setRole] = useState(ROLES.PATIENT);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    gender: "",
    specialty: SPECIALTIES[0] || "General Medicine",
    experience: "5",
    bio: "",
    password: "",
    confirm: "",
    consent: false,
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required.";
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email.";
    if (!form.phone.trim()) e.phone = "Phone number is required.";

    if (role === ROLES.PATIENT) {
      if (!form.dob) e.dob = "Date of birth is required.";
      if (!form.gender) e.gender = "Please select gender.";
    } else {
      if (!form.specialty) e.specialty = "Please select medical specialty.";
      if (!form.experience || isNaN(form.experience)) e.experience = "Valid experience years required.";
    }

    if (!form.password) e.password = "Password is required.";
    else if (form.password.length < 6) e.password = "Password must be at least 6 characters.";
    if (form.confirm !== form.password) e.confirm = "Passwords do not match.";

    if (!form.consent) {
      e.consent = "You must review and accept the Privacy Notice and Terms of Service to create an account.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const res = await registerService({ ...form, role, consentAccepted: form.consent });
    setSubmitting(false);
    if (res.success) {
      setDone(true);
      toast.success(role === ROLES.DOCTOR ? "Doctor registration submitted for review!" : "Patient registration successful!");
    } else {
      toast.error(res.message);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card max-w-md text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-success/15 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-ink">
            {role === ROLES.DOCTOR ? "Registration Submitted" : "Account created"}
          </h1>
          <p className="mt-2 text-sm text-ink/60">
            {role === ROLES.DOCTOR
              ? "Your doctor account has been created and your medical credentials are under administrative review. You will be able to sign in once an administrator approves your license."
              : "Your MediTalk Patient account is ready. You can now sign in."}
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate("/login")}>
            {role === ROLES.DOCTOR ? "Back to Login" : "Go to Login"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <div className="card">
          <h1 className="text-2xl font-bold text-ink">Create your account</h1>
          <p className="text-sm text-ink/50 mt-1">Join MediTalk medical network.</p>

          {/* Role selector */}
          <div className="mt-4">
            <label className="label-base">Register as</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole(ROLES.PATIENT)}
                className={
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition " +
                  (role === ROLES.PATIENT
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-sage/40 text-ink/60 hover:bg-sage/20")
                }
              >
                <User className="h-4 w-4" /> Patient
              </button>
              <button
                type="button"
                onClick={() => setRole(ROLES.DOCTOR)}
                className={
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition " +
                  (role === ROLES.DOCTOR
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-sage/40 text-ink/60 hover:bg-sage/20")
                }
              >
                <Stethoscope className="h-4 w-4" /> Doctor
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Full name" placeholder={role === ROLES.DOCTOR ? "Dr. John Doe" : "Jane Doe"} value={form.name} error={errors.name} onChange={(e) => update("name", e.target.value)} />
              <Input label="Email" type="email" placeholder="john@example.com" value={form.email} error={errors.email} onChange={(e) => update("email", e.target.value)} />
              <Input label="Phone" placeholder="+1 (555) 000-0000" value={form.phone} error={errors.phone} onChange={(e) => update("phone", e.target.value)} />

              {role === ROLES.PATIENT ? (
                <>
                  <Input label="Date of birth" type="date" value={form.dob} error={errors.dob} onChange={(e) => update("dob", e.target.value)} />
                  <Select label="Gender" value={form.gender} error={errors.gender} onChange={(e) => update("gender", e.target.value)}>
                    <option value="">Select gender</option>
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </Select>
                </>
              ) : (
                <>
                  <Select label="Specialty" value={form.specialty} error={errors.specialty} onChange={(e) => update("specialty", e.target.value)}>
                    {SPECIALTIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                  <Input label="Experience (years)" type="number" min="0" value={form.experience} error={errors.experience} onChange={(e) => update("experience", e.target.value)} />
                </>
              )}

              {role === ROLES.DOCTOR && (
                <div className="sm:col-span-2">
                  <Input label="Bio / Qualifications" placeholder="e.g. MD, FACC - 10+ years cardiology specialist" value={form.bio} onChange={(e) => update("bio", e.target.value)} />
                </div>
              )}

              <Input label="Password" type="password" placeholder="••••••••" value={form.password} error={errors.password} onChange={(e) => update("password", e.target.value)} />
              <Input label="Confirm password" type="password" placeholder="••••••••" value={form.confirm} error={errors.confirm} onChange={(e) => update("confirm", e.target.value)} />
            </div>

            {/* Privacy Notice & Consent Checkbox */}
            <div className="rounded-xl border border-sage/30 bg-sage/10 p-3.5 space-y-2.5 text-xs text-ink/80">
              <div className="flex items-center gap-2 font-bold text-ink">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Health Data Privacy & Consent Notice</span>
              </div>
              <p className="text-[11px] text-ink/70 leading-relaxed">
                MediTalk processes your medical details exclusively for clinical consultations, electronic prescribing, and appointment management under HIPAA and GDPR privacy frameworks. You can export your health data or withdraw consent anytime in Settings.
              </p>
              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => update("consent", e.target.checked)}
                  className="mt-0.5 rounded border-sage/40 text-primary focus:ring-primary h-4 w-4 shrink-0"
                />
                <span className="text-[11px] leading-snug">
                  I have read and accept the{" "}
                  <Link to="/terms" target="_blank" className="font-semibold text-primary underline hover:text-primary-dark">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" target="_blank" className="font-semibold text-primary underline hover:text-primary-dark">
                    Privacy Policy
                  </Link>
                  , and I give informed consent for the processing of my healthcare records.
                </span>
              </label>
              {errors.consent && (
                <p className="text-[11px] font-semibold text-rose-600 pl-6">{errors.consent}</p>
              )}
            </div>

            <Button type="submit" loading={submitting} className="w-full" size="lg">
              <UserPlus className="h-4 w-4" /> Create {role === ROLES.DOCTOR ? "Doctor" : "Patient"} Account
            </Button>
          </form>

          <p className="mt-4 text-sm text-ink/60 text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
