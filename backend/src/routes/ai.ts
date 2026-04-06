/**
 * AI chat endpoint for the interview session assistant.
 *
 * POST /api/ai/chat
 * Body: {
 *   sessionId,
 *   problemId,
 *   orderIndex,
 *   userMessage: { id, content, timestamp },
 *   messages: { role: "system" | "user" | "assistant"; content: string }[]
 * }
 *
 * Uses Anthropic Claude 3.5 Sonnet. The frontend sends a flat messages array
 * that may include system-role entries; this route extracts them into
 * Anthropic's top-level `system` parameter and passes only user/assistant
 * turns in the `messages` array (as required by the Anthropic Messages API).
 *
 * If ANTHROPIC_API_KEY is not set, a helpful offline fallback is returned.
 */

import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middleware/auth";

const router = Router();

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  sessionId?: string;
  problemId?: string;
  orderIndex?: number;
  userMessage?: {
    id?: string;
    content?: string;
    timestamp?: number;
  };
  messages?: ChatMessage[];
}

const GUARDRAIL_PROMPT =
  "You are an interview coding assistant. Never provide full solutions, complete final code, " +
  "or exact final query answers. Provide hints, debugging guidance, and conceptual nudges only.";

router.post("/api/ai/chat", requireAuth, async (req: Request, res: Response) => {
  const { messages, sessionId, problemId, orderIndex, userMessage } = req.body as ChatRequestBody;
  const authedUserId = (req as Request & { user?: { id: string } }).user?.id;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }
  if (!authedUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (messages.length === 0 || messages.length > 64) {
    return res.status(400).json({ error: "messages must contain 1-64 entries" });
  }
  if (!problemId || typeof problemId !== "string") {
    return res.status(400).json({ error: "problemId is required" });
  }
  if (!Number.isInteger(orderIndex) || (orderIndex as number) < 0) {
    return res.status(400).json({ error: "orderIndex must be a non-negative integer" });
  }
  const normalizedOrderIndex = orderIndex as number;

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("sessions")
    .select("id, status, candidate_id, ai_enabled")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return res.status(404).json({ error: "Session not found" });
  }
  if (session.ai_enabled === false) {
    return res.status(403).json({ error: "AI assistant is disabled for this session." });
  }
  if (session.status !== "active") {
    return res.status(409).json({ error: "Session is not active." });
  }
  if (session.candidate_id !== authedUserId) {
    return res.status(403).json({ error: "Only the candidate can send AI messages." });
  }

  const { data: sessionProblem, error: sessionProblemError } = await supabaseAdmin
    .from("session_problems")
    .select("problem_id")
    .eq("session_id", sessionId)
    .eq("order_index", normalizedOrderIndex)
    .maybeSingle();

  if (sessionProblemError || !sessionProblem) {
    return res.status(404).json({ error: "Session problem not found for orderIndex." });
  }
  if (sessionProblem.problem_id !== problemId) {
    return res.status(400).json({ error: "problemId does not match the selected session problem." });
  }

  const conversationTurns = messages.filter(
    (m): m is { role: "user" | "assistant"; content: string } =>
      m.role === "user" || m.role === "assistant",
  );

  if (conversationTurns.length === 0) {
    return res.status(400).json({ error: "No user messages provided" });
  }

  const lastUserTurn = [...conversationTurns].reverse().find((m) => m.role === "user");
  const userContent = (
    typeof userMessage?.content === "string" && userMessage.content.trim()
      ? userMessage.content.trim()
      : lastUserTurn?.content?.trim() ?? ""
  ).slice(0, 8000);

  if (!userContent) {
    return res.status(400).json({ error: "Last user message content is required" });
  }

  const userMessageId = (userMessage?.id?.trim() || `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`).slice(0, 120);
  const userTimestampMs = Number.isFinite(userMessage?.timestamp)
    ? Number(userMessage?.timestamp)
    : Date.now();

  try {
    await persistAiMessage({
      sessionId,
      orderIndex: normalizedOrderIndex,
      problemId,
      messageId: userMessageId,
      role: "user",
      content: userContent,
      timestampMs: userTimestampMs,
      sentByUserId: authedUserId,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: `Failed to persist user chat message: ${msg}` });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  console.log("[ai/chat] Anthropic key:", apiKey ? `set (${apiKey.length} chars)` : "MISSING — returning fallback");

  // No key configured — return offline hint so the frontend stays functional
  if (!apiKey) {
    const hint = generateFallbackHint(userContent);
    const assistantMessageId = `a_${userMessageId}`;
    const assistantTimestampMs = Date.now();

    try {
      await persistAiMessage({
        sessionId,
        orderIndex: normalizedOrderIndex,
        problemId,
        messageId: assistantMessageId,
        role: "assistant",
        content: hint,
        timestampMs: assistantTimestampMs,
        sentByUserId: null,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: `Failed to persist assistant chat message: ${msg}` });
    }

    return res.json({ message: hint, messageId: assistantMessageId, timestamp: assistantTimestampMs });
  }

  // Anthropic's API requires system content as a top-level string, not a
  // message role. Extract all system entries and join them.
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const guardedSystemText = [GUARDRAIL_PROMPT, systemText].filter(Boolean).join("\n\n");

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      ...(guardedSystemText ? { system: guardedSystemText } : {}),
      messages: conversationTurns,
    });

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text
        : "I couldn't generate a response.";

    const assistantMessageId = `a_${userMessageId}`;
    const assistantTimestampMs = Date.now();
    await persistAiMessage({
      sessionId,
      orderIndex: normalizedOrderIndex,
      problemId,
      messageId: assistantMessageId,
      role: "assistant",
      content: text,
      timestampMs: assistantTimestampMs,
      sentByUserId: null,
    });

    return res.json({ message: text, messageId: assistantMessageId, timestamp: assistantTimestampMs });
  } catch (err) {
    console.error("[ai/chat] Anthropic error:", err);
    const fallback =
      "AI service is temporarily unavailable. Ask me to break the problem down and I can still help with high-level hints.";
    const assistantMessageId = `a_${userMessageId}`;
    const assistantTimestampMs = Date.now();
    try {
      await persistAiMessage({
        sessionId,
        orderIndex: normalizedOrderIndex,
        problemId,
        messageId: assistantMessageId,
        role: "assistant",
        content: fallback,
        timestampMs: assistantTimestampMs,
        sentByUserId: null,
      });
      return res.json({
        message: fallback,
        messageId: assistantMessageId,
        timestamp: assistantTimestampMs,
      });
    } catch (persistError) {
      const msg = persistError instanceof Error ? persistError.message : String(persistError);
      return res.status(500).json({ error: `AI service error: ${msg}` });
    }
  }
});

interface PersistAiMessageInput {
  sessionId: string;
  orderIndex: number;
  problemId: string;
  messageId: string;
  role: "user" | "assistant";
  content: string;
  timestampMs: number;
  sentByUserId: string | null;
}

async function persistAiMessage(input: PersistAiMessageInput): Promise<void> {
  const occurredAtIso = new Date(
    Number.isFinite(input.timestampMs) ? input.timestampMs : Date.now(),
  ).toISOString();

  const { error } = await supabaseAdmin
    .from("session_ai_messages")
    .upsert(
      {
        session_id: input.sessionId,
        order_index: input.orderIndex,
        problem_id: input.problemId,
        message_id: input.messageId,
        role: input.role,
        content: input.content.slice(0, 8000),
        sent_by_user_id: input.sentByUserId,
        occurred_at: occurredAtIso,
      },
      { onConflict: "session_id,message_id" },
    );

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Generates a helpful fallback hint when no AI API key is configured.
 */
function generateFallbackHint(userQuestion: string): string {
  const q = userQuestion.toLowerCase();

  if (q.includes("hint") || q.includes("approach")) {
    return (
      "💡 **Hint:** Start by identifying the core data structure that fits the problem. " +
      "Consider whether you need a hash map for O(1) lookups, a stack/queue for ordering, " +
      "or a two-pointer technique for sorted arrays.\n\n" +
      "Try breaking the problem into smaller sub-problems first."
    );
  }

  if (q.includes("time complexity") || q.includes("complexity")) {
    return (
      "⏱️ **Time Complexity Analysis:**\n\n" +
      "- **O(n):** Single pass through the data\n" +
      "- **O(n log n):** Sorting-based approach\n" +
      "- **O(n²):** Nested loops (try to optimize)\n\n" +
      "Look at your loops: how many times does each run relative to input size?"
    );
  }

  if (q.includes("edge case") || q.includes("edge")) {
    return (
      "🔍 **Common Edge Cases to Consider:**\n\n" +
      "- Empty input (empty array, empty string)\n" +
      "- Single element\n" +
      "- All elements the same\n" +
      "- Negative numbers\n" +
      "- Very large inputs (integer overflow)\n" +
      "- Already sorted / reverse sorted"
    );
  }

  if (q.includes("data structure")) {
    return (
      "📦 **Common Data Structure Choices:**\n\n" +
      "- **Hash Map:** Fast lookups, counting, grouping\n" +
      "- **Stack:** LIFO, matching brackets, DFS\n" +
      "- **Queue:** FIFO, BFS, sliding window\n" +
      "- **Heap:** Top-K problems, priority scheduling\n" +
      "- **Trie:** Prefix matching, autocomplete\n\n" +
      "Which one matches your problem's access pattern?"
    );
  }

  if (q.includes("debug") || q.includes("wrong") || q.includes("error") || q.includes("fix")) {
    return (
      "🐛 **Debugging Tips:**\n\n" +
      "1. Add print statements to trace variable values\n" +
      "2. Walk through your code with the smallest test case by hand\n" +
      "3. Check off-by-one errors in loop bounds\n" +
      "4. Verify your base case for recursion\n" +
      "5. Make sure you're returning/updating the right variable"
    );
  }

  return (
    "🤔 Here are some general tips:\n\n" +
    "- **Understand the problem** fully before coding — restate it in your own words\n" +
    "- **Think about examples** — work through 2-3 examples by hand\n" +
    "- **Consider the brute force** first, then optimize\n" +
    "- **Communicate your thought process** — explain what you're thinking\n\n" +
    "*Note: AI service is running in offline mode. Ask about hints, data structures, " +
    "complexity, edge cases, or debugging for targeted advice.*"
  );
}

export default router;
