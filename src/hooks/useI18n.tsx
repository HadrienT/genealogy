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
  "app.stats": { en: "📊 Statistics", fr: "📊 Statistiques" },
  "app.conflict": {
    en: "This tree was changed from another tab or device. Your last edit was not saved.",
    fr: "Cet arbre a été modifié depuis un autre onglet ou appareil. Votre dernière modification n'a pas été enregistrée.",
  },
  "app.reload": { en: "Reload the tree", fr: "Recharger l'arbre" },

  // Search
  "search.placeholder": { en: "Search a name…", fr: "Chercher un nom…" },
  "search.shortcut": { en: "Shortcut: / or Ctrl+K", fr: "Raccourci : / ou Ctrl+K" },
  "search.none": { en: "No match", fr: "Aucun résultat" },
  "search.more": { en: "and {n} more: type more letters", fr: "et {n} autres : précisez la recherche" },

  // Consistency checks
  "issue.count": { en: "{n} inconsistencies", fr: "{n} incohérences" },
  "issue.title": { en: "Dates and links to check", fr: "Dates et liens à vérifier" },
  "issue.panelTitle": { en: "To check", fr: "À vérifier" },
  "issue.deathBeforeBirth": { en: "Died ({death}) before being born ({birth})", fr: "Décès ({death}) avant la naissance ({birth})" },
  "issue.tooOld": { en: "Would have lived more than {age} years", fr: "Aurait vécu plus de {age} ans" },
  "issue.futureDate": { en: "Date in the future ({year})", fr: "Date dans le futur ({year})" },
  "issue.parentTooYoung": {
    en: "Born in {birth}, but parent {other} was born in {parentBirth}",
    fr: "Naissance en {birth}, alors que son parent {other} est né en {parentBirth}",
  },
  "issue.motherTooOld": { en: "Mother {other} would have been over {age} at the birth", fr: "Sa mère {other} aurait eu plus de {age} ans à la naissance" },
  "issue.fatherTooOld": { en: "Father {other} would have been over {age} at the birth", fr: "Son père {other} aurait eu plus de {age} ans à la naissance" },
  "issue.bornAfterParentDeath": { en: "Born in {birth}, after the death of {other} ({death})", fr: "Naissance en {birth}, après le décès de {other} ({death})" },
  "issue.marriageBeforeBirth": {
    en: "Married {other} in {marriage}, before being born ({birth})",
    fr: "Mariage avec {other} en {marriage}, avant sa naissance ({birth})",
  },
  "issue.marriageTooYoung": {
    en: "Married {other} in {marriage}, aged {age} at most (born in {birth})",
    fr: "Mariage avec {other} en {marriage}, à {age} ans au plus (naissance en {birth})",
  },
  "issue.marriageAfterDeath": { en: "Married {other} in {marriage}, after dying ({death})", fr: "Mariage avec {other} en {marriage}, après son décès ({death})" },
  "issue.tooManyParents": { en: "{n} parents recorded", fr: "{n} parents enregistrés" },
  "issue.unknownLink": { en: "{n} link(s) to someone missing from the tree ({field})", fr: "{n} lien(s) vers une personne absente de l'arbre ({field})" },
  "issue.ownRelative": { en: "Listed among their own {field}", fr: "Figure parmi ses propres {field}" },
  "issue.field.parents": { en: "parents", fr: "parents" },
  "issue.field.partners": { en: "partners", fr: "conjoints" },
  "issue.field.children": { en: "children", fr: "enfants" },

  // Statistics
  "stats.people": { en: "people", fr: "personnes" },
  "stats.menWomen": { en: "{men} men · {women} women", fr: "{men} hommes · {women} femmes" },
  "stats.generations": { en: "generations", fr: "générations" },
  "stats.above": { en: "above {name}", fr: "au-dessus de {name}" },
  "stats.ancestors": { en: "known ancestors", fr: "ancêtres connus" },
  "stats.period": { en: "birth years covered", fr: "années de naissance couvertes" },
  "stats.withBirthDate": { en: "with a birth date", fr: "avec une date de naissance" },
  "stats.withBirthPlace": { en: "with a birth place", fr: "avec un lieu de naissance" },
  "stats.marriages": { en: "marriages", fr: "mariages" },
  "stats.completeness": { en: "Ancestors known per generation", fr: "Ancêtres connus par génération" },
  "stats.completenessHint": {
    en: "Ancestors of {name} found in the tree, out of the number each generation can hold.",
    fr: "Ancêtres de {name} présents dans l'arbre, sur le nombre que chaque génération peut compter.",
  },
  "stats.generationN": { en: "Generation {n}", fr: "Génération {n}" },
  "stats.births": { en: "Births per half-century", fr: "Naissances par demi-siècle" },
  "stats.longevity": { en: "Average age at death, by century of birth", fr: "Âge moyen au décès, par siècle de naissance" },
  "stats.longevityHint": {
    en: "People with both dates known. Deaths in infancy were rarely written on family trees, so real averages were lower.",
    fr: "Personnes dont les deux dates sont connues. Les décès en bas âge figurent rarement sur les arbres : les moyennes réelles étaient plus basses.",
  },
  "stats.parentAge": { en: "Average age at a child's birth", fr: "Âge moyen à la naissance d'un enfant" },
  "stats.marriageAge": { en: "Average age at marriage", fr: "Âge moyen au mariage" },
  "stats.fathers": { en: "Fathers", fr: "Pères" },
  "stats.mothers": { en: "Mothers", fr: "Mères" },
  "stats.men": { en: "Men", fr: "Hommes" },
  "stats.women": { en: "Women", fr: "Femmes" },
  "stats.surnames": { en: "Most common surnames", fr: "Noms les plus fréquents" },
  "stats.firstNamesMen": { en: "Most common first names, men", fr: "Prénoms masculins les plus fréquents" },
  "stats.firstNamesWomen": { en: "Most common first names, women", fr: "Prénoms féminins les plus fréquents" },
  "stats.places": { en: "Most common birth places", fr: "Lieux de naissance les plus fréquents" },
  "stats.regions": { en: "Births by département or country", fr: "Naissances par département ou pays" },
  "stats.years": { en: "{n} yrs", fr: "{n} ans" },
  "stats.sample": { en: "over {n}", fr: "sur {n}" },
  "stats.none": { en: "Not enough data", fr: "Pas assez de données" },
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
  "tree.generations": { en: "Generations", fr: "Générations" },
  "tree.fewerGenerations": { en: "One generation fewer", fr: "Une génération de moins" },
  "tree.moreGenerations": { en: "One generation more", fr: "Une génération de plus" },
  "tree.showAll": { en: "Show all", fr: "Tout afficher" },
  "tree.foldBack": { en: "Fold back", fr: "Replier" },
  "tree.shown": { en: "{n} of {total} shown", fr: "{n} sur {total} affichées" },
  "tree.zoomIn": { en: "Zoom in", fr: "Zoomer" },
  "tree.zoomOut": { en: "Zoom out", fr: "Dézoomer" },
  "tree.fit": { en: "Fit everything on screen", fr: "Tout faire tenir à l'écran" },
  "tree.focusHere": { en: "🎯 Start the tree from this person", fr: "🎯 Partir de cette personne" },
  "tree.focusedOn": { en: "From: {name}", fr: "Depuis : {name}" },
  "tree.focusReset": { en: "Back to the usual starting person", fr: "Revenir à la personne de départ habituelle" },
  "tree.folded": { en: "Folded ancestors (click to unfold)", fr: "Ascendants repliés (cliquer pour déplier)" },
  "tree.legend": { en: "Legend", fr: "Légende" },
  "tree.male": { en: "Male", fr: "Homme" },
  "tree.female": { en: "Female", fr: "Femme" },
  "tree.parentChild": { en: "Parent → Child", fr: "Parent → Enfant" },
  "tree.siblings": { en: "Siblings", fr: "Fratrie" },
  "tree.partnerMarriage": { en: "Partner / Marriage", fr: "Conjoint / Mariage" },
  "tree.reviewNew": { en: "New (to review)", fr: "Nouveau (à relire)" },
  "tree.reviewUpdated": { en: "Completed (to review)", fr: "Complété (à relire)" },
  "tree.reviewConflict": { en: "Conflict", fr: "Divergence" },
  "tree.reviewUncertain": { en: "Inferred link", fr: "Lien déduit" },

  // Import review
  "review.pending": { en: "{n} to review", fr: "{n} à relire" },
  "review.new": { en: "New person", fr: "Nouvelle personne" },
  "review.updated": { en: "Completed by the import", fr: "Complétée par l'import" },
  "review.conflict": { en: "Conflicting value", fr: "Valeur divergente" },
  "review.kept": { en: "kept", fr: "conservé" },
  "review.proposed": { en: "paper tree says", fr: "le tableau indique" },
  "review.sources": { en: "Source photos", fr: "Photos sources" },
  "review.next": { en: "Next to review → ({n})", fr: "Suivant à relire → ({n})" },
  "review.validate": { en: "✓ Mark as reviewed", fr: "✓ Marquer comme relu" },

  // MapView
  "map.birth": { en: "Birth", fr: "Naissance" },
  "map.death": { en: "Death", fr: "Décès" },
  "map.alive": { en: "Alive that year", fr: "Vivants cette année-là" },
  "map.aliveHint": {
    en: "Only show people alive in the year of the slider, instead of everyone born up to it",
    fr: "N'afficher que les personnes en vie l'année du curseur, au lieu de toutes celles nées jusque-là",
  },
  "map.migrations": { en: "Migrations", fr: "Migrations" },
  "map.migrationsHint": {
    en: "Lines from each parent's birth place to their child's (and from birth to death place when deaths are shown)",
    fr: "Lignes du lieu de naissance de chaque parent vers celui de son enfant (et de la naissance au décès quand les décès sont affichés)",
  },
  "map.moves": { en: "{n} people", fr: "{n} personnes" },
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

  // Documents
  "docs.title": { en: "Documents", fr: "Documents" },
  "docs.upload": { en: "📎 Upload", fr: "📎 Importer" },
  "docs.uploading": { en: "Uploading…", fr: "Import…" },
  "docs.loading": { en: "Loading…", fr: "Chargement…" },
  "docs.empty": { en: "No documents yet", fr: "Aucun document" },
  "docs.download": { en: "Download", fr: "Télécharger" },
  "docs.delete": { en: "Delete", fr: "Supprimer" },
  "docs.confirmDelete": { en: "Delete this document?", fr: "Supprimer ce document ?" },
  "docs.noPreview": { en: "Preview not available", fr: "Aperçu non disponible" },

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
