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
    <div className="flex h-screen overflow-hidden bg-[#F5F5F7] dark:bg-[#000000] text-ink dark:text-white transition-colors">
      {/* Desktop macOS-style sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar role={role} items={items} />
      </div>

      {/* Mobile drawer with frosted backdrop */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full animate-enter">
            <Sidebar role={role} items={items} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          notificationTo={`/${role}/notifications`}
          searchTo={
            role === "patient"
              ? "/patient/appointments"
              : role === "doctor"
              ? "/doctor/patients"
              : "/admin/patients"
          }
        />

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
          <div className="mx-auto max-w-6xl">
            {role === "patient" && <EmergencyBanner dismissible={true} />}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
