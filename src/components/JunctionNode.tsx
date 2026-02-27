import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

/**
 * An invisible 1×1 px node used as a junction point
 * for the parent→children connector lines.
 */
const JunctionNode: React.FC<NodeProps> = () => (
  <div
    style={{
      width: 1,
      height: 1,
      background: "transparent",
      pointerEvents: "none",
    }}
  >
    <Handle
      type="target"
      position={Position.Top}
      style={{ opacity: 0, pointerEvents: "none" }}
    />
    <Handle
      type="source"
      position={Position.Bottom}
      style={{ opacity: 0, pointerEvents: "none" }}
    />
    <Handle
      type="source"
      position={Position.Left}
      id="left"
      style={{ opacity: 0, pointerEvents: "none" }}
    />
    <Handle
      type="source"
      position={Position.Right}
      id="right"
      style={{ opacity: 0, pointerEvents: "none" }}
    />
  </div>
);

export default memo(JunctionNode);
