import { useMemo, useState } from "react";
import Markdown from "react-markdown";
import { ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
import type { LeetcodeProblem, TestCase } from "../types";
import DifficultyBadge from "../../components/DifficultyBadge";
import "../styles/LeetcodeProblemDescription.css";

interface Props {
  problem: LeetcodeProblem;
  /** Called with the new revealed count whenever a hint is revealed. */
  onHintReveal?: (count: number) => void;
}

/** How many test cases to show as inline examples (like LeetCode). */
const MAX_EXAMPLES = 3;

/**
 * Format a single test case into a LeetCode-style example string.
 *
 * Example 1:
 *   Input: nums = [2,7,11,15], target = 9
 *   Output: [0,1]
 *   Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
 */
function formatExample(tc: TestCase, index: number): string {
  const inputLines = Object.entries(tc.input)
    .map(([key, val]) => `${key} = ${JSON.stringify(val)}`)
    .join(", ");

  const outputLine = JSON.stringify(tc.expected.result);

  let text = `**Example ${index + 1}:**\n\`\`\`\nInput: ${inputLines}\nOutput: ${outputLine}`;
  if (tc.explanation) {
    text += `\nExplanation: ${tc.explanation}`;
  }
  text += "\n```";

  return text;
}

export default function LeetcodeProblemDescription({ problem, onHintReveal }: Props) {
  const [hintsOpen, setHintsOpen] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);

  /** Build the examples markdown from the first few test cases. */
  const examplesMarkdown = useMemo(() => {
    if (!problem.testCases || problem.testCases.length === 0) return "";
    return problem.testCases
      .slice(0, MAX_EXAMPLES)
      .map((tc, i) => formatExample(tc, i))
      .join("\n\n");
  }, [problem.testCases]);

  /**
   * Split the raw description into the main body and constraints.
   * Many problems embed "Constraints:" inline — pull it out so we
   * can render it in its own styled section.
   */
  const { body, constraints } = useMemo(() => {
    const raw = problem.description ?? "";
    const idx = raw.search(/constraints?\s*:/i);
    if (idx === -1) return { body: raw.trim(), constraints: "" };
    return {
      body: raw.slice(0, idx).trim(),
      constraints: raw.slice(idx).trim(),
    };
  }, [problem.description]);

  const hints = problem.hints ?? [];
  const hasMoreHints = revealedCount < hints.length;

  return (
    <div className="lpd-panel">
      <div className="lpd-content">
        {/* Title + difficulty */}
        <div className="lpd-title-row">
          <h2 className="lpd-title">{problem.title}</h2>
          <DifficultyBadge level={problem.difficulty} />
        </div>

        {/* Tags */}
        {problem.tags && problem.tags.length > 0 && (
          <div className="lpd-tags">
            {problem.tags.map((t) => (
              <span key={t} className="lpd-tag">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Description body (markdown) */}
        <div className="lpd-markdown">
          <Markdown>{body}</Markdown>
        </div>

        {/* LeetCode-style examples built from test cases */}
        {examplesMarkdown && (
          <div className="lpd-examples">
            <Markdown>{examplesMarkdown}</Markdown>
          </div>
        )}

        {/* Constraints */}
        {constraints && (
          <div className="lpd-constraints">
            <Markdown>{constraints}</Markdown>
          </div>
        )}

        {/* Hints — revealed one at a time */}
        {hints.length > 0 && (
          <div className="lpd-section">
            <button
              type="button"
              className="lpd-hints-toggle"
              onClick={() => {
                if (!hintsOpen) setHintsOpen(true);
              }}
            >
              <Lightbulb className="lpd-hints-icon" />
              <span>Hints</span>
              {hintsOpen ? (
                <ChevronDown className="lpd-hints-chevron" />
              ) : (
                <ChevronRight className="lpd-hints-chevron" />
              )}
            </button>

            {hintsOpen && (
              <div className="lpd-hints-body">
                {revealedCount === 0 && (
                  <p className="lpd-hints-prompt">
                    Stuck? Reveal hints one at a time.
                  </p>
                )}

                {hints.slice(0, revealedCount).map((h, i) => (
                  <div key={i} className="lpd-hint">
                    <span className="lpd-hint-num">Hint {i + 1}</span>
                    <p className="lpd-hint-text">{h}</p>
                  </div>
                ))}

                {hasMoreHints && (
                  <button
                    type="button"
                    className="lpd-hint-reveal-btn"
                    onClick={() => {
                      const next = revealedCount + 1;
                      setRevealedCount(next);
                      onHintReveal?.(next);
                    }}
                  >
                    {revealedCount === 0
                      ? "Show first hint"
                      : `Show hint ${revealedCount + 1} of ${hints.length}`}
                  </button>
                )}

                {!hasMoreHints && revealedCount > 0 && (
                  <p className="lpd-hints-exhausted">No more hints.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
