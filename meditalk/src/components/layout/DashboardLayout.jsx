import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import EmergencyBanner from "../ui/EmergencyBanner";
import { NAV_CONFIG } from "../../config/navConfig";

export default function DashboardLayout({ role }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV_CONFIG[role] || [];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar role={role} items={items} />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full animate-[slideIn_0.2s_ease]">
            <Sidebar role={role} items={items} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          notificationTo={`/${role}/notifications`}
          searchTo={role === "patient" ? "/patient/appointments" : (role === "doctor" ? "/doctor/patients" : "/admin/patients")}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            {role === "patient" && <EmergencyBanner dismissible={true} />}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
