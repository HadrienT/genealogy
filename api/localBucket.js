import fs from "fs";
import fsp from "fs/promises";
import path from "path";

/**
 * A tiny drop-in replacement for a Google Cloud Storage bucket that stores
 * objects as plain files under a local directory. Only the surface actually
 * used by server.js is implemented.
 *
 * Enabled by setting the LOCAL_DATA_DIR environment variable — handy for
 * running the API on a laptop with no GCS bucket or credentials.
 */
export function makeLocalBucket(rootDir) {
  const root = path.resolve(rootDir);
  fs.mkdirSync(root, { recursive: true });

  const resolve = (name) => {
    const full = path.resolve(root, name);
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new Error(`Path escapes local data dir: ${name}`);
    }
    return full;
  };

  const makeFile = (name) => {
    const full = resolve(name);
    return {
      name,
      async exists() {
        return [fs.existsSync(full)];
      },
      async download() {
        return [await fsp.readFile(full)];
      },
      async save(data, _opts) {
        await fsp.mkdir(path.dirname(full), { recursive: true });
        await fsp.writeFile(full, data);
      },
      async delete() {
        await fsp.rm(full, { force: true });
      },
      createReadStream() {
        return fs.createReadStream(full);
      },
    };
  };

  const walk = async (dir, prefixPath) => {
    const out = [];
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const entry of entries) {
      const rel = prefixPath ? `${prefixPath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        out.push(...(await walk(path.join(dir, entry.name), rel)));
      } else {
        out.push(makeFile(rel));
      }
    }
    return out;
  };

  return {
    file: makeFile,
    async getFiles({ prefix = "", delimiter } = {}) {
      const startDir = prefix ? resolve(prefix) : root;
      if (delimiter === "/") {
        // top-level entries only
        let entries;
        try {
          entries = await fsp.readdir(startDir, { withFileTypes: true });
        } catch {
          return [[]];
        }
        const files = entries
          .filter((e) => e.isFile())
          .map((e) => makeFile(prefix ? `${prefix}/${e.name}` : e.name));
        return [files];
      }
      return [await walk(startDir, prefix)];
    },
  };
}
