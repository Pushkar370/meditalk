import { Link } from "react-router-dom";
import {
  ShieldCheck, Activity, CalendarCheck, Pill, FileText, Bell, ArrowRight, Stethoscope,
} from "lucide-react";
import Logo from "../components/ui/Logo";
import Button from "../components/ui/Button";

const FEATURES = [
  { icon: FileText, title: "Unified Health Records", text: "Consultations, labs, imaging and vitals in one secure chart." },
  { icon: CalendarCheck, title: "Smart Scheduling", text: "Book, reschedule and manage appointments in a few taps." },
  { icon: Pill, title: "Digital Prescriptions", text: "Receive and review prescriptions from your doctor instantly." },
  { icon: Bell, title: "Timely Reminders", text: "Never miss a follow-up with smart notifications." },
  { icon: Activity, title: "Doctor Dashboard", text: "Consultations, patient history and treatment plans at hand." },
  { icon: ShieldCheck, title: "Privacy First", text: "Role-based access keeps patient data protected." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost" size="sm">Log in</Button>
          </Link>
          <Link to="/register">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-16 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-sage/30 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure · Trusted · Patient-Centric
          </span>
          <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold text-ink leading-tight">
            Smarter care with <span className="text-primary">MediTalk</span>
          </h1>
          <p className="mt-4 text-ink/60 max-w-md">
            A unified platform for patient health records, appointments, consultations and
            prescriptions — built for clinics and hospitals that care about efficiency and trust.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/register"><Button size="lg">Create Account</Button></Link>
            <Link to="/login"><Button size="lg" variant="outline">Sign In</Button></Link>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-sage/40 to-accent/20 rounded-3xl -rotate-3" />
          <div className="relative bg-white rounded-3xl shadow-card-hover border border-sage/30 p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center">
                <Stethoscope className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="font-semibold text-ink">Today's Overview</p>
                <p className="text-xs text-ink/50">Patient · Aarav Sharma</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5">
              {[
                { label: "Upcoming", value: "1", tone: "text-accent" },
                { label: "Appointments", value: "6", tone: "text-primary" },
                { label: "Prescriptions", value: "2", tone: "text-success" },
                { label: "Records", value: "12", tone: "text-primary" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-sage/10 border border-sage/20 p-3">
                  <p className={"text-2xl font-bold " + s.tone}>{s.value}</p>
                  <p className="text-xs text-ink/50">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <h2 className="text-xl font-bold text-ink text-center">Everything your clinic needs</h2>
        <p className="text-center text-ink/50 mt-1">From the waiting room to the pharmacy, connected.</p>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card hover:shadow-card-hover transition">
                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-semibold text-ink">{f.title}</h3>
                <p className="mt-1 text-sm text-ink/60">{f.text}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-10 text-center">
          <Link to="/register">
            <Button size="lg">
              Start using MediTalk <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-sage/30 py-6 text-center text-xs text-ink/40">
        MediTalk — An Intelligent Patient Health Record & Appointment Management System.
      </footer>
    </div>
  );
}
