/**
 * InterviewReportPage — auto-generated AI analysis of a completed session.
 *
 * Accessible only by the interviewer at `/session/:sessionId/report`.
 *
 * Behaviour:
 * - Polls the backend every 2 s while status is "pending" or "generating"
 * - Shows a loading spinner during generation
 * - Renders the full structured report once "completed"
 * - Shows an error state with a retry button on "failed"
 */

import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Loader2,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Minus,
  Bot,
  Lightbulb,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { useSession, SessionProvider } from "../SessionContext";
import { fetchReport } from "../api";
import type { InterviewReport, PerQuestionAnalysis } from "../types";
import "./InterviewReportPage.css";

// ── Inner component (consumes SessionProvider) ────────────────────────────

function ReportContent() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, isInterviewer } = useSession();
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch the candidate's display name when session loads
  useEffect(() => {
    if (!session?.candidate_id) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", session.candidate_id)
      .single()
      .then(({ data }) => setCandidateName(data?.name ?? null));
  }, [session?.candidate_id]);

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const poll = async () => {
    if (!sessionId) return;
    try {
      const data = await fetchReport(sessionId);
      setReport(data);
      setPollError(null);
      if (data.status === "completed" || data.status === "failed") {
        stopPolling();
      }
    } catch (err) {
      setPollError(err instanceof Error ? err.message : "Failed to load report");
    }
  };

  useEffect(() => {
    poll();
    // Start polling — stops automatically when status reaches a terminal state
    intervalRef.current = setInterval(poll, 2000);
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Not interviewer guard ────────────────────────────────────────────
  if (session && !isInterviewer) {
    return (
      <div className="irp-center">
        <XCircle className="irp-error-icon" />
        <h2>Access denied</h2>
        <p>The interview report is only visible to the interviewer.</p>
        <Link to="/dashboard" className="irp-btn irp-btn--primary">
          Back to Dashboard
        </Link>
      </div>
    );
  }
  // ── Poll error ──────────────────────────────────────────────────────
  if (pollError && !report) {
    return (
      <div className="irp-center">
        <AlertCircle className="irp-error-icon" />
        <h2>Couldn't load report</h2>
        <p className="irp-error-msg">{pollError}</p>
        <button type="button" className="irp-btn irp-btn--primary" onClick={poll}>
          Retry
        </button>
      </div>
    );
  }

  // ── Loading / generating ─────────────────────────────────────────────
  if (!report || report.status === "pending" || report.status === "generating") {
    return (
      <div className="irp-center">
        <Loader2 className="irp-spinner" />
        <h2 className="irp-generating-heading">Generating AI Analysis…</h2>
        <p className="irp-generating-sub">
          This usually takes 10–30 seconds. You can leave this tab and come back.
        </p>
      </div>
    );
  }

  // ── Failed ──────────────────────────────────────────────────────────
  if (report.status === "failed") {
    return (
      <div className="irp-center">
        <XCircle className="irp-error-icon" />
        <h2>Analysis failed</h2>
        <p className="irp-error-msg">
          {report.error_message ?? "The AI analysis could not be completed."}
        </p>
        <p className="irp-error-sub">
          Code snapshots were saved. You can access them via Supabase if needed.
        </p>
        <Link to="/dashboard" className="irp-btn irp-btn--primary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // ── Completed ────────────────────────────────────────────────────────
  return (
    <div className="irp-page">
      <div className="irp-page-header">
        <div className="irp-header-inner">
          <Link to="/reports" className="irp-back-link">
            <ChevronLeft className="irp-back-icon" />
            Reports
          </Link>
          <div className="irp-candidate-avatar">
            {candidateName ? candidateName.charAt(0).toUpperCase() : "?"}
          </div>
          <div className="irp-page-title-block">
            <h1 className="irp-page-title">
              {candidateName ? `${candidateName} — Interview Report` : "Interview Report"}
            </h1>
            {session && (
              <div className="irp-session-meta">
                <span>{session.problems.length} question{session.problems.length !== 1 ? "s" : ""}</span>
                <span className="irp-meta-dot" />
                <span>Session {session.id.slice(0, 8)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="irp-body">
        {/* ── Top row: Summary + AI side-by-side ── */}
        <div className="irp-top-row">
          {/* ── Summary card ── */}
          <section className="irp-card irp-card--summary">
            <h2 className="irp-card-title">
              <TrendingUp className="irp-card-title-icon" /> Overall Summary
            </h2>
            <p className="irp-summary-text">{report.overall_summary}</p>

            {(report.strengths?.length ?? 0) > 0 || (report.areas_for_improvement?.length ?? 0) > 0 ? (
              <div className="irp-strengths-grid">
                {(report.strengths?.length ?? 0) > 0 && (
                  <div className="irp-strengths-col">
                    <h3 className="irp-col-heading irp-col-heading--green">Strengths</h3>
                    <ul className="irp-list">
                      {report.strengths!.map((s, i) => (
                        <li key={i} className="irp-list-item irp-list-item--green">
                          <CheckCircle2 className="irp-list-icon" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(report.areas_for_improvement?.length ?? 0) > 0 && (
                  <div className="irp-strengths-col">
                    <h3 className="irp-col-heading irp-col-heading--amber">Areas for Improvement</h3>
                    <ul className="irp-list">
                      {report.areas_for_improvement!.map((s, i) => (
                        <li key={i} className="irp-list-item irp-list-item--amber">
                          <AlertCircle className="irp-list-icon" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            {report.problem_solving_progression && (
              <div className="irp-progression">
                <h3 className="irp-progression-label">Problem-Solving Progression</h3>
                <p className="irp-progression-text">{report.problem_solving_progression}</p>
              </div>
            )}
          </section>

          {/* ── AI use section ── */}
          <section className="irp-card irp-card--ai">
            <h2 className="irp-card-title">
              <Bot className="irp-card-title-icon irp-card-title-icon--ai" /> AI Assistant Usage
            </h2>

            {report.ai_use_score != null ? (
              <div className="irp-ai-score-row">
                <span className="irp-ai-score-label">AI Use Score</span>
                <AIScorePill score={report.ai_use_score} />
                <span className="irp-ai-score-hint">(10 = excellent independent thinking)</span>
              </div>
            ) : (
              <p className="irp-ai-na">Score unavailable (AI analysis not configured).</p>
            )}

            {report.ai_use_notes && (
              <p className="irp-ai-notes">{report.ai_use_notes}</p>
            )}
          </section>
        </div>

        {/* ── Per-question analysis grid ── */}
        {(report.per_question ?? []).length > 0 && (
          <>
            <p className="irp-section-label">Per-Question Analysis</p>
            <div className="irp-questions-grid">
              {(report.per_question ?? []).map((q) => (
                <QuestionCard key={q.orderIndex} analysis={q} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function QuestionCard({ analysis }: { analysis: PerQuestionAnalysis }) {
  const correctnessClass: Record<PerQuestionAnalysis["correctness"], string> = {
    correct: "irp-card--correct",
    partial: "irp-card--partial",
    incorrect: "irp-card--incorrect",
    not_attempted: "",
  };
  return (
    <section className={`irp-card irp-card--question ${correctnessClass[analysis.correctness] ?? ""}`}>
      <div className="irp-q-header">
        <span className="irp-q-num">Q{analysis.orderIndex + 1}</span>
        <h2 className="irp-q-title">{analysis.title}</h2>
        <CorrectnessBadge value={analysis.correctness} />
      </div>

      <p className="irp-q-analysis">{analysis.codeAnalysis}</p>
      <p className="irp-q-approach">
        <strong>Approach: </strong>
        {analysis.approachQuality}
      </p>

      {(analysis.strengths.length > 0 || analysis.improvements.length > 0) && (
        <div className="irp-q-lists">
          {analysis.strengths.length > 0 && (
            <div>
              <h4 className="irp-q-list-heading irp-q-list-heading--green">
                <Lightbulb className="irp-q-list-icon" /> What went well
              </h4>
              <ul className="irp-list">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="irp-list-item irp-list-item--green">
                    <CheckCircle2 className="irp-list-icon" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analysis.improvements.length > 0 && (
            <div>
              <h4 className="irp-q-list-heading irp-q-list-heading--amber">
                <AlertCircle className="irp-q-list-icon" /> To improve
              </h4>
              <ul className="irp-list">
                {analysis.improvements.map((s, i) => (
                  <li key={i} className="irp-list-item irp-list-item--amber">
                    <Minus className="irp-list-icon" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const CORRECTNESS_CONFIG = {
  correct: { label: "Correct", className: "irp-badge--green" },
  partial: { label: "Partial", className: "irp-badge--amber" },
  incorrect: { label: "Incorrect", className: "irp-badge--red" },
  not_attempted: { label: "Not Attempted", className: "irp-badge--grey" },
};

function CorrectnessBadge({ value }: { value: PerQuestionAnalysis["correctness"] }) {
  const cfg = CORRECTNESS_CONFIG[value] ?? CORRECTNESS_CONFIG.not_attempted;
  return <span className={`irp-badge ${cfg.className}`}>{cfg.label}</span>;
}

function AIScorePill({ score }: { score: number }) {
  const pct = Math.min(Math.max(score / 10, 0), 1);
  const pillCls = pct >= 0.7 ? "irp-score-pill--green" : pct >= 0.4 ? "irp-score-pill--amber" : "irp-score-pill--red";
  const fillCls = pct >= 0.7 ? "irp-score-fill--green" : pct >= 0.4 ? "irp-score-fill--amber" : "irp-score-fill--red";
  return (
    <div className="irp-score-display">
      <div className={`irp-score-pill ${pillCls}`}>
        <span className="irp-score-value">{score}</span>
        <span className="irp-score-max">/10</span>
      </div>
      <div className="irp-score-track">
        <div className={`irp-score-fill ${fillCls}`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

// ── Page wrapper (provides SessionContext) ────────────────────────────────

export default function InterviewReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();

  if (!sessionId || !user) {
    return (
      <div className="irp-center">
        <p>Invalid session.</p>
        <Link to="/dashboard" className="irp-btn irp-btn--primary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <SessionProvider sessionId={sessionId} userId={user.id}>
      <ReportContent />
    </SessionProvider>
  );
}
