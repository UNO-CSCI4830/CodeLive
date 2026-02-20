import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

const router = Router();

/** Extend Request to include the authenticated user. */
interface AuthRequest extends Request {
  user: User;
}

/* ------------------------------------------------------------------ */
/*  GET /api/profile — return the current user's profile              */
/* ------------------------------------------------------------------ */
router.get("/api/profile", requireAuth, async (req: Request, res: Response) => {
  const { user } = req as AuthRequest;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, name, role")
    .eq("id", user.id)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

/* ------------------------------------------------------------------ */
/*  PATCH /api/profile — update the current user's role (or name)     */
/* ------------------------------------------------------------------ */
router.patch(
  "/api/profile",
  requireAuth,
  async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const { role, name } = req.body as { role?: string; name?: string };

    /* Validate role if provided. */
    if (role && role !== "candidate" && role !== "interviewer") {
      res
        .status(400)
        .json({ error: 'Role must be "candidate" or "interviewer".' });
      return;
    }

    /* Build the update payload dynamically. */
    const updates: Record<string, string> = {};
    if (role) updates.role = role;
    if (name) updates.name = name;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nothing to update." });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select("id, name, role")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  }
);

export default router;
