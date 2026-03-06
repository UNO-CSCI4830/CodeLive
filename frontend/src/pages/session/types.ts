/** Types shared across session-related pages and components. */

export type SessionStatus = "waiting" | "active" | "completed" | "cancelled";

export interface SessionProblem {
  id: string;
  session_id: string;
  problem_id: string;
  category: "frontend" | "leetcode";
  time_limit: number; // minutes
  order_index: number;
  locked: boolean;
}

export interface Session {
  id: string;
  join_code: string;
  interviewer_id: string;
  candidate_id: string | null;
  status: SessionStatus;
  current_index: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  problems: SessionProblem[];
}

/** Payload sent to POST /api/sessions */
export interface CreateSessionPayload {
  interviewerId: string;
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
  category: "frontend" | "leetcode";
  difficulty: "easy" | "medium" | "hard";
  timeLimit: number; // minutes
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
