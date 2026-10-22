import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { DASHBOARD_ROUTES } from "../constants";

export default function AccessDenied() {
  const { role } = useAuth();

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-ink dark:text-white flex items-center justify-center p-6 transition-colors selection:bg-primary/20">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl border border-black/[0.08] dark:border-white/[0.12] shadow-popover p-8 max-w-md w-full text-center animate-enter">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-danger/10 text-danger dark:text-danger-light flex items-center justify-center mb-4">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-ink dark:text-white">
          Access Restricted
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-ink-secondary dark:text-neutral-400 leading-relaxed">
          You do not have administrative or clinical clearance to view this resource. If you believe this is an error, please contact your clinic administrator.
        </p>
        <div className="mt-6">
          <Link to={role ? DASHBOARD_ROUTES[role] : "/login"}>
            <Button size="lg" className="w-full shadow-card">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
