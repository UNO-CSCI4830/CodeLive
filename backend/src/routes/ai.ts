/**
 * AI chat endpoint for the interview session assistant.
 *
 * POST /api/ai/chat
 * Body: { messages: { role: "system" | "user" | "assistant"; content: string }[] }
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

const router = Router();

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

router.post("/api/ai/chat", async (req: Request, res: Response) => {
  const { messages } = req.body as { messages?: ChatMessage[] };

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  console.log("[ai/chat] Anthropic key:", apiKey ? `set (${apiKey.length} chars)` : "MISSING — returning fallback");

  // No key configured — return offline hint so the frontend stays functional
  if (!apiKey) {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const hint = generateFallbackHint(lastUserMsg?.content ?? "");
    return res.json({ message: hint });
  }

  // Anthropic's API requires system content as a top-level string, not a
  // message role. Extract all system entries and join them.
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  // Only user/assistant turns go into the messages array
  const conversationTurns = messages.filter(
    (m): m is { role: "user" | "assistant"; content: string } =>
      m.role === "user" || m.role === "assistant",
  );

  if (conversationTurns.length === 0) {
    return res.status(400).json({ error: "No user messages provided" });
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      ...(systemText ? { system: systemText } : {}),
      messages: conversationTurns,
    });

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text
        : "I couldn't generate a response.";

    return res.json({ message: text });
  } catch (err) {
    console.error("[ai/chat] Anthropic error:", err);
    return res.status(500).json({ error: "AI service error" });
  }
});

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
