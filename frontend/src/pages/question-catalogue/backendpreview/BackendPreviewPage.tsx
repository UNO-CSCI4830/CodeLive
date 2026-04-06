import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, Loader2, Play, RotateCcw } from "lucide-react";
import BackendProblemDescription from "./components/BackendProblemDescription";
import BackendRequestsPanel from "./components/BackendRequestsPanel";
import { loadBackendProblem } from "./loadProblem";
import type { BackendProblem, BackendRunResult } from "./types";
import CodeEditor from "../frontendpreview/components/CodeEditor";
import "./styles/BackendPreviewPage.css";

export default function BackendPreviewPage() {
  const { problemId } = useParams<{ problemId: string }>();

  const [problem, setProblem] = useState<BackendProblem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!problemId) return;

    setLoading(true);
    setError(null);

    loadBackendProblem(problemId)
      .then(setProblem)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [problemId]);

  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [activeFilePath, setActiveFilePath] = useState("");

  useEffect(() => {
    if (!problem) return;

    const initial: Record<string, string> = {};
    for (const f of problem.starter_files) {
      initial[f.path] = f.content;
    }

    setFileContents(initial);
    const firstEditable =
      problem.starter_files.find((f) => !f.readonly) ?? problem.starter_files[0];
    setActiveFilePath(firstEditable?.path ?? "");
  }, [problem]);

  const activeFileObj = useMemo(
    () => problem?.starter_files.find((f) => f.path === activeFilePath),
    [problem, activeFilePath],
  );

  const handleCodeChange = useCallback(
    (value: string) => {
      if (!activeFilePath) return;
      setFileContents((prev) => ({ ...prev, [activeFilePath]: value }));
    },
    [activeFilePath],
  );

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BackendRunResult[] | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const handleReset = useCallback(() => {
    if (!problem) return;

    const initial: Record<string, string> = {};
    for (const f of problem.starter_files) {
      initial[f.path] = f.content;
    }

    setFileContents(initial);
    setResults(null);
    setFatalError(null);
  }, [problem]);

  const handleRun = useCallback(async () => {
    if (!problem || isRunning) return;

    setIsRunning(true);
    setResults(null);
    setFatalError(null);

    try {
      const res = await fetch("/api/run/backend/python", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: problem.id,
          fileContents,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Run failed (${res.status})`);
      }

      const data = await res.json();
      setResults(data.results ?? []);
      setFatalError(data.fatalError ?? null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setFatalError(message);
      setResults(
        problem.test_config.test_requests.map((tc, idx) => ({
          index: idx,
          method: tc.method,
          path: tc.path,
          passed: false,
          expectedStatus: tc.expected_status,
          actualStatus: null,
          expectedBody: tc.expected_body ?? null,
          actualBody: null,
          error: message,
        })),
      );
    } finally {
      setIsRunning(false);
    }
  }, [problem, isRunning, fileContents]);

  const [leftWidth, setLeftWidth] = useState(0.42);
  const [editorRatio, setEditorRatio] = useState(0.62);
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef<"col" | "row" | null>(null);
  const rightColRef = useRef<HTMLElement>(null);

  const onResizeStart = useCallback(
    (axis: "col" | "row") => (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = axis;
      setIsDragging(true);
      document.body.style.cursor = axis === "col" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;

      if (dragging.current === "col") {
        const nextRatio = e.clientX / window.innerWidth;
        setLeftWidth(Math.min(Math.max(nextRatio, 0.25), 0.62));
      } else {
        const colEl = rightColRef.current;
        if (!colEl) return;
        const rect = colEl.getBoundingClientRect();
        const nextRatio = (e.clientY - rect.top) / rect.height;
        setEditorRatio(Math.min(Math.max(nextRatio, 0.25), 0.85));
      }
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = null;
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  if (loading) {
    return (
      <div className="bp-loading">
        <Loader2 className="bp-loading-spinner" />
        <p>Loading backend problem…</p>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="bp-error">
        <p>{error ?? "Problem not found."}</p>
        <Link to="/questions/backend" className="bp-back-link">
          <ChevronLeft className="bp-back-icon" /> Back to Backend problems
        </Link>
      </div>
    );
  }

  return (
    <div className={`bp-shell${isDragging ? " bp-shell--resizing" : ""}`}>
      <header className="bp-header">
        <Link to="/questions/backend" className="bp-header-back">
          <ChevronLeft className="bp-header-back-icon" />
          <span className="bp-header-back-text">Problems</span>
        </Link>

        <div className="bp-header-actions">
          <button
            type="button"
            className="bp-reset-btn"
            onClick={handleReset}
            title="Reset to starter code"
          >
            <RotateCcw className="bp-btn-icon" />
            Reset
          </button>

          <button
            type="button"
            className="bp-run-btn"
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 className="bp-btn-icon bp-btn-icon--spin" />
            ) : (
              <Play className="bp-btn-icon" />
            )}
            {isRunning ? "Running…" : "Run"}
          </button>
        </div>
      </header>

      <div className="bp-body">
        <section className="bp-desc-col" style={{ width: `${leftWidth * 100}%` }}>
          <BackendProblemDescription problem={problem} />
        </section>

        <div className="bp-resize-col" onMouseDown={onResizeStart("col")} />

        <section
          className="bp-editor-col"
          ref={rightColRef}
          style={{ width: `${(1 - leftWidth) * 100}%` }}
        >
          <div className="bp-editor-pane" style={{ height: `${editorRatio * 100}%` }}>
            <div className="bp-editor-toolbar">
              <div className="bp-file-structure" role="tablist" aria-label="Problem files">
                {problem.starter_files.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    className={`bp-file-chip ${activeFilePath === f.path ? "bp-file-chip--active" : ""}`}
                    onClick={() => setActiveFilePath(f.path)}
                    title={f.readonly ? `${f.path} (read-only)` : f.path}
                  >
                    <span className="bp-file-chip-name">{f.path}</span>
                    {f.readonly && <span className="bp-file-chip-ro">RO</span>}
                  </button>
                ))}
              </div>

              <span className="bp-active-language">{activeFileObj?.language ?? "python"}</span>
            </div>

            <CodeEditor
              path={activeFilePath || "app/main.py"}
              value={fileContents[activeFilePath] ?? ""}
              language={activeFileObj?.language ?? "python"}
              readOnly={activeFileObj?.readonly ?? false}
              onChange={handleCodeChange}
            />
          </div>

          <div className="bp-resize-row" onMouseDown={onResizeStart("row")} />

          <div className="bp-tests-pane" style={{ height: `${(1 - editorRatio) * 100}%` }}>
            <BackendRequestsPanel
              testRequests={problem.test_config.test_requests}
              results={results}
              isRunning={isRunning}
              fatalError={fatalError}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
