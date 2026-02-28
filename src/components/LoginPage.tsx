import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../hooks/useI18n";

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await login(username, password);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{ fontSize: 48 }}>🌳</span>
          <h1 style={titleStyle}>{t("login.title")}</h1>
          <p style={subtitleStyle}>{t("login.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{t("login.username")}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
              autoFocus
              required
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>{t("login.password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          <button type="submit" disabled={loading} style={submitStyle}>
            {loading ? t("login.loggingIn") : t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Styles ──────────────────────────────────────

const pageStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0fdf4 100%)",
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 16,
  padding: "40px 36px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)",
  width: 380,
  maxWidth: "90vw",
};

const titleStyle: React.CSSProperties = {
  margin: "12px 0 4px",
  fontSize: 22,
  fontWeight: 700,
  color: "#1e293b",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#94a3b8",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: "#475569",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  color: "#dc2626",
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 13,
  marginBottom: 16,
  border: "1px solid #fecaca",
};

const submitStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 0",
  background: "#3b82f6",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 0.15s",
};

export default LoginPage;
