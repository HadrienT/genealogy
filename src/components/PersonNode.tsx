import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PersonNodeData } from "../utils/treeLayout";

const genderClass: Record<string, string> = {
  male: "pnode--male",
  female: "pnode--female",
  other: "pnode--other",
};

const PersonNode = ({ data }: NodeProps) => {
  const d = data as PersonNodeData;
  const cls = [
    "pnode",
    genderClass[d.gender ?? ""] ?? "",
    d.selected ? "pnode--selected" : "",
    d.deceased ? "pnode--deceased" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      <Handle type="target" position={Position.Top} id="t" />
      {d.person.photo && (
        <img className="pnode__portrait" src={d.person.photo} alt="" />
      )}
      <div className="pnode__name">
        {d.name}
        {d.maiden && <span className="pnode__maiden"> · née {d.maiden}</span>}
      </div>
      {d.lifespan && <div className="pnode__dates">{d.lifespan}</div>}
      {d.birthPlace && <div className="pnode__place">{d.birthPlace}</div>}
      <Handle type="source" position={Position.Bottom} id="b" />
    </div>
  );
};

export default memo(PersonNode);
