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
 */

import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

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

// ── POST /api/sessions/:sessionId/snapshots ───────────────────────────────

router.post(
  "/api/sessions/:sessionId/snapshots",
  async (req: Request, res: Response): Promise<void> => {
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
  async (req: Request, res: Response): Promise<void> => {
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
  async (req: Request, res: Response): Promise<void> => {
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

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    // No AI key — generate a structural fallback report
    const fallback = buildFallbackReport(problems, snapshotMap);
    await persistReport(sessionId, fallback);
    return;
  }

  try {
    const prompt = buildPrompt(problems, snapshotMap);
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const raw =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    const parsed = extractJSON(raw);
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
Only score AI-assistant usage (penalise requesting direct solutions, reward good debugging questions).

Respond ONLY with valid JSON matching exactly this schema – no markdown, no explanation:
{
  "overallSummary": "string",
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
    const rawMessages: Array<{ role: string; content: string }> = snap?.ai_messages ?? [];

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
    "\n\nReturn the JSON analysis now."
  );
}

function buildFallbackReport(
  problems: SessionProblemMeta[],
  snapshotMap: Map<number, Record<string, unknown>>,
) {
  return {
    overallSummary:
      "AI analysis is unavailable (no API key configured). " +
      "Code snapshots have been saved and are shown below.",
    strengths: ["Session completed successfully"],
    areasForImprovement: ["Configure ANTHROPIC_API_KEY for AI analysis"],
    problemSolvingProgression: "Unable to determine without AI analysis.",
    perQuestion: problems.map((p) => {
      const snap = snapshotMap.get(p.orderIndex) as
        | { code?: string; hints_used?: number }
        | undefined;
      return {
        orderIndex: p.orderIndex,
        title: p.title,
        correctness: "not_attempted" as const,
        codeAnalysis:
          snap?.code
            ? "Code was submitted but AI analysis is unavailable."
            : "No code was submitted for this problem.",
        approachQuality: "N/A — AI analysis unavailable",
        strengths: [],
        improvements: [],
      };
    }),
    aiUseScore: null as unknown as number,
    aiUseNotes: "AI analysis unavailable.",
  };
}

// ── Persistence helpers ───────────────────────────────────────────────────

async function persistReport(
  sessionId: string,
  report: ReturnType<typeof buildFallbackReport>,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("interview_reports")
    .update({
      status: "completed",
      overall_summary: report.overallSummary,
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

function extractJSON(raw: string): ReturnType<typeof buildFallbackReport> {
  // Strip any markdown fences the model may have added
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // If the model wrapped it, try to find the first { ... }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
    throw new Error(`Could not parse AI response as JSON. Raw: ${raw.slice(0, 200)}`);
  }
}

export default router;
