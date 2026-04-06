/** Types shared across session-related pages and components. */

export type SessionStatus = "waiting" | "active" | "completed" | "cancelled";

export interface SessionProblem {
  id: string;
  session_id: string;
  problem_id: string;
  category: "frontend" | "leetcode" | "backend" | "database";
  time_limit: number; // minutes
  order_index: number;
  locked: boolean;
}

export interface Session {
  id: string;
  join_code: string;
  interviewer_id: string;
  group_id: string | null;
  candidate_id: string | null;
  candidate_name: string | null;
  candidate_last_name: string | null;
  candidate_email: string | null;
  ai_enabled: boolean;
  status: SessionStatus;
  current_index: number;
  total_time_limit_minutes: number;
  timer_paused: boolean;
  timer_paused_at: string | null;
  timer_paused_seconds: number;
  created_at: string;
  started_at: string | null;
  current_question_started_at: string | null;
  ended_at: string | null;
  problems: SessionProblem[];
}

/** Payload sent to POST /api/sessions */
export interface CreateSessionPayload {
  interviewerId: string;
  aiEnabled: boolean;
  totalInterviewMinutes: number;
  groupId?: string | null;
  problems: {
    problemId: string;
    category: string;
    timeLimit: number;
  }[];
}

/** Selected problem in the create-session picker */
export interface SelectedProblem {
  problemId: string;
  title: string;
  category: "frontend" | "leetcode" | "backend" | "database";
  difficulty: "easy" | "medium" | "hard";
}

// ── Interview report ──────────────────────────────────────────────────────

export interface PerQuestionAnalysis {
  orderIndex: number;
  title: string;
  correctness: "correct" | "partial" | "incorrect" | "not_attempted";
  codeAnalysis: string;
  approachQuality: string;
  strengths: string[];
  improvements: string[];
}

export interface InterviewReport {
  id: string;
  session_id: string;
  /** pending | generating | completed | failed */
  status: "pending" | "generating" | "completed" | "failed";
  overall_summary?: string;
  overall_score?: number | null;
  strengths?: string[];
  areas_for_improvement?: string[];
  problem_solving_progression?: string;
  per_question?: PerQuestionAnalysis[];
  ai_use_score?: number | null;
  ai_use_notes?: string;
  error_message?: string;
  generated_at?: string;
  created_at: string;
}
