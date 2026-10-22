import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Logo from "../components/ui/Logo";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useToast } from "../context/ToastContext";
import { apiFetch } from "../services/apiClient";

export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
      if (res._devToken) setDevToken(res._devToken);
    } catch (err) {
      setError(err.message || "Request failed. Please try again.");
      toast.error(err.message || "Request failed.");
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
            Reset your password
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary dark:text-neutral-400 mt-1">
            Enter your email and we'll send a secure reset link.
          </p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl border border-black/[0.08] dark:border-white/[0.12] shadow-popover p-6 sm:p-8">
          {sent ? (
            <div className="text-center space-y-4 animate-enter py-2">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-success/15 text-success dark:text-success-light flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-ink dark:text-white">
                  Reset link dispatched
                </h3>
                <p className="mt-1 text-xs text-ink-secondary dark:text-neutral-400 leading-relaxed">
                  We've sent password reset instructions to <strong>{email}</strong>. The link expires in 1 hour.
                </p>
              </div>

              {devToken && (
                <div className="mt-4 p-3.5 bg-warning/[0.08] border border-warning/20 rounded-2xl text-left">
                  <p className="text-xs font-semibold text-warning-dark dark:text-warning">
                    🔧 Development Mode Reset Link:
                  </p>
                  <Link
                    to={`/reset-password?token=${devToken}`}
                    className="text-xs text-accent underline break-all font-mono mt-1 block"
                  >
                    /reset-password?token={devToken}
                  </Link>
                </div>
              )}

              <div className="pt-2">
                <Link to="/login">
                  <Button variant="secondary" className="w-full">
                    Return to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                id="reset-email"
                label="Registered Email Address"
                type="email"
                placeholder="name@example.com"
                value={email}
                error={error}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Button
                type="submit"
                loading={loading}
                className="w-full shadow-card py-3 text-sm font-semibold"
                size="lg"
              >
                Send Reset Link
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
