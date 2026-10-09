import { useParams, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingState from "../components/ui/LoadingState";

export default function VideoRedirect() {
  const { appointmentId } = useParams();
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState message="Connecting to consultation room..." />;
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (user.role === "doctor") {
    return <Navigate to={`/doctor/consultation/${appointmentId}`} replace />;
  }

  return <Navigate to={`/patient/consultation/${appointmentId}`} replace />;
}
