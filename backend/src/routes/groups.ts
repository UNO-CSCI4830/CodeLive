/**
 * Interviewer groups endpoints.
 *
 * GET  /api/groups         — list groups for the authenticated interviewer
 * POST /api/groups         — create a new group
 */

import { Router, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

// ── GET /api/groups ───────────────────────────────────────────────────────

router.get(
  "/api/groups",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { user } = req as AuthRequest;

    const { data, error } = await supabaseAdmin
      .from("interviewer_groups")
      .select("id, job_role, job_number, created_at")
      .eq("interviewer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data ?? []);
  },
);

// ── POST /api/groups ──────────────────────────────────────────────────────

router.post(
  "/api/groups",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { user } = req as AuthRequest;
    const { jobRole, jobNumber } = req.body;

    if (!jobRole || typeof jobRole !== "string" || !jobRole.trim()) {
      res.status(400).json({ error: "jobRole is required" });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("interviewer_groups")
      .insert({
        interviewer_id: user.id,
        job_role: jobRole.trim(),
        job_number: typeof jobNumber === "string" && jobNumber.trim() ? jobNumber.trim() : null,
      })
      .select("id, job_role, job_number, created_at")
      .single();

    if (error || !data) {
      res.status(500).json({ error: error?.message ?? "Failed to create group" });
      return;
    }

    res.status(201).json(data);
  },
);

export default router;
