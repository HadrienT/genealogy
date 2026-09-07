import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { UnionNodeData } from "../utils/treeLayout";

/**
 * A small knot where a couple's lines meet before dropping to their children.
 * For a married couple it also carries a discreet date/place tag.
 */
const UnionNode = ({ data }: NodeProps) => {
  const d = data as UnionNodeData;
  const hasTag = d.isCouple && (d.tagDate || d.tagPlace);

  return (
    <div className="unode">
      <Handle type="target" position={Position.Top} id="t" />
      {hasTag && (
        <div className="unode__tag">
          {d.tagDate && <div>💍 {d.tagDate}</div>}
          {d.tagPlace && <div>{d.tagPlace}</div>}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} id="b" />
    </div>
  );
};

export default memo(UnionNode);
