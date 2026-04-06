import fs from "fs/promises";
import type { Request, Response } from "express";
import { createBackendWorkspace, loadBackendProblem, normaliseSubmittedFiles } from "../backendProblemStore";
import { runBackendHarness } from "../backendExecution";
import type { BackendRunRequestBody } from "../types";

export async function runBackendPython(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as BackendRunRequestBody;
  const problemId = body.problemId?.trim();

  if (!problemId || !/^[\w-]+$/.test(problemId)) {
    res.status(400).json({ error: "A valid problemId is required." });
    return;
  }

  const problem = await loadBackendProblem(problemId).catch(() => null);
  if (!problem) {
    res.status(404).json({ error: `Backend problem "${problemId}" not found.` });
    return;
  }

  if (problem.category !== "backend") {
    res.status(400).json({ error: "Invalid backend problem definition." });
    return;
  }

  if (problem.test_config.language !== "python") {
    res.status(400).json({ error: "Only python backend problems are supported in this runner." });
    return;
  }

  const testRequests = problem.test_config.test_requests ?? [];
  if (!Array.isArray(testRequests) || testRequests.length === 0) {
    res.status(400).json({ error: "Problem has no test_requests configured." });
    return;
  }

  const submittedFiles = normaliseSubmittedFiles(body);
  const allowedPaths = new Set(problem.starter_files.map((f) => f.path));
  for (const file of submittedFiles) {
    if (!allowedPaths.has(file.path)) {
      res.status(400).json({ error: `Submitted file path is not allowed: ${file.path}` });
      return;
    }
  }

  let workspaceDir: string | null = null;

  try {
    workspaceDir = await createBackendWorkspace(problem.starter_files, submittedFiles);
    const runResult = await runBackendHarness(workspaceDir, testRequests);
    res.json(runResult);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  } finally {
    if (workspaceDir) {
      fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
