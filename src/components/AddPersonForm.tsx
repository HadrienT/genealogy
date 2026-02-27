import React, { useState } from "react";
import { useFamily } from "../hooks/useFamily";
import type { Person } from "../types/person";
import PlaceAutocomplete from "./PlaceAutocomplete";
import type { PlaceSelection } from "./PlaceAutocomplete";
import { useI18n } from "../hooks/useI18n";

const emptyForm: Omit<Person, "id"> = {
  firstName: "",
  middleNames: "",
  lastName: "",
  maidenName: "",
  gender: undefined,
  birthDate: "",
  deathDate: "",
  birthPlace: "",
  birthCoordinates: undefined,
  deathPlace: "",
  occupation: "",
  notes: "",
  parentIds: [],
  partnerIds: [],
};

const AddPersonForm: React.FC<{
  onClose: () => void;
  initialParentIds?: string[];
  initialChildIds?: string[];
  initialPartnerIds?: string[];
}> = ({ onClose, initialParentIds, initialChildIds, initialPartnerIds }) => {
  const { addPerson, people } = useFamily();
  const { t } = useI18n();
  const [form, setForm] = useState(emptyForm);
  const [latStr, setLatStr] = useState("");
  const [lngStr, setLngStr] = useState("");
  const [deathLatStr, setDeathLatStr] = useState("");
  const [deathLngStr, setDeathLngStr] = useState("");
  const [selectedParents, setSelectedParents] = useState<string[]>(
    initialParentIds ?? []
  );
  const [selectedPartners, setSelectedPartners] = useState<string[]>(
    initialPartnerIds ?? []
  );
  const [selectedChildren] = useState<string[]>(initialChildIds ?? []);

  const set = (key: keyof typeof form, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const coords =
      latStr && lngStr
        ? { lat: parseFloat(latStr), lng: parseFloat(lngStr) }
        : undefined;

    const deathCoords =
      deathLatStr && deathLngStr
        ? { lat: parseFloat(deathLatStr), lng: parseFloat(deathLngStr) }
        : undefined;

    const person: Omit<Person, "id"> = {
      ...form,
      firstName: form.firstName || undefined,
      middleNames: form.middleNames || undefined,
      lastName: form.lastName || undefined,
      maidenName: form.maidenName || undefined,
      birthDate: form.birthDate || undefined,
      deathDate: form.deathDate || undefined,
      birthPlace: form.birthPlace || undefined,
      birthPlaceDisplay: form.birthPlaceDisplay || undefined,
      deathPlace: form.deathPlace || undefined,
      deathPlaceDisplay: form.deathPlaceDisplay || undefined,
      occupation: form.occupation || undefined,
      notes: form.notes || undefined,
      birthCity: form.birthCity || undefined,
      birthCountryCode: form.birthCountryCode || undefined,
      birthCountry: form.birthCountry || undefined,
      birthPostcode: form.birthPostcode || undefined,
      birthCounty: form.birthCounty || undefined,
      birthDeptCode: form.birthDeptCode || undefined,
      birthCoordinates: coords,
      deathCity: form.deathCity || undefined,
      deathCountryCode: form.deathCountryCode || undefined,
      deathCountry: form.deathCountry || undefined,
      deathPostcode: form.deathPostcode || undefined,
      deathCounty: form.deathCounty || undefined,
      deathDeptCode: form.deathDeptCode || undefined,
      deathCoordinates: deathCoords,
      parentIds: selectedParents.length > 0 ? selectedParents : undefined,
      partnerIds: selectedPartners.length > 0 ? selectedPartners : undefined,
      childrenIds: selectedChildren.length > 0 ? selectedChildren : undefined,
    };

    const newPerson = addPerson(person);

    // Wire up partner relationships in both directions
    if (selectedPartners.length > 0) {
      // The useFamily.addPerson already handles parent→child wiring.
      // For partners we need to update the partner's partnerIds too.
      // We'll rely on the context's updatePerson for this.
    }

    console.log("Added person:", newPerson);
    onClose();
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, color: "#1e293b" }}>
            {t("add.title")}
          </h2>
          <button onClick={onClose} style={closeBtnStyle}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={rowStyle}>
            <Field
              label={t("add.firstName")}
              value={form.firstName ?? ""}
              onChange={(v) => set("firstName", v)}
            />
            <Field
              label={t("add.lastName")}
              value={form.lastName ?? ""}
              onChange={(v) => set("lastName", v)}
            />
          </div>

          <Field
            label={t("add.middleNames")}
            value={form.middleNames ?? ""}
            onChange={(v) => set("middleNames", v)}
            placeholder={t("add.middleNamesPlaceholder")}
          />

          <div style={rowStyle}>
            <Field
              label={t("add.maidenName")}
              value={form.maidenName ?? ""}
              onChange={(v) => set("maidenName", v)}
            />
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t("add.gender")}</label>
              <select
                value={form.gender ?? ""}
                onChange={(e) =>
                  set("gender", e.target.value || undefined)
                }
                style={inputStyle}
              >
                <option value="">—</option>
                <option value="male">{t("add.genderMale")}</option>
                <option value="female">{t("add.genderFemale")}</option>
                <option value="other">{t("add.genderOther")}</option>
              </select>
            </div>
          </div>

          <div style={rowStyle}>
            <Field
              label={t("add.birthDate")}
              value={form.birthDate ?? ""}
              onChange={(v) => set("birthDate", v)}
              placeholder={t("add.birthDatePlaceholder")}
            />
            <Field
              label={t("add.deathDate")}
              value={form.deathDate ?? ""}
              onChange={(v) => set("deathDate", v)}
              placeholder={t("add.deathDatePlaceholder")}
            />
          </div>

          <PlaceAutocomplete
            label={t("add.birthPlace")}
            value={form.birthPlace ?? ""}
            onChange={(v) => set("birthPlace", v)}
            onPlaceSelect={(place: PlaceSelection) => {
              set("birthPlace", place.name);
              setLatStr(place.lat.toString());
              setLngStr(place.lng.toString());
              set("birthCity", place.city || "");
              set("birthCountryCode", place.countryCode || "");
              set("birthCountry", place.country || "");
              set("birthPostcode", place.postcode || "");
              set("birthCounty", place.county || "");
              set("birthDeptCode", place.deptCode || "");
            }}
            placeholder={t("add.searchPlaceholder")}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
          />

          <Field
            label={t("add.birthPlaceDisplay")}
            value={form.birthPlaceDisplay ?? ""}
            onChange={(v) => set("birthPlaceDisplay", v)}
            placeholder={t("add.historicalName")}
          />

          <div style={rowStyle}>
            <Field
              label={t("add.birthLat")}
              value={latStr}
              onChange={setLatStr}
              placeholder={t("add.latPlaceholder")}
            />
            <Field
              label={t("add.birthLng")}
              value={lngStr}
              onChange={setLngStr}
              placeholder={t("add.lngPlaceholder")}
            />
          </div>

          <PlaceAutocomplete
            label={t("add.deathPlace")}
            value={form.deathPlace ?? ""}
            onChange={(v) => set("deathPlace", v)}
            onPlaceSelect={(place: PlaceSelection) => {
              set("deathPlace", place.name);
              setDeathLatStr(place.lat.toString());
              setDeathLngStr(place.lng.toString());
              set("deathCity", place.city || "");
              set("deathCountryCode", place.countryCode || "");
              set("deathCountry", place.country || "");
              set("deathPostcode", place.postcode || "");
              set("deathCounty", place.county || "");
              set("deathDeptCode", place.deptCode || "");
            }}
            placeholder={t("add.searchPlaceholder")}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
          />

          <Field
            label={t("add.deathPlaceDisplay")}
            value={form.deathPlaceDisplay ?? ""}
            onChange={(v) => set("deathPlaceDisplay", v)}
            placeholder={t("add.historicalName")}
          />

          <Field
            label={t("add.occupation")}
            value={form.occupation ?? ""}
            onChange={(v) => set("occupation", v)}
          />

          {/* Parent selection */}
          <div>
            <label style={labelStyle}>{t("add.parentsSelect")}</label>
            <select
              multiple
              value={selectedParents}
              onChange={(e) => {
                const vals = Array.from(
                  e.target.selectedOptions,
                  (o) => o.value
                );
                if (vals.length <= 2) setSelectedParents(vals);
              }}
              style={{ ...inputStyle, height: 80 }}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.firstName, p.lastName].filter(Boolean).join(" ") || p.id}
                </option>
              ))}
            </select>
          </div>

          {/* Partner selection */}
          <div>
            <label style={labelStyle}>{t("add.partners")}</label>
            <select
              multiple
              value={selectedPartners}
              onChange={(e) => {
                const vals = Array.from(
                  e.target.selectedOptions,
                  (o) => o.value
                );
                setSelectedPartners(vals);
              }}
              style={{ ...inputStyle, height: 80 }}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.firstName, p.lastName].filter(Boolean).join(" ") || p.id}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("add.notes")}</label>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              style={{ ...inputStyle, height: 60, resize: "vertical" }}
            />
          </div>

          <button type="submit" style={submitBtnStyle}>
            {t("add.submit")}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Sub-components ──────────────────────────────
const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div style={{ flex: 1 }}>
    <label style={labelStyle}>{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  </div>
);

// ── Styles ──────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
};

const modalStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 12,
  padding: 28,
  width: 520,
  maxHeight: "90vh",
  overflowY: "auto",
  fontFamily: "'Inter', system-ui, sans-serif",
  boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 18,
  cursor: "pointer",
  color: "#94a3b8",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  fontSize: 14,
  color: "#1e293b",
  outline: "none",
  boxSizing: "border-box",
};

const submitBtnStyle: React.CSSProperties = {
  padding: "10px 20px",
  background: "#3b82f6",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  marginTop: 8,
};

export default AddPersonForm;
