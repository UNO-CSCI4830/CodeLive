/**
 * QuestionNav — horizontal navigation bar showing all problems in the
 * session. Highlights the current question and shows locked status.
 * Both users can advance to the next question.
 */

import { ChevronRight, Lock, CheckCircle2, Circle } from "lucide-react";
import type { SessionProblem } from "../types";
import "./QuestionNav.css";

interface Props {
  problems: SessionProblem[];
  currentIndex: number;
  onAdvance: () => void;
  /** Whether the advance button should be enabled */
  canAdvance: boolean;
  /** Disabled when session is completed */
  disabled?: boolean;
}

export default function QuestionNav({
  problems,
  currentIndex,
  onAdvance,
  canAdvance,
  disabled,
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
            <div
              key={p.id}
              className={`qnav-pill ${stateClass} ${p.locked ? "qnav-pill--locked" : ""}`}
              title={`Q${idx + 1}: ${p.problem_id.replace(/-/g, " ")}`}
            >
              <span className="qnav-pill-icon">
                {p.locked ? (
                  <Lock className="qnav-icon-lock" />
                ) : isPast ? (
                  <CheckCircle2 className="qnav-icon-done" />
                ) : (
                  <Circle className="qnav-icon-pending" />
                )}
              </span>
              <span className="qnav-pill-label">Q{idx + 1}</span>
              <span className="qnav-pill-cat">{p.category}</span>
            </div>
          );
        })}
      </div>

      {!disabled && (
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
