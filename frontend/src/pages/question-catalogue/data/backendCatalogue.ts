import type { Category, Difficulty, SubCategory } from "./catalogueData";

interface BackendManifestProblem {
  id: string;
  title: string;
  difficulty: Difficulty;
  path: string;
}

interface BackendManifestCategory {
  slug: string;
  count: number;
  problems: BackendManifestProblem[];
}

interface BackendManifest {
  total: number;
  categories: BackendManifestCategory[];
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
}

async function fetchBackendManifest(): Promise<BackendManifest> {
  const res = await fetch("/api/content/backend/manifest");
  if (!res.ok) throw new Error(`Failed to load backend manifest (${res.status})`);
  return res.json() as Promise<BackendManifest>;
}

export async function fetchBackendSubCategories(): Promise<SubCategory[]> {
  const manifest = await fetchBackendManifest();
  return mapManifestToSubCategories(manifest, "backend");
}

async function fetchDatabaseManifest(): Promise<BackendManifest> {
  const res = await fetch("/api/content/database/manifest");
  if (!res.ok) throw new Error(`Failed to load database manifest (${res.status})`);
  return res.json() as Promise<BackendManifest>;
}

export async function fetchDatabaseSubCategories(): Promise<SubCategory[]> {
  const manifest = await fetchDatabaseManifest();
  return mapManifestToSubCategories(manifest, "database");
}

function mapManifestToSubCategories(
  manifest: BackendManifest,
  topLevelTag: string,
): SubCategory[] {
  return manifest.categories.map((cat) => ({
    slug: cat.slug,
    label: titleCaseSlug(cat.slug),
    problems: cat.problems.map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      tags: [topLevelTag, cat.slug],
    })),
  }));
}

function cloneCategories(categories: Category[]): Category[] {
  return categories.map((cat) => ({
    ...cat,
    subCategories: cat.subCategories.map((sub) => ({
      ...sub,
      problems: sub.problems.map((p) => ({ ...p })),
    })),
  }));
}

export function mergeBackendIntoCategories(
  baseCategories: Category[],
  backendSubCategories: SubCategory[],
): Category[] {
  return mergeCategoryIntoCategories(
    baseCategories,
    "backend",
    backendSubCategories,
    "FastAPI backend challenges covering API design, auth, middleware, resilience, async patterns, and observability.",
  );
}

export function mergeDatabaseIntoCategories(
  baseCategories: Category[],
  databaseSubCategories: SubCategory[],
): Category[] {
  return mergeCategoryIntoCategories(
    baseCategories,
    "database",
    databaseSubCategories,
    "SQLite SQL interview challenges covering filtering, joins, aggregation, CTEs, window functions, and time-based analytics.",
  );
}

function mergeCategoryIntoCategories(
  baseCategories: Category[],
  categorySlug: string,
  subCategories: SubCategory[],
  description: string,
): Category[] {
  const cloned = cloneCategories(baseCategories);

  return cloned.map((cat) => {
    if (cat.slug !== categorySlug) return cat;

    const problemCount = subCategories.reduce(
      (n, s) => n + s.problems.length,
      0,
    );

    return {
      ...cat,
      problemCount,
      subCategories,
      description,
    };
  });
}
