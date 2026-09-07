import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useFamily } from "../hooks/useFamily";
import { formatDate } from "../utils/formatDate";
import type { Person } from "../types/person";
import { useI18n } from "../hooks/useI18n";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const BIRTH_COLOR = "#3c6478";
const DEATH_COLOR = "#a63a2b";
const BOTH_COLOR = "#7a5aa0";

interface PinEntry {
  person: Person;
  type: "birth" | "death";
  lat: number;
  lng: number;
}

function makeColorIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="${color}" stroke="#fdf8ec" stroke-width="1.5"/>
      <circle cx="12.5" cy="12.5" r="5" fill="#fdf8ec" opacity=".9"/>
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
        <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="${color}" stroke="#fdf8ec" stroke-width="1.5"/>
        <circle cx="12.5" cy="12.5" r="5" fill="#fdf8ec" opacity=".9"/>
      </svg>
      <span style="position:absolute;top:-6px;right:-8px;background:#33291d;color:#fdf8ec;font-size:11px;font-weight:700;min-width:18px;height:18px;line-height:18px;text-align:center;border-radius:9px;padding:0 4px;box-shadow:0 1px 3px rgba(0,0,0,.4);font-family:Inter,system-ui,sans-serif;">${count}</span>
    </div>`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
}

interface LocationGroup {
  key: string;
  lat: number;
  lng: number;
  pins: PinEntry[];
}

function groupPins(pins: PinEntry[]): LocationGroup[] {
  const precision = 3;
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

const PinPopupEntry: React.FC<{
  pin: PinEntry;
  onClick: () => void;
  showDivider: boolean;
  showType: boolean;
}> = ({ pin, onClick, showDivider, showType }) => {
  const { t, months } = useI18n();
  const p = pin.person;
  const color = pin.type === "birth" ? BIRTH_COLOR : DEATH_COLOR;
  const dateStr =
    pin.type === "birth"
      ? p.birthDate
        ? formatDate(p.birthDate, months)
        : undefined
      : p.deathDate
        ? formatDate(p.deathDate, months)
        : undefined;

  return (
    <div
      style={{
        padding: "5px 0",
        borderBottom: showDivider ? "1px solid var(--line)" : "none",
        cursor: "pointer",
      }}
      onClick={onClick}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {showType && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
              flexShrink: 0,
            }}
          />
        )}
        <strong style={{ fontFamily: "var(--font-serif)", fontSize: 13 }}>
          {p.firstName} {p.lastName}
        </strong>
      </div>
      {dateStr && (
        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginLeft: showType ? 14 : 0 }}>
          {pin.type === "birth" ? t("map.born") : t("map.died")}: {dateStr}
        </div>
      )}
    </div>
  );
};

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
    const distance = map.getCenter().distanceTo(targetLatLng);
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
    const safety = setTimeout(() => {
      map.off("moveend", onMoveEnd);
      marker.openPopup();
      clearMapFlyTarget();
    }, 2000);
    return () => {
      clearTimeout(safety);
      map.off("moveend", onMoveEnd);
    };
  }, [mapFlyTarget, map, markerRefs, personToGroup, clearMapFlyTarget]);

  return null;
};

const MapClickDeselect: React.FC = () => {
  const { selectPerson } = useFamily();
  useMapEvents({ click: () => selectPerson(null) });
  return null;
};

function extractYear(dateStr?: string): number | null {
  if (!dateStr) return null;
  const y = parseInt(dateStr.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

const MapMarkers: React.FC<{
  showBirth: boolean;
  showDeath: boolean;
  maxYear: number | null;
}> = ({ showBirth, showDeath, maxYear }) => {
  const { people, selectPerson } = useFamily();
  const { t, months } = useI18n();
  const markerRefs = useRef<Record<string, L.Marker>>({});

  const pins = useMemo(() => {
    const result: PinEntry[] = [];
    for (const p of people) {
      if (maxYear !== null) {
        const by = extractYear(p.birthDate);
        if (by === null || by > maxYear) continue;
      }
      if (showBirth && p.birthCoordinates) {
        result.push({ person: p, type: "birth", lat: p.birthCoordinates.lat, lng: p.birthCoordinates.lng });
      }
      if (showDeath && p.deathCoordinates) {
        result.push({ person: p, type: "death", lat: p.deathCoordinates.lat, lng: p.deathCoordinates.lng });
      }
    }
    return result;
  }, [people, showBirth, showDeath, maxYear]);

  const groups = useMemo(() => groupPins(pins), [pins]);

  const personToGroup = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) for (const pin of g.pins) m.set(pin.person.id, g.key);
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
        const firstPin = g.pins[0];
        const cityLabel =
          firstPin.type === "birth"
            ? firstPin.person.birthCity || firstPin.person.birthPlace?.split(",")[0]
            : firstPin.person.deathCity || firstPin.person.deathPlace?.split(",")[0];

        return (
          <Marker
            key={g.key}
            position={[g.lat, g.lng]}
            icon={isSingle ? makeColorIcon(color) : makeBadgeIcon(color, g.pins.length)}
            ref={(ref) => {
              if (ref) markerRefs.current[g.key] = ref;
            }}
            eventHandlers={isSingle ? { click: () => selectPerson(firstPin.person.id) } : {}}
          >
            <Popup>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  minWidth: 180,
                  maxHeight: 280,
                  overflowY: g.pins.length > 5 ? "auto" : "visible",
                }}
              >
                {isSingle ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {showType && (
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                      )}
                      <strong style={{ fontFamily: "var(--font-serif)" }}>
                        {firstPin.person.firstName} {firstPin.person.lastName}
                      </strong>
                    </div>
                    {firstPin.type === "birth" && firstPin.person.birthDate && (
                      <div style={{ fontSize: 12 }}>
                        {t("map.bornLabel")} {formatDate(firstPin.person.birthDate, months)}
                      </div>
                    )}
                    {firstPin.type === "death" && firstPin.person.deathDate && (
                      <div style={{ fontSize: 12 }}>
                        {t("map.diedLabel")} {formatDate(firstPin.person.deathDate, months)}
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
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4, fontWeight: 600 }}>
                      {cityLabel || t("map.thisLocation")} — {g.pins.length} {t("map.entries")}
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

const MapView: React.FC = () => {
  const { people } = useFamily();
  const { t } = useI18n();
  const [showBirth, setShowBirth] = useState(true);
  const [showDeath, setShowDeath] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [stepSize, setStepSize] = useState(5);
  const [intervalMs, setIntervalMs] = useState(1000);
  const [showSettings, setShowSettings] = useState(false);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const allCoords = useMemo(() => {
    const coords: { lat: number; lng: number }[] = [];
    for (const p of people) {
      if (p.birthCoordinates) coords.push(p.birthCoordinates);
      if (p.deathCoordinates) coords.push(p.deathCoordinates);
    }
    return coords;
  }, [people]);

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
  useEffect(() => {
    setTimelineYear(dataMaxYear);
  }, [dataMaxYear]);

  const stopAnimation = useCallback(() => {
    if (animRef.current) {
      clearInterval(animRef.current);
      animRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startAnimation = useCallback(() => {
    if (minYear === null || dataMaxYear === null) return;
    setTimelineYear((prev) =>
      prev === null || prev >= dataMaxYear ? minYear : prev
    );
    setIsPlaying(true);
  }, [minYear, dataMaxYear]);

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
    if (isPlaying) stopAnimation();
    else startAnimation();
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
    <div className="map-wrap">
      <div className="map-toggles floating">
        <button
          className={"map-toggle" + (showBirth ? " map-toggle--on-birth" : "")}
          onClick={() => setShowBirth((v) => !v)}
        >
          {t("map.birth")}
        </button>
        <button
          className={"map-toggle" + (showDeath ? " map-toggle--on-death" : "")}
          onClick={() => setShowDeath((v) => !v)}
        >
          {t("map.death")}
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

      {minYear !== null && dataMaxYear !== null && (
        <div className="timeline floating">
          <button
            className="timeline__btn timeline__btn--play"
            onClick={togglePlay}
            title={isPlaying ? t("map.pause") : t("map.play")}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            className="timeline__btn"
            onClick={resetTimeline}
            title={t("map.resetToEnd")}
          >
            ⏹
          </button>

          <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>
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
          />
          <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>
            {dataMaxYear}
          </span>
          <div className="timeline__year">{timelineYear ?? dataMaxYear}</div>

          <div style={{ position: "relative" }}>
            <button
              className="timeline__btn"
              onClick={() => setShowSettings((v) => !v)}
              title={t("map.animSettings")}
              style={{ color: showSettings ? "var(--forest)" : "var(--ink-faint)" }}
            >
              ⚙
            </button>

            {showSettings && (
              <div
                className="floating"
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 10px)",
                  right: 0,
                  padding: "14px 16px",
                  minWidth: 210,
                  zIndex: 1001,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                  {t("map.animSettingsTitle")}
                </div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    fontSize: 12,
                    color: "var(--ink-soft)",
                  }}
                >
                  <span style={{ minWidth: 74 }}>{t("map.stepYears")}</span>
                  <input
                    className="field__input"
                    type="number"
                    min={1}
                    max={50}
                    value={stepSize}
                    onChange={(e) => setStepSize(Math.max(1, Number(e.target.value)))}
                    style={{ width: 60, padding: "3px 6px", textAlign: "center" }}
                  />
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    color: "var(--ink-soft)",
                  }}
                >
                  <span style={{ minWidth: 74 }}>{t("map.speedMs")}</span>
                  <input
                    className="field__input"
                    type="number"
                    min={100}
                    max={5000}
                    step={100}
                    value={intervalMs}
                    onChange={(e) => setIntervalMs(Math.max(100, Number(e.target.value)))}
                    style={{ width: 60, padding: "3px 6px", textAlign: "center" }}
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
