import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Lock, LogIn } from "lucide-react";
import Logo from "../components/ui/Logo";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ROLES } from "../constants";

const ROLE_OPTIONS = [
  { value: ROLES.PATIENT, label: "Patient" },
  { value: ROLES.DOCTOR, label: "Doctor" },
  { value: ROLES.ADMIN, label: "Admin" },
  { value: ROLES.NURSE, label: "Nurse" },
  { value: ROLES.RECEPTIONIST, label: "Reception" },
];

export default function Login() {
  const { login, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    email: "",
    password: "",
    role: ROLES.PATIENT,
    remember: true,
  });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);

  const params = new URLSearchParams(location.search);
  const redirectTo = location.state?.from || params.get("redirect") || null;

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    const e = {};
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email.";
    if (!form.password) e.password = "Password is required.";
    else if (form.password.length < 6) e.password = "Password must be at least 6 characters.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    const res = await login(form);
    if (res.success) {
      toast.success("Welcome back, " + res.user.name);
      navigate(redirectTo || res.redirectTo);
    } else {
      toast.error(res.message);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-ink dark:text-white flex flex-col justify-center items-center p-4 sm:p-6 transition-colors selection:bg-primary/20">
      <div className="w-full max-w-md animate-enter">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <Link to="/" className="mb-4 inline-block hover:opacity-90 transition">
            <Logo size="lg" />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink dark:text-white">
            Sign in to your portal
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary dark:text-neutral-400 mt-1 max-w-sm">
            Access clinical records, appointments, and consultations securely.
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl border border-black/[0.08] dark:border-white/[0.12] shadow-popover p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Apple Segmented Control for Role */}
            <div>
              <label className="label-base">Sign In Role</label>
              <div className="p-1 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/[0.04] dark:border-white/[0.06] flex overflow-x-auto no-scrollbar sm:grid sm:grid-cols-5 gap-1 text-center">
                {ROLE_OPTIONS.map((r) => {
                  const isSelected = form.role === r.value;
                  return (
                    <button
                      type="button"
                      key={r.value}
                      onClick={() => update("role", r.value)}
                      title={r.label}
                      className={
                        "py-2 px-2.5 sm:px-1 rounded-xl text-xs font-semibold transition-all duration-150 shrink-0 sm:shrink min-w-fit sm:min-w-0 sm:truncate " +
                        (isSelected
                          ? "bg-white dark:bg-[#1C1C1E] text-ink dark:text-white shadow-xs"
                          : "text-ink-secondary dark:text-neutral-400 hover:text-ink dark:hover:text-white")
                      }
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email Field */}
            <Input
              id="email"
              label="Email Address"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={form.email}
              error={errors.email}
              onChange={(e) => update("email", e.target.value)}
            />

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="label-base mb-0">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary dark:text-primary-light hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="input-base pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink dark:hover:text-white transition"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-danger font-medium">{errors.password}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-ink-secondary dark:text-neutral-400 font-medium">
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={(e) => update("remember", e.target.checked)}
                  className="h-4 w-4 rounded-md border-black/[0.15] dark:border-white/[0.2] text-primary focus:ring-primary/20"
                />
                Remember this device
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              loading={loading}
              className="w-full shadow-card py-3 text-sm font-semibold"
              size="lg"
            >
              <LogIn className="h-4 w-4" /> Sign In
            </Button>
          </form>

          {/* Registration Link */}
          <div className="mt-6 pt-5 border-t border-black/[0.06] dark:border-white/[0.08] text-center text-xs text-ink-secondary dark:text-neutral-400">
            <span>Don't have an account? </span>
            <Link
              to="/register"
              className="text-primary dark:text-primary-light font-semibold hover:underline ml-1"
            >
              Create Account
            </Link>
          </div>
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
