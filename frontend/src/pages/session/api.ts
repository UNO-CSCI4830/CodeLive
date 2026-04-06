/** API helpers for session management. */

import type { CreateSessionPayload, Session, InterviewReport } from "./types";

// ── Session helpers (existing) ─────────────────────────────────────────

export async function createSession(
  payload: CreateSessionPayload,
): Promise<{ sessionId: string; joinCode: string }> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create session (${res.status})`);
  }
  return res.json();
}

export async function joinSession(
  joinCode: string,
  candidateId: string,
): Promise<{ sessionId: string }> {
  const res = await fetch("/api/sessions/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ joinCode, candidateId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to join session (${res.status})`);
  }
  return res.json();
}

export async function fetchSession(sessionId: string): Promise<Session> {
  const maxAttempts = 4;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (res.ok) {
      return res.json();
    }

    const body = await res.json().catch(() => ({} as Record<string, unknown>));
    const backendError =
      typeof body.error === "string" && body.error.trim().length > 0
        ? body.error
        : null;

    const isRetriable =
      res.status === 404 || res.status === 408 || res.status === 425 || res.status === 429 || res.status >= 500;

    if (isRetriable && attempt < maxAttempts) {
      const backoffMs = 250 * attempt;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      continue;
    }

    throw new Error(
      backendError
        ? `${backendError} (${res.status})`
        : `Failed to fetch session (${res.status})`,
    );
  }

  throw new Error("Failed to fetch session");
}

export async function advanceQuestion(
  sessionId: string,
): Promise<{ status: string; currentIndex: number }> {
  const res = await fetch(`/api/sessions/${sessionId}/advance`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to advance");
  }
  return res.json();
}

export async function selectQuestion(
  sessionId: string,
  index: number,
): Promise<{ currentIndex: number }> {
  const res = await fetch(`/api/sessions/${sessionId}/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to switch question");
  }
  return res.json();
}

export async function endSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to end session (${res.status})`);
  }
}

export interface TimerState {
  timerPaused: boolean;
  timerPausedAt: string | null;
  timerPausedSeconds: number;
}

export async function pauseTimer(sessionId: string): Promise<TimerState> {
  const res = await fetch(`/api/sessions/${sessionId}/timer/pause`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to pause timer");
  }
  return res.json();
}

export async function resumeTimer(sessionId: string): Promise<TimerState> {
  const res = await fetch(`/api/sessions/${sessionId}/timer/resume`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to resume timer");
  }
  return res.json();
}

// ── Report helpers ─────────────────────────────────────────────────────

export interface SnapshotPayload {
  orderIndex: number;
  problemId: string;
  category: string;
  code: string;
  language: string;
  hintsUsed: number;
  aiMessages: Array<{ role: string; content: string; timestamp: number }>;
}

export interface GenerateReportPayload {
  problems: Array<{
    orderIndex: number;
    problemId: string;
    category: string;
    title: string;
    description: string;
    timeLimit: number;
  }>;
}

export interface AiChatLogMessage {
  orderIndex: number;
  problemId: string;
  messageId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

/** Save code snapshots for all completed questions. */
export async function saveSnapshots(
  sessionId: string,
  snapshots: SnapshotPayload[],
): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}/snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshots),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to save snapshots (${res.status})`);
  }
}

/** Trigger async AI report generation. Returns immediately with reportId. */
export async function generateReport(
  sessionId: string,
  payload: GenerateReportPayload,
): Promise<{ reportId: string }> {
  const res = await fetch(`/api/sessions/${sessionId}/report/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to trigger report (${res.status})`);
  }
  return res.json();
}

/** Fetch the current report row (poll until status === 'completed'). */
export async function fetchReport(sessionId: string): Promise<InterviewReport> {
  const res = await fetch(`/api/sessions/${sessionId}/report`);
  if (!res.ok) {
    throw new Error(`Failed to fetch report (${res.status})`);
  }
  return res.json();
}

/** Fetch persisted per-question AI chat logs for a session. */
export async function fetchAiLogs(sessionId: string): Promise<AiChatLogMessage[]> {
  const res = await fetch(`/api/sessions/${sessionId}/ai-log`);
  if (!res.ok) {
    throw new Error(`Failed to fetch AI logs (${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data?.messages) ? data.messages : [];
}
