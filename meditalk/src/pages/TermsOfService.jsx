import { Link } from "react-router-dom";
import { Scale, AlertTriangle, ArrowLeft, Download, CheckCircle2, ShieldAlert, HeartPulse, FileText } from "lucide-react";
import Logo from "../components/ui/Logo";
import Button from "../components/ui/Button";
import EmergencyBanner from "../components/ui/EmergencyBanner";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-ink dark:text-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.08] dark:border-white/[0.12] pb-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <div className="h-4 w-px bg-black/[0.08] dark:bg-white/[0.12]" />
            <Logo />
          </div>
          <div className="flex items-center gap-2.5">
            <Link to="/privacy">
              <Button variant="outline" size="sm">Privacy Policy</Button>
            </Link>
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Download className="h-3.5 w-3.5" /> Print Terms
            </Button>
          </div>
        </div>

        {/* Emergency Alert */}
        <EmergencyBanner compact />

        {/* Title Card */}
        <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] rounded-2xl p-6 shadow-apple-card space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 dark:bg-accent/20 text-accent text-xs font-bold w-fit">
            <Scale className="h-4 w-4" /> Telehealth Clinical Terms of Service
          </div>
          <h1 className="text-3xl font-extrabold text-ink dark:text-white tracking-tight">Terms &amp; Conditions of Healthcare Service</h1>
          <p className="text-xs text-ink-secondary dark:text-neutral-300">
            Effective Date: October 8, 2026 · Governing virtual clinical visits, electronic prescribing, triage, and outpatient management.
          </p>
        </div>

        {/* Terms Content */}
        <div className="space-y-6 text-sm text-ink dark:text-neutral-200 leading-relaxed">
          {/* Section 1: Emergency Disclaimer */}
          <section className="rounded-2xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-[#251012] p-6 space-y-3 shadow-apple-card">
            <h2 className="text-base font-bold text-rose-950 dark:text-rose-100 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-danger shrink-0" />
              1. CRITICAL EMERGENCY MEDICAL DISCLAIMER
            </h2>
            <div className="text-xs text-rose-950 dark:text-rose-200 leading-relaxed space-y-2">
              <p className="font-bold">
                MEDITALK DOES NOT PROVIDE EMERGENCY MEDICAL INTERVENTIONS.
              </p>
              <p>
                If you believe you are experiencing a medical emergency, including but not limited to severe chest pain, shortness of breath, sudden numbness, slurred speech, active hemorrhage, or thoughts of self-harm, you must immediately call <strong>112 / 911 / 108</strong> or proceed to the nearest emergency room.
              </p>
              <p>
                Telehealth visits are strictly intended for non-emergent, elective, and outpatient follow-up consultations. Never delay emergency medical attention while waiting for a telehealth visit.
              </p>
            </div>
          </section>

          {/* Section 2: Telehealth Scope */}
          <section className="bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] rounded-2xl p-6 shadow-apple-card space-y-3">
            <h2 className="text-base font-bold text-ink dark:text-white flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-full bg-accent/15 text-accent text-xs font-black items-center justify-center">2</span>
              Telehealth Informed Consent &amp; Inherent Limitations
            </h2>
            <p className="text-xs">
              Telehealth involves the delivery of healthcare services using real-time audio, video, and data communication technologies. By participating in a video consultation:
            </p>
            <ul className="space-y-2 text-xs list-disc list-inside bg-[#F5F5F7] dark:bg-[#2C2C2E] p-4 rounded-xl border border-black/[0.08] dark:border-white/[0.12] text-ink dark:text-neutral-200">
              <li>You understand that virtual evaluations have inherent technical and clinical limitations compared to in-person physical examinations (such as palpation and auscultation).</li>
              <li>Your attending doctor reserves the sole discretion to determine whether your medical condition requires immediate referral for in-person evaluation, diagnostic labs, or emergency care.</li>
              <li>You agree to connect from a private, secure location and provide accurate, complete health information.</li>
              <li>Prior to every video consultation, you must complete the informed telehealth consent acknowledgment.</li>
            </ul>
          </section>

          {/* Section 3: AI & Decision Support */}
          <section className="bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] rounded-2xl p-6 shadow-apple-card space-y-3">
            <h2 className="text-base font-bold text-ink dark:text-white flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-full bg-accent/15 text-accent text-xs font-black items-center justify-center">3</span>
              Artificial Intelligence &amp; Clinical Decision Support Notice
            </h2>
            <p className="text-xs">
              MediTalk incorporates automated symptom triage and artificial intelligence documentation assistants:
            </p>
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-[#2A1D08] border border-amber-300 dark:border-amber-900/60 text-xs text-amber-950 dark:text-amber-100 space-y-1.5">
              <p className="font-bold">Physician Responsibility:</p>
              <p>All automated triage outputs, symptom assessments, and AI-drafted SOAP notes are advisory tools intended solely to support licensed doctors. Every AI-generated clinical record is generated as a draft and must be reviewed, modified, and finalized by a licensed healthcare provider before clinical reliance.</p>
            </div>
          </section>

          {/* Section 4: Prescriptions & Refills */}
          <section className="bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] rounded-2xl p-6 shadow-apple-card space-y-3">
            <h2 className="text-base font-bold text-ink dark:text-white flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-full bg-accent/15 text-accent text-xs font-black items-center justify-center">4</span>
              Electronic Prescriptions &amp; Safety Checks
            </h2>
            <p className="text-xs">
              Prescriptions may only be issued by licensed doctors following a bona fide doctor-patient relationship and clinical consultation. Prescriptions are subject to automated drug-drug interaction and patient allergy cross-referencing. Controlled substances and narcotics are not prescribed via telehealth on MediTalk.
            </p>
          </section>

          {/* Section 5: Cancellations & Rescheduling */}
          <section className="bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] rounded-2xl p-6 shadow-apple-card space-y-3">
            <h2 className="text-base font-bold text-ink dark:text-white flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-full bg-accent/15 text-accent text-xs font-black items-center justify-center">5</span>
              Scheduling, Check-Ins, and No-Show Policy
            </h2>
            <ul className="space-y-1.5 text-xs text-ink-secondary dark:text-neutral-300 list-disc list-inside">
              <li>Appointments must be checked into at least 5 minutes prior to the scheduled start time.</li>
              <li>Cancellations or rescheduling requests should be submitted at least 2 hours prior to the appointment.</li>
              <li>Patients failing to connect within 15 minutes of scheduled time may be marked as a No-Show.</li>
            </ul>
          </section>

          {/* Section 6: Right to Withdraw Consent & Termination */}
          <section className="bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] rounded-2xl p-6 shadow-apple-card space-y-3">
            <h2 className="text-base font-bold text-ink dark:text-white flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-full bg-accent/15 text-accent text-xs font-black items-center justify-center">6</span>
              Account Deletion &amp; Withdrawal of Consent
            </h2>
            <p className="text-xs">
              Patients maintain the right to withdraw medical consent and delete their account at any time via the Settings page. Upon withdrawal of consent, your account will be anonymized, active login tokens revoked, and upcoming appointments cancelled in accordance with healthcare record retention obligations.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-ink-secondary dark:text-neutral-400 py-4 border-t border-black/[0.08] dark:border-white/[0.12]">
          <p>© 2026 MediTalk Inc. · <Link to="/privacy" className="text-[#0055B3] dark:text-[#60A5FA] font-medium hover:underline">Privacy Policy</Link> · <Link to="/login" className="text-[#0055B3] dark:text-[#60A5FA] font-medium hover:underline">Sign In</Link></p>
        </div>
      </div>
    </div>
  );
}
