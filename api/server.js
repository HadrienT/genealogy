import express from "express";
import cors from "cors";
import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import { makeLocalBucket } from "./localBucket.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Config ──────────────────────────────────────────────────────────────────

const BUCKET_NAME = process.env.GCS_BUCKET || "genealogy-trees-data";
const PORT = parseInt(process.env.PORT || "3001", 10);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const USERS_FILE = "_users.json";

// Storage backend:
//  - Default: a Google Cloud Storage bucket (Application Default Credentials
//    are auto-provided on Cloud Run; locally use `gcloud auth application-default login`).
//  - Local dev: set LOCAL_DATA_DIR to store everything as plain files on disk,
//    with no GCS bucket or credentials required.
const LOCAL_DATA_DIR = process.env.LOCAL_DATA_DIR;
const bucket = LOCAL_DATA_DIR
  ? makeLocalBucket(LOCAL_DATA_DIR)
  : new Storage().bucket(BUCKET_NAME);

if (LOCAL_DATA_DIR) {
  console.log(`Storage: local filesystem → ${LOCAL_DATA_DIR}`);
}

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
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Auth Helpers ────────────────────────────────────────────────────────────

/** Read users list from GCS */
async function readUsers() {
  const file = bucket.file(USERS_FILE);
  const [exists] = await file.exists();
  if (!exists) return [];
  const [content] = await file.download();
  return JSON.parse(content.toString("utf-8"));
}

/** Write users list to GCS */
async function writeUsers(users) {
  const file = bucket.file(USERS_FILE);
  await file.save(JSON.stringify(users, null, 2), {
    contentType: "application/json",
  });
}

/**
 * Seed users from SEED_USERS env var if no users exist yet.
 * Format: JSON array of { username, password, role } objects.
 * Example: [{"username":"admin","password":"s3cret","role":"editor"}]
 */
async function seedUsers() {
  try {
    const users = await readUsers();
    if (users.length > 0) return;

    const seedJson = process.env.SEED_USERS;
    if (!seedJson) {
      console.warn("No SEED_USERS env var set – skipping user seed.");
      return;
    }

    const seeds = JSON.parse(seedJson);
    const newUsers = [];
    for (const s of seeds) {
      if (!s.username || !s.password || !s.role) continue;
      const hash = await bcrypt.hash(s.password, 10);
      newUsers.push({ id: uuidv4(), username: s.username, passwordHash: hash, role: s.role });
    }
    if (newUsers.length > 0) {
      await writeUsers(newUsers);
      console.log(`Seeded ${newUsers.length} user(s) from SEED_USERS env var.`);
    }
  } catch (err) {
    console.warn("User seed failed:", err.message);
  }
}

/** Auth middleware: validates JWT, sets req.user = { id, username, role } */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Role middleware: require specific role */
function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

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

/** Login */
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    const users = await readUsers();
    const user = users.find((u) => u.username === username);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Verify token & return user info */
app.get("/api/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

/** List all trees (metadata only) — requires authentication */
app.get("/api/trees", authenticate, async (_req, res) => {
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
app.get("/api/trees/:id", authenticate, async (req, res) => {
  try {
    const tree = await readTree(req.params.id);
    if (!tree) return res.status(404).json({ error: "Tree not found" });
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Update a tree (full overwrite) */
app.put("/api/trees/:id", authenticate, requireRole("editor"), async (req, res) => {
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
app.post("/api/trees", authenticate, requireRole("editor"), async (req, res) => {
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
app.delete("/api/trees/:id", authenticate, requireRole("editor"), async (req, res) => {
  try {
    await deleteTreeFile(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Rename a tree */
app.patch("/api/trees/:id", authenticate, requireRole("editor"), async (req, res) => {
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

// ─── Document Routes ─────────────────────────────────────────────────────────

const DOCS_PREFIX = "docs";

/** Read document metadata for a person */
async function readDocMeta(personId) {
  const file = bucket.file(`${DOCS_PREFIX}/${personId}/_meta.json`);
  const [exists] = await file.exists();
  if (!exists) return [];
  const [content] = await file.download();
  return JSON.parse(content.toString("utf-8"));
}

/** Write document metadata for a person */
async function writeDocMeta(personId, meta) {
  const file = bucket.file(`${DOCS_PREFIX}/${personId}/_meta.json`);
  await file.save(JSON.stringify(meta, null, 2), { contentType: "application/json" });
}

/** List documents for a person */
app.get("/api/persons/:personId/documents", authenticate, async (req, res) => {
  try {
    const meta = await readDocMeta(req.params.personId);
    res.json(meta);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Upload a document for a person (editor only) */
app.post("/api/persons/:personId/documents", authenticate, requireRole("editor"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const { personId } = req.params;
    const docId = uuidv4();
    const ext = req.file.originalname.includes(".") ? req.file.originalname.split(".").pop() : "";
    const gcsPath = `${DOCS_PREFIX}/${personId}/${docId}${ext ? "." + ext : ""}`;

    const gcsFile = bucket.file(gcsPath);
    await gcsFile.save(req.file.buffer, {
      contentType: req.file.mimetype,
      metadata: { originalName: req.file.originalname },
    });

    const doc = {
      id: docId,
      name: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      gcsPath,
      uploadedAt: new Date().toISOString(),
    };

    const meta = await readDocMeta(personId);
    meta.push(doc);
    await writeDocMeta(personId, meta);

    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** View/download a document (streams from GCS) */
app.get("/api/persons/:personId/documents/:docId", authenticate, async (req, res) => {
  try {
    const meta = await readDocMeta(req.params.personId);
    const doc = meta.find((d) => d.id === req.params.docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const gcsFile = bucket.file(doc.gcsPath);
    const [exists] = await gcsFile.exists();
    if (!exists) return res.status(404).json({ error: "File not found in storage" });

    // Viewers: always inline (no download). Editors: inline by default, download if ?download=1
    const isEditor = req.user?.role === "editor";
    const wantsDownload = req.query.download === "1" && isEditor;
    const disposition = wantsDownload
      ? `attachment; filename="${doc.name}"`
      : `inline; filename="${doc.name}"`;

    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("Content-Disposition", disposition);
    res.setHeader("Content-Length", doc.size);
    res.setHeader("Cache-Control", "private, max-age=3600");

    gcsFile.createReadStream().pipe(res);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Delete a document (editor only) */
app.delete("/api/persons/:personId/documents/:docId", authenticate, requireRole("editor"), async (req, res) => {
  try {
    const { personId, docId } = req.params;
    const meta = await readDocMeta(personId);
    const doc = meta.find((d) => d.id === docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    // Delete file from GCS
    const gcsFile = bucket.file(doc.gcsPath);
    const [exists] = await gcsFile.exists();
    if (exists) await gcsFile.delete();

    // Update metadata
    const updated = meta.filter((d) => d.id !== docId);
    await writeDocMeta(personId, updated);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

Promise.all([seedIfEmpty(), seedUsers()]).then(() => {
  app.listen(PORT, () => {
    console.log(`Genealogy API → http://localhost:${PORT}`);
    console.log(
      LOCAL_DATA_DIR ? `  storage:  ${LOCAL_DATA_DIR}` : `  GCS bucket:  ${BUCKET_NAME}`
    );
  });
});
