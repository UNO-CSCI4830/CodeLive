import http from "http";
import express from "express";
import cors from "cors";
import healthRouter from "./routes/health";
import versionRouter from "./routes/version";
import profileRouter from "./routes/profile";
import contentRouter from "./routes/content";
import runRouter from "./routes/run";
import sessionRouter from "./routes/session";
import aiRouter from "./routes/ai";
import reportRouter from "./routes/report";
import { attachYjsWebSocket } from "./lib/websocket";

const app = express();
const PORT = process.env.PORT ?? 5000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
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
app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use(healthRouter);
app.use(versionRouter);
app.use(profileRouter);
app.use(contentRouter);
app.use(runRouter);
app.use(sessionRouter);
app.use(aiRouter);
app.use(reportRouter);

// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------
const server = http.createServer(app);
attachYjsWebSocket(server);

server.listen(PORT, () => {
  console.log(`[code-live-backend] listening on http://localhost:${PORT}`);
});
