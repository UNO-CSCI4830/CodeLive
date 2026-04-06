/**
 * ReportsListPage — data-table of all completed interview reports.
 * Accessible via the sidebar at /reports (interviewer only).
 */

import { useEffect, useMemo, useState } from "react";
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
  overall_score: number | null;
  ai_use_score: number | null;
  generated_at: string | null;
  created_at: string;
  session: {
    candidate_id: string | null;
    candidate_name?: string | null;
    candidate_last_name?: string | null;
    group_id?: string | null;
    group?: {
      job_role: string;
      job_number?: string | null;
    } | null;
    problems: { category: string }[];
  } | null;
  _candidateFirstName?: string;
  _candidateLastName?: string;
  _candidateFullName?: string;
  _groupLabel?: string;
  _groupId?: string | null;
}

interface GroupOption {
  id: string;
  label: string;
}

export default function ReportsListPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const cached = getCached<ReportRow[]>("reports-list");
  const [reports, setReports] = useState<ReportRow[]>(cached ?? []);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
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
          `id, session_id, status, overall_summary, overall_score, ai_use_score, generated_at, created_at,
           session:sessions!inner(candidate_id, candidate_name, candidate_last_name, group_id, interviewer_id, problems:session_problems(category), group:interviewer_groups(job_role, job_number))`,
        )
        .eq("session.interviewer_id", user!.id)
        .order("created_at", { ascending: false });

      const { data: groupsData } = await supabase
        .from("interviewer_groups")
        .select("id, job_role, job_number")
        .eq("interviewer_id", user!.id)
        .order("created_at", { ascending: false });

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as ReportRow[];

      const candidateIds = [
        ...new Set(
          rows
            .map((r) => (r.session as any)?.candidate_id)
            .filter(Boolean) as string[],
        ),
      ];

      let nameMap = new Map<string, string | null>();
      if (candidateIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", candidateIds);

        nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.name]));
      }

      for (const r of rows) {
        const session = r.session as any;
        const cid = session?.candidate_id as string | null;
        const profileName = cid ? nameMap.get(cid) ?? null : null;
        const sessionFirstName =
          typeof session?.candidate_name === "string" && session.candidate_name.trim() !== ""
            ? session.candidate_name.trim()
            : null;
        const sessionLastName =
          typeof session?.candidate_last_name === "string" && session.candidate_last_name.trim() !== ""
            ? session.candidate_last_name.trim()
            : null;

        const fallbackName = cid ? `Candidate ${cid.slice(0, 6)}` : "Candidate";
        const sourceName = profileName ?? sessionFirstName ?? fallbackName;
        const { firstName, lastName } = splitName(sourceName);

        r._candidateFirstName = firstName;
        r._candidateLastName = sessionLastName ?? lastName ?? "—";
        r._candidateFullName = `${r._candidateFirstName} ${r._candidateLastName}`.trim();

        const group = session?.group;
        r._groupId = session?.group_id ?? null;
        r._groupLabel = group?.job_role
          ? `${group.job_role}${group.job_number ? ` (#${group.job_number})` : ""}`
          : "Ungrouped";
      }

      setCache("reports-list", rows);
      setReports(rows);
      setGroups(
        ((groupsData ?? []) as Array<{ id: string; job_role: string; job_number?: string | null }>).map(
          (group) => ({
            id: group.id,
            label: `${group.job_role}${group.job_number ? ` (#${group.job_number})` : ""}`,
          }),
        ),
      );
      setLoading(false);
    }

    load();
  }, [user]);

  const visibleReports = useMemo(
    () => applyFilters(reports, groupFilter, searchQuery),
    [reports, groupFilter, searchQuery],
  );

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
        <div className="rpl-controls">
          <input
            type="text"
            className="rpl-search-input"
            placeholder="Search candidate name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="rpl-filter-select"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
          >
            <option value="all">All groups</option>
            <option value="ungrouped">Ungrouped</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
        </div>
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

      {!loading && !error && reports.length > 0 && visibleReports.length === 0 && (
        <div className="rpl-empty">
          <FileText className="rpl-empty-icon" />
          <p className="rpl-empty-heading">No matching reports</p>
          <p className="rpl-empty-sub">Try a different candidate name or group filter.</p>
        </div>
      )}

      {!loading && !error && visibleReports.length > 0 && (
        <div className="rpl-table-wrap">
          <table className="rpl-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Last Name</th>
                <th>Group</th>
                <th>Status</th>
                <th>Overall Score</th>
                <th>AI Score</th>
                <th>Summary</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleReports.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/session/${r.session_id}/report`)}
                >
                  <td>
                    <div className="rpl-candidate-cell">
                      <div className="rpl-avatar">
                        {r._candidateFirstName
                          ? r._candidateFirstName.charAt(0).toUpperCase()
                          : "?"}
                      </div>
                      {r._candidateFirstName ? (
                        <span className="rpl-candidate-name">{r._candidateFirstName}</span>
                      ) : (
                        <span className="rpl-candidate-unknown">Unknown</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="rpl-text-cell">{r._candidateLastName ?? "—"}</span>
                  </td>
                  <td>
                    <span className="rpl-text-cell">{r._groupLabel ?? "Ungrouped"}</span>
                  </td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td>
                    <ScoreCell score={r.overall_score} showDecimal />
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

function ScoreCell({ score, showDecimal = false }: { score: number | null; showDecimal?: boolean }) {
  if (score == null) {
    return <span className="rpl-score-num rpl-score-num--na">—</span>;
  }
  const pct = Math.min(Math.max(score / 10, 0), 1);
  const cls = pct >= 0.7 ? "green" : pct >= 0.4 ? "amber" : "red";
  return (
    <div className="rpl-score-cell">
      <span className={`rpl-score-num rpl-score-num--${cls}`}>
        {showDecimal ? Number(score).toFixed(1) : score}/10
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

function splitName(name: string): { firstName: string; lastName: string | null } {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return { firstName: "Candidate", lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function applyFilters(reports: ReportRow[], groupFilter: string, searchQuery: string): ReportRow[] {
  const query = searchQuery.trim().toLowerCase();
  return reports.filter((report) => {
    if (groupFilter === "ungrouped") {
      if (report._groupId) return false;
    } else if (groupFilter !== "all") {
      if (report._groupId !== groupFilter) return false;
    }

    if (!query) return true;
    const candidateText = `${report._candidateFirstName ?? ""} ${report._candidateLastName ?? ""} ${report._candidateFullName ?? ""}`.toLowerCase();
    return candidateText.includes(query);
  });
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
