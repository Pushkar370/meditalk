import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Menu, Search, ChevronDown, User, Settings, LogOut, Sun, Moon } from "lucide-react";
import Avatar from "../ui/Avatar";
import { useNotifications } from "../../context/NotificationContext";
import { useAuth } from "../../context/AuthContext";
import { ROLE_LABELS } from "../../constants";

export default function Topbar({ onMenuClick, notificationTo, searchTo = "/patient/appointments" }) {
  const { user, logout } = useAuth();
  const { unread } = useNotifications();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const dropdownRef = useRef(null);

  // Initialize theme from HTML or localStorage
  useEffect(() => {
    const isDarkTheme =
      localStorage.theme === "dark" ||
      (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setIsDark(isDarkTheme);
    if (isDarkTheme) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  function toggleDarkMode() {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.theme = "light";
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.theme = "dark";
      setIsDark(true);
    }
  }

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
    <header className="sticky top-0 z-30 bg-[#F5F5F7]/85 dark:bg-[#000000]/85 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.08] transition-colors">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-ink dark:text-white transition"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Apple-style search pill */}
        <div className="hidden sm:block flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-tertiary dark:text-neutral-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search appointments, records..."
              onKeyDown={(e) => e.key === "Enter" && navigate(searchTo)}
              className="w-full rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#2C2C2E] pl-10 pr-4 py-2 text-xs text-ink dark:text-white placeholder:text-ink-tertiary focus:bg-white dark:focus:bg-[#1C1C1E] focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 sm:flex-none" />

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-ink-secondary dark:text-neutral-300 transition-all"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate(notificationTo)}
          className="relative p-2 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-ink-secondary dark:text-neutral-300 transition-all"
          aria-label={`Notifications (${unread} unread)`}
        >
          <Bell className="h-4.5 w-4.5" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
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
            className="flex items-center gap-2 p-1 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-all text-left"
          >
            <Avatar name={user?.name || "User"} size="sm" />
            <div className="hidden md:block text-left pr-1 max-w-[140px] lg:max-w-[200px]">
              <span className="text-xs font-semibold text-ink dark:text-white block leading-tight truncate" title={user?.name || "User"}>
                {user?.name || "User"}
              </span>
              <span className="text-[10px] text-ink-secondary dark:text-neutral-400 font-medium truncate block">
                {ROLE_LABELS[role] || role}
              </span>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-ink-tertiary dark:text-neutral-400 transition-transform duration-200 ${
                dropdownOpen ? "rotate-180 text-primary" : ""
              }`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2.5 w-64 max-w-[calc(100vw-2rem)] rounded-2xl bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.12] shadow-popover py-2 z-50 animate-enter">
              <div className="px-4 py-2.5 border-b border-black/[0.06] dark:border-white/[0.08] min-w-0">
                <p className="text-xs font-bold text-ink dark:text-white truncate" title={user?.name}>{user?.name}</p>
                <p className="text-[11px] text-ink-secondary dark:text-neutral-400 truncate mt-0.5" title={user?.email}>{user?.email}</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-primary/10 text-primary dark:text-primary-light">
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
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-ink dark:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                  >
                    <User className="h-3.5 w-3.5 text-ink-tertiary" /> My Health Profile
                  </button>
                )}

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate(`/${role}/settings`);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-ink dark:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <Settings className="h-3.5 w-3.5 text-ink-tertiary" /> Account Settings
                </button>
              </div>

              <div className="border-t border-black/[0.06] dark:border-white/[0.08] pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
