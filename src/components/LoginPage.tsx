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
    <div className="login">
      <div className="login__card">
        <div className="login__crest">
          <span>🌳</span>
          <h1 className="login__title">{t("login.title")}</h1>
          <p className="login__subtitle">{t("login.subtitle")}</p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label">{t("login.username")}</label>
            <input
              className="field__input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="field">
            <label className="field__label">{t("login.password")}</label>
            <input
              className="field__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="login__error">{error}</div>}

          <button
            className="btn btn--primary"
            type="submit"
            disabled={loading}
            style={{ padding: "10px 0" }}
          >
            {loading ? t("login.loggingIn") : t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
