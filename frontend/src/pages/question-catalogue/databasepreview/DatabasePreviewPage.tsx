import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Loader2, Play, RotateCcw } from "lucide-react";
import CodeEditor from "../frontendpreview/components/CodeEditor";
import { loadDatabaseProblem } from "./loadProblem";
import DatabaseProblemDescription from "./components/DatabaseProblemDescription";
import SqlResultsPanel from "./components/SqlResultsPanel";
import type { DatabaseProblem, DatabaseRunOutput } from "./types";
import { apiFetch } from "@/lib/apiClient";
import "./styles/DatabasePreviewPage.css";

const SCHEMA_TAB_ID = "__schema__";

export default function DatabasePreviewPage() {
  const { problemId } = useParams<{ problemId: string }>();
  const [problem, setProblem] = useState<DatabaseProblem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!problemId) return;

    setLoading(true);
    setError(null);

    loadDatabaseProblem(problemId)
      .then(setProblem)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [problemId]);

  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>(SCHEMA_TAB_ID);

  useEffect(() => {
    if (!problem) return;

    const initial: Record<string, string> = {};
    for (const file of problem.starter_files) {
      initial[file.path] = file.content;
    }
    setFileContents(initial);

    const firstEditable =
      problem.starter_files.find((f) => !f.readonly) ?? problem.starter_files[0];
    setActiveTab(firstEditable?.path ?? SCHEMA_TAB_ID);
  }, [problem]);

  const editableFilePath = useMemo(() => {
    if (!problem) return "";
    const editable =
      problem.starter_files.find((f) => !f.readonly) ?? problem.starter_files[0];
    return editable?.path ?? "";
  }, [problem]);

  const activeStarterFile = useMemo(
    () => problem?.starter_files.find((f) => f.path === activeTab),
    [problem, activeTab],
  );
  const activeLanguage = activeTab === SCHEMA_TAB_ID ? "sql" : (activeStarterFile?.language ?? "sql");
  const editorValue = activeTab === SCHEMA_TAB_ID
    ? (problem?.test_config.schema_sql ?? "")
    : (fileContents[activeTab] ?? "");
  const isReadOnly = activeTab === SCHEMA_TAB_ID || Boolean(activeStarterFile?.readonly);

  const onCodeChange = useCallback(
    (value: string) => {
      if (!activeTab || activeTab === SCHEMA_TAB_ID) return;
      setFileContents((prev) => ({ ...prev, [activeTab]: value }));
    },
    [activeTab],
  );

  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<DatabaseRunOutput | null>(null);

  const handleReset = useCallback(() => {
    if (!problem) return;

    const initial: Record<string, string> = {};
    for (const file of problem.starter_files) {
      initial[file.path] = file.content;
    }
    setFileContents(initial);
    setRunResult(null);
  }, [problem]);

  const handleRun = useCallback(async () => {
    if (!problem || isRunning) return;
    setIsRunning(true);
    setRunResult(null);

    try {
      const res = await apiFetch("/api/run/database/sql-lite", {
        method: "POST",
        body: JSON.stringify({
          problemId: problem.id,
          fileContents,
          sql: editableFilePath ? fileContents[editableFilePath] : "",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Run failed (${res.status})`);
      }

      const data = (await res.json()) as DatabaseRunOutput;
      setRunResult(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setRunResult({
        passed: false,
        orderMatters: Boolean(problem.test_config.order_matters),
        actualColumns: [],
        expectedColumns: problem.test_config.column_names ?? [],
        actualOutput: [],
        expectedOutput: problem.test_config.expected_output,
        executionError: message,
      });
    } finally {
      setIsRunning(false);
    }
  }, [problem, isRunning, fileContents, editableFilePath]);

  const [leftWidth, setLeftWidth] = useState(0.4);
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
        setLeftWidth(Math.min(Math.max(nextRatio, 0.24), 0.62));
      } else {
        const colEl = rightColRef.current;
        if (!colEl) return;
        const rect = colEl.getBoundingClientRect();
        const nextRatio = (e.clientY - rect.top) / rect.height;
        setEditorRatio(Math.min(Math.max(nextRatio, 0.3), 0.86));
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
      <div className="dp-loading">
        <Loader2 className="dp-loading-spinner" />
        <p>Loading database problem…</p>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="dp-error">
        <p>{error ?? "Problem not found."}</p>
        <Link to="/questions/database" className="dp-back-link">
          <ChevronLeft className="dp-back-icon" /> Back to Database problems
        </Link>
      </div>
    );
  }

  return (
    <div className={`dp-shell${isDragging ? " dp-shell--resizing" : ""}`}>
      <header className="dp-header">
        <Link to="/questions/database" className="dp-header-back">
          <ChevronLeft className="dp-header-back-icon" />
          <span className="dp-header-back-text">Problems</span>
        </Link>

        <div className="dp-header-actions">
          <button
            type="button"
            className="dp-reset-btn"
            onClick={handleReset}
            title="Reset to starter SQL"
          >
            <RotateCcw className="dp-btn-icon" />
            Reset
          </button>

          <button
            type="button"
            className="dp-run-btn"
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 className="dp-btn-icon dp-btn-icon--spin" />
            ) : (
              <Play className="dp-btn-icon" />
            )}
            {isRunning ? "Running…" : "Run Query"}
          </button>
        </div>
      </header>

      <div className="dp-body">
        <section className="dp-desc-col" style={{ width: `${leftWidth * 100}%` }}>
          <DatabaseProblemDescription problem={problem} />
        </section>

        <div className="dp-resize-col" onMouseDown={onResizeStart("col")} />

        <section
          className="dp-editor-col"
          ref={rightColRef}
          style={{ width: `${(1 - leftWidth) * 100}%` }}
        >
          <div className="dp-editor-pane" style={{ height: `${editorRatio * 100}%` }}>
            <div className="dp-editor-toolbar">
              <div className="dp-file-structure" role="tablist" aria-label="SQL files">
                {problem.starter_files.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    className={`dp-file-chip ${activeTab === file.path ? "dp-file-chip--active" : ""}`}
                    onClick={() => setActiveTab(file.path)}
                  >
                    <span className="dp-file-chip-name">{file.path}</span>
                    {!file.readonly && <span className="dp-chip-badge">editable</span>}
                  </button>
                ))}
                <button
                  type="button"
                  className={`dp-file-chip ${activeTab === SCHEMA_TAB_ID ? "dp-file-chip--active" : ""}`}
                  onClick={() => setActiveTab(SCHEMA_TAB_ID)}
                >
                  <span className="dp-file-chip-name">schema.sql</span>
                  <span className="dp-chip-badge dp-chip-badge--schema">schema</span>
                </button>
              </div>

              <span className="dp-active-language">{activeLanguage}</span>
            </div>

            <CodeEditor
              path={activeTab === SCHEMA_TAB_ID ? "schema.sql" : (activeTab || "solution.sql")}
              value={editorValue}
              language={activeLanguage}
              readOnly={isReadOnly}
              onChange={onCodeChange}
            />
          </div>

          <div className="dp-resize-row" onMouseDown={onResizeStart("row")} />

          <div className="dp-results-pane" style={{ height: `${(1 - editorRatio) * 100}%` }}>
            <SqlResultsPanel
              result={runResult}
              isRunning={isRunning}
              defaultExpectedRows={problem.test_config.expected_output}
              defaultExpectedColumns={problem.test_config.column_names ?? []}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
