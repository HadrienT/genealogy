import React, { useState, useRef, useEffect } from "react";
import TreeView from "./components/TreeView";
import MapView from "./components/MapView";
import DetailPanel from "./components/DetailPanel";
import AddPersonForm from "./components/AddPersonForm";
import LoginPage from "./components/LoginPage";
import { FamilyProvider, useFamily } from "./hooks/useFamily";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { I18nProvider, useI18n } from "./hooks/useI18n";
import type { Lang } from "./hooks/useI18n";

type ViewMode = "tree" | "map";

const AppContent: React.FC = () => {
  const [view, setView] = useState<ViewMode>("tree");
  const [showAddForm, setShowAddForm] = useState(false);
  const { t, lang, setLang } = useI18n();
  const { user, isEditor, logout } = useAuth();
  const {
    people,
    trees,
    currentTreeId,
    currentTreeName,
    switchTree,
    createTree,
    deleteTree,
    renameTree,
    loadingTree,
  } = useFamily();
  const [treeSelectorOpen, setTreeSelectorOpen] = useState(false);
  const treeSelectorRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        treeSelectorRef.current &&
        !treeSelectorRef.current.contains(e.target as Node)
      ) {
        setTreeSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNewTree = async () => {
    const name = prompt(t("app.promptNewTree"));
    if (!name?.trim()) return;
    await createTree(name.trim());
    setTreeSelectorOpen(false);
  };

  const handleRename = async (id: string, currentName: string) => {
    const name = prompt(t("app.promptRename"), currentName);
    if (!name?.trim() || name.trim() === currentName) return;
    await renameTree(id, name.trim());
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("app.confirmDelete", { name }))) return;
    await deleteTree(id);
    if (trees.length <= 1) setTreeSelectorOpen(false);
  };

  return (
    <div style={appStyle}>
      {/* ── Top bar ─────────────────────────────── */}
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>🌳</span>

          {/* Tree selector */}
          <div ref={treeSelectorRef} style={{ position: "relative" }}>
            <button
              onClick={() => setTreeSelectorOpen((v) => !v)}
              style={treeSelectorBtnStyle}
              title={t("app.switchTree")}
            >
              <span style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>
                {currentTreeName || t("app.noTree")}
              </span>
              <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6 }}>▼</span>
            </button>

            {treeSelectorOpen && (
              <div style={dropdownStyle}>
                <div style={dropdownHeaderStyle}>{t("app.familyTrees")}</div>
                {trees.map((tr) => (
                  <div
                    key={tr.id}
                    style={{
                      ...dropdownItemStyle,
                      background: tr.id === currentTreeId ? "#eff6ff" : undefined,
                    }}
                  >
                    <button
                      onClick={() => {
                        switchTree(tr.id);
                        setTreeSelectorOpen(false);
                      }}
                      style={dropdownItemBtnStyle}
                    >
                      <span style={{ fontWeight: tr.id === currentTreeId ? 600 : 400 }}>
                        {tr.name}
                      </span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        {tr.peopleCount} {t("app.people")}
                      </span>
                    </button>
                    {isEditor && (
                    <div style={{ display: "flex", gap: 2 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRename(tr.id, tr.name);
                        }}
                        style={dropdownActionBtnStyle}
                        title={t("app.rename")}
                      >
                        ✏️
                      </button>
                      {trees.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(tr.id, tr.name);
                          }}
                          style={dropdownActionBtnStyle}
                          title={t("app.delete")}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                    )}
                  </div>
                ))}
                {isEditor && (
                <button onClick={handleNewTree} style={newTreeBtnStyle}>
                  {t("app.newTree")}
                </button>
                )}
              </div>
            )}
          </div>

          <span style={badgeStyle}>{people.length} {t("app.people")}</span>
        </div>

        <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <TabButton
            active={view === "tree"}
            onClick={() => setView("tree")}
            label={t("app.tree")}
          />
          <TabButton
            active={view === "map"}
            onClick={() => setView("map")}
            label={t("app.map")}
          />
          {isEditor && (
            <button onClick={() => setShowAddForm(true)} style={addBtnStyle}>
              {t("app.addPerson")}
            </button>
          )}
          <LangSwitcher lang={lang} setLang={setLang} />
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
              <span style={roleBadgeStyle(isEditor)}>
                {isEditor ? t("app.roleEditor") : t("app.roleViewer")}
              </span>
              <button onClick={logout} style={logoutBtnStyle} title={t("app.logout")}>
                {t("app.logout")}
              </button>
            </div>
          )}
        </nav>
      </header>

      {/* ── Main content ────────────────────────── */}
      <main style={mainStyle}>
        {loadingTree ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94a3b8", fontSize: 14 }}>
            {t("app.loadingTree")}
          </div>
        ) : (
          <>
            {view === "tree" && <TreeView />}
            {view === "map" && <MapView />}
            <DetailPanel />
          </>
        )}
      </main>

      {/* ── Modal ───────────────────────────────── */}
      {showAddForm && (
        <AddPersonForm onClose={() => setShowAddForm(false)} />
      )}
    </div>
  );
};

const AuthGate: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#94a3b8", fontFamily: "'Inter', system-ui, sans-serif" }}>
        …
      </div>
    );
  }
  if (!user) return <LoginPage />;
  return (
    <FamilyProvider>
      <AppContent />
    </FamilyProvider>
  );
};

const App: React.FC = () => (
  <I18nProvider>
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  </I18nProvider>
);

// ── Sub-components ──────────────────────────────
const LangSwitcher: React.FC<{ lang: Lang; setLang: (l: Lang) => void }> = ({ lang, setLang }) => (
  <div style={{ display: "flex", gap: 2, marginLeft: 12 }}>
    <button
      onClick={() => setLang("en")}
      style={{
        ...flagBtnStyle,
        opacity: lang === "en" ? 1 : 0.4,
        transform: lang === "en" ? "scale(1.1)" : "scale(1)",
      }}
      title="English"
    >
      🇬🇧
    </button>
    <button
      onClick={() => setLang("fr")}
      style={{
        ...flagBtnStyle,
        opacity: lang === "fr" ? 1 : 0.4,
        transform: lang === "fr" ? "scale(1.1)" : "scale(1)",
      }}
      title="Français"
    >
      🇫🇷
    </button>
  </div>
);

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
}> = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    style={{
      padding: "6px 16px",
      background: active ? "#3b82f6" : "transparent",
      color: active ? "white" : "#64748b",
      border: active ? "none" : "1px solid #e2e8f0",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 500,
      transition: "all 0.15s",
    }}
  >
    {label}
  </button>
);

// ── Styles ──────────────────────────────────────
const flagBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 20,
  padding: "2px 4px",
  borderRadius: 4,
  transition: "all 0.15s",
  lineHeight: 1,
};

const appStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  background: "#f8fafc",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 20px",
  background: "white",
  borderBottom: "1px solid #e2e8f0",
  zIndex: 100,
};

const badgeStyle: React.CSSProperties = {
  fontSize: 11,
  background: "#f1f5f9",
  color: "#64748b",
  padding: "2px 8px",
  borderRadius: 10,
  fontWeight: 500,
};

const addBtnStyle: React.CSSProperties = {
  padding: "6px 16px",
  background: "#10b981",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  marginLeft: 8,
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  position: "relative",
  overflow: "hidden",
};

const treeSelectorBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  background: "none",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  padding: "4px 12px",
  cursor: "pointer",
  transition: "all 0.15s",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  minWidth: 260,
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  zIndex: 1000,
  overflow: "hidden",
};

const dropdownHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  padding: "10px 14px 6px",
};

const dropdownItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "2px 6px 2px 0",
  borderBottom: "1px solid #f1f5f9",
};

const dropdownItemBtnStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "none",
  border: "none",
  padding: "8px 14px",
  cursor: "pointer",
  fontSize: 13,
  color: "#1e293b",
  textAlign: "left",
};

const dropdownActionBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 12,
  padding: "4px 4px",
  borderRadius: 4,
  opacity: 0.6,
};

const newTreeBtnStyle: React.CSSProperties = {
  width: "100%",
  background: "none",
  border: "none",
  padding: "10px 14px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  color: "#3b82f6",
  textAlign: "left",
};

const logoutBtnStyle: React.CSSProperties = {
  padding: "4px 10px",
  background: "none",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  color: "#64748b",
  fontWeight: 500,
};

const roleBadgeStyle = (isEditor: boolean): React.CSSProperties => ({
  fontSize: 10,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 10,
  background: isEditor ? "#dbeafe" : "#f1f5f9",
  color: isEditor ? "#2563eb" : "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
});

export default App;
