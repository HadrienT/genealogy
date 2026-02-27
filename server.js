import express from "express";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TREES_DIR = join(__dirname, "data", "trees");

// Ensure directory exists
mkdirSync(TREES_DIR, { recursive: true });

// If no trees exist, seed with the default sample data
if (readdirSync(TREES_DIR).filter((f) => f.endsWith(".json")).length === 0) {
  const samplePath = join(__dirname, "data", "family.json");
  let sampleData = { people: [], marriages: [] };
  try {
    sampleData = JSON.parse(readFileSync(samplePath, "utf-8"));
  } catch {
    /* no sample file – start empty */
  }
  const defaultId = crypto.randomUUID();
  const defaultTree = { id: defaultId, name: "Tramoni", ...sampleData };
  writeFileSync(
    join(TREES_DIR, `${defaultId}.json`),
    JSON.stringify(defaultTree, null, 2),
    "utf-8"
  );
  console.log(`Created default tree "${defaultTree.name}" (${defaultId})`);
}

const app = express();
app.use(express.json({ limit: "5mb" }));

/** Helper: read a tree file */
function readTree(id) {
  const file = join(TREES_DIR, `${id}.json`);
  return JSON.parse(readFileSync(file, "utf-8"));
}

/** List all trees (metadata only) */
app.get("/api/trees", (_req, res) => {
  try {
    const files = readdirSync(TREES_DIR).filter((f) => f.endsWith(".json"));
    const trees = files.map((f) => {
      const data = JSON.parse(readFileSync(join(TREES_DIR, f), "utf-8"));
      return { id: data.id, name: data.name, peopleCount: (data.people || []).length };
    });
    res.json(trees);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Get a single tree */
app.get("/api/trees/:id", (req, res) => {
  try {
    res.json(readTree(req.params.id));
  } catch {
    res.status(404).json({ error: "Tree not found" });
  }
});

/** Update a tree (full overwrite of people/marriages, optionally rename) */
app.put("/api/trees/:id", (req, res) => {
  try {
    const file = join(TREES_DIR, `${req.params.id}.json`);
    if (!existsSync(file)) return res.status(404).json({ error: "Tree not found" });
    const data = { id: req.params.id, ...req.body };
    writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Create a new tree */
app.post("/api/trees", (req, res) => {
  try {
    const id = crypto.randomUUID();
    const name = req.body.name || "Untitled";
    const tree = { id, name, people: req.body.people || [], marriages: req.body.marriages || [] };
    writeFileSync(join(TREES_DIR, `${id}.json`), JSON.stringify(tree, null, 2), "utf-8");
    res.status(201).json(tree);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Delete a tree */
app.delete("/api/trees/:id", (req, res) => {
  try {
    const file = join(TREES_DIR, `${req.params.id}.json`);
    if (!existsSync(file)) return res.status(404).json({ error: "Tree not found" });
    unlinkSync(file);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Rename a tree */
app.patch("/api/trees/:id", (req, res) => {
  try {
    const file = join(TREES_DIR, `${req.params.id}.json`);
    if (!existsSync(file)) return res.status(404).json({ error: "Tree not found" });
    const data = JSON.parse(readFileSync(file, "utf-8"));
    if (req.body.name) data.name = req.body.name;
    writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
    res.json({ ok: true, name: data.name });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Keep old /api/family endpoint for backwards compat (reads first tree) ──
app.get("/api/family", (_req, res) => {
  try {
    const files = readdirSync(TREES_DIR).filter((f) => f.endsWith(".json"));
    if (files.length === 0) return res.json({ people: [], marriages: [] });
    const data = JSON.parse(readFileSync(join(TREES_DIR, files[0]), "utf-8"));
    res.json({ people: data.people || [], marriages: data.marriages || [] });
  } catch {
    res.json({ people: [], marriages: [] });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Genealogy API → http://localhost:${PORT}`);
  console.log(`  Trees dir:   ${TREES_DIR}`);
});
