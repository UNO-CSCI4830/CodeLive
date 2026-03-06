/**
 * AIAssistant — a sliding drawer panel for the interview session.
 *
 * Positioned absolutely on the far-right edge of the session layout.
 * A 36px tab is always visible; clicking it slides the full panel in/out.
 *
 * Chat resets whenever `problemKey` changes (new question loaded).
 * `currentCode` is read via a ref at send-time so it never goes stale.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Bot, Send, Loader2, Trash2, Lightbulb, Sparkles, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import "./AIAssistant.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface AIAssistantHandle {
  /** Returns a snapshot of all messages in the current conversation. */
  getMessages: () => Message[];
}

interface Props {
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
  { problemTitle, problemDescription, currentCode, language, locked, problemKey },
  ref,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

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

  // Reset conversation when the question changes
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [problemKey]);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const generateId = () =>
    `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || locked) return;

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
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
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: trimmed },
      ];

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: contextMessages }),
      });

      if (!res.ok) throw new Error("AI service unavailable");

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content:
            data.message || "I'm not sure how to help with that. Try rephrasing your question.",
          timestamp: Date.now(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content:
            "I'm currently unable to connect to the AI service. Here are some general tips:\n\n" +
            "- Break the problem into smaller sub-problems\n" +
            "- Consider edge cases (empty input, single element, etc.)\n" +
            "- Think about the time and space complexity of your approach\n" +
            "- Try working through a small example by hand first",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, locked, messages, problemTitle, problemDescription, language]);

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
            {messages.length > 0 && (
              <button
                type="button"
                className="ai-clear-btn"
                onClick={() => setMessages([])}
                title="Clear conversation"
              >
                <Trash2 className="ai-clear-icon" />
              </button>
            )}
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
                Ask me for hints, explanations, or help debugging your approach.
                I'll guide you without giving away the solution.
              </p>
              <div className="ai-quick-hints">
                {quickHints.map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    className="ai-quick-btn"
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

          {loading && (
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
        <div className={`ai-input-area${locked ? " ai-input-area--locked" : ""}`}>
          <textarea
            ref={inputRef}
            className="ai-input"
            placeholder={locked ? "Timer expired — assistant locked" : "Ask for a hint…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={locked || loading}
            rows={1}
          />
          <button
            type="button"
            className="ai-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || loading || locked}
          >
            <Send className="ai-send-icon" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default AIAssistant;
