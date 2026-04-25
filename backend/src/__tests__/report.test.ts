/**
 * POST /api/sessions/:sessionId/snapshots — unit tests
 *
 * Six principles checklist:
 *  Atomic      — each test covers one outcome (auth, validation, or success)
 *  Isolated    — vi.hoisted + vi.clearAllMocks() keeps mock state per-test
 *  Repeatable  — Supabase and requireAuth fully mocked; no real I/O
 *  Self-doc    — test names state the exact precondition and expected result
 *  Thorough    — covers 404 (not found), 403 (not participant), 400 (bad body),
 *                and 200 (happy path) — all response branches of the handler
 *  Fast        — no network calls; in-process only
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
      upsert: mockUpsert,
    })),
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

/** Stub the session participant check to make the test user the interviewer. */
function mockAsParticipant() {
  mockMaybeSingle.mockResolvedValueOnce({
    data: { interviewer_id: "test-user-id", candidate_id: null },
    error: null,
  });
}

describe("POST /api/sessions/:sessionId/snapshots", () => {
  beforeEach(() => {
    // ISOLATED: clear all mock state so tests are fully independent
    vi.clearAllMocks();
    // Default upsert to success so tests that reach it don't fail unexpectedly
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("returns 404 when the session does not exist", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const res = await request(app)
      .post("/api/sessions/nonexistent-id/snapshots")
      .send([VALID_SNAPSHOT]);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("returns 403 when the authenticated user is not a session participant", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { interviewer_id: "other-user-1", candidate_id: "other-user-2" },
      error: null,
    });

    const res = await request(app)
      .post("/api/sessions/session-abc/snapshots")
      .send([VALID_SNAPSHOT]);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not a participant/i);
  });

  it("returns 400 when the request body is not an array", async () => {
    // THOROUGH: exercises the Array.isArray guard
    mockAsParticipant();

    const res = await request(app)
      .post("/api/sessions/session-abc/snapshots")
      .send({ single: "object" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/snapshots array is required/i);
  });

  it("returns 400 when the snapshots array is empty", async () => {
    mockAsParticipant();

    const res = await request(app)
      .post("/api/sessions/session-abc/snapshots")
      .send([]);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/snapshots array is required/i);
  });

  it("returns 200 with a saved count when the request is valid", async () => {
    // THOROUGH: happy-path — verifies the success response shape
    mockAsParticipant();

    const res = await request(app)
      .post("/api/sessions/session-abc/snapshots")
      .send([VALID_SNAPSHOT]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ saved: 1 });
  });
});
