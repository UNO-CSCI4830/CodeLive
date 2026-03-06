import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Trash2,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
  ArrowRight,
  LogIn,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { categories } from "@/pages/question-catalogue/data/catalogueData";
import DifficultyBadge from "@/pages/question-catalogue/components/DifficultyBadge";
import { createSession, joinSession } from "../api";
import type { SelectedProblem } from "../types";
import "./CreateSessionPage.css";

const AVAILABLE_CATEGORIES = categories.filter(
  (c) => c.slug === "frontend" || c.slug === "leetcode",
);

export default function CreateSessionPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isInterviewer = profile?.role === "interviewer";

  /* ── Join session state ─────────────────────────── */
  const CODE_LENGTH = 6;
  const [showJoin, setShowJoin] = useState(!isInterviewer); // default open for candidates
  const [joinCode, setJoinCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const joinInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (showJoin) {
      setTimeout(() => joinInputsRef.current[0]?.focus(), 60);
    }
  }, [showJoin]);

  const handleJoinChange = (index: number, value: string) => {
    const char = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(-1);
    setJoinCode((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    setJoinError(null);
    if (char && index < CODE_LENGTH - 1) {
      joinInputsRef.current[index + 1]?.focus();
    }
  };

  const handleJoinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !joinCode[index] && index > 0) {
      joinInputsRef.current[index - 1]?.focus();
    }
  };

  const handleJoinPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, CODE_LENGTH);
    const chars = pasted.split("");
    setJoinCode((prev) => {
      const next = [...prev];
      chars.forEach((c, i) => { next[i] = c; });
      return next;
    });
    const focusIdx = Math.min(chars.length, CODE_LENGTH - 1);
    joinInputsRef.current[focusIdx]?.focus();
  };

  const joinCodeStr = joinCode.join("");
  const isJoinComplete = joinCodeStr.length === CODE_LENGTH;

  const handleJoin = useCallback(async () => {
    if (!user || !isJoinComplete) return;
    setJoining(true);
    setJoinError(null);
    try {
      const result = await joinSession(joinCodeStr, user.id);
      navigate(`/session/${result.sessionId}`);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Failed to join session");
    } finally {
      setJoining(false);
    }
  }, [user, joinCodeStr, isJoinComplete, navigate]);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleJoin();
  };

  /* ── Selected problems ──────────────────────────── */
  const [selected, setSelected] = useState<SelectedProblem[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Search & category browsing ─────────────────── */
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.problemId)), [selected]);

  const addProblem = useCallback(
    (problemId: string, title: string, category: "frontend" | "leetcode", difficulty: "easy" | "medium" | "hard") => {
      if (selectedIds.has(problemId)) return;
      setSelected((prev) => [
        ...prev,
        { problemId, title, category, difficulty, timeLimit: 30 },
      ]);
    },
    [selectedIds],
  );

  const removeProblem = useCallback((problemId: string) => {
    setSelected((prev) => prev.filter((p) => p.problemId !== problemId));
  }, []);

  const updateTimeLimit = useCallback((problemId: string, minutes: number) => {
    setSelected((prev) =>
      prev.map((p) => (p.problemId === problemId ? { ...p, timeLimit: minutes } : p)),
    );
  }, []);

  /* ── Create session handler ─────────────────────── */
  const handleCreate = useCallback(async () => {
    if (!user || selected.length === 0) return;
    setCreating(true);
    setError(null);

    try {
      const result = await createSession({
        interviewerId: user.id,
        problems: selected.map((s) => ({
          problemId: s.problemId,
          category: s.category,
          timeLimit: s.timeLimit,
        })),
      });

      // Navigate to the lobby with the session ID
      navigate(`/session/${result.sessionId}/lobby`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  }, [user, selected, navigate]);

  /* ── Filtered problems for search ───────────────── */
  const query = searchQuery.toLowerCase().trim();

  return (
    <div className="cs-wrapper">
      <div className="cs-container">
        {/* ── Page header with Join button ── */}
        <div className="cs-page-header">
          <div>
            <h1 className="cs-heading">
              {isInterviewer ? "Interview Sessions" : "Join Interview Session"}
            </h1>
            <p className="cs-subheading">
              {isInterviewer
                ? "Create a new session or join an existing one."
                : "Enter the session code provided by your interviewer."}
            </p>
          </div>
          {isInterviewer && (
            <button
              type="button"
              className="cs-join-toggle-btn"
              onClick={() => setShowJoin((v) => !v)}
            >
              <LogIn className="cs-join-toggle-icon" />
              {showJoin ? "Hide Join" : "Join Session"}
            </button>
          )}
        </div>

        {/* ── Join session panel ── */}
        {showJoin && (
          <div className="cs-join-panel">
            <div className="cs-join-panel-header">
              <h2 className="cs-join-panel-title">Join a Session</h2>
              {isInterviewer && (
                <button
                  type="button"
                  className="cs-join-panel-close"
                  onClick={() => setShowJoin(false)}
                >
                  <X className="cs-join-panel-close-icon" />
                </button>
              )}
            </div>
            <p className="cs-join-panel-desc">
              Enter the 6-character code provided by the interviewer.
            </p>
            <form className="cs-join-form" onSubmit={handleJoinSubmit}>
              <div className="cs-join-code-inputs" onPaste={handleJoinPaste}>
                {joinCode.map((char, i) => (
                  <input
                    key={i}
                    ref={(el) => { joinInputsRef.current[i] = el; }}
                    type="text"
                    className={`cs-join-code-input ${joinError ? "cs-join-code-input--error" : ""}`}
                    value={char}
                    onChange={(e) => handleJoinChange(i, e.target.value)}
                    onKeyDown={(e) => handleJoinKeyDown(i, e)}
                    maxLength={1}
                    autoComplete="off"
                    disabled={joining}
                  />
                ))}
              </div>
              {joinError && (
                <div className="cs-join-error">
                  <AlertCircle className="cs-join-error-icon" />
                  <span>{joinError}</span>
                </div>
              )}
              <button
                type="submit"
                className="cs-join-submit-btn"
                disabled={!isJoinComplete || joining}
              >
                {joining ? (
                  <>
                    <Loader2 className="cs-join-submit-icon cs-join-submit-icon--spin" />
                    Joining…
                  </>
                ) : (
                  <>
                    <LogIn className="cs-join-submit-icon" />
                    Join Session
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── Create session (interviewers only) ── */}
        {isInterviewer && (
          <div className="cs-layout">
          {/* ── Left: Problem browser ── */}
          <div className="cs-browser">
            <div className="cs-search-box">
              <Search className="cs-search-icon" />
              <input
                type="text"
                className="cs-search-input"
                placeholder="Search problems…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="cs-categories">
              {AVAILABLE_CATEGORIES.map((cat) => (
                <div key={cat.slug} className="cs-category">
                  <h3 className="cs-category-title">{cat.label}</h3>

                  {cat.subCategories.map((sub) => {
                    const filteredProblems = query
                      ? sub.problems.filter(
                          (p) =>
                            p.title.toLowerCase().includes(query) ||
                            p.id.toLowerCase().includes(query),
                        )
                      : sub.problems;

                    if (query && filteredProblems.length === 0) return null;

                    const isExpanded = expandedSub === `${cat.slug}:${sub.slug}`;

                    return (
                      <div key={sub.slug} className="cs-subcategory">
                        <button
                          type="button"
                          className="cs-sub-toggle"
                          onClick={() =>
                            setExpandedSub(
                              isExpanded ? null : `${cat.slug}:${sub.slug}`,
                            )
                          }
                        >
                          {isExpanded ? (
                            <ChevronDown className="cs-sub-chevron" />
                          ) : (
                            <ChevronRight className="cs-sub-chevron" />
                          )}
                          <span>{sub.label}</span>
                          <span className="cs-sub-count">{filteredProblems.length}</span>
                        </button>

                        {(isExpanded || query) && (
                          <ul className="cs-problem-list">
                            {filteredProblems.map((p) => (
                              <li key={p.id} className="cs-problem-item">
                                <div className="cs-problem-info">
                                  <span className="cs-problem-title">{p.title}</span>
                                  <DifficultyBadge level={p.difficulty} />
                                </div>
                                <button
                                  type="button"
                                  className="cs-add-btn"
                                  disabled={selectedIds.has(p.id)}
                                  onClick={() =>
                                    addProblem(
                                      p.id,
                                      p.title,
                                      cat.slug as "frontend" | "leetcode",
                                      p.difficulty,
                                    )
                                  }
                                >
                                  {selectedIds.has(p.id) ? "Added" : <Plus className="cs-add-icon" />}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Selected problems queue ── */}
          <div className="cs-queue">
            <h2 className="cs-queue-title">
              Session Queue
              <span className="cs-queue-count">{selected.length}</span>
            </h2>

            {selected.length === 0 ? (
              <p className="cs-queue-empty">
                No problems selected yet. Browse and add problems from the left panel.
              </p>
            ) : (
              <ul className="cs-queue-list">
                {selected.map((s, idx) => (
                  <li key={s.problemId} className="cs-queue-item">
                    <span className="cs-queue-index">{idx + 1}</span>
                    <div className="cs-queue-item-info">
                      <span className="cs-queue-item-title">{s.title}</span>
                      <div className="cs-queue-item-meta">
                        <span className="cs-queue-item-category">{s.category}</span>
                        <DifficultyBadge level={s.difficulty} />
                      </div>
                    </div>
                    <div className="cs-queue-item-time">
                      <Clock className="cs-time-icon" />
                      <input
                        type="number"
                        className="cs-time-input"
                        value={s.timeLimit}
                        min={5}
                        max={120}
                        onChange={(e) =>
                          updateTimeLimit(s.problemId, parseInt(e.target.value, 10) || 30)
                        }
                      />
                      <span className="cs-time-label">min</span>
                    </div>
                    <button
                      type="button"
                      className="cs-remove-btn"
                      onClick={() => removeProblem(s.problemId)}
                    >
                      <Trash2 className="cs-remove-icon" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {error && <p className="cs-error">{error}</p>}

            <button
              type="button"
              className="cs-create-btn"
              disabled={selected.length === 0 || creating}
              onClick={handleCreate}
            >
              {creating ? "Creating…" : "Create Session"}
              {!creating && <ArrowRight className="cs-create-arrow" />}
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
