/**
 * DashboardPage — dark-mode hub with upcoming interviews,
 * recent reports (left), and a calendar widget (right).
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2,
  FileText,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Send,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { getCached, setCache } from "@/lib/queryCache";
import "./styles/DashboardPage.css";

interface DashboardCache {
  upcoming: UpcomingSession[];
  reports: ReportRow[];
}

/* ═══════════════════════════════════════════════════════
 *  Types
 * ═══════════════════════════════════════════════════════ */

interface UpcomingSession {
  id: string;
  join_code: string;
  status: "waiting" | "active";
  candidate_id: string | null;
  created_at: string;
  problems: { category: string }[];
  _candidateName?: string | null;
}

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
    candidate_name?: string | null;
  } | null;
  _candidateName?: string | null;
}

/* ═══════════════════════════════════════════════════════
 *  Calendar helpers (same as old CalendarPage)
 * ═══════════════════════════════════════════════════════ */

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface CalendarEvent {
  id: string; title: string; date: Date; time: string; type: "interview" | "review" | "meeting";
}

/* ═══════════════════════════════════════════════════════
 *  Report-row helpers
 * ═══════════════════════════════════════════════════════ */

const STATUS_LABELS: Record<ReportRow["status"], string> = { pending: "Pending", generating: "Generating", completed: "Ready", failed: "Failed" };
const STATUS_CLS: Record<ReportRow["status"], string> = { pending: "dash-rpt-pill--grey", generating: "dash-rpt-pill--blue", completed: "dash-rpt-pill--green", failed: "dash-rpt-pill--red" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/* ═══════════════════════════════════════════════════════
 *  Main Component
 * ═══════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isInterviewer = profile?.role === "interviewer";

  /* ── state (hydrated from cache for instant revisit) ── */
  const cached = getCached<DashboardCache>("dashboard");
  const [upcoming, setUpcoming] = useState<UpcomingSession[]>(cached?.upcoming ?? []);
  const [reports, setReports] = useState<ReportRow[]>(cached?.reports ?? []);
  const [calendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(!cached);

  /* calendar */
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [showInviteModal, setShowInviteModal] = useState(false);

  /* ── Fetch data ── */
  useEffect(() => {
    if (!user) return;

    async function load() {
      if (!getCached("dashboard")) setLoading(true);

      /* 1 — Upcoming sessions (waiting / active) */
      const upcomingPromise = supabase
        .from("sessions")
        .select("id, join_code, status, candidate_id, created_at, problems:session_problems(category)")
        .or("status.eq.waiting,status.eq.active")
        .eq("interviewer_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(6);

      /* 2 — Recent reports (top 5) */
      const reportsPromise = isInterviewer
        ? supabase
            .from("interview_reports")
            .select(
              `id, session_id, status, overall_summary, ai_use_score, generated_at, created_at,
               session:sessions!inner(join_code, candidate_id, candidate_name, interviewer_id)`,
            )
            .eq("session.interviewer_id", user!.id)
            .order("created_at", { ascending: false })
            .limit(5)
        : null;

      const [upRes, rptRes] = await Promise.all([
        upcomingPromise,
        reportsPromise ?? Promise.resolve({ data: null, error: null }),
      ]);

      const upRows = (upRes.data ?? []) as unknown as UpcomingSession[];
      const rptRows = (rptRes.data ?? []) as unknown as ReportRow[];

      /* Batch-fetch candidate names */
      const allCandidateIds = [
        ...new Set([
          ...upRows.map((s) => s.candidate_id).filter(Boolean),
          ...rptRows.map((r) => (r.session as any)?.candidate_id).filter(Boolean),
        ] as string[]),
      ];

      let nameMap = new Map<string, string>();
      if (allCandidateIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles").select("id, name").in("id", allCandidateIds);
        nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.name]));
      }

      for (const s of upRows) {
        const profileName = s.candidate_id ? nameMap.get(s.candidate_id) ?? null : null;
        s._candidateName = profileName ?? (s.candidate_id ? `Candidate ${s.candidate_id.slice(0, 6)}` : null);
      }
      for (const r of rptRows) {
        const session = r.session as any;
        const cid = session?.candidate_id as string | null;
        const profileName = cid ? nameMap.get(cid) ?? null : null;
        const sessionName =
          typeof session?.candidate_name === "string" && session.candidate_name.trim() !== ""
            ? session.candidate_name.trim()
            : null;
        r._candidateName = profileName ?? sessionName ?? (cid ? `Candidate ${cid.slice(0, 6)}` : "Candidate");
      }

      setCache("dashboard", { upcoming: upRows, reports: rptRows });
      setUpcoming(upRows);
      setReports(rptRows);
      setLoading(false);
    }

    load();
  }, [user, isInterviewer]);

  /* ── calendar nav ── */
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDate(today); };

  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfMonth(viewYear, viewMonth);
  const cells: (number | null)[] = Array.from({ length: startDay }, () => null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const eventsForDate = calendarEvents.filter(e => isSameDay(e.date, selectedDate));
  const hasEvents = (day: number) => calendarEvents.some(e => isSameDay(e.date, new Date(viewYear, viewMonth, day)));

  /* ═══════════════════════════════════════════════════════
   *  Render
   * ═══════════════════════════════════════════════════════ */
  return (
    <div className="dash-page">
      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Dashboard</h1>
          <p className="dash-welcome">
            Welcome{profile?.name ? `, ${profile.name}` : ""}! You are signed in as <strong>{profile?.role}</strong>.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="dash-center"><Loader2 className="dash-spinner" /><p>Loading…</p></div>
      ) : (
        <>
          {/* ── Main grid: Left column + Calendar (right) ── */}
          <div className="dash-main">
            {/* Left column: upcoming + reports */}
            <div className="dash-left">
              {/* Upcoming Interviews */}
              <section className="dash-upcoming">
                <p className="dash-section-label">Upcoming Interviews</p>
                <div className="dash-upcoming-grid">
                  {upcoming.length === 0 ? (
                    <p className="dash-upcoming-empty">No waiting or active sessions.</p>
                  ) : (
                    upcoming.map(s => (
                      <Link
                        key={s.id}
                        to={s.status === "waiting" ? `/session/${s.id}/lobby` : `/session/${s.id}`}
                        className="dash-upcoming-card"
                      >
                        <span className={`dash-upcoming-status dash-upcoming-status--${s.status}`}>
                          <span className="status-dot" />
                          {s.status === "waiting" ? "Waiting" : "Active"}
                        </span>
                        <span className="dash-upcoming-code">{s.join_code}</span>
                        {s._candidateName && (
                          <span className="dash-upcoming-candidate">{s._candidateName}</span>
                        )}
                        <span className="dash-upcoming-meta">
                          {s.problems.length} question{s.problems.length !== 1 ? "s" : ""} · {formatDate(s.created_at)}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </section>

              {/* Reports */}
              {isInterviewer && (
                <div className="dash-reports-card">
                <div className="dash-card-header">
                  <h2 className="dash-card-title">
                    <FileText className="dash-card-title-icon" /> Recent Reports
                  </h2>
                  <Link to="/reports" className="dash-view-all">View all →</Link>
                </div>

                {reports.length === 0 ? (
                  <div className="dash-reports-empty">
                    <FileText className="dash-reports-empty-icon" />
                    <p>No reports yet. They appear after you end a session.</p>
                  </div>
                ) : (
                    <table className="dash-report-table">
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>Status</th>
                          <th>Score</th>
                          <th>Date</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                      {reports.map(r => (
                        <tr key={r.id} onClick={() => navigate(`/session/${r.session_id}/report`)}>
                          <td>
                            <div className="dash-rpt-candidate">
                              <div className="dash-rpt-avatar">
                                {r._candidateName ? r._candidateName.charAt(0).toUpperCase() : "?"}
                              </div>
                              {r._candidateName ? (
                                <span className="dash-rpt-name">{r._candidateName}</span>
                              ) : (
                                <span className="dash-rpt-unknown">Unknown</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={`dash-rpt-pill ${STATUS_CLS[r.status]}`}>
                              <span className="dash-rpt-pill-dot" />
                              {STATUS_LABELS[r.status]}
                            </span>
                          </td>
                          <td>
                            {r.ai_use_score != null ? (
                              <span className={`dash-rpt-score dash-rpt-score--${r.ai_use_score >= 7 ? "green" : r.ai_use_score >= 4 ? "amber" : "red"}`}>
                                {r.ai_use_score}/10
                              </span>
                            ) : (
                              <span className="dash-rpt-score dash-rpt-score--na">—</span>
                            )}
                          </td>
                          <td>
                            <span className="dash-rpt-date">{formatDate(r.generated_at ?? r.created_at)}</span>
                          </td>
                          <td>
                            <ChevronRight className="dash-rpt-chevron" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                </div>
              )}
            </div>

            {/* Calendar */}
            <div className="dash-cal-card">
              <div className="dash-card-header">
                <h2 className="dash-card-title">
                  <Calendar className="dash-card-title-icon" /> Calendar
                </h2>
                {isInterviewer && (
                  <button type="button" className="dash-view-all" onClick={() => setShowInviteModal(true)}>
                    <Send style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
                    Send Invite
                  </button>
                )}
              </div>

              <div className="dash-cal-body">
                {/* Month nav */}
                <div className="dash-cal-nav">
                  <button type="button" className="dash-cal-nav-btn" onClick={prevMonth}>
                    <ChevronLeft className="dash-cal-nav-icon" />
                  </button>
                  <span className="dash-cal-month">{MONTH_NAMES[viewMonth]} {viewYear}</span>
                  <button type="button" className="dash-cal-nav-btn" onClick={nextMonth}>
                    <ChevronRight className="dash-cal-nav-icon" />
                  </button>
                  <button type="button" className="dash-cal-today-btn" onClick={goToday}>Today</button>
                </div>

                {/* Day headers */}
                <div className="dash-cal-day-headers">
                  {DAY_LABELS.map(d => <span key={d} className="dash-cal-day-header">{d}</span>)}
                </div>

                {/* Day cells */}
                <div className="dash-cal-days">
                  {cells.map((day, i) => {
                    if (day === null) return <span key={`e-${i}`} className="dash-cal-cell dash-cal-cell--empty" />;
                    const cellDate = new Date(viewYear, viewMonth, day);
                    const isToday = isSameDay(cellDate, today);
                    const isSelected = isSameDay(cellDate, selectedDate);
                    return (
                      <button
                        key={day}
                        type="button"
                        className={["dash-cal-cell", isToday && "dash-cal-cell--today", isSelected && "dash-cal-cell--selected"].filter(Boolean).join(" ")}
                        onClick={() => setSelectedDate(cellDate)}
                      >
                        {day}
                        {hasEvents(day) && <span className="dash-cal-dot" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Events for selected date */}
              <div className="dash-cal-events">
                <h3 className="dash-cal-events-heading">
                  {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h3>
                {eventsForDate.length === 0 ? (
                  <p className="dash-cal-events-empty">No events scheduled.</p>
                ) : (
                  <ul className="dash-cal-events-list">
                    {eventsForDate.map(evt => (
                      <li key={evt.id} className={`dash-cal-event dash-cal-event--${evt.type}`}>
                        <span className="dash-cal-event-dot" />
                        <div className="dash-cal-event-info">
                          <span className="dash-cal-event-title">{evt.title}</span>
                          <span className="dash-cal-event-time">{evt.time}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Invite modal ── */}
      {showInviteModal && <InviteModal onClose={() => setShowInviteModal(false)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
 *  Invite Modal (interviewer-only, dark)
 * ═══════════════════════════════════════════════════════ */

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: integrate with backend
    setSent(true);
    setTimeout(onClose, 1500);
  };

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={e => e.stopPropagation()}>
        <h2 className="dash-modal-title">Send Calendar Invite</h2>
        {sent ? (
          <p className="dash-modal-success">✓ Invite sent successfully!</p>
        ) : (
          <form className="dash-modal-form" onSubmit={handleSend}>
            <label className="dash-modal-label">
              Candidate Email
              <input type="email" className="dash-modal-input" placeholder="candidate@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </label>
            <label className="dash-modal-label">
              Interview Title
              <input type="text" className="dash-modal-input" placeholder="Frontend Interview – React" value={title} onChange={e => setTitle(e.target.value)} required />
            </label>
            <div className="dash-modal-row">
              <label className="dash-modal-label dash-modal-label--half">
                Date
                <input type="date" className="dash-modal-input" value={date} onChange={e => setDate(e.target.value)} required />
              </label>
              <label className="dash-modal-label dash-modal-label--half">
                Time
                <input type="time" className="dash-modal-input" value={time} onChange={e => setTime(e.target.value)} required />
              </label>
            </div>
            <div className="dash-modal-actions">
              <button type="button" className="dash-modal-cancel" onClick={onClose}>Cancel</button>
              <button type="submit" className="dash-modal-send">
                <Send className="dash-modal-send-icon" />
                Send Invite
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
