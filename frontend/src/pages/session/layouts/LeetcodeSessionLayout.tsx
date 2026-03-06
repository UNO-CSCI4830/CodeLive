/**
 * LeetcodeSessionLayout — interview room layout for LeetCode problems.
 *
 * Layout: [Description | CollabEditor / TestCases+AI]
 * Features: collaborative editing via Yjs, run code, test cases, AI assistant tab
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Play, Loader2, Wifi, WifiOff } from "lucide-react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useCollaborativeEditor } from "../hooks/useCollaborativeEditor";
import { loadLeetcodeProblem } from "@/pages/question-catalogue/leetcodepreview/loadProblem";
import type { LeetcodeProblem, TestResult } from "@/pages/question-catalogue/leetcodepreview/types";
import LeetcodeProblemDescription from "@/pages/question-catalogue/leetcodepreview/components/LeetcodeProblemDescription";
import TestCasesPanel from "@/pages/question-catalogue/leetcodepreview/components/TestCasesPanel";
import AIAssistant, { type AIAssistantHandle } from "../components/AIAssistant";
import "./LeetcodeSessionLayout.css";

interface Props {
  sessionId: string;
  problemId: string;
  orderIndex: number;
  locked: boolean;
  userName: string;
  userColor: string;
}

export interface SessionLayoutHandle {
  /** Capture a snapshot of the current code + hints + AI messages. */
  captureSnapshot: () => {
    code: string;
    hintsUsed: number;
    aiMessages: Array<{ role: string; content: string; timestamp: number }>;
    /** Problem metadata included so the parent doesn't need to re-fetch. */
    problemTitle: string;
    problemDescription: string;
    language: string;
  };
}

const LeetcodeSessionLayout = forwardRef<SessionLayoutHandle, Props>(function LeetcodeSessionLayout(
  { sessionId, problemId, orderIndex, locked, userName, userColor },
  ref,
) {
  /* ── Problem data ─────────────────────────────────── */
  const [problem, setProblem] = useState<LeetcodeProblem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingProblem, setLoadingProblem] = useState(true);

  /* ── Snapshot refs ────────────────────────────────── */
  const aiRef = useRef<AIAssistantHandle>(null);
  const [hintsUsed, setHintsUsed] = useState(0);

  useImperativeHandle(ref, () => ({
    captureSnapshot: () => ({
      code: getText(),
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
    loadLeetcodeProblem(problemId)
      .then(setProblem)
      .catch((e) => setLoadError(String(e)))
      .finally(() => setLoadingProblem(false));
  }, [problemId]);

  /* ── Collaborative editor ─────────────────────────── */
  // Gate the room name on problem being loaded for two reasons:
  //  1. initialCode is "" until the problem JSON arrives — if the WS syncs
  //     before that, the starter code is never seeded into the Yjs doc.
  //  2. Avoids the "WS closed before established" Strict Mode warning caused
  //     by destroying a still-connecting provider on the first (thrown-away)
  //     effect run.
  const roomName = problem ? `session:${sessionId}:q:${orderIndex}` : "";
  const initialCode = problem?.starterCodePython || problem?.starterCode || "";

  const { connected, bindEditor, getText } = useCollaborativeEditor({
    roomName,
    initialCode,
    readOnly: locked,
    userName,
    userColor,
  });

  const monacoConfigured = useRef(false);
  const handleBeforeMount = useCallback((monaco: Monaco) => {
    if (monacoConfigured.current) return;
    monacoConfigured.current = true;
    const ts = monaco.languages.typescript;
    // Python has no Monaco language service — but disable JS/TS diagnostics
    // just in case the editor ever switches language.
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
      if (locked) {
        editor.updateOptions({ readOnly: true });
      }
    },
    [bindEditor, locked],
  );

  /* ── Run state ────────────────────────────────────── */
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [stdout, setStdout] = useState("");

  const handleRun = useCallback(async () => {
    if (!problem || isRunning || locked) return;
    setIsRunning(true);
    setResults(null);
    setStdout("");

    const code = getText();

    try {
      const res = await fetch("/api/run/python", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, testCases: problem.testCases }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Run failed (${res.status})`);
      }

      const data = await res.json();
      setResults(data.results ?? []);
      setStdout(data.stdout ?? "");
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setResults(
        problem.testCases.map((tc, i) => ({
          index: i,
          passed: false,
          input: tc.input,
          expected: tc.expected.result,
          actual: null,
          error: errorMsg,
        })),
      );
    } finally {
      setIsRunning(false);
    }
  }, [problem, isRunning, locked, getText]);

  /* ── Resizable panels ─────────────────────────────── */
  const [leftWidth, setLeftWidth] = useState(0.38);
  const [editorRatio, setEditorRatio] = useState(0.55);
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
        const newRatio = e.clientX / window.innerWidth;
        setLeftWidth(Math.min(Math.max(newRatio, 0.2), 0.55));
      } else {
        const colEl = rightColRef.current;
        if (!colEl) return;
        const rect = colEl.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const ratio = offsetY / rect.height;
        setEditorRatio(Math.min(Math.max(ratio, 0.25), 0.85));
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
  if (loadingProblem) {
    return (
      <div className="lsl-loading">
        <Loader2 className="lsl-loading-spinner" />
        <p>Loading problem…</p>
      </div>
    );
  }

  if (loadError || !problem) {
    return (
      <div className="lsl-error">
        <p>{loadError ?? "Problem not found."}</p>
      </div>
    );
  }

  return (
    <div className={`lsl-body ${isDragging ? "lsl-body--resizing" : ""}`}>
      {/* ── Left: description ── */}
      <section className="lsl-desc-col" style={{ width: `${leftWidth * 100}%` }}>
        <LeetcodeProblemDescription problem={problem} onHintReveal={setHintsUsed} />
      </section>

      {/* Vertical resize */}
      <div className="lsl-resize-col" onMouseDown={onResizeStart("col")} />

      {/* ── Right: editor + bottom panel ── */}
      <section
        className="lsl-editor-col"
        ref={rightColRef}
        style={{ width: `${(1 - leftWidth) * 100}%` }}
      >
        {/* Editor toolbar */}
        <div className="lsl-editor-toolbar">
          <div className="lsl-editor-toolbar-left">
            <span className="lsl-lang-badge">Python</span>
            <span className={`lsl-collab-status ${connected ? "lsl-collab-status--connected" : ""}`}>
              {connected ? (
                <>
                  <Wifi className="lsl-collab-icon" /> Connected
                </>
              ) : (
                <>
                  <WifiOff className="lsl-collab-icon" /> Connecting…
                </>
              )}
            </span>
          </div>
          <div className="lsl-editor-toolbar-right">
            <button
              type="button"
              className="lsl-run-btn"
              onClick={handleRun}
              disabled={isRunning || locked}
            >
              {isRunning ? (
                <Loader2 className="lsl-btn-icon lsl-btn-icon--spin" />
              ) : (
                <Play className="lsl-btn-icon" />
              )}
              {isRunning ? "Running…" : "Run"}
            </button>
          </div>
        </div>

        {/* Editor pane */}
        <div className="lsl-editor-pane" style={{ height: `${editorRatio * 100}%` }}>
          <Editor
            height="100%"
            language="python"
            theme="vs-dark"
            beforeMount={handleBeforeMount}
            onMount={handleEditorMount}
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
              readOnly: locked,
              bracketPairColorization: { enabled: true },
            }}
          />
        </div>

        {/* Horizontal resize */}
        <div className="lsl-resize-row" onMouseDown={onResizeStart("row")} />

        {/* Bottom: test cases */}
        <div className="lsl-bottom-pane" style={{ height: `${(1 - editorRatio) * 100}%` }}>
          <div className="lsl-tests-wrapper">
            <TestCasesPanel
              testCases={problem.testCases}
              results={results}
              isRunning={isRunning}
            />
            {stdout && (
              <div className="lsl-stdout">
                <span className="lsl-stdout-label">stdout</span>
                <pre className="lsl-stdout-content">{stdout}</pre>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── AI assistant — sliding drawer on the far right ── */}
      <AIAssistant
        ref={aiRef}
        problemTitle={problem.title}
        problemDescription={problem.description}
        currentCode={getText()}
        language="python"
        locked={locked}
        problemKey={`${orderIndex}:${problemId}`}
      />
    </div>
  );
});

export default LeetcodeSessionLayout;
