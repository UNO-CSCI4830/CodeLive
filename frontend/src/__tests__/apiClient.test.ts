/**
 * apiFetch — unit tests
 *
 * Six principles checklist:
 *  Atomic      — each test asserts one specific header or URL behavior
 *  Isolated    — vi.stubGlobal("fetch") + vi.clearAllMocks() per test;
 *                Supabase client is fully mocked
 *  Repeatable  — no real network calls; deterministic on every machine
 *  Self-doc    — test names describe the exact condition and expected behavior
 *  Thorough    — covers: token present, token absent, body sets Content-Type,
 *                no body omits Content-Type, caller header is not overridden,
 *                URL is passed through unmodified
 *  Fast        — pure in-process; global fetch replaced with a vi.fn()
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

import { apiFetch } from "@/lib/apiClient";
import { supabase } from "@/lib/supabase";

const mockGetSession = vi.mocked(supabase.auth.getSession);

function withSession(token: string) {
  mockGetSession.mockResolvedValueOnce({
    data: { session: { access_token: token } },
    error: null,
  } as any);
}

function withNoSession() {
  mockGetSession.mockResolvedValueOnce({
    data: { session: null },
    error: null,
  } as any);
}

describe("apiFetch", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches an Authorization Bearer header when an active session token exists", async () => {
    withSession("my-access-token");

    await apiFetch("/api/profile");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).get("Authorization")).toBe(
      "Bearer my-access-token"
    );
  });

  it("does not attach an Authorization header when there is no active session", async () => {
    withNoSession();

    await apiFetch("/api/profile");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).has("Authorization")).toBe(false);
  });

  it("sets Content-Type to application/json when the request has a body", async () => {
    withNoSession();

    await apiFetch("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ interviewerId: "u1", problems: [] }),
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).get("Content-Type")).toBe(
      "application/json"
    );
  });

  it("does not set Content-Type when no body is provided", async () => {
    withNoSession();

    await apiFetch("/api/profile");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).has("Content-Type")).toBe(false);
  });

  it("does not override a Content-Type header provided by the caller", async () => {
    // THOROUGH: verifies that apiFetch respects caller-provided headers
    withNoSession();

    await apiFetch("/api/upload", {
      method: "POST",
      body: "raw data",
      headers: { "Content-Type": "text/plain" },
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).get("Content-Type")).toBe("text/plain");
  });

  it("passes the URL through to fetch unchanged", async () => {
    // THOROUGH: ensures apiFetch does not mutate or rewrite the URL
    withNoSession();

    await apiFetch("/api/profile");

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/profile");
  });
});
