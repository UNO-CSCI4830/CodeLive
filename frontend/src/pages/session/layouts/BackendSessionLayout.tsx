import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ChevronRight, Loader2, Play, Wifi, WifiOff } from "lucide-react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useCollaborativeEditor } from "../hooks/useCollaborativeEditor";
import { loadBackendProblem } from "@/pages/question-catalogue/backendpreview/loadProblem";
import type {
  BackendProblem,
  BackendRunResult,
  BackendStarterFile,
} from "@/pages/question-catalogue/backendpreview/types";
import FileTree from "@/pages/question-catalogue/frontendpreview/components/FileTree";
import BackendRequestsPanel from "@/pages/question-catalogue/backendpreview/components/BackendRequestsPanel";
import BackendProblemDescription from "@/pages/question-catalogue/backendpreview/components/BackendProblemDescription";
import AIAssistant, { type AIAssistantHandle } from "../components/AIAssistant";
import type { SessionLayoutHandle } from "./LeetcodeSessionLayout";
import "./BackendSessionLayout.css";

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

function toMonacoLang(lang: string): string {
  switch (lang) {
    case "tsx":
    case "jsx":
    case "ts":
      return "typescript";
    case "js":
      return "javascript";
    default:
      return lang;
  }
}

const BackendSessionLayout = forwardRef<SessionLayoutHandle, Props>(function BackendSessionLayout(
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
  const [problem, setProblem] = useState<BackendProblem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingProblem, setLoadingProblem] = useState(true);

  const aiRef = useRef<AIAssistantHandle>(null);
  const [hintsUsed, setHintsUsed] = useState(0);

  useImperativeHandle(ref, () => ({
    captureSnapshot: () => ({
      code: JSON.stringify(fileContents, null, 2),
      hintsUsed,
      aiMessages: aiRef.current?.getMessages() ?? [],
      problemTitle: problem?.title ?? "",
      problemDescription: problem?.description ?? "",
      language: "python",
    }),
  }));

  useEffect(() => {
    setLoadingProblem(true);
    setLoadError(null);

    loadBackendProblem(problemId)
      .then(setProblem)
      .catch((e) => setLoadError(String(e)))
      .finally(() => setLoadingProblem(false));
  }, [problemId]);

  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [activeFilePath, setActiveFilePath] = useState("");
  const [treeCollapsed, setTreeCollapsed] = useState(false);

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

  const activeFileObj: BackendStarterFile | undefined = useMemo(
    () => problem?.starter_files.find((f) => f.path === activeFilePath),
    [problem, activeFilePath],
  );

  const roomName = activeFilePath
    ? `session:${sessionId}:q:${orderIndex}:file:${activeFilePath}`
    : "";

  const { connected, bindEditor } = useCollaborativeEditor({
    roomName,
    initialCode: fileContents[activeFilePath] ?? "",
    readOnly: locked || (activeFileObj?.readonly ?? false),
    userName,
    userColor,
  });

  const monacoConfigured = useRef(false);
  const handleBeforeMount = useCallback((monaco: Monaco) => {
    if (monacoConfigured.current) return;
    monacoConfigured.current = true;

    const ts = monaco.languages.typescript;
    ts.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    ts.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
  }, []);

  const handleEditorMount = useCallback(
    (editor: MonacoEditor.IStandaloneCodeEditor) => {
      bindEditor(editor);
      if (locked || activeFileObj?.readonly) {
        editor.updateOptions({ readOnly: true });
      }
    },
    [bindEditor, locked, activeFileObj?.readonly],
  );

  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      if (!activeFilePath) return;
      setFileContents((prev) => ({ ...prev, [activeFilePath]: value ?? "" }));
    },
    [activeFilePath],
  );

  const [isRunning, setIsRunning] = useState(false);
  const [runResults, setRunResults] = useState<BackendRunResult[] | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    if (!problem || isRunning || locked) return;

    setIsRunning(true);
    setRunResults(null);
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
      setRunResults(data.results ?? []);
      setFatalError(data.fatalError ?? null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setFatalError(message);
      setRunResults(
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
  }, [problem, isRunning, locked, fileContents]);

  const [rightColWidth, setRightColWidth] = useState(430);
  const [panelRatio, setPanelRatio] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const rightColRef = useRef<HTMLElement>(null);
  const dragging = useRef<"col" | "row" | null>(null);
  const dragStartRef = useRef({ x: 0, startW: 0 });

  const onResizeStart = useCallback(
    (axis: "col" | "row") => (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = axis;
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, startW: rightColWidth };
      document.body.style.cursor = axis === "col" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [rightColWidth],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;

      if (dragging.current === "col") {
        const delta = dragStartRef.current.x - e.clientX;
        const nextWidth = Math.min(Math.max(dragStartRef.current.startW + delta, 280), window.innerWidth * 0.65);
        setRightColWidth(nextWidth);
      } else {
        const colEl = rightColRef.current;
        if (!colEl) return;
        const rect = colEl.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const nextRatio = Math.min(Math.max(offsetY / rect.height, 0.2), 0.8);
        setPanelRatio(nextRatio);
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

  if (loadingProblem || Object.keys(fileContents).length === 0) {
    return (
      <div className="bsl-loading">
        <Loader2 className="bsl-loading-spinner" />
        <p>Loading problem…</p>
      </div>
    );
  }

  if (loadError || !problem) {
    return (
      <div className="bsl-error">
        <p>{loadError ?? "Problem not found."}</p>
      </div>
    );
  }

  return (
    <div className={`bsl-body ${isDragging ? "bsl-body--resizing" : ""}`}>
      {aiEnabled && (
        <AIAssistant
          ref={aiRef}
          sessionId={sessionId}
          problemId={problemId}
          orderIndex={orderIndex}
          canSend={canSendAi}
          problemTitle={problem.title}
          problemDescription={problem.description ?? ""}
          currentCode={fileContents[activeFilePath] ?? ""}
          language="python"
          locked={locked}
          problemKey={`${orderIndex}:${problemId}`}
        />
      )}

      <FileTree
        files={problem.starter_files}
        activeFile={activeFilePath}
        onSelect={setActiveFilePath}
        collapsed={treeCollapsed}
        onToggleCollapse={() => setTreeCollapsed((v) => !v)}
      />

      <section className="bsl-editor-col">
        <div className="bsl-editor-toolbar">
          <div className="bsl-editor-toolbar-left">
            {treeCollapsed && (
              <button
                type="button"
                className="bsl-tree-toggle"
                onClick={() => setTreeCollapsed(false)}
                title="Expand file tree"
              >
                <ChevronRight className="bsl-tree-toggle-icon" />
              </button>
            )}

            <span className="bsl-active-file">{activeFilePath}</span>
          </div>

          <div className="bsl-editor-toolbar-right">
            <span className={`bsl-collab-status ${connected ? "bsl-collab-status--connected" : ""}`}>
              {connected ? (
                <>
                  <Wifi className="bsl-collab-icon" /> Connected
                </>
              ) : (
                <>
                  <WifiOff className="bsl-collab-icon" /> Connecting…
                </>
              )}
            </span>

            <button
              type="button"
              className="bsl-run-btn"
              onClick={handleRun}
              disabled={isRunning || locked}
            >
              {isRunning ? (
                <Loader2 className="bsl-btn-icon bsl-btn-icon--spin" />
              ) : (
                <Play className="bsl-btn-icon" />
              )}
              {isRunning ? "Running…" : "Run"}
            </button>
          </div>
        </div>

        <Editor
          key={activeFilePath}
          height="100%"
          language={toMonacoLang(activeFileObj?.language ?? "python")}
          theme="vs-dark"
          beforeMount={handleBeforeMount}
          onMount={handleEditorMount}
          onChange={handleCodeChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 4,
            automaticLayout: true,
            padding: { top: 12 },
            renderLineHighlight: "line",
            cursorBlinking: "smooth",
            smoothScrolling: true,
            readOnly: locked || (activeFileObj?.readonly ?? false),
            bracketPairColorization: { enabled: true },
          }}
        />
      </section>

      <div className="bsl-resize-col" onMouseDown={onResizeStart("col")} />

      <section
        className="bsl-right-col"
        ref={rightColRef}
        style={{ width: rightColWidth, minWidth: 280 }}
      >
        <div className="bsl-tests-pane" style={{ height: `${panelRatio * 100}%` }}>
          <BackendRequestsPanel
            testRequests={problem.test_config.test_requests}
            results={runResults}
            isRunning={isRunning}
            fatalError={fatalError}
          />
        </div>

        <div className="bsl-resize-row" onMouseDown={onResizeStart("row")} />

        <div className="bsl-desc-pane" style={{ height: `${(1 - panelRatio) * 100}%` }}>
          <BackendProblemDescription
            problem={problem}
            onHintReveal={setHintsUsed}
          />
        </div>
      </section>

    </div>
  );
});

export default BackendSessionLayout;
