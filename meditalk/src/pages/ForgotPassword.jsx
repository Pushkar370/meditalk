import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
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
  const [devToken, setDevToken] = useState(null); // only set in dev mode

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
      // In development, the backend returns a _devToken for easy testing
      if (res._devToken) setDevToken(res._devToken);
    } catch (err) {
      setError(err.message || "Request failed. Please try again.");
      toast.error(err.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6"><Logo /></div>
        <div className="card">
          <h1 className="text-xl font-bold text-ink">Forgot password</h1>
          <p className="text-sm text-ink/50 mt-1">
            Enter your email and we'll send a reset link.
          </p>

          {sent ? (
            <div className="mt-6 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-success/15 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <p className="text-sm text-ink/70">Reset instructions sent to <strong>{email}</strong></p>
              <p className="text-xs text-ink/40">Check your inbox (and spam folder). The link expires in 1 hour.</p>
              {devToken && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-left">
                  <p className="text-xs font-semibold text-yellow-700">🔧 DEV MODE — Reset Token:</p>
                  <Link to={`/reset-password?token=${devToken}`} className="text-xs text-blue-600 underline break-all">
                    /reset-password?token={devToken}
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40" />
                <Input
                  className="pl-9"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  error={error}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Send reset link"}
              </Button>
            </form>
          )}

          <Link to="/login" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
