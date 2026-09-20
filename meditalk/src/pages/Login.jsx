import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, LogIn } from "lucide-react";
import Logo from "../components/ui/Logo";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ROLES } from "../constants";

const ROLE_OPTIONS = [
  { value: ROLES.PATIENT, label: "Patient" },
  { value: ROLES.DOCTOR, label: "Doctor" },
  { value: ROLES.ADMIN, label: "Administrator" },
];

const DEMO = {
  patient: "patient@meditalk.com",
  doctor: "doctor@meditalk.com",
  admin: "admin@meditalk.com",
};

export default function Login() {
  const { login, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: "", password: "", role: ROLES.PATIENT, remember: true });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);

  const redirectTo = location.state?.from || null;

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
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Branding panel */}
      <div className="hidden lg:flex flex-col justify-between bg-primary p-10 text-white relative overflow-hidden">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/20" />
        <div className="absolute -left-10 bottom-10 h-48 w-48 rounded-full bg-sage/30" />
        <Logo inverted />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold leading-snug">
            Your health, <br /> organized & secure.
          </h2>
          <p className="mt-3 text-white/70 max-w-sm">
            Sign in to access records, appointments and consultations from anywhere.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/50">© MediTalk.</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-6">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold text-ink">Sign in</h1>
          <p className="text-sm text-ink/50 mt-1">Welcome back. Please enter your details.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label-base">Login as</label>
              <div className="grid grid-cols-3 gap-2">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    type="button"
                    key={r.value}
                    onClick={() => update("role", r.value)}
                    className={
                      "rounded-xl border px-2 py-2.5 text-sm font-medium transition " +
                      (form.role === r.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-sage/40 text-ink/60 hover:bg-sage/20")
                    }
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              error={errors.email}
              onChange={(e) => update("email", e.target.value)}
            />
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="label-base">Password</label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40" />
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="input-base pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"
                  aria-label="Toggle password"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-danger">{errors.password}</p>}
            </div>

            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={form.remember}
                onChange={(e) => update("remember", e.target.checked)}
                className="h-4 w-4 rounded border-sage/50 text-primary focus:ring-primary"
              />
              Remember me
            </label>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              <LogIn className="h-4 w-4" /> Sign in
            </Button>
          </form>

          <div className="mt-4 rounded-xl bg-cream/70 border border-accent/30 p-3 text-xs text-ink/60">
            <p className="font-medium text-ink/80 mb-1">Demo accounts (password: password)</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(DEMO).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, email: v, role: k, password: "password" }))}
                  className="px-2 py-1 rounded-lg bg-white border border-sage/40 hover:bg-sage/20 text-xs font-medium capitalize"
                >
                  {k}: {v}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-5 text-sm text-ink/60 text-center">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
