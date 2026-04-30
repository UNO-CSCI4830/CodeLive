import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import healthRouter from "./routes/health";
import versionRouter from "./routes/version";
import profileRouter from "./routes/profile";
import dashboardRouter from "./routes/dashboard";
import contentRouter from "./routes/content";
import { apiRunRouter } from "./routes/run";
import sessionRouter from "./routes/session";
import aiRouter from "./routes/ai";
import reportRouter from "./routes/report";
import groupsRouter from "./routes/groups";
import { attachYjsWebSocket } from "./lib/websocket";

const app = express();
const PORT = process.env.PORT ?? 5000;
app.disable("x-powered-by");

// Trust only the immediate reverse proxy (Fly.io = 1 hop).
// Prevents IP spoofing via X-Forwarded-For.
const TRUST_PROXY = process.env.TRUST_PROXY ?? "1";
app.set("trust proxy", /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.)
app.use(helmet());

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";

app.use(
  cors({
    origin: (incoming, cb) => {
      if (!incoming || ALLOWED_ORIGINS.includes(incoming)) return cb(null, true);
      // In local dev, allow any localhost origin (handles Vite port fallback)
      if (isDev && incoming.match(/^https?:\/\/localhost(:\d+)?$/)) return cb(null, true);
      cb(new Error(`CORS: ${incoming} not allowed`));
    },
  }),
);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "1mb" }));

// Global rate limit — prevents brute-force and abuse across all endpoints.
// Per-route limits (e.g. /run) can layer on top of this.
const GLOBAL_RATE_LIMIT_WINDOW_MS = Number(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS ?? 60_000);
const GLOBAL_RATE_LIMIT_MAX = Number(process.env.GLOBAL_RATE_LIMIT_MAX ?? 100);

app.use(
  rateLimit({
    windowMs: GLOBAL_RATE_LIMIT_WINDOW_MS,
    max: GLOBAL_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again shortly." },
    // Skip health checks so load-balancer probes aren't rate-limited
    skip: (req) => req.path === "/health",
  }),
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use(healthRouter);
app.use(versionRouter);
app.use(profileRouter);
app.use(dashboardRouter);
app.use(contentRouter);
app.use(apiRunRouter);
app.use(sessionRouter);
app.use(aiRouter);
app.use(reportRouter);
app.use(groupsRouter);

// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------
const server = http.createServer(app);
attachYjsWebSocket(server);

server.listen(PORT, () => {
  console.log(`[code-live-backend] listening on http://localhost:${PORT}`);
});
