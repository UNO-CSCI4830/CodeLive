import { useParams, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCategoryBySlug } from "./data/catalogueData";
import DifficultyBadge from "./components/DifficultyBadge";
import "./styles/CategoryDetailPage.css";

export default function CategoryDetailPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const category = categorySlug ? getCategoryBySlug(categorySlug) : undefined;

  if (!category) {
    return (
      <div className="catdetail-wrapper">
        <p className="catdetail-not-found">Category not found.</p>
        <Link to="/questions" className="catdetail-back">
          <ChevronLeft className="catdetail-back-icon" /> Back to catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="catdetail-wrapper">
      {/* ── Breadcrumb / back link ── */}
      <Link to="/questions" className="catdetail-back">
        <ChevronLeft className="catdetail-back-icon" /> Question Catalogue
      </Link>

      <header className="catdetail-header">
        <h1 className="catdetail-heading">{category.label}</h1>
        <p className="catdetail-meta">
          {category.problemCount} problem{category.problemCount !== 1 && "s"}
        </p>
      </header>

      {/* ── Sub-category groups ── */}
      {category.subCategories.map((sub) => (
        <section key={sub.slug} className="catdetail-group">
          <h2 className="catdetail-group-title">
            {sub.label}
            <span className="catdetail-group-count">{sub.problems.length}</span>
          </h2>

          <ul className="catdetail-list">
            {sub.problems.map((p) => {
              const hasPreview = category.slug === "frontend" || category.slug === "leetcode";
              const inner = (
                <>
                  <span className="catdetail-item-title">{p.title}</span>
                  <span className="catdetail-item-right">
                    <DifficultyBadge level={p.difficulty} />
                    {hasPreview && <ChevronRight className="catdetail-item-chevron" />}
                  </span>
                </>
              );

              return hasPreview ? (
                <li key={p.id}>
                  <Link
                    to={`/questions/${category.slug}/${p.id}`}
                    className="catdetail-item catdetail-item--link"
                  >
                    {inner}
                  </Link>
                </li>
              ) : (
                <li key={p.id} className="catdetail-item">
                  {inner}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
