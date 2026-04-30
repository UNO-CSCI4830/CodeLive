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

const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockIs = vi.hoisted(() => vi.fn());
const mockLte = vi.hoisted(() => vi.fn());
const mockSessionProblemsResult = vi.hoisted(() => vi.fn());
const mockGetUserById = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() =>
  vi.fn((table: string) => {
    const builder: Record<string, any> = {};

    builder.select = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.eq = vi.fn((...args: any[]) => {
      mockEq(table, ...args);
      return builder;
    });
    builder.is = vi.fn((...args: any[]) => {
      mockIs(table, ...args);
      return builder;
    });
    builder.lte = vi.fn((...args: any[]) => {
      mockLte(table, ...args);
      return builder;
    });
    builder.update = vi.fn((...args: any[]) => {
      mockUpdate(table, ...args);
      return builder;
    });
    builder.maybeSingle = mockMaybeSingle;
    builder.then = (resolve: any, reject: any) => {
      const result =
        table === "session_problems"
          ? mockSessionProblemsResult()
          : { data: null, error: null };
      return Promise.resolve(result).then(resolve, reject);
    };

    return builder;
  }),
);

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: mockFrom,
    auth: {
      admin: {
        getUserById: mockGetUserById,
      },
    },
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
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSessionProblemsResult.mockResolvedValue({ data: [], error: null });
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

describe("GET /api/sessions/:sessionId — role-shaped problem visibility", () => {
  const PROBLEMS = [
    { id: "sp-0", order_index: 0, problem_id: "p0", category: "frontend" },
    { id: "sp-1", order_index: 1, problem_id: "p1", category: "backend" },
    { id: "sp-2", order_index: 2, problem_id: "p2", category: "database" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockReset();
    mockSessionProblemsResult.mockReset();
  });

  it("hides future problems from candidates", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "session-abc",
        interviewer_id: "interviewer-user-id",
        candidate_id: "test-user-id",
        current_index: 1,
        status: "active",
      },
      error: null,
    });
    mockSessionProblemsResult.mockResolvedValueOnce({
      data: PROBLEMS,
      error: null,
    });

    const res = await request(app).get("/api/sessions/session-abc");

    expect(res.status).toBe(200);
    expect(res.body.problems.map((problem: { problem_id: string }) => problem.problem_id))
      .toEqual(["p0", "p1"]);
    expect(mockLte).toHaveBeenCalledWith("session_problems", "order_index", 1);
  });

  it("returns the full problem queue to interviewers", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "session-abc",
        interviewer_id: "test-user-id",
        candidate_id: "candidate-user-id",
        current_index: 1,
        status: "active",
      },
      error: null,
    });
    mockSessionProblemsResult.mockResolvedValueOnce({
      data: PROBLEMS,
      error: null,
    });

    const res = await request(app).get("/api/sessions/session-abc");

    expect(res.status).toBe(200);
    expect(res.body.problems.map((problem: { problem_id: string }) => problem.problem_id))
      .toEqual(["p0", "p1", "p2"]);
    expect(mockLte).not.toHaveBeenCalled();
  });
});

describe("POST /api/sessions/join — atomic candidate claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockReset();
    mockGetUserById.mockResolvedValue({
      data: { user: { email: "candidate@example.test" } },
      error: null,
    });
  });

  it("returns 409 when another candidate claims the waiting session before update completes", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: {
          id: "session-abc",
          join_code: "ABC123",
          interviewer_id: "interviewer-user-id",
          candidate_id: null,
          status: "waiting",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { name: "Test Candidate" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: null,
      });

    const res = await request(app)
      .post("/api/sessions/join")
      .send({ joinCode: "abc123", candidateId: "test-user-id" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/claimed by another candidate/i);
    expect(mockEq).toHaveBeenCalledWith("sessions", "status", "waiting");
    expect(mockIs).toHaveBeenCalledWith("sessions", "candidate_id", null);
  });
});
