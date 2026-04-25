/**
 * requireAuth middleware — unit tests
 *
 * Six principles checklist:
 *  Atomic      — each test asserts one specific behavior
 *  Isolated    — vi.clearAllMocks() in beforeEach; no shared state leaks
 *  Repeatable  — all I/O (Supabase) is mocked; result is identical every run
 *  Self-doc    — test names read as plain English specifications
 *  Thorough    — covers every branch: missing header, wrong scheme, null user
 *                (no error), Supabase error, valid token
 *  Fast        — no network or DB calls; pure in-process execution
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabase";

const mockGetUser = vi.mocked(supabaseAdmin.auth.getUser);

function makeReqResNext() {
  const req = { headers: {} } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe("requireAuth middleware", () => {
  beforeEach(() => {
    // ISOLATED: reset all mock state so tests cannot influence each other
    vi.clearAllMocks();
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const { req, res, next } = makeReqResNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Missing or invalid Authorization header",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header uses a non-Bearer scheme", async () => {
    const { req, res, next } = makeReqResNext();
    (req as any).headers.authorization = "Basic dXNlcjpwYXNz";

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Missing or invalid Authorization header",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Supabase reports a token error", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "jwt expired" },
    } as any);
    const { req, res, next } = makeReqResNext();
    (req as any).headers.authorization = "Bearer expired-token";

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Supabase returns no error but resolves no user", async () => {
    // THOROUGH: covers the `!user` branch independently of the `error` branch
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as any);
    const { req, res, next } = makeReqResNext();
    (req as any).headers.authorization = "Bearer revoked-token";

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and attaches the user to the request when the token is valid", async () => {
    const fakeUser = { id: "user-abc-123", email: "dev@codelive.test" };
    mockGetUser.mockResolvedValueOnce({
      data: { user: fakeUser },
      error: null,
    } as any);
    const { req, res, next } = makeReqResNext();
    (req as any).headers.authorization = "Bearer valid-jwt-token";

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as any).user).toEqual(fakeUser);
    expect(res.status).not.toHaveBeenCalled();
  });
});
