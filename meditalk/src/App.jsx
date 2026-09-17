import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import AccessDenied from "./pages/AccessDenied";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import NotificationCenter from "./pages/NotificationCenter";
import Placeholder from "./pages/Placeholder";

import PatientLayout from "./layouts/PatientLayout";
import DoctorLayout from "./layouts/DoctorLayout";
import AdminLayout from "./layouts/AdminLayout";

import PatientDashboard from "./pages/patient/PatientDashboard";
import PatientProfile from "./pages/patient/PatientProfile";
import PatientRecords from "./pages/patient/PatientRecords";
import PatientHistory from "./pages/patient/PatientHistory";
import PatientAppointments from "./pages/patient/PatientAppointments";
import BookAppointment from "./pages/patient/BookAppointment";
import PatientPrescriptions from "./pages/patient/PatientPrescriptions";
import PatientVideoRoom from "./pages/patient/PatientVideoRoom";

import {
  DoctorDashboard, DoctorAppointments, DoctorPatients, DoctorPatientDetails, DoctorConsultation,
  DoctorPrescriptions, DoctorCalendar,
} from "./pages/doctor/doctorIndex.jsx";
import {
  AdminDashboard, AdminPatients, AdminDoctors, AdminAppointments, AdminAnalytics, AdminAuditLogs,
} from "./pages/admin/adminIndex.jsx";

import { useAuth } from "./context/AuthContext";

function RoleRedirect({ subpath }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}/${subpath}`} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Patient */}
      <Route element={<ProtectedRoute role="patient" />}>
        <Route element={<PatientLayout />}>
          <Route path="/patient/dashboard" element={<PatientDashboard />} />
          <Route path="/patient/profile" element={<PatientProfile />} />
          <Route path="/patient/records" element={<PatientRecords />} />
          <Route path="/patient/history" element={<PatientHistory />} />
          <Route path="/patient/appointments" element={<PatientAppointments />} />
          <Route path="/patient/book-appointment" element={<BookAppointment />} />
          <Route path="/patient/prescriptions" element={<PatientPrescriptions />} />
          <Route path="/patient/consultation/:appointmentId" element={<PatientVideoRoom />} />
          <Route path="/patient/notifications" element={<NotificationCenter />} />
          <Route path="/patient/settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Doctor */}
      <Route element={<ProtectedRoute role="doctor" />}>
        <Route element={<DoctorLayout />}>
          <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
          <Route path="/doctor/appointments" element={<DoctorAppointments />} />
          <Route path="/doctor/patients" element={<DoctorPatients />} />
          <Route path="/doctor/patients/:id" element={<DoctorPatientDetails />} />
          <Route path="/doctor/consultation/:id" element={<DoctorConsultation />} />
          <Route path="/doctor/prescriptions" element={<DoctorPrescriptions />} />
          <Route path="/doctor/calendar" element={<DoctorCalendar />} />
          <Route path="/doctor/notifications" element={<NotificationCenter />} />
          <Route path="/doctor/settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Admin */}
      <Route element={<ProtectedRoute role="admin" />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/patients" element={<AdminPatients />} />
          <Route path="/admin/doctors" element={<AdminDoctors />} />
          <Route path="/admin/appointments" element={<AdminAppointments />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
          <Route path="/admin/notifications" element={<NotificationCenter />} />
          <Route path="/admin/settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Common Fallback Redirects */}
      <Route path="/notifications" element={<RoleRedirect subpath="notifications" />} />
      <Route path="/settings" element={<RoleRedirect subpath="settings" />} />
      <Route path="/access-denied" element={<AccessDenied />} />
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
