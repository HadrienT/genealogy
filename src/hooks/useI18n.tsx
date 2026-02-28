import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export type Lang = "en" | "fr";

// ── Month names ──────────────────────────────────
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// ── Translation keys ─────────────────────────────
const translations = {
  // App / header
  "app.switchTree": { en: "Switch family tree", fr: "Changer d'arbre" },
  "app.noTree": { en: "No tree", fr: "Aucun arbre" },
  "app.familyTrees": { en: "Family Trees", fr: "Arbres généalogiques" },
  "app.people": { en: "people", fr: "personnes" },
  "app.newTree": { en: "+ New Tree", fr: "+ Nouvel arbre" },
  "app.rename": { en: "Rename", fr: "Renommer" },
  "app.delete": { en: "Delete", fr: "Supprimer" },
  "app.tree": { en: "🌲 Tree", fr: "🌲 Arbre" },
  "app.map": { en: "🗺️ Map", fr: "🗺️ Carte" },
  "app.addPerson": { en: "+ Add Person", fr: "+ Ajouter" },
  "app.loadingTree": { en: "Loading tree…", fr: "Chargement…" },
  "app.promptNewTree": { en: "Name for the new tree:", fr: "Nom du nouvel arbre :" },
  "app.promptRename": { en: "Rename tree:", fr: "Renommer l'arbre :" },
  "app.confirmDelete": { en: 'Delete tree "{name}"? This cannot be undone.', fr: 'Supprimer l\'arbre « {name} » ? Cette action est irréversible.' },

  // TreeView
  "tree.addChild": { en: "👶 Add Child", fr: "👶 Ajouter enfant" },
  "tree.addParent": { en: "👪 Add Parent", fr: "👪 Ajouter parent" },
  "tree.partnerLink": { en: " (+ partner link)", fr: " (+ lien conjoint)" },
  "tree.maxReached": { en: " (max reached)", fr: " (max atteint)" },
  "tree.legend": { en: "Legend", fr: "Légende" },
  "tree.male": { en: "Male", fr: "Homme" },
  "tree.female": { en: "Female", fr: "Femme" },
  "tree.parentChild": { en: "Parent → Child", fr: "Parent → Enfant" },
  "tree.siblings": { en: "Siblings", fr: "Fratrie" },
  "tree.partnerMarriage": { en: "Partner / Marriage", fr: "Conjoint / Mariage" },

  // MapView
  "map.birth": { en: "Birth", fr: "Naissance" },
  "map.death": { en: "Death", fr: "Décès" },
  "map.born": { en: "Born", fr: "Né(e)" },
  "map.died": { en: "Died", fr: "Décédé(e)" },
  "map.bornLabel": { en: "Born:", fr: "Né(e) :" },
  "map.diedLabel": { en: "Died:", fr: "Décédé(e) :" },
  "map.thisLocation": { en: "This location", fr: "Ce lieu" },
  "map.entries": { en: "entries", fr: "entrées" },
  "map.pause": { en: "Pause", fr: "Pause" },
  "map.play": { en: "Play", fr: "Lecture" },
  "map.resetToEnd": { en: "Reset to end", fr: "Remettre à la fin" },
  "map.animSettings": { en: "Animation settings", fr: "Paramètres d'animation" },
  "map.animSettingsTitle": { en: "Animation Settings", fr: "Paramètres d'animation" },
  "map.stepYears": { en: "Step (years)", fr: "Pas (années)" },
  "map.speedMs": { en: "Speed (ms)", fr: "Vitesse (ms)" },

  // DetailPanel – edit mode
  "detail.cancel": { en: "Cancel", fr: "Annuler" },
  "detail.editPerson": { en: "Edit Person", fr: "Modifier la personne" },
  "detail.firstName": { en: "First name", fr: "Prénom" },
  "detail.lastName": { en: "Last name", fr: "Nom" },
  "detail.middleNames": { en: "Middle names", fr: "Autres prénoms" },
  "detail.maidenName": { en: "Maiden name", fr: "Nom de jeune fille" },
  "detail.gender": { en: "Gender", fr: "Genre" },
  "detail.genderMale": { en: "Male", fr: "Homme" },
  "detail.genderFemale": { en: "Female", fr: "Femme" },
  "detail.genderOther": { en: "Other", fr: "Autre" },
  "detail.birthDate": { en: "Birth date", fr: "Date de naissance" },
  "detail.birthDatePlaceholder": { en: "e.g. 1990-07-22", fr: "ex. 1990-07-22" },
  "detail.deathDate": { en: "Death date", fr: "Date de décès" },
  "detail.deathDatePlaceholder": { en: "Leave empty if alive", fr: "Laisser vide si vivant" },
  "detail.birthPlace": { en: "Birth place", fr: "Lieu de naissance" },
  "detail.deathPlace": { en: "Death place", fr: "Lieu de décès" },
  "detail.searchPlaceholder": { en: "Start typing to search...", fr: "Commencez à taper..." },
  "detail.birthLat": { en: "Birth lat.", fr: "Lat. naissance" },
  "detail.birthLng": { en: "Birth lng.", fr: "Lng. naissance" },
  "detail.latPlaceholder": { en: "e.g. 48.8566", fr: "ex. 48.8566" },
  "detail.lngPlaceholder": { en: "e.g. 2.3522", fr: "ex. 2.3522" },
  "detail.birthPlaceDisplay": { en: "Birth place display name", fr: "Nom d'affichage du lieu de naissance" },
  "detail.deathPlaceDisplay": { en: "Death place display name", fr: "Nom d'affichage du lieu de décès" },
  "detail.historicalName": { en: "Old/historical name (optional)", fr: "Ancien nom / nom historique (optionnel)" },
  "detail.occupation": { en: "Occupation", fr: "Profession" },
  "detail.parentsUpTo2": { en: "Parents (up to 2)", fr: "Parents (2 max)" },
  "detail.partners": { en: "Partner(s)", fr: "Conjoint(s)" },
  "detail.marriageDetails": { en: "Marriage details", fr: "Détails du mariage" },
  "detail.marriageWith": { en: "💍 with {name}", fr: "💍 avec {name}" },
  "detail.marriageDate": { en: "Marriage date", fr: "Date de mariage" },
  "detail.marriagePlace": { en: "Marriage place", fr: "Lieu de mariage" },
  "detail.placeDisplayName": { en: "Place display name", fr: "Nom d'affichage du lieu" },
  "detail.notes": { en: "Notes", fr: "Notes" },
  "detail.save": { en: "Save", fr: "Enregistrer" },

  // DetailPanel – view mode
  "detail.close": { en: "Close", fr: "Fermer" },
  "detail.nee": { en: "née", fr: "née" },
  "detail.born": { en: "Born", fr: "Né(e)" },
  "detail.died": { en: "Died", fr: "Décédé(e)" },
  "detail.parents": { en: "Parents", fr: "Parents" },
  "detail.partnersLabel": { en: "Partners:", fr: "Conjoints :" },
  "detail.children": { en: "Children", fr: "Enfants" },
  "detail.edit": { en: "Edit", fr: "Modifier" },
  "detail.remove": { en: "Remove", fr: "Supprimer" },
  "detail.confirmRemove": { en: "Remove {name} from the tree?", fr: "Supprimer {name} de l'arbre ?" },

  // AddPersonForm
  "add.title": { en: "Add Person", fr: "Ajouter une personne" },
  "add.firstName": { en: "First name", fr: "Prénom" },
  "add.lastName": { en: "Last name", fr: "Nom" },
  "add.middleNames": { en: "Middle names", fr: "Autres prénoms" },
  "add.middleNamesPlaceholder": { en: "e.g. Marie Jean", fr: "ex. Marie Jean" },
  "add.maidenName": { en: "Maiden name", fr: "Nom de jeune fille" },
  "add.gender": { en: "Gender", fr: "Genre" },
  "add.genderMale": { en: "Male", fr: "Homme" },
  "add.genderFemale": { en: "Female", fr: "Femme" },
  "add.genderOther": { en: "Other", fr: "Autre" },
  "add.birthDate": { en: "Birth date", fr: "Date de naissance" },
  "add.birthDatePlaceholder": { en: "e.g. 1990-07-22 or 1990", fr: "ex. 1990-07-22 ou 1990" },
  "add.deathDate": { en: "Death date", fr: "Date de décès" },
  "add.deathDatePlaceholder": { en: "Leave empty if alive", fr: "Laisser vide si vivant" },
  "add.birthPlace": { en: "Birth place", fr: "Lieu de naissance" },
  "add.deathPlace": { en: "Death place", fr: "Lieu de décès" },
  "add.searchPlaceholder": { en: "Start typing to search...", fr: "Commencez à taper..." },
  "add.birthPlaceDisplay": { en: "Birth place display name", fr: "Nom d'affichage du lieu de naissance" },
  "add.deathPlaceDisplay": { en: "Death place display name", fr: "Nom d'affichage du lieu de décès" },
  "add.historicalName": { en: "Old/historical name (optional)", fr: "Ancien nom / nom historique (optionnel)" },
  "add.birthLat": { en: "Birth latitude", fr: "Latitude de naissance" },
  "add.birthLng": { en: "Birth longitude", fr: "Longitude de naissance" },
  "add.latPlaceholder": { en: "e.g. 48.8566", fr: "ex. 48.8566" },
  "add.lngPlaceholder": { en: "e.g. 2.3522", fr: "ex. 2.3522" },
  "add.occupation": { en: "Occupation", fr: "Profession" },
  "add.parentsSelect": { en: "Parents (select up to 2)", fr: "Parents (2 max)" },
  "add.partners": { en: "Partner(s)", fr: "Conjoint(s)" },
  "add.notes": { en: "Notes", fr: "Notes" },
  "add.submit": { en: "Add Person", fr: "Ajouter la personne" },

  // Login
  "login.title": { en: "Genealogy", fr: "Généalogie" },
  "login.subtitle": { en: "Sign in to continue", fr: "Connectez-vous pour continuer" },
  "login.username": { en: "Username", fr: "Nom d'utilisateur" },
  "login.password": { en: "Password", fr: "Mot de passe" },
  "login.submit": { en: "Sign in", fr: "Se connecter" },
  "login.loggingIn": { en: "Signing in…", fr: "Connexion…" },
  "login.error": { en: "Invalid username or password", fr: "Nom d'utilisateur ou mot de passe incorrect" },

  // Auth / header
  "app.logout": { en: "Logout", fr: "Déconnexion" },
  "app.roleViewer": { en: "Viewer", fr: "Lecteur" },
  "app.roleEditor": { en: "Editor", fr: "Éditeur" },

  // useFamily fallback
  "family.untitled": { en: "Untitled", fr: "Sans titre" },
} as const;

export type TranslationKey = keyof typeof translations;

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
  months: string[];
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  months: MONTHS_EN,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>(() => {
    const stored = localStorage.getItem("genealogy-lang");
    return stored === "en" ? "en" : "fr";
  });

  const handleSetLang = useCallback((l: Lang) => {
    setLang(l);
    localStorage.setItem("genealogy-lang", l);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string>): string => {
      const entry = translations[key];
      let text: string = entry?.[lang] ?? entry?.en ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, v);
        }
      }
      return text;
    },
    [lang]
  );

  const months = useMemo(() => (lang === "fr" ? MONTHS_FR : MONTHS_EN), [lang]);

  const value = useMemo(() => ({ lang, setLang: handleSetLang, t, months }), [lang, handleSetLang, t, months]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
