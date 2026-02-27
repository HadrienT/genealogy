import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
} from "@xyflow/react";
import { formatDate } from "../utils/formatDate";
import { useI18n } from "../hooks/useI18n";

/**
 * Derive the French department number from a postcode.
 */
function deptFromPostcode(postcode: string): string | undefined {
  const trimmed = postcode.trim();
  if (trimmed.length < 2) return undefined;
  if (trimmed.startsWith("97") && trimmed.length >= 3) return trimmed.substring(0, 3);
  if (trimmed.startsWith("20")) {
    const num = parseInt(trimmed, 10);
    return num < 20200 ? "2A" : "2B";
  }
  return trimmed.substring(0, 2);
}

/** Format marriage place: France → "City (dept)", abroad → "City (Country)" */
function formatMarriagePlace(data: Record<string, unknown>): string | undefined {
  const displayName = data.marriagePlaceDisplay as string | undefined;
  const city = displayName || (data.marriageCity as string | undefined);
  const countryCode = data.marriageCountryCode as string | undefined;

  if (city && countryCode) {
    if (countryCode === "fr") {
      const deptCode = data.marriageDeptCode as string | undefined;
      if (deptCode) return `${city} (${deptCode})`;
      const postcode = data.marriagePostcode as string | undefined;
      const dept = postcode ? deptFromPostcode(postcode) : undefined;
      if (dept) return `${city} (${dept})`;
      const county = data.marriageCounty as string | undefined;
      if (county) return `${city} (${county})`;
      return city;
    }
    const country = (data.marriageCountry as string) || countryCode.toUpperCase();
    return `${city} (${country})`;
  }

  // Fallback: raw place, extract first segment
  const raw = data.marriagePlace as string | undefined;
  if (raw) {
    const firstComma = raw.indexOf(",");
    return firstComma > 0 ? raw.substring(0, firstComma).trim() : raw;
  }
  return undefined;
}

const MarriageEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  data,
}) => {
  const { months } = useI18n();
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const marriageDate = data?.marriageDate as string | undefined;
  const marriagePlace = data ? formatMarriagePlace(data as Record<string, unknown>) : undefined;
  const hasLabel = marriageDate || marriagePlace;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      {hasLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              background: "white",
              border: "1px solid #fda4af",
              borderRadius: 6,
              padding: "3px 8px",
              fontSize: 10,
              color: "#9f1239",
              fontFamily: "'Inter', system-ui, sans-serif",
              textAlign: "center",
              lineHeight: 1.4,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              whiteSpace: "nowrap",
            }}
            className="nodrag nopan"
          >
            {marriageDate && <div>💍 {formatDate(marriageDate, months)}</div>}
            {marriagePlace && (
              <div style={{ color: "#be123c" }}>{marriagePlace}</div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default MarriageEdge;
