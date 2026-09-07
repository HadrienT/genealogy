import React, { useState } from "react";
import { useFamily } from "../hooks/useFamily";
import type { Person } from "../types/person";
import PlaceAutocomplete from "./PlaceAutocomplete";
import type { PlaceSelection } from "./PlaceAutocomplete";
import { useI18n } from "../hooks/useI18n";

type FormShape = Omit<Person, "id">;

const emptyForm: FormShape = {
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
  const [form, setForm] = useState<FormShape>(emptyForm);
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

  const set = (key: keyof FormShape, value: unknown) =>
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

    addPerson(person);
    onClose();
  };

  const nameOf = (p: Person) =>
    [p.firstName, p.lastName].filter(Boolean).join(" ") || p.id;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2 className="modal__title">{t("add.title")}</h2>
          <button className="iconclose" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <div className="form__row">
            <TextField
              label={t("add.firstName")}
              value={form.firstName ?? ""}
              onChange={(v) => set("firstName", v)}
            />
            <TextField
              label={t("add.lastName")}
              value={form.lastName ?? ""}
              onChange={(v) => set("lastName", v)}
            />
          </div>

          <TextField
            label={t("add.middleNames")}
            value={form.middleNames ?? ""}
            onChange={(v) => set("middleNames", v)}
            placeholder={t("add.middleNamesPlaceholder")}
          />

          <div className="form__row">
            <TextField
              label={t("add.maidenName")}
              value={form.maidenName ?? ""}
              onChange={(v) => set("maidenName", v)}
            />
            <div className="field">
              <label className="field__label">{t("add.gender")}</label>
              <select
                className="field__select"
                value={form.gender ?? ""}
                onChange={(e) => set("gender", e.target.value || undefined)}
              >
                <option value="">—</option>
                <option value="male">{t("add.genderMale")}</option>
                <option value="female">{t("add.genderFemale")}</option>
              </select>
            </div>
          </div>

          <div className="form__row">
            <TextField
              label={t("add.birthDate")}
              value={form.birthDate ?? ""}
              onChange={(v) => set("birthDate", v)}
              placeholder={t("add.birthDatePlaceholder")}
            />
            <TextField
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
          />

          <TextField
            label={t("add.birthPlaceDisplay")}
            value={form.birthPlaceDisplay ?? ""}
            onChange={(v) => set("birthPlaceDisplay", v)}
            placeholder={t("add.historicalName")}
          />

          <div className="form__row">
            <TextField
              label={t("add.birthLat")}
              value={latStr}
              onChange={setLatStr}
              placeholder={t("add.latPlaceholder")}
            />
            <TextField
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
          />

          <TextField
            label={t("add.deathPlaceDisplay")}
            value={form.deathPlaceDisplay ?? ""}
            onChange={(v) => set("deathPlaceDisplay", v)}
            placeholder={t("add.historicalName")}
          />

          <TextField
            label={t("add.occupation")}
            value={form.occupation ?? ""}
            onChange={(v) => set("occupation", v)}
          />

          <div className="field">
            <label className="field__label">{t("add.parentsSelect")}</label>
            <select
              className="field__select"
              multiple
              value={selectedParents}
              onChange={(e) => {
                const vals = Array.from(e.target.selectedOptions, (o) => o.value);
                if (vals.length <= 2) setSelectedParents(vals);
              }}
              style={{ height: 84 }}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {nameOf(p)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field__label">{t("add.partners")}</label>
            <select
              className="field__select"
              multiple
              value={selectedPartners}
              onChange={(e) => {
                const vals = Array.from(e.target.selectedOptions, (o) => o.value);
                setSelectedPartners(vals);
              }}
              style={{ height: 84 }}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {nameOf(p)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field__label">{t("add.notes")}</label>
            <textarea
              className="field__textarea"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <button className="btn btn--primary" type="submit" style={{ padding: "10px 0" }}>
            {t("add.submit")}
          </button>
        </form>
      </div>
    </div>
  );
};

const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div className="field">
    <label className="field__label">{label}</label>
    <input
      className="field__input"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

export default AddPersonForm;
