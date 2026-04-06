import type { Request, Response } from "express";
import { runDatabaseSqliteExecution } from "../databaseExecution";
import {
  loadDatabaseProblem,
  normaliseDatabaseSubmittedFiles,
} from "../databaseProblemStore";
import type { DatabaseRunRequestBody } from "../types";

export async function runDatabaseSqlite(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as DatabaseRunRequestBody;
  const problemId = body.problemId?.trim();

  if (!problemId || !/^[\w-]+$/.test(problemId)) {
    res.status(400).json({ error: "A valid problemId is required." });
    return;
  }

  const problem = await loadDatabaseProblem(problemId).catch(() => null);
  if (!problem) {
    res.status(404).json({ error: `Database problem "${problemId}" not found.` });
    return;
  }

  if (problem.category !== "database") {
    res.status(400).json({ error: "Invalid database problem definition." });
    return;
  }

  const editableStarter =
    problem.starter_files.find((f) => !f.readonly) ?? problem.starter_files[0];
  const editablePath = editableStarter?.path ?? "solution.sql";

  const submittedFiles = normaliseDatabaseSubmittedFiles(body);
  const submittedByPath = new Map(submittedFiles.map((f) => [f.path, f.content]));
  const submittedSql = submittedByPath.get(editablePath);
  const sql = typeof body.sql === "string" ? body.sql : submittedSql ?? editableStarter?.content ?? "";

  const schemaSql = problem.test_config.schema_sql;
  const seedSql = problem.test_config.seed_sql;
  const expectedOutput = problem.test_config.expected_output;
  const columnNames = problem.test_config.column_names;
  const orderMatters = problem.test_config.order_matters ?? false;

  if (!schemaSql || !seedSql || !Array.isArray(expectedOutput)) {
    res.status(400).json({ error: "Problem test_config is missing required SQL fields." });
    return;
  }

  try {
    const result = await runDatabaseSqliteExecution({
      sql,
      schemaSql,
      seedSql,
      expectedOutput,
      columnNames,
      orderMatters,
    });
    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
}
