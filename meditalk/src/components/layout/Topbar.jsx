import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Menu, Search, ChevronDown, User, Settings, LogOut } from "lucide-react";
import Avatar from "../ui/Avatar";
import { useNotifications } from "../../context/NotificationContext";
import { useAuth } from "../../context/AuthContext";
import { ROLE_LABELS } from "../../constants";

export default function Topbar({ onMenuClick, notificationTo, searchTo = "/patient/appointments" }) {
  const { user, logout } = useAuth();
  const { unread } = useNotifications();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function handleLogout() {
    setDropdownOpen(false);
    await logout();
    navigate("/login");
  }

  const role = user?.role || "patient";
  const profileRoute = role === "patient" ? "/patient/profile" : `/${role}/settings`;

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-sage/30">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-sage/20 text-ink/70"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden sm:block flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40" />
            <input
              type="text"
              placeholder="Search patients, doctors, records..."
              onKeyDown={(e) => e.key === "Enter" && navigate(searchTo)}
              className="input-base pl-9"
            />
          </div>
        </div>

        <div className="flex-1 sm:flex-none" />

        <button
          onClick={() => navigate(notificationTo)}
          className="relative p-2 rounded-xl hover:bg-sage/20 text-ink/70"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-sage/20 transition-all text-left group"
          >
            <Avatar name={user?.name || "User"} size="sm" />
            <div className="hidden md:block text-left">
              <span className="text-sm font-semibold text-ink group-hover:text-primary transition-colors block leading-tight">
                {user?.name || "User"}
              </span>
              <span className="text-[10px] text-ink/50 uppercase tracking-wider font-semibold">
                {ROLE_LABELS[role] || role}
              </span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-ink/40 transition-transform duration-200 ${
                dropdownOpen ? "rotate-180 text-primary" : ""
              }`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-sage/30 shadow-xl py-2 z-50 animate-in fade-in-50 zoom-in-95 duration-100">
              <div className="px-4 py-2.5 border-b border-sage/20">
                <p className="text-sm font-bold text-ink truncate">{user?.name}</p>
                <p className="text-xs text-ink/50 truncate mt-0.5">{user?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-primary/10 text-primary">
                  {ROLE_LABELS[role] || role}
                </span>
              </div>

              <div className="py-1">
                {role === "patient" && (
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate(profileRoute);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-ink/80 hover:bg-sage/10 hover:text-primary transition-colors"
                  >
                    <User className="h-4 w-4" /> My Health Profile
                  </button>
                )}

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate(`/${role}/settings`);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-ink/80 hover:bg-sage/10 hover:text-primary transition-colors"
                >
                  <Settings className="h-4 w-4" /> Account Settings
                </button>
              </div>

              <div className="border-t border-sage/20 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
