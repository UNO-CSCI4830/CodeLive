import { useEffect } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { Copy, Loader2, Users, ChevronLeft, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { SessionProvider, useSession } from "../SessionContext";
import "./SessionLobbyPage.css";

function LobbyContent() {
  const { session, loading, error, isInterviewer, silentRefresh, end } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const provisionalJoinCode =
    typeof (location.state as { joinCode?: unknown } | null)?.joinCode === "string"
      ? ((location.state as { joinCode?: string }).joinCode ?? "").trim().toUpperCase()
      : "";

  // Page title
  useEffect(() => {
    document.title = "Session Lobby – CodeLive";
    return () => { document.title = "CodeLive"; };
  }, []);

  // When session becomes active (candidate joined), redirect to interview
  useEffect(() => {
    if (session?.status === "active") {
      navigate(`/session/${session.id}`, { replace: true });
    }
  }, [session?.status, session?.id, navigate]);

  // Polling fallback — Supabase Realtime can silently miss events in some
  // environments. Poll every 3 s while the interviewer is in the waiting room
  // so the redirect fires even if the Realtime push never arrives.
  useEffect(() => {
    if (!isInterviewer || session?.status !== "waiting") return;
    const id = setInterval(silentRefresh, 3000);
    return () => clearInterval(id);
  }, [isInterviewer, session?.status, silentRefresh]);

  const copyCode = () => {
    if (session?.join_code) {
      navigator.clipboard.writeText(session.join_code);
    }
  };

  const cancelSession = async () => {
    await end();
    navigate("/dashboard", { replace: true });
  };

  if (loading) {
    if (provisionalJoinCode) {
      return (
        <div className="lobby-wrapper">
          <div className="lobby-card">
            <div className="lobby-icon-circle">
              <Users className="lobby-icon" />
            </div>
            <h1 className="lobby-heading">Session Created</h1>
            <p className="lobby-subtext">
              Share this code with the candidate while we finish loading session details.
            </p>
            <div className="lobby-code-box">
              <span className="lobby-code-label">Session Code</span>
              <div className="lobby-code-display">
                <span className="lobby-code">{provisionalJoinCode}</span>
                <button
                  type="button"
                  className="lobby-copy-btn"
                  onClick={() => navigator.clipboard.writeText(provisionalJoinCode)}
                  title="Copy code"
                >
                  <Copy className="lobby-copy-icon" />
                </button>
              </div>
            </div>
            <div className="lobby-waiting">
              <Loader2 className="lobby-waiting-spinner" />
              <span>Loading session…</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="lobby-loading">
        <Loader2 className="lobby-spinner" />
        <p>Loading session…</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="lobby-error">
        <p>{error ?? "Session not found."}</p>
        <Link to="/dashboard" className="lobby-back">
          <ChevronLeft className="lobby-back-icon" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="lobby-wrapper">
      <div className="lobby-card">
        <div className="lobby-icon-circle">
          <Users className="lobby-icon" />
        </div>

        <h1 className="lobby-heading">
          {isInterviewer ? "Waiting for Candidate" : "Joining Session…"}
        </h1>

        <p className="lobby-subtext">
          {isInterviewer
            ? "Share this code with the candidate to let them join."
            : "Waiting for the interviewer to start the session."}
        </p>

        {/* Join Code Display — only the interviewer needs to see/share this */}
        {isInterviewer && (
          <div className="lobby-code-box">
            <span className="lobby-code-label">Session Code</span>
            <div className="lobby-code-display">
              <span className="lobby-code">{session.join_code}</span>
              <button type="button" className="lobby-copy-btn" onClick={copyCode} title="Copy code">
                <Copy className="lobby-copy-icon" />
              </button>
            </div>
          </div>
        )}

        {/* Problem list summary — interviewer only to prevent candidate preview */}
        {isInterviewer && (
          <div className="lobby-problems">
            <span className="lobby-problems-label">
              {session.problems.length} problem{session.problems.length !== 1 && "s"} queued
            </span>
            <ul className="lobby-problems-list">
              {session.problems.map((p, i) => (
                <li key={p.id} className="lobby-problem-item">
                  <span className="lobby-problem-idx">{i + 1}</span>
                  <span className="lobby-problem-id">{p.problem_id.replace(/-/g, " ")}</span>
                  <span className="lobby-problem-cat">{p.category}</span>
                  <span className="lobby-problem-time">{p.time_limit} min</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Waiting indicator */}
        <div className="lobby-waiting">
          <Loader2 className="lobby-waiting-spinner" />
          <span>Waiting for candidate to join…</span>
        </div>

        {/* Cancel session */}
        {isInterviewer && (
          <button type="button" className="lobby-cancel-btn" onClick={cancelSession}>
            <X className="lobby-cancel-icon" />
            Cancel Session
          </button>
        )}
      </div>
    </div>
  );
}

export default function SessionLobbyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();

  if (!sessionId || !user) {
    return (
      <div className="lobby-error">
        <p>Invalid session.</p>
      </div>
    );
  }

  return (
    <SessionProvider sessionId={sessionId} userId={user.id}>
      <LobbyContent />
    </SessionProvider>
  );
}
