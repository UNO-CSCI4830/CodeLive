import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

/** Generate a short 6-character alphanumeric join code. */
function generateJoinCode(): string {
  return uuidv4().replace(/-/g, "").slice(0, 6).toUpperCase();
}

function safeTimeLimit(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return Math.floor(parsed);
}

function extractLastName(fullName: string): string | null {
  const parts = fullName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return null;
  return parts[parts.length - 1];
}

// ─── Create a new session ────────────────────────────────────────────
// POST /api/sessions
// Body: { interviewerId, aiEnabled, totalInterviewMinutes, problems: [{ problemId, category, timeLimit }] }
router.post(
  "/api/sessions",
  async (req: Request, res: Response): Promise<void> => {
    const { interviewerId, problems, aiEnabled, totalInterviewMinutes, groupId } = req.body;

    if (!interviewerId || !problems || !Array.isArray(problems) || problems.length === 0) {
      res.status(400).json({ error: "interviewerId and problems[] are required" });
      return;
    }

    if (aiEnabled != null && typeof aiEnabled !== "boolean") {
      res.status(400).json({ error: "aiEnabled must be a boolean when provided" });
      return;
    }

    if (
      totalInterviewMinutes != null
      && (!Number.isFinite(Number(totalInterviewMinutes)) || Number(totalInterviewMinutes) <= 0)
    ) {
      res.status(400).json({ error: "totalInterviewMinutes must be a positive number when provided" });
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

    const totalTimeLimitMinutes = problems.reduce(
      (sum: number, p: { timeLimit?: number }) => sum + safeTimeLimit(p?.timeLimit),
      0,
    );
    const explicitTotalMinutes = totalInterviewMinutes != null
      ? Math.floor(Number(totalInterviewMinutes))
      : null;

    let validatedGroupId: string | null = null;
    if (groupId != null) {
      const groupIdValue = String(groupId).trim();
      if (groupIdValue.length > 0) {
        const { data: group, error: groupError } = await supabaseAdmin
          .from("interviewer_groups")
          .select("id, interviewer_id")
          .eq("id", groupIdValue)
          .maybeSingle();

        if (groupError || !group || group.interviewer_id !== interviewerId) {
          res.status(400).json({ error: "Invalid group selection for interviewer." });
          return;
        }

        validatedGroupId = group.id;
      }
    }

    // Create the session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        interviewer_id: interviewerId,
        join_code: joinCode,
        ai_enabled: aiEnabled ?? true,
        group_id: validatedGroupId,
        total_time_limit_minutes: explicitTotalMinutes ?? totalTimeLimitMinutes,
        timer_paused: false,
        timer_paused_seconds: 0,
        timer_paused_at: null,
        current_question_started_at: new Date().toISOString(),
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
        time_limit: safeTimeLimit(p.timeLimit),
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

    const { data: candidateProfile } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", candidateId)
      .maybeSingle();
    const candidateName = candidateProfile?.name?.trim() || "Candidate";
    const candidateLastName = extractLastName(candidateName);

    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(candidateId);
    const candidateEmail = authUserData?.user?.email?.trim() || null;

    // Assign candidate and activate
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("sessions")
      .update({
        candidate_id: candidateId,
        candidate_name: candidateName,
        candidate_last_name: candidateLastName,
        candidate_email: candidateEmail,
        status: "active",
        started_at: new Date().toISOString(),
        current_question_started_at: new Date().toISOString(),
        timer_paused: false,
        timer_paused_seconds: 0,
        timer_paused_at: null,
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
      const nowMs = Date.now();
      const pausedAtMs = session.timer_paused_at
        ? new Date(session.timer_paused_at).getTime()
        : nowMs;
      const elapsedPausedSeconds = session.timer_paused
        ? Math.max(Math.floor((nowMs - pausedAtMs) / 1000), 0)
        : 0;
      const finalPausedSeconds = (session.timer_paused_seconds ?? 0) + elapsedPausedSeconds;

      // All questions done — mark session complete
      await supabaseAdmin
        .from("sessions")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          timer_paused: false,
          timer_paused_at: null,
          timer_paused_seconds: finalPausedSeconds,
        })
        .eq("id", sessionId);

      res.json({ status: "completed", currentIndex: session.current_index });
      return;
    }

    // Advance
    const { data: updated } = await supabaseAdmin
      .from("sessions")
      .update({
        current_index: nextIndex,
      })
      .eq("id", sessionId)
      .select()
      .single();

    res.json({
      status: updated?.status,
      currentIndex: updated?.current_index,
    });
  },
);

// ─── Jump to a specific question index (shared between both users) ───────
// POST /api/sessions/:sessionId/select
// Body: { index: number }
router.post(
  "/api/sessions/:sessionId/select",
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    const index = Number(req.body?.index);

    if (!Number.isInteger(index) || index < 0) {
      res.status(400).json({ error: "index must be a non-negative integer" });
      return;
    }

    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("id, status, problems:session_problems(id)")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const totalProblems = session.problems?.length ?? 0;
    if (index >= totalProblems) {
      res.status(400).json({ error: "index out of range" });
      return;
    }

    if (session.status !== "active" && session.status !== "waiting") {
      res.status(400).json({ error: "Session is not editable" });
      return;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("sessions")
      .update({ current_index: index })
      .eq("id", sessionId)
      .select("current_index")
      .single();

    if (error || !updated) {
      res.status(500).json({ error: error?.message ?? "Failed to switch question" });
      return;
    }

    res.json({ currentIndex: updated.current_index });
  },
);

// ─── Pause shared interview timer ─────────────────────────────────────────
// POST /api/sessions/:sessionId/timer/pause
router.post(
  "/api/sessions/:sessionId/timer/pause",
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;

    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("id, status, timer_paused, timer_paused_seconds, timer_paused_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (session.status !== "active") {
      res.status(400).json({ error: "Only active sessions can pause the timer" });
      return;
    }

    if (session.timer_paused) {
      res.json({
        timerPaused: true,
        timerPausedAt: session.timer_paused_at,
        timerPausedSeconds: session.timer_paused_seconds ?? 0,
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error } = await supabaseAdmin
      .from("sessions")
      .update({
        timer_paused: true,
        timer_paused_at: nowIso,
      })
      .eq("id", sessionId)
      .select("timer_paused, timer_paused_at, timer_paused_seconds")
      .single();

    if (error || !updated) {
      res.status(500).json({ error: error?.message ?? "Failed to pause timer" });
      return;
    }

    res.json({
      timerPaused: updated.timer_paused,
      timerPausedAt: updated.timer_paused_at,
      timerPausedSeconds: updated.timer_paused_seconds ?? 0,
    });
  },
);

// ─── Resume shared interview timer ────────────────────────────────────────
// POST /api/sessions/:sessionId/timer/resume
router.post(
  "/api/sessions/:sessionId/timer/resume",
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;

    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("id, status, timer_paused, timer_paused_seconds, timer_paused_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (session.status !== "active") {
      res.status(400).json({ error: "Only active sessions can resume the timer" });
      return;
    }

    if (!session.timer_paused) {
      res.json({
        timerPaused: false,
        timerPausedAt: null,
        timerPausedSeconds: session.timer_paused_seconds ?? 0,
      });
      return;
    }

    const nowMs = Date.now();
    const pausedAtMs = session.timer_paused_at ? new Date(session.timer_paused_at).getTime() : nowMs;
    const elapsedPausedSeconds = Math.max(Math.floor((nowMs - pausedAtMs) / 1000), 0);
    const nextPausedSeconds = (session.timer_paused_seconds ?? 0) + elapsedPausedSeconds;

    const { data: updated, error } = await supabaseAdmin
      .from("sessions")
      .update({
        timer_paused: false,
        timer_paused_at: null,
        timer_paused_seconds: nextPausedSeconds,
      })
      .eq("id", sessionId)
      .select("timer_paused, timer_paused_at, timer_paused_seconds")
      .single();

    if (error || !updated) {
      res.status(500).json({ error: error?.message ?? "Failed to resume timer" });
      return;
    }

    res.json({
      timerPaused: updated.timer_paused,
      timerPausedAt: updated.timer_paused_at,
      timerPausedSeconds: updated.timer_paused_seconds ?? nextPausedSeconds,
    });
  },
);

// ─── End session ─────────────────────────────────────────────────────
// POST /api/sessions/:sessionId/end
router.post(
  "/api/sessions/:sessionId/end",
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("timer_paused, timer_paused_at, timer_paused_seconds")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const nowMs = Date.now();
    const pausedAtMs = session.timer_paused_at ? new Date(session.timer_paused_at).getTime() : nowMs;
    const elapsedPausedSeconds =
      session.timer_paused ? Math.max(Math.floor((nowMs - pausedAtMs) / 1000), 0) : 0;
    const finalPausedSeconds = (session.timer_paused_seconds ?? 0) + elapsedPausedSeconds;

    const { error } = await supabaseAdmin
      .from("sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        timer_paused: false,
        timer_paused_at: null,
        timer_paused_seconds: finalPausedSeconds,
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
