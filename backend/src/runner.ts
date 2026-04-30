import http from "http";
import express from "express";
import healthRouter from "./routes/health";
import versionRouter from "./routes/version";
import { runnerRunRouter } from "./routes/run";

const app = express();
const PORT = process.env.PORT ?? 5000;

app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "1mb" }));

app.use(healthRouter);
app.use(versionRouter);
app.use(runnerRunRouter);

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`[codelive-runner] listening on http://localhost:${PORT}`);
});
