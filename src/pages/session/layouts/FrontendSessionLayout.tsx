/**
 * FrontendSessionLayout — interview room layout for frontend problems.
 *
 * Layout: [FileTree | CollabEditor | LivePreview / Description+AI]
 * Features: collaborative editing via Yjs, live preview, file tree, AI assistant tab
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ChevronRight, Loader2, Wifi, WifiOff } from "lucide-react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useCollaborativeEditor } from "../hooks/useCollaborativeEditor";
import { loadFrontendProblem } from "@/pages/question-catalogue/frontendpreview/loadProblem";
import type { FrontendProblem, StarterFile } from "@/pages/question-catalogue/frontendpreview/types";
import FileTree from "@/pages/question-catalogue/frontendpreview/components/FileTree";
import LivePreview from "@/pages/question-catalogue/frontendpreview/components/LivePreview";
import ProblemDescription from "@/pages/question-catalogue/frontendpreview/components/ProblemDescription";
import AIAssistant, { type AIAssistantHandle } from "../components/AIAssistant";
import "./FrontendSessionLayout.css";

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

export interface SessionLayoutHandle {
  captureSnapshot: () => {
    code: string;
    hintsUsed: number;
    aiMessages: Array<{ role: string; content: string; timestamp: number }>;
    problemTitle: string;
    problemDescription: string;
    language: string;
  };
}

const FrontendSessionLayout = forwardRef<SessionLayoutHandle, Props>(function FrontendSessionLayout(
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
  /* ── Problem data ─────────────────────────────────── */
  const [problem, setProblem] = useState<FrontendProblem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingProblem, setLoadingProblem] = useState(true);

  /* ── Snapshot refs ────────────────────────────────── */
  const aiRef = useRef<AIAssistantHandle>(null);
  const [hintsUsed, setHintsUsed] = useState(0);

  useImperativeHandle(ref, () => ({
    captureSnapshot: () => ({
      // Serialise all file contents as a JSON string for the AI to analyse
      code: JSON.stringify(fileContents, null, 2),
      hintsUsed,
      aiMessages: aiRef.current?.getMessages() ?? [],
      problemTitle: problem?.title ?? "",
      problemDescription: problem?.description ?? "",
      language: "javascript/html/css",
    }),
  }));

  useEffect(() => {
    setLoadingProblem(true);
    setLoadError(null);
    loadFrontendProblem(problemId)
      .then(setProblem)
      .catch((e) => setLoadError(String(e)))
      .finally(() => setLoadingProblem(false));
  }, [problemId]);

  /* ── File management ──────────────────────────────── */
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

  const activeFileObj: StarterFile | undefined = useMemo(
    () => problem?.starter_files.find((f) => f.path === activeFilePath),
    [problem, activeFilePath],
  );

  /* ── Collaborative editor ─────────────────────────── */
  // Use a separate Yjs room for each file within the problem.
  // Pass empty string when no file is active yet — the hook will skip connecting.
  const roomName = activeFilePath
    ? `session:${sessionId}:q:${orderIndex}:file:${activeFilePath}`
    : "";
  const initialCode = fileContents[activeFilePath] ?? "";

  const { connected, bindEditor } = useCollaborativeEditor({
    roomName,
    initialCode,
    readOnly: locked || (activeFileObj?.readonly ?? false),
    userName,
    userColor,
  });

  const monacoConfigured = useRef(false);
  const handleBeforeMount = useCallback((monaco: Monaco) => {
    if (monacoConfigured.current) return;
    monacoConfigured.current = true;
    const ts = monaco.languages.typescript;
    ts.typescriptDefaults.setCompilerOptions({
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      jsx: ts.JsxEmit.ReactJSX,
      jsxImportSource: "react",
      allowJs: true,
      allowNonTsExtensions: true,
      esModuleInterop: true,
      strict: false,
      noEmit: true,
      skipLibCheck: true,
    });
    ts.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    ts.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    // Shim React types so import statements don't show red squiggles
    ts.typescriptDefaults.addExtraLib(
      `declare module 'react' { export = React; export as namespace React; }
       declare namespace React {
         type ReactNode = any;
         type FC<P = {}> = (props: P & { children?: ReactNode }) => ReactNode;
         type CSSProperties = Record<string, any>;
         function useState<T>(init: T): [T, (v: T | ((p: T) => T)) => void];
         function useEffect(fn: () => void | (() => void), deps?: any[]): void;
         function useCallback<T extends Function>(fn: T, deps: any[]): T;
         function useRef<T>(init: T): { current: T };
         function useMemo<T>(fn: () => T, deps: any[]): T;
         function useContext<T>(ctx: any): T;
         function useReducer<S, A>(r: (s: S, a: A) => S, init: S): [S, (a: A) => void];
         function memo<T>(c: T): T;
         const Fragment: any;
       }
       declare module 'react-dom' { const d: any; export = d; }
       declare module 'react-dom/client' { const d: any; export = d; }`,
      "file:///node_modules/@types/react/index.d.ts",
    );
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

  // Sync Yjs text back to fileContents for live preview
  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      if (!activeFilePath) return;
      setFileContents((prev) => ({ ...prev, [activeFilePath]: value ?? "" }));
    },
    [activeFilePath],
  );

  /* ── Resizable panels ─────────────────────────────── */
  const [rightColWidth, setRightColWidth] = useState(384);
  const [previewRatio, setPreviewRatio] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const rightColRef = useRef<HTMLElement>(null);
  const dragging = useRef<"col" | "row" | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, startW: 0 });

  const onResizeStart = useCallback(
    (axis: "col" | "row") => (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = axis;
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY, startW: rightColWidth };
      document.body.style.cursor = axis === "col" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [rightColWidth],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const { x, startW } = dragStartRef.current;
      if (dragging.current === "col") {
        const delta = x - e.clientX;
        const newW = Math.min(Math.max(startW + delta, 240), window.innerWidth * 0.6);
        setRightColWidth(newW);
      } else {
        const colEl = rightColRef.current;
        if (!colEl) return;
        const colRect = colEl.getBoundingClientRect();
        const offsetY = e.clientY - colRect.top;
        const newRatio = Math.min(Math.max(offsetY / colRect.height, 0.15), 0.85);
        setPreviewRatio(newRatio);
      }
    };

    const onUp = () => {
      if (dragging.current) {
        dragging.current = null;
        setIsDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  /* ── Loading / error ──────────────────────────────── */
  if (loadingProblem || Object.keys(fileContents).length === 0) {
    return (
      <div className="fsl-loading">
        <Loader2 className="fsl-loading-spinner" />
        <p>Loading problem…</p>
      </div>
    );
  }

  if (loadError || !problem) {
    return (
      <div className="fsl-error">
        <p>{loadError ?? "Problem not found."}</p>
      </div>
    );
  }

  /* Map content-file language values to Monaco's registered language IDs.
   * Monaco knows "typescript" and "javascript" but NOT "tsx" or "jsx".
   * Passing an unrecognised ID → plain-text tokeniser → grey text. */
  const rawLanguage = activeFileObj?.language ?? "tsx";
  const monacoLanguageMap: Record<string, string> = {
    tsx: "typescript",
    ts: "typescript",
    jsx: "javascript",
    js: "javascript",
  };
  const fileLanguage = monacoLanguageMap[rawLanguage] ?? rawLanguage;

  return (
    <div className={`fsl-body ${isDragging ? "fsl-body--resizing" : ""}`}>
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
          language={fileLanguage}
          locked={locked}
          problemKey={`${orderIndex}:${problemId}`}
        />
      )}

      {/* ── File tree ── */}
      <FileTree
        files={problem.starter_files}
        activeFile={activeFilePath}
        onSelect={setActiveFilePath}
        collapsed={treeCollapsed}
        onToggleCollapse={() => setTreeCollapsed((v) => !v)}
      />

      {/* ── Centre: code editor ── */}
      <section className="fsl-editor-col">
        <div className="fsl-editor-toolbar">
          <div className="fsl-editor-toolbar-left">
            {treeCollapsed && (
              <button
                type="button"
                className="fsl-tree-toggle"
                onClick={() => setTreeCollapsed(false)}
                title="Expand file tree"
              >
                <ChevronRight className="fsl-tree-toggle-icon" />
              </button>
            )}
            <span className="fsl-active-file">{activeFilePath}</span>
          </div>
          <span className={`fsl-collab-status ${connected ? "fsl-collab-status--connected" : ""}`}>
            {connected ? (
              <>
                <Wifi className="fsl-collab-icon" /> Connected
              </>
            ) : (
              <>
                <WifiOff className="fsl-collab-icon" /> Connecting…
              </>
            )}
          </span>
        </div>

        <Editor
          key={activeFilePath}
          height="100%"
          language={fileLanguage}
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
            tabSize: 2,
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

      {/* ── Vertical resize handle ── */}
      <div className="fsl-resize-col" onMouseDown={onResizeStart("col")} />

      {/* ── Right: preview + description/AI ── */}
      <section
        className="fsl-right-col"
        ref={rightColRef}
        style={{ width: rightColWidth, minWidth: 240 }}
      >
        <div className="fsl-preview-pane" style={{ height: `${previewRatio * 100}%` }}>
          <LivePreview files={fileContents} backTo="" />
        </div>

        <div className="fsl-resize-row" onMouseDown={onResizeStart("row")} />

        <div className="fsl-desc-pane" style={{ height: `${(1 - previewRatio) * 100}%` }}>
          <div className="fsl-desc-content">
            <ProblemDescription problem={problem} onHintReveal={setHintsUsed} />
          </div>
        </div>
      </section>

    </div>
  );
});

export default FrontendSessionLayout;
