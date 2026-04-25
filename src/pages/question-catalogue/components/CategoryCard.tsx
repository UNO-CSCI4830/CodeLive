import { Link } from "react-router-dom";
import { Monitor, Code, Server, Database, type LucideIcon } from "lucide-react";
import type { Category } from "../data/catalogueData";
import "./CategoryCard.css";

const iconMap: Record<string, LucideIcon> = {
  Monitor,
  Code,
  Server,
  Database,
};

interface Props {
  category: Category;
}

export default function CategoryCard({ category }: Props) {
  const Icon = iconMap[category.icon] ?? Code;
  const isEmpty = category.problemCount === 0;

  return (
    <Link
      to={isEmpty ? "#" : `/questions/${category.slug}`}
      className={`cat-card ${isEmpty ? "cat-card--empty" : ""}`}
      aria-disabled={isEmpty}
      tabIndex={isEmpty ? -1 : undefined}
      onClick={isEmpty ? (e) => e.preventDefault() : undefined}
    >
      <div className="cat-card-icon-wrapper">
        <Icon className="cat-card-icon" />
      </div>

      <div className="cat-card-body">
        <h3 className="cat-card-title">{category.label}</h3>
        <p className="cat-card-desc">{category.description}</p>
      </div>

      <div className="cat-card-footer">
        {isEmpty ? (
          <span className="cat-card-badge cat-card-badge--soon">Coming soon</span>
        ) : (
          <span className="cat-card-count">
            {category.problemCount} problem{category.problemCount !== 1 && "s"}
          </span>
        )}
      </div>
    </Link>
  );
}
