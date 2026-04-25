import { useState } from "react";
import Markdown from "react-markdown";
import { ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
import DifficultyBadge from "../../components/DifficultyBadge";
import type { BackendProblem } from "../types";
import "../../frontendpreview/styles/ProblemDescription.css";

interface Props {
  problem: BackendProblem;
  onHintReveal?: (count: number) => void;
}

export default function BackendProblemDescription({ problem, onHintReveal }: Props) {
  const [showHints, setShowHints] = useState(false);

  return (
    <div className="pd-panel">
      <div className="pd-header-bar">Description</div>

      <div className="pd-content">
        <div className="pd-title-row">
          <h2 className="pd-title">{problem.title}</h2>
          <DifficultyBadge level={problem.difficulty} />
        </div>

        {problem.tags && problem.tags.length > 0 && (
          <div className="pd-tags">
            {problem.tags.map((t) => (
              <span key={t} className="pd-tag">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="pd-markdown">
          <Markdown>{problem.description}</Markdown>
        </div>

        {problem.constraints && (
          <div className="pd-section">
            <h3 className="pd-section-title">Constraints</h3>
            <div className="pd-markdown pd-markdown--sm">
              <Markdown>{problem.constraints}</Markdown>
            </div>
          </div>
        )}

        {problem.hints && problem.hints.length > 0 && (
          <div className="pd-section">
            <button
              type="button"
              className="pd-hints-toggle"
              onClick={() => {
                const next = !showHints;
                setShowHints(next);
                if (next) onHintReveal?.(problem.hints?.length ?? 1);
              }}
            >
              <Lightbulb className="pd-hints-icon" />
              <span>Hints ({problem.hints.length})</span>
              {showHints ? (
                <ChevronDown className="pd-hints-chevron" />
              ) : (
                <ChevronRight className="pd-hints-chevron" />
              )}
            </button>

            {showHints && (
              <ol className="pd-hints-list">
                {problem.hints.map((h, i) => (
                  <li key={i} className="pd-hint">
                    {h}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
