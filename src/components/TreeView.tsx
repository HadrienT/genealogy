import React, { useMemo, useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useI18n } from "../hooks/useI18n";
import { useAuth } from "../hooks/useAuth";
import { useFamily } from "../hooks/useFamily";
import { buildTreeLayout, NODE_W, NODE_H, type PersonNodeData } from "../utils/treeLayout";
import PersonNode from "./PersonNode";
import UnionNode from "./UnionNode";
import AddPersonForm from "./AddPersonForm";

const nodeTypes = { person: PersonNode, union: UnionNode };

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

  // Center the canvas on a person selected from outside it (detail panel
  // links, "next to review"), but not on plain clicks inside the canvas.
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const clickedInCanvas = useRef(false);
  useEffect(() => {
    if (!rf || !selectedPersonId) return;
    if (clickedInCanvas.current) {
      clickedInCanvas.current = false;
      return;
    }
    const n = rf.getNode(selectedPersonId);
    if (!n) return;
    rf.setCenter(n.position.x + NODE_W / 2, n.position.y + NODE_H / 2, {
      zoom: Math.max(rf.getZoom(), 0.9),
      duration: 400,
    });
  }, [rf, selectedPersonId]);

  const goNextReview = useCallback(() => {
    const i = reviewIds.indexOf(selectedPersonId ?? "");
    const id = reviewIds[(i + 1) % reviewIds.length];
    setSelectedIds([id]);
    selectPerson(id);
  }, [reviewIds, selectedPersonId, selectPerson]);

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildTreeLayout(people, marriages, months),
    [people, marriages, months]
  );

  const nodesWithSelection = useMemo(
    () =>
      layoutNodes.map((n) =>
        n.type === "person"
          ? {
              ...n,
              data: {
                ...(n.data as PersonNodeData),
                selected: selectedIds.includes(n.id),
              },
            }
          : n
      ),
    [layoutNodes, selectedIds]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithSelection);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => {
    setNodes(nodesWithSelection);
    setEdges(layoutEdges);
  }, [nodesWithSelection, layoutEdges, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      if (node.type !== "person") return;
      const native = event as unknown as MouseEvent;
      if (native.ctrlKey || native.metaKey || native.shiftKey) {
        setSelectedIds((prev) => {
          if (prev.includes(node.id)) return prev.filter((id) => id !== node.id);
          if (prev.length >= 2) return [prev[1], node.id];
          return [...prev, node.id];
        });
      } else {
        setSelectedIds([node.id]);
        clickedInCanvas.current = node.id !== selectedPersonId;
        selectPerson(node.id);
      }
      setContextMenu(null);
    },
    [selectPerson, selectedPersonId]
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type !== "person") return;
      selectPerson(node.id);
      if (isEditor) requestEditPerson(node.id);
    },
    [selectPerson, requestEditPerson, isEditor]
  );

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      if (node.type !== "person" || !isEditor) return;
      event.preventDefault();
      setSelectedIds((prev) => (prev.includes(node.id) ? prev : [node.id]));
      const e = event as unknown as MouseEvent;
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [isEditor]
  );

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

  const selectedNames = selectedIds
    .map((id) => {
      const p = getPersonById(id);
      return p
        ? [p.firstName, p.lastName].filter(Boolean).join(" ") || p.id
        : id;
    })
    .join(" & ");

  const singleSelected =
    selectedIds.length === 1 ? getPersonById(selectedIds[0]) : null;
  const parentCount = singleSelected
    ? (singleSelected.parentIds ?? []).length
    : 0;

  return (
    <div className="tree-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={handlePaneClick}
        onInit={setRf}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={22} size={1.5} color="rgba(120,96,58,0.14)" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(243,234,214,0.6)"
          nodeColor={(node) => {
            if (node.type === "union") return "#9c3b4e";
            const r = (node.data as PersonNodeData).review;
            if (r === "new") return "#b1832f";
            if (r === "updated") return "#3f6b4c";
            if (r === "conflict") return "#a63a2b";
            const g = (node.data as { gender?: string }).gender;
            if (g === "male") return "#3c6478";
            if (g === "female") return "#9c3b4e";
            if (g === "other") return "#b1832f";
            return "#8a7a5f";
          }}
        />
      </ReactFlow>

      {hasReview && (
        <button className="btn btn--primary review-next" onClick={goNextReview}>
          {t("review.next", { n: String(reviewIds.length) })}
        </button>
      )}

      {contextMenu && selectedIds.length > 0 && (
        <div
          className="ctxmenu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="ctxmenu__head">{selectedNames}</div>
          <button className="ctxmenu__item" onClick={handleAddChild}>
            {t("tree.addChild")}
          </button>
          {selectedIds.length === 1 && (
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
