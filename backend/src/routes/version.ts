import { Router, Request, Response } from "express";

const router = Router();

router.get("/api/version", (_req: Request, res: Response) => {
  res.json({ name: "code-live-backend", version: "0.1.0" });
});

export default router;
