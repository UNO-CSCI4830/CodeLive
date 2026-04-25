/**
 * Interview report endpoints.
 *
 * POST /api/sessions/:sessionId/snapshots
 *   Save final code snapshots for all problems at session end.
 *   Body: SnapshotPayload[]
 *
 * POST /api/sessions/:sessionId/report/generate
 *   Triggers async AI analysis. Creates a 'pending' report row immediately,
 *   fires off the Anthropic call in the background, and returns { reportId }.
 *   Body: { problems: SessionProblemMeta[] }
 *
 * GET /api/sessions/:sessionId/report
 *   Returns the current report row (status + data once complete).
 *
 * GET /api/sessions/:sessionId/ai-log
 *   Returns persisted AI chat messages grouped by problem order.
 */

import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

// ── Shared helper: verify the caller is a session participant ─────────────

async function requireSessionParticipant(
  req: Request,
  res: Response,
): Promise<boolean> {
  const { user } = req as AuthRequest;
  const { sessionId } = req.params;

  const { data: session } = await supabaseAdmin
    .from("sessions")
    .select("interviewer_id, candidate_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return false;
  }

  if (session.interviewer_id !== user.id && session.candidate_id !== user.id) {
    res.status(403).json({ error: "You are not a participant in this session" });
    return false;
  }

  return true;
}

// ── Types ─────────────────────────────────────────────────────────────────

interface SnapshotPayload {
  orderIndex: number;
  problemId: string;
  category: string;
  code: string;
  language: string;
  hintsUsed: number;
  aiMessages: Array<{ role: string; content: string; timestamp: number }>;
}

interface SessionProblemMeta {
  orderIndex: number;
  problemId: string;
  category: string;
  title: string;
  description: string;
  timeLimit: number; // minutes
}

interface GenerateReportBody {
  problems: SessionProblemMeta[];
}

interface AiLogRow {
  order_index: number;
  problem_id: string;
  message_id: string;
  role: "user" | "assistant";
  content: string;
  occurred_at: string;
  created_at?: string;
}

type Correctness = "correct" | "partial" | "incorrect" | "not_attempted";

interface PerQuestionReport {
  orderIndex: number;
  title: string;
  correctness: Correctness;
  codeAnalysis: string;
  approachQuality: string;
  strengths: string[];
  improvements: string[];
}

interface GeneratedReport {
  overallSummary: string;
  overallScore: number; // 1.0–10.0, one decimal place
  strengths: string[];
  areasForImprovement: string[];
  problemSolvingProgression: string;
  perQuestion: PerQuestionReport[];
  aiUseScore: number | null;
  aiUseNotes: string;
}

// ── POST /api/sessions/:sessionId/snapshots ───────────────────────────────

router.post(
  "/api/sessions/:sessionId/snapshots",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!(await requireSessionParticipant(req, res))) return;

    const { sessionId } = req.params;
    const snapshots: SnapshotPayload[] = req.body;

    if (!Array.isArray(snapshots) || snapshots.length === 0) {
      res.status(400).json({ error: "snapshots array is required" });
      return;
    }

    const rows = snapshots.map((s) => ({
      session_id: sessionId,
      order_index: s.orderIndex,
      problem_id: s.problemId,
      category: s.category,
      code: s.code,
      language: s.language,
      hints_used: s.hintsUsed,
      ai_messages: s.aiMessages,
    }));

    const { error } = await supabaseAdmin
      .from("code_snapshots")
      .upsert(rows, { onConflict: "session_id,order_index" });

    if (error) {
      console.error("[report/snapshots] save error:", error.message);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ saved: rows.length });
  },
);

// ── POST /api/sessions/:sessionId/report/generate ────────────────────────

router.post(
  "/api/sessions/:sessionId/report/generate",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!(await requireSessionParticipant(req, res))) return;

    const { sessionId } = req.params;
    const { problems } = req.body as GenerateReportBody;

    if (!problems || !Array.isArray(problems)) {
      res.status(400).json({ error: "problems[] is required" });
      return;
    }

    // Upsert a 'pending' row so the frontend can poll immediately
    const { data: report, error: insertError } = await supabaseAdmin
      .from("interview_reports")
      .upsert({ session_id: sessionId, status: "pending" }, { onConflict: "session_id" })
      .select()
      .single();

    if (insertError || !report) {
      console.error("[report/generate] create error:", insertError?.message);
      res.status(500).json({ error: insertError?.message ?? "Failed to create report" });
      return;
    }

    // Respond immediately — analysis runs in the background
    res.json({ reportId: report.id });

    // ── Background generation ───────────────────────────────────────────
    generateReportInBackground(sessionId, problems).catch((err) => {
      console.error("[report/generate] background error:", err);
    });
  },
);

// ── GET /api/sessions/:sessionId/report ──────────────────────────────────

router.get(
  "/api/sessions/:sessionId/report",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!(await requireSessionParticipant(req, res))) return;

    const { sessionId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("interview_reports")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    res.json(data);
  },
);

// ── GET /api/sessions/:sessionId/ai-log ──────────────────────────────────

router.get(
  "/api/sessions/:sessionId/ai-log",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!(await requireSessionParticipant(req, res))) return;

    const { sessionId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("session_ai_messages")
      .select("order_index, problem_id, message_id, role, content, occurred_at, created_at")
      .eq("session_id", sessionId)
      .order("order_index", { ascending: true })
      .order("occurred_at", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const rows = (data ?? []) as AiLogRow[];
    const messages = rows.map((row) => ({
      orderIndex: row.order_index,
      problemId: row.problem_id,
      messageId: row.message_id,
      role: row.role,
      content: row.content,
      timestamp: new Date(row.occurred_at).getTime(),
    }));

    res.json({ messages });
  },
);

// ── Background generation helper ─────────────────────────────────────────

async function generateReportInBackground(
  sessionId: string,
  problems: SessionProblemMeta[],
): Promise<void> {
  // Mark as generating
  await supabaseAdmin
    .from("interview_reports")
    .update({ status: "generating" })
    .eq("session_id", sessionId);

  // Fetch the stored snapshots for this session
  const { data: snapshots, error: snapError } = await supabaseAdmin
    .from("code_snapshots")
    .select("*")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true });

  if (snapError) {
    await markFailed(sessionId, `Failed to fetch snapshots: ${snapError.message}`);
    return;
  }

  const snapshotMap = new Map(
    (snapshots ?? []).map((s: { order_index: number; [key: string]: unknown }) => [s.order_index, s]),
  );
  const aiLogMap = await loadAiLogMap(sessionId);

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    // No AI key — generate a structural fallback report
    const fallback = buildFallbackReport(problems, snapshotMap);
    await persistReport(sessionId, fallback);
    return;
  }

  try {
    const prompt = buildPrompt(problems, snapshotMap, aiLogMap);
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const raw =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    const parsed = extractJSON(raw, problems);
    await persistReport(sessionId, parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[report/generate] Anthropic error:", msg);

    // Fallback so the page still renders something useful
    const fallback = buildFallbackReport(problems, snapshotMap);
    await persistReport(sessionId, fallback);
  }
}

// ── Prompt builders ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert technical interviewer reviewing a live coding interview.
Analyse the candidate's performance objectively. Do NOT recommend hiring or not hiring.
Score strictly from the submitted code and problem context.
For overallScore, weight:
- 60%: correctness/completeness across all problems
- 25%: code quality, robustness, and edge-case handling
- 15%: efficiency/optimality
Use one decimal place (x.x), between 1.0 and 10.0.
Only score AI-assistant usage separately (penalise requesting direct solutions, reward good debugging questions).

Respond ONLY with valid JSON matching exactly this schema – no markdown, no explanation:
{
  "overallSummary": "string",
  "overallScore": 7.4,
  "strengths": ["string"],
  "areasForImprovement": ["string"],
  "problemSolvingProgression": "string",
  "perQuestion": [
    {
      "orderIndex": 0,
      "title": "string",
      "correctness": "correct|partial|incorrect|not_attempted",
      "codeAnalysis": "string",
      "approachQuality": "string",
      "strengths": ["string"],
      "improvements": ["string"]
    }
  ],
  "aiUseScore": 8,
  "aiUseNotes": "string"
}`;

function buildPrompt(
  problems: SessionProblemMeta[],
  snapshotMap: Map<number, Record<string, unknown>>,
  aiLogMap: Map<number, Array<{ role: "user" | "assistant"; content: string }>>,
): string {
  const sections = problems.map((p) => {
    const snap = snapshotMap.get(p.orderIndex) as
      | {
          code?: string;
          hints_used?: number;
          ai_messages?: Array<{ role: string; content: string }>;
        }
      | undefined;

    const code = (snap?.code ?? "(no code submitted)").slice(0, 900);
    const hintsUsed = snap?.hints_used ?? 0;
    const snapshotMessages = (snap?.ai_messages ?? []).filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    );
    const rawMessages: Array<{ role: "user" | "assistant"; content: string }> =
      snapshotMessages.length > 0
        ? snapshotMessages
        : aiLogMap.get(p.orderIndex) ?? [];

    // Summarise AI messages: count totals + flag solution requests
    const userMsgs = rawMessages.filter((m) => m.role === "user");
    const directSolutionKeywords = /give me (the |a )?(solution|answer|code)|just (write|code|implement|solve)|what('s| is) the (solution|answer)/i;
    const solutionRequests = userMsgs.filter((m) =>
      directSolutionKeywords.test(m.content),
    ).length;
    const aiSummary =
      userMsgs.length === 0
        ? "Did not use AI assistant."
        : `Asked ${userMsgs.length} question(s) total.${solutionRequests > 0 ? ` ⚠ Requested direct solution ${solutionRequests} time(s).` : ""} Sample questions: ${userMsgs
            .slice(0, 3)
            .map((m) => `"${m.content.slice(0, 80)}"`)
            .join("; ")}`;

    const descSnippet = p.description.slice(0, 200);

    return `--- Problem ${p.orderIndex + 1}: ${p.title} [${p.category}] ---
Description (excerpt): ${descSnippet}
Time limit: ${p.timeLimit} min
Hints revealed: ${hintsUsed}
AI usage: ${aiSummary}

Final code (${snap?.code ? p.category === "leetcode" ? "Python" : "mixed" : "none"}):
\`\`\`
${code}
\`\`\``;
  });

  return (
    `Analyse this ${problems.length}-problem coding interview.\n\n` +
    sections.join("\n\n") +
    "\n\nReturn the JSON analysis now. overallScore must reflect actual submitted code quality and correctness."
  );
}

async function loadAiLogMap(
  sessionId: string,
): Promise<Map<number, Array<{ role: "user" | "assistant"; content: string }>>> {
  const { data, error } = await supabaseAdmin
    .from("session_ai_messages")
    .select("order_index, role, content, occurred_at, created_at")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true })
    .order("occurred_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[report] failed to load AI logs:", error.message);
    return new Map();
  }

  const map = new Map<number, Array<{ role: "user" | "assistant"; content: string }>>();
  for (const row of (data ?? []) as Array<{
    order_index: number;
    role: string;
    content: string;
  }>) {
    if (!(row.role === "user" || row.role === "assistant")) continue;
    const existing = map.get(row.order_index) ?? [];
    existing.push({ role: row.role, content: row.content });
    map.set(row.order_index, existing);
  }
  return map;
}

function toOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normaliseCorrectness(input: unknown): Correctness {
  if (
    input === "correct"
    || input === "partial"
    || input === "incorrect"
    || input === "not_attempted"
  ) {
    return input;
  }
  return "not_attempted";
}

function normaliseStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 10);
}

function scoreFromPerQuestion(perQuestion: PerQuestionReport[]): number {
  if (perQuestion.length === 0) return 1.0;

  const perItem: number[] = perQuestion.map((q) => {
    if (q.correctness === "correct") return 1.0;
    if (q.correctness === "partial") return 0.6;
    if (q.correctness === "incorrect") return 0.25;
    return 0;
  });
  const avg = perItem.reduce((sum, item) => sum + item, 0) / perItem.length;
  return toOneDecimal(clamp(avg * 10, 1, 10));
}

function normaliseReport(input: unknown, problems: SessionProblemMeta[]): GeneratedReport {
  const value = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const rawPerQuestion = Array.isArray(value.perQuestion) ? value.perQuestion : [];

  const perQuestion: PerQuestionReport[] = problems.map((problem, idx) => {
    const row =
      rawPerQuestion.find((candidate) => {
        const candidateObj = candidate as Record<string, unknown>;
        return Number(candidateObj.orderIndex) === problem.orderIndex;
      }) ?? rawPerQuestion[idx] ?? {};
    const rowObj = row as Record<string, unknown>;

    return {
      orderIndex: problem.orderIndex,
      title: String(rowObj.title ?? problem.title).trim() || problem.title,
      correctness: normaliseCorrectness(rowObj.correctness),
      codeAnalysis:
        String(rowObj.codeAnalysis ?? "No detailed analysis available.").trim()
        || "No detailed analysis available.",
      approachQuality:
        String(rowObj.approachQuality ?? "No approach notes available.").trim()
        || "No approach notes available.",
      strengths: normaliseStringArray(rowObj.strengths),
      improvements: normaliseStringArray(rowObj.improvements),
    };
  });

  const derivedOverall = scoreFromPerQuestion(perQuestion);
  const parsedOverall = Number(value.overallScore);
  const overallScore = Number.isFinite(parsedOverall)
    ? toOneDecimal(clamp(parsedOverall, 1, 10))
    : derivedOverall;

  const parsedAiUse = Number(value.aiUseScore);
  const aiUseScore = Number.isFinite(parsedAiUse)
    ? Math.round(clamp(parsedAiUse, 1, 10))
    : null;

  return {
    overallSummary:
      String(value.overallSummary ?? "").trim()
      || "No summary was generated for this session.",
    overallScore,
    strengths: normaliseStringArray(value.strengths),
    areasForImprovement: normaliseStringArray(value.areasForImprovement),
    problemSolvingProgression:
      String(value.problemSolvingProgression ?? "").trim()
      || "No progression notes were generated.",
    perQuestion,
    aiUseScore,
    aiUseNotes:
      String(value.aiUseNotes ?? "").trim()
      || "No AI usage notes were generated.",
  };
}

function buildFallbackReport(
  problems: SessionProblemMeta[],
  snapshotMap: Map<number, Record<string, unknown>>,
): GeneratedReport {
  const perQuestion: PerQuestionReport[] = problems.map((p) => {
    const snap = snapshotMap.get(p.orderIndex) as
      | { code?: string; hints_used?: number }
      | undefined;
    const hasCode = typeof snap?.code === "string" && snap.code.trim().length > 0;
    return {
      orderIndex: p.orderIndex,
      title: p.title,
      correctness: hasCode ? "partial" : "not_attempted",
      codeAnalysis: hasCode
        ? "Code was submitted but AI analysis is unavailable."
        : "No code was submitted for this problem.",
      approachQuality: "N/A — AI analysis unavailable",
      strengths: [],
      improvements: [],
    };
  });

  return {
    overallSummary:
      "AI analysis is unavailable (no API key configured). " +
      "Code snapshots have been saved and are shown below.",
    overallScore: scoreFromPerQuestion(perQuestion),
    strengths: ["Session completed successfully"],
    areasForImprovement: ["Configure ANTHROPIC_API_KEY for AI analysis"],
    problemSolvingProgression: "Unable to determine without AI analysis.",
    perQuestion,
    aiUseScore: null,
    aiUseNotes: "AI analysis unavailable.",
  };
}

// ── Persistence helpers ───────────────────────────────────────────────────

async function persistReport(
  sessionId: string,
  report: GeneratedReport,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("interview_reports")
    .update({
      status: "completed",
      overall_summary: report.overallSummary,
      overall_score: report.overallScore,
      strengths: report.strengths,
      areas_for_improvement: report.areasForImprovement,
      per_question: report.perQuestion,
      ai_use_score: report.aiUseScore,
      ai_use_notes: report.aiUseNotes,
      generated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  if (error) {
    console.error("[report/persist] update error:", error.message);
  }
}

async function markFailed(sessionId: string, message: string): Promise<void> {
  await supabaseAdmin
    .from("interview_reports")
    .update({ status: "failed", error_message: message })
    .eq("session_id", sessionId);
}

// ── JSON extraction ───────────────────────────────────────────────────────

function extractJSON(
  raw: string,
  problems: SessionProblemMeta[],
): GeneratedReport {
  // Strip any markdown fences the model may have added
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return normaliseReport(JSON.parse(cleaned), problems);
  } catch {
    // If the model wrapped it, try to find the first { ... }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return normaliseReport(JSON.parse(match[0]), problems);
      } catch {
        /* fall through */
      }
    }
    throw new Error(`Could not parse AI response as JSON. Raw: ${raw.slice(0, 200)}`);
  }
}

export default router;
