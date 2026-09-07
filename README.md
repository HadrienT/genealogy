# 🌳 Genealogy

Interactive family tree viewer with a birth map.

## Features

- **Tree View** — Pannable & zoomable family tree (ReactFlow). Click a person to see details.
- **Map View** — OpenStreetMap with pins showing where each person was born (Leaflet).
- **Detail Panel** — Slide-out panel showing all available info. Click relatives to navigate.
- **Add / Remove** — Add people via a form; remove from the detail panel.
- **Flexible data** — All fields optional except `id`. Handles missing data gracefully.
- **Persistent** — Data stored in `localStorage`; survives page reloads.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173/genealogy/](http://localhost:5173/genealogy/).

The front end talks to the API (`/api`, proxied to `localhost:3001`), so you
also need the backend running.

### Backend — local filesystem mode (no Google Cloud)

Set `LOCAL_DATA_DIR` and the API stores everything as plain files on disk —
no GCS bucket or credentials required:

```bash
cd api
npm install
LOCAL_DATA_DIR=./.localdata SEED_USERS='[{"username":"admin","password":"admin","role":"editor"}]' node server.js
```

On first run it seeds a demo tree and the users from `SEED_USERS`
(only used while the data dir is empty). `.localdata/` is git-ignored.

### Backend — Google Cloud Storage mode

```bash
cd api && npm install
gcloud auth application-default login
GCS_BUCKET=your-bucket-name node server.js
```

## Data Structure

People are stored as a flat JSON array. Each person looks like this:

```ts
{
  id: string;             // required – unique identifier
  firstName?: string;
  lastName?: string;
  maidenName?: string;
  gender?: "male" | "female" | "other";
  birthDate?: string;     // "1990", "1990-03", or "1990-03-15"
  deathDate?: string;
  birthPlace?: string;
  birthCoordinates?: { lat: number; lng: number };
  deathPlace?: string;
  parentIds?: string[];   // up to 2
  partnerIds?: string[];
  childrenIds?: string[];
  occupation?: string;
  notes?: string;
}
```

Edit `src/data/sampleData.ts` to replace the example family with your own.
Data is loaded from localStorage on return visits; clear it to reload from the file.

## Tech Stack

| Purpose | Library |
|---------|---------|
| UI framework | React 19 + TypeScript |
| Build tool | Vite 6 |
| Tree graph | @xyflow/react (ReactFlow) |
| Tree layout | @dagrejs/dagre (layered DAG) |
| Map | react-leaflet + Leaflet |
| IDs | uuid |
