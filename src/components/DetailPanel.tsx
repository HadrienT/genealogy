import React, { useState, useEffect } from "react";
import { useFamily } from "../hooks/useFamily";
import { useAuth } from "../hooks/useAuth";
import type { Person } from "../types/person";
import PlaceAutocomplete from "./PlaceAutocomplete";
import type { PlaceSelection } from "./PlaceAutocomplete";
import DocumentGallery from "./DocumentGallery";
import { formatDate } from "../utils/formatDate";
import { formatMarriagePlace } from "../utils/formatMarriagePlace";
import { useI18n } from "../hooks/useI18n";

interface MarriageForm {
  date: string;
  place: string;
  placeDisplay: string;
  city: string;
  countryCode: string;
  country: string;
  postcode: string;
  county: string;
  deptCode: string;
}

const emptyMarriageForm = (): MarriageForm => ({
  date: "",
  place: "",
  placeDisplay: "",
  city: "",
  countryCode: "",
  country: "",
  postcode: "",
  county: "",
  deptCode: "",
});

const DetailPanel: React.FC = () => {
  const {
    selectedPerson,
    selectPerson,
    getPersonById,
    removePerson,
    updatePerson,
    people,
    marriages,
    updateMarriage,
    requestMapFlyTo,
    editPersonId,
    clearEditPerson,
  } = useFamily();
  const { t, months } = useI18n();
  const { isEditor } = useAuth();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Person>>({});
  const [latStr, setLatStr] = useState("");
  const [lngStr, setLngStr] = useState("");
  const [deathLatStr, setDeathLatStr] = useState("");
  const [deathLngStr, setDeathLngStr] = useState("");
  const [selParents, setSelParents] = useState<string[]>([]);
  const [selPartners, setSelPartners] = useState<string[]>([]);
  const [marriageForms, setMarriageForms] = useState<Record<string, MarriageForm>>(
    {}
  );

  const loadPerson = (sp: Person) => {
    setForm({
      firstName: sp.firstName ?? "",
      middleNames: sp.middleNames ?? "",
      lastName: sp.lastName ?? "",
      maidenName: sp.maidenName ?? "",
      gender: sp.gender,
      birthDate: sp.birthDate ?? "",
      deathDate: sp.deathDate ?? "",
      birthPlace: sp.birthPlace ?? "",
      birthPlaceDisplay: sp.birthPlaceDisplay ?? "",
      deathPlace: sp.deathPlace ?? "",
      deathPlaceDisplay: sp.deathPlaceDisplay ?? "",
      occupation: sp.occupation ?? "",
      notes: sp.notes ?? "",
    });
    setLatStr(sp.birthCoordinates?.lat?.toString() ?? "");
    setLngStr(sp.birthCoordinates?.lng?.toString() ?? "");
    setDeathLatStr(sp.deathCoordinates?.lat?.toString() ?? "");
    setDeathLngStr(sp.deathCoordinates?.lng?.toString() ?? "");
    setSelParents(sp.parentIds ?? []);
    setSelPartners(sp.partnerIds ?? []);
    const mf: Record<string, MarriageForm> = {};
    for (const pid of sp.partnerIds ?? []) {
      const m = marriages.find(
        (mar) => mar.partnerIds.includes(sp.id) && mar.partnerIds.includes(pid)
      );
      mf[pid] = {
        ...emptyMarriageForm(),
        date: m?.date ?? "",
        place: m?.place ?? "",
        placeDisplay: m?.placeDisplay ?? "",
        city: m?.city ?? "",
        countryCode: m?.countryCode ?? "",
        country: m?.country ?? "",
        postcode: m?.postcode ?? "",
        county: m?.county ?? "",
        deptCode: m?.deptCode ?? "",
      };
    }
    setMarriageForms(mf);
    setEditingId(sp.id);
  };

  useEffect(() => {
    if (
      editPersonId &&
      selectedPerson &&
      editPersonId === selectedPerson.id &&
      editingId !== selectedPerson.id
    ) {
      loadPerson(selectedPerson);
      clearEditPerson();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPersonId, selectedPerson, editingId, clearEditPerson, marriages]);

  if (!selectedPerson) return null;

  const p = selectedPerson;
  const editing = editingId === p.id;

  const handleRelationClick = (id: string) => {
    selectPerson(id);
    requestMapFlyTo(id);
  };

  const parents = (p.parentIds ?? [])
    .map((id) => getPersonById(id))
    .filter(Boolean) as Person[];
  const partners = (p.partnerIds ?? [])
    .map((id) => getPersonById(id))
    .filter(Boolean) as Person[];
  const children = (p.childrenIds ?? [])
    .map((id) => getPersonById(id))
    .filter(Boolean) as Person[];

  const formatName = (person: Person) =>
    [person.firstName, person.lastName].filter(Boolean).join(" ") || person.id;

  const set = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    const coords =
      latStr && lngStr
        ? { lat: parseFloat(latStr), lng: parseFloat(lngStr) }
        : undefined;
    const deathCoords =
      deathLatStr && deathLngStr
        ? { lat: parseFloat(deathLatStr), lng: parseFloat(deathLngStr) }
        : undefined;

    updatePerson(p.id, {
      firstName: (form.firstName as string) || undefined,
      middleNames: (form.middleNames as string) || undefined,
      lastName: (form.lastName as string) || undefined,
      maidenName: (form.maidenName as string) || undefined,
      gender: form.gender || undefined,
      birthDate: (form.birthDate as string) || undefined,
      deathDate: (form.deathDate as string) || undefined,
      birthPlace: (form.birthPlace as string) || undefined,
      birthPlaceDisplay: (form.birthPlaceDisplay as string) || undefined,
      deathPlace: (form.deathPlace as string) || undefined,
      deathPlaceDisplay: (form.deathPlaceDisplay as string) || undefined,
      occupation: (form.occupation as string) || undefined,
      notes: (form.notes as string) || undefined,
      birthCity: (form.birthCity as string) || undefined,
      birthCountryCode: (form.birthCountryCode as string) || undefined,
      birthCountry: (form.birthCountry as string) || undefined,
      birthPostcode: (form.birthPostcode as string) || undefined,
      birthCounty: (form.birthCounty as string) || undefined,
      birthDeptCode: (form.birthDeptCode as string) || undefined,
      birthCoordinates: coords,
      deathCity: (form.deathCity as string) || undefined,
      deathCountryCode: (form.deathCountryCode as string) || undefined,
      deathCountry: (form.deathCountry as string) || undefined,
      deathPostcode: (form.deathPostcode as string) || undefined,
      deathCounty: (form.deathCounty as string) || undefined,
      deathDeptCode: (form.deathDeptCode as string) || undefined,
      deathCoordinates: deathCoords,
      parentIds: selParents.length > 0 ? selParents : undefined,
      partnerIds: selPartners.length > 0 ? selPartners : undefined,
    });
    for (const pid of selPartners) {
      const mf = marriageForms[pid];
      if (mf && (mf.date || mf.place)) {
        updateMarriage(p.id, pid, {
          date: mf.date || undefined,
          place: mf.place || undefined,
          placeDisplay: mf.placeDisplay || undefined,
          city: mf.city || undefined,
          countryCode: mf.countryCode || undefined,
          country: mf.country || undefined,
          postcode: mf.postcode || undefined,
          county: mf.county || undefined,
          deptCode: mf.deptCode || undefined,
        });
      }
    }
    setEditingId(null);
  };

  // ── Edit mode ─────────────────────────────────────────────────
  if (editing) {
    const otherPeople = people.filter((pp) => pp.id !== p.id);

    return (
      <div className="panel">
        <button
          className="iconclose panel__close"
          onClick={() => setEditingId(null)}
          title={t("detail.cancel")}
        >
          ✕
        </button>

        <h2 style={{ marginBottom: 16 }}>{t("detail.editPerson")}</h2>

        <div className="form">
          <div className="form__row">
            <Edit label={t("detail.firstName")} value={(form.firstName as string) ?? ""} onChange={(v) => set("firstName", v)} />
            <Edit label={t("detail.lastName")} value={(form.lastName as string) ?? ""} onChange={(v) => set("lastName", v)} />
          </div>

          <Edit label={t("detail.middleNames")} value={(form.middleNames as string) ?? ""} onChange={(v) => set("middleNames", v)} />

          <div className="form__row">
            <Edit label={t("detail.maidenName")} value={(form.maidenName as string) ?? ""} onChange={(v) => set("maidenName", v)} />
            <div className="field">
              <label className="field__label">{t("detail.gender")}</label>
              <select
                className="field__select"
                value={(form.gender as string) ?? ""}
                onChange={(e) => set("gender", e.target.value || undefined)}
              >
                <option value="">—</option>
                <option value="male">{t("detail.genderMale")}</option>
                <option value="female">{t("detail.genderFemale")}</option>
              </select>
            </div>
          </div>

          <div className="form__row">
            <Edit label={t("detail.birthDate")} value={(form.birthDate as string) ?? ""} onChange={(v) => set("birthDate", v)} placeholder={t("detail.birthDatePlaceholder")} />
            <Edit label={t("detail.deathDate")} value={(form.deathDate as string) ?? ""} onChange={(v) => set("deathDate", v)} placeholder={t("detail.deathDatePlaceholder")} />
          </div>

          <PlaceAutocomplete
            label={t("detail.birthPlace")}
            value={(form.birthPlace as string) ?? ""}
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
            placeholder={t("detail.searchPlaceholder")}
          />

          <div className="form__row">
            <Edit label={t("detail.birthLat")} value={latStr} onChange={setLatStr} placeholder={t("detail.latPlaceholder")} />
            <Edit label={t("detail.birthLng")} value={lngStr} onChange={setLngStr} placeholder={t("detail.lngPlaceholder")} />
          </div>

          <Edit label={t("detail.birthPlaceDisplay")} value={(form.birthPlaceDisplay as string) ?? ""} onChange={(v) => set("birthPlaceDisplay", v)} placeholder={t("detail.historicalName")} />

          <PlaceAutocomplete
            label={t("detail.deathPlace")}
            value={(form.deathPlace as string) ?? ""}
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
            placeholder={t("detail.searchPlaceholder")}
          />

          <Edit label={t("detail.deathPlaceDisplay")} value={(form.deathPlaceDisplay as string) ?? ""} onChange={(v) => set("deathPlaceDisplay", v)} placeholder={t("detail.historicalName")} />

          <Edit label={t("detail.occupation")} value={(form.occupation as string) ?? ""} onChange={(v) => set("occupation", v)} />

          <div className="field">
            <label className="field__label">{t("detail.parentsUpTo2")}</label>
            <select
              className="field__select"
              multiple
              value={selParents}
              onChange={(e) => {
                const vals = Array.from(e.target.selectedOptions, (o) => o.value);
                if (vals.length <= 2) setSelParents(vals);
              }}
              style={{ height: 72 }}
            >
              {otherPeople.map((pp) => (
                <option key={pp.id} value={pp.id}>
                  {formatName(pp)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field__label">{t("detail.partners")}</label>
            <select
              className="field__select"
              multiple
              value={selPartners}
              onChange={(e) => {
                const vals = Array.from(e.target.selectedOptions, (o) => o.value);
                setSelPartners(vals);
                setMarriageForms((prev) => {
                  const next = { ...prev };
                  for (const pid of vals) {
                    if (!next[pid]) {
                      const m = marriages.find(
                        (mar) =>
                          mar.partnerIds.includes(p.id) &&
                          mar.partnerIds.includes(pid)
                      );
                      next[pid] = {
                        ...emptyMarriageForm(),
                        date: m?.date ?? "",
                        place: m?.place ?? "",
                        placeDisplay: m?.placeDisplay ?? "",
                        city: m?.city ?? "",
                        countryCode: m?.countryCode ?? "",
                        country: m?.country ?? "",
                        postcode: m?.postcode ?? "",
                        county: m?.county ?? "",
                        deptCode: m?.deptCode ?? "",
                      };
                    }
                  }
                  return next;
                });
              }}
              style={{ height: 72 }}
            >
              {otherPeople.map((pp) => (
                <option key={pp.id} value={pp.id}>
                  {formatName(pp)}
                </option>
              ))}
            </select>
          </div>

          {selPartners.length > 0 && (
            <div className="field">
              <label className="field__label">{t("detail.marriageDetails")}</label>
              {selPartners.map((pid) => {
                const partner = getPersonById(pid);
                const mf = marriageForms[pid] ?? emptyMarriageForm();
                return (
                  <div key={pid} className="subcard" style={{ marginBottom: 6 }}>
                    <div className="subcard__title">
                      {t("detail.marriageWith", {
                        name: partner ? formatName(partner) : pid,
                      })}
                    </div>
                    <Edit
                      label={t("detail.marriageDate")}
                      value={mf.date}
                      onChange={(v) =>
                        setMarriageForms((prev) => ({
                          ...prev,
                          [pid]: { ...prev[pid], date: v },
                        }))
                      }
                      placeholder={t("detail.birthDatePlaceholder")}
                    />
                    <div style={{ marginTop: 6 }}>
                      <PlaceAutocomplete
                        label={t("detail.marriagePlace")}
                        value={mf.place}
                        onChange={(v) =>
                          setMarriageForms((prev) => ({
                            ...prev,
                            [pid]: { ...prev[pid], place: v },
                          }))
                        }
                        onPlaceSelect={(place: PlaceSelection) => {
                          setMarriageForms((prev) => ({
                            ...prev,
                            [pid]: {
                              ...prev[pid],
                              place: place.name,
                              city: place.city || "",
                              countryCode: place.countryCode || "",
                              country: place.country || "",
                              postcode: place.postcode || "",
                              county: place.county || "",
                              deptCode: place.deptCode || "",
                            },
                          }));
                        }}
                        placeholder={t("detail.searchPlaceholder")}
                      />
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Edit
                        label={t("detail.placeDisplayName")}
                        value={mf.placeDisplay}
                        onChange={(v) =>
                          setMarriageForms((prev) => ({
                            ...prev,
                            [pid]: { ...prev[pid], placeDisplay: v },
                          }))
                        }
                        placeholder={t("detail.historicalName")}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="field">
            <label className="field__label">{t("detail.notes")}</label>
            <textarea
              className="field__textarea"
              value={(form.notes as string) ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="btn btn--primary" onClick={handleSave}>
              {t("detail.save")}
            </button>
            <button className="btn" onClick={() => setEditingId(null)}>
              {t("detail.cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── View mode ─────────────────────────────────────────────────
  return (
    <div className="panel">
      <button
        className="iconclose panel__close"
        onClick={() => selectPerson(null)}
        title={t("detail.close")}
      >
        ✕
      </button>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        {p.photo && <img className="panel__portrait" src={p.photo} alt="" />}
        <div>
          <h2 className="panel__name">{formatName(p)}</h2>
          {p.maidenName && (
            <div className="panel__sub">
              {t("detail.nee")} {p.maidenName}
            </div>
          )}
        </div>
      </div>

      <div>
        {p.middleNames && <Info k={t("detail.middleNames")} v={p.middleNames} />}
        {p.gender && (
          <Info
            k={t("detail.gender")}
            v={p.gender === "male" ? t("detail.genderMale") : t("detail.genderFemale")}
          />
        )}
        {p.birthDate && <Info k={t("detail.born")} v={formatDate(p.birthDate, months)} />}
        {p.birthPlace && (
          <Info k={t("detail.birthPlace")} v={p.birthPlaceDisplay || p.birthPlace} />
        )}
        {p.deathDate && <Info k={t("detail.died")} v={formatDate(p.deathDate, months)} />}
        {p.deathPlace && (
          <Info k={t("detail.deathPlace")} v={p.deathPlaceDisplay || p.deathPlace} />
        )}
        {p.occupation && <Info k={t("detail.occupation")} v={p.occupation} />}

        {parents.length > 0 && (
          <Relations label={t("detail.parents")} people={parents} onSelect={handleRelationClick} />
        )}

        {partners.length > 0 && (
          <div className="inforow">
            <span className="inforow__k">{t("detail.partnersLabel")}</span>
            <span className="inforow__v">
              {partners.map((partner, i) => {
                const m = marriages.find(
                  (mar) =>
                    mar.partnerIds.includes(p.id) &&
                    mar.partnerIds.includes(partner.id)
                );
                const placeLabel = m ? formatMarriagePlace(m) : undefined;
                return (
                  <div key={partner.id} style={{ marginTop: i > 0 ? 4 : 0 }}>
                    <button className="link" onClick={() => handleRelationClick(partner.id)}>
                      {formatName(partner)}
                    </button>
                    {(m?.date || placeLabel) && (
                      <span className="marriage-note">
                        💍 {m?.date ? formatDate(m.date, months) : ""}
                        {m?.date && placeLabel ? " · " : ""}
                        {placeLabel ?? ""}
                      </span>
                    )}
                  </div>
                );
              })}
            </span>
          </div>
        )}

        {children.length > 0 && (
          <Relations label={t("detail.children")} people={children} onSelect={handleRelationClick} />
        )}

        {p.notes && (
          <div style={{ marginTop: 12 }}>
            <div className="section-label" style={{ marginBottom: 4 }}>
              {t("detail.notes")}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--ink-soft)",
                whiteSpace: "pre-wrap",
                fontFamily: "var(--font-serif)",
              }}
            >
              {p.notes}
            </div>
          </div>
        )}
      </div>

      <DocumentGallery personId={p.id} />

      {isEditor && (
        <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
          <button className="btn btn--soft" onClick={() => loadPerson(p)}>
            {t("detail.edit")}
          </button>
          <button
            className="btn btn--danger"
            onClick={() => {
              if (confirm(t("detail.confirmRemove", { name: formatName(p) }))) {
                removePerson(p.id);
              }
            }}
          >
            {t("detail.remove")}
          </button>
        </div>
      )}
    </div>
  );
};

const Edit: React.FC<{
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

const Info: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="inforow">
    <span className="inforow__k">{k}</span>
    <span className="inforow__v">{v}</span>
  </div>
);

const Relations: React.FC<{
  label: string;
  people: Person[];
  onSelect: (id: string) => void;
}> = ({ label, people, onSelect }) => (
  <div className="inforow">
    <span className="inforow__k">{label}</span>
    <span className="inforow__v">
      {people.map((person, i) => (
        <React.Fragment key={person.id}>
          {i > 0 && ", "}
          <button className="link" onClick={() => onSelect(person.id)}>
            {[person.firstName, person.lastName].filter(Boolean).join(" ") ||
              person.id}
          </button>
        </React.Fragment>
      ))}
    </span>
  </div>
);

export default DetailPanel;
