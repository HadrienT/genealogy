import express from "express";
import cors from "cors";
import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";

// ─── Config ──────────────────────────────────────────────────────────────────

const BUCKET_NAME = process.env.GCS_BUCKET || "genealogy-trees-data";
const PORT = parseInt(process.env.PORT || "3001", 10);

// In Cloud Run, Application Default Credentials are auto-provided.
// Locally, set GOOGLE_APPLICATION_CREDENTIALS env var or use `gcloud auth application-default login`.
const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(
  cors({
    origin: [
      /^https:\/\/hadrient\.github\.io$/,
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read a tree JSON from GCS */
async function readTree(id) {
  const file = bucket.file(`${id}.json`);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [content] = await file.download();
  return JSON.parse(content.toString("utf-8"));
}

/** Write a tree JSON to GCS */
async function writeTree(id, data) {
  const file = bucket.file(`${id}.json`);
  await file.save(JSON.stringify(data, null, 2), {
    contentType: "application/json",
  });
}

/** Delete a tree JSON from GCS */
async function deleteTreeFile(id) {
  const file = bucket.file(`${id}.json`);
  const [exists] = await file.exists();
  if (exists) await file.delete();
}

/** List all tree files in the bucket */
async function listAllTrees() {
  const [files] = await bucket.getFiles({ prefix: "", delimiter: "/" });
  const trees = [];
  for (const file of files) {
    if (!file.name.endsWith(".json")) continue;
    try {
      const [content] = await file.download();
      const data = JSON.parse(content.toString("utf-8"));
      trees.push(data);
    } catch {
      // skip corrupted files
    }
  }
  return trees;
}

// ─── Seed default tree if bucket is empty ────────────────────────────────────

async function seedIfEmpty() {
  try {
    const trees = await listAllTrees();
    if (trees.length > 0) return;

    const id = uuidv4();
    const defaultTree = {
      id,
      name: "Tramoni",
      people: [
        { id: "ggf-1", firstName: "Auguste", lastName: "Tramoni", gender: "male", birthDate: "1880", deathDate: "1945", birthPlace: "Ajaccio, Corse", birthCoordinates: { lat: 41.9263, lng: 8.7369 }, partnerIds: ["ggm-1"], childrenIds: ["gf-1"], occupation: "Pêcheur" },
        { id: "ggm-1", firstName: "Marie", lastName: "Ferracci", maidenName: "Ferracci", gender: "female", birthDate: "1885", deathDate: "1960", birthPlace: "Bastia, Corse", birthCoordinates: { lat: 42.6975, lng: 9.4529 }, partnerIds: ["ggf-1"], childrenIds: ["gf-1"] },
        { id: "gf-1", firstName: "Jean", lastName: "Tramoni", gender: "male", birthDate: "1920-06-12", deathDate: "1998-01-03", birthPlace: "Marseille, France", birthCoordinates: { lat: 43.2965, lng: 5.3698 }, parentIds: ["ggf-1", "ggm-1"], partnerIds: ["gm-1"], childrenIds: ["f-1"], occupation: "Menuisier" },
        { id: "gm-1", firstName: "Antoinette", lastName: "Tramoni", maidenName: "Luciani", gender: "female", birthDate: "1925", deathDate: "2005", birthPlace: "Lyon, France", birthCoordinates: { lat: 45.764, lng: 4.8357 }, partnerIds: ["gf-1"], childrenIds: ["f-1"] },
        { id: "f-1", firstName: "Pierre", lastName: "Tramoni", gender: "male", birthDate: "1955-09-20", birthPlace: "Paris, France", birthCoordinates: { lat: 48.8566, lng: 2.3522 }, parentIds: ["gf-1", "gm-1"], partnerIds: ["m-1"], childrenIds: ["me", "s-1"], occupation: "Ingénieur" },
        { id: "m-1", firstName: "Catherine", lastName: "Tramoni", maidenName: "Dupont", gender: "female", birthDate: "1958-03-14", birthPlace: "Bordeaux, France", birthCoordinates: { lat: 44.8378, lng: -0.5792 }, partnerIds: ["f-1"], childrenIds: ["me", "s-1"], occupation: "Professeur" },
        { id: "me", firstName: "Hadrien", lastName: "Tramoni", gender: "male", birthDate: "1990-07-22", birthPlace: "Toulouse, France", birthCoordinates: { lat: 43.6047, lng: 1.4442 }, parentIds: ["f-1", "m-1"], notes: "That's me!" },
        { id: "s-1", firstName: "Sophie", lastName: "Tramoni", gender: "female", birthDate: "1993-11-05", birthPlace: "Toulouse, France", birthCoordinates: { lat: 43.6047, lng: 1.4442 }, parentIds: ["f-1", "m-1"], occupation: "Médecin" },
      ],
      marriages: [
        { partnerIds: ["ggf-1", "ggm-1"], date: "1905", place: "Ajaccio, Corse" },
        { partnerIds: ["gf-1", "gm-1"], date: "1948-06-20", place: "Marseille" },
        { partnerIds: ["f-1", "m-1"], date: "1982-09-12", place: "Paris" },
      ],
    };
    await writeTree(id, defaultTree);
    console.log(`Seeded default tree "${defaultTree.name}" (${id})`);
  } catch (err) {
    console.warn("Seed check failed (bucket may not exist yet):", err.message);
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/** List all trees (metadata only) */
app.get("/api/trees", async (_req, res) => {
  try {
    const trees = await listAllTrees();
    res.json(
      trees.map((t) => ({
        id: t.id,
        name: t.name,
        peopleCount: (t.people || []).length,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Get a single tree */
app.get("/api/trees/:id", async (req, res) => {
  try {
    const tree = await readTree(req.params.id);
    if (!tree) return res.status(404).json({ error: "Tree not found" });
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Update a tree (full overwrite) */
app.put("/api/trees/:id", async (req, res) => {
  try {
    const existing = await readTree(req.params.id);
    if (!existing) return res.status(404).json({ error: "Tree not found" });
    const data = { id: req.params.id, ...req.body };
    await writeTree(req.params.id, data);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Create a new tree */
app.post("/api/trees", async (req, res) => {
  try {
    const id = uuidv4();
    const name = req.body.name || "Untitled";
    const tree = { id, name, people: req.body.people || [], marriages: req.body.marriages || [] };
    await writeTree(id, tree);
    res.status(201).json(tree);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Delete a tree */
app.delete("/api/trees/:id", async (req, res) => {
  try {
    await deleteTreeFile(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Rename a tree */
app.patch("/api/trees/:id", async (req, res) => {
  try {
    const data = await readTree(req.params.id);
    if (!data) return res.status(404).json({ error: "Tree not found" });
    if (req.body.name) data.name = req.body.name;
    await writeTree(req.params.id, data);
    res.json({ ok: true, name: data.name });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

seedIfEmpty().then(() => {
  app.listen(PORT, () => {
    console.log(`Genealogy API → http://localhost:${PORT}`);
    console.log(`  GCS bucket:  ${BUCKET_NAME}`);
  });
});
