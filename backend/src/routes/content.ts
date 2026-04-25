import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs/promises";
import { requireAuth } from "../middleware/auth";

const router = Router();

/**
 * Content directory lives at the repo root: <project>/content/
 * From backend/src/routes/ that's three levels up.
 */
const CONTENT_DIR = path.resolve(__dirname, "..", "..", "..", "content");

/** Allowed category folders — prevents directory-traversal attacks. */
const ALLOWED_CATEGORIES = new Set([
  "frontend",
  "backend",
  "database",
  "leetcode",
]);

const BACKEND_CONTENT_DIR = path.join(CONTENT_DIR, "backend");
const DATABASE_CONTENT_DIR = path.join(CONTENT_DIR, "database");
const DATABASE_SQLITE_CONTENT_DIR = path.join(DATABASE_CONTENT_DIR, "sql-lite");
const FRONTEND_CONTENT_DIR = path.join(CONTENT_DIR, "frontend");
const LEETCODE_CONTENT_DIR = path.join(CONTENT_DIR, "leetcode", "Python");

/**
 * GET /api/content/:category
 * Returns an array of available problem slugs for a category.
 */
router.get(
  "/api/content/:category",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { category } = req.params;

    if (!ALLOWED_CATEGORIES.has(category)) {
      res.status(400).json({ error: `Invalid category: ${category}` });
      return;
    }

    try {
      let slugs: string[];

      if (category === "leetcode") {
        slugs = await listNestedProblemSlugs(
          LEETCODE_CONTENT_DIR,
          new Set(["manifest.json"]),
        );
      } else if (category === "frontend") {
        slugs = await listNestedProblemSlugs(
          FRONTEND_CONTENT_DIR,
          new Set(["manifest.json", "index.json"]),
        );
      } else if (category === "backend") {
        slugs = await listNestedProblemSlugs(BACKEND_CONTENT_DIR, new Set(["manifest.json", "index.json"]));
      } else if (category === "database") {
        slugs = await listNestedProblemSlugs(
          DATABASE_CONTENT_DIR,
          new Set(["manifest.json", "index.json"]),
        );
      } else {
        const categoryDir = path.join(CONTENT_DIR, category);
        const files = await fs.readdir(categoryDir);
        slugs = files
          .filter((f) => f.endsWith(".json"))
          .map((f) => f.replace(/\.json$/, ""));
      }

      res.json({ category, problems: slugs });
    } catch {
      res.status(404).json({ error: `Category "${category}" not found` });
    }
  },
);

/**
 * GET /api/content/backend/manifest
 * Returns the generated backend-python manifest for catalogue/session UIs.
 */
router.get(
  "/api/content/backend/manifest",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const manifestPath = path.join(BACKEND_CONTENT_DIR, "python", "manifest.json");
      const raw = await fs.readFile(manifestPath, "utf-8");
      res.set("Cache-Control", "public, max-age=300");
      res.json(JSON.parse(raw));
    } catch {
      res.status(404).json({ error: "Backend manifest not found" });
    }
  },
);

/**
 * GET /api/content/database/manifest
 * Returns the generated database-sqlite manifest for catalogue/session UIs.
 */
router.get(
  "/api/content/database/manifest",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const manifestPath = path.join(DATABASE_SQLITE_CONTENT_DIR, "manifest.json");
      const raw = await fs.readFile(manifestPath, "utf-8");
      res.set("Cache-Control", "public, max-age=300");
      res.json(JSON.parse(raw));
    } catch {
      res.status(404).json({ error: "Database manifest not found" });
    }
  },
);

/**
 * GET /api/content/:category/:problemId
 * Returns the full problem JSON for a specific problem.
 *
 * For LeetCode problems the files are nested:
 *   content/leetcode/Python/<subcategory>/<problemId>.json
 * Frontend/backend/database problems can also be nested by subcategory:
 *   content/frontend/<subcategory>/<problemId>.json
 *   content/backend/python/<subcategory>/<problemId>.json
 *   content/database/sql-lite/<subcategory>/<problemId>.json
 */
router.get(
  "/api/content/:category/:problemId",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { category, problemId } = req.params;

    if (!ALLOWED_CATEGORIES.has(category)) {
      res.status(400).json({ error: `Invalid category: ${category}` });
      return;
    }

    // Sanitise problemId — only allow alphanumeric, dashes, and underscores.
    if (!/^[\w-]+$/.test(problemId)) {
      res.status(400).json({ error: "Invalid problem ID" });
      return;
    }

    try {
      let raw: string;

      if (category === "leetcode") {
        // Search across sub-category directories inside Python/
        raw = await findProblemInNestedDir(LEETCODE_CONTENT_DIR, problemId);
      } else if (category === "frontend") {
        // Search across frontend/<subcategory>/ directories.
        raw = await findProblemInNestedDir(FRONTEND_CONTENT_DIR, problemId);
      } else if (category === "backend") {
        // Search across backend/python/<subcategory>/ directories
        raw = await findProblemInNestedDir(path.join(BACKEND_CONTENT_DIR, "python"), problemId);
      } else if (category === "database") {
        // Search across database/<engine>/<subcategory>/ directories
        raw = await findProblemInNestedDir(DATABASE_CONTENT_DIR, problemId);
      } else {
        const filePath = path.join(CONTENT_DIR, category, `${problemId}.json`);
        raw = await fs.readFile(filePath, "utf-8");
      }

      const data = JSON.parse(raw);

      // Cache for 5 minutes — content rarely changes.
      res.set("Cache-Control", "public, max-age=300");
      res.json(data);
    } catch {
      res.status(404).json({ error: `Problem "${problemId}" not found` });
    }
  },
);

async function findProblemInNestedDir(rootDir: string, problemId: string): Promise<string> {
  const target = `${problemId}.json`;

  async function walk(currentDir: string): Promise<string | null> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        const nested = await walk(fullPath);
        if (nested) return nested;
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name !== target) continue;
      return await fs.readFile(fullPath, "utf-8");
    }

    return null;
  }

  const found = await walk(rootDir);
  if (found) return found;
  throw new Error(`Problem "${problemId}" not found`);
}

/**
 * Recursively list all JSON slugs inside a nested content directory.
 */
async function listNestedProblemSlugs(
  rootDir: string,
  ignoredFilenames: Set<string>,
): Promise<string[]> {
  const slugs: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      if (ignoredFilenames.has(entry.name)) continue;
      slugs.push(entry.name.replace(/\.json$/, ""));
    }
  }

  await walk(rootDir);
  slugs.sort((a, b) => a.localeCompare(b));
  return slugs;
}

export default router;
