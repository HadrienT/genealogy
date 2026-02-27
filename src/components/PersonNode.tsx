import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Person } from "../types/person";

interface PersonNodeData {
  label: string;
  lifespan: string;
  birthPlace: string;
  gender?: string;
  person: Person;
  [key: string]: unknown;
}

const genderColors: Record<string, { bg: string; border: string }> = {
  male: { bg: "#dbeafe", border: "#3b82f6" },
  female: { bg: "#fce7f3", border: "#ec4899" },
  other: { bg: "#f3e8ff", border: "#a855f7" },
};

const defaultColor = { bg: "#f1f5f9", border: "#94a3b8" };

const PersonNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as PersonNodeData;
  const colors = genderColors[d.gender ?? ""] ?? defaultColor;
  const isSelected = !!(d as Record<string, unknown>).selected;

  return (
    <div
      style={{
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: 10,
        padding: "10px 16px",
        minWidth: 160,
        textAlign: "center",
        cursor: "pointer",
        fontFamily: "'Inter', system-ui, sans-serif",
        boxShadow: isSelected
          ? `0 0 0 3px ${colors.border}44, 0 1px 4px rgba(0,0,0,0.08)`
          : "0 1px 4px rgba(0,0,0,0.08)",
        transition: "box-shadow 0.15s",
        outline: isSelected ? `2px solid ${colors.border}` : "none",
        outlineOffset: 2,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>
        {d.label}
      </div>
      {d.lifespan && (
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          {d.lifespan}
        </div>
      )}
      {d.birthPlace && (
        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
          {d.birthPlace}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle
        type="source"
        position={Position.Right}
        id="partner-right"
        style={{ opacity: 0 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="partner-left"
        style={{ opacity: 0 }}
      />
    </div>
  );
};

export default memo(PersonNode);
