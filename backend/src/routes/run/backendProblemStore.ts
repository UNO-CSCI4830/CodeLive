import path from "path";
import fs from "fs/promises";
import os from "os";
import { BACKEND_CONTENT_DIR } from "./constants";
import type {
  BackendProblem,
  BackendRunFile,
  BackendRunRequestBody,
  BackendStarterFile,
} from "./types";

export function normaliseSubmittedFiles(body: BackendRunRequestBody): BackendRunFile[] {
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

export async function loadBackendProblem(problemId: string): Promise<BackendProblem> {
  const problemFilePath = await findBackendProblemFile(BACKEND_CONTENT_DIR, problemId);
  if (!problemFilePath) throw new Error("Problem not found");

  const raw = await fs.readFile(problemFilePath, "utf-8");
  return JSON.parse(raw) as BackendProblem;
}

async function findBackendProblemFile(rootDir: string, problemId: string): Promise<string | null> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      const found = await findBackendProblemFile(fullPath, problemId);
      if (found) return found;
      continue;
    }

    if (!entry.isFile()) continue;
    if (entry.name === `${problemId}.json`) return fullPath;
  }

  return null;
}

export async function createBackendWorkspace(
  starterFiles: BackendStarterFile[],
  submittedFiles: BackendRunFile[],
): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "codelive-backend-run-"));

  const starterByPath = new Map(
    starterFiles.map((f) => [sanitizeRelativePath(f.path), f.content]),
  );

  for (const starter of starterFiles) {
    const clean = sanitizeRelativePath(starter.path);
    const absPath = safeJoin(workspace, clean);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, starter.content, "utf-8");
  }

  // Ensure app package imports are reliable.
  const initPy = path.join(workspace, "app", "__init__.py");
  await fs.mkdir(path.dirname(initPy), { recursive: true });
  await fs.writeFile(initPy, "", { encoding: "utf-8", flag: "a" });

  for (const file of submittedFiles) {
    const clean = sanitizeRelativePath(file.path);
    if (!starterByPath.has(clean)) {
      throw new Error(`Submitted file not in starter_files: ${clean}`);
    }
    const absPath = safeJoin(workspace, clean);
    await fs.writeFile(absPath, file.content, "utf-8");
  }

  return workspace;
}

function sanitizeRelativePath(inputPath: string): string {
  if (!inputPath) throw new Error("File path cannot be empty.");
  if (path.isAbsolute(inputPath)) throw new Error(`Absolute file paths are not allowed: ${inputPath}`);

  const normalised = path.posix.normalize(inputPath.replace(/\\/g, "/"));
  if (normalised.startsWith("../") || normalised.includes("/../") || normalised === "..") {
    throw new Error(`Invalid file path: ${inputPath}`);
  }

  return normalised;
}

function safeJoin(rootDir: string, relativePath: string): string {
  const absPath = path.join(rootDir, relativePath);
  const rootWithSep = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;

  if (!absPath.startsWith(rootWithSep) && absPath !== rootDir) {
    throw new Error(`Unsafe file path: ${relativePath}`);
  }

  return absPath;
}
