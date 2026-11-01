# CLAUDE.md

Family tree app: tree view (canvas + dagre), map of places (Leaflet/OSM), detailed page per person with a document gallery. The interface is in FR/EN.

- **Language: English by default.** Everything you produce is in English: code, identifiers, comments, commit messages, PRs, issues, documentation and interface text. The only exception is the conversation: reply in the language the maintainer writes in, so in French when they write in French. Interface strings remain available in both FR and EN (see `useI18n`).

## This repository is public

GitHub Pages hosting requires a public repository, and the login only protects the data served by the API. **Nothing that identifies the family goes in the repository**, including comments, commit messages, examples and test data: no real names (even first names alone), dates, places, tree ids, or cloud project and bucket names. Real values go in `CLAUDE.local.md` and `.env.local` (git-ignored). The demo data in `src/data/sampleData.ts` and `api/server.js` is fictional. Commits use the GitHub `noreply` address.

## Architecture

- **Front end** (`src/`): React 19 + TypeScript + Vite 6, `base: '/genealogy/'`. Deployed on GitHub Pages (`https://hadrient.github.io/genealogy/`) by `.github/workflows/deploy.yml` on each push to `main`, with `VITE_API_URL` (GitHub repository variable) pointing to the API.
- **API** (`api/server.js` + `api/localBucket.js`): Express 5. Deployed on Cloud Run (service `genealogy-api`, region `europe-west1`) through `cloudbuild.yaml` (image `api/Dockerfile`). API deployment is **manual**: pushing to `main` only redeploys the front end. The exact command, with the real project and bucket names, is in `CLAUDE.local.md` (run `npm run backup:prod` first).
- In dev, Vite proxies `/api` to `http://localhost:3001`.

## Where the data is stored (people, marriages, documents)

There is **no database**: the API reads and writes JSON files in a "bucket", which is either a Google Cloud Storage bucket or a local directory.

| Mode | Enabled by | Location |
|---|---|---|
| Production | `GCS_BUCKET` on Cloud Run | the production bucket (named in `CLAUDE.local.md`) |
| Local | `LOCAL_DATA_DIR=...` | a directory on disk (see below) |

### ⚠️ The reference version of the data is in PRODUCTION

The user enters data through the live site, so **the latest version is always in the GCS bucket**, not in the repository or in `api/.localdata/`.

- `api/.localdata/` is an **old copy** (38 people on Sept. 7, 2026, while production had 134 on Sept. 27). Never treat it as up to date and never push it to the bucket.
- `backups/prod-<timestamp>/`: full snapshots of the bucket, created by `npm run backup:prod` (`scripts/backup-prod.sh`, read-only on the bucket side). Git-ignored.
- **Before any operation touching the data** (migration, script, change of the save format, API deployment), first run `npm run backup:prod`.
- Never write to the production bucket (`gcloud storage cp/rm` to `gs://…`) without the user's explicit agreement.
- To work locally on real data: `cd api && LOCAL_DATA_DIR=../backups/prod-<timestamp> node server.js`. The front end may rewrite the tree on load (geocoding backfill), so it is better to work on a copy of the snapshot.
- Writes made locally do **not** go back to production.

GCS versioning is enabled on the bucket (and soft delete lasts 7 days). Each `PUT` creates a new version, which can be listed with `gcloud storage ls -a gs://<bucket>/<file>`. A lifecycle rule deletes old versions 90 days after they are replaced (since Sept. 27, 2026; before, it only kept 5). The `backups/` snapshots remain the main safety net.

Layout of the bucket / directory:

```
<tree-id>.json           # one file per tree: { id, name, version, people: Person[], marriages: Marriage[] }
_users.json              # accounts: { id, username, passwordHash (bcrypt), role: "editor"|"viewer" }
docs/<personId>/_meta.json         # metadata of a person's documents
docs/<personId>/<docId>.<ext>      # files (photos, PDFs…), up to 20 MB
```

- **People** are in the `people` array of the tree's JSON; **marriages** in `marriages` (date/place of a union, key = `partnerIds` pair).
- The id of the real tree is in `CLAUDE.local.md`. The person with `id: "me"` is the maintainer.
- `listAllTrees()` treats any `*.json` at the root as a tree, except files starting with `_` (such as `_users.json`).
- On first start with empty storage, the API creates a demo tree and the users from `SEED_USERS`.
- `src/data/sampleData.ts` is no longer used. `localStorage` only keeps the JWT token `genealogy-auth-token`, the current tree `genealogy-last-tree-id` and the language `genealogy-lang`.

## Data model

Defined in `src/types/person.ts`. Everything is optional except `id`.

- Relations by ID: `parentIds` ↔ `childrenIds`, `partnerIds` symmetric. In practice, **production often only fills `parentIds`** (and `childrenIds` stays empty): the display relies on `parentIds`, and any script looking for children must start from the children's `parentIds`. New writes must keep both sides consistent (see `addPerson` / `removePerson` in `src/hooks/useFamily.tsx`).
- Partial ISO dates: `"1842"`, `"1842-03"`, `"1842-03-15"`.
- Places: `birthPlace` (full Nominatim text), `birthPlaceDisplay` (displayed historical name), `birthCoordinates`, plus structured fields `birthCity`, `birthCountryCode`, `birthCountry`, `birthPostcode`, `birthCounty`, `birthDeptCode` (same for `death*`, and without prefix for `Marriage`).
- `review` (optional): "to review" marker set by an import on a **draft tree** (`status` new/updated/conflict, `sources` = photos, `notes`, `changes`, `uncertain`). The app highlights these cards, lists them with the "Next to review" button, and the panel's "Mark as reviewed" button removes the marker. This field must not go to production as is.
- On loading a tree, `backfillAddressFields` reverse-geocodes (Nominatim, 1 req/s) people with coordinates but no city, then saves the tree again.

## Import drafts (`drafts/`, git-ignored)

To add many people (for example from photos of a paper tree), production is not touched: create a **local data directory** with a draft tree, under an id different from the real tree.

- `drafts/photos-20260927/`: transcription of the 42 photos `images/2026092*.jpg` of a relative's paper tree of ancestors (768 new people). It is built from the snapshot `backups/prod-20260927-215026`. The source photos are in `sources/`, attached to each person as documents.
- `drafts/<name>/_import/`: raw entry (`ocr.dsl`, one line per person and per union), scripts `merge.py` (matching with production, `review` fields) and `geo.py` (cached Nominatim geocoding), and reading notes.
- Run: `cd api && LOCAL_DATA_DIR=../drafts/photos-20260927 node server.js`, then `npm run dev`. Log in with the usual accounts (`_users.json` is copied from production).
- **The photo draft has also been in production since Sept. 28, 2026**, as a separate tree (id in `CLAUDE.local.md`), so that the user can review it online. The online version is the reference, not the local directory. Version sent: `drafts/photos-20260927-prod/`. The 134 people taken from production have their own ids there, `uuid5(NAMESPACE_URL, "genealogy-draft:photos-20260927:<prodId>")`, which can be recomputed at merge time (table in `_import-idmap.json`, local only). Their documents therefore share nothing with the real tree. The source photos are in `gs://…/sources/photos-20260927/` and are shared by several pages: deleting one of these photos from a page deletes it for all of them (the DELETE route removes the `gcsPath` file).
- Bringing a reviewed draft to production requires a merge with the **up-to-date** production tree (it may have changed in the meantime), a prior backup and the user's explicit agreement.

## Save flow

`useFamily` keeps the tree in React state; each change calls `persist()`, which does a `PUT /api/trees/:id` with the **complete** tree (full overwrite, no merge).

Overwrite protection: the tree's JSON carries a `version` field, which the API increments on each write (`PUT` and `PATCH`). The front end sends `baseVersion` (the version it loaded); if the tree has changed in the meantime, the API answers **409** and writes nothing, and the front end shows a "Reload the tree" banner (the rejected change is lost, there is no merge). Saves of the same tree go out one at a time (`persistTree` / `flushSaves` in `useFamily.tsx`). A client that does not send `baseVersion` keeps the old behavior (last writer wins), so front end and API can be deployed in any order. The API-side lock is per Cloud Run instance: two simultaneous instances could still cross.

## API (all routes except login require `Authorization: Bearer <jwt>`)

- `POST /api/login`, `GET /api/me`
- `GET /api/trees`, `GET /api/trees/:id`
- `POST|PUT|PATCH|DELETE /api/trees[/:id]`: `editor` role
- `GET /api/persons/:personId/documents[/:docId]`: `?download=1` reserved for editors
- `POST|DELETE /api/persons/:personId/documents[/:docId]`: `editor` role

Roles: `editor` (everything) and `viewer` (read-only, documents shown inline without download).

## Running locally

```bash
# API (terminal 1)
cd api && npm install
LOCAL_DATA_DIR=./.localdata node server.js      # SEED_USERS='[...]' only if the directory is empty

# Front end (terminal 2)
npm install && npm run dev                      # http://localhost:5173/genealogy/
```

Checks: `npm run build` (includes `tsc -b`) and `npm run lint`. There are no tests.

## Front-end code map

- `src/App.tsx`: header (tree selector, search, inconsistencies), Tree/Map/Statistics tabs, conflict banner, authentication guard.
- `src/hooks/useFamily.tsx`: tree state, API calls, people/marriage CRUD, geocoding backfill.
- `src/hooks/useAuth.tsx`: JWT login. `src/hooks/useI18n.tsx`: FR/EN translations (add any new string in both languages).
- `src/utils/treeLayout.ts`: tree geometry: `person` cards + `union` (couple) nodes, positioned by dagre. The dagre result (~1 s for 900 people) is cached as long as the links do not change.
- `src/utils/treeFold.ts`: folding: only the starting person is shown (`me`, otherwise the childless person with the most ancestors), N generations above (4 by default) and the branches unfolded by hand. It is a display filter, it writes nothing to the tree.
- `src/utils/treeRenderer.ts`: rendering of the tree on a `<canvas>` (pan, zoom, clicks, minimap), outside React. Cards are not DOM elements: their appearance is in this file, not in the CSS.
- `src/utils/checks.ts`: detection of inconsistencies (impossible dates and links), read-only; shown by `IssuesMenu` (header) and in `DetailPanel`. The thresholds (age limits) are at the top of the file.
- `src/utils/stats.ts` + `StatsView`: Statistics tab (HTML/CSS bars, no chart library).
- `src/components/`: `SearchBox` (search by name, shortcut `/`), `TreeView` (toolbar, context menu), `TreeCanvas` (React wrapper of the renderer), `MapView` (pins, time slider, "alive that year" mode, migration lines), `DetailPanel`, `AddPersonForm`, `PlaceAutocomplete` (Nominatim search), `DocumentGallery`, `LoginPage`.
- Styles: a single `src/index.css` ("heritage" theme).

## Known points of attention

- Cloud Run revision `genealogy-api-00010` (Sept. 7) never started, because the Dockerfile did not copy `localBucket.js`. This is fixed, and revision `00013` was deployed on Sept. 27. Any new deployment must copy all the `.js` files that `server.js` needs.
- Document names with accents or non-ASCII characters made display fail (error 500 on `Content-Disposition`). This is fixed in `api/server.js` (RFC 6266 encoding), but the API must be **redeployed** for production to benefit.
- `JWT_SECRET` must be set as an environment variable of the Cloud Run service (it is not in the repository). `cloudbuild.yaml` uses `--update-env-vars` so as not to erase it on each deployment: do not go back to `--set-env-vars`, which replaces all variables. Without this secret, the API refuses to start outside `LOCAL_DATA_DIR` mode, because the public dev value would let anyone forge an `editor` token.
- CORS only allows `hadrient.github.io` and localhost.
