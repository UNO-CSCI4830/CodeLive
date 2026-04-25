/**
 * POST /api/sessions — input validation unit tests
 *
 * Six principles checklist:
 *  Atomic      — each test covers one validation rule
 *  Isolated    — requireAuth and supabaseAdmin are fully mocked;
 *                vi.clearAllMocks() in beforeEach prevents state leakage
 *  Repeatable  — no real network or DB calls; deterministic every run
 *  Self-doc    — test names describe the exact rule being validated
 *  Thorough    — covers all early-return validation branches in the route
 *  Fast        — validation returns before any async DB work is reached
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "test-user-id" };
    next();
  },
}));

import sessionRouter from "../routes/session";

const app = express();
app.use(express.json());
app.use(sessionRouter);

const VALID_PROBLEM = { problemId: "p1", category: "frontend", timeLimit: 30 };

describe("POST /api/sessions — input validation", () => {
  beforeEach(() => {
    // ISOLATED: reset all mocks so no call history bleeds between tests
    vi.clearAllMocks();
  });

  it("returns 400 when interviewerId is missing", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .send({ problems: [VALID_PROBLEM] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/interviewerId/);
  });

  it("returns 400 when problems is missing", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .send({ interviewerId: "test-user-id" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/problems/);
  });

  it("returns 400 when problems is not an array", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .send({ interviewerId: "test-user-id", problems: "not-an-array" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/problems/);
  });

  it("returns 400 when problems array is empty", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .send({ interviewerId: "test-user-id", problems: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/problems/);
  });

  it("returns 403 when interviewerId does not match the authenticated user", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .send({ interviewerId: "a-different-user-id", problems: [VALID_PROBLEM] });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/interviewerId does not match/);
  });

  it("returns 400 when aiEnabled is provided as a non-boolean value", async () => {
    // THOROUGH: exercises the aiEnabled type-check branch
    const res = await request(app)
      .post("/api/sessions")
      .send({
        interviewerId: "test-user-id",
        problems: [VALID_PROBLEM],
        aiEnabled: "yes",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/aiEnabled must be a boolean/);
  });

  it("returns 400 when totalInterviewMinutes is a negative number", async () => {
    // THOROUGH: exercises the totalInterviewMinutes range-check branch
    const res = await request(app)
      .post("/api/sessions")
      .send({
        interviewerId: "test-user-id",
        problems: [VALID_PROBLEM],
        totalInterviewMinutes: -10,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive number/);
  });

  it("returns 400 when totalInterviewMinutes is zero", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .send({
        interviewerId: "test-user-id",
        problems: [VALID_PROBLEM],
        totalInterviewMinutes: 0,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive number/);
  });
});
