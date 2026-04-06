import path from "path";
import fs from "fs/promises";
import os from "os";
import type { Request, Response } from "express";
import { MAX_STDIO_BYTES, TIMEOUT_MS } from "../constants";
import { buildLeetcodeHarness, extractTopLevelFunctionName } from "../leetcodeHarness";
import { runPython } from "../pythonExecutor";
import type { LeetcodeTestCase } from "../types";

export async function runLeetcodePython(
  req: Request,
  res: Response,
): Promise<void> {
  const { code, testCases } = req.body as {
    code?: string;
    testCases?: LeetcodeTestCase[];
  };

  if (typeof code !== "string" || !Array.isArray(testCases)) {
    res.status(400).json({ error: "Missing code or testCases" });
    return;
  }

  const detectedFn = extractTopLevelFunctionName(code);
  if (!detectedFn) {
    res.status(400).json({
      error:
        "Could not find a top-level function definition in your code. Make sure your solution starts with a `def` statement.",
    });
    return;
  }

  const harness = buildLeetcodeHarness(code, testCases, detectedFn);

  let tmpFile: string | null = null;

  try {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codelive-py-"));
    tmpFile = path.join(tmpDir, "solution.py");
    await fs.writeFile(tmpFile, harness, "utf-8");

    const { stdout, stderr, exitCode } = await runPython(tmpFile, {
      cwd: path.dirname(tmpFile),
      timeoutMs: TIMEOUT_MS,
      maxOutputBytes: MAX_STDIO_BYTES,
    });

    if (exitCode !== 0 && !stdout) {
      res.json({
        results: testCases.map((tc, i) => ({
          index: i,
          passed: false,
          input: tc.input,
          expected: tc.expected?.result,
          actual: null,
          error: stderr || `Process exited with code ${exitCode}`,
        })),
        stdout: "",
      });
      return;
    }

    const lines = stdout.trim().split("\n");
    const resultLine = lines[lines.length - 1];
    let parsed: { results: unknown[]; stdout: string };

    try {
      parsed = JSON.parse(resultLine);
    } catch {
      res.json({
        results: testCases.map((tc, i) => ({
          index: i,
          passed: false,
          input: tc.input,
          expected: tc.expected?.result,
          actual: null,
          error: stderr || stdout || "Failed to parse output",
        })),
        stdout,
      });
      return;
    }

    res.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  } finally {
    if (tmpFile) {
      fs.rm(path.dirname(tmpFile), { recursive: true, force: true }).catch(() => {});
    }
  }
}
