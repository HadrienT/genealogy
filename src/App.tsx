import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import TreeView from "./components/TreeView";
import MapView from "./components/MapView";
import StatsView from "./components/StatsView";
import SearchBox from "./components/SearchBox";
import IssuesMenu from "./components/IssuesMenu";
import { findIssues } from "./utils/checks";
import DetailPanel from "./components/DetailPanel";
import AddPersonForm from "./components/AddPersonForm";
import LoginPage from "./components/LoginPage";
import { FamilyProvider, useFamily } from "./hooks/useFamily";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { I18nProvider, useI18n } from "./hooks/useI18n";
import type { Lang } from "./hooks/useI18n";

type ViewMode = "tree" | "map" | "stats";

const AppContent: React.FC = () => {
  const [view, setView] = useState<ViewMode>("tree");
  const [showAddForm, setShowAddForm] = useState(false);
  const { t, lang, setLang } = useI18n();
  const { user, isEditor, logout } = useAuth();
  const {
    people,
    marriages,
    selectPerson,
    requestMapFlyTo,
    conflict,
    reloadTree,
    trees,
    currentTreeId,
    currentTreeName,
    switchTree,
    createTree,
    deleteTree,
    renameTree,
    loadingTree,
  } = useFamily();
  const reviewCount = people.filter((p) => p.review).length;
  const issues = useMemo(() => findIssues(people, marriages), [people, marriages]);

  // Show a person picked from the search box or the list of inconsistencies
  const showPerson = useCallback(
    (id: string) => {
      selectPerson(id);
      if (view === "map") requestMapFlyTo(id);
      else setView("tree");
    },
    [view, selectPerson, requestMapFlyTo]
  );
  const [selectorOpen, setSelectorOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNewTree = async () => {
    const name = prompt(t("app.promptNewTree"));
    if (!name?.trim()) return;
    await createTree(name.trim());
    setSelectorOpen(false);
  };

  const handleRename = async (id: string, currentName: string) => {
    const name = prompt(t("app.promptRename"), currentName);
    if (!name?.trim() || name.trim() === currentName) return;
    await renameTree(id, name.trim());
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("app.confirmDelete", { name }))) return;
    await deleteTree(id);
    if (trees.length <= 1) setSelectorOpen(false);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__group">
          <span className="brand">
            <span className="brand__mark">🌳</span>
          </span>

          <div className="selector" ref={selectorRef}>
            <button
              className="selector__button"
              onClick={() => setSelectorOpen((v) => !v)}
              title={t("app.switchTree")}
            >
              <span className="selector__name">
                {currentTreeName || t("app.noTree")}
              </span>
              <span className="selector__caret">▼</span>
            </button>

            {selectorOpen && (
              <div className="menu">
                <div className="menu__header">{t("app.familyTrees")}</div>
                {trees.map((tr) => (
                  <div
                    key={tr.id}
                    className={
                      "menu__item" +
                      (tr.id === currentTreeId ? " menu__item--active" : "")
                    }
                  >
                    <button
                      className="menu__pick"
                      onClick={() => {
                        switchTree(tr.id);
                        setSelectorOpen(false);
                      }}
                    >
                      <span style={{ fontWeight: tr.id === currentTreeId ? 700 : 500 }}>
                        {tr.name}
                      </span>
                      <span className="menu__count">
                        {tr.peopleCount} {t("app.people")}
                      </span>
                    </button>
                    {isEditor && (
                      <div style={{ display: "flex", gap: 2 }}>
                        <button
                          className="btn btn--ghost btn--icon"
                          title={t("app.rename")}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRename(tr.id, tr.name);
                          }}
                        >
                          ✏️
                        </button>
                        {trees.length > 1 && (
                          <button
                            className="btn btn--ghost btn--icon"
                            title={t("app.delete")}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(tr.id, tr.name);
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {isEditor && (
                  <button className="menu__new" onClick={handleNewTree}>
                    {t("app.newTree")}
                  </button>
                )}
              </div>
            )}
          </div>

          <span className="chip">
            {people.length} {t("app.people")}
          </span>
          {reviewCount > 0 && (
            <span className="chip chip--review">
              {t("review.pending", { n: String(reviewCount) })}
            </span>
          )}
          <IssuesMenu issues={issues} onPick={showPerson} />
        </div>

        <SearchBox onPick={showPerson} />

        <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="tabs">
            <button
              className={"tab" + (view === "tree" ? " tab--active" : "")}
              onClick={() => setView("tree")}
            >
              {t("app.tree")}
            </button>
            <button
              className={"tab" + (view === "map" ? " tab--active" : "")}
              onClick={() => setView("map")}
            >
              {t("app.map")}
            </button>
            <button
              className={"tab" + (view === "stats" ? " tab--active" : "")}
              onClick={() => {
                // the detail panel would cover the figures
                selectPerson(null);
                setView("stats");
              }}
            >
              {t("app.stats")}
            </button>
          </div>

          {isEditor && (
            <button
              className="btn btn--primary"
              onClick={() => setShowAddForm(true)}
            >
              {t("app.addPerson")}
            </button>
          )}

          <LangSwitcher lang={lang} setLang={setLang} />

          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={"chip " + (isEditor ? "chip--role" : "chip--viewer")}>
                {isEditor ? t("app.roleEditor") : t("app.roleViewer")}
              </span>
              <button
                className="btn btn--sm"
                onClick={logout}
                title={t("app.logout")}
              >
                {t("app.logout")}
              </button>
            </div>
          )}
        </nav>
      </header>

      {conflict && (
        <div className="conflict" role="alert">
          <span>{t("app.conflict")}</span>
          <button className="btn btn--sm" onClick={reloadTree}>
            {t("app.reload")}
          </button>
        </div>
      )}

      <main className="app__main">
        {loadingTree ? (
          <div className="app__loading">{t("app.loadingTree")}</div>
        ) : (
          <>
            {view === "tree" && <TreeView />}
            {view === "map" && <MapView />}
            {view === "stats" && <StatsView />}
            <DetailPanel />
          </>
        )}
      </main>

      {showAddForm && <AddPersonForm onClose={() => setShowAddForm(false)} />}
    </div>
  );
};

const AuthGate: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="app__loading" style={{ height: "100vh" }}>…</div>;
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

const LangSwitcher: React.FC<{ lang: Lang; setLang: (l: Lang) => void }> = ({
  lang,
  setLang,
}) => (
  <div className="langswitch">
    <button
      aria-pressed={lang === "fr"}
      onClick={() => setLang("fr")}
      title="Français"
    >
      🇫🇷
    </button>
    <button
      aria-pressed={lang === "en"}
      onClick={() => setLang("en")}
      title="English"
    >
      🇬🇧
    </button>
  </div>
);

export default App;
