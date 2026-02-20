import "dotenv/config";
import express from "express";
import cors from "cors";
import healthRouter from "./routes/health";
import versionRouter from "./routes/version";
import profileRouter from "./routes/profile";

const app = express();
const PORT = process.env.PORT ?? 5000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use(healthRouter);
app.use(versionRouter);
app.use(profileRouter);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[code-live-backend] listening on http://localhost:${PORT}`);
});
