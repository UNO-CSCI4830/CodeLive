import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  FlaskConical,
} from "lucide-react";
import type { BackendRunResult, BackendTestRequest } from "../types";
import "../styles/BackendRequestsPanel.css";

interface Props {
  testRequests: BackendTestRequest[];
  results: BackendRunResult[] | null;
  isRunning: boolean;
  fatalError?: string | null;
}

function pretty(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "string") return val;
  return JSON.stringify(val, null, 2);
}

export default function BackendRequestsPanel({
  testRequests,
  results,
  isRunning,
  fatalError,
}: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  const passedCount = useMemo(
    () => (results ? results.filter((r) => r.passed).length : 0),
    [results],
  );

  return (
    <div className="brp-panel">
      <div className="brp-header">
        <FlaskConical className="brp-header-icon" />
        <span className="brp-header-title">Request Tests</span>
        {results && (
          <span className="brp-summary">
            {passedCount}/{results.length} passed
          </span>
        )}
        {isRunning && <Loader2 className="brp-spinner" />}
      </div>

      {fatalError && <p className="brp-fatal">{fatalError}</p>}

      <div className="brp-list">
        {testRequests.map((tc, idx) => {
          const result = results?.[idx];
          const isExpanded = expandedIdx === idx;

          return (
            <div key={idx} className="brp-case">
              <button
                type="button"
                className={`brp-case-header ${
                  result ? (result.passed ? "brp-case-header--pass" : "brp-case-header--fail") : ""
                }`}
                onClick={() => setExpandedIdx((prev) => (prev === idx ? null : idx))}
              >
                <span className="brp-case-status">
                  {result ? (
                    result.passed ? (
                      <CheckCircle2 className="brp-icon-pass" />
                    ) : (
                      <XCircle className="brp-icon-fail" />
                    )
                  ) : (
                    <span className="brp-icon-pending" />
                  )}
                </span>
                <span className="brp-case-label">Test {idx + 1}</span>
                <span className="brp-case-method">{tc.method.toUpperCase()}</span>
                <span className="brp-case-path">{tc.path}</span>
                {isExpanded ? (
                  <ChevronDown className="brp-chevron" />
                ) : (
                  <ChevronRight className="brp-chevron" />
                )}
              </button>

              {isExpanded && (
                <div className="brp-case-body">
                  {tc.body && (
                    <div className="brp-field">
                      <span className="brp-field-label">Request Body</span>
                      <pre className="brp-field-value">{pretty(tc.body)}</pre>
                    </div>
                  )}

                  <div className="brp-field">
                    <span className="brp-field-label">Expected</span>
                    <pre className="brp-field-value">
                      {pretty({
                        status: tc.expected_status,
                        body: tc.expected_body ?? null,
                      })}
                    </pre>
                  </div>

                  {result && (
                    <>
                      <div className="brp-field">
                        <span className="brp-field-label">Actual</span>
                        <pre
                          className={`brp-field-value ${
                            result.passed ? "brp-field-value--pass" : "brp-field-value--fail"
                          }`}
                        >
                          {pretty({
                            status: result.actualStatus,
                            body: result.actualBody,
                          })}
                        </pre>
                      </div>

                      {result.error && (
                        <div className="brp-field">
                          <span className="brp-field-label">Error</span>
                          <pre className="brp-field-value brp-field-value--fail">
                            {result.error}
                          </pre>
                        </div>
                      )}
                    </>
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
