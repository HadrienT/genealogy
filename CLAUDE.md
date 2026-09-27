# CLAUDE.md

Arbre généalogique de la famille Tramoni : vue arbre (ReactFlow + dagre), carte des lieux (Leaflet/OSM), fiche détaillée par personne avec galerie de documents. L'interface est en FR/EN ; l'utilisateur échange en français.

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

Le versioning GCS est activé sur le bucket (et la suppression douce dure 7 jours). Chaque `PUT` crée une nouvelle version, qu'on peut lister avec `gcloud storage ls -a gs://quant-dev-442615-genealogy-data/<fichier>`. Une règle de cycle de vie purge les anciennes versions (au 27 sept. 2026, elle n'en gardait que 5 par fichier, soit quelques minutes d'édition). Les instantanés `backups/` restent le filet de sécurité principal.

Organisation du bucket / dossier :

```
<id-arbre>.json          # un fichier par arbre : { id, name, people: Person[], marriages: Marriage[] }
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

- Relations par ID, **stockées dans les deux sens** : `parentIds` ↔ `childrenIds`, `partnerIds` symétrique. Toute modification doit garder les deux côtés cohérents (voir `addPerson` / `removePerson` dans `src/hooks/useFamily.tsx`).
- Dates ISO partielles : `"1842"`, `"1842-03"`, `"1842-03-15"`.
- Lieux : `birthPlace` (texte Nominatim complet), `birthPlaceDisplay` (nom historique affiché), `birthCoordinates`, plus des champs structurés `birthCity`, `birthCountryCode`, `birthCountry`, `birthPostcode`, `birthCounty`, `birthDeptCode` (idem pour `death*`, et sans préfixe pour `Marriage`).
- Au chargement d'un arbre, `backfillAddressFields` géocode en inverse (Nominatim, 1 req/s) les personnes ayant des coordonnées sans ville, puis réenregistre l'arbre.

## Flux de sauvegarde

`useFamily` garde l'arbre en état React ; chaque modification appelle `persist()` qui fait un `PUT /api/trees/:id` avec l'arbre **complet** (écrasement total, pas de fusion ni de verrou). Deux éditeurs simultanés s'écrasent mutuellement.

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

- `src/App.tsx` — en-tête, sélecteur d'arbres, onglets Arbre/Carte, garde d'authentification.
- `src/hooks/useFamily.tsx` — état de l'arbre, appels API, CRUD personnes/mariages, backfill géocodage.
- `src/hooks/useAuth.tsx` — login JWT. `src/hooks/useI18n.tsx` — traductions FR/EN (ajouter toute nouvelle chaîne dans les deux langues).
- `src/utils/treeLayout.ts` — calcul du graphe : nœuds `person` + nœuds `union` (couple), positionnés par dagre.
- `src/components/` — `TreeView`, `PersonNode`, `UnionNode`, `MapView`, `DetailPanel`, `AddPersonForm`, `PlaceAutocomplete` (recherche Nominatim), `DocumentGallery`, `LoginPage`.
- Styles : un seul `src/index.css` (thème « patrimoine »).

## Points d'attention connus

- La révision Cloud Run `genealogy-api-00010` (7 sept.) n'a jamais démarré, parce que le Dockerfile ne copiait pas `localBucket.js` (corrigé depuis). La prod tourne toujours sur la révision `00009`. Tout nouveau déploiement doit copier tous les `.js` dont `server.js` a besoin.
- `JWT_SECRET` doit être défini comme variable d'environnement du service Cloud Run (il ne figure pas dans le repo). `cloudbuild.yaml` utilise `--update-env-vars` pour ne pas l'effacer à chaque déploiement : ne pas revenir à `--set-env-vars`, qui remplace toutes les variables. Sans ce secret, l'API utilise la valeur publique `dev-secret-change-me` et n'importe qui peut forger un jeton `editor`.
- CORS autorise uniquement `hadrient.github.io` et localhost.
