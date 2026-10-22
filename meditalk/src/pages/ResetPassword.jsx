import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, EyeOff } from "lucide-react";
import Logo from "../components/ui/Logo";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useToast } from "../context/ToastContext";
import { apiFetch } from "../services/apiClient";

export default function ResetPassword() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Missing reset token.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: password }),
      });
      setDone(true);
      toast.success("Password reset successfully!");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err.message || "Reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-ink dark:text-white flex flex-col justify-center items-center p-4 sm:p-6 transition-colors selection:bg-primary/20">
      <div className="w-full max-w-md animate-enter">
        <div className="flex flex-col items-center text-center mb-8">
          <Link to="/" className="mb-4 inline-block hover:opacity-90 transition">
            <Logo size="lg" />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink dark:text-white">
            Choose a new password
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary dark:text-neutral-400 mt-1">
            Create a strong password of at least 8 characters.
          </p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl border border-black/[0.08] dark:border-white/[0.12] shadow-popover p-6 sm:p-8">
          {done ? (
            <div className="text-center space-y-4 animate-enter py-4">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-success/15 text-success dark:text-success-light flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold text-ink dark:text-white">
                Password updated successfully!
              </p>
              <p className="text-xs text-ink-secondary dark:text-neutral-400">
                Redirecting you to the sign in page...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {!token && (
                <div className="p-3.5 bg-danger/[0.08] border border-danger/20 rounded-2xl text-xs text-danger font-medium">
                  No reset token found. Please use the direct link provided in your email.
                </div>
              )}

              <div>
                <label className="label-base">New Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-base pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink dark:hover:text-white transition"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Repeat password"
                value={confirm}
                error={error}
                onChange={(e) => setConfirm(e.target.value)}
              />

              <Button
                type="submit"
                loading={loading}
                disabled={loading || !token}
                className="w-full shadow-card py-3 text-sm font-semibold"
                size="lg"
              >
                Update Password
              </Button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-black/[0.06] dark:border-white/[0.08] text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary dark:text-neutral-400 hover:text-ink dark:hover:text-white transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
