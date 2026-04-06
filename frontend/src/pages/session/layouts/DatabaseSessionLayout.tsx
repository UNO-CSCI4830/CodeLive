import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Play, Wifi, WifiOff } from "lucide-react";
import Editor from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useCollaborativeEditor } from "../hooks/useCollaborativeEditor";
import { loadDatabaseProblem } from "@/pages/question-catalogue/databasepreview/loadProblem";
import type {
  DatabaseProblem,
  DatabaseRunOutput,
} from "@/pages/question-catalogue/databasepreview/types";
import DatabaseProblemDescription from "@/pages/question-catalogue/databasepreview/components/DatabaseProblemDescription";
import SqlResultsPanel from "@/pages/question-catalogue/databasepreview/components/SqlResultsPanel";
import AIAssistant, { type AIAssistantHandle } from "../components/AIAssistant";
import type { SessionLayoutHandle } from "./LeetcodeSessionLayout";
import "./DatabaseSessionLayout.css";

interface Props {
  sessionId: string;
  problemId: string;
  orderIndex: number;
  locked: boolean;
  userName: string;
  userColor: string;
  aiEnabled: boolean;
  canSendAi: boolean;
}

const TAB_SOLUTION = "solution";
const TAB_SCHEMA = "schema";

const DatabaseSessionLayout = forwardRef<SessionLayoutHandle, Props>(
  function DatabaseSessionLayout(
    {
      sessionId,
      problemId,
      orderIndex,
      locked,
      userName,
      userColor,
      aiEnabled,
      canSendAi,
    },
    ref,
  ) {
    const [problem, setProblem] = useState<DatabaseProblem | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadingProblem, setLoadingProblem] = useState(true);

    const aiRef = useRef<AIAssistantHandle>(null);
    const [hintsUsed, setHintsUsed] = useState(0);

    const [activeTab, setActiveTab] = useState<string>(TAB_SOLUTION);
    const [solutionCode, setSolutionCode] = useState("");
    const [runResult, setRunResult] = useState<DatabaseRunOutput | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
      setLoadingProblem(true);
      setLoadError(null);

      loadDatabaseProblem(problemId)
        .then((p) => {
          setProblem(p);
          const editable = p.starter_files.find((f) => !f.readonly) ?? p.starter_files[0];
          setSolutionCode(editable?.content ?? "");
          setActiveTab(TAB_SOLUTION);
          setRunResult(null);
        })
        .catch((e) => setLoadError(String(e)))
        .finally(() => setLoadingProblem(false));
    }, [problemId]);

    const editableFile = useMemo(
      () => problem?.starter_files.find((f) => !f.readonly) ?? problem?.starter_files[0],
      [problem],
    );
    const editablePath = editableFile?.path ?? "solution.sql";
    const schemaSql = problem?.test_config.schema_sql ?? "";

    const roomName = problem
      ? `session:${sessionId}:q:${orderIndex}:file:${editablePath}`
      : "";

    const { connected, bindEditor, getText } = useCollaborativeEditor({
      roomName,
      initialCode: solutionCode,
      readOnly: locked,
      userName,
      userColor,
    });

    useImperativeHandle(ref, () => ({
      captureSnapshot: () => ({
        code: getText(),
        hintsUsed,
        aiMessages: aiRef.current?.getMessages() ?? [],
        problemTitle: problem?.title ?? "",
        problemDescription: problem?.description ?? "",
        language: "sql",
      }),
    }));

    const handleSolutionMount = useCallback(
      (editor: MonacoEditor.IStandaloneCodeEditor) => {
        bindEditor(editor);
        if (locked) editor.updateOptions({ readOnly: true });
      },
      [bindEditor, locked],
    );

    const handleSolutionChange = useCallback((value: string | undefined) => {
      setSolutionCode(value ?? "");
    }, []);

    const handleRun = useCallback(async () => {
      if (!problem || isRunning || locked) return;

      setIsRunning(true);
      setRunResult(null);

      try {
        const sql = getText();
        const res = await fetch("/api/run/database/sql-lite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problemId: problem.id,
            sql,
            fileContents: { [editablePath]: sql },
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Run failed (${res.status})`);
        }

        setRunResult((await res.json()) as DatabaseRunOutput);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setRunResult({
          passed: false,
          orderMatters: Boolean(problem.test_config.order_matters),
          actualColumns: [],
          expectedColumns: problem.test_config.column_names ?? [],
          actualOutput: [],
          expectedOutput: problem.test_config.expected_output,
          executionError: msg,
        });
      } finally {
        setIsRunning(false);
      }
    }, [problem, isRunning, locked, getText, editablePath]);

    const [leftWidth, setLeftWidth] = useState(0.4);
    const [editorRatio, setEditorRatio] = useState(0.6);
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
          const ratio = e.clientX / window.innerWidth;
          setLeftWidth(Math.min(Math.max(ratio, 0.24), 0.62));
        } else {
          const colEl = rightColRef.current;
          if (!colEl) return;
          const rect = colEl.getBoundingClientRect();
          const ratio = (e.clientY - rect.top) / rect.height;
          setEditorRatio(Math.min(Math.max(ratio, 0.25), 0.85));
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

    if (loadingProblem) {
      return (
        <div className="dsl-loading">
          <Loader2 className="dsl-loading-spinner" />
          <p>Loading problem…</p>
        </div>
      );
    }

    if (loadError || !problem) {
      return (
        <div className="dsl-error">
          <p>{loadError ?? "Problem not found."}</p>
        </div>
      );
    }

    return (
      <div className={`dsl-body ${isDragging ? "dsl-body--resizing" : ""}`}>
        {aiEnabled && (
          <AIAssistant
            ref={aiRef}
            sessionId={sessionId}
            problemId={problemId}
            orderIndex={orderIndex}
            canSend={canSendAi}
            problemTitle={problem.title}
            problemDescription={problem.description ?? ""}
            currentCode={getText()}
            language="sql"
            locked={locked}
            problemKey={`${orderIndex}:${problemId}`}
          />
        )}

        <section className="dsl-desc-col" style={{ width: `${leftWidth * 100}%` }}>
          <DatabaseProblemDescription problem={problem} onHintReveal={setHintsUsed} />
        </section>

        <div className="dsl-resize-col" onMouseDown={onResizeStart("col")} />

        <section
          className="dsl-editor-col"
          ref={rightColRef}
          style={{ width: `${(1 - leftWidth) * 100}%` }}
        >
          <div className="dsl-editor-toolbar">
            <div className="dsl-editor-toolbar-left">
              <button
                type="button"
                className={`dsl-tab ${activeTab === TAB_SOLUTION ? "dsl-tab--active" : ""}`}
                onClick={() => setActiveTab(TAB_SOLUTION)}
              >
                {editablePath}
              </button>
              <button
                type="button"
                className={`dsl-tab ${activeTab === TAB_SCHEMA ? "dsl-tab--active" : ""}`}
                onClick={() => setActiveTab(TAB_SCHEMA)}
              >
                schema.sql
              </button>
            </div>

            <div className="dsl-editor-toolbar-right">
              <span className={`dsl-collab-status ${connected ? "dsl-collab-status--connected" : ""}`}>
                {connected ? (
                  <>
                    <Wifi className="dsl-collab-icon" /> Connected
                  </>
                ) : (
                  <>
                    <WifiOff className="dsl-collab-icon" /> Connecting…
                  </>
                )}
              </span>

              <button
                type="button"
                className="dsl-run-btn"
                onClick={handleRun}
                disabled={isRunning || locked}
              >
                {isRunning ? (
                  <Loader2 className="dsl-btn-icon dsl-btn-icon--spin" />
                ) : (
                  <Play className="dsl-btn-icon" />
                )}
                {isRunning ? "Running…" : "Run"}
              </button>
            </div>
          </div>

          <div className="dsl-editor-pane" style={{ height: `${editorRatio * 100}%` }}>
            {activeTab === TAB_SOLUTION ? (
              <Editor
                key={`${problemId}:solution`}
                height="100%"
                language="sql"
                theme="vs-dark"
                onMount={handleSolutionMount}
                onChange={handleSolutionChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  tabSize: 2,
                  automaticLayout: true,
                  padding: { top: 12 },
                  renderLineHighlight: "line",
                  cursorBlinking: "smooth",
                  smoothScrolling: true,
                  readOnly: locked,
                }}
              />
            ) : (
              <Editor
                key={`${problemId}:schema`}
                height="100%"
                language="sql"
                value={schemaSql}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  tabSize: 2,
                  automaticLayout: true,
                  padding: { top: 12 },
                  renderLineHighlight: "line",
                  readOnly: true,
                }}
              />
            )}
          </div>

          <div className="dsl-resize-row" onMouseDown={onResizeStart("row")} />

          <div className="dsl-results-pane" style={{ height: `${(1 - editorRatio) * 100}%` }}>
            <SqlResultsPanel
              result={runResult}
              isRunning={isRunning}
              defaultExpectedRows={problem.test_config.expected_output}
              defaultExpectedColumns={problem.test_config.column_names ?? []}
            />
          </div>
        </section>
      </div>
    );
  },
);

export default DatabaseSessionLayout;
