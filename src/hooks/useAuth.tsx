import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

export type Role = "viewer" | "editor";

interface AuthUser {
  id: string;
  username: string;
  role: Role;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isEditor: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isEditor: false,
  loading: true,
  login: async () => null,
  logout: () => {},
});

const TOKEN_KEY = "genealogy-auth-token";
const API_BASE = import.meta.env.VITE_API_URL || "";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const stored = localStorage.getItem(TOKEN_KEY);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!stored); // only loading if there's a stored token to validate
  const didValidate = useRef(false);

  // On mount, validate stored token
  useEffect(() => {
    if (didValidate.current) return;
    didValidate.current = true;
    if (!stored) return;
    fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid token");
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setToken(stored);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setLoading(false));
  }, [stored]);

  const login = useCallback(async (username: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Login failed";
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem(TOKEN_KEY, data.token);
      return null; // no error
    } catch {
      return "Network error";
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  const isEditor = user?.role === "editor";

  return (
    <AuthContext.Provider value={{ user, token, isEditor, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  return useContext(AuthContext);
}
