import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useFamily } from "../hooks/useFamily";
import { formatDate } from "../utils/formatDate";
import type { Person } from "../types/person";

// Fix default marker icons (Leaflet + bundlers issue)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ── Map filter flags ─────────────────────────────────────

// ── Pin type for each marker entry ───────────────────────
interface PinEntry {
  person: Person;
  type: "birth" | "death";
  lat: number;
  lng: number;
}

// ── Helper: colored pin icon (classic marker shape) ──────
function makeColorIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="12.5" cy="12.5" r="5" fill="#fff" opacity=".85"/>
    </svg>`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
}

function makeBadgeIcon(color: string, count: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:25px;height:41px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
        <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
        <circle cx="12.5" cy="12.5" r="5" fill="#fff" opacity=".85"/>
      </svg>
      <span style="
        position:absolute;top:-6px;right:-8px;
        background:#1e293b;color:#fff;
        font-size:11px;font-weight:700;
        min-width:18px;height:18px;line-height:18px;
        text-align:center;border-radius:9px;
        padding:0 4px;box-shadow:0 1px 3px rgba(0,0,0,.4);
        font-family:'Inter',system-ui,sans-serif;
      ">${count}</span>
    </div>`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
}

const BIRTH_COLOR = "#3b82f6"; // blue
const DEATH_COLOR = "#ef4444"; // red
const BOTH_COLOR = "#8b5cf6";  // purple (mixed)

// ── Group pins whose coordinates are very close ──────────
interface LocationGroup {
  key: string;
  lat: number;
  lng: number;
  pins: PinEntry[];
}

function groupPins(pins: PinEntry[]): LocationGroup[] {
  const precision = 3; // ~110 m
  const map = new Map<string, LocationGroup>();

  for (const pin of pins) {
    const lat = Number(pin.lat.toFixed(precision));
    const lng = Number(pin.lng.toFixed(precision));
    const key = `${lat},${lng}`;
    if (!map.has(key)) map.set(key, { key, lat, lng, pins: [] });
    map.get(key)!.pins.push(pin);
  }
  return Array.from(map.values());
}

function groupColor(pins: PinEntry[]): string {
  const hasBirth = pins.some((p) => p.type === "birth");
  const hasDeath = pins.some((p) => p.type === "death");
  if (hasBirth && hasDeath) return BOTH_COLOR;
  return hasBirth ? BIRTH_COLOR : DEATH_COLOR;
}

// ── Popup entry ──────────────────────────────────────────
const PinPopupEntry: React.FC<{
  pin: PinEntry;
  onClick: () => void;
  showDivider: boolean;
  showType: boolean;
}> = ({ pin, onClick, showDivider, showType }) => {
  const p = pin.person;
  const color = pin.type === "birth" ? BIRTH_COLOR : DEATH_COLOR;
  const dateStr =
    pin.type === "birth"
      ? p.birthDate
        ? formatDate(p.birthDate)
        : undefined
      : p.deathDate
        ? formatDate(p.deathDate)
        : undefined;

  return (
    <div
      style={{
        padding: "5px 0",
        borderBottom: showDivider ? "1px solid #e2e8f0" : "none",
        cursor: "pointer",
      }}
      onClick={onClick}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {showType && (
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
              flexShrink: 0,
            }}
          />
        )}
        <strong style={{ color: "#1e293b", fontSize: 13 }}>
          {p.firstName} {p.lastName}
        </strong>
      </div>
      {dateStr && (
        <div style={{ fontSize: 11, color: "#64748b", marginLeft: showType ? 14 : 0 }}>
          {pin.type === "birth" ? "Born" : "Died"}: {dateStr}
        </div>
      )}
    </div>
  );
};

/**
 * Handles flying to a target marker and opening its popup.
 */
const FlyToHandler: React.FC<{
  markerRefs: React.MutableRefObject<Record<string, L.Marker>>;
  personToGroup: Map<string, string>;
}> = ({ markerRefs, personToGroup }) => {
  const map = useMap();
  const { mapFlyTarget, clearMapFlyTarget } = useFamily();

  useEffect(() => {
    if (!mapFlyTarget) return;

    const groupKey = personToGroup.get(mapFlyTarget) ?? mapFlyTarget;
    const marker = markerRefs.current[groupKey];
    if (!marker) {
      clearMapFlyTarget();
      return;
    }

    map.closePopup();
    const targetLatLng = marker.getLatLng();
    const currentCenter = map.getCenter();
    const distance = currentCenter.distanceTo(targetLatLng);

    if (distance < 100) {
      setTimeout(() => {
        marker.openPopup();
        clearMapFlyTarget();
      }, 50);
      return;
    }

    map.flyTo(targetLatLng, Math.max(map.getZoom(), 8), { duration: 0.6 });

    const onMoveEnd = () => {
      map.off("moveend", onMoveEnd);
      setTimeout(() => {
        marker.openPopup();
        clearMapFlyTarget();
      }, 100);
    };
    map.on("moveend", onMoveEnd);

    const safetyTimer = setTimeout(() => {
      map.off("moveend", onMoveEnd);
      marker.openPopup();
      clearMapFlyTarget();
    }, 2000);

    return () => {
      clearTimeout(safetyTimer);
      map.off("moveend", onMoveEnd);
    };
  }, [mapFlyTarget, map, markerRefs, personToGroup, clearMapFlyTarget]);

  return null;
};

/** Deselect person when clicking on the map background */
const MapClickDeselect: React.FC = () => {
  const { selectPerson } = useFamily();
  useMapEvents({
    click: () => selectPerson(null),
  });
  return null;
};

/** Extract the year from a date string ("1990", "1990-07", "1990-07-22") */
function extractYear(dateStr?: string): number | null {
  if (!dateStr) return null;
  const y = parseInt(dateStr.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

/** Inner component that renders markers based on filters */
const MapMarkers: React.FC<{ showBirth: boolean; showDeath: boolean; maxYear: number | null }> = ({ showBirth, showDeath, maxYear }) => {
  const { people, selectPerson } = useFamily();
  const markerRefs = useRef<Record<string, L.Marker>>({});

  // Build pins based on current filters
  const pins = useMemo(() => {
    const result: PinEntry[] = [];
    for (const p of people) {
      // Timeline filter: only include person if born on or before maxYear
      if (maxYear !== null) {
        const by = extractYear(p.birthDate);
        if (by === null || by > maxYear) continue;
      }
      if (showBirth && p.birthCoordinates) {
        result.push({
          person: p,
          type: "birth",
          lat: p.birthCoordinates.lat,
          lng: p.birthCoordinates.lng,
        });
      }
      if (showDeath && p.deathCoordinates) {
        result.push({
          person: p,
          type: "death",
          lat: p.deathCoordinates.lat,
          lng: p.deathCoordinates.lng,
        });
      }
    }
    return result;
  }, [people, showBirth, showDeath, maxYear]);

  const groups = useMemo(() => groupPins(pins), [pins]);

  const personToGroup = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) {
      for (const pin of g.pins) m.set(pin.person.id, g.key);
    }
    return m;
  }, [groups]);

  return (
    <>
      <MapClickDeselect />
      <FlyToHandler markerRefs={markerRefs} personToGroup={personToGroup} />
      {groups.map((g) => {
        const isSingle = g.pins.length === 1;
        const color = groupColor(g.pins);
        const showType = showBirth && showDeath;

        // Location label for multi-person header
        const firstPin = g.pins[0];
        const cityLabel =
          firstPin.type === "birth"
            ? firstPin.person.birthCity || firstPin.person.birthPlace?.split(",")[0]
            : firstPin.person.deathCity || firstPin.person.deathPlace?.split(",")[0];

        return (
          <Marker
            key={g.key}
            position={[g.lat, g.lng]}
            icon={
              isSingle
                ? makeColorIcon(color)
                : makeBadgeIcon(color, g.pins.length)
            }
            ref={(ref) => {
              if (ref) markerRefs.current[g.key] = ref;
            }}
            eventHandlers={
              isSingle
                ? { click: () => selectPerson(firstPin.person.id) }
                : {}
            }
          >
            <Popup>
              <div
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  minWidth: 180,
                  maxHeight: 280,
                  overflowY: g.pins.length > 5 ? "auto" : "visible",
                }}
              >
                {isSingle ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {showType && (
                        <span
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: color,
                          }}
                        />
                      )}
                      <strong>
                        {firstPin.person.firstName} {firstPin.person.lastName}
                      </strong>
                    </div>
                    {firstPin.type === "birth" && firstPin.person.birthDate && (
                      <div style={{ fontSize: 12 }}>
                        Born: {formatDate(firstPin.person.birthDate)}
                      </div>
                    )}
                    {firstPin.type === "death" && firstPin.person.deathDate && (
                      <div style={{ fontSize: 12 }}>
                        Died: {formatDate(firstPin.person.deathDate)}
                      </div>
                    )}
                    {firstPin.type === "birth" && firstPin.person.birthPlace && (
                      <div style={{ fontSize: 12 }}>{firstPin.person.birthPlace}</div>
                    )}
                    {firstPin.type === "death" && firstPin.person.deathPlace && (
                      <div style={{ fontSize: 12 }}>{firstPin.person.deathPlace}</div>
                    )}
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        marginBottom: 4,
                        fontWeight: 600,
                      }}
                    >
                      {cityLabel || "This location"} — {g.pins.length} entries
                    </div>
                    {g.pins.map((pin, idx) => (
                      <PinPopupEntry
                        key={`${pin.person.id}-${pin.type}`}
                        pin={pin}
                        onClick={() => selectPerson(pin.person.id)}
                        showDivider={idx < g.pins.length - 1}
                        showType={showType}
                      />
                    ))}
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

// ── Toggle bar styles ────────────────────────────────────
const toggleBarStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  zIndex: 1000,
  display: "flex",
  background: "#fff",
  borderRadius: 8,
  boxShadow: "0 2px 8px rgba(0,0,0,.15)",
  overflow: "hidden",
  border: "1px solid #e2e8f0",
};

function toggleBtnStyle(active: boolean, color: string): React.CSSProperties {
  return {
    padding: "6px 16px",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'Inter', system-ui, sans-serif",
    cursor: "pointer",
    border: "none",
    borderRight: "1px solid #e2e8f0",
    background: active ? color : "#fff",
    color: active ? "#fff" : "#475569",
    transition: "all .15s",
    display: "flex",
    alignItems: "center",
    gap: 6,
  };
}

// ── Timeline slider styles ───────────────────────────────
const timelineBarStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: 60,
  right: 60,
  zIndex: 1000,
  background: "rgba(255,255,255,.92)",
  backdropFilter: "blur(4px)",
  borderRadius: 10,
  boxShadow: "0 2px 10px rgba(0,0,0,.15)",
  padding: "8px 20px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  fontFamily: "'Inter', system-ui, sans-serif",
};

const MapView: React.FC = () => {
  const { people } = useFamily();
  const [showBirth, setShowBirth] = useState(true);
  const [showDeath, setShowDeath] = useState(false);

  // ── Animation state ──────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepSize, setStepSize] = useState(5);
  const [intervalMs, setIntervalMs] = useState(1000);
  const [showSettings, setShowSettings] = useState(false);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Collect all coordinates for centering
  const allCoords = useMemo(() => {
    const coords: { lat: number; lng: number }[] = [];
    for (const p of people) {
      if (p.birthCoordinates) coords.push(p.birthCoordinates);
      if (p.deathCoordinates) coords.push(p.deathCoordinates);
    }
    return coords;
  }, [people]);

  // Compute birth year range for the timeline slider
  const { minYear, maxYear: dataMaxYear } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of people) {
      const y = extractYear(p.birthDate);
      if (y !== null) {
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
    }
    return lo <= hi ? { minYear: lo, maxYear: hi } : { minYear: null, maxYear: null };
  }, [people]);

  const [timelineYear, setTimelineYear] = useState<number | null>(null);
  // When data range changes (tree switch), reset slider to max
  useEffect(() => {
    setTimelineYear(dataMaxYear);
  }, [dataMaxYear]);

  // ── Animation logic ──────────────────────────────────
  const stopAnimation = useCallback(() => {
    if (animRef.current) {
      clearInterval(animRef.current);
      animRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startAnimation = useCallback(() => {
    if (minYear === null || dataMaxYear === null) return;
    // If already at or past the end, restart from beginning
    setTimelineYear((prev) => {
      const start = (prev === null || prev >= dataMaxYear) ? minYear : prev;
      // We set the year immediately to the starting point
      return start;
    });
    setIsPlaying(true);
  }, [minYear, dataMaxYear]);

  // Manage the interval when isPlaying changes
  useEffect(() => {
    if (!isPlaying || minYear === null || dataMaxYear === null) {
      if (animRef.current) {
        clearInterval(animRef.current);
        animRef.current = null;
      }
      return;
    }
    animRef.current = setInterval(() => {
      setTimelineYear((prev) => {
        const cur = prev ?? minYear;
        const next = cur + stepSize;
        if (next >= dataMaxYear) {
          // Reached the end — stop
          setTimeout(() => stopAnimation(), 0);
          return dataMaxYear;
        }
        return next;
      });
    }, intervalMs);
    return () => {
      if (animRef.current) {
        clearInterval(animRef.current);
        animRef.current = null;
      }
    };
  }, [isPlaying, stepSize, intervalMs, minYear, dataMaxYear, stopAnimation]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopAnimation();
    } else {
      startAnimation();
    }
  }, [isPlaying, stopAnimation, startAnimation]);

  const resetTimeline = useCallback(() => {
    stopAnimation();
    setTimelineYear(dataMaxYear);
  }, [stopAnimation, dataMaxYear]);

  const center: [number, number] =
    allCoords.length > 0
      ? [
          allCoords.reduce((s, c) => s + c.lat, 0) / allCoords.length,
          allCoords.reduce((s, c) => s + c.lng, 0) / allCoords.length,
        ]
      : [46.6, 2.3];

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Toggle bar */}
      <div style={toggleBarStyle}>
        <button
          style={toggleBtnStyle(showBirth, BIRTH_COLOR)}
          onClick={() => setShowBirth((v) => !v)}
        >
          Birth
        </button>
        <button
          style={{ ...toggleBtnStyle(showDeath, DEATH_COLOR), borderRight: "none" }}
          onClick={() => setShowDeath((v) => !v)}
        >
          Death
        </button>
      </div>

      <MapContainer
        center={center}
        zoom={6}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapMarkers showBirth={showBirth} showDeath={showDeath} maxYear={timelineYear} />
      </MapContainer>

      {/* Timeline slider */}
      {minYear !== null && dataMaxYear !== null && (
        <div style={timelineBarStyle}>
          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            title={isPlaying ? "Pause" : "Play"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
              color: "#3b82f6",
              display: "flex",
              alignItems: "center",
            }}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          {/* Reset */}
          <button
            onClick={resetTimeline}
            title="Reset to end"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
              color: "#64748b",
              display: "flex",
              alignItems: "center",
            }}
          >
            ⏹
          </button>

          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>
            {minYear}
          </span>
          <input
            type="range"
            min={minYear}
            max={dataMaxYear}
            value={timelineYear ?? dataMaxYear}
            onChange={(e) => {
              stopAnimation();
              setTimelineYear(Number(e.target.value));
            }}
            style={{ flex: 1, cursor: "pointer", accentColor: "#3b82f6" }}
          />
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>
            {dataMaxYear}
          </span>
          <div
            style={{
              marginLeft: 4,
              background: "#3b82f6",
              color: "#fff",
              borderRadius: 6,
              padding: "2px 10px",
              fontSize: 13,
              fontWeight: 700,
              minWidth: 48,
              textAlign: "center",
            }}
          >
            {timelineYear ?? dataMaxYear}
          </div>

          {/* Settings gear */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowSettings((v) => !v)}
              title="Animation settings"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
                padding: 0,
                color: showSettings ? "#3b82f6" : "#94a3b8",
                display: "flex",
                alignItems: "center",
              }}
            >
              ⚙
            </button>

            {/* Settings popover */}
            {showSettings && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 10px)",
                  right: 0,
                  background: "#fff",
                  borderRadius: 10,
                  boxShadow: "0 4px 16px rgba(0,0,0,.18)",
                  padding: "14px 18px",
                  minWidth: 210,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  zIndex: 1001,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#1e293b" }}>
                  Animation Settings
                </div>
                {/* Step size */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "#475569" }}>
                  <span style={{ minWidth: 70 }}>Step (years)</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={stepSize}
                    onChange={(e) => setStepSize(Math.max(1, Number(e.target.value)))}
                    style={{
                      width: 56,
                      padding: "3px 6px",
                      borderRadius: 5,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  />
                </label>
                {/* Speed */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#475569" }}>
                  <span style={{ minWidth: 70 }}>Speed (ms)</span>
                  <input
                    type="number"
                    min={100}
                    max={5000}
                    step={100}
                    value={intervalMs}
                    onChange={(e) => setIntervalMs(Math.max(100, Number(e.target.value)))}
                    style={{
                      width: 56,
                      padding: "3px 6px",
                      borderRadius: 5,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
