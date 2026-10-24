import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Activity,
  CalendarCheck,
  Pill,
  FileText,
  Bell,
  ArrowRight,
  Stethoscope,
  HeartPulse,
  Lock,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import Logo from "../components/ui/Logo";
import Button from "../components/ui/Button";
import EmergencyBanner from "../components/ui/EmergencyBanner";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  {
    icon: FileText,
    title: "Unified Health Records",
    text: "Consultation summaries, vitals history, and uploaded lab documents in a single accessible chart.",
  },
  {
    icon: CalendarCheck,
    title: "Atomic Smart Scheduling",
    text: "Database-validated appointment booking that eliminates double-booking and automates reminders.",
  },
  {
    icon: Pill,
    title: "Verified Digital Prescriptions",
    text: "Direct-to-browser PDF prescriptions with clinical letterhead and drug-allergy safety validation.",
  },
  {
    icon: Lock,
    title: "Cryptographic Audit Engine",
    text: "Tamper-resistant SHA-256 blockchain hash chaining meeting HIPAA and GDPR clinical compliance.",
  },
  {
    icon: Activity,
    title: "Dedicated Clinical Portals",
    text: "Role-scoped workspaces for patients, doctors, nurses, receptionists, and clinic administrators.",
  },
  {
    icon: ShieldCheck,
    title: "Zero-Trust Privacy",
    text: "Strict clinical relationship scoping ensuring physicians only access records of their assigned patients.",
  },
];

export default function Landing() {
  const { user, isAuthenticated } = useAuth();

  const dashboardPath =
    user?.role === "receptionist" || user?.role === "nurse"
      ? `/${user.role}/queue`
      : user?.role
      ? `/${user.role}/dashboard`
      : "/login";

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-ink dark:text-white transition-colors selection:bg-primary/20">
      {/* Frosted Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#F5F5F7]/80 dark:bg-[#000000]/80 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <Logo size="md" />

          <nav className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <Link to={dashboardPath}>
                <Button size="sm">
                  Dashboard <ArrowRight className="h-3.5 w-3.5 ml-0.5 inline" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 sm:px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 max-w-4xl mx-auto text-center animate-enter">
        <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/20 text-xs font-semibold tracking-wide uppercase mb-6">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Trust-First Virtual Clinic Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-ink dark:text-white leading-[1.08]">
          Healthcare, designed <br className="hidden sm:inline" />
          with clarity.
        </h1>

        <p className="mt-6 text-base sm:text-xl text-ink-secondary dark:text-neutral-400 font-normal leading-relaxed max-w-2xl mx-auto">
          A unified clinical ecosystem connecting patients, doctors, nurses, receptionists, and administrators into one seamless, cryptographic care journey.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3.5">
          {isAuthenticated && user ? (
            <Link to={dashboardPath}>
              <Button size="lg" className="px-8">
                Go to Your Portal <ArrowRight className="h-4 w-4 ml-1 inline" />
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/register">
                <Button size="lg" className="px-8 shadow-card">
                  Create Free Account
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="px-7">
                  Sign In
                </Button>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Interactive Clinical Preview Card (Apple Device / Surface Style) */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        <div className="rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1C1C1E] p-6 sm:p-10 shadow-popover">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center shrink-0">
                <Stethoscope className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink dark:text-white">Active Telehealth Session</p>
                <p className="text-xs text-ink-secondary dark:text-neutral-400">Dr. Sneha Menon · General Medicine</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Video Ready
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 bg-[#E8E8ED] dark:bg-[#2C2C2E] text-ink dark:text-white text-xs font-mono">
                SHA-256 Verified
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]/60 border border-black/[0.04] dark:border-white/[0.06]">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-secondary dark:text-neutral-400">Blood Pressure</p>
              <p className="text-2xl font-bold text-ink dark:text-white mt-1">120/80</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-3 w-3" /> Optimal Range
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]/60 border border-black/[0.04] dark:border-white/[0.06]">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-secondary dark:text-neutral-400">Oxygen (SpO2)</p>
              <p className="text-2xl font-bold text-ink dark:text-white mt-1">99%</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-3 w-3" /> Normal
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]/60 border border-black/[0.04] dark:border-white/[0.06]">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-secondary dark:text-neutral-400">Heart Rate</p>
              <p className="text-2xl font-bold text-ink dark:text-white mt-1">72 bpm</p>
              <p className="text-[11px] text-ink-secondary dark:text-neutral-400 mt-1">Resting Pulse</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]/60 border border-black/[0.04] dark:border-white/[0.06]">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-secondary dark:text-neutral-400">Audit Status</p>
              <p className="text-2xl font-bold text-primary dark:text-primary-light mt-1">Intact</p>
              <p className="text-[11px] text-ink-secondary dark:text-neutral-400 mt-1">Immutable Trigger</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Principles Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-28">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800 dark:text-emerald-400">
            Platform Capabilities
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-ink dark:text-white tracking-tight mt-2">
            Engineered for clinical precision.
          </h2>
          <p className="text-sm text-ink-secondary dark:text-neutral-400 mt-3 leading-relaxed">
            Every feature is built around the patient-doctor relationship, ensuring high data privacy and clinical safety.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="card group hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="h-12 w-12 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] text-primary dark:text-primary-light flex items-center justify-center transition-colors">
                  <Icon className="h-6 w-6 stroke-[1.8]" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink dark:text-white tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-2 text-xs text-ink-secondary dark:text-neutral-200 leading-relaxed">
                  {f.text}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-14 text-center">
          <Link to={isAuthenticated && user ? dashboardPath : "/register"}>
            <Button size="lg" className="px-8 shadow-card">
              {isAuthenticated && user ? "Go to Dashboard" : "Get Started with MediTalk"}
              <ArrowRight className="h-4 w-4 ml-1 inline" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Emergency Advisory Banner */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <EmergencyBanner compact />
      </div>

      {/* Minimalist Apple-Style Footer */}
      <footer className="border-t border-black/[0.06] dark:border-white/[0.08] py-10 bg-white/50 dark:bg-black/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-secondary dark:text-neutral-400">
          <div className="flex items-center gap-2">
            <Logo size="sm" withText={false} />
            <span>© 2026 MediTalk Systems. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-medium">
            <Link to="/privacy" className="hover:text-ink dark:hover:text-white transition">
              Privacy Notice
            </Link>
            <Link to="/terms" className="hover:text-ink dark:hover:text-white transition">
              Terms of Use
            </Link>
            <Link to="/login" className="hover:text-ink dark:hover:text-white transition">
              Sign In
            </Link>
            <Link to="/register" className="hover:text-ink dark:hover:text-white transition">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
