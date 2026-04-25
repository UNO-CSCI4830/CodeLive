import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Trash2,
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
import { apiFetch } from "@/lib/apiClient";
import { useCatalogueCategories } from "@/pages/question-catalogue/data/useCatalogueCategories";
import DifficultyBadge from "@/pages/question-catalogue/components/DifficultyBadge";
import { createSession, joinSession } from "../api";
import type { SelectedProblem } from "../types";
import "./CreateSessionPage.css";

interface InterviewGroup {
  id: string;
  job_role: string;
  job_number: string | null;
  created_at: string;
}

export default function CreateSessionPage() {
  const { user, profile } = useAuth();
  const { categories } = useCatalogueCategories();
  const navigate = useNavigate();
  const isInterviewer = profile?.role === "interviewer";

  useEffect(() => {
    document.title = isInterviewer ? "Create Session – CodeLive" : "Join Session – CodeLive";
    return () => { document.title = "CodeLive"; };
  }, [isInterviewer]);

  const availableCategories = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.slug === "frontend"
          || c.slug === "leetcode"
          || c.slug === "backend"
          || c.slug === "database",
      ),
    [categories],
  );

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
  const [aiEnabled, setAiEnabled] = useState(true);
  const [totalInterviewMinutes, setTotalInterviewMinutes] = useState(60);
  const [groups, setGroups] = useState<InterviewGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupRole, setNewGroupRole] = useState("");
  const [newGroupNumber, setNewGroupNumber] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Search & category browsing ─────────────────── */
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  useEffect(() => {
    if (availableCategories.length === 0) {
      setExpandedTypes(new Set());
      return;
    }
    setExpandedTypes(new Set([availableCategories[0].slug]));
  }, [availableCategories]);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.problemId)), [selected]);
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const formatGroupLabel = useCallback(
    (group: Pick<InterviewGroup, "job_role" | "job_number">) =>
      `${group.job_role}${group.job_number ? ` (#${group.job_number})` : ""}`,
    [],
  );

  useEffect(() => {
    if (!isInterviewer || !user) return;
    let cancelled = false;

    async function loadGroups() {
      try {
        const res = await apiFetch("/api/groups");
        if (!res.ok) return;
        const rows = (await res.json()) as InterviewGroup[];
        if (cancelled) return;

        setGroups(rows);
        setSelectedGroupId((prev) => {
          if (prev && rows.some((g) => g.id === prev)) return prev;
          return rows[0]?.id ?? null;
        });
      } catch {
        // Swallow — groups are optional
      }
    }

    loadGroups();
    return () => {
      cancelled = true;
    };
  }, [isInterviewer, user]);

  const addProblem = useCallback(
    (
      problemId: string,
      title: string,
      category: "frontend" | "leetcode" | "backend" | "database",
      difficulty: "easy" | "medium" | "hard",
    ) => {
      if (selectedIds.has(problemId)) return;
      setSelected((prev) => [
        ...prev,
        { problemId, title, category, difficulty },
      ]);
    },
    [selectedIds],
  );

  const removeProblem = useCallback((problemId: string) => {
    setSelected((prev) => prev.filter((p) => p.problemId !== problemId));
  }, []);

  /* ── Create session handler ─────────────────────── */
  const handleCreate = useCallback(async () => {
    const interviewerId = user?.id;
    if (!interviewerId || selected.length === 0) return;
    setCreating(true);
    setError(null);

    try {
      const sanitizedTotalMinutes = Math.min(
        480,
        Math.max(15, Math.floor(Number(totalInterviewMinutes) || 60)),
      );
      const result = await createSession({
        interviewerId,
        aiEnabled,
        totalInterviewMinutes: sanitizedTotalMinutes,
        groupId: selectedGroupId,
        problems: selected.map((s) => ({
          problemId: s.problemId,
          category: s.category,
          // Keep per-problem metadata deterministic for reports/snapshots.
          timeLimit: 30,
        })),
      });

      // Navigate to the lobby with immediate join code (avoids a blank wait
      // while the first session fetch is still in-flight on slower networks).
      navigate(`/session/${result.sessionId}/lobby`, {
        state: { joinCode: result.joinCode },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  }, [user, selected, aiEnabled, totalInterviewMinutes, selectedGroupId, navigate]);

  const handleCreateGroup = useCallback(async () => {
    if (!user?.id) return;
    const trimmedRole = newGroupRole.trim();
    const trimmedNumber = newGroupNumber.trim();
    if (!trimmedRole) {
      setGroupError("Job role is required.");
      return;
    }

    setAddingGroup(true);
    setGroupError(null);
    try {
      const res = await apiFetch("/api/groups", {
        method: "POST",
        body: JSON.stringify({
          jobRole: trimmedRole,
          jobNumber: trimmedNumber || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setGroupError(err.error ?? "Failed to create group.");
        return;
      }

      const created = (await res.json()) as InterviewGroup;
      setGroups((prev) => [created, ...prev]);
      setSelectedGroupId(created.id);
      setShowAddGroupModal(false);
      setGroupMenuOpen(false);
      setNewGroupRole("");
      setNewGroupNumber("");
    } catch (e) {
      setGroupError(e instanceof Error ? e.message : "Failed to create group.");
    } finally {
      setAddingGroup(false);
    }
  }, [newGroupRole, newGroupNumber, user]);

  /* ── Filtered problems for search ───────────────── */
  const query = searchQuery.toLowerCase().trim();

  const toggleType = (slug: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

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
              {availableCategories.map((cat) => {
                const subGroups = cat.subCategories
                  .map((sub) => ({
                    ...sub,
                    filteredProblems: query
                      ? sub.problems.filter(
                          (p) =>
                            p.title.toLowerCase().includes(query) ||
                            p.id.toLowerCase().includes(query),
                        )
                      : sub.problems,
                  }))
                  .filter((sub) => !query || sub.filteredProblems.length > 0);

                if (query && subGroups.length === 0) return null;

                const categoryMatches = subGroups.reduce(
                  (total, sub) => total + sub.filteredProblems.length,
                  0,
                );
                const isTypeExpanded = expandedTypes.has(cat.slug) || Boolean(query);

                return (
                  <div key={cat.slug} className="cs-category">
                    <button
                      type="button"
                      className="cs-category-toggle"
                      onClick={() => toggleType(cat.slug)}
                      aria-expanded={isTypeExpanded}
                    >
                      {isTypeExpanded ? (
                        <ChevronDown className="cs-category-chevron" />
                      ) : (
                        <ChevronRight className="cs-category-chevron" />
                      )}
                      <span className="cs-category-title">{cat.label}</span>
                      <span className="cs-category-count">
                        {query ? categoryMatches : cat.problemCount}
                      </span>
                    </button>

                    {isTypeExpanded && (
                      <div className="cs-category-body">
                        {subGroups.map((sub) => {
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
                                <span className="cs-sub-count">{sub.filteredProblems.length}</span>
                              </button>

                              {(isExpanded || query) && (
                                <ul className="cs-problem-list">
                                  {sub.filteredProblems.map((p) => (
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
                                            cat.slug as "frontend" | "leetcode" | "backend" | "database",
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
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right: Selected problems queue ── */}
          <div className="cs-queue">
            <h2 className="cs-queue-title">
              Session Queue
              <span className="cs-queue-count">{selected.length}</span>
            </h2>
            <div className="cs-ai-toggle-row">
              <div className="cs-ai-toggle-copy">
                <span className="cs-ai-toggle-title">AI Assistant</span>
                <span className="cs-ai-toggle-desc">
                  Enable shared AI hints for this interview session.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiEnabled}
                className={`cs-ai-toggle ${aiEnabled ? "cs-ai-toggle--on" : ""}`}
                onClick={() => setAiEnabled((v) => !v)}
              >
                <span className="cs-ai-toggle-knob" />
              </button>
            </div>
            <div className="cs-duration-row">
              <div className="cs-duration-copy">
                <span className="cs-duration-title">Total Interview Length</span>
                <span className="cs-duration-desc">
                  Shared timer for the entire session.
                </span>
              </div>
              <div className="cs-duration-input-wrap">
                <input
                  type="number"
                  className="cs-duration-input"
                  value={totalInterviewMinutes}
                  min={15}
                  max={480}
                  onChange={(e) =>
                    setTotalInterviewMinutes(
                      Math.min(480, Math.max(15, parseInt(e.target.value, 10) || 60)),
                    )
                  }
                />
                <span className="cs-duration-label">min</span>
              </div>
            </div>
            <div className="cs-group-row">
              <div className="cs-group-copy">
                <span className="cs-group-title">Group</span>
                <span className="cs-group-desc">
                  Organize this interview by role/job opening.
                </span>
              </div>
              <div className="cs-group-select-wrap">
                <button
                  type="button"
                  className="cs-group-select-btn"
                  onClick={() => setGroupMenuOpen((open) => !open)}
                >
                  <span className="cs-group-select-label">
                    {selectedGroup ? formatGroupLabel(selectedGroup) : "No group selected"}
                  </span>
                  <ChevronDown className={`cs-group-select-chevron ${groupMenuOpen ? "is-open" : ""}`} />
                </button>
                {groupMenuOpen && (
                  <div className="cs-group-menu">
                    <div className="cs-group-options">
                      {groups.length === 0 ? (
                        <p className="cs-group-empty">No groups yet.</p>
                      ) : (
                        groups.map((group) => (
                          <button
                            key={group.id}
                            type="button"
                            className={`cs-group-option ${group.id === selectedGroupId ? "is-selected" : ""}`}
                            onClick={() => {
                              setSelectedGroupId(group.id);
                              setGroupMenuOpen(false);
                            }}
                          >
                            {formatGroupLabel(group)}
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      className="cs-group-add-btn"
                      onClick={() => {
                        setShowAddGroupModal(true);
                        setGroupMenuOpen(false);
                        setGroupError(null);
                      }}
                    >
                      + Add Group
                    </button>
                  </div>
                )}
              </div>
            </div>

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
        {showAddGroupModal && (
          <div className="cs-modal-overlay">
            <div className="cs-modal">
              <h3 className="cs-modal-title">Add Group</h3>
              <p className="cs-modal-subtitle">
                Create a group for a job role (and optional job number).
              </p>
              <label className="cs-modal-label" htmlFor="group-role-input">
                Job role
              </label>
              <input
                id="group-role-input"
                type="text"
                className="cs-modal-input"
                placeholder="Senior Backend Engineer"
                value={newGroupRole}
                onChange={(e) => setNewGroupRole(e.target.value)}
              />
              <label className="cs-modal-label" htmlFor="group-number-input">
                Job number (optional)
              </label>
              <input
                id="group-number-input"
                type="text"
                className="cs-modal-input"
                placeholder="REQ-1421"
                value={newGroupNumber}
                onChange={(e) => setNewGroupNumber(e.target.value)}
              />
              {groupError && <p className="cs-modal-error">{groupError}</p>}
              <div className="cs-modal-actions">
                <button
                  type="button"
                  className="cs-modal-btn cs-modal-btn--ghost"
                  onClick={() => setShowAddGroupModal(false)}
                  disabled={addingGroup}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="cs-modal-btn cs-modal-btn--primary"
                  onClick={handleCreateGroup}
                  disabled={addingGroup}
                >
                  {addingGroup ? "Adding…" : "Add Group"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
