import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { loadFrontendProblem } from "./loadProblem";
import type { FrontendProblem, StarterFile } from "./types";
import FileTree from "./components/FileTree";
import CodeEditor from "./components/CodeEditor";
import LivePreview from "./components/LivePreview";
import ProblemDescription from "./components/ProblemDescription";
import "./styles/FrontendPreviewPage.css";

export default function FrontendPreviewPage() {
  const { problemId } = useParams<{ problemId: string }>();

  /* ── Problem data ─────────────────────────────────── */
  const [problem, setProblem] = useState<FrontendProblem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!problemId) return;
    setLoading(true);
    setError(null);

    loadFrontendProblem(problemId)
      .then(setProblem)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [problemId]);

  /* ── Working copies of all files ──────────────────── */
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [activeFilePath, setActiveFilePath] = useState("");
  const [treeCollapsed, setTreeCollapsed] = useState(false);

  // Initialise file contents when problem loads.
  useEffect(() => {
    if (!problem) return;
    const initial: Record<string, string> = {};
    for (const f of problem.starter_files) {
      initial[f.path] = f.content;
    }
    setFileContents(initial);
    // Default to the first editable file, or just the first file.
    const firstEditable =
      problem.starter_files.find((f) => !f.readonly) ?? problem.starter_files[0];
    setActiveFilePath(firstEditable?.path ?? "");
  }, [problem]);

  /* ── Helpers ──────────────────────────────────────── */
  const activeFileObj: StarterFile | undefined = useMemo(
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

  const handleReset = useCallback(() => {
    if (!problem) return;
    const initial: Record<string, string> = {};
    for (const f of problem.starter_files) {
      initial[f.path] = f.content;
    }
    setFileContents(initial);
  }, [problem]);

  /* ── Resizable panels ─────────────────────────────── */
  const [rightColWidth, setRightColWidth] = useState(384); // 24rem default
  const [previewRatio, setPreviewRatio] = useState(0.45);
  const [isDragging, setIsDragging] = useState(false);
  const rightColRef = useRef<HTMLElement>(null);
  const dragging = useRef<"col" | "row" | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, startW: 0, startR: 0 });

  const onResizeStart = useCallback(
    (axis: "col" | "row") => (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = axis;
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        startW: rightColWidth,
        startR: previewRatio,
      };
      document.body.style.cursor = axis === "col" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [rightColWidth, previewRatio],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const { x, startW } = dragStartRef.current;

      if (dragging.current === "col") {
        // Dragging left edge of right column: moving left = wider
        const delta = x - e.clientX;
        const newW = Math.min(Math.max(startW + delta, 240), window.innerWidth * 0.6);
        setRightColWidth(newW);
      } else {
        // Dragging row divider inside right column
        const colEl = rightColRef.current;
        if (!colEl) return;
        const colRect = colEl.getBoundingClientRect();
        const colH = colRect.height;
        const offsetY = e.clientY - colRect.top;
        const newRatio = Math.min(Math.max(offsetY / colH, 0.15), 0.85);
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

  /* ── Loading / error states ──────────────────────── */
  if (loading) {
    return (
      <div className="fp-loading">
        <p>Loading problem…</p>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="fp-error">
        <p>{error ?? "Problem not found."}</p>
        <Link to="/questions/frontend" className="fp-back-link">
          <ChevronLeft className="fp-back-icon" /> Back to Frontend problems
        </Link>
      </div>
    );
  }

  /* ── Main layout ─────────────────────────────────── */
  return (
    <div className={`fp-shell${isDragging ? " fp-shell--resizing" : ""}`}>
      {/* ── Left: file tree ── */}
      <FileTree
        files={problem.starter_files}
        activeFile={activeFilePath}
        onSelect={setActiveFilePath}
        collapsed={treeCollapsed}
        onToggleCollapse={() => setTreeCollapsed((v) => !v)}
      />

      {/* ── Centre: code editor ── */}
      <section className="fp-editor-col">
        <div className="fp-editor-toolbar">
          {treeCollapsed && (
            <button
              type="button"
              className="fp-tree-toggle"
              onClick={() => setTreeCollapsed(false)}
              aria-label="Expand file tree"
              title="Expand file tree"
            >
              <ChevronRight className="fp-tree-toggle-icon" />
            </button>
          )}

          <span className="fp-active-file">{activeFilePath}</span>

          <button
            type="button"
            className="fp-reset-btn"
            onClick={handleReset}
            title="Reset all files to starter code"
          >
            <RotateCcw className="fp-reset-icon" />
            Reset
          </button>
        </div>

        <CodeEditor
          value={fileContents[activeFilePath] ?? ""}
          language={activeFileObj?.language ?? "tsx"}
          readOnly={activeFileObj?.readonly ?? false}
          onChange={handleCodeChange}
        />
      </section>

      {/* ── Vertical resize handle ── */}
      <div
        className="fp-resize-col"
        onMouseDown={onResizeStart("col")}
      />

      {/* ── Right: preview + description ── */}
      <section
        className="fp-right-col"
        ref={rightColRef}
        style={{ width: rightColWidth, minWidth: 240 }}
      >
        <div className="fp-preview-pane" style={{ height: `${previewRatio * 100}%` }}>
          <LivePreview files={fileContents} backTo="/questions/frontend" />
        </div>

        {/* ── Horizontal resize handle ── */}
        <div
          className="fp-resize-row"
          onMouseDown={onResizeStart("row")}
        />

        <div className="fp-desc-pane" style={{ height: `${(1 - previewRatio) * 100}%` }}>
          <ProblemDescription problem={problem} />
        </div>
      </section>
    </div>
  );
}
