import { NavLink, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import Logo from "../ui/Logo";
import { useAuth } from "../../context/AuthContext";
import { ROLE_LABELS } from "../../constants";

export default function Sidebar({ role, items, onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="w-64 shrink-0 bg-[#FBFBFC]/95 dark:bg-[#121214]/95 backdrop-blur-xl border-r border-black/[0.06] dark:border-white/[0.08] h-full flex flex-col select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center">
        <Logo size="md" />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-ink-tertiary dark:text-neutral-500">
          {ROLE_LABELS[role] || role} Portal
        </div>

        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 " +
                (isActive
                  ? "bg-primary text-white shadow-xs font-semibold"
                  : "text-ink-secondary dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-ink dark:hover:text-white")
              }
            >
              <Icon className="h-4 w-4 shrink-0 stroke-[1.8]" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer Profile & Sign Out */}
      <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-1 bg-white/50 dark:bg-black/20">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary dark:text-primary-light font-bold flex items-center justify-center text-xs shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink dark:text-white truncate">
              {user?.name || "User"}
            </p>
            <p className="text-[11px] text-ink-secondary dark:text-neutral-400 truncate">
              {ROLE_LABELS[role] || role}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-danger hover:bg-danger/10 active:scale-[0.98] transition-all"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
