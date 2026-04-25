/**
 * AIAssistant — a sliding drawer panel for the interview session.
 *
 * Rendered on the far-left edge of the session layout.
 * A 36px tab is visible when collapsed; clicking it slides the panel in/out.
 *
 * Chat is collaborative per problem (interviewer + candidate see the same log).
 * Only the candidate can send messages; interviewer view is read-only.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Bot, Send, Loader2, Lightbulb, Sparkles, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { apiFetch } from "@/lib/apiClient";
import {
  useCollaborativeChat,
  type CollaborativeChatMessage,
} from "../hooks/useCollaborativeChat";
import "./AIAssistant.css";

export interface AIAssistantHandle {
  /** Returns a snapshot of all messages in the current conversation. */
  getMessages: () => CollaborativeChatMessage[];
}

interface Props {
  sessionId: string;
  problemId: string;
  orderIndex: number;
  canSend: boolean;
  /** Current problem title */
  problemTitle: string;
  /** Current problem description */
  problemDescription: string;
  /** Current code in the editor — snapshot captured at send-time via ref */
  currentCode: string;
  /** Language for context */
  language: string;
  /** Whether the panel is locked (problem expired) */
  locked?: boolean;
  /**
   * Unique key for the current question, e.g. `"${orderIndex}:${problemId}"`.
   * The conversation resets whenever this changes.
   */
  problemKey: string;
}

const SYSTEM_PROMPT = `You are a helpful coding interview assistant. Your role is to:
- Provide hints and guide the candidate toward the solution
- Explain concepts when asked
- Point out potential issues in their approach
- NEVER provide complete solutions or write full code implementations
- Keep responses concise and focused
- Use encouraging and supportive language
- If asked for the solution directly, instead provide a hint about the approach

You are helping with a coding interview problem.`;

const AIAssistant = forwardRef<AIAssistantHandle, Props>(function AIAssistant(
  {
    sessionId,
    problemId,
    orderIndex,
    canSend,
    problemTitle,
    problemDescription,
    currentCode,
    language,
    locked,
    problemKey,
  },
  ref,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Track whether we're actively streaming (show cursor) vs just loading
  const [streaming, setStreaming] = useState(false);
  // Local buffer for streaming content — avoids hammering Yjs on every token
  const [streamingContent, setStreamingContent] = useState("");
  const streamingIdRef = useRef<string | null>(null);

  const roomName = `session:${sessionId}:q:${orderIndex}:ai`;
  const { messages, appendMessage } = useCollaborativeChat({ roomName });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Expose conversation snapshot to parent (e.g. to capture at session end)
  useImperativeHandle(ref, () => ({
    getMessages: () => messages,
  }));

  // Keep currentCode in a ref so sendMessage reads the latest value without
  // being re-created on every keystroke.
  const currentCodeRef = useRef(currentCode);
  useEffect(() => {
    currentCodeRef.current = currentCode;
  }, [currentCode]);

  // Reset conversation when the question changes — keep drawer closed
  useEffect(() => {
    setInput("");
    setLoading(false);
    setStreaming(false);
    setStreamingContent("");
    setIsOpen(false);
  }, [problemKey]);

  // Auto-scroll to newest message (including during streaming)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const generateId = () =>
    `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || locked || !canSend) return;

    const userMsg: CollaborativeChatMessage = {
      id: generateId(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    appendMessage(userMsg);
    setInput("");
    setLoading(true);
    setStreaming(false);
    setStreamingContent("");
    streamingIdRef.current = null;

    try {
      const conversation = [
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: trimmed },
      ];

      const contextMessages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        {
          role: "system" as const,
          content:
            `Current problem: "${problemTitle}"\n` +
            `Description: ${problemDescription}\n` +
            `Language: ${language}\n\n` +
            `Candidate's current code:\n\`\`\`${language}\n${currentCodeRef.current}\n\`\`\``,
        },
        ...conversation,
      ];

      const res = await apiFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          problemId,
          orderIndex,
          userMessage: {
            id: userMsg.id,
            content: userMsg.content,
            timestamp: userMsg.timestamp,
          },
          messages: contextMessages,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "AI service unavailable");
      }

      const contentType = res.headers.get("content-type") ?? "";

      // ── SSE streaming path ──
      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantId = generateId();
        let assistantTimestamp = Date.now();
        let accumulated = "";

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last partial line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6);
            let parsed: { type: string; text?: string; messageId?: string; timestamp?: number; error?: string };
            try {
              parsed = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            if (parsed.type === "meta") {
              assistantId = parsed.messageId ?? assistantId;
              assistantTimestamp = parsed.timestamp ?? assistantTimestamp;
            } else if (parsed.type === "delta") {
              accumulated += parsed.text ?? "";
              if (!streaming) {
                streamingIdRef.current = assistantId;
                setStreaming(true);
              }
              // Update local state only — fast, no Yjs overhead per token
              setStreamingContent(accumulated);
            } else if (parsed.type === "done") {
              // Commit the final message to Yjs so the interviewer sees it
              appendMessage({
                id: assistantId,
                role: "assistant",
                content: accumulated,
                timestamp: assistantTimestamp,
              });
              streamingIdRef.current = null;
              setStreamingContent("");
            } else if (parsed.type === "error") {
              appendMessage({
                id: assistantId,
                role: "assistant",
                content: accumulated || parsed.error || "An error occurred.",
                timestamp: assistantTimestamp,
              });
              streamingIdRef.current = null;
              setStreamingContent("");
            }
          }
        }

        // Safety net — if we never got a "done" event, commit what we have
        if (streamingIdRef.current && accumulated) {
          appendMessage({
            id: assistantId,
            role: "assistant",
            content: accumulated,
            timestamp: assistantTimestamp,
          });
          streamingIdRef.current = null;
          setStreamingContent("");
        }

        if (!accumulated) {
          appendMessage({
            id: assistantId,
            role: "assistant",
            content: "I couldn't generate a response. Try again.",
            timestamp: assistantTimestamp,
          });
        }
      } else {
        // ── Non-streaming JSON fallback (e.g. offline mode) ──
        const data = await res.json();
        appendMessage({
          id: typeof data.messageId === "string" && data.messageId ? data.messageId : generateId(),
          role: "assistant",
          content:
            data.message || "I'm not sure how to help with that. Try rephrasing your question.",
          timestamp: typeof data.timestamp === "number" ? data.timestamp : Date.now(),
        });
      }
    } catch (error) {
      const fallback =
        error instanceof Error && error.message
          ? `${error.message}\n\nTry asking for a smaller hint or clarifying question.`
          : "I'm currently unable to connect to the AI service. Try again in a moment.";
      appendMessage({
        id: generateId(),
        role: "assistant",
        content: fallback,
        timestamp: Date.now(),
      });
      streamingIdRef.current = null;
      setStreamingContent("");
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }, [
    input,
    loading,
    locked,
    canSend,
    appendMessage,
    messages,
    problemTitle,
    problemDescription,
    language,
    sessionId,
    problemId,
    orderIndex,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickHints = [
    "Give me a hint about the approach",
    "What data structure should I consider?",
    "What's the time complexity of my current approach?",
    "Help me think about edge cases",
  ];

  return (
    <div className={`ai-drawer${isOpen ? "" : " ai-drawer--collapsed"}`}>
      {/* ── Floating tab — Sparkles pill, visible only when collapsed ── */}
      <button
        type="button"
        className="ai-drawer-tab"
        onClick={() => setIsOpen(true)}
        title="Open AI assistant"
        aria-label="Open AI assistant"
      >
        <Sparkles className="ai-tab-sparkles-icon" />
      </button>

      {/* ── Main panel ── */}
      <div className="ai-panel">
        {/* Header */}
        <div className="ai-header">
          <div className="ai-header-left">
            <Bot className="ai-header-icon" />
            <span className="ai-header-title">AI Assistant</span>
          </div>
          <div className="ai-header-right">
            {!canSend && <span className="ai-readonly-pill">View Only</span>}
            <button
              type="button"
              className="ai-close-btn"
              onClick={() => setIsOpen(false)}
              title="Close AI assistant"
              aria-label="Close AI assistant"
            >
              <X className="ai-close-icon" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="ai-messages">
          {messages.length === 0 && (
            <div className="ai-empty">
              <Lightbulb className="ai-empty-icon" />
              <p className="ai-empty-text">
                Try working through the problem on your own first.
                When you're ready, ask for hints, explanations, or help
                debugging your approach.
              </p>
              <div className="ai-quick-hints">
                {quickHints.map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    className="ai-quick-btn"
                    disabled={!canSend || locked}
                    onClick={() => {
                      setInput(hint);
                      inputRef.current?.focus();
                    }}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`ai-msg ai-msg--${msg.role}`}>
              <div className="ai-msg-avatar">
                {msg.role === "assistant" ? (
                  <Bot className="ai-msg-avatar-icon" />
                ) : (
                  <span className="ai-msg-avatar-user">U</span>
                )}
              </div>
              <div className="ai-msg-content">
                {msg.role === "assistant" ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Live streaming bubble — rendered from local state, not Yjs */}
          {streaming && streamingContent && (
            <div className="ai-msg ai-msg--assistant ai-msg--streaming">
              <div className="ai-msg-avatar">
                <Bot className="ai-msg-avatar-icon" />
              </div>
              <div className="ai-msg-content">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
              </div>
            </div>
          )}

          {loading && !streaming && (
            <div className="ai-msg ai-msg--assistant ai-msg--loading">
              <div className="ai-msg-avatar">
                <Bot className="ai-msg-avatar-icon" />
              </div>
              <div className="ai-msg-content">
                <Loader2 className="ai-typing-spinner" />
                <span className="ai-typing-text">Thinking…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          className={`ai-input-area${locked ? " ai-input-area--locked" : ""}${!canSend ? " ai-input-area--readonly" : ""}`}
        >
          <textarea
            ref={inputRef}
            className="ai-input"
            placeholder={
              locked
                ? "Timer expired — assistant locked"
                : canSend
                  ? "Ask for a hint…"
                  : "Interviewer view — candidate can send messages"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={locked || loading || !canSend}
            rows={1}
          />
          <button
            type="button"
            className="ai-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || loading || locked || !canSend}
          >
            <Send className="ai-send-icon" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default AIAssistant;
