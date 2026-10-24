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
      toast.success(
        role === ROLES.DOCTOR
          ? "Doctor registration submitted for review!"
          : "Patient registration successful!"
      );
    } else {
      toast.error(res.message);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-ink dark:text-white flex items-center justify-center p-6 transition-colors">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl border border-black/[0.08] dark:border-white/[0.12] shadow-popover p-8 max-w-md w-full text-center animate-enter">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-success/15 text-success dark:text-success-light flex items-center justify-center mb-4">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink dark:text-white">
            {role === ROLES.DOCTOR ? "Credentials Under Review" : "Account Created Successfully"}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-ink-secondary dark:text-neutral-400 leading-relaxed">
            {role === ROLES.DOCTOR
              ? "Your doctor account has been created. Medical credentials are under administrative review. You will be able to sign in once an administrator approves your license."
              : "Your MediTalk Patient account is active. You can now sign in to access your digital records and book appointments."}
          </p>
          <Button
            className="mt-6 w-full shadow-card py-3"
            size="lg"
            onClick={() => navigate("/login")}
          >
            {role === ROLES.DOCTOR ? "Return to Sign In" : "Proceed to Sign In"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-ink dark:text-white flex flex-col justify-center items-center p-4 sm:p-8 transition-colors selection:bg-primary/20">
      <div className="w-full max-w-xl animate-enter py-8">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <Link to="/" className="mb-4 inline-block hover:opacity-90 transition">
            <Logo size="lg" />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink dark:text-white">
            Create your account
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary dark:text-neutral-400 mt-1">
            Join the verified MediTalk clinical network.
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl border border-black/[0.08] dark:border-white/[0.12] shadow-popover p-5 sm:p-8">
          {/* Role selector segmented control */}
          <div className="mb-6">
            <label className="label-base">Account Type</label>
            <div className="p-1 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/[0.04] dark:border-white/[0.06] grid grid-cols-2 gap-1 text-center">
              <button
                type="button"
                onClick={() => setRole(ROLES.PATIENT)}
                className={
                  "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-150 " +
                  (role === ROLES.PATIENT
                    ? "bg-white dark:bg-[#1C1C1E] text-ink dark:text-white shadow-xs"
                    : "text-ink-secondary dark:text-neutral-400 hover:text-ink dark:hover:text-white")
                }
              >
                <User className="h-4 w-4" /> Patient Account
              </button>
              <button
                type="button"
                onClick={() => setRole(ROLES.DOCTOR)}
                className={
                  "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-150 " +
                  (role === ROLES.DOCTOR
                    ? "bg-white dark:bg-[#1C1C1E] text-ink dark:text-white shadow-xs"
                    : "text-ink-secondary dark:text-neutral-400 hover:text-ink dark:hover:text-white")
                }
              >
                <Stethoscope className="h-4 w-4" /> Physician Account
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4.5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                placeholder={role === ROLES.DOCTOR ? "Dr. Sneha Menon" : "Aarav Sharma"}
                value={form.name}
                error={errors.name}
                onChange={(e) => update("name", e.target.value)}
              />
              <Input
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                value={form.email}
                error={errors.email}
                onChange={(e) => update("email", e.target.value)}
              />
              <Input
                label="Phone Number"
                placeholder="+91 98765 43210"
                value={form.phone}
                error={errors.phone}
                onChange={(e) => update("phone", e.target.value)}
              />

              {role === ROLES.PATIENT ? (
                <>
                  <Input
                    label="Date of Birth"
                    type="date"
                    value={form.dob}
                    error={errors.dob}
                    onChange={(e) => update("dob", e.target.value)}
                  />
                  <Select
                    label="Gender"
                    value={form.gender}
                    error={errors.gender}
                    onChange={(e) => update("gender", e.target.value)}
                  >
                    <option value="">Select gender</option>
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                </>
              ) : (
                <>
                  <Select
                    label="Medical Specialty"
                    value={form.specialty}
                    error={errors.specialty}
                    onChange={(e) => update("specialty", e.target.value)}
                  >
                    {SPECIALTIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Experience (Years)"
                    type="number"
                    min="0"
                    value={form.experience}
                    error={errors.experience}
                    onChange={(e) => update("experience", e.target.value)}
                  />
                </>
              )}

              {role === ROLES.DOCTOR && (
                <div className="sm:col-span-2">
                  <Input
                    label="Credentials & Qualifications"
                    placeholder="e.g. MBBS, MD - 12+ years experience in preventive medicine"
                    value={form.bio}
                    onChange={(e) => update("bio", e.target.value)}
                  />
                </div>
              )}

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                error={errors.password}
                onChange={(e) => update("password", e.target.value)}
              />
              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                value={form.confirm}
                error={errors.confirm}
                onChange={(e) => update("confirm", e.target.value)}
              />
            </div>

            {/* Privacy Notice & Consent Card */}
            <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-[#F5F5F7] dark:bg-[#2C2C2E]/60 p-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 font-semibold text-ink dark:text-white">
                <ShieldCheck className="h-4 w-4 text-primary dark:text-primary-light" />
                <span>Health Data Privacy & Consent Notice</span>
              </div>
              <p className="text-[11px] text-ink-secondary dark:text-neutral-400 leading-relaxed">
                MediTalk processes your medical details exclusively for clinical consultations, electronic prescribing, and appointment management under HIPAA and GDPR privacy frameworks. You can export your health data or withdraw consent anytime in Settings.
              </p>
              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => update("consent", e.target.checked)}
                  className="mt-0.5 rounded border-black/[0.15] dark:border-white/[0.2] text-primary focus:ring-primary h-4 w-4 shrink-0"
                />
                <span className="text-[11px] leading-snug text-ink dark:text-neutral-200">
                  I have read and accept the{" "}
                  <Link
                    to="/terms"
                    target="_blank"
                    className="font-semibold text-primary dark:text-emerald-400 underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    to="/privacy"
                    target="_blank"
                    className="font-semibold text-primary dark:text-emerald-400 underline"
                  >
                    Privacy Policy
                  </Link>
                  , and I give informed consent for the processing of my healthcare records.
                </span>
              </label>
              {errors.consent && (
                <p className="text-[11px] font-semibold text-danger pl-6 break-words">{errors.consent}</p>
              )}
            </div>

            <Button
              type="submit"
              loading={submitting}
              className="w-full shadow-card py-3 text-sm font-semibold mt-2"
              size="lg"
            >
              <UserPlus className="h-4 w-4" /> Create {role === ROLES.DOCTOR ? "Doctor" : "Patient"}{" "}
              Account
            </Button>
          </form>

          <p className="mt-6 text-xs text-ink-secondary dark:text-neutral-400 text-center">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary dark:text-emerald-400 font-semibold hover:underline ml-1"
            >
              Sign In
            </Link>
          </p>
        </div>

        {/* Footer Links */}
        <div className="mt-6 text-center text-xs text-ink-tertiary dark:text-neutral-400 space-x-3">
          <Link to="/terms" className="hover:text-ink dark:hover:text-white transition">
            Terms of Use
          </Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-ink dark:hover:text-white transition">
            Privacy Policy
          </Link>
          <span>·</span>
          <Link to="/" className="hover:text-ink dark:hover:text-white transition">
            MediTalk Home
          </Link>
        </div>
      </div>
    </div>
  );
}
