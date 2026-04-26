import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Request, Response, NextFunction } from "express";

/**
 * Unit tests for requireAuth middleware:
 * mockup setting is used to test if the different parts of requireAuth are working correctly
 */

// supabase mock setup before requireAuth is added
vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

// Mock the Supabase client creation
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
  })),
}));

// imports after mocks are set up
import { requireAuth } from "../middleware/auth";
import { createClient } from "@supabase/supabase-js";

const mockUser = {
  id: "user-123",
  email: "test@example.com",
  aud: "authenticated",
  role: "authenticated",
};
// mock jwt token for testing
const validJwt =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

// Mock Request/Response
function createMockReqRes() {
  const mockReq = {
    headers: {},
  } as unknown as Request;

  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  // Err shown for some reason in visual studio code
  const mockNext = vi.fn() as NextFunction;

  return { mockReq, mockRes, mockNext };
}

//Tests

describe("requireAuth()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // required enviornment variables set
    // mock url and key used
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "test-anon-key";
  });

  afterEach(() => {delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY;});

  // requireAuth must handle authorization errors correctly.
  describe("requireAuth: Authorization header validation", () => {

    // Test 1
    it("return's 401 when Authorization header is missing", async () => {
      const { mockReq, mockRes, mockNext } = createMockReqRes();
      mockReq.headers = {};

      await requireAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({error: "Missing or invalid Authorization header",});
      expect(mockNext).not.toHaveBeenCalled();
    });

    // Test 2
    it("return's 401 when Authorization header is empty", async () => {
      const { mockReq, mockRes, mockNext } = createMockReqRes();
      mockReq.headers = { authorization: "" };

      await requireAuth(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({error: "Missing or invalid Authorization header",});
      expect(mockNext).not.toHaveBeenCalled();
    });

  });

  // requireAuth allows session to continue if token and user authentification is correct
  describe("requireAuth: User authentication", () => {
    it("calls next() when token is valid and user exists", async () => {
      const { mockReq, mockRes, mockNext } = createMockReqRes();
      mockReq.headers = { authorization: `Bearer ${validJwt}` };

      const mockCreateClient = createClient as any;
      mockCreateClient.mockReturnValueOnce({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValueOnce({ data: { user: mockUser }, error: null }),
        },
      });

      await requireAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("attaches user to request when authentication succeeds", async () => {
      const { mockReq, mockRes, mockNext } = createMockReqRes();
      mockReq.headers = { authorization: `Bearer ${validJwt}` };
      const mockCreateClient = createClient as any;
      mockCreateClient.mockReturnValueOnce({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValueOnce({ data: { user: mockUser }, error: null }),
        },
      });

      await requireAuth(mockReq, mockRes, mockNext);

      // Check that user was attached to request
      const reqWithUser = mockReq as any;
      expect(reqWithUser.user).toEqual(mockUser);
      expect(reqWithUser.user.id).toBe("user-123");
      expect(reqWithUser.user.email).toBe("test@example.com");
    });

  });

  // requireAuth can correctly handle multiple authentication attemps even in the event of an invalid request.
  describe("requireAuth: Multiple authentication attempts", () => {
    // Test 1
    it("handles sequential valid auth requests", async () => {
      const mockCreateClient = createClient as any;

      // Initial request
      const { mockReq: req1, mockRes: res1, mockNext: next1 } = createMockReqRes();
      req1.headers = { authorization: `Bearer ${validJwt}` };
      mockCreateClient.mockReturnValueOnce({
        auth: {
          getUser: vi
            .fn().mockResolvedValueOnce({ data: { user: mockUser }, error: null }),

        },
      });

      await requireAuth(req1, res1, next1);
      expect(next1).toHaveBeenCalled();

      // Second request
      const { mockReq: req2, mockRes: res2, mockNext: next2 } = createMockReqRes();
      req2.headers = { authorization: `Bearer ${validJwt}` };
      mockCreateClient.mockReturnValueOnce({
        auth: {getUser: vi.fn().mockResolvedValueOnce({ data: { user: mockUser }, error: null }),
        },
      });

      await requireAuth(req2, res2, next2);
      expect(next2).toHaveBeenCalled();
    });

    // Test 2
    it("handles valid request after invalid request", async () => {
      const mockCreateClient = createClient as any;

      // Initial request - invalid
      const { mockReq: req1, mockRes: res1, mockNext: next1 } = createMockReqRes();
      req1.headers = { authorization: "InvalidHeader" };

      await requireAuth(req1, res1, next1);
      expect(res1.status).toHaveBeenCalledWith(401);
      expect(next1).not.toHaveBeenCalled();

      // Second request - valid
      const { mockReq: req2, mockRes: res2, mockNext: next2 } =createMockReqRes();
      req2.headers = { authorization: `Bearer ${validJwt}` };
      mockCreateClient.mockReturnValueOnce({
        auth: {
          getUser: vi
            .fn().mockResolvedValueOnce({ data: { user: mockUser }, error: null }),
        },
      });

      await requireAuth(req2, res2, next2);
      expect(next2).toHaveBeenCalled();
    });
  });

  // requireAuth can handle specific edge cases such as token length and differing user objects.
  describe("requireAuth: Edge cases", () => {

    // Test 1
    it("handles very long token", async () => {
      const { mockReq, mockRes, mockNext } = createMockReqRes();
      const longToken = "x".repeat(10000);
      mockReq.headers = { authorization: `Bearer ${longToken}` };

      const mockCreateClient = createClient as any;
      mockCreateClient.mockReturnValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValueOnce({
            data: { user: null },
            error: new Error("Invalid token"),
          }),
        },
      });

      await requireAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    // Test 2
    it("handles different user objects", async () => {
      const { mockReq, mockRes, mockNext } = createMockReqRes();
      mockReq.headers = { authorization: `Bearer ${validJwt}` };

      const differentUser = {
        id: "user-456",
        email: "different@example.com",
        aud: "authenticated",
        role: "authenticated",
      };

      const mockCreateClient = createClient as any;
      mockCreateClient.mockReturnValueOnce({
        auth: {
          getUser: vi
            .fn().mockResolvedValueOnce({data: { user: differentUser }, error: null,}),
        },
      });

      await requireAuth(mockReq, mockRes, mockNext);

      const reqWithUser = mockReq as any;
      expect(reqWithUser.user.id).toBe("user-456");
      expect(reqWithUser.user.email).toBe("different@example.com");
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
