import { useState } from "react";
import { Shield, Bell, CalendarClock, User, Lock, KeyRound } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { changePassword } from "../services/authService";

const SECTIONS = [
  { key: "account", label: "Account", icon: User },
  { key: "password", label: "Password", icon: Lock },
  { key: "notifications", label: "Notification Preferences", icon: Bell },
  { key: "appointments", label: "Appointment Preferences", icon: CalendarClock },
  { key: "security", label: "Privacy & Security", icon: Shield },
];

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();
  const [section, setSection] = useState("account");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [changingPw, setChangingPw] = useState(false);

  const prefs = [
    { key: "apptReminder", label: "Appointment reminders", def: true },
    { key: "emailNotif", label: "Email notifications", def: true },
    { key: "smsNotif", label: "SMS notifications", def: false },
    { key: "prescReady", label: "Prescription ready alerts", def: true },
  ];
  const [prefState, setPrefState] = useState(() =>
    Object.fromEntries(prefs.map((p) => [p.key, p.def]))
  );

  function toggle(key) {
    setPrefState((s) => ({ ...s, [key]: !s[key] }));
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

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your account and preferences." />

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        <nav className="space-y-1">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition " +
                  (section === s.key
                    ? "bg-primary text-white"
                    : "text-ink/70 hover:bg-sage/20")
                }
              >
                <Icon className="h-4 w-4" /> {s.label}
              </button>
            );
          })}
        </nav>

        <div className="space-y-6">
          {section === "account" && (
            <Card title="Account Information">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Name" defaultValue={user?.name} />
                <Input label="Email" type="email" defaultValue={user?.email} />
                <Input label="Role" value={user?.role} disabled />
              </div>
              <div className="mt-4">
                <Button onClick={() => toast.success("Saved (mock)")}>Save changes</Button>
              </div>
            </Card>
          )}

          {section === "password" && (
            <Card title="Change Password">
              <div className="space-y-4 max-w-md">
                <Input label="Current password" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
                <Input label="New password" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                <Input label="Confirm new password" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
                <Button onClick={handlePasswordChange} loading={changingPw}>Update password</Button>
              </div>
            </Card>
          )}

          {section === "notifications" && (
            <Card title="Notification Preferences">
              <div className="space-y-3">
                {prefs.map((p) => (
                  <label key={p.key} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm text-ink/70">{p.label}</span>
                    <Toggle on={prefState[p.key]} onClick={() => toggle(p.key)} />
                  </label>
                ))}
              </div>
            </Card>
          )}

          {section === "appointments" && (
            <Card title="Appointment Preferences">
              <div className="space-y-4 max-w-md">
                <Input label="Preferred appointment time" defaultValue="Morning" />
                <Input label="Preferred clinic branch" defaultValue="Main Branch" />
                <Button onClick={() => toast.success("Preferences saved (mock)")}>Save preferences</Button>
              </div>
            </Card>
          )}

          {section === "security" && (
            <Card title={
              <span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Security</span>
            }>
              <div className="space-y-4">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink/70">Two-factor authentication</span>
                  <Toggle on={false} onClick={() => toast.info("2FA setup is a backend feature.")} />
                </label>
                <div>
                  <p className="text-sm font-medium text-ink mb-2">Active sessions</p>
                  <div className="rounded-xl bg-sage/10 border border-sage/20 p-3 text-sm text-ink/70">
                    Current session · {user?.role} · Active now
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink mb-2">Login history</p>
                  <ul className="text-xs text-ink/50 space-y-1">
                    <li>2026-08-29 09:12 · Clinic Desktop · Success</li>
                    <li>2026-08-27 19:50 · Mobile · Failed</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        "relative h-6 w-11 rounded-full transition " + (on ? "bg-primary" : "bg-sage/40")
      }
      aria-pressed={on}
    >
      <span className={"absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all " + (on ? "left-5" : "left-0.5")} />
    </button>
  );
}
