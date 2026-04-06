import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useCatalogueCategories } from "./data/useCatalogueCategories";
import DifficultyBadge from "./components/DifficultyBadge";
import "./styles/CategoryDetailPage.css";

export default function CategoryDetailPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const { categories, loading } = useCatalogueCategories();
  const category = categorySlug
    ? categories.find((c) => c.slug === categorySlug)
    : undefined;
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!category || category.subCategories.length === 0) {
      setExpandedSubs(new Set());
      return;
    }
    setExpandedSubs(new Set([category.subCategories[0].slug]));
  }, [category?.slug, category?.subCategories]);

  const toggleSubCategory = (subSlug: string) => {
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(subSlug)) {
        next.delete(subSlug);
      } else {
        next.add(subSlug);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="catdetail-wrapper">
        <p className="catdetail-not-found">Loading category…</p>
      </div>
    );
  }

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
          <button
            type="button"
            className="catdetail-group-toggle"
            onClick={() => toggleSubCategory(sub.slug)}
            aria-expanded={expandedSubs.has(sub.slug)}
          >
            <span className="catdetail-group-title">
              {expandedSubs.has(sub.slug) ? (
                <ChevronDown className="catdetail-group-chevron" />
              ) : (
                <ChevronRight className="catdetail-group-chevron" />
              )}
              {sub.label}
            </span>
            <span className="catdetail-group-count">{sub.problems.length}</span>
          </button>

          {expandedSubs.has(sub.slug) && (
            <ul className="catdetail-list">
              {sub.problems.map((p) => {
                const hasPreview =
                  category.slug === "frontend" ||
                  category.slug === "leetcode" ||
                  category.slug === "backend" ||
                  category.slug === "database";
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
          )}
        </section>
      ))}
    </div>
  );
}
