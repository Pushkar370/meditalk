import { createContext, useContext, useState, useEffect } from "react";
import { login as loginService, logout as logoutService } from "../services/authService";

const AuthContext = createContext(null);

const STORAGE_KEY = "meditrack_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  // Persist the full user object (including token) to localStorage so
  // apiClient.js can always read a valid Bearer token.
  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  async function login(credentials) {
    setLoading(true);
    const res = await loginService(credentials);
    setLoading(false);
    if (res.success) {
      // Merge the JWT token into the user payload so apiClient always has it.
      setUser({ ...res.user, token: res.token });
    }
    return res;
  }

  async function logout() {
    await logoutService();
    setUser(null);
  }

  function updateUser(partial) {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    role: user?.role || null,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
