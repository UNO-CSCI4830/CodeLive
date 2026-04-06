import path from "path";
import { existsSync } from "fs";

/** Maximum execution time (ms) for a LeetCode-style run. */
export const TIMEOUT_MS = 10_000;

/** Maximum execution time (ms) for a backend request-replay run. */
export const BACKEND_TIMEOUT_MS = 20_000;

/** Maximum execution time (ms) for a database SQL run. */
export const DATABASE_TIMEOUT_MS = 12_000;

/** Maximum combined stdout/stderr captured from a single run. */
export const MAX_STDIO_BYTES = 1_000_000; // 1 MB

const backendRootFromDir = path.resolve(__dirname, "..", "..", "..");
const projectRootFromDir = path.resolve(backendRootFromDir, "..");

const rootCandidates = [
  path.resolve(process.cwd(), ".."),
  process.cwd(),
  projectRootFromDir,
  backendRootFromDir,
];

/** Repository root where /content lives (best-effort detection). */
export const REPO_ROOT =
  rootCandidates.find((candidate) => existsSync(path.join(candidate, "content")))
  ?? process.cwd();

export const CONTENT_DIR = path.join(REPO_ROOT, "content");
export const BACKEND_CONTENT_DIR = path.join(CONTENT_DIR, "backend");
export const DATABASE_CONTENT_DIR = path.join(CONTENT_DIR, "database");

/** Local dev fallback python (used if PYTHON_BIN is not provided). */
export const DEFAULT_VENV_PYTHON = path.join(REPO_ROOT, ".venv", "bin", "python");
