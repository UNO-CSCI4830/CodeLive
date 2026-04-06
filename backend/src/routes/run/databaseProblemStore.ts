import path from "path";
import fs from "fs/promises";
import { DATABASE_CONTENT_DIR } from "./constants";
import type {
  DatabaseProblem,
  DatabaseRunFile,
  DatabaseRunRequestBody,
} from "./types";

export function normaliseDatabaseSubmittedFiles(
  body: DatabaseRunRequestBody,
): DatabaseRunFile[] {
  if (Array.isArray(body.files)) {
    return body.files.map((f) => ({
      path: String(f.path ?? "").trim(),
      content: String(f.content ?? ""),
    }));
  }

  if (body.fileContents && typeof body.fileContents === "object") {
    return Object.entries(body.fileContents).map(([filePath, content]) => ({
      path: filePath.trim(),
      content: String(content ?? ""),
    }));
  }

  return [];
}

export async function loadDatabaseProblem(problemId: string): Promise<DatabaseProblem> {
  const problemFilePath = await findDatabaseProblemFile(DATABASE_CONTENT_DIR, problemId);
  if (!problemFilePath) throw new Error("Problem not found");

  const raw = await fs.readFile(problemFilePath, "utf-8");
  return JSON.parse(raw) as DatabaseProblem;
}

async function findDatabaseProblemFile(
  rootDir: string,
  problemId: string,
): Promise<string | null> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      const found = await findDatabaseProblemFile(fullPath, problemId);
      if (found) return found;
      continue;
    }

    if (!entry.isFile()) continue;
    if (entry.name === `${problemId}.json`) return fullPath;
  }

  return null;
}
