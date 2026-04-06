/**
 * InterviewSessionPage — the main interview room.
 *
 * Wraps everything in SessionProvider for real-time state. Renders:
 * - A header bar with timer, question navigation, and session controls
 * - The correct layout based on the current problem type
 * - Session completed screen when done
 *
 * On session end (interviewer only):
 *  1. Captures code snapshots for all questions
 *  2. Saves them to the backend
 *  3. Triggers async AI report generation
 *  4. Navigates to the report loading page
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link, Navigate } from "react-router-dom";
import { Loader2, LogOut, Trophy, ChevronLeft } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { SessionProvider, useSession } from "../SessionContext";
import SessionTimer from "../components/SessionTimer";
import QuestionNav from "../components/QuestionNav";
import LeetcodeSessionLayout, {
  type SessionLayoutHandle,
} from "../layouts/LeetcodeSessionLayout";
import FrontendSessionLayout from "../layouts/FrontendSessionLayout";
import BackendSessionLayout from "../layouts/BackendSessionLayout";
import DatabaseSessionLayout from "../layouts/DatabaseSessionLayout";
import { saveSnapshots, generateReport, type SnapshotPayload } from "../api";
import "./InterviewSessionPage.css";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Inner component that consumes SessionContext. */
function InterviewRoom() {
  const {
    session,
    loading,
    error,
    currentProblem,
    isInterviewer,
    advance,
    setCurrentIndex,
    pauseSharedTimer,
    resumeSharedTimer,
    end,
  } = useSession();

  const { profile } = useAuth();
  const navigate = useNavigate();

  const userName = profile?.name ?? (isInterviewer ? "Interviewer" : "Candidate");
  const userColor = isInterviewer ? "#f97316" : "#3b82f6"; // orange / blue

  // Ref to the active layout (all problem layouts share the same handle shape)
  const layoutRef = useRef<SessionLayoutHandle>(null);

  // Track latest snapshot per question so navigation can move freely.
  const snapshotsRef = useRef<Map<number, SnapshotPayload>>(new Map());

  // End-session confirmation modal
  const [showEndModal, setShowEndModal] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const skipReportRef = useRef(false);
  const endingRef = useRef(false);

  /** Capture the current layout snapshot and push to the accumulator. */
  const captureCurrentSnapshot = useCallback(() => {
    if (!currentProblem || !layoutRef.current) return;
    const snap = layoutRef.current.captureSnapshot();
    snapshotsRef.current.set(currentProblem.order_index, {
      orderIndex: currentProblem.order_index,
      problemId: currentProblem.problem_id,
      category: currentProblem.category,
      code: snap.code,
      language: snap.language,
      hintsUsed: snap.hintsUsed,
      aiMessages: snap.aiMessages,
    });
  }, [currentProblem]);

  /**
   * Shared end-session flow (called by both the "End" button and the
   * "Next" button on the last question).
   *  1. Capture final snapshot
   *  2. End the session in Supabase
   *  3. Save snapshots + trigger AI report (fire & forget — errors are logged)
   *  4. Navigate to the report loading page
   */
  const doEndWithReport = useCallback(async () => {
    if (!session || endingRef.current) return;
    endingRef.current = true;
    setEndingSession(true);
    setEndError(null);
    captureCurrentSnapshot();
    try {
      await end();

      const sessionId = session.id;
      const snapshots = [...snapshotsRef.current.values()].sort(
        (a, b) => a.orderIndex - b.orderIndex,
      );

      // Build problem metadata for the report request
      const problems = snapshots.map((s) => {
        const sessionProblem = session.problems.find(
          (p) => p.order_index === s.orderIndex,
        );
        return {
          orderIndex: s.orderIndex,
          problemId: s.problemId,
          category: s.category,
          title: s.problemId.replace(/-/g, " "),
          description: "",
          timeLimit: sessionProblem?.time_limit ?? 30,
        };
      });

      // Best effort snapshots, but always attempt report generation.
      try {
        await saveSnapshots(sessionId, snapshots);
      } catch (err) {
        console.error("[report] snapshots save failed:", err);
      }

      // Await report trigger so /report has a pending row immediately.
      // Retry a few times to smooth transient network hiccups on remote setups.
      let generated = false;
      let lastError: unknown = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          await generateReport(sessionId, { problems });
          generated = true;
          break;
        } catch (err) {
          lastError = err;
          if (attempt < 3) {
            await sleep(300 * attempt);
          }
        }
      }
      if (!generated) throw lastError ?? new Error("Failed to trigger report generation");

      navigate(`/session/${sessionId}/report`, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to finalize session";
      setEndError(msg);
      setEndingSession(false);
      endingRef.current = false;
    }
  }, [session, captureCurrentSnapshot, end, navigate]);

  const handleAdvance = useCallback(async () => {
    if (!session || endingSession) return;
    const isLast = session.current_index >= session.problems.length - 1;
    if (isLast) {
      await doEndWithReport();
    } else {
      // Capture before advancing so we preserve this question's state
      captureCurrentSnapshot();
      await advance();
    }
  }, [session, endingSession, advance, doEndWithReport, captureCurrentSnapshot]);

  const handleEndSession = useCallback(() => {
    if (endingSession) return;
    setEndError(null);
    setShowEndModal(true);
  }, [endingSession]);

  const handleSelectQuestion = useCallback(
    async (nextIndex: number) => {
      if (!session || endingSession || nextIndex === session.current_index) return;
      captureCurrentSnapshot();
      await setCurrentIndex(nextIndex);
    },
    [session, endingSession, captureCurrentSnapshot, setCurrentIndex],
  );

  /** Modal: generate report */
  const handleModalReport = useCallback(async () => {
    setShowEndModal(false);
    await doEndWithReport();
  }, [doEndWithReport]);

  /** Modal: just go home (end session but skip report) */
  const handleModalHome = useCallback(async () => {
    if (!session || endingRef.current) return;
    endingRef.current = true;
    skipReportRef.current = true;
    setEndingSession(true);
    setEndError(null);
    setShowEndModal(false);
    try {
      await end();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to end session";
      setEndError(msg);
      setEndingSession(false);
      endingRef.current = false;
    }
  }, [session, end, navigate]);

  const canAdvance = useMemo(() => {
    if (!currentProblem) return false;
    return isInterviewer;
  }, [currentProblem, isInterviewer]);

  const locked = false;

  /* ── Loading ──────────────────────────────────────── */
  if (loading) {
    return (
      <div className="isp-loading">
        <Loader2 className="isp-loading-spinner" />
        <p>Joining interview session…</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="isp-error">
        <p>{error ?? "Session not found."}</p>
        <Link to="/dashboard" className="isp-back">
          <ChevronLeft className="isp-back-icon" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  /* ── Session completed ────────────────────────────── */
  if (session.status === "completed") {
    if (endingSession) {
      return (
        <div className="isp-loading">
          <Loader2 className="isp-loading-spinner" />
          <p>Finalizing session…</p>
        </div>
      );
    }

    // If the interviewer chose to skip the report, go to dashboard
    if (skipReportRef.current) {
      return <Navigate to="/dashboard" replace />;
    }
    // Otherwise redirect to the report page
    if (isInterviewer) {
      return <Navigate to={`/session/${session.id}/report`} replace />;
    }
    return (
      <div className="isp-completed">
        <div className="isp-completed-card">
          <Trophy className="isp-completed-icon" />
          <h1 className="isp-completed-heading">Session Complete</h1>
          <p className="isp-completed-text">
            All {session.problems.length} problem{session.problems.length !== 1 && "s"}{" "}
            {session.problems.length !== 1 ? "have" : "has"} been completed.
          </p>
          <Link to="/dashboard" className="isp-completed-btn">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!currentProblem) {
    return (
      <div className="isp-error">
        <p>No current problem found.</p>
      </div>
    );
  }

  /* ── Active session ───────────────────────────────── */
  return (
    <div className="isp-shell">
      {endError && (
        <div className="isp-end-error-banner" role="alert">
          {endError}
        </div>
      )}

      {/* ── Header bar ── */}
      <header className="isp-header">
        <div className="isp-header-left">
          <QuestionNav
            problems={session.problems}
            currentIndex={session.current_index}
            onSelect={handleSelectQuestion}
            onAdvance={handleAdvance}
            canAdvance={canAdvance}
            disabled={session.status !== "active" || endingSession}
            showAdvance={isInterviewer}
          />
        </div>

        <div className="isp-header-center">
          <SessionTimer
            totalMinutes={
              session.total_time_limit_minutes > 0
                ? session.total_time_limit_minutes
                : session.problems.reduce((sum, p) => sum + (p.time_limit ?? 0), 0)
            }
            startedAt={session.started_at}
            paused={session.timer_paused}
            pausedAt={session.timer_paused_at}
            pausedSeconds={session.timer_paused_seconds}
            canToggle={isInterviewer}
              onPause={pauseSharedTimer}
              onResume={resumeSharedTimer}
            />
        </div>

        <div className="isp-header-right">
          <div className="isp-participants">
            <span className="isp-participant isp-participant--interviewer" title="Interviewer">
              I
            </span>
            {session.candidate_id && (
              <span className="isp-participant isp-participant--candidate" title="Candidate">
                C
              </span>
            )}
          </div>

          {isInterviewer && (
            <button
              type="button"
              className="isp-end-btn"
              onClick={handleEndSession}
              disabled={endingSession}
              title="End session"
            >
              <LogOut className="isp-end-icon" />
              End
            </button>
          )}
        </div>
      </header>

      {/* ── Problem layout ── */}
      <div className="isp-content">
        {currentProblem.category === "leetcode" ? (
          <LeetcodeSessionLayout
            ref={layoutRef}
            sessionId={session.id}
            problemId={currentProblem.problem_id}
            orderIndex={currentProblem.order_index}
            locked={locked}
            userName={userName}
            userColor={userColor}
            aiEnabled={session.ai_enabled !== false}
            canSendAi={!isInterviewer}
          />
        ) : currentProblem.category === "backend" ? (
          <BackendSessionLayout
            ref={layoutRef}
            sessionId={session.id}
            problemId={currentProblem.problem_id}
            orderIndex={currentProblem.order_index}
            locked={locked}
            userName={userName}
            userColor={userColor}
            aiEnabled={session.ai_enabled !== false}
            canSendAi={!isInterviewer}
          />
        ) : currentProblem.category === "database" ? (
          <DatabaseSessionLayout
            ref={layoutRef}
            sessionId={session.id}
            problemId={currentProblem.problem_id}
            orderIndex={currentProblem.order_index}
            locked={locked}
            userName={userName}
            userColor={userColor}
            aiEnabled={session.ai_enabled !== false}
            canSendAi={!isInterviewer}
          />
        ) : (
          <FrontendSessionLayout
            ref={layoutRef}
            sessionId={session.id}
            problemId={currentProblem.problem_id}
            orderIndex={currentProblem.order_index}
            locked={locked}
            userName={userName}
            userColor={userColor}
            aiEnabled={session.ai_enabled !== false}
            canSendAi={!isInterviewer}
          />
        )}
      </div>

      {/* ── End-session modal ── */}
      {showEndModal && (
        <div className="isp-modal-overlay">
          <div className="isp-modal">
            <h2 className="isp-modal-title">End Interview</h2>
            <p className="isp-modal-body">
              Would you like to generate an AI interview report, or just return to the dashboard?
            </p>
            <div className="isp-modal-actions">
              <button
                type="button"
                className="isp-modal-btn isp-modal-btn--ghost"
                onClick={() => setShowEndModal(false)}
                disabled={endingSession}
              >
                Cancel
              </button>
              <button
                type="button"
                className="isp-modal-btn isp-modal-btn--secondary"
                onClick={handleModalHome}
                disabled={endingSession}
              >
                Return to Dashboard
              </button>
              <button
                type="button"
                className="isp-modal-btn isp-modal-btn--primary"
                onClick={handleModalReport}
                disabled={endingSession}
              >
                {endingSession ? "Generating…" : "Generate Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Outer wrapper that provides SessionContext. */
export default function InterviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();

  if (!sessionId || !user) {
    return (
      <div className="isp-error">
        <p>Invalid session.</p>
        <Link to="/dashboard" className="isp-back">
          <ChevronLeft className="isp-back-icon" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <SessionProvider sessionId={sessionId} userId={user.id}>
      <InterviewRoom />
    </SessionProvider>
  );
}
