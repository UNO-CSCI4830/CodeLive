import { Router, type NextFunction, type Request, type Response } from "express";
import { runLeetcodePython } from "./handlers/runLeetcodePython";
import { runBackendPython } from "./handlers/runBackendPython";
import { runDatabaseSqlite } from "./handlers/runDatabaseSqlite";
import { requireAuth } from "../../middleware/auth";

type RunPath =
  | "/api/run/python"
  | "/api/run/backend/python"
  | "/api/run/database/sql-lite";

type AsyncRunHandler = (req: Request, res: Response) => Promise<void>;

const apiRunRouter = Router();
const runnerRunRouter = Router();
const RUN_EXECUTION_MODE = resolveExecutionMode();
const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL?.trim();
const RUNNER_SHARED_TOKEN = process.env.RUNNER_SHARED_TOKEN;
const RUNNER_REQUEST_TIMEOUT_MS = Number(process.env.RUNNER_REQUEST_TIMEOUT_MS ?? 30_000);
const RUN_RATE_LIMIT_ENABLED = process.env.RUN_RATE_LIMIT_ENABLED !== "false";
const RUN_RATE_LIMIT_WINDOW_MS = Number(process.env.RUN_RATE_LIMIT_WINDOW_MS ?? 60_000);
const RUN_RATE_LIMIT_MAX = Number(process.env.RUN_RATE_LIMIT_MAX ?? 30);
const RUNNER_MAX_CONCURRENT_EXECUTIONS = Number(process.env.RUNNER_MAX_CONCURRENT_EXECUTIONS ?? 4);
const runRateBuckets = new Map<string, { count: number; resetAt: number }>();
const executionWaiters: Array<() => void> = [];
let activeExecutions = 0;

function resolveExecutionMode(): "direct" | "proxy" {
  const mode = process.env.RUN_EXECUTION_MODE?.trim().toLowerCase();
  if (mode === "proxy") return "proxy";
  if (mode === "direct") return "direct";
  return process.env.RUNNER_BASE_URL ? "proxy" : "direct";
}

function getClientKey(req: Request): string {
  const originalIp = req.header("x-original-client-ip");
  if (originalIp) return originalIp;
  const flyClientIp = req.header("fly-client-ip");
  if (flyClientIp) return flyClientIp;
  return req.ip || req.socket.remoteAddress || "unknown";
}

function maybeRateLimit(req: Request, res: Response, next: NextFunction): void {
  if (!RUN_RATE_LIMIT_ENABLED) {
    next();
    return;
  }
  runRateLimit(req, res, next);
}

function runRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  if (runRateBuckets.size > 20_000) {
    for (const [bucketKey, bucket] of runRateBuckets.entries()) {
      if (now >= bucket.resetAt) runRateBuckets.delete(bucketKey);
    }
  }
  const key = getClientKey(req);
  const existing = runRateBuckets.get(key);

  if (!existing || now >= existing.resetAt) {
    runRateBuckets.set(key, {
      count: 1,
      resetAt: now + RUN_RATE_LIMIT_WINDOW_MS,
    });
    next();
    return;
  }

  if (existing.count >= RUN_RATE_LIMIT_MAX) {
    const retryAfterSec = Math.max(Math.ceil((existing.resetAt - now) / 1000), 1);
    res.set("Retry-After", String(retryAfterSec));
    res.status(429).json({
      error: "Run rate limit exceeded. Please retry shortly.",
      retryAfterSeconds: retryAfterSec,
    });
    return;
  }

  existing.count += 1;
  next();
}

function requireRunnerToken(req: Request, res: Response, next: NextFunction): void {
  if (!RUNNER_SHARED_TOKEN) {
    res.status(500).json({
      error: "Runner misconfigured: RUNNER_SHARED_TOKEN is missing.",
    });
    return;
  }

  const headerToken = req.header("x-runner-token")?.trim();
  const authHeader = req.header("authorization")?.trim() ?? "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice("bearer ".length).trim()
    : "";
  const token = headerToken || bearerToken;

  if (!token || token !== RUNNER_SHARED_TOKEN) {
    res.status(401).json({ error: "Unauthorized runner request." });
    return;
  }

  next();
}

async function acquireExecutionSlot(): Promise<() => void> {
  if (RUNNER_MAX_CONCURRENT_EXECUTIONS <= 0) {
    return () => {};
  }

  if (activeExecutions < RUNNER_MAX_CONCURRENT_EXECUTIONS) {
    activeExecutions += 1;
    return releaseExecutionSlot;
  }

  await new Promise<void>((resolve) => executionWaiters.push(resolve));
  activeExecutions += 1;
  return releaseExecutionSlot;
}

function releaseExecutionSlot(): void {
  activeExecutions = Math.max(0, activeExecutions - 1);
  const next = executionWaiters.shift();
  if (next) next();
}

function withExecutionSlot(handler: AsyncRunHandler): AsyncRunHandler {
  return async (req, res) => {
    const release = await acquireExecutionSlot();
    try {
      await handler(req, res);
    } finally {
      release();
    }
  };
}

function proxyOrRun(
  path: RunPath,
  directHandler: AsyncRunHandler,
) {
  return async (req: Request, res: Response): Promise<void> => {
    if (RUN_EXECUTION_MODE === "direct") {
      const guarded = withExecutionSlot(directHandler);
      await guarded(req, res);
      return;
    }
    await proxyToRunner(req, res, path);
  };
}

async function proxyToRunner(
  req: Request,
  res: Response,
  path: RunPath,
): Promise<void> {
  if (!RUNNER_BASE_URL) {
    res.status(503).json({
      error: "Run service unavailable: RUNNER_BASE_URL is not configured.",
    });
    return;
  }
  if (!RUNNER_SHARED_TOKEN) {
    res.status(503).json({
      error: "Run service unavailable: RUNNER_SHARED_TOKEN is not configured.",
    });
    return;
  }

  const url = new URL(path, RUNNER_BASE_URL).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RUNNER_REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-runner-token": RUNNER_SHARED_TOKEN,
        "x-original-client-ip": getClientKey(req),
      },
      body: JSON.stringify(req.body ?? {}),
      signal: controller.signal,
    });

    const upstreamBody = await upstream.text();
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    res.status(upstream.status);
    if (contentType.includes("application/json")) {
      try {
        res.json(JSON.parse(upstreamBody));
      } catch {
        res.type("application/json").send(upstreamBody);
      }
      return;
    }
    res.type(contentType).send(upstreamBody);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(502).json({
      error: "Run service proxy failed.",
      details: msg,
    });
  } finally {
    clearTimeout(timeout);
  }
}

const runRoutes: Array<{ path: RunPath; handler: AsyncRunHandler }> = [
  { path: "/api/run/python", handler: runLeetcodePython },
  { path: "/api/run/backend/python", handler: runBackendPython },
  { path: "/api/run/database/sql-lite", handler: runDatabaseSqlite },
];

for (const { path, handler } of runRoutes) {
  // Public API boundary: browser requests prove user identity with Supabase auth.
  // In proxy mode, the API then calls the private runner with x-runner-token.
  apiRunRouter.post(
    path,
    requireAuth,
    maybeRateLimit,
    proxyOrRun(path, handler),
  );

  // Internal runner boundary: API-to-runner requests prove service identity with
  // the shared runner token. They intentionally do not require user JWT auth.
  runnerRunRouter.post(
    path,
    requireRunnerToken,
    maybeRateLimit,
    withExecutionSlot(handler),
  );
}

export { apiRunRouter, runnerRunRouter };
export default apiRunRouter;
