/**
 * POST /api/sessions/:sessionId/snapshots — unit tests
 *
 * Six principles checklist:
 *  Atomic      — each test covers one outcome (auth, validation, or success)
 *  Isolated    — vi.hoisted + vi.clearAllMocks() keeps mock state per-test
 *  Repeatable  — Supabase and requireAuth fully mocked; no real database I/O
 *  Self-doc    — test names state the exact precondition and expected result
 *  Thorough    — covers 404 (not found), 403 (not interviewer), 400 (bad body),
 *                and 200 (happy path) — key response branches of the handler
 *  Fast        — no network calls; in-process only
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockCodeSnapshotsUpsert = vi.hoisted(() => vi.fn());
const mockInterviewReportSingle = vi.hoisted(() => vi.fn());
const mockSessionProblemsResult = vi.hoisted(() => vi.fn());
const mockCodeSnapshotsResult = vi.hoisted(() => vi.fn());
const mockAiMessagesResult = vi.hoisted(() => vi.fn());
const mockUpdateResult = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() =>
  vi.fn((table: string) => {
    const builder: Record<string, any> = {};

    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.maybeSingle = mockMaybeSingle;
    builder.single = mockInterviewReportSingle;
    builder.upsert = vi.fn((...args: any[]) => {
      if (table === "interview_reports") return builder;
      return mockCodeSnapshotsUpsert(...args);
    });
    builder.update = vi.fn((...args: any[]) => {
      mockUpdateResult(...args);
      return { eq: vi.fn().mockResolvedValue({ error: null }) };
    });
    builder.then = (resolve: any, reject: any) => {
      let result: unknown = { data: null, error: null };
      if (table === "session_problems") result = mockSessionProblemsResult();
      if (table === "code_snapshots") result = mockCodeSnapshotsResult();
      if (table === "session_ai_messages") result = mockAiMessagesResult();
      return Promise.resolve(result).then(resolve, reject);
    };

    return builder;
  }),
);

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "test-user-id" };
    next();
  },
}));

import reportRouter from "../routes/report";

const app = express();
app.use(express.json());
app.use(reportRouter);

const VALID_SNAPSHOT = {
  orderIndex: 0,
  problemId: "p1",
  category: "frontend",
  code: "const x = 1;",
  language: "javascript",
  hintsUsed: 0,
  aiMessages: [],
};

/** Stub the report auth check to make the test user the interviewer. */
function mockAsInterviewer() {
  mockMaybeSingle.mockResolvedValueOnce({
    data: { interviewer_id: "test-user-id", candidate_id: null },
    error: null,
  });
}

/** Stub a valid session where the test user is the candidate, not interviewer. */
function mockAsCandidate() {
  mockMaybeSingle.mockResolvedValueOnce({
    data: { interviewer_id: "interviewer-user-id", candidate_id: "test-user-id" },
    error: null,
  });
}

describe("POST /api/sessions/:sessionId/snapshots", () => {
  beforeEach(() => {
    // ISOLATED: clear all mock state so tests are fully independent
    vi.clearAllMocks();
    // Default upsert to success so tests that reach it don't fail unexpectedly
    mockCodeSnapshotsUpsert.mockResolvedValue({ error: null });
    mockInterviewReportSingle.mockResolvedValue({
      data: { id: "report-id" },
      error: null,
    });
    mockSessionProblemsResult.mockResolvedValue({ data: [], error: null });
    mockCodeSnapshotsResult.mockResolvedValue({ data: [], error: null });
    mockAiMessagesResult.mockResolvedValue({ data: [], error: null });
    mockUpdateResult.mockResolvedValue({ error: null });
  });

  it("returns 404 when the session does not exist", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const res = await request(app)
      .post("/api/sessions/nonexistent-id/snapshots")
      .send([VALID_SNAPSHOT]);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("returns 403 when the authenticated user is the candidate, not interviewer", async () => {
    mockAsCandidate();

    const res = await request(app)
      .post("/api/sessions/session-abc/snapshots")
      .send([VALID_SNAPSHOT]);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/only the interviewer/i);
  });

  it("returns 400 when the request body is not an array", async () => {
    // THOROUGH: exercises the Array.isArray guard
    mockAsInterviewer();

    const res = await request(app)
      .post("/api/sessions/session-abc/snapshots")
      .send({ single: "object" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/snapshots array is required/i);
  });

  it("returns 400 when the snapshots array is empty", async () => {
    mockAsInterviewer();

    const res = await request(app)
      .post("/api/sessions/session-abc/snapshots")
      .send([]);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/snapshots array is required/i);
  });

  it("returns 200 with a saved count when the request is valid", async () => {
    // THOROUGH: happy-path — verifies the success response shape
    mockAsInterviewer();

    const res = await request(app)
      .post("/api/sessions/session-abc/snapshots")
      .send([VALID_SNAPSHOT]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ saved: 1 });
  });
});

describe("report endpoints — interviewer-only access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    mockInterviewReportSingle.mockResolvedValue({
      data: { id: "report-id" },
      error: null,
    });
    mockSessionProblemsResult.mockResolvedValue({ data: [], error: null });
    mockCodeSnapshotsResult.mockResolvedValue({ data: [], error: null });
    mockAiMessagesResult.mockResolvedValue({ data: [], error: null });
    mockUpdateResult.mockResolvedValue({ error: null });
  });

  it("blocks candidates from triggering report generation", async () => {
    mockAsCandidate();

    const res = await request(app)
      .post("/api/sessions/session-abc/report/generate")
      .send({ problems: [] });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/only the interviewer/i);
  });

  it("triggers generation from server-side session problems without a client problem payload", async () => {
    mockAsInterviewer();
    mockSessionProblemsResult.mockResolvedValueOnce({
      data: [
        {
          order_index: 0,
          problem_id: "paginated-users-list",
          category: "backend",
          time_limit: 30,
        },
      ],
      error: null,
    });
    mockInterviewReportSingle.mockResolvedValueOnce({
      data: { id: "report-123" },
      error: null,
    });

    const res = await request(app)
      .post("/api/sessions/session-abc/report/generate")
      .send({ problems: [{ orderIndex: 99, problemId: "forged", category: "leetcode" }] });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reportId: "report-123" });
    expect(mockSessionProblemsResult).toHaveBeenCalled();
  });

  it("blocks candidates from reading the generated report", async () => {
    mockAsCandidate();

    const res = await request(app).get("/api/sessions/session-abc/report");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/only the interviewer/i);
  });

  it("blocks candidates from reading report AI logs", async () => {
    mockAsCandidate();

    const res = await request(app).get("/api/sessions/session-abc/ai-log");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/only the interviewer/i);
  });
});
