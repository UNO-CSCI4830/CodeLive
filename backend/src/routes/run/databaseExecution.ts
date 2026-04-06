import path from "path";
import fs from "fs/promises";
import os from "os";
import { DATABASE_TIMEOUT_MS, MAX_STDIO_BYTES } from "./constants";
import { runPython } from "./pythonExecutor";

interface DatabaseExecutionInput {
  sql: string;
  schemaSql: string;
  seedSql: string;
  expectedOutput: Array<Record<string, unknown>>;
  columnNames?: string[];
  orderMatters?: boolean;
}

interface DatabaseExecutionOutput {
  passed: boolean;
  orderMatters: boolean;
  actualColumns: string[];
  expectedColumns: string[];
  actualOutput: Array<Record<string, unknown>>;
  expectedOutput: Array<Record<string, unknown>>;
  executionError?: string | null;
}

export async function runDatabaseSqliteExecution(
  input: DatabaseExecutionInput,
): Promise<DatabaseExecutionOutput> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "codelive-db-run-"));
  const payloadPath = path.join(workspace, "__payload__.json");
  const runnerPath = path.join(workspace, "__runner__.py");

  const payload = {
    sql: input.sql,
    schema_sql: input.schemaSql,
    seed_sql: input.seedSql,
    expected_output: input.expectedOutput,
    column_names: input.columnNames ?? [],
    order_matters: input.orderMatters ?? false,
    timeout_ms: DATABASE_TIMEOUT_MS,
  };

  try {
    await fs.writeFile(payloadPath, JSON.stringify(payload), "utf-8");
    await fs.writeFile(runnerPath, DATABASE_SQLITE_RUNNER, "utf-8");

    const { stdout, stderr, exitCode } = await runPython(runnerPath, {
      timeoutMs: DATABASE_TIMEOUT_MS,
      cwd: workspace,
      maxOutputBytes: MAX_STDIO_BYTES,
    });

    const lines = stdout.trim().split("\n").filter(Boolean);
    const lastLine = lines[lines.length - 1] ?? "";
    let parsed: DatabaseExecutionOutput | null = null;

    try {
      parsed = JSON.parse(lastLine) as DatabaseExecutionOutput;
    } catch {
      parsed = null;
    }

    if (parsed) return parsed;

    const msg = stderr || stdout || `Database runner exited with code ${exitCode}`;
    return {
      passed: false,
      orderMatters: input.orderMatters ?? false,
      actualColumns: [],
      expectedColumns: input.columnNames ?? [],
      actualOutput: [],
      expectedOutput: input.expectedOutput,
      executionError: msg,
    };
  } finally {
    await fs.rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
}

const DATABASE_SQLITE_RUNNER = `
import json
import sqlite3
import time

PAYLOAD_PATH = "__payload__.json"
MAX_ROWS = 500

def strip_leading_comments(sql: str) -> str:
    lines = sql.splitlines()
    idx = 0
    while idx < len(lines):
        line = lines[idx].strip()
        if not line or line.startswith("--"):
            idx += 1
            continue
        break
    return "\\n".join(lines[idx:]).strip()

def canonical(val):
    if isinstance(val, dict):
        return {k: canonical(v) for k, v in sorted(val.items())}
    if isinstance(val, list):
        return [canonical(v) for v in val]
    if isinstance(val, float):
        return round(val, 8)
    return val

def compare_rows(actual_rows, expected_rows, order_matters):
    if order_matters:
        return canonical(actual_rows) == canonical(expected_rows)
    actual_norm = [json.dumps(canonical(r), sort_keys=True, separators=(",", ":")) for r in actual_rows]
    expected_norm = [json.dumps(canonical(r), sort_keys=True, separators=(",", ":")) for r in expected_rows]
    actual_norm.sort()
    expected_norm.sort()
    return actual_norm == expected_norm

def project_rows(rows, columns):
    if not columns:
        return rows
    out = []
    for row in rows:
        projected = {}
        for col in columns:
            projected[col] = row.get(col)
        out.append(projected)
    return out

def run():
    with open(PAYLOAD_PATH, "r", encoding="utf-8") as fh:
        payload = json.load(fh)

    sql = str(payload.get("sql", ""))
    schema_sql = str(payload.get("schema_sql", ""))
    seed_sql = str(payload.get("seed_sql", ""))
    expected_output = payload.get("expected_output", [])
    expected_columns = payload.get("column_names") or []
    order_matters = bool(payload.get("order_matters", False))
    timeout_ms = int(payload.get("timeout_ms", 12000))

    sql_to_run = strip_leading_comments(sql)
    if not sql_to_run:
        raise ValueError("SQL query is required.")

    # Keep preview execution read-only and single-statement.
    if ";" in sql_to_run.rstrip(";"):
        raise ValueError("Only a single SQL statement is allowed.")
    first_token = sql_to_run.split(None, 1)[0].lower()
    if first_token not in ("select", "with"):
        raise ValueError("Only SELECT/CTE queries are allowed for this challenge.")

    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(schema_sql)
    conn.executescript(seed_sql)

    deadline = time.monotonic() + (timeout_ms / 1000.0)
    def progress_handler():
        return 1 if time.monotonic() > deadline else 0

    conn.set_progress_handler(progress_handler, 4000)

    cur = conn.execute(sql_to_run)
    if cur.description is None:
        raise ValueError("Your SQL must return a result set.")

    actual_columns = [d[0] for d in cur.description]
    rows = cur.fetchmany(MAX_ROWS + 1)
    if len(rows) > MAX_ROWS:
        raise ValueError(f"Query returned too many rows ({MAX_ROWS}+). Please limit the output.")

    actual_output = [dict(r) for r in rows]

    if not expected_columns:
        if expected_output and isinstance(expected_output[0], dict):
            expected_columns = list(expected_output[0].keys())
        else:
            expected_columns = actual_columns

    actual_projected = project_rows(actual_output, expected_columns)
    expected_projected = project_rows(expected_output, expected_columns)

    columns_match = actual_columns == expected_columns
    rows_match = compare_rows(actual_projected, expected_projected, order_matters)
    passed = bool(columns_match and rows_match)

    result = {
        "passed": passed,
        "orderMatters": order_matters,
        "actualColumns": actual_columns,
        "expectedColumns": expected_columns,
        "actualOutput": actual_output,
        "expectedOutput": expected_projected,
        "executionError": None,
    }
    if not columns_match:
        result["executionError"] = "Selected columns do not match expected columns."
    elif not rows_match:
        result["executionError"] = "Query result did not match expected output."
    return result

if __name__ == "__main__":
    try:
        output = run()
    except Exception as exc:
        output = {
            "passed": False,
            "orderMatters": False,
            "actualColumns": [],
            "expectedColumns": [],
            "actualOutput": [],
            "expectedOutput": [],
            "executionError": str(exc),
        }
    print(json.dumps(output, separators=(",", ":")))
`.trim();
