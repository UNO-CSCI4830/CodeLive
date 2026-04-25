import { useEffect, useState } from "react";
import { categories as baseCategories, type Category } from "./catalogueData";
import {
  fetchBackendSubCategories,
  fetchDatabaseSubCategories,
  mergeBackendIntoCategories,
  mergeDatabaseIntoCategories,
} from "./backendCatalogue";

interface UseCatalogueCategoriesResult {
  categories: Category[];
  loading: boolean;
  error: string | null;
}

export function useCatalogueCategories(): UseCatalogueCategoriesResult {
  const [categories, setCategories] = useState<Category[]>(baseCategories);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [backendSubCategories, databaseSubCategories] = await Promise.all([
          fetchBackendSubCategories(),
          fetchDatabaseSubCategories(),
        ]);
        if (cancelled) return;

        const withBackend = mergeBackendIntoCategories(
          baseCategories,
          backendSubCategories,
        );
        const withDatabase = mergeDatabaseIntoCategories(
          withBackend,
          databaseSubCategories,
        );

        setCategories(withDatabase);
      } catch (e) {
        if (cancelled) return;
        setCategories(baseCategories);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, loading, error };
}
