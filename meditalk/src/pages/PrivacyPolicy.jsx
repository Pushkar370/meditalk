import { Link } from "react-router-dom";
import { Shield, Lock, FileText, ArrowLeft, Download, CheckCircle2, UserCheck, AlertCircle, Database } from "lucide-react";
import Logo from "../components/ui/Logo";
import Button from "../components/ui/Button";
import EmergencyBanner from "../components/ui/EmergencyBanner";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-canvas dark:bg-dark-canvas text-ink dark:text-dark-ink py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle dark:border-dark-border-subtle pb-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <div className="h-4 w-px bg-border-subtle dark:border-dark-border-subtle" />
            <Logo />
          </div>
          <div className="flex items-center gap-2.5">
            <Link to="/terms">
              <Button variant="outline" size="sm">Terms of Service</Button>
            </Link>
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Download className="h-3.5 w-3.5" /> Print Policy
            </Button>
          </div>
        </div>

        {/* Emergency Alert */}
        <EmergencyBanner compact />

        {/* Title Card */}
        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 dark:bg-accent/20 text-accent text-xs font-bold w-fit">
            <Shield className="h-4 w-4" /> Official Health Data Privacy Notice
          </div>
          <h1 className="text-3xl font-extrabold text-ink dark:text-dark-ink tracking-tight">Privacy Policy &amp; Patient Data Rights</h1>
          <p className="text-xs text-ink/60 dark:text-dark-ink/60">
            Last Updated: October 8, 2026 · Compliant with HIPAA, GDPR (Regulation EU 2016/679), and Digital Personal Data Protection standards.
          </p>
        </div>

        {/* Policy Content */}
        <div className="space-y-6 text-sm text-ink/80 dark:text-dark-ink/80 leading-relaxed">
          {/* Section 1 */}
          <section className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-3">
            <h2 className="text-base font-bold text-ink dark:text-dark-ink flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-full bg-accent/15 text-accent text-xs font-black items-center justify-center">1</span>
              Commitment to Patient Health Privacy
            </h2>
            <p className="text-xs leading-relaxed">
              MediTalk Telehealth Platform ("MediTalk", "we", "us", or "our") takes the security and confidentiality of your Protected Health Information (PHI) and personal data with the utmost seriousness. This Privacy Policy details how we collect, store, safeguard, and disclose information when you access our clinical consultation, symptom triage, electronic prescriptions, and appointment scheduling services.
            </p>
          </section>

          {/* Section 2 */}
          <section className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-3">
            <h2 className="text-base font-bold text-ink dark:text-dark-ink flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-full bg-accent/15 text-accent text-xs font-black items-center justify-center">2</span>
              Protected Health Information (PHI) We Collect
            </h2>
            <p className="text-xs">To deliver safe, personalized clinical consultations and health management, we collect:</p>
            <ul className="grid sm:grid-cols-2 gap-2 text-xs list-disc list-inside bg-canvas dark:bg-dark-surface-elevated p-4 rounded-xl border border-border-subtle dark:border-dark-border-subtle text-ink/90 dark:text-dark-ink/90">
              <li><strong>Patient Identifiers:</strong> Legal name, date of birth, contact number, email, and address.</li>
              <li><strong>Biometrics &amp; Vitals:</strong> Blood pressure, heart rate, temperature, SpO2, and weight.</li>
              <li><strong>Clinical Chart Data:</strong> Documented allergies, chronic diagnoses, active medications, and family history.</li>
              <li><strong>Consultation Artifacts:</strong> Audio/video telemetry metadata, physician SOAP notes, and treatment plans.</li>
              <li><strong>Pharmacy Records:</strong> Issued prescriptions, dispensing status, and allergy cross-reference checks.</li>
              <li><strong>Emergency Details:</strong> Designated emergency contacts and insurance coverage.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-3">
            <h2 className="text-base font-bold text-ink dark:text-dark-ink flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-full bg-accent/15 text-accent text-xs font-black items-center justify-center">3</span>
              Role of Artificial Intelligence &amp; Clinical Decision Support
            </h2>
            <div className="p-4 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-xs text-amber-950 dark:text-amber-200 space-y-2">
              <p className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Physician Oversight Guarantee
              </p>
              <p>
                MediTalk employs automated clinical decision support (CDS) algorithms for symptom triage prioritization, drug interaction screening, and preliminary clinical SOAP drafting.
              </p>
              <ul className="list-disc list-inside space-y-1 text-amber-900/90 dark:text-amber-200/90">
                <li>Every AI-generated note is explicitly marked as a <strong>draft requiring physician review and verification</strong> before becoming part of the permanent chart.</li>
                <li>AI algorithms do not replace the licensed clinical judgment of attending physicians.</li>
                <li>Emergency conditions (e.g. chest pain, stroke signs) are hardcoded to never be downgraded by automated scoring.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-3">
            <h2 className="text-base font-bold text-ink dark:text-dark-ink flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-full bg-accent/15 text-accent text-xs font-black items-center justify-center">4</span>
              Your Rights: Data Portability, Deletion &amp; Consent Withdrawal
            </h2>
            <p className="text-xs">
              Under global data protection standards (GDPR Article 17 &amp; 20, HIPAA Individual Right of Access), you maintain complete sovereign control over your healthcare information:
            </p>
            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 rounded-xl border border-border-subtle dark:border-dark-border-subtle bg-canvas dark:bg-dark-surface-elevated space-y-1">
                <div className="font-bold text-accent flex items-center gap-1.5 text-xs">
                  <Download className="h-4 w-4" /> Data Portability (Export)
                </div>
                <p className="text-[11px] text-ink/70 dark:text-dark-ink/70 leading-relaxed">
                  You may export your complete medical records, prescriptions, and consultation history anytime in structured JSON format via Settings.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border-subtle dark:border-dark-border-subtle bg-canvas dark:bg-dark-surface-elevated space-y-1">
                <div className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 text-xs">
                  <UserCheck className="h-4 w-4" /> Withdraw Consent
                </div>
                <p className="text-[11px] text-ink/70 dark:text-dark-ink/70 leading-relaxed">
                  You can withdraw medical consent at any time. Withdrawing consent revokes processing authorizations and deactivates your patient portal.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border-subtle dark:border-dark-border-subtle bg-canvas dark:bg-dark-surface-elevated space-y-1">
                <div className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 text-xs">
                  <Lock className="h-4 w-4" /> Right to Erasure
                </div>
                <p className="text-[11px] text-ink/70 dark:text-dark-ink/70 leading-relaxed">
                  You can request complete account deletion. Your personal identifiers will be anonymized, credentials revoked, and future appointments cancelled.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-3">
            <h2 className="text-base font-bold text-ink dark:text-dark-ink flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-full bg-accent/15 text-accent text-xs font-black items-center justify-center">5</span>
              Technical &amp; Administrative Security Safeguards
            </h2>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Encryption in Transit:</strong> All HTTP and WebSocket traffic is protected via strict TLS 1.3 with full SSL certificate chain validation.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Session Invalidation:</strong> Logged-out and revoked sessions are persisted in a database-level revocation ledger across server restarts.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Role-Scoped Access Control (RBAC):</strong> Strict barriers separate Doctors, Patients, Nurses, and Receptionists so staff only access records appropriate to their clinical scope.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Audit Logging:</strong> Every clinical chart access, prescription check, and authentication event is immutably logged with timestamp and user attribution.</span>
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-3">
            <h2 className="text-base font-bold text-ink dark:text-dark-ink flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-full bg-accent/15 text-accent text-xs font-black items-center justify-center">6</span>
              Contact Data Protection Officer (DPO)
            </h2>
            <p className="text-xs">
              If you have inquiries concerning this policy, wish to exercise your data protection rights, or submit a regulatory inquiry:
            </p>
            <div className="p-4 rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle text-xs space-y-1">
              <p><strong>MediTalk Data Protection &amp; Privacy Office</strong></p>
              <p>Email: <a href="mailto:privacy@meditalk.com" className="text-accent hover:underline">privacy@meditalk.com</a></p>
              <p>Address: MediTalk Health Systems Compliance, 100 Medical Center Way</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-ink/50 dark:text-dark-ink/50 py-4 border-t border-border-subtle dark:border-dark-border-subtle">
          <p>© 2026 MediTalk Inc. All rights reserved. · <Link to="/terms" className="text-accent hover:underline">Terms of Service</Link> · <Link to="/login" className="text-accent hover:underline">Sign In</Link></p>
        </div>
      </div>
    </div>
  );
}
