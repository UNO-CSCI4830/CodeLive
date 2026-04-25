import {
  CheckCircle2,
  Database,
  Loader2,
  XCircle,
} from "lucide-react";
import type { DatabaseRunOutput } from "../types";
import "../styles/SqlResultsPanel.css";

interface Props {
  result: DatabaseRunOutput | null;
  isRunning: boolean;
  defaultExpectedRows: Array<Record<string, unknown>>;
  defaultExpectedColumns: string[];
}

function toCellValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function inferColumns(
  rows: Array<Record<string, unknown>>,
  fallback: string[],
): string[] {
  if (fallback.length > 0) return fallback;
  const first = rows[0];
  if (!first) return [];
  return Object.keys(first);
}

function SqlTable({
  title,
  rows,
  columns,
  emptyLabel,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  columns: string[];
  emptyLabel: string;
}) {
  return (
    <section className="srp-table-wrap">
      <div className="srp-table-title">{title}</div>
      {rows.length === 0 || columns.length === 0 ? (
        <p className="srp-empty">{emptyLabel}</p>
      ) : (
        <div className="srp-table-scroll">
          <table className="srp-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {columns.map((col) => (
                    <td key={`${rowIdx}-${col}`}>{toCellValue(row[col])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function SqlResultsPanel({
  result,
  isRunning,
  defaultExpectedRows,
  defaultExpectedColumns,
}: Props) {
  const expectedRows = result?.expectedOutput ?? defaultExpectedRows;
  const expectedColumns = inferColumns(
    expectedRows,
    result?.expectedColumns ?? defaultExpectedColumns,
  );
  const actualRows = result?.actualOutput ?? [];
  const actualColumns = inferColumns(actualRows, result?.actualColumns ?? []);

  return (
    <div className="srp-panel">
      <div className="srp-header">
        <Database className="srp-header-icon" />
        <span className="srp-header-title">Query Results</span>
        {result && (
          <span className="srp-status">
            {result.passed ? (
              <>
                <CheckCircle2 className="srp-status-icon srp-status-icon--pass" />
                Pass
              </>
            ) : (
              <>
                <XCircle className="srp-status-icon srp-status-icon--fail" />
                Fail
              </>
            )}
          </span>
        )}
        {isRunning && <Loader2 className="srp-spinner" />}
      </div>

      {result?.executionError && (
        <p className="srp-error">{result.executionError}</p>
      )}

      <div className="srp-content">
        <SqlTable
          title="Last Query Output"
          rows={actualRows}
          columns={actualColumns}
          emptyLabel={
            isRunning
              ? "Running query..."
              : "Run query to see output."
          }
        />
        <SqlTable
          title="Expected Output"
          rows={expectedRows}
          columns={expectedColumns}
          emptyLabel="No expected output configured."
        />
      </div>
    </div>
  );
}
