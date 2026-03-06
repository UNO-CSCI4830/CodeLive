import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs/promises";

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

/**
 * GET /api/content/:category
 * Returns an array of available problem slugs for a category.
 */
router.get(
  "/api/content/:category",
  async (req: Request, res: Response): Promise<void> => {
    const { category } = req.params;

    if (!ALLOWED_CATEGORIES.has(category)) {
      res.status(400).json({ error: `Invalid category: ${category}` });
      return;
    }

    const categoryDir = path.join(CONTENT_DIR, category);

    try {
      const files = await fs.readdir(categoryDir);
      const slugs = files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""));

      res.json({ category, problems: slugs });
    } catch {
      res.status(404).json({ error: `Category "${category}" not found` });
    }
  },
);

/**
 * GET /api/content/:category/:problemId
 * Returns the full problem JSON for a specific problem.
 *
 * For LeetCode problems the files are nested:
 *   content/leetcode/Python/<subcategory>/<problemId>.json
 * For other categories they're flat:
 *   content/<category>/<problemId>.json
 */
router.get(
  "/api/content/:category/:problemId",
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
        raw = await findLeetcodeProblem(problemId);
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

/**
 * Search content/leetcode/Python/<subcategory>/ directories for a problem.
 * Throws if not found.
 */
async function findLeetcodeProblem(problemId: string): Promise<string> {
  const pythonDir = path.join(CONTENT_DIR, "leetcode", "Python");
  const subcategories = await fs.readdir(pythonDir);

  for (const sub of subcategories) {
    const filePath = path.join(pythonDir, sub, `${problemId}.json`);
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      // Not in this sub-category — try the next one.
    }
  }

  throw new Error(`LeetCode problem "${problemId}" not found`);
}

export default router;
