/**
 * Run service configuration guards.
 *
 * These tests protect the production fail-closed behavior: the public API must
 * proxy run requests to the private runner, while the runner must require the
 * shared service token.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadRunModule() {
  vi.resetModules();
  vi.doMock("../lib/supabase", () => ({
    supabaseAdmin: {
      auth: {
        getUser: vi.fn(),
      },
    },
  }));

  return import("../routes/run");
}

function stubRunEnv(values: {
  nodeEnv?: string;
  executionMode?: string;
  runnerBaseUrl?: string;
  runnerToken?: string;
}) {
  vi.stubEnv("NODE_ENV", values.nodeEnv ?? "");
  vi.stubEnv("RUN_EXECUTION_MODE", values.executionMode ?? "");
  vi.stubEnv("RUNNER_BASE_URL", values.runnerBaseUrl ?? "");
  vi.stubEnv("RUNNER_SHARED_TOKEN", values.runnerToken ?? "");
}

describe("run service production configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("rejects production API config when direct execution would run in the API", async () => {
    stubRunEnv({
      nodeEnv: "production",
      executionMode: "direct",
      runnerBaseUrl: "",
      runnerToken: "",
    });

    const { assertApiRunConfiguration } = await loadRunModule();

    expect(() => assertApiRunConfiguration()).toThrow(/RUN_EXECUTION_MODE=proxy/);
  });

  it("accepts production API config when run requests proxy to a token-protected runner", async () => {
    stubRunEnv({
      nodeEnv: "production",
      executionMode: "proxy",
      runnerBaseUrl: "http://codelive-runner.internal:5000",
      runnerToken: "test-runner-token",
    });

    const { assertApiRunConfiguration } = await loadRunModule();

    expect(() => assertApiRunConfiguration()).not.toThrow();
  });

  it("rejects production runner config without the shared service token", async () => {
    stubRunEnv({
      nodeEnv: "production",
      executionMode: "direct",
      runnerToken: "",
    });

    const { assertRunnerRunConfiguration } = await loadRunModule();

    expect(() => assertRunnerRunConfiguration()).toThrow(/RUNNER_SHARED_TOKEN/);
  });

  it("rejects production runner config when it is not in direct execution mode", async () => {
    stubRunEnv({
      nodeEnv: "production",
      executionMode: "proxy",
      runnerBaseUrl: "http://codelive-runner.internal:5000",
      runnerToken: "test-runner-token",
    });

    const { assertRunnerRunConfiguration } = await loadRunModule();

    expect(() => assertRunnerRunConfiguration()).toThrow(/RUN_EXECUTION_MODE=direct/);
  });

  it("allows development API config to run directly for local Docker workflows", async () => {
    stubRunEnv({
      nodeEnv: "development",
      executionMode: "direct",
      runnerToken: "",
    });

    const { assertApiRunConfiguration } = await loadRunModule();

    expect(() => assertApiRunConfiguration()).not.toThrow();
  });
});
