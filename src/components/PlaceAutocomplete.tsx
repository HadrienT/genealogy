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
  deptCode?: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (place: PlaceSelection) => void;
  placeholder?: string;
}

/**
 * Free-text place input with OpenStreetMap Nominatim autocomplete.
 * Selecting a suggestion fills in the name + coordinates + structured fields.
 */
const PlaceAutocomplete: React.FC<Props> = ({
  label,
  value,
  onChange,
  onPlaceSelect,
  placeholder,
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
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(
          query
        )}`;
        const res = await fetch(url, { headers: { "Accept-Language": "fr,en" } });
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
    onChange(e.target.value);
    search(e.target.value);
  };

  const handleSelect = (result: NominatimResult) => {
    onChange(result.display_name);
    setShowDropdown(false);
    setSuggestions([]);
    const addr = result.address;
    const city = addr?.city || addr?.town || addr?.village || addr?.municipality;
    const iso = addr?.["ISO3166-2-lvl6"];
    const deptCode =
      iso && addr?.country_code === "fr" ? iso.replace(/^FR-/, "") : undefined;
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
      setActiveIdx((p) => Math.min(p + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="field autocomplete" ref={containerRef}>
      <label className="field__label">{label}</label>
      <input
        className="field__input"
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 && (
        <ul className="autocomplete__list">
          {suggestions.map((s, i) => (
            <li
              key={`${s.lat}-${s.lon}`}
              className={
                "autocomplete__item" +
                (i === activeIdx ? " autocomplete__item--active" : "")
              }
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <div className="autocomplete__name">{s.display_name}</div>
              <div className="autocomplete__coords">
                {parseFloat(s.lat).toFixed(4)}, {parseFloat(s.lon).toFixed(4)}
              </div>
            </li>
          ))}
          <li className="autocomplete__credit">© OpenStreetMap contributors</li>
        </ul>
      )}
    </div>
  );
};

export default PlaceAutocomplete;
