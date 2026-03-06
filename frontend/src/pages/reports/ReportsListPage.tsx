/**
 * ReportsListPage — data-table of all completed interview reports.
 * Accessible via the sidebar at /reports (interviewer only).
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, FileText, ChevronRight, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { getCached, setCache } from "@/lib/queryCache";
import "./ReportsListPage.css";

interface ReportRow {
  id: string;
  session_id: string;
  status: "pending" | "generating" | "completed" | "failed";
  overall_summary: string | null;
  ai_use_score: number | null;
  generated_at: string | null;
  created_at: string;
  session: {
    join_code: string;
    candidate_id: string | null;
    problems: { category: string }[];
  } | null;
  /** Populated client-side from profiles */
  _candidateName?: string | null;
}

export default function ReportsListPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const cached = getCached<ReportRow[]>("reports-list");
  const [reports, setReports] = useState<ReportRow[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function load() {
      if (!getCached("reports-list")) setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from("interview_reports")
        .select(
          `id, session_id, status, overall_summary, ai_use_score, generated_at, created_at,
           session:sessions!inner(join_code, candidate_id, interviewer_id, problems:session_problems(category))`,
        )
        .eq("session.interviewer_id", user!.id)
        .order("created_at", { ascending: false });

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as ReportRow[];

      // Fetch candidate names in one query
      const candidateIds = [
        ...new Set(
          rows
            .map((r) => (r.session as any)?.candidate_id)
            .filter(Boolean) as string[],
        ),
      ];

      if (candidateIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", candidateIds);

        const nameMap = new Map(
          (profiles ?? []).map((p: any) => [p.id, p.name]),
        );

        for (const r of rows) {
          const cid = (r.session as any)?.candidate_id;
          r._candidateName = cid ? (nameMap.get(cid) ?? null) : null;
        }
      }

      setCache("reports-list", rows);
      setReports(rows);
      setLoading(false);
    }

    load();
  }, [user]);

  // Non-interviewer guard
  if (profile && profile.role !== "interviewer") {
    return (
      <div className="rpl-page">
        <div className="rpl-center">
          <AlertCircle className="rpl-center-icon" />
          <p>Reports are only available to interviewers.</p>
          <Link to="/dashboard" className="rpl-btn">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rpl-page">
      <div className="rpl-header">
        <h1 className="rpl-title">Interview Reports</h1>
        <p className="rpl-sub">AI-generated analysis from completed sessions.</p>
      </div>

      {loading && (
        <div className="rpl-center">
          <Loader2 className="rpl-spinner" />
          <p>Loading reports…</p>
        </div>
      )}

      {error && (
        <div className="rpl-center">
          <AlertCircle className="rpl-center-icon rpl-center-icon--error" />
          <p className="rpl-error-text">{error}</p>
        </div>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="rpl-empty">
          <FileText className="rpl-empty-icon" />
          <p className="rpl-empty-heading">No reports yet</p>
          <p className="rpl-empty-sub">
            Reports are generated automatically when you end a session.
          </p>
          <Link to="/session/create" className="rpl-btn">
            Start a session
          </Link>
        </div>
      )}

      {!loading && !error && reports.length > 0 && (
        <div className="rpl-table-wrap">
          <table className="rpl-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Session</th>
                <th>Status</th>
                <th>AI Score</th>
                <th>Summary</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/session/${r.session_id}/report`)}
                >
                  <td>
                    <div className="rpl-candidate-cell">
                      <div className="rpl-avatar">
                        {r._candidateName
                          ? r._candidateName.charAt(0).toUpperCase()
                          : "?"}
                      </div>
                      {r._candidateName ? (
                        <span className="rpl-candidate-name">{r._candidateName}</span>
                      ) : (
                        <span className="rpl-candidate-unknown">Unknown</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="rpl-code">
                      {r.session?.join_code ?? r.session_id.slice(0, 8)}
                    </span>
                  </td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td>
                    <ScoreCell score={r.ai_use_score} />
                  </td>
                  <td>
                    {r.overall_summary ? (
                      <span className="rpl-summary-cell">
                        {truncate(r.overall_summary, 100)}
                      </span>
                    ) : (
                      <span className="rpl-summary-cell rpl-summary-cell--muted">
                        {r.status === "generating" || r.status === "pending"
                          ? "In progress…"
                          : "—"}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="rpl-date">
                      {formatDate(r.generated_at ?? r.created_at)}
                    </span>
                  </td>
                  <td>
                    <ChevronRight className="rpl-chevron" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ReportRow["status"], string> = {
  pending: "Pending",
  generating: "Generating",
  completed: "Ready",
  failed: "Failed",
};

const STATUS_CLASSES: Record<ReportRow["status"], string> = {
  pending: "rpl-pill--grey",
  generating: "rpl-pill--blue",
  completed: "rpl-pill--green",
  failed: "rpl-pill--red",
};

function StatusPill({ status }: { status: ReportRow["status"] }) {
  return (
    <span className={`rpl-pill ${STATUS_CLASSES[status]}`}>
      <span className="rpl-pill-dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}

function ScoreCell({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="rpl-score-num rpl-score-num--na">—</span>;
  }
  const pct = Math.min(Math.max(score / 10, 0), 1);
  const cls =
    pct >= 0.7 ? "green" : pct >= 0.4 ? "amber" : "red";
  return (
    <div className="rpl-score-cell">
      <span className={`rpl-score-num rpl-score-num--${cls}`}>
        {score}/10
      </span>
      <div className="rpl-score-track">
        <div
          className={`rpl-score-fill rpl-score-fill--${cls}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max).trimEnd() + "…";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
