import React, { useState, useRef, useCallback, useEffect } from "react";

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  "ISO3166-2-lvl6"?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

export interface PlaceSelection {
  name: string;
  lat: number;
  lng: number;
  city?: string;
  countryCode?: string;
  country?: string;
  postcode?: string;
  county?: string;
  deptCode?: string; // French department code from ISO3166-2-lvl6 (e.g. "13")
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (place: PlaceSelection) => void;
  placeholder?: string;
  inputStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
}

/**
 * A text input with autocomplete suggestions from OpenStreetMap Nominatim.
 * Typing is always free-form — selecting a suggestion fills in the name + coordinates.
 */
const PlaceAutocomplete: React.FC<Props> = ({
  label,
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  inputStyle: customInputStyle,
  labelStyle: customLabelStyle,
}) => {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback((query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
          headers: { "Accept-Language": "fr,en" },
        });
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
        setActiveIdx(-1);
      } catch {
        setSuggestions([]);
      }
    }, 350);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    search(v);
  };

  const handleSelect = (result: NominatimResult) => {
    onChange(result.display_name);
    setShowDropdown(false);
    setSuggestions([]);
    const addr = result.address;
    const city = addr?.city || addr?.town || addr?.village || addr?.municipality;
    // Extract French department code from ISO3166-2-lvl6 (e.g. "FR-13" → "13")
    const iso = addr?.["ISO3166-2-lvl6"];
    const deptCode = iso && addr?.country_code === "fr" ? iso.replace(/^FR-/, "") : undefined;
    onPlaceSelect?.({
      name: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      city,
      countryCode: addr?.country_code,
      country: addr?.country,
      postcode: addr?.postcode,
      county: addr?.county,
      deptCode,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ flex: 1, position: "relative" }}>
      <label style={customLabelStyle ?? defaultLabelStyle}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        style={customInputStyle ?? defaultInputStyle}
        autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 && (
        <ul style={dropdownStyle}>
          {suggestions.map((s, i) => (
            <li
              key={`${s.lat}-${s.lon}`}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                ...itemStyle,
                background: i === activeIdx ? "#f1f5f9" : "transparent",
              }}
            >
              <div style={{ fontSize: 13, color: "#1e293b" }}>
                {s.display_name}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {parseFloat(s.lat).toFixed(4)}, {parseFloat(s.lon).toFixed(4)}
              </div>
            </li>
          ))}
          <li style={creditStyle}>
            © OpenStreetMap contributors
          </li>
        </ul>
      )}
    </div>
  );
};

// ── Styles ──────────────────────────────────────
const defaultLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const defaultInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  fontSize: 14,
  color: "#1e293b",
  outline: "none",
  boxSizing: "border-box",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  margin: 0,
  padding: 0,
  listStyle: "none",
  background: "white",
  border: "1px solid #e2e8f0",
  borderTop: "none",
  borderRadius: "0 0 6px 6px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  maxHeight: 240,
  overflowY: "auto",
  zIndex: 3000,
};

const itemStyle: React.CSSProperties = {
  padding: "8px 10px",
  cursor: "pointer",
  borderBottom: "1px solid #f8fafc",
};

const creditStyle: React.CSSProperties = {
  padding: "4px 10px",
  fontSize: 10,
  color: "#cbd5e1",
  textAlign: "right",
  cursor: "default",
};

export default PlaceAutocomplete;
