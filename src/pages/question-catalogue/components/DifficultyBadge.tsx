import type { Difficulty } from "../data/catalogueData";
import "./DifficultyBadge.css";

const labels: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export default function DifficultyBadge({ level }: { level: Difficulty }) {
  return (
    <span className={`diff-badge diff-badge--${level}`}>
      {labels[level]}
    </span>
  );
}
