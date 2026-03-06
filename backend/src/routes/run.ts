import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import os from "os";

const router = Router();

/** Maximum execution time (ms) for a single run. */
const TIMEOUT_MS = 10_000;

/**
 * POST /api/run/python
 *
 * Body: { code: string, testCases: TestCase[], functionName?: string }
 *
 * Executes the user's Python code against each test case by:
 *  1. Extracting the actual top-level function name from the submitted code
 *  2. Writing a temp .py file with the code + a test harness
 *  3. Spawning a Python process
 *  4. Parsing JSON output
 */
router.post(
  "/api/run/python",
  async (req: Request, res: Response): Promise<void> => {
    const { code, testCases } = req.body;

    if (!code || !testCases) {
      res.status(400).json({ error: "Missing code or testCases" });
      return;
    }

    // Derive the function name from the submitted code itself — much more
    // reliable than guessing from the problem ID, since many starter functions
    // use names that differ from the slug (e.g. restore_ip vs restore_ip_addresses).
    const detectedFn = extractTopLevelFunctionName(code);
    if (!detectedFn) {
      res.status(400).json({ error: "Could not find a top-level function definition in your code. Make sure your solution starts with a \`def\` statement." });
      return;
    }

    // Build a test harness that imports the user function and runs each test case.
    const harness = buildHarness(code, testCases, detectedFn);

    let tmpFile: string | null = null;

    try {
      // Write to a temp file
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codelive-py-"));
      tmpFile = path.join(tmpDir, "solution.py");
      await fs.writeFile(tmpFile, harness, "utf-8");

      // Run Python
      const { stdout, stderr, exitCode } = await runPython(tmpFile);

      if (exitCode !== 0 && !stdout) {
        // Total failure (syntax error, etc.)
        res.json({
          results: testCases.map((_: unknown, i: number) => ({
            index: i,
            passed: false,
            input: testCases[i].input,
            expected: testCases[i].expected?.result,
            actual: null,
            error: stderr || `Process exited with code ${exitCode}`,
          })),
          stdout: "",
        });
        return;
      }

      // Parse the structured JSON output from the harness
      const lines = stdout.trim().split("\n");
      const resultLine = lines[lines.length - 1];
      let parsed: { results: unknown[]; stdout: string };

      try {
        parsed = JSON.parse(resultLine);
      } catch {
        // If we can't parse, return raw output as error
        res.json({
          results: testCases.map((_: unknown, i: number) => ({
            index: i,
            passed: false,
            input: testCases[i].input,
            expected: testCases[i].expected?.result,
            actual: null,
            error: stderr || stdout || "Failed to parse output",
          })),
          stdout: stdout,
        });
        return;
      }

      res.json(parsed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    } finally {
      // Clean up temp file
      if (tmpFile) {
        fs.rm(path.dirname(tmpFile), { recursive: true, force: true }).catch(() => {});
      }
    }
  },
);

/**
 * Extract the name of the first top-level `def` in the submitted Python code.
 * Skips nested defs (indented lines) and class definitions.
 *
 * e.g. "def restore_ip(s: str) -> list:" → "restore_ip"
 */
function extractTopLevelFunctionName(code: string): string | null {
  for (const line of code.split("\n")) {
    // A top-level def is at column 0 (no leading whitespace)
    const match = line.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Build a Python script that:
 *  1. Defines the user's code
 *  2. Runs each test case and captures results
 *  3. Prints JSON to stdout on the last line
 */
function buildHarness(
  code: string,
  testCases: Array<{ input: Record<string, unknown>; expected: { result: unknown } }>,
  functionName: string,
): string {
  const testCasesJson = JSON.stringify(testCases);

  return `
import sys
import json
import io
from typing import List, Optional, Tuple, Dict, Set

# ── User code ──────────────────────────────────────
${code}

# ── Test harness ───────────────────────────────────
_test_cases = json.loads('''${testCasesJson.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}''')
_results = []
_captured_stdout = io.StringIO()
_old_stdout = sys.stdout

for _i, _tc in enumerate(_test_cases):
    _input = _tc["input"]
    _expected = _tc["expected"]["result"]
    sys.stdout = _captured_stdout
    try:
        _actual = ${functionName}(**_input)
        sys.stdout = _old_stdout
        _passed = _actual == _expected
        _results.append({
            "index": _i,
            "passed": _passed,
            "input": _input,
            "expected": _expected,
            "actual": _actual,
            "error": None
        })
    except Exception as _e:
        sys.stdout = _old_stdout
        _results.append({
            "index": _i,
            "passed": False,
            "input": _input,
            "expected": _expected,
            "actual": None,
            "error": str(_e)
        })

sys.stdout = _old_stdout
_user_stdout = _captured_stdout.getvalue()
print(json.dumps({"results": _results, "stdout": _user_stdout}))
`.trimStart();
}

/** Spawn a Python process and collect output. */
function runPython(
  filePath: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("python3", [filePath], {
      timeout: TIMEOUT_MS,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
    });

    proc.on("error", (err) => {
      resolve({ stdout, stderr: err.message, exitCode: 1 });
    });
  });
}

export default router;
