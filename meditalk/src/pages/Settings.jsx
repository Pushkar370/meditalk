import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield, Bell, CalendarClock, User, Lock, KeyRound, Check, Smartphone, Laptop,
  ShieldCheck, Download, Trash2, AlertTriangle, FileJson, UserX
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import ConfirmationModal from "../components/ui/ConfirmationModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  changePassword,
  getUserProfile,
  updateUserProfile,
  updateUserPreferences,
} from "../services/authService";
import { exportPatientData, withdrawConsent } from "../services/patientService";

const SECTIONS = [
  { key: "account", label: "Account", icon: User },
  { key: "password", label: "Password", icon: Lock },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "appointments", label: "Care Preferences", icon: CalendarClock },
  { key: "security", label: "Privacy & Security", icon: Shield },
];

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [section, setSection] = useState("account");

  // Export & Consent state
  const [exporting, setExporting] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  async function handleExportData() {
    setExporting(true);
    try {
      const data = await exportPatientData(user?.id || user?.patientId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meditalk-health-export-${user?.id || "patient"}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Personal health data archive exported successfully.");
    } catch (err) {
      toast.error(err.message || "Failed to export data.");
    } finally {
      setExporting(false);
    }
  }

  async function handleWithdrawConsent() {
    setWithdrawing(true);
    try {
      await withdrawConsent(user?.id || user?.patientId);
      toast.success("Medical consent withdrawn and account deleted.");
      setWithdrawModalOpen(false);
      await logout();
      navigate("/login");
    } catch (err) {
      toast.error(err.message || "Failed to withdraw consent.");
    } finally {
      setWithdrawing(false);
    }
  }

  // Account state
  const [accountForm, setAccountForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [savingAccount, setSavingAccount] = useState(false);

  // Password state
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [changingPw, setChangingPw] = useState(false);

  // Preferences state
  const notifDefs = [
    { key: "apptReminder", label: "Appointment reminders (24h & 2h before visit)", def: true },
    { key: "emailNotif", label: "Email notifications for clinical updates", def: true },
    { key: "smsNotif", label: "SMS emergency alerts & confirmations", def: true },
    { key: "prescReady", label: "Prescription ready & refill alerts", def: true },
    { key: "waNotif", label: "WhatsApp consultation links & reminders", def: true },
  ];
  const [prefState, setPrefState] = useState(() =>
    Object.fromEntries(notifDefs.map((p) => [p.key, p.def]))
  );

  const [apptPrefs, setApptPrefs] = useState({
    preferredTime: "Morning (09:00 AM - 01:00 PM)",
    preferredBranch: "MediTalk Central Telehealth & Clinic",
    language: "English",
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Load real profile from backend
  useEffect(() => {
    async function load() {
      try {
        const res = await getUserProfile();
        if (res?.user) {
          setAccountForm({
            name: res.user.name || user?.name || "",
            email: res.user.email || user?.email || "",
            phone: res.user.phone || "",
          });
          if (res.user.preferences) {
            const p = res.user.preferences;
            setPrefState((prev) => ({
              ...prev,
              ...(p.notifications || {}),
            }));
            if (p.appointments) {
              setApptPrefs((prev) => ({ ...prev, ...p.appointments }));
            }
          }
        }
      } catch (_) {
        // Fallback to auth context user
        if (user) {
          setAccountForm({
            name: user.name || "",
            email: user.email || "",
            phone: user.phone || "",
          });
        }
      }
    }
    load();
  }, [user]);

  async function handleSaveAccount() {
    if (!accountForm.name.trim() || !accountForm.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    setSavingAccount(true);
    try {
      const res = await updateUserProfile(accountForm);
      if (res?.success) {
        toast.success("Account information updated successfully.");
        if (updateUser) {
          updateUser({ name: accountForm.name, email: accountForm.email, phone: accountForm.phone });
        }
      } else {
        toast.error(res?.message || "Failed to update account.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to update account.");
    } finally {
      setSavingAccount(false);
    }
  }

  function toggleNotif(key) {
    setPrefState((s) => {
      const next = { ...s, [key]: !s[key] };
      // Auto-save notification preference
      updateUserPreferences({ notifications: next, appointments: apptPrefs }).catch(() => {});
      return next;
    });
    toast.success("Preference updated.");
  }

  async function handleSaveApptPrefs() {
    setSavingPrefs(true);
    try {
      await updateUserPreferences({ notifications: prefState, appointments: apptPrefs });
      toast.success("Appointment preferences saved successfully.");
    } catch (err) {
      toast.error(err.message || "Failed to save preferences.");
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handlePasswordChange() {
    if (!pw.current || !pw.next || !pw.confirm) {
      toast.error("Please fill in all password fields.");
      return;
    }
    if (pw.next.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    setChangingPw(true);
    try {
      const res = await changePassword({ currentPassword: pw.current, nextPassword: pw.next });
      if (res.success) {
        toast.success("Password updated successfully.");
        setPw({ current: "", next: "", confirm: "" });
      } else {
        toast.error(res.message || res.error || "Failed to update password.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setChangingPw(false);
    }
  }

  const isMobileDevice = typeof navigator !== "undefined" && /Mobi|Android|iPhone/i.test(navigator.userAgent);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <PageHeader
        title="Settings & Privacy"
        subtitle="Manage your profile credentials, notification delivery preferences, active sessions, and privacy rights."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  active
                    ? "bg-accent text-white shadow-sm"
                    : "text-ink/70 dark:text-dark-ink/70 hover:bg-canvas dark:hover:bg-dark-surface-elevated hover:text-ink dark:hover:text-dark-ink"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-6">
          {/* Account Section */}
          {section === "account" && (
            <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-5">
              <h3 className="font-semibold text-ink dark:text-dark-ink text-base tracking-tight border-b border-border-subtle dark:border-dark-border-subtle pb-3">
                Account Information
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={accountForm.email}
                  onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={accountForm.phone}
                  onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })}
                />
                <Input
                  label="System Role"
                  value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Patient"}
                  disabled
                />
              </div>
              <div className="pt-2 flex justify-end">
                <Button onClick={handleSaveAccount} loading={savingAccount}>
                  Save Profile Changes
                </Button>
              </div>
            </div>
          )}

          {/* Password Section */}
          {section === "password" && (
            <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-5">
              <h3 className="font-semibold text-ink dark:text-dark-ink text-base tracking-tight border-b border-border-subtle dark:border-dark-border-subtle pb-3">
                Change Account Password
              </h3>
              <div className="space-y-4 max-w-md">
                <Input
                  label="Current Password"
                  type="password"
                  value={pw.current}
                  onChange={(e) => setPw({ ...pw, current: e.target.value })}
                />
                <Input
                  label="New Password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={pw.next}
                  onChange={(e) => setPw({ ...pw, next: e.target.value })}
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={pw.confirm}
                  onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                />
                <Button onClick={handlePasswordChange} loading={changingPw}>
                  Update Password
                </Button>
              </div>
            </div>
          )}

          {/* Notifications Section */}
          {section === "notifications" && (
            <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-4">
              <h3 className="font-semibold text-ink dark:text-dark-ink text-base tracking-tight border-b border-border-subtle dark:border-dark-border-subtle pb-3">
                Notification Preferences
              </h3>
              <p className="text-xs text-ink/60 dark:text-dark-ink/60">
                Control which clinical alerts and appointment updates are sent to your verified channels.
              </p>
              <div className="divide-y divide-border-subtle dark:divide-dark-border-subtle pt-2">
                {notifDefs.map((p) => (
                  <label key={p.key} className="flex items-center justify-between gap-4 py-3.5 cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold text-ink dark:text-dark-ink block">{p.label}</span>
                      <span className="text-[11px] text-ink/50 dark:text-dark-ink/50">Dispatched via in-app banner and verified contacts</span>
                    </div>
                    <Toggle on={!!prefState[p.key]} onClick={() => toggleNotif(p.key)} />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Appointments Preferences */}
          {section === "appointments" && (
            <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-5">
              <h3 className="font-semibold text-ink dark:text-dark-ink text-base tracking-tight border-b border-border-subtle dark:border-dark-border-subtle pb-3">
                Care &amp; Scheduling Preferences
              </h3>
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1.5">Preferred Consultation Time Window</label>
                  <select
                    value={apptPrefs.preferredTime}
                    onChange={(e) => setApptPrefs({ ...apptPrefs, preferredTime: e.target.value })}
                    className="w-full text-xs rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle p-2.5 text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
                  >
                    <option value="Morning (09:00 AM - 01:00 PM)">Morning (09:00 AM - 01:00 PM)</option>
                    <option value="Afternoon (02:00 PM - 05:00 PM)">Afternoon (02:00 PM - 05:00 PM)</option>
                    <option value="Evening (05:00 PM - 08:00 PM)">Evening (05:00 PM - 08:00 PM)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1.5">Preferred Clinic / Care Facility</label>
                  <input
                    type="text"
                    value={apptPrefs.preferredBranch}
                    onChange={(e) => setApptPrefs({ ...apptPrefs, preferredBranch: e.target.value })}
                    className="w-full text-xs rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle p-2.5 text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="pt-2">
                  <Button onClick={handleSaveApptPrefs} loading={savingPrefs}>
                    Save Preferences
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Security & Sessions */}
          {section === "security" && (
            <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card space-y-6">
              <div className="flex items-center gap-2.5 border-b border-border-subtle dark:border-dark-border-subtle pb-3">
                <ShieldCheck className="h-5 w-5 text-accent" />
                <h3 className="font-semibold text-ink dark:text-dark-ink text-base tracking-tight">
                  Privacy &amp; Active Sessions
                </h3>
              </div>

              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 flex items-start gap-3.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-emerald-950 dark:text-emerald-100">Encrypted JWT Session Protection</p>
                    <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mt-0.5 leading-relaxed">
                      Your clinical communications and electronic health records are encrypted at rest with AES-256 and authenticated with role-scoped JSON Web Tokens.
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink/50 dark:text-dark-ink/50 mb-2">Current Active Device Session</p>
                  <div className="flex items-center gap-3.5 rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle p-4 text-xs text-ink dark:text-dark-ink">
                    <div className="h-10 w-10 rounded-xl bg-accent/10 dark:bg-accent/20 border border-accent/20 flex items-center justify-center text-accent shadow-sm shrink-0">
                      {isMobileDevice ? <Smartphone className="h-5 w-5" /> : <Laptop className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink dark:text-dark-ink text-xs">
                        {isMobileDevice ? "Mobile Browser Session" : "Desktop Workstation Session"}
                      </p>
                      <p className="text-ink/50 dark:text-dark-ink/50 text-[11px] mt-0.5">
                        Authenticated as <strong>{user?.name || "User"}</strong> ({user?.role}) · Active Now
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Verified
                    </span>
                  </div>
                </div>

                {/* Health Data Portability (Export) */}
                <div className="pt-4 border-t border-border-subtle dark:border-dark-border-subtle">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-ink dark:text-dark-ink flex items-center gap-1.5">
                        <FileJson className="h-4 w-4 text-accent" /> Export Health Records (GDPR &amp; HIPAA)
                      </h4>
                      <p className="text-xs text-ink/60 dark:text-dark-ink/60 mt-1 max-w-lg leading-relaxed">
                        Download a complete, machine-readable JSON archive of your personal health records, including demographics, appointments, doctor consultation notes, prescriptions, and vital statistics.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportData}
                      loading={exporting}
                      className="shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" /> Export Data (.JSON)
                    </Button>
                  </div>
                </div>

                {/* Patient Danger Zone */}
                {user?.role === "patient" && (
                  <div className="pt-5 border-t border-border-subtle dark:border-dark-border-subtle">
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10 p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-danger" />
                        <h4 className="text-xs font-bold text-rose-950 dark:text-rose-200">Danger Zone: Withdraw Medical Consent &amp; Delete Account</h4>
                      </div>
                      <p className="text-xs text-rose-900/80 dark:text-rose-200/80 leading-relaxed">
                        Withdrawing your medical consent revokes MediTalk's authorization to process your healthcare records. In compliance with data privacy regulations (GDPR Article 17 / HIPAA Right to Erasure), your account will be permanently anonymized, future appointments cancelled, active login tokens revoked, and your session terminated.
                      </p>
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-[11px] text-rose-800 dark:text-rose-300 font-medium">
                          Status: <span className="font-bold text-emerald-600 dark:text-emerald-400">Consent Active (v1.0)</span>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setWithdrawModalOpen(true)}
                        >
                          <UserX className="h-3.5 w-3.5" /> Withdraw Consent &amp; Delete Account
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Withdraw Consent Confirmation Modal */}
          <ConfirmationModal
            open={withdrawModalOpen}
            onClose={() => setWithdrawModalOpen(false)}
            onConfirm={handleWithdrawConsent}
            title="Permanently Withdraw Consent & Delete Account?"
            message="Are you sure you want to withdraw your medical consent? This will immediately anonymize your patient chart, revoke your login credentials, cancel all pending appointments, and log you out. This action cannot be undone."
            confirmLabel="Yes, Delete My Account"
            variant="danger"
            loading={withdrawing}
          />
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none ${
        on ? "bg-accent" : "bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle"
      }`}
      aria-pressed={on}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all shadow-sm ${on ? "left-5" : "left-0.5"}`} />
    </button>
  );
}
