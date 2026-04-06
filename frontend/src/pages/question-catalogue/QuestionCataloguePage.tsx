import { useCatalogueCategories } from "./data/useCatalogueCategories";
import CategoryCard from "./components/CategoryCard";
import "./styles/QuestionCataloguePage.css";

export default function QuestionCataloguePage() {
  const { categories, loading } = useCatalogueCategories();

  return (
    <div className="catalogue-wrapper">
      <div className="catalogue-header">
        <h1 className="catalogue-heading">Question Catalogue</h1>
        <p className="catalogue-subheading">
          Browse interview questions by category.
        </p>
      </div>

      <div className="catalogue-grid">
        {loading ? (
          <p>Loading catalogue…</p>
        ) : (
          categories.map((cat) => (
            <CategoryCard key={cat.slug} category={cat} />
          ))
        )}
      </div>
    </div>
  );
}
