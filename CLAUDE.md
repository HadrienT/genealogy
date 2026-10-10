# CLAUDE.md

Arbre généalogique de la famille Tramoni : vue arbre (canvas + dagre), carte des lieux (Leaflet/OSM), fiche détaillée par personne avec galerie de documents. L'interface est en FR/EN ; l'utilisateur échange en français.

## Architecture

- **Front** (`src/`) : React 19 + TypeScript + Vite 6, `base: '/genealogy/'`. Déployé sur GitHub Pages (`https://hadrient.github.io/genealogy/`) par `.github/workflows/deploy.yml` à chaque push sur `main`, avec `VITE_API_URL` (variable du repo GitHub) pointant vers l'API.
- **API** (`api/server.js` + `api/localBucket.js`) : Express 5. Déployée sur Cloud Run (service `genealogy-api`, région `europe-west1`, projet `quant-dev-442615`, URL `https://genealogy-api-ofxy3vpisq-ew.a.run.app`) via `cloudbuild.yaml` (image `api/Dockerfile`). Le déploiement de l'API est **manuel** : pousser sur `main` ne redéploie que le front. Commande : `gcloud builds submit --config cloudbuild.yaml --substitutions _REGION=europe-west1,_PROJECT_ID=quant-dev-442615,_REPOSITORY=genealogy-api,_SERVICE_NAME=genealogy-api,_GCS_BUCKET=quant-dev-442615-genealogy-data` (faire `npm run backup:prod` avant).
- En dev, Vite proxifie `/api` vers `http://localhost:3001`.

## Où sont stockées les données (personnes, mariages, documents)

Il n'y a **pas de base de données** : l'API lit/écrit des fichiers JSON dans un « bucket », qui est soit un bucket Google Cloud Storage, soit un dossier local.

| Mode | Activé par | Emplacement |
|---|---|---|
| Production | `GCS_BUCKET` sur Cloud Run | **`gs://quant-dev-442615-genealogy-data`** (projet GCP `quant-dev-442615`) |
| Local | `LOCAL_DATA_DIR=...` | un dossier sur disque (voir ci-dessous) |

### ⚠️ La version de référence des données est en PRODUCTION

L'utilisateur saisit ses données via le site en ligne, donc **la dernière version est toujours dans le bucket GCS**, pas dans le repo ni dans `api/.localdata/`.

- `api/.localdata/` est une **vieille copie** (38 personnes au 7 sept. 2026, alors que la prod en avait 134 le 27 sept.). Ne jamais la considérer comme à jour et ne jamais la pousser vers le bucket.
- `backups/prod-<horodatage>/` : instantanés complets du bucket, créés par `npm run backup:prod` (`scripts/backup-prod.sh`, lecture seule côté bucket). Git-ignoré.
- **Avant toute opération qui touche aux données** (migration, script, changement du format de sauvegarde, déploiement de l'API), faire d'abord `npm run backup:prod`.
- Ne jamais écrire dans le bucket de prod (`gcloud storage cp/rm` vers `gs://…`) sans l'accord explicite de l'utilisateur.
- Pour travailler en local sur des données réelles : `cd api && LOCAL_DATA_DIR=../backups/prod-<horodatage> node server.js`. Le front peut réécrire l'arbre au chargement (backfill géocodage), donc mieux vaut travailler sur une copie de l'instantané.
- Les écritures faites en local ne remontent **pas** en prod.

Le versioning GCS est activé sur le bucket (et la suppression douce dure 7 jours). Chaque `PUT` crée une nouvelle version, qu'on peut lister avec `gcloud storage ls -a gs://quant-dev-442615-genealogy-data/<fichier>`. Une règle de cycle de vie supprime les anciennes versions 90 jours après leur remplacement (depuis le 27 sept. 2026 ; avant, elle n'en gardait que 5). Les instantanés `backups/` restent le filet de sécurité principal.

Organisation du bucket / dossier :

```
<id-arbre>.json          # un fichier par arbre : { id, name, version, people: Person[], marriages: Marriage[] }
_users.json              # comptes : { id, username, passwordHash (bcrypt), role: "editor"|"viewer" }
docs/<personId>/_meta.json         # métadonnées des documents d'une personne
docs/<personId>/<docId>.<ext>      # fichiers (photos, PDF…) — jusqu'à 20 Mo
```

- Les **personnes** sont dans le tableau `people` du JSON de l'arbre ; les **mariages** dans `marriages` (date/lieu d'une union, clé = paire `partnerIds`).
- L'arbre réel est `9bdbb8de-3c23-4243-b0bd-3622eb59ab9e.json` (« Tramoni »). La personne `id: "me"` est Hadrien.
- `listAllTrees()` considère tout `*.json` à la racine comme un arbre, sauf les fichiers qui commencent par `_` (comme `_users.json`).
- Au premier démarrage sur un stockage vide, l'API crée un arbre de démo et les utilisateurs de `SEED_USERS`.
- `src/data/sampleData.ts` n'est plus utilisé ; le README qui parle de `localStorage` pour les données est obsolète (localStorage ne garde que le token JWT `genealogy-auth-token`, l'arbre courant `genealogy-last-tree-id` et la langue `genealogy-lang`).

## Modèle de données

Défini dans `src/types/person.ts`. Tout est optionnel sauf `id`.

- Relations par ID : `parentIds` ↔ `childrenIds`, `partnerIds` symétrique. En pratique, **la prod ne remplit souvent que `parentIds`** (et `childrenIds` reste vide) : l'affichage se base sur `parentIds`, et tout script qui cherche les enfants doit partir des `parentIds` des enfants. Les nouvelles écritures doivent garder les deux côtés cohérents (voir `addPerson` / `removePerson` dans `src/hooks/useFamily.tsx`).
- Dates ISO partielles : `"1842"`, `"1842-03"`, `"1842-03-15"`.
- Lieux : `birthPlace` (texte Nominatim complet), `birthPlaceDisplay` (nom historique affiché), `birthCoordinates`, plus des champs structurés `birthCity`, `birthCountryCode`, `birthCountry`, `birthPostcode`, `birthCounty`, `birthDeptCode` (idem pour `death*`, et sans préfixe pour `Marriage`).
- `review` (optionnel) : marqueur « à relire » posé par un import sur un **arbre brouillon** (`status` new/updated/conflict, `sources` = photos, `notes`, `changes`, `uncertain`). L'app surligne ces cartes, les liste avec le bouton « Suivant à relire », et le bouton « Marquer comme relu » du panneau supprime le marqueur. Ce champ ne doit pas partir tel quel en prod.
- Au chargement d'un arbre, `backfillAddressFields` géocode en inverse (Nominatim, 1 req/s) les personnes ayant des coordonnées sans ville, puis réenregistre l'arbre.

## Brouillons d'import (`drafts/`, git-ignoré)

Pour ajouter beaucoup de personnes (par exemple depuis des photos d'un arbre papier), on ne touche pas à la prod : on crée un **dossier de données local** avec un arbre brouillon, sous un id différent de l'arbre réel.

- `drafts/photos-20260927/` : transcription des 42 photos `images/2026092*.jpg` de l'arbre papier des ascendants de Floranne BERNARD (768 nouvelles personnes). Il est construit à partir de l'instantané `backups/prod-20260927-215026`. Les photos sources sont dans `sources/`, rattachées à chaque personne comme documents.
- `drafts/<nom>/_import/` : saisie brute (`ocr.dsl`, une ligne par personne et par union), scripts `merge.py` (rapprochement avec la prod, champs `review`) et `geo.py` (géocodage Nominatim en cache), et notes de lecture.
- Lancer : `cd api && LOCAL_DATA_DIR=../drafts/photos-20260927 node server.js`, puis `npm run dev`. On se connecte avec les comptes habituels (`_users.json` est copié de la prod).
- **Le brouillon photos est aussi en prod depuis le 28 sept. 2026**, comme arbre séparé `d7a1f0e2-….json` (« Tramoni — brouillon photos »), pour que l'utilisateur puisse le relire en ligne. C'est la version en ligne qui fait foi, pas le dossier local. Version envoyée : `drafts/photos-20260927-prod/`. Les 134 personnes reprises de la prod y ont des ids propres, `uuid5(NAMESPACE_URL, "genealogy-draft:photos-20260927:<idProd>")`, recalculables à la fusion (table dans `_import-idmap.json`, locale seulement). Leurs documents ne partagent donc rien avec l'arbre réel. Les photos sources sont dans `gs://…/sources/photos-20260927/` et sont partagées par plusieurs fiches : supprimer une de ces photos depuis une fiche la supprime pour toutes (la route DELETE efface le fichier `gcsPath`).
- Reporter un brouillon relu vers la prod demande une fusion avec l'arbre de prod **à jour** (il a pu changer entre-temps), une sauvegarde préalable et l'accord explicite de l'utilisateur.

## Flux de sauvegarde

`useFamily` garde l'arbre en état React ; chaque modification appelle `persist()` qui fait un `PUT /api/trees/:id` avec l'arbre **complet** (écrasement total, pas de fusion).

Protection contre l'écrasement : le JSON de l'arbre porte un champ `version`, que l'API incrémente à chaque écriture (`PUT` et `PATCH`). Le front envoie `baseVersion` (la version qu'il a chargée) ; si l'arbre a changé entre-temps, l'API répond **409** et n'écrit rien, et le front affiche un bandeau « Recharger l'arbre » (la modification refusée est perdue, il n'y a pas de fusion). Les sauvegardes d'un même arbre partent une par une (`persistTree` / `flushSaves` dans `useFamily.tsx`). Un client qui n'envoie pas `baseVersion` garde l'ancien comportement (le dernier qui écrit gagne), donc front et API peuvent être déployés dans n'importe quel ordre. Le verrou côté API est par instance Cloud Run : deux instances simultanées pourraient encore se croiser.

## API (toutes les routes sauf login exigent `Authorization: Bearer <jwt>`)

- `POST /api/login`, `GET /api/me`
- `GET /api/trees`, `GET /api/trees/:id`
- `POST|PUT|PATCH|DELETE /api/trees[/:id]` — rôle `editor`
- `GET /api/persons/:personId/documents[/:docId]` — `?download=1` réservé aux éditeurs
- `POST|DELETE /api/persons/:personId/documents[/:docId]` — rôle `editor`

Rôles : `editor` (tout) et `viewer` (lecture seule, documents affichés inline sans téléchargement).

## Lancer en local

```bash
# API (terminal 1)
cd api && npm install
LOCAL_DATA_DIR=./.localdata node server.js      # SEED_USERS='[...]' seulement si le dossier est vide

# Front (terminal 2)
npm install && npm run dev                      # http://localhost:5173/genealogy/
```

Vérifications : `npm run build` (inclut `tsc -b`) et `npm run lint`. Il n'y a pas de tests.

## Carte du code front

- `src/App.tsx` — en-tête (sélecteur d'arbres, recherche, incohérences), onglets Arbre/Carte/Statistiques, bandeau de conflit, garde d'authentification.
- `src/hooks/useFamily.tsx` — état de l'arbre, appels API, CRUD personnes/mariages, backfill géocodage.
- `src/hooks/useAuth.tsx` — login JWT. `src/hooks/useI18n.tsx` — traductions FR/EN (ajouter toute nouvelle chaîne dans les deux langues).
- `src/utils/treeLayout.ts` — géométrie de l'arbre : cartes `person` + nœuds `union` (couple), positionnés par dagre. Le résultat de dagre (~1 s pour 900 personnes) est gardé en cache tant que les liens ne changent pas.
- `src/utils/treeFold.ts` — pliage : on n'affiche que la personne de départ (`me`, sinon la personne sans enfant qui a le plus d'ascendants), N générations au-dessus (4 par défaut) et les branches dépliées à la main. C'est un filtre d'affichage, il n'écrit rien dans l'arbre.
- `src/utils/treeRenderer.ts` — rendu de l'arbre sur un `<canvas>` (déplacement, zoom, clics, mini-carte), hors de React. Les cartes ne sont pas des éléments DOM : leur apparence est dans ce fichier, pas dans le CSS.
- `src/utils/checks.ts` — détection d'incohérences (dates et liens impossibles), en lecture seule ; affichée par `IssuesMenu` (en-tête) et dans `DetailPanel`. Les seuils (âges limites) sont en tête du fichier.
- `src/utils/stats.ts` + `StatsView` — onglet Statistiques (barres en HTML/CSS, pas de bibliothèque de graphiques).
- `src/components/` — `SearchBox` (recherche par nom, raccourci `/`), `TreeView` (barre d'outils, menu contextuel), `TreeCanvas` (enveloppe React du renderer), `MapView` (épingles, curseur temporel, mode « vivants cette année-là », lignes de migration), `DetailPanel`, `AddPersonForm`, `PlaceAutocomplete` (recherche Nominatim), `DocumentGallery`, `LoginPage`.
- Styles : un seul `src/index.css` (thème « patrimoine »).

## Points d'attention connus

- La révision Cloud Run `genealogy-api-00010` (7 sept.) n'a jamais démarré, parce que le Dockerfile ne copiait pas `localBucket.js`. C'est corrigé, et la révision `00013` a été déployée le 27 sept. Tout nouveau déploiement doit copier tous les `.js` dont `server.js` a besoin.
- Les noms de documents avec accents ou caractères non ASCII faisaient échouer l'affichage (erreur 500 sur `Content-Disposition`). C'est corrigé dans `api/server.js` (encodage RFC 6266), mais il faut **redéployer l'API** pour que la prod en profite.
- `JWT_SECRET` doit être défini comme variable d'environnement du service Cloud Run (il ne figure pas dans le repo). `cloudbuild.yaml` utilise `--update-env-vars` pour ne pas l'effacer à chaque déploiement : ne pas revenir à `--set-env-vars`, qui remplace toutes les variables. Sans ce secret, l'API utilise la valeur publique `dev-secret-change-me` et n'importe qui peut forger un jeton `editor`.
- CORS autorise uniquement `hadrient.github.io` et localhost.
