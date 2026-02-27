import React, { useState, useRef, useEffect } from "react";
import TreeView from "./components/TreeView";
import MapView from "./components/MapView";
import DetailPanel from "./components/DetailPanel";
import AddPersonForm from "./components/AddPersonForm";
import { FamilyProvider, useFamily } from "./hooks/useFamily";

type ViewMode = "tree" | "map";

const AppContent: React.FC = () => {
  const [view, setView] = useState<ViewMode>("tree");
  const [showAddForm, setShowAddForm] = useState(false);
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
    const name = prompt("Name for the new tree:");
    if (!name?.trim()) return;
    await createTree(name.trim());
    setTreeSelectorOpen(false);
  };

  const handleRename = async (id: string, currentName: string) => {
    const name = prompt("Rename tree:", currentName);
    if (!name?.trim() || name.trim() === currentName) return;
    await renameTree(id, name.trim());
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete tree "${name}"? This cannot be undone.`)) return;
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
              title="Switch family tree"
            >
              <span style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>
                {currentTreeName || "No tree"}
              </span>
              <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6 }}>▼</span>
            </button>

            {treeSelectorOpen && (
              <div style={dropdownStyle}>
                <div style={dropdownHeaderStyle}>Family Trees</div>
                {trees.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      ...dropdownItemStyle,
                      background: t.id === currentTreeId ? "#eff6ff" : undefined,
                    }}
                  >
                    <button
                      onClick={() => {
                        switchTree(t.id);
                        setTreeSelectorOpen(false);
                      }}
                      style={dropdownItemBtnStyle}
                    >
                      <span style={{ fontWeight: t.id === currentTreeId ? 600 : 400 }}>
                        {t.name}
                      </span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        {t.peopleCount} people
                      </span>
                    </button>
                    <div style={{ display: "flex", gap: 2 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRename(t.id, t.name);
                        }}
                        style={dropdownActionBtnStyle}
                        title="Rename"
                      >
                        ✏️
                      </button>
                      {trees.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(t.id, t.name);
                          }}
                          style={dropdownActionBtnStyle}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button onClick={handleNewTree} style={newTreeBtnStyle}>
                  + New Tree
                </button>
              </div>
            )}
          </div>

          <span style={badgeStyle}>{people.length} people</span>
        </div>

        <nav style={{ display: "flex", gap: 4 }}>
          <TabButton
            active={view === "tree"}
            onClick={() => setView("tree")}
            label="🌲 Tree"
          />
          <TabButton
            active={view === "map"}
            onClick={() => setView("map")}
            label="🗺️ Map"
          />
          <button onClick={() => setShowAddForm(true)} style={addBtnStyle}>
            + Add Person
          </button>
        </nav>
      </header>

      {/* ── Main content ────────────────────────── */}
      <main style={mainStyle}>
        {loadingTree ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94a3b8", fontSize: 14 }}>
            Loading tree…
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

const App: React.FC = () => (
  <FamilyProvider>
    <AppContent />
  </FamilyProvider>
);

// ── Sub-components ──────────────────────────────
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

export default App;
