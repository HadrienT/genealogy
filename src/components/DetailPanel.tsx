import React, { useState, useEffect } from "react";
import { useFamily } from "../hooks/useFamily";
import { useAuth } from "../hooks/useAuth";
import type { Person } from "../types/person";
import PlaceAutocomplete from "./PlaceAutocomplete";
import type { PlaceSelection } from "./PlaceAutocomplete";
import { formatDate } from "../utils/formatDate";
import { useI18n } from "../hooks/useI18n";

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
  // Store the id being edited so editing resets automatically when person changes
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Person>>({});
  const [latStr, setLatStr] = useState("");
  const [lngStr, setLngStr] = useState("");
  const [deathLatStr, setDeathLatStr] = useState("");
  const [deathLngStr, setDeathLngStr] = useState("");
  const [selParents, setSelParents] = useState<string[]>([]);
  const [selPartners, setSelPartners] = useState<string[]>([]);
  const [marriageForms, setMarriageForms] = useState<Record<string, {
    date: string; place: string; placeDisplay: string;
    city: string; countryCode: string; country: string;
    postcode: string; county: string; deptCode: string;
  }>>({}); 

  // React to external edit requests (e.g. double-click on tree node)
  useEffect(() => {
    if (editPersonId && selectedPerson && editPersonId === selectedPerson.id && editingId !== selectedPerson.id) {
      const sp = selectedPerson;
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
      // Initialize marriage forms for each partner
      const mf: typeof marriageForms = {};
      for (const pid of sp.partnerIds ?? []) {
        const m = marriages.find(
          (mar) => mar.partnerIds.includes(sp.id) && mar.partnerIds.includes(pid)
        );
mf[pid] = {
        date: m?.date ?? "", place: m?.place ?? "", placeDisplay: m?.placeDisplay ?? "",
        city: m?.city ?? "", countryCode: m?.countryCode ?? "", country: m?.country ?? "",
        postcode: m?.postcode ?? "", county: m?.county ?? "", deptCode: m?.deptCode ?? "",
      };
      }
      setMarriageForms(mf);
      setEditingId(sp.id);
      clearEditPerson();
    }
  }, [editPersonId, selectedPerson, editingId, clearEditPerson, marriages]);

  if (!selectedPerson) return null;

  const editing = editingId === selectedPerson.id;

  const p = selectedPerson;

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

  const startEditing = () => {
    setForm({
      firstName: p.firstName ?? "",
      middleNames: p.middleNames ?? "",
      lastName: p.lastName ?? "",
      maidenName: p.maidenName ?? "",
      gender: p.gender,
      birthDate: p.birthDate ?? "",
      deathDate: p.deathDate ?? "",
      birthPlace: p.birthPlace ?? "",
      birthPlaceDisplay: p.birthPlaceDisplay ?? "",
      deathPlace: p.deathPlace ?? "",
      deathPlaceDisplay: p.deathPlaceDisplay ?? "",
      occupation: p.occupation ?? "",
      notes: p.notes ?? "",
    });
    setLatStr(p.birthCoordinates?.lat?.toString() ?? "");
    setLngStr(p.birthCoordinates?.lng?.toString() ?? "");
    setDeathLatStr(p.deathCoordinates?.lat?.toString() ?? "");
    setDeathLngStr(p.deathCoordinates?.lng?.toString() ?? "");
    setSelParents(p.parentIds ?? []);
    setSelPartners(p.partnerIds ?? []);
    // Initialize marriage forms for each partner
    const mf: typeof marriageForms = {};
    for (const pid of p.partnerIds ?? []) {
      const m = marriages.find(
        (mar) => mar.partnerIds.includes(p.id) && mar.partnerIds.includes(pid)
      );
      mf[pid] = {
        date: m?.date ?? "", place: m?.place ?? "", placeDisplay: m?.placeDisplay ?? "",
        city: m?.city ?? "", countryCode: m?.countryCode ?? "", country: m?.country ?? "",
        postcode: m?.postcode ?? "", county: m?.county ?? "", deptCode: m?.deptCode ?? "",
      };
    }
    setMarriageForms(mf);
    setEditingId(p.id);
  };

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
    // Save marriage data for each partner
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

  // ── Edit mode ───────────────────────────────────
  if (editing) {
    const otherPeople = people.filter((pp) => pp.id !== p.id);

    return (
      <div style={panelStyle}>
        <button
          onClick={() => setEditingId(null)}
          style={closeBtnStyle}
          title={t("detail.cancel")}
        >
          ✕
        </button>

        <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "#1e293b" }}>
          {t("detail.editPerson")}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={editRowStyle}>
            <EditField label={t("detail.firstName")} value={(form.firstName as string) ?? ""} onChange={(v) => set("firstName", v)} />
            <EditField label={t("detail.lastName")} value={(form.lastName as string) ?? ""} onChange={(v) => set("lastName", v)} />
          </div>

          <EditField label={t("detail.middleNames")} value={(form.middleNames as string) ?? ""} onChange={(v) => set("middleNames", v)} />

          <div style={editRowStyle}>
            <EditField label={t("detail.maidenName")} value={(form.maidenName as string) ?? ""} onChange={(v) => set("maidenName", v)} />
            <div style={{ flex: 1 }}>
              <label style={editLabelStyle}>{t("detail.gender")}</label>
              <select
                value={(form.gender as string) ?? ""}
                onChange={(e) => set("gender", e.target.value || undefined)}
                style={editInputStyle}
              >
                <option value="">—</option>
                <option value="male">{t("detail.genderMale")}</option>
                <option value="female">{t("detail.genderFemale")}</option>
              </select>
            </div>
          </div>

          <div style={editRowStyle}>
            <EditField label={t("detail.birthDate")} value={(form.birthDate as string) ?? ""} onChange={(v) => set("birthDate", v)} placeholder={t("detail.birthDatePlaceholder")} />
            <EditField label={t("detail.deathDate")} value={(form.deathDate as string) ?? ""} onChange={(v) => set("deathDate", v)} placeholder={t("detail.deathDatePlaceholder")} />
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
            inputStyle={editInputStyle}
            labelStyle={editLabelStyle}
          />

          <div style={editRowStyle}>
            <EditField label={t("detail.birthLat")} value={latStr} onChange={setLatStr} placeholder={t("detail.latPlaceholder")} />
            <EditField label={t("detail.birthLng")} value={lngStr} onChange={setLngStr} placeholder={t("detail.lngPlaceholder")} />
          </div>

          <EditField label={t("detail.birthPlaceDisplay")} value={(form.birthPlaceDisplay as string) ?? ""} onChange={(v) => set("birthPlaceDisplay", v)} placeholder={t("detail.historicalName")} />

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
            inputStyle={editInputStyle}
            labelStyle={editLabelStyle}
          />

          <EditField label={t("detail.deathPlaceDisplay")} value={(form.deathPlaceDisplay as string) ?? ""} onChange={(v) => set("deathPlaceDisplay", v)} placeholder={t("detail.historicalName")} />

          <EditField label={t("detail.occupation")} value={(form.occupation as string) ?? ""} onChange={(v) => set("occupation", v)} />

          {/* Parent selection */}
          <div>
            <label style={editLabelStyle}>{t("detail.parentsUpTo2")}</label>
            <select
              multiple
              value={selParents}
              onChange={(e) => {
                const vals = Array.from(e.target.selectedOptions, (o) => o.value);
                if (vals.length <= 2) setSelParents(vals);
              }}
              style={{ ...editInputStyle, height: 72 }}
            >
              {otherPeople.map((pp) => (
                <option key={pp.id} value={pp.id}>
                  {formatName(pp)}
                </option>
              ))}
            </select>
          </div>

          {/* Partner selection */}
          <div>
            <label style={editLabelStyle}>{t("detail.partners")}</label>
            <select
              multiple
              value={selPartners}
              onChange={(e) => {
                const vals = Array.from(e.target.selectedOptions, (o) => o.value);
                setSelPartners(vals);
                // Initialize marriage form for newly added partners
                setMarriageForms((prev) => {
                  const next = { ...prev };
                  for (const pid of vals) {
                    if (!next[pid]) {
                      const m = marriages.find(
                        (mar) => mar.partnerIds.includes(p.id) && mar.partnerIds.includes(pid)
                      );
                      next[pid] = {
                        date: m?.date ?? "", place: m?.place ?? "", placeDisplay: m?.placeDisplay ?? "",
                        city: m?.city ?? "", countryCode: m?.countryCode ?? "", country: m?.country ?? "",
                        postcode: m?.postcode ?? "", county: m?.county ?? "", deptCode: m?.deptCode ?? "",
                      };
                    }
                  }
                  return next;
                });
              }}
              style={{ ...editInputStyle, height: 72 }}
            >
              {otherPeople.map((pp) => (
                <option key={pp.id} value={pp.id}>
                  {formatName(pp)}
                </option>
              ))}
            </select>
          </div>

          {/* Marriage details per partner */}
          {selPartners.length > 0 && (
            <div>
              <label style={editLabelStyle}>{t("detail.marriageDetails")}</label>
              {selPartners.map((pid) => {
                const partner = getPersonById(pid);
                const mf = marriageForms[pid] ?? {
                  date: "", place: "", placeDisplay: "",
                  city: "", countryCode: "", country: "",
                  postcode: "", county: "", deptCode: "",
                };
                return (
                  <div
                    key={pid}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                      padding: "8px 10px",
                      marginBottom: 6,
                      background: "#fef2f2",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#9f1239", marginBottom: 6 }}>
                      {t("detail.marriageWith", { name: partner ? formatName(partner) : pid })}
                    </div>
                    <EditField
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
                        inputStyle={editInputStyle}
                        labelStyle={editLabelStyle}
                      />
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <EditField
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

          <div>
            <label style={editLabelStyle}>{t("detail.notes")}</label>
            <textarea
              value={(form.notes as string) ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              style={{ ...editInputStyle, height: 60, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={handleSave} style={saveBtnStyle}>
              {t("detail.save")}
            </button>
            <button onClick={() => setEditingId(null)} style={cancelBtnStyle}>
              {t("detail.cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── View mode ───────────────────────────────────
  return (
    <div style={panelStyle}>
      {/* Close button */}
      <button
        onClick={() => selectPerson(null)}
        style={closeBtnStyle}
        title={t("detail.close")}
      >
        ✕
      </button>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "#1e293b" }}>
          {formatName(p)}
        </h2>
        {p.maidenName && (
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {t("detail.nee")} {p.maidenName}
          </div>
        )}
      </div>

      {/* Info rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {p.middleNames && <InfoRow label={t("detail.middleNames")} value={p.middleNames} />}
        {p.gender && <InfoRow label={t("detail.gender")} value={p.gender === "male" ? t("detail.genderMale") : t("detail.genderFemale")} />}
        {p.birthDate && <InfoRow label={t("detail.born")} value={formatDate(p.birthDate, months)} />}
        {p.birthPlace && <InfoRow label={t("detail.birthPlace")} value={p.birthPlaceDisplay || p.birthPlace} />}
        {p.deathDate && <InfoRow label={t("detail.died")} value={formatDate(p.deathDate, months)} />}
        {p.deathPlace && <InfoRow label={t("detail.deathPlace")} value={p.deathPlaceDisplay || p.deathPlace} />}
        {p.occupation && <InfoRow label={t("detail.occupation")} value={p.occupation} />}

        {parents.length > 0 && (
          <RelationRow
            label={t("detail.parents")}
            people={parents}
            onSelect={handleRelationClick}
          />
        )}
        {partners.length > 0 && (
          <div>
            <span style={labelStyle}>{t("detail.partnersLabel")} </span>
            {partners.map((partner, i) => {
              const m = marriages.find(
                (mar) =>
                  mar.partnerIds.includes(p.id) &&
                  mar.partnerIds.includes(partner.id)
              );
              return (
                <div key={partner.id} style={{ marginTop: i > 0 ? 4 : 0 }}>
                  <button
                    onClick={() => handleRelationClick(partner.id)}
                    style={linkBtnStyle}
                  >
                    {formatName(partner)}
                  </button>
                  {(m?.date || m?.place) && (() => {
                    const displayCity = m?.placeDisplay || m?.city;
                    let placeLabel: string | undefined;
                    if (displayCity && m?.countryCode) {
                      if (m.countryCode === "fr") {
                        placeLabel = m.deptCode ? `${displayCity} (${m.deptCode})` : displayCity;
                      } else {
                        placeLabel = `${displayCity} (${m.country || m.countryCode.toUpperCase()})`;
                      }
                    } else if (m?.place) {
                      const c = m.place.indexOf(",");
                      placeLabel = c > 0 ? m.place.substring(0, c).trim() : m.place;
                    }
                    return (
                      <span style={{ fontSize: 12, color: "#9f1239", marginLeft: 6 }}>
                        💍 {m?.date ? formatDate(m.date, months) : ""}{m?.date && placeLabel ? " · " : ""}{placeLabel ?? ""}
                      </span>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
        {children.length > 0 && (
          <RelationRow
            label={t("detail.children")}
            people={children}
            onSelect={handleRelationClick}
          />
        )}

        {p.notes && (
          <div style={{ marginTop: 8 }}>
            <div style={labelStyle}>{t("detail.notes")}</div>
            <div
              style={{
                fontSize: 13,
                color: "#475569",
                whiteSpace: "pre-wrap",
              }}
            >
              {p.notes}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {isEditor && (
      <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
        <button onClick={startEditing} style={editBtnStyle}>
          {t("detail.edit")}
        </button>
        <button
          onClick={() => {
            if (confirm(t("detail.confirmRemove", { name: formatName(p) }))) {
              removePerson(p.id);
            }
          }}
          style={deleteBtnStyle}
        >
          {t("detail.remove")}
        </button>
      </div>
      )}
    </div>
  );
};

// ── Edit sub-components ─────────────────────────
const EditField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div style={{ flex: 1 }}>
    <label style={editLabelStyle}>{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={editInputStyle}
    />
  </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div>
    <span style={labelStyle}>{label}: </span>
    <span style={{ fontSize: 13, color: "#334155" }}>{value}</span>
  </div>
);

const RelationRow: React.FC<{
  label: string;
  people: Person[];
  onSelect: (id: string) => void;
}> = ({ label, people, onSelect }) => (
  <div>
    <span style={labelStyle}>{label}: </span>
    {people.map((person, i) => (
      <React.Fragment key={person.id}>
        {i > 0 && ", "}
        <button onClick={() => onSelect(person.id)} style={linkBtnStyle}>
          {[person.firstName, person.lastName].filter(Boolean).join(" ") ||
            person.id}
        </button>
      </React.Fragment>
    ))}
  </div>
);

// ── Styles ──────────────────────────────────────
const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  width: 340,
  height: "100%",
  background: "white",
  borderLeft: "1px solid #e2e8f0",
  padding: "24px 20px",
  overflowY: "auto",
  zIndex: 1000,
  fontFamily: "'Inter', system-ui, sans-serif",
  boxShadow: "-4px 0 12px rgba(0,0,0,0.06)",
};

const closeBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  background: "none",
  border: "none",
  fontSize: 18,
  cursor: "pointer",
  color: "#94a3b8",
  padding: 4,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const linkBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#3b82f6",
  cursor: "pointer",
  fontSize: 13,
  padding: 0,
  textDecoration: "underline",
};

const editBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  background: "#dbeafe",
  color: "#2563eb",
  border: "1px solid #93c5fd",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};

const deleteBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  background: "#fee2e2",
  color: "#dc2626",
  border: "1px solid #fca5a5",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};

const editRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

const editLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#64748b",
  marginBottom: 3,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const editInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  fontSize: 13,
  color: "#1e293b",
  outline: "none",
  boxSizing: "border-box",
};

const saveBtnStyle: React.CSSProperties = {
  padding: "7px 18px",
  background: "#3b82f6",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "7px 18px",
  background: "#f1f5f9",
  color: "#64748b",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};

export default DetailPanel;
