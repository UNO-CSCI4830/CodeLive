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
  const res = await fetch(`/api/sessions/${sessionId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch session (${res.status})`);
  }
  return res.json();
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

export async function lockProblem(
  sessionId: string,
  orderIndex: number,
): Promise<void> {
  await fetch(`/api/sessions/${sessionId}/lock/${orderIndex}`, {
    method: "POST",
  });
}

export async function endSession(sessionId: string): Promise<void> {
  await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
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
