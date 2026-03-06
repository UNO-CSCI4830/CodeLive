import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  FlaskConical,
} from "lucide-react";
import type { TestCase, TestResult } from "../types";
import "../styles/TestCasesPanel.css";

/**
 * Format the input object as LeetCode-style lines:
 *   nums = [100, 4, 200, 1, 3, 2]
 *   target = 9
 */
function formatInput(input: Record<string, unknown>): string {
  return Object.entries(input)
    .map(([key, val]) => `${key} = ${JSON.stringify(val)}`)
    .join("\n");
}

/**
 * Format an output/expected value compactly.
 * Arrays stay on one line; scalars are plain.
 */
function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return JSON.stringify(val);
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}

interface Props {
  testCases: TestCase[];
  results: TestResult[] | null;
  isRunning: boolean;
}

export default function TestCasesPanel({ testCases, results, isRunning }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  const toggle = (idx: number) =>
    setExpandedIdx((prev) => (prev === idx ? null : idx));

  return (
    <div className="tcp-panel">
      <div className="tcp-header">
        <FlaskConical className="tcp-header-icon" />
        <span className="tcp-header-title">Test Cases</span>
        {results && (
          <span className="tcp-summary">
            {results.filter((r) => r.passed).length}/{results.length} passed
          </span>
        )}
        {isRunning && <Loader2 className="tcp-spinner" />}
      </div>

      <div className="tcp-list">
        {testCases.map((tc, idx) => {
          const result = results?.[idx];
          const isExpanded = expandedIdx === idx;

          return (
            <div key={idx} className="tcp-case">
              <button
                type="button"
                className={`tcp-case-header ${result ? (result.passed ? "tcp-case-header--pass" : "tcp-case-header--fail") : ""}`}
                onClick={() => toggle(idx)}
              >
                <span className="tcp-case-status">
                  {result ? (
                    result.passed ? (
                      <CheckCircle2 className="tcp-icon-pass" />
                    ) : (
                      <XCircle className="tcp-icon-fail" />
                    )
                  ) : (
                    <span className="tcp-icon-pending" />
                  )}
                </span>
                <span className="tcp-case-label">Case {idx + 1}</span>
                {tc.explanation && (
                  <span className="tcp-case-desc">{tc.explanation}</span>
                )}
                {isExpanded ? (
                  <ChevronDown className="tcp-chevron" />
                ) : (
                  <ChevronRight className="tcp-chevron" />
                )}
              </button>

              {isExpanded && (
                <div className="tcp-case-body">
                  <div className="tcp-field">
                    <span className="tcp-field-label">Input</span>
                    <pre className="tcp-field-value">
                      {formatInput(tc.input)}
                    </pre>
                  </div>
                  <div className="tcp-field">
                    <span className="tcp-field-label">Expected</span>
                    <pre className="tcp-field-value">
                      {formatValue(tc.expected.result)}
                    </pre>
                  </div>
                  {result && (
                    <div className="tcp-field">
                      <span className="tcp-field-label">Output</span>
                      <pre
                        className={`tcp-field-value ${result.passed ? "tcp-field-value--pass" : "tcp-field-value--fail"}`}
                      >
                        {result.error
                          ? result.error
                          : formatValue(result.actual)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
