import React, { useMemo, useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "../hooks/useI18n";
import { useAuth } from "../hooks/useAuth";
import { useFamily } from "../hooks/useFamily";
import { buildTreeLayout } from "../utils/treeLayout";
import {
  buildFamilyGraph,
  computeFold,
  defaultFocus,
  pathBetween,
  type FoldState,
} from "../utils/treeFold";
import TreeCanvas, { type TreeCanvasHandle } from "./TreeCanvas";
import AddPersonForm from "./AddPersonForm";

/** Ancestor generations shown above the focus person when the tree opens. */
const DEFAULT_GENS = 4;

const foldTo = (gens: number): FoldState => ({
  gens,
  expanded: new Set(),
  collapsed: new Set(),
  pinned: new Set(),
});

const TreeView: React.FC = () => {
  const {
    people,
    selectPerson,
    selectedPersonId,
    marriages,
    getPersonById,
    requestEditPerson,
  } = useFamily();
  const { t, months } = useI18n();
  const { isEditor } = useAuth();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(
    null
  );
  const [showAddChild, setShowAddChild] = useState(false);
  const [showAddParent, setShowAddParent] = useState(false);
  const [addParentConfig, setAddParentConfig] = useState<{
    childId: string;
    partnerIds: string[];
  } | null>(null);

  const reviewIds = useMemo(
    () => people.filter((p) => p.review).map((p) => p.id),
    [people]
  );
  const hasReview = reviewIds.length > 0;

  // ── What is on the canvas: a focus person and the folded branches ──
  const graph = useMemo(() => buildFamilyGraph(people), [people]);
  const [focusChoice, setFocusChoice] = useState<string | null>(null);
  const [fold, setFold] = useState<FoldState>(() => foldTo(DEFAULT_GENS));
  const focusId = useMemo(
    () => (focusChoice && graph.ids.has(focusChoice) ? focusChoice : defaultFocus(graph)),
    [graph, focusChoice]
  );
  const { visible, hiddenAncestors } = useMemo(
    () => computeFold(graph, focusId, fold),
    [graph, focusId, fold]
  );
  const layout = useMemo(
    () => buildTreeLayout(people, marriages, months, visible, hiddenAncestors),
    [people, marriages, months, visible, hiddenAncestors]
  );
  const showingAll = visible.size >= people.length;

  // A person selected while folded away (detail panel links, "next to
  // review", the map) is brought onto the canvas with the people linking
  // them to the focus person.
  const [seenSelection, setSeenSelection] = useState<string | null>(null);
  if (selectedPersonId !== seenSelection) {
    setSeenSelection(selectedPersonId);
    if (selectedPersonId && graph.ids.has(selectedPersonId) && !visible.has(selectedPersonId)) {
      const path = pathBetween(graph, focusId, selectedPersonId);
      setFold((f) => ({ ...f, pinned: new Set([...f.pinned, ...path]) }));
    }
  }

  // Center the canvas on a person selected from outside it, but not on plain
  // clicks inside the canvas.
  const canvas = useRef<TreeCanvasHandle>(null);
  const clickedInCanvas = useRef(false);
  useEffect(() => {
    if (!selectedPersonId) return;
    if (clickedInCanvas.current) {
      clickedInCanvas.current = false;
      return;
    }
    canvas.current?.centerOn(selectedPersonId);
  }, [selectedPersonId]);

  const goNextReview = useCallback(() => {
    const i = reviewIds.indexOf(selectedPersonId ?? "");
    const id = reviewIds[(i + 1) % reviewIds.length];
    setSelectedIds([id]);
    selectPerson(id);
  }, [reviewIds, selectedPersonId, selectPerson]);

  const toggleFold = useCallback(
    (id: string) => {
      const unfold = (layout.byId.get(id)?.hiddenAncestors ?? 0) > 0;
      setFold((f) => {
        const expanded = new Set(f.expanded);
        const collapsed = new Set(f.collapsed);
        (unfold ? expanded : collapsed).add(id);
        (unfold ? collapsed : expanded).delete(id);
        return { ...f, expanded, collapsed };
      });
      setContextMenu(null);
    },
    [layout]
  );

  const focusOn = useCallback((id: string | null) => {
    setFocusChoice(id);
    setFold(foldTo(DEFAULT_GENS));
    setContextMenu(null);
  }, []);

  const onPersonClick = useCallback(
    (id: string, multi: boolean) => {
      if (multi) {
        setSelectedIds((prev) => {
          if (prev.includes(id)) return prev.filter((other) => other !== id);
          if (prev.length >= 2) return [prev[1], id];
          return [...prev, id];
        });
      } else {
        setSelectedIds([id]);
        clickedInCanvas.current = id !== selectedPersonId;
        selectPerson(id);
      }
      setContextMenu(null);
    },
    [selectPerson, selectedPersonId]
  );

  const onPersonDoubleClick = useCallback(
    (id: string) => {
      selectPerson(id);
      if (isEditor) requestEditPerson(id);
    },
    [selectPerson, requestEditPerson, isEditor]
  );

  const onPersonContextMenu = useCallback((id: string, x: number, y: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [id]));
    setContextMenu({ x, y });
  }, []);

  const handleAddChild = useCallback(() => {
    setContextMenu(null);
    setShowAddChild(true);
  }, []);

  const handleAddParent = useCallback(() => {
    if (selectedIds.length !== 1) return;
    const person = getPersonById(selectedIds[0]);
    if (!person) return;
    const parentCount = (person.parentIds ?? []).length;
    if (parentCount >= 2) return;
    setAddParentConfig({
      childId: person.id,
      partnerIds: parentCount === 1 ? [...person.parentIds!] : [],
    });
    setContextMenu(null);
    setShowAddParent(true);
  }, [selectedIds, getPersonById]);

  const handlePaneClick = useCallback(() => {
    selectPerson(null);
    setSelectedIds([]);
    setContextMenu(null);
  }, [selectPerson]);

  const nameOf = (id: string) => {
    const p = getPersonById(id);
    return p ? [p.firstName, p.lastName].filter(Boolean).join(" ") || p.id : id;
  };
  const selectedNames = selectedIds.map(nameOf).join(" & ");

  const singleSelected =
    selectedIds.length === 1 ? getPersonById(selectedIds[0]) : null;
  const parentCount = singleSelected
    ? (singleSelected.parentIds ?? []).length
    : 0;

  return (
    <div className="tree-wrap">
      <TreeCanvas
        ref={canvas}
        layout={layout}
        selectedIds={selectedIds}
        homeKey={`${focusId}|${fold.gens}`}
        homeId={focusId}
        label={t("app.tree")}
        onPersonClick={onPersonClick}
        onPersonDoubleClick={onPersonDoubleClick}
        onPersonContextMenu={onPersonContextMenu}
        onPaneClick={handlePaneClick}
        onToggleFold={toggleFold}
      />

      <div className="tree-bar">
        {hasReview && (
          <button className="btn btn--primary" onClick={goNextReview}>
            {t("review.next", { n: String(reviewIds.length) })}
          </button>
        )}

        <div className="tree-bar__group floating">
          <span className="tree-bar__label">{t("tree.generations")}</span>
          <button
            className="tree-bar__btn"
            onClick={() => setFold(foldTo(fold.gens - 1))}
            disabled={fold.gens === Infinity || fold.gens <= 1}
            aria-label={t("tree.fewerGenerations")}
          >
            −
          </button>
          <span className="tree-bar__value">{fold.gens === Infinity ? "∞" : fold.gens}</span>
          <button
            className="tree-bar__btn"
            onClick={() => setFold(foldTo(fold.gens + 1))}
            disabled={fold.gens === Infinity || showingAll}
            aria-label={t("tree.moreGenerations")}
          >
            +
          </button>
          <button
            className="tree-bar__btn tree-bar__btn--text"
            onClick={() => setFold(foldTo(fold.gens === Infinity ? DEFAULT_GENS : Infinity))}
          >
            {fold.gens === Infinity ? t("tree.foldBack") : t("tree.showAll")}
          </button>
          <span className="tree-bar__count">
            {t("tree.shown", { n: String(visible.size), total: String(people.length) })}
          </span>
        </div>

        <div className="tree-bar__group floating">
          <button
            className="tree-bar__btn"
            onClick={() => canvas.current?.zoomBy(1 / 1.4)}
            title={t("tree.zoomOut")}
            aria-label={t("tree.zoomOut")}
          >
            −
          </button>
          <button
            className="tree-bar__btn"
            onClick={() => canvas.current?.zoomBy(1.4)}
            title={t("tree.zoomIn")}
            aria-label={t("tree.zoomIn")}
          >
            +
          </button>
          <button
            className="tree-bar__btn"
            onClick={() => canvas.current?.fit()}
            title={t("tree.fit")}
            aria-label={t("tree.fit")}
          >
            ⤢
          </button>
        </div>

        {focusChoice && focusChoice === focusId && (
          <div className="tree-bar__group floating">
            <span className="tree-bar__label">
              {t("tree.focusedOn", { name: nameOf(focusChoice) })}
            </span>
            <button
              className="tree-bar__btn"
              onClick={() => focusOn(null)}
              title={t("tree.focusReset")}
              aria-label={t("tree.focusReset")}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {contextMenu && selectedIds.length > 0 && (
        <div
          className="ctxmenu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="ctxmenu__head">{selectedNames}</div>
          {isEditor && (
            <button className="ctxmenu__item" onClick={handleAddChild}>
              {t("tree.addChild")}
            </button>
          )}
          {isEditor && selectedIds.length === 1 && (
            <button
              className="ctxmenu__item"
              onClick={handleAddParent}
              disabled={parentCount >= 2}
            >
              {t("tree.addParent")}
              {parentCount === 1
                ? t("tree.partnerLink")
                : parentCount >= 2
                  ? t("tree.maxReached")
                  : ""}
            </button>
          )}
          {selectedIds.length === 1 && (
            <button
              className="ctxmenu__item"
              onClick={() => focusOn(selectedIds[0])}
              disabled={selectedIds[0] === focusId}
            >
              {t("tree.focusHere")}
            </button>
          )}
        </div>
      )}

      {showAddChild && (
        <AddPersonForm
          onClose={() => {
            setShowAddChild(false);
            setSelectedIds([]);
          }}
          initialParentIds={selectedIds}
        />
      )}

      {showAddParent && addParentConfig && (
        <AddPersonForm
          onClose={() => {
            setShowAddParent(false);
            setAddParentConfig(null);
            setSelectedIds([]);
          }}
          initialChildIds={[addParentConfig.childId]}
          initialPartnerIds={addParentConfig.partnerIds}
        />
      )}

      <div className="legend floating">
        <div className="legend__title">{t("tree.legend")}</div>
        <div className="legend__row">
          <span
            className="legend__swatch"
            style={{ background: "var(--male-tint)", borderColor: "var(--male)" }}
          />
          {t("tree.male")}
        </div>
        <div className="legend__row">
          <span
            className="legend__swatch"
            style={{
              background: "var(--female-tint)",
              borderColor: "var(--female)",
            }}
          />
          {t("tree.female")}
        </div>
        <div className="legend__row">
          <svg width="26" height="10">
            <line x1="0" y1="5" x2="26" y2="5" stroke="#b79f76" strokeWidth="2" />
          </svg>
          {t("tree.parentChild")}
        </div>
        <div className="legend__row">
          <svg width="26" height="10">
            <line
              x1="0"
              y1="5"
              x2="26"
              y2="5"
              stroke="var(--wine)"
              strokeWidth="2"
              strokeDasharray="5 3"
            />
          </svg>
          {t("tree.partnerMarriage")}
        </div>
        <div className="legend__row">
          <span className="legend__chip">▲ 12</span>
          {t("tree.folded")}
        </div>
        {hasReview && (
          <>
            {(
              [
                ["var(--gold)", "tree.reviewNew"],
                ["var(--forest)", "tree.reviewUpdated"],
                ["var(--danger)", "tree.reviewConflict"],
              ] as const
            ).map(([color, key]) => (
              <div className="legend__row" key={key}>
                <span
                  className="legend__swatch"
                  style={{ background: "var(--card-raised)", borderColor: color, boxShadow: `0 0 6px ${color}` }}
                />
                {t(key)}
              </div>
            ))}
            <div className="legend__row">
              <span
                className="legend__swatch"
                style={{ borderStyle: "dashed", borderColor: "var(--gold)" }}
              />
              {t("tree.reviewUncertain")}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TreeView;
