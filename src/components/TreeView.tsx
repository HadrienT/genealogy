import React, { useMemo, useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
} from "@xyflow/react";
import { useI18n } from "../hooks/useI18n";
import { useAuth } from "../hooks/useAuth";
import "@xyflow/react/dist/style.css";

import { useFamily } from "../hooks/useFamily";
import { buildTreeLayout } from "../utils/treeLayout";
import PersonNode from "./PersonNode";
import JunctionNode from "./JunctionNode";
import MarriageEdge from "./MarriageEdge";
import AddPersonForm from "./AddPersonForm";

const nodeTypes = { personNode: PersonNode, junctionNode: JunctionNode };
const edgeTypes = { marriageEdge: MarriageEdge };

const TreeView: React.FC = () => {
  const { people, selectPerson, marriages, getPersonById, requestEditPerson } = useFamily();
  const { t } = useI18n();
  const { isEditor } = useAuth();

  // Multi-selection for context menu (up to 2 person nodes)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  // Add-child form
  const [showAddChild, setShowAddChild] = useState(false);
  // Add-parent form
  const [showAddParent, setShowAddParent] = useState(false);
  const [addParentConfig, setAddParentConfig] = useState<{
    childId: string;
    partnerIds: string[];
  } | null>(null);

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildTreeLayout(people, marriages),
    [people, marriages]
  );

  // Augment nodes with selection state
  const nodesWithSelection = useMemo(
    () =>
      layoutNodes.map((n) => ({
        ...n,
        data: { ...n.data, selected: selectedIds.includes(n.id) },
      })),
    [layoutNodes, selectedIds]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithSelection);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  // Sync ReactFlow internal state when the family data or selection changes
  useEffect(() => {
    setNodes(nodesWithSelection);
    setEdges(layoutEdges);
  }, [nodesWithSelection, layoutEdges, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      // Only operate on person nodes, not junction nodes
      if (node.type !== "personNode") return;

      const nativeEvent = event as unknown as MouseEvent;
      if (nativeEvent.ctrlKey || nativeEvent.metaKey || nativeEvent.shiftKey) {
        // Multi-select: toggle this node in the selection (max 2)
        setSelectedIds((prev) => {
          if (prev.includes(node.id)) {
            return prev.filter((id) => id !== node.id);
          }
          if (prev.length >= 2) {
            // Replace the oldest selection
            return [prev[1], node.id];
          }
          return [...prev, node.id];
        });
      } else {
        // Single click: select this node and open detail panel
        setSelectedIds([node.id]);
        selectPerson(node.id);
      }
      // Close context menu on any click
      setContextMenu(null);
    },
    [selectPerson]
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type !== "personNode") return;
      selectPerson(node.id);
      if (isEditor) requestEditPerson(node.id);
    },
    [selectPerson, requestEditPerson, isEditor]
  );

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      if (node.type !== "personNode") return;
      if (!isEditor) return;
      event.preventDefault();

      // If right-clicked node isn't in selection, select it
      setSelectedIds((prev) => {
        if (prev.includes(node.id)) return prev;
        return [node.id];
      });

      setContextMenu({
        x: (event as unknown as MouseEvent).clientX,
        y: (event as unknown as MouseEvent).clientY,
      });
    },
    []
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

  // Build label for context menu
  const selectedNames = selectedIds
    .map((id) => {
      const p = getPersonById(id);
      return p
        ? [p.firstName, p.lastName].filter(Boolean).join(" ") || p.id
        : id;
    })
    .join(" & ");

  // How many parents does the single-selected person have?
  const singleSelected = selectedIds.length === 1 ? getPersonById(selectedIds[0]) : null;
  const parentCount = singleSelected ? (singleSelected.parentIds ?? []).length : 0;

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{ animated: false }}
      >
        <Background gap={20} size={1} color="#e2e8f0" />
        <Controls
          style={{
            background: "white",
            borderRadius: 8,
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}
        />
        <MiniMap
          nodeColor={(node) => {
            const gender = (node.data as { gender?: string }).gender;
            if (gender === "male") return "#3b82f6";
            if (gender === "female") return "#ec4899";
            return "#94a3b8";
          }}
          style={{ borderRadius: 8 }}
        />
      </ReactFlow>

      {/* Context menu */}
      {contextMenu && selectedIds.length > 0 && (
        <div
          style={{
            ...contextMenuStyle,
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div style={contextMenuHeaderStyle}>
            {selectedNames}
          </div>
          <button
            onClick={handleAddChild}
            style={contextMenuItemStyle}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "#f1f5f9")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            {t("tree.addChild")}
          </button>
          {selectedIds.length === 1 && (
            <button
              onClick={handleAddParent}
              disabled={parentCount >= 2}
              style={{
                ...contextMenuItemStyle,
                ...(parentCount >= 2
                  ? { color: "#cbd5e1", cursor: "not-allowed" }
                  : {}),
              }}
              onMouseEnter={(e) => {
                if (parentCount < 2) e.currentTarget.style.background = "#f1f5f9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              {t("tree.addParent")}{parentCount === 1 ? t("tree.partnerLink") : parentCount >= 2 ? t("tree.maxReached") : ""}
            </button>
          )}
        </div>
      )}

      {/* Add child form */}
      {showAddChild && (
        <AddPersonForm
          onClose={() => {
            setShowAddChild(false);
            setSelectedIds([]);
          }}
          initialParentIds={selectedIds}
        />
      )}

      {/* Add parent form */}
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

      {/* Legend */}
      <div style={legendStyle}>
        <div style={{ fontWeight: 600, fontSize: 12, color: "#475569", marginBottom: 8 }}>{t("tree.legend")}</div>
        <div style={legendRowStyle}>
          <span style={{ ...legendSwatchStyle, background: "#dbeafe", border: "2px solid #3b82f6" }} />
          <span style={legendLabelStyle}>{t("tree.male")}</span>
        </div>
        <div style={legendRowStyle}>
          <span style={{ ...legendSwatchStyle, background: "#fce7f3", border: "2px solid #ec4899" }} />
          <span style={legendLabelStyle}>{t("tree.female")}</span>
        </div>
        <div style={{ ...legendRowStyle, marginTop: 4 }}>
          <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#64748b" strokeWidth="2" /></svg>
          <span style={legendLabelStyle}>{t("tree.parentChild")}</span>
        </div>
        <div style={legendRowStyle}>
          <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" /></svg>
          <span style={legendLabelStyle}>{t("tree.siblings")}</span>
        </div>
        <div style={legendRowStyle}>
          <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#e11d48" strokeWidth="2" strokeDasharray="6 3" /></svg>
          <span style={legendLabelStyle}>{t("tree.partnerMarriage")}</span>
        </div>
      </div>
    </div>
  );
};

const legendStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: 16,
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "10px 14px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  zIndex: 10,
  fontFamily: "'Inter', system-ui, sans-serif",
};

const legendRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 4,
};

const legendSwatchStyle: React.CSSProperties = {
  display: "inline-block",
  width: 16,
  height: 16,
  borderRadius: 4,
};

const legendLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#475569",
};

const contextMenuStyle: React.CSSProperties = {
  position: "fixed",
  background: "white",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  zIndex: 2000,
  minWidth: 180,
  overflow: "hidden",
  fontFamily: "'Inter', system-ui, sans-serif",
};

const contextMenuHeaderStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  borderBottom: "1px solid #f1f5f9",
  textOverflow: "ellipsis",
  overflow: "hidden",
  whiteSpace: "nowrap",
};

const contextMenuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "8px 12px",
  background: "transparent",
  border: "none",
  textAlign: "left",
  cursor: "pointer",
  fontSize: 13,
  color: "#334155",
  fontFamily: "inherit",
};

export default TreeView;
