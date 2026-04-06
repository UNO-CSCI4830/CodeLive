import path from "path";
import fs from "fs/promises";
import { BACKEND_TIMEOUT_MS, MAX_STDIO_BYTES } from "./constants";
import { buildBackendHarness } from "./backendHarness";
import { runPython } from "./pythonExecutor";
import type { BackendTestRequest } from "./types";

export async function runBackendHarness(
  workspaceDir: string,
  tests: BackendTestRequest[],
): Promise<{
  results: Array<Record<string, unknown>>;
  summary: { passed: number; total: number };
  fatalError?: string;
}> {
  const runnerScriptPath = path.join(workspaceDir, "__runner__.py");
  const harness = buildBackendHarness(tests);
  await fs.writeFile(runnerScriptPath, harness, "utf-8");

  const { stdout, stderr, exitCode } = await runPython(runnerScriptPath, {
    timeoutMs: BACKEND_TIMEOUT_MS,
    cwd: workspaceDir,
    maxOutputBytes: MAX_STDIO_BYTES,
    prependSysPath: [workspaceDir],
  });

  const lines = stdout.trim().split("\n").filter(Boolean);
  const lastLine = lines[lines.length - 1] ?? "";

  let parsed: {
    results?: Array<Record<string, unknown>>;
    summary?: { passed: number; total: number };
    fatal_error?: string;
  } = {};

  try {
    parsed = JSON.parse(lastLine);
  } catch {
    const msg = stderr || stdout || `Runner exited with code ${exitCode}`;
    return {
      results: tests.map((t, i) => ({
        index: i,
        method: t.method,
        path: t.path,
        passed: false,
        expectedStatus: t.expected_status,
        actualStatus: null,
        expectedBody: t.expected_body ?? null,
        actualBody: null,
        error: msg,
      })),
      summary: { passed: 0, total: tests.length },
      fatalError: "Failed to parse backend runner output.",
    };
  }

  const results = parsed.results ?? [];
  const summary = parsed.summary ?? {
    passed: results.filter((r: Record<string, unknown>) => Boolean(r.passed)).length,
    total: results.length,
  };

  return {
    results,
    summary,
    ...(parsed.fatal_error ? { fatalError: parsed.fatal_error } : {}),
  };
}
