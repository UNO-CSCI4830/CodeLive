import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, Play, RotateCcw, Loader2 } from "lucide-react";
import { loadLeetcodeProblem } from "./loadProblem";
import type { LeetcodeProblem, TestResult } from "./types";
import LeetcodeProblemDescription from "./components/LeetcodeProblemDescription";
import LeetcodeCodeEditor from "./components/LeetcodeCodeEditor";
import TestCasesPanel from "./components/TestCasesPanel";
import "./styles/LeetcodePreviewPage.css";

export default function LeetcodePreviewPage() {
  const { problemId } = useParams<{ problemId: string }>();

  /* ── Problem data ─────────────────────────────────── */
  const [problem, setProblem] = useState<LeetcodeProblem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!problemId) return;
    setLoading(true);
    setError(null);

    loadLeetcodeProblem(problemId)
      .then(setProblem)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [problemId]);

  /* ── Code state ───────────────────────────────────── */
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!problem) return;
    setCode(problem.starterCodePython || problem.starterCode || "");
  }, [problem]);

  const handleReset = useCallback(() => {
    if (!problem) return;
    setCode(problem.starterCodePython || problem.starterCode || "");
    setResults(null);
  }, [problem]);

  /* ── Run state ────────────────────────────────────── */
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [stdout, setStdout] = useState("");

  const handleRun = useCallback(async () => {
    if (!problem || isRunning) return;
    setIsRunning(true);
    setResults(null);
    setStdout("");

    try {
      const res = await fetch("/api/run/python", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          testCases: problem.testCases,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Run failed (${res.status})`);
      }

      const data = await res.json();
      setResults(data.results ?? []);
      setStdout(data.stdout ?? "");
    } catch (e) {
      // If the runner is unavailable, show all tests as errored
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
  }, [code, problem, isRunning]);

  /* ── Resizable panels ─────────────────────────────── */
  const [leftWidth, setLeftWidth] = useState(0.4); // 40% for description
  const [editorRatio, setEditorRatio] = useState(0.6); // 60% for editor, 40% for tests
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef<"col" | "row" | null>(null);
  const dragStart = useRef({ x: 0, y: 0, startVal: 0 });
  const rightColRef = useRef<HTMLElement>(null);

  const onResizeStart = useCallback(
    (axis: "col" | "row") => (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = axis;
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        startVal: axis === "col" ? leftWidth : editorRatio,
      };
      document.body.style.cursor = axis === "col" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [leftWidth, editorRatio],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;

      if (dragging.current === "col") {
        const newRatio = e.clientX / window.innerWidth;
        setLeftWidth(Math.min(Math.max(newRatio, 0.2), 0.6));
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

  /* ── Loading / error states ──────────────────────── */
  if (loading) {
    return (
      <div className="lp-loading">
        <Loader2 className="lp-loading-spinner" />
        <p>Loading problem…</p>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="lp-error">
        <p>{error ?? "Problem not found."}</p>
        <Link to="/questions/leetcode" className="lp-back-link">
          <ChevronLeft className="lp-back-icon" /> Back to LeetCode problems
        </Link>
      </div>
    );
  }

  /* ── Main layout ─────────────────────────────────── */
  return (
    <div className={`lp-shell${isDragging ? " lp-shell--resizing" : ""}`}>
      {/* ── Header bar ── */}
      <header className="lp-header">
        <Link to="/questions/leetcode" className="lp-header-back">
          <ChevronLeft className="lp-header-back-icon" />
          <span className="lp-header-back-text">Problems</span>
        </Link>

        <div className="lp-header-actions">
          <button
            type="button"
            className="lp-reset-btn"
            onClick={handleReset}
            title="Reset to starter code"
          >
            <RotateCcw className="lp-btn-icon" />
            Reset
          </button>

          <button
            type="button"
            className="lp-run-btn"
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 className="lp-btn-icon lp-btn-icon--spin" />
            ) : (
              <Play className="lp-btn-icon" />
            )}
            {isRunning ? "Running…" : "Run"}
          </button>
        </div>
      </header>

      {/* ── Body: description (left) | editor + tests (right) ── */}
      <div className="lp-body">
        {/* Left: problem description */}
        <section
          className="lp-desc-col"
          style={{ width: `${leftWidth * 100}%` }}
        >
          <LeetcodeProblemDescription problem={problem} />
        </section>

        {/* Vertical resize handle */}
        <div className="lp-resize-col" onMouseDown={onResizeStart("col")} />

        {/* Right: editor + test cases */}
        <section
          className="lp-editor-col"
          ref={rightColRef}
          style={{ width: `${(1 - leftWidth) * 100}%` }}
        >
          <div className="lp-editor-pane" style={{ height: `${editorRatio * 100}%` }}>
            <LeetcodeCodeEditor value={code} onChange={setCode} />
          </div>

          {/* Horizontal resize handle */}
          <div className="lp-resize-row" onMouseDown={onResizeStart("row")} />

          <div
            className="lp-tests-pane"
            style={{ height: `${(1 - editorRatio) * 100}%` }}
          >
            <TestCasesPanel
              testCases={problem.testCases}
              results={results}
              isRunning={isRunning}
            />
            {stdout && (
              <div className="lp-stdout">
                <span className="lp-stdout-label">stdout</span>
                <pre className="lp-stdout-content">{stdout}</pre>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
