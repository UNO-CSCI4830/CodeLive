/**
 * QuestionNav — horizontal navigation bar showing all problems in the
 * session. Highlights the current question and allows quick switching.
 * Interviewer controls the Next/Finish action.
 */

import { ChevronRight, CheckCircle2, Circle } from "lucide-react";
import type { SessionProblem } from "../types";
import "./QuestionNav.css";

interface Props {
  problems: SessionProblem[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onAdvance: () => void;
  /** Whether the advance button should be enabled */
  canAdvance: boolean;
  /** Disabled when session is completed */
  disabled?: boolean;
  /** Whether to show the advance control */
  showAdvance?: boolean;
}

export default function QuestionNav({
  problems,
  currentIndex,
  onSelect,
  onAdvance,
  canAdvance,
  disabled,
  showAdvance = true,
}: Props) {
  const isLastQuestion = currentIndex >= problems.length - 1;

  return (
    <div className="qnav">
      <div className="qnav-pills">
        {problems.map((p, idx) => {
          const isCurrent = idx === currentIndex;
          const isPast = idx < currentIndex;

          let stateClass = "qnav-pill--upcoming";
          if (isCurrent) stateClass = "qnav-pill--current";
          else if (isPast) stateClass = "qnav-pill--done";

          return (
            <button
              type="button"
              key={p.id}
              className={`qnav-pill ${stateClass}`}
              title={`Q${idx + 1}: ${p.problem_id.replace(/-/g, " ")}`}
              disabled={disabled}
              onClick={() => onSelect(idx)}
            >
              <span className="qnav-pill-icon">
                {isPast ? (
                  <CheckCircle2 className="qnav-icon-done" />
                ) : (
                  <Circle className="qnav-icon-pending" />
                )}
              </span>
              <span className="qnav-pill-label">Q{idx + 1}</span>
              <span className="qnav-pill-cat">{p.category}</span>
            </button>
          );
        })}
      </div>

      {!disabled && showAdvance && (
        <button
          type="button"
          className="qnav-advance-btn"
          onClick={onAdvance}
          disabled={!canAdvance}
          title={isLastQuestion ? "End session" : "Next question"}
        >
          {isLastQuestion ? "Finish" : "Next"}
          <ChevronRight className="qnav-advance-icon" />
        </button>
      )}
    </div>
  );
}
