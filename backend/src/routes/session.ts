import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

/** Generate a short 6-character alphanumeric join code. */
function generateJoinCode(): string {
  return uuidv4().replace(/-/g, "").slice(0, 6).toUpperCase();
}

// ─── Create a new session ────────────────────────────────────────────
// POST /api/sessions
// Body: { interviewerId, problems: [{ problemId, category, timeLimit }] }
router.post(
  "/api/sessions",
  async (req: Request, res: Response): Promise<void> => {
    const { interviewerId, problems } = req.body;

    if (!interviewerId || !problems || !Array.isArray(problems) || problems.length === 0) {
      res.status(400).json({ error: "interviewerId and problems[] are required" });
      return;
    }

    // Generate a unique join code (retry on collision)
    let joinCode = generateJoinCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await supabaseAdmin
        .from("sessions")
        .select("id")
        .eq("join_code", joinCode)
        .maybeSingle();

      if (!existing) break;
      joinCode = generateJoinCode();
      attempts++;
    }

    // Create the session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        interviewer_id: interviewerId,
        join_code: joinCode,
        status: "waiting",
        current_index: 0,
      })
      .select()
      .single();

    if (sessionError || !session) {
      res.status(500).json({ error: sessionError?.message ?? "Failed to create session" });
      return;
    }

    // Insert session problems in order
    const problemRows = problems.map(
      (p: { problemId: string; category: string; timeLimit: number }, i: number) => ({
        session_id: session.id,
        problem_id: p.problemId,
        category: p.category,
        time_limit: p.timeLimit ?? 30,
        order_index: i,
      }),
    );

    const { error: problemsError } = await supabaseAdmin
      .from("session_problems")
      .insert(problemRows);

    if (problemsError) {
      // Clean up the session if problems fail
      await supabaseAdmin.from("sessions").delete().eq("id", session.id);
      res.status(500).json({ error: problemsError.message });
      return;
    }

    res.status(201).json({
      sessionId: session.id,
      joinCode: session.join_code,
      status: session.status,
    });
  },
);

// ─── Join a session (candidate) ──────────────────────────────────────
// POST /api/sessions/join
// Body: { joinCode, candidateId }
router.post(
  "/api/sessions/join",
  async (req: Request, res: Response): Promise<void> => {
    const { joinCode, candidateId } = req.body;

    if (!joinCode || !candidateId) {
      res.status(400).json({ error: "joinCode and candidateId are required" });
      return;
    }

    const code = joinCode.toUpperCase().trim();

    // Find the session
    const { data: session, error: findError } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("join_code", code)
      .maybeSingle();

    if (findError || !session) {
      res.status(404).json({ error: "Session not found. Check the join code." });
      return;
    }

    if (session.status !== "waiting") {
      res.status(400).json({ error: "This session is no longer accepting participants." });
      return;
    }

    if (session.interviewer_id === candidateId) {
      res.status(400).json({ error: "You cannot join your own session as a candidate." });
      return;
    }

    // Assign candidate and activate
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("sessions")
      .update({
        candidate_id: candidateId,
        status: "active",
        started_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .select()
      .single();

    if (updateError || !updated) {
      res.status(500).json({ error: updateError?.message ?? "Failed to join session" });
      return;
    }

    res.json({
      sessionId: updated.id,
      status: updated.status,
    });
  },
);

// ─── Get session details ─────────────────────────────────────────────
// GET /api/sessions/:sessionId
router.get(
  "/api/sessions/:sessionId",
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;

    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    if (error || !session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Fetch problems for this session
    const { data: problems } = await supabaseAdmin
      .from("session_problems")
      .select("*")
      .eq("session_id", sessionId)
      .order("order_index", { ascending: true });

    res.json({ ...session, problems: problems ?? [] });
  },
);

// ─── Advance to next question ────────────────────────────────────────
// POST /api/sessions/:sessionId/advance
router.post(
  "/api/sessions/:sessionId/advance",
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;

    // Get current session
    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("*, problems:session_problems(*)")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const totalProblems = session.problems?.length ?? 0;
    const nextIndex = session.current_index + 1;

    if (nextIndex >= totalProblems) {
      // All questions done — mark session complete
      await supabaseAdmin
        .from("sessions")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      res.json({ status: "completed", currentIndex: session.current_index });
      return;
    }

    // Lock the current problem
    await supabaseAdmin
      .from("session_problems")
      .update({ locked: true })
      .eq("session_id", sessionId)
      .eq("order_index", session.current_index);

    // Advance
    const { data: updated } = await supabaseAdmin
      .from("sessions")
      .update({ current_index: nextIndex })
      .eq("id", sessionId)
      .select()
      .single();

    res.json({
      status: updated?.status,
      currentIndex: updated?.current_index,
    });
  },
);

// ─── Lock a problem (timer expired) ─────────────────────────────────
// POST /api/sessions/:sessionId/lock/:orderIndex
router.post(
  "/api/sessions/:sessionId/lock/:orderIndex",
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId, orderIndex } = req.params;

    const { error } = await supabaseAdmin
      .from("session_problems")
      .update({ locked: true })
      .eq("session_id", sessionId)
      .eq("order_index", parseInt(orderIndex, 10));

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ locked: true });
  },
);

// ─── End session ─────────────────────────────────────────────────────
// POST /api/sessions/:sessionId/end
router.post(
  "/api/sessions/:sessionId/end",
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;

    const { error } = await supabaseAdmin
      .from("sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ status: "completed" });
  },
);

export default router;
